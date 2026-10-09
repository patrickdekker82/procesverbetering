import { defineConfig } from '@playwright/test';

// Browser tests run against the production build in a plain browser (sql.js database, fake AI via
// ?fakeAi=1). In a container with a preinstalled Chromium, set PW_CHROMIUM to its path.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1600, height: 1150 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
