import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // ── 1. Auth setup — roda primeiro e salva cookies ──────────────────────
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },

    // ── 2. Desktop Chrome (autenticado) ────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/player.json' },
      dependencies: ['setup'],
    },

    // ── 3. Mobile Chrome (autenticado) ─────────────────────────────────────
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], storageState: 'playwright/.auth/player.json' },
      dependencies: ['setup'],
    },
  ],
});
