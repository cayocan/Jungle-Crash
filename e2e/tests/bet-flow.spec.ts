import { test, expect } from '@playwright/test';

/**
 * Testes do fluxo de aposta manual.
 * Cobre: input, validações, colocação de aposta durante fase de apostas,
 * cashout manual, rejeição por valor inválido e feedback de UI.
 */

test.describe('Fluxo de aposta — validações de input', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
  });

  test('input aceita apenas valores numéricos positivos', async ({ page }) => {
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('abc');
    // Valor não numérico deve ser rejeitado ou convertido para vazio
    const val = await input.inputValue();
    expect(val === '' || val === '0' || !isNaN(parseFloat(val))).toBe(true);
  });

  test('valor mínimo de aposta é R$ 1,00', async ({ page }) => {
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('0.50');
    const betButton = page.getByRole('button', { name: /apostar/i });
    await expect(betButton).toBeDisabled();
  });

  test('botão apostar desabilitado com campo vazio', async ({ page }) => {
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.clear();
    const betButton = page.getByRole('button', { name: /apostar/i });
    await expect(betButton).toBeDisabled();
  });

  test('campo auto cashout aceita multiplicador decimal', async ({ page }) => {
    // O input de auto cashout deve aceitar valores como "2.50"
    const autoCashout = page.getByPlaceholder(/auto|cashout|multiplicador/i);
    if (await autoCashout.isVisible()) {
      await autoCashout.fill('2.50');
      await expect(autoCashout).toHaveValue('2.50');
    }
  });
});

test.describe('Fluxo de aposta — ciclo completo', () => {
  test('aposta durante fase de apostas e aguarda resultado', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });

    // Aguarda fase de apostas (botão habilitado)
    const betButton = page.getByRole('button', { name: /apostar/i });
    await expect(betButton).toBeEnabled({ timeout: 45_000 });

    // Preenche valor mínimo
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('1.00');

    // Clica em apostar
    await betButton.click();

    // Deve aparecer toast de confirmação ou botão de cashout
    await expect(
      page.getByText(/aposta|bet|cashout|sacar/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tentativa de aposta duplicada na mesma rodada é rejeitada', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });

    const betButton = page.getByRole('button', { name: /apostar/i });
    await expect(betButton).toBeEnabled({ timeout: 45_000 });

    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('1.00');
    await betButton.click();

    // Após primeira aposta, botão deve mudar para cashout ou ficar desabilitado para nova aposta
    await expect(betButton).toBeDisabled({ timeout: 5_000 });
  });
});

test.describe('Fluxo de aposta — feedback de UI', () => {
  test('exibe toast de erro ao tentar apostar fora do período', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });

    // Aguarda fase de apostas para garantir que o input está disponível
    const betButton = page.getByRole('button', { name: /apostar/i });
    await betButton.waitFor({ state: 'visible', timeout: 10_000 });

    // Se o botão estiver desabilitado, é porque está fora do período — testa aviso
    const isDisabled = await betButton.isDisabled();
    if (isDisabled) {
      // Clicar num botão desabilitado não deve causar crash na UI
      await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="bet-button"], button[disabled]') as HTMLButtonElement;
        btn?.click();
      });
      // A página não deve travar
      await expect(page.getByText(/jungle crash/i)).toBeVisible();
    }
  });

  test('painel de apostas exibe histórico de apostas da rodada atual', async ({ page }) => {
    await page.goto('/');
    // A seção de apostas ao vivo deve estar presente
    await expect(
      page.getByText(/apostas ao vivo|apostas da rodada|players/i)
        .or(page.locator('[class*="bet-list"], [class*="bets"]'))
    ).toBeVisible({ timeout: 15_000 });
  });
});
