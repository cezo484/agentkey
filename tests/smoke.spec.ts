// AgentKey smoke tests: the full UI flow in demo mode without funds.
// The tests run in order and share one browser context, because each step
// builds on the previous one (wallet -> fund -> policy -> grant -> dashboard).
// The funded on-chain flow lives in funded.spec.ts and skips when the wallet
// has no test CELO.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test.describe.serial("AgentKey smoke flow (demo mode, no funds)", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("1. Landing explains the product and Start opens wallet creation", async () => {
    await expect(
      page.getByRole("heading", { name: /Give your agent a wallet/i }),
    ).toBeVisible();
    await expect(page.getByTestId("landing-card")).toBeVisible();
    await page.getByTestId("start-button").click();
    await expect(page.getByTestId("create-wallet")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Create your agent wallet/i }),
    ).toBeVisible();
  });

  test("2. Step indicator shows all seven steps with the current one active", async () => {
    for (let i = 0; i < 7; i++) {
      await expect(page.getByTestId(`step-${i}`)).toBeVisible();
    }
    await expect(page.getByTestId("step-1")).toHaveAttribute(
      "aria-current",
      "step",
    );
    // Steps ahead of the wallet are locked before a wallet exists.
    await expect(page.getByTestId("step-4")).toBeDisabled();
    await expect(page.getByTestId("step-6")).toBeDisabled();
  });

  test("3. Demo wallet creation produces a wallet address", async () => {
    test.setTimeout(300_000);
    await page.getByTestId("create-demo-wallet").click();
    // Creation registers with the Altana relay; testnet can be slow.
    await expect(page.getByTestId("fund-step")).toBeVisible({
      timeout: 280_000,
    });
    const address = await page.getByTestId("wallet-address").textContent();
    expect(address).toMatch(/^0x[0-9a-fA-F]{8}\.\.\.[0-9a-fA-F]{8}$/);
    await expect(page.getByTestId("header-wallet")).toBeVisible();
    await expect(page.getByTestId("copy-address")).toBeVisible();
  });

  test("4. Fund step shows the faucet link and a live balance", async () => {
    test.setTimeout(180_000);
    const faucet = page.getByTestId("faucet-link");
    await expect(faucet).toBeVisible();
    await expect(faucet).toHaveAttribute(
      "href",
      "https://faucet.celo.org/celo-sepolia",
    );
    // Fresh wallet: balance is 0 CELO and the unfunded pill shows.
    await expect(page.getByTestId("balance-value")).toContainText("CELO", {
      timeout: 120_000,
    });
    await expect(page.getByTestId("unfunded-pill")).toBeVisible();
    await expect(page.getByTestId("fund-continue")).toBeDisabled();
    // Refresh works and keeps the balance visible.
    await page.getByTestId("refresh-balance").click();
    await expect(page.getByTestId("balance-value")).toContainText("CELO", {
      timeout: 120_000,
    });
  });

  test("5. Policy form rejects a bad cap and a bad address", async () => {
    // Reach the policy step from the step list (funding is not required to
    // set the policy).
    await page.getByTestId("step-3").click();
    await expect(page.getByTestId("policy-form")).toBeVisible();

    // Cap below the minimum.
    await page.getByTestId("policy-cap").fill("0.001");
    await page.getByTestId("policy-save").click();
    await expect(page.getByText(/at least 0.01 CELO/)).toBeVisible();

    // Invalid custom address.
    await page.getByTestId("policy-custom-address").fill("not-an-address");
    await page.getByTestId("policy-add-address").click();
    await expect(page.getByText(/does not look like a valid address/)).toBeVisible();

    // Still on the policy form: nothing was saved.
    await expect(page.getByTestId("policy-form")).toBeVisible();
  });

  test("6. A valid policy saves and shows a plain-English summary", async () => {
    await page.getByTestId("policy-cap").fill("0.5");
    await page.getByTestId("policy-expiry").fill("24");
    // The demo recipient is pre-listed.
    await expect(page.getByTestId("allow-list")).toContainText("0xaa6A");
    // Add a valid custom address, then remove it again.
    await page
      .getByTestId("policy-custom-address")
      .fill("0x0000000000000000000000000000000000000001");
    await page.getByTestId("policy-add-address").click();
    await expect(page.getByTestId("allow-list")).toContainText("0x0000");
    await page
      .getByRole("button", {
        name: "Remove 0x0000000000000000000000000000000000000001",
      })
      .click();
    await expect(page.getByTestId("allow-list")).not.toContainText("0x0000");

    await page.getByTestId("policy-save").click();
    await expect(page.getByTestId("grant-step")).toBeVisible();
    const summary = await page
      .getByTestId("grant-policy-summary")
      .textContent();
    expect(summary).toContain("0.5 CELO");
    expect(summary).toContain("24");
  });

  test("7. Grant on an unfunded wallet shows the funding error", async () => {
    test.setTimeout(300_000);
    await page.getByTestId("grant-session-button").click();
    await expect(page.getByTestId("error-box")).toBeVisible({
      timeout: 280_000,
    });
    await expect(page.getByTestId("error-box")).toContainText(
      /enough test CELO/i,
    );
    // No session was granted: the grant button is still there.
    await expect(page.getByTestId("grant-session-button")).toBeVisible();
    await expect(page.getByTestId("session-granted-pill")).toHaveCount(0);
  });

  test("8. Dashboard shows no session and a disabled revoke button", async () => {
    await page.getByTestId("step-6").click();
    await expect(page.getByTestId("dashboard")).toBeVisible();
    await expect(page.getByTestId("session-status")).toContainText(
      "No session granted",
    );
    const revoke = page.getByTestId("revoke-button");
    await expect(revoke).toBeVisible();
    await expect(revoke).toBeDisabled();
    await expect(page.getByTestId("history-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-balance")).toContainText("CELO", {
      timeout: 120_000,
    });
  });

  test("9. Reset clears the demo and returns to the landing page", async () => {
    await page.getByTestId("dashboard-reset").click();
    await expect(page.getByTestId("landing-card")).toBeVisible();
    // The stored state is back to empty: no wallet, no keys, no session.
    const stored = await page.evaluate(() =>
      localStorage.getItem("agentkey:v1"),
    );
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
    await expect(page.getByTestId("header-wallet")).toHaveCount(0);
    // Steps are locked again.
    await expect(page.getByTestId("step-6")).toBeDisabled();
  });

  test("10. A second demo wallet can be created after reset", async () => {
    test.setTimeout(300_000);
    await page.getByTestId("start-button").click();
    await page.getByTestId("create-demo-wallet").click();
    await expect(page.getByTestId("fund-step")).toBeVisible({
      timeout: 280_000,
    });
    const address = await page.getByTestId("wallet-address").textContent();
    expect(address).toMatch(/^0x[0-9a-fA-F]{8}\.\.\.[0-9a-fA-F]{8}$/);
  });
});
