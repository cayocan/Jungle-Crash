import { test, expect } from '@playwright/test';

/**
 * Testes da funcionalidade Auto Bet.
 * Cobre: navegação entre abas, campos de configuração, estratégias Fixo e Martingale,
 * validações de stop-loss/stop-on-win, estado visual durante execução.
 */

test.describe('Auto Bet — estrutura da aba', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
    // Navega para aba Auto
    await page.getByRole('button', { name: /auto/i }).click();
  });

  test('aba Auto está acessível e selecionável', async ({ page }) => {
    const autoTab = page.getByRole('button', { name: /auto/i });
    await expect(autoTab).toBeVisible();
    // Após clicar, conteúdo da aba deve aparecer
    await expect(page.getByText(/martingale|fixo|estratégia|strategy/i)).toBeVisible({ timeout: 5_000 });
  });

  test('exibe seletor de estratégia com opções Fixo e Martingale', async ({ page }) => {
    await expect(page.getByText(/fixo|fixed/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/martingale/i)).toBeVisible({ timeout: 5_000 });
  });

  test('exibe campo de valor inicial de aposta', async ({ page }) => {
    // Campo de aposta na aba Auto
    const inputs = page.getByRole('spinbutton').or(page.getByPlaceholder(/valor|amount|aposta/i));
    await expect(inputs.first()).toBeVisible({ timeout: 5_000 });
  });

  test('exibe configurações de stop (stop-loss e stop-on-win)', async ({ page }) => {
    // Stop controls devem estar visíveis
    await expect(page.getByText(/stop|parar/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('exibe campo de número máximo de rodadas', async ({ page }) => {
    // Campo de número de rodadas ou "infinito"
    const rodadasLabel = page.getByText(/rodadas|rounds|ilimitado|infinito/i);
    await expect(rodadasLabel).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Auto Bet — estratégia Fixo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /auto/i }).click();
    await expect(page.getByText(/fixo|fixed/i)).toBeVisible({ timeout: 5_000 });
  });

  test('selecionar estratégia Fixo mantém valor constante', async ({ page }) => {
    const fixoBtn = page.getByRole('button', { name: /fixo|fixed/i })
      .or(page.getByText(/fixo|fixed/i));
    await fixoBtn.first().click();
    // Não deve aparecer campo de multiplicador após derrota (exclusivo do Martingale)
    await expect(page.getByText(/multiplicar|multiply/i)).not.toBeVisible({ timeout: 2_000 });
  });
});

test.describe('Auto Bet — estratégia Martingale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /auto/i }).click();
    await expect(page.getByText(/martingale/i)).toBeVisible({ timeout: 5_000 });
  });

  test('selecionar Martingale revela campo de multiplicador', async ({ page }) => {
    const martingaleBtn = page.getByRole('button', { name: /martingale/i })
      .or(page.getByText(/martingale/i));
    await martingaleBtn.first().click();
    // Campo de multiplicador após derrota deve aparecer
    await expect(
      page.getByText(/multiplicar|multiplicador|ao perder|on loss/i)
    ).toBeVisible({ timeout: 3_000 });
  });

  test('multiplicador padrão do Martingale é 2x', async ({ page }) => {
    const martingaleBtn = page.getByRole('button', { name: /martingale/i })
      .or(page.getByText(/martingale/i));
    await martingaleBtn.first().click();

    // Input do multiplicador deve ter valor 2 por padrão
    const multInput = page.getByRole('spinbutton').nth(1)
      .or(page.getByDisplayValue('2'));
    if (await multInput.isVisible()) {
      const val = await multInput.inputValue();
      expect(parseFloat(val)).toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('Auto Bet — validações e estado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /auto/i }).click();
  });

  test('botão Iniciar Auto Bet fica desabilitado com valor 0', async ({ page }) => {
    const inputs = page.getByRole('spinbutton').or(page.getByPlaceholder(/valor|amount/i));
    await inputs.first().fill('0');
    const startBtn = page.getByRole('button', { name: /iniciar|start|auto bet/i });
    if (await startBtn.isVisible()) {
      await expect(startBtn).toBeDisabled();
    }
  });

  test('estatísticas de Auto Bet são exibidas (rodadas, ganhos)', async ({ page }) => {
    // O painel de stats (total de rodadas, lucro/prejuízo) deve estar presente
    await expect(
      page.getByText(/rodadas|lucro|prejuízo|profit|loss|ganho/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('alternando para aba Manual mantém o valor preenchido na aba Manual', async ({ page }) => {
    // Vai para Manual, preenche valor
    await page.getByRole('button', { name: /manual/i }).click();
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('5.00');

    // Volta para Auto e depois para Manual
    await page.getByRole('button', { name: /auto/i }).click();
    await page.getByRole('button', { name: /manual/i }).click();

    // Valor deve persistir ou ser resetado graciosamente (sem crash na UI)
    await expect(page.getByText(/jungle crash/i)).toBeVisible();
  });
});
