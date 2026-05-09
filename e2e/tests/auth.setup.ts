import { test as setup, expect } from '@playwright/test';
import path from 'node:path';

const AUTH_FILE = path.join(__dirname, '../playwright/.auth/player.json');

/**
 * Authenticates via Keycloak OIDC and saves the browser storage state (cookies +
 * localStorage) so other tests can reuse the session without logging in again.
 */
setup('authenticate as player', async ({ page }) => {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';

  // 1. Navigate to the app — should show the login page
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: /jungle crash/i })).toBeVisible();

  // 2. Click the login button → redirect to Keycloak
  await page.getByRole('button', { name: /entrar|login/i }).click();

  // 3. Fill Keycloak login form
  await page.waitForURL(/keycloak|8080/, { timeout: 30_000 });
  await page.fill('#username', 'player');
  await page.fill('#password', 'player123');
  await page.click('#kc-login');

  // 4. Should be redirected back to the app (callback → game page)
  await page.waitForURL(baseURL + '/**', { timeout: 30_000 });
  await expect(page.getByText(/jungle crash/i)).toBeVisible({ timeout: 15_000 });

  // 5. Persist auth state
  await page.context().storageState({ path: AUTH_FILE });
});
