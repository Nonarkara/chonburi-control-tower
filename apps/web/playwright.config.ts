import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Chonburi Town Center smoke tests.
 *
 * Spawns its own Vite dev server on a non-default port so a developer running
 * `pnpm dev` in another terminal isn't interrupted. The backend API at :8788
 * is reused if it's running — the smoke tests don't assert specific API data,
 * only that the UI renders, panels mount, and critical controls behave.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,        // single dev server, avoid map-render contention
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:5179",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    video: "off",               // keeps test-results/ small; traces provide all debug info
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: "pnpm dev --port 5179 --strictPort",
    url: "http://localhost:5179",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
