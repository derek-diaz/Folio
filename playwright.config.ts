import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:1420', viewport: { width: 1100, height: 780 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } } ],
  // Test the shipped modules; Vite's first dependency optimization can reload a
  // development page and discard open tabs while a renderer is being imported.
  webServer: { command: 'npm run build && npm run preview -- --port 1420', url: 'http://127.0.0.1:1420', reuseExistingServer: false },
});
