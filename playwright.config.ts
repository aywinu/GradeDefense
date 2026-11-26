import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4317',
    trace: 'on-first-retry',
    actionTimeout: 15000, // Increased for WebGL rendering
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview -- --port 4317',
    port: 4317,
    reuseExistingServer: false, // always test a fresh build
    timeout: 180000, // Increased timeout for build
  },
});
