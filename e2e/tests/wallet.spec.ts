import { test, expect } from '../fixtures';

/**
 * Testes do painel de carteira / saldo.
 * Requer autenticação (usa storageState do setup).
 */

test.describe('Carteira — exibição de saldo', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Aguarda o ciclo OIDC (silent refresh pode levar alguns segundos)
        await page.waitForLoadState('domcontentloaded');
        await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
    });

    test('saldo inicial é maior que zero', async ({ page }) => {
        // O saldo do player de teste começa com R$ 1.000,00
        const saldoEl = page.getByText(/R\$\s*\d+[.,]\d{2}/);
        const texto = await saldoEl.first().textContent();
        expect(texto).toBeTruthy();
        // Extrai número do texto "R$ 1.000,00" → verifica que é > 0
        const valor = parseFloat((texto ?? '0').replace(/[^\d,]/g, '').replace(',', '.'));
        expect(valor).toBeGreaterThan(0);
    });

    test('saldo é exibido no header em formato monetário brasileiro', async ({ page }) => {
        // Usa .first() para evitar strict mode — o saldo do header é o primeiro elemento com R$
        await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/).first()).toBeVisible();
    });
});

test.describe('Carteira — API REST via Kong', () => {
    test('GET /wallets/me retorna 200 com saldo autenticado', async ({ page, request }) => {
        // Garante que estamos na origem correta antes de acessar localStorage
        // (o redirect OIDC pode deixar a page numa URL do Keycloak — cross-origin)
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForURL(/localhost:3000/, { timeout: 15_000 }).catch(() => { });

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


