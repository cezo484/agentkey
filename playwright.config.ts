import { defineConfig } from "@playwright/test";

// AgentKey smoke tests run against the production build served by
// `vite preview`, so they test exactly what gets deployed.
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",
  timeout: 300_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The sandboxed browser cannot tunnel through the VM egress proxy on its
    // own, so tests go through the local forward proxy started by
    // global-setup (test-only; real browsers connect directly).
    proxy: {
      server: "http://127.0.0.1:18080",
      bypass: "localhost,127.0.0.1",
    },
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
