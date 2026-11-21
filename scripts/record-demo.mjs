// AgentKey demo video recorder. Records the full on-chain demo against the
// LIVE site (https://agentkey-kappa.vercel.app) and produces one mp4.
//
// Two parts, joined with ffmpeg:
//   Part 1 (free, no funds): landing -> create a demo wallet -> fund step
//   (shows the fresh address and the faucet link).
//   Part 2 (funded): the same wallet flow with real funds: fund step
//   (balance check) -> policy -> grant session -> 3 agent tasks ->
//   dashboard -> revoke.
//
// Part 2 needs a funded wallet. Set AGENTKEY_TEST_ADMIN_KEY to the private
// key of a demo wallet holding at least 1.6 test CELO on Celo Sepolia
// (the full flow costs about 1.5 CELO at current gas prices; see
// research/altana/scratch/flow-proof-20261121.md). The key is read from
// the environment only, never printed, never written to disk.
//
// Run: cd app && AGENTKEY_TEST_ADMIN_KEY=0x... node scripts/record-demo.mjs
// Output: ../demo-video/agentkey-demo-<date>.mp4 (plus the raw .webm parts)
//
// The sandboxed browser reaches HTTPS hosts through the local forward proxy
// (scripts/local-proxy.mjs); this script starts it if it is not running.

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

const SITE = "https://agentkey-kappa.vercel.app";
const PROXY_PORT = Number(process.env.AGENTKEY_PROXY_PORT || 18080);
const MIN_BALANCE = 1.6; // CELO; the full funded flow costs ~1.5
const STEP_TIMEOUT = 280_000;

const dir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(dir, "..");
const outDir = path.join(appDir, "..", "demo-video");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const rawDir = path.join(outDir, `raw-${stamp}`);
fs.mkdirSync(rawDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[record-demo]`, ...a);

async function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect(port, "127.0.0.1");
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
  });
}

async function ensureProxy() {
  if (await portOpen(PROXY_PORT)) {
    log(`local proxy already running on :${PROXY_PORT}`);
    return null;
  }
  const child = spawn(process.execPath, [path.join(dir, "local-proxy.mjs")], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    if (await portOpen(PROXY_PORT)) {
      log(`local proxy started on :${PROXY_PORT} (pid ${child.pid})`);
      return child.pid;
    }
    await sleep(300);
  }
  throw new Error("local proxy did not start");
}

// --- Part 1: create a demo wallet on camera (free, no funds) -------------
async function recordPart1(browser) {
  log("part 1: create demo wallet (free)");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    proxy: { server: `http://127.0.0.1:${PROXY_PORT}` },
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("landing-card").waitFor({ timeout: 60_000 });
  await sleep(3000);
  await page.getByTestId("start-button").click();
  await page.getByTestId("create-wallet").waitFor({ timeout: 60_000 });
  await sleep(2000);
  await page.getByTestId("create-demo-wallet").click();
  await page.getByTestId("fund-step").waitFor({ timeout: STEP_TIMEOUT });
  const freshAddress = await page.getByTestId("wallet-address").textContent();
  log("part 1: fresh demo wallet:", freshAddress);
  await sleep(5000); // show the address + faucet link
  const videoPath = await page.video().path();
  await ctx.close();
  return { videoPath, freshAddress };
}

