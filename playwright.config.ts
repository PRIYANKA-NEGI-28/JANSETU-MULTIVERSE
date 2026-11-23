import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @jansetu/api serve',
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: 'pnpm --filter @jansetu/web dev --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
