// Diagnostic: reproduce the demo-video grant step in the sandbox browser
// with console + network capture. Does NOT record video. Spends ~0.43 CELO
// if the grant succeeds (demo wallet holds 2.0; video needs ~1.18 after).
//
// Run: cd app && AGENTKEY_TEST_ADMIN_KEY=0x... node scripts/diag-grant.mjs

import { chromium } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

const SITE = "https://agentkey-kappa.vercel.app";
const PROXY_PORT = Number(process.env.AGENTKEY_PROXY_PORT || 18080);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[diag-grant ${new Date().toISOString().slice(11, 19)}]`, ...a);

const adminKey = process.env.AGENTKEY_TEST_ADMIN_KEY;
if (!adminKey) throw new Error("Set AGENTKEY_TEST_ADMIN_KEY");
const account = privateKeyToAccount(adminKey);
log("wallet", account.address);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  proxy: { server: `http://127.0.0.1:${PROXY_PORT}` },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning")
    log("console", m.type(), m.text().slice(0, 500));
});
page.on("pageerror", (e) => log("pageerror", String(e).slice(0, 500)));
page.on("requestfailed", (r) =>
  log("reqfail", r.url().slice(0, 120), r.failure()?.errorText),
);
page.on("response", (r) => {
  if (r.status() >= 400) log("http", r.status(), r.url().slice(0, 120));
});

await page.addInitScript(
  ({ address, adminKey }) => {
    localStorage.setItem(
      "agentkey:v1",
      JSON.stringify({
        version: 1,
        step: 2,
        mode: "demo",
        walletAddress: address,
        adminKey,
        sessionKey: null,
        serializedSession: null,
        sessionMeta: null,
        policy: null,
        agentIdentity: null,
        revoked: false,
        revokeTxHash: null,
        history: [],
      }),
    );
  },
  { address: account.address, adminKey },
);

await page.goto(SITE, { waitUntil: "networkidle", timeout: 120_000 });
await page.getByTestId("fund-step").waitFor({ timeout: 60_000 });
log("fund step shown");
// Wait for the balance to settle like the recorder does.
for (let i = 0; i < 30; i++) {
  const t = (await page.getByTestId("balance-value").textContent()) ?? "";
  const b = Number(t.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(b)) {
    log("balance", b, "CELO");
    break;
  }
  await sleep(2000);
}
await page.getByTestId("fund-continue").click();
await page.getByTestId("policy-form").waitFor({ timeout: 60_000 });
await page.getByTestId("policy-cap").fill("0.5");
await page.getByTestId("policy-expiry").fill("24");
await page.getByTestId("policy-save").click();
await page.getByTestId("grant-step").waitFor({ timeout: 60_000 });
log("grant step shown, clicking grant");
await page.getByTestId("grant-session-button").click();

// Poll the grant status / error / pill for up to 8 minutes.
const t0 = Date.now();
let granted = false;
while (Date.now() - t0 < 480_000) {
  const pill = await page.getByTestId("session-granted-pill").count();
  if (pill > 0) {
    granted = true;
    break;
  }
  const err = await page.locator("[data-testid='error-box'], .error-box").count();
  let errText = "";
  if (err > 0) {
    errText = ((await page.locator(".error-box").first().textContent()) ?? "").slice(0, 300);
  }
  const body = (await page.locator("[data-testid='grant-step']").textContent()) ?? "";
  const m = body.match(/Granting[^.]*\.|retrying[^.]*\.|The relay[^.]*/i);
  log(`t+${Math.round((Date.now() - t0) / 1000)}s`, "status:", m ? m[0].slice(0, 120) : "(no status text)", errText ? `ERROR: ${errText}` : "");
  if (errText) break;
  await sleep(15000);
}
log(granted ? "GRANTED" : "NOT GRANTED within 8 min");
await browser.close();
