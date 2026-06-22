import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev -- -p 3100",
    url: "http://127.0.0.1:3100/ru",
    reuseExistingServer: false,
    env: {
      E2E_DEMO_MODE: "true"
    }
  },
  projects: [
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
    { name: "Desktop Chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