// --- Part 2: full funded flow --------------------------------------------
async function recordPart2(browser, adminKey) {
  const account = privateKeyToAccount(adminKey);
  log("part 2: funded flow for", account.address);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    proxy: { server: `http://127.0.0.1:${PROXY_PORT}` },
    recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
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

  await page
    .getByTestId("balance-value")
    .waitFor({ timeout: 120_000 });
  const balanceText =
    (await page.getByTestId("balance-value").textContent()) ?? "";
  const balance = Number(balanceText.replace(/[^0-9.]/g, ""));
  log(`part 2: wallet balance ${balance} CELO (needs ${MIN_BALANCE})`);
  if (Number.isNaN(balance) || balance < MIN_BALANCE) {
    throw new Error(
      `Wallet ${account.address} holds ${balance} CELO, needs ${MIN_BALANCE}. ` +
        `Fund it at https://faucet.celo.org/celo-sepolia and re-run.`,
    );
  }
  await sleep(3000);

  await page.getByTestId("fund-continue").click();
  await page.getByTestId("policy-form").waitFor({ timeout: 60_000 });
  await sleep(2000);
  await page.getByTestId("policy-cap").fill("0.5");
  await page.getByTestId("policy-expiry").fill("24");
  await sleep(1500);
  await page.getByTestId("policy-save").click();

  await page.getByTestId("grant-step").waitFor({ timeout: 60_000 });
  await sleep(2000);
  await page.getByTestId("grant-session-button").click();
  await page
    .getByTestId("session-granted-pill")
    .waitFor({ timeout: STEP_TIMEOUT });
  await page.getByTestId("tx-link").first().waitFor({ timeout: 60_000 });
  log("part 2: session granted");
  await sleep(4000);
  await page.getByTestId("grant-continue").click();

  await page.getByTestId("agent-tasks").waitFor({ timeout: 60_000 });
  await sleep(2000);
  await page.getByTestId("run-all-tasks").click();
  await page
    .getByTestId("task-outcome-transfer-in-cap")
    .waitFor({ timeout: STEP_TIMEOUT });
  await page
    .getByTestId("task-outcome-transfer-over-cap")
    .waitFor({ timeout: STEP_TIMEOUT });
  await page
    .getByTestId("task-outcome-blocked-target")
    .waitFor({ timeout: STEP_TIMEOUT });
  log("part 2: all three tasks finished");
  await sleep(5000);

  await page.getByTestId("tasks-continue").click();
  await page.getByTestId("dashboard").waitFor({ timeout: 60_000 });
  await page
    .getByTestId("session-status")
    .waitFor({ timeout: 120_000 });
  await sleep(4000);

  await page.getByTestId("revoke-button").click();
  await page.getByTestId("revoked-note").waitFor({ timeout: STEP_TIMEOUT });
  log("part 2: session revoked");
  await sleep(5000);

  const videoPath = await page.video().path();
  await ctx.close();
  return { videoPath };
}

// --- ffmpeg: convert parts to mp4 and join -------------------------------
function buildFinalMp4(part1, part2) {
  const p1mp4 = path.join(rawDir, "part1.mp4");
  const p2mp4 = path.join(rawDir, "part2.mp4");
  const finalMp4 = path.join(outDir, `agentkey-demo-${stamp}.mp4`);
  const conv = (src, dst) =>
    execSync(
      `ffmpeg -y -loglevel error -i "${src}" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -an "${dst}"`,
      { stdio: "inherit" },
    );
  conv(part1, p1mp4);
  conv(part2, p2mp4);
  const listFile = path.join(rawDir, "concat.txt");
  fs.writeFileSync(listFile, `file '${p1mp4}'\nfile '${p2mp4}'\n`);
  execSync(
    `ffmpeg -y -loglevel error -f concat -safe 0 -i "${listFile}" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -an "${finalMp4}"`,
    { stdio: "inherit" },
  );
  const probe = execSync(
    `ffprobe -v error -show_entries format=duration,size -of csv=p=0 "${finalMp4}"`,
    { encoding: "utf8" },
  ).trim();
  log("final video:", finalMp4, `(duration,size: ${probe})`);
  return finalMp4;
}

async function main() {
  const adminKey = process.env.AGENTKEY_TEST_ADMIN_KEY;
  if (!adminKey || !/^0x[0-9a-fA-F]{64}$/.test(adminKey)) {
    console.error(
      "Set AGENTKEY_TEST_ADMIN_KEY to the 0x-prefixed private key of a " +
        `funded demo wallet (needs ${MIN_BALANCE} test CELO on Celo Sepolia).`,
    );
    process.exit(1);
  }
  await ensureProxy();
  const browser = await chromium.launch({ headless: true });
  try {
    const p1 = await recordPart1(browser);
    const p2 = await recordPart2(browser, adminKey);
    const finalMp4 = buildFinalMp4(p1.videoPath, p2.videoPath);
    console.log("DONE. Final video:", finalMp4);
    console.log(
      "Part 1 fresh wallet (unfunded, for reference):",
      p1.freshAddress,
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("record-demo FAILED:", err.message);
  process.exit(1);
});
