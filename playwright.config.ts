import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 55_173;
const CONTROL_PORT = 55_174;
const SERVER_PORT = 58_787;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  globalTeardown: "./tests/e2e/global-teardown.ts",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PACKETHALO_DATABASE: "/tmp/packethalo-playwright-55173.db",
      PACKETHALO_PORT: String(SERVER_PORT),
      PACKETHALO_WEB_PORT: String(WEB_PORT),
      PACKETHALO_CONTROL_PORT: String(CONTROL_PORT),
      VITE_PACKET_HALO_SERVER: `ws://127.0.0.1:${SERVER_PORT}/stream`,
      VITE_PACKET_HALO_CONTROL: `ws://127.0.0.1:${SERVER_PORT}/control`,
    },
  },
});
