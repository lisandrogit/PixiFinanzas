import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:8788',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  webServer: {
    command: 'npm run worker:dev',
    url: 'http://localhost:8788',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
