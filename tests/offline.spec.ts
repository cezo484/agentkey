// AgentKey offline tests: UI and policy logic only.
// These tests seed localStorage and block non-local requests, so they run
// without the Altana relay, Celo RPC, faucet, or secrets. The network and
// funded flows stay opt-in through AGENTKEY_NETWORK_TESTS=1.
import { expect, test, type Page } from "@playwright/test";

const TEST_WALLET = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf";
const TEST_ADMIN_KEY =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

async function blockExternalRequests(page: Page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    await route.abort();
  });
}

async function seedPolicyStep(page: Page) {
  await page.addInitScript(
    ({ walletAddress, adminKey }) => {
      localStorage.setItem(
        "agentkey:v1",
        JSON.stringify({
          version: 1,
          step: 3,
          mode: "demo",
          walletAddress,
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
    { walletAddress: TEST_WALLET, adminKey: TEST_ADMIN_KEY },
  );
}

test("landing and locked steps work offline", async ({ page }) => {
  await blockExternalRequests(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(
    page.getByRole("heading", { name: /Give your agent a wallet/i }),
  ).toBeVisible();
  await expect(page.getByTestId("landing-card")).toBeVisible();
  await page.getByTestId("start-button").click();
  await expect(page.getByTestId("create-wallet")).toBeVisible();
  await expect(page.getByTestId("step-4")).toBeDisabled();
  await expect(page.getByTestId("step-6")).toBeDisabled();
});

test("seeded policy, dashboard, and reset work offline", async ({ page }) => {
  await blockExternalRequests(page);
  await seedPolicyStep(page);
  await page.goto("/");

  await expect(page.getByTestId("policy-form")).toBeVisible();

  await page.getByTestId("policy-cap").fill("0.001");
  await page.getByTestId("policy-save").click();
  await expect(page.getByText(/at least 0.01 CELO/)).toBeVisible();

  await page.getByTestId("policy-custom-address").fill("not-an-address");
  await page.getByTestId("policy-add-address").click();
  await expect(page.getByText(/does not look like a valid address/)).toBeVisible();

  await page.getByTestId("policy-cap").fill("0.5");
  await page.getByTestId("policy-expiry").fill("24");
  await expect(page.getByTestId("allow-list")).toContainText("0xaa6A");
  await page.getByTestId("policy-save").click();

  await expect(page.getByTestId("grant-step")).toBeVisible();
  const summary = await page.getByTestId("grant-policy-summary").textContent();
  expect(summary).toContain("0.5 CELO");
  expect(summary).toContain("24");

  await page.getByTestId("step-6").click();
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await expect(page.getByTestId("session-status")).toContainText(
    "No session granted",
  );
  await expect(page.getByTestId("revoke-button")).toBeDisabled();
  await expect(page.getByTestId("history-card")).toBeVisible();

  await page.getByTestId("dashboard-reset").click();
  await expect(page.getByTestId("landing-card")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("agentkey:v1"));
  expect(stored).not.toBeNull();
  const parsed = JSON.parse(stored as string) as {
    walletAddress: unknown;
    adminKey: unknown;
    sessionKey: unknown;
    sessionMeta: unknown;
    policy: unknown;
    history: unknown[];
  };
  expect(parsed.walletAddress).toBeNull();
  expect(parsed.adminKey).toBeNull();
  expect(parsed.sessionKey).toBeNull();
  expect(parsed.sessionMeta).toBeNull();
  expect(parsed.policy).toBeNull();
  expect(parsed.history).toEqual([]);
});
