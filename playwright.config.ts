import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
const port = 4173
const baseURL = `http://localhost:${String(port)}`

// https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Test against the production build rather than the dev server.
  webServer: {
    command: `pnpm build && pnpm preview --port ${String(port)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !isCI,
  },
})
