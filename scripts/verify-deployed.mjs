// Verify the deployed Vercel site: landing renders, wallet creation works
// against the live relay from the deployed origin.
import { chromium } from "@playwright/test";

const URL = "https://agentkey-kappa.vercel.app";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  // The sandbox egress proxy re-signs TLS with its own CA, which Chromium
  // does not trust. Verification-only; real browsers see Vercel's real cert.
  ignoreHTTPSErrors: true,
  proxy: { server: "http://127.0.0.1:18080", bypass: "localhost,127.0.0.1" },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: "networkidle" });
console.log("title:", await page.title());
await page.getByTestId("start-button").click();
await page.getByTestId("create-demo-wallet").click();
await page.getByTestId("fund-step").waitFor({ timeout: 240_000 });
const address = await page.getByTestId("wallet-address").textContent();
console.log("deployed site: wallet created:", address);
await page.getByTestId("balance-value").waitFor({ timeout: 120_000 });
console.log(
  "deployed site: balance shown:",
  await page.getByTestId("balance-value").textContent(),
);
await browser.close();
console.log("DEPLOYED SITE OK");
