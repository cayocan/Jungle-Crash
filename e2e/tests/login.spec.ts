import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } }); // runs WITHOUT stored auth

test.describe('Login Page — unauthenticated', () => {
  test('mostra logo e botão de entrar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('JUNGLE CRASH')).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|login/i })).toBeVisible();
  });

  test('redireciona para Keycloak ao clicar em entrar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /entrar|login/i }).click();
    await page.waitForURL(/8080|keycloak/, { timeout: 20_000 });
    // Página de login do Keycloak deve estar visível
    await expect(page.locator('#username')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#password')).toBeVisible();
  });

  test('não acessa a página do jogo sem autenticação', async ({ page }) => {
    // Tentar acessar diretamente — deve cair na login page
    await page.goto('/');
    await expect(page.getByRole('button', { name: /entrar|login/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/jungle crash/i)).toBeVisible();
    // Não deve mostrar o gráfico de crash (exclusivo da página autenticada)
    await expect(page.locator('svg')).not.toBeVisible({ timeout: 2_000 });
  });
});
