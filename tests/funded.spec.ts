// AgentKey funded flow test: the full on-chain demo end to end.
// BLOCKED on the faucet (a human step): this test skips cleanly when the
// wallet holds less than 2 test CELO.
//
// Two ways to run it funded:
// 1. Set AGENTKEY_TEST_ADMIN_KEY to the private key of a demo wallet that
//    already holds at least 2 test CELO on Celo Sepolia. The key is read
//    from the environment only and is never written to the repo.
// 2. Run it unfunded, read the fresh wallet address from the skip message,
//    fund it at https://faucet.celo.org/celo-sepolia, then re-run with the
//    key from the browser's localStorage (agentkey:v1, adminKey field).
import { expect, test } from "@playwright/test";
import { privateKeyToAccount } from "viem/accounts";

const MIN_BALANCE = 2.0;

test("funded flow: grant, run the three tasks, revoke", async ({ page }) => {
  test.setTimeout(15 * 60_000);

  const fundedKey = process.env.AGENTKEY_TEST_ADMIN_KEY as
    | `0x${string}`
    | undefined;

  if (fundedKey) {
    // Seed the app with the funded demo wallet before it loads.
    const account = privateKeyToAccount(fundedKey);
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
      { address: account.address, adminKey: fundedKey },
    );
    await page.goto("/");
    await expect(page.getByTestId("fund-step")).toBeVisible();
  } else {
    // No funded key: create a fresh demo wallet and check its balance.
    await page.goto("/");
    await page.getByTestId("start-button").click();
    await page.getByTestId("create-demo-wallet").click();
    await expect(page.getByTestId("fund-step")).toBeVisible({
      timeout: 280_000,
    });
  }

  // Read the balance from the UI.
  await expect(page.getByTestId("balance-value")).toContainText("CELO", {
    timeout: 120_000,
  });
  const balanceText =
    (await page.getByTestId("balance-value").textContent()) ?? "";
  const balance = Number(balanceText.replace(/[^0-9.]/g, ""));
  const walletAddress = await page
    .getByTestId("wallet-address")
    .textContent();

  test.skip(
    Number.isNaN(balance) || balance < MIN_BALANCE,
    `Wallet ${walletAddress} holds ${balance} CELO, needs ${MIN_BALANCE}. ` +
      `Fund it at https://faucet.celo.org/celo-sepolia and re-run.`,
  );

  // Funded: run the full flow.
  await page.getByTestId("fund-continue").click();
  await expect(page.getByTestId("policy-form")).toBeVisible();
  await page.getByTestId("policy-cap").fill("0.05");
  await page.getByTestId("policy-expiry").fill("24");
  await page.getByTestId("policy-save").click();

  await expect(page.getByTestId("grant-step")).toBeVisible();
  await page.getByTestId("grant-session-button").click();
  await expect(page.getByTestId("session-granted-pill")).toBeVisible({
    timeout: 280_000,
  });
  await expect(page.getByTestId("tx-link").first()).toBeVisible();
  await page.getByTestId("grant-continue").click();

  await expect(page.getByTestId("agent-tasks")).toBeVisible();
  await page.getByTestId("run-all-tasks").click();
  await expect(
    page.getByTestId("task-outcome-transfer-in-cap"),
  ).toContainText("Confirmed", { timeout: 280_000 });
  await expect(
    page.getByTestId("task-outcome-transfer-over-cap"),
  ).toContainText("Blocked by policy", { timeout: 280_000 });
  await expect(
    page.getByTestId("task-outcome-blocked-target"),
  ).toContainText("Blocked by policy", { timeout: 280_000 });

  await page.getByTestId("tasks-continue").click();
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await expect(page.getByTestId("session-status")).toContainText("Valid", {
    timeout: 120_000,
  });

  await page.getByTestId("revoke-button").click();
  await expect(page.getByTestId("revoked-note")).toBeVisible({
    timeout: 280_000,
  });
  await expect(page.getByTestId("session-status")).toContainText("Revoked");

  // After revoke, the agent tasks are disabled.
  await page.getByTestId("step-5").click();
  await expect(page.getByTestId("run-all-tasks")).toBeDisabled();
});
