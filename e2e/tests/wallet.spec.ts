import { test, expect } from '@playwright/test';

/**
 * Testes do painel de carteira / saldo.
 * Requer autenticação (usa storageState do setup).
 */

test.describe('Carteira — exibição de saldo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Aguarda a página carregar completamente
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
  });

  test('saldo inicial é maior que zero', async ({ page }) => {
    // O saldo do player de teste começa com R$ 1.000,00
    const saldoEl = page.getByText(/R\$\s*\d/);
    const texto = await saldoEl.first().textContent();
    expect(texto).toBeTruthy();
    // Extrai número do texto "R$ 1.000,00" → verifica que é > 0
    const valor = parseFloat((texto ?? '0').replace(/[^\d,]/g, '').replace(',', '.'));
    expect(valor).toBeGreaterThan(0);
  });

  test('saldo é exibido no header em formato monetário brasileiro', async ({ page }) => {
    // Deve seguir o padrão "R$ X.XXX,XX"
    await expect(page.getByText(/R\$\s*[\d.,]+/)).toBeVisible();
  });
});

test.describe('Carteira — API REST via Kong', () => {
  test('GET /wallets/me retorna 200 com saldo autenticado', async ({ page, request }) => {
    // Captura o token de autenticação do localStorage
    const token = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        const value = localStorage.getItem(key) ?? '';
        // Tokens OIDC ficam em chaves como oidc.user:...
        if (key.includes('oidc') && value.includes('access_token')) {
          try {
            return JSON.parse(value).access_token as string;
          } catch {
            return null;
          }
        }
      }
      return null;
    });

    if (!token) {
      test.skip(true, 'Token não encontrado no localStorage — verifique o authProvider');
    }

    const res = await request.get('http://localhost:8000/wallets/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('balanceCents');
    expect(Number(body.balanceCents)).toBeGreaterThanOrEqual(0);
  });

  test('GET /wallets/me retorna 401 sem token', async ({ request }) => {
    const res = await request.get('http://localhost:8000/wallets/me');
    expect(res.status()).toBe(401);
  });
});
