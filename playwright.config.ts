import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 1,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'tauri-web',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  // Vite dev server is managed by the test fixture (helpers.ts)
})
