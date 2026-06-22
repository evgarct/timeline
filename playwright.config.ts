import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/ru",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
    { name: "Desktop Chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});

