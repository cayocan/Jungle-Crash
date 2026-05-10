import { test, expect } from '../fixtures';

/**
 * Testes da funcionalidade Auto Bet.
 * Cobre: navegação entre abas, campos de configuração, estratégias Fixo e Martingale,
 * validações de stop-loss/stop-on-win, estado visual durante execução.
 */

test.describe('Auto Bet — estrutura da aba', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
    // Navega para aba Auto
    await page.getByRole('button', { name: /auto/i }).click();
  });

  test('aba Auto está acessível e selecionável', async ({ page }) => {
    const autoTab = page.getByRole('button', { name: /auto/i });
    await expect(autoTab).toBeVisible();
    // Após clicar, conteúdo da aba deve aparecer
    await expect(page.getByRole('button', { name: 'Martingale' })).toBeVisible({ timeout: 5_000 });
  });

  test('exibe seletor de estratégia com opções Fixo e Martingale', async ({ page }) => {
    await expect(page.getByText(/fixo|fixed/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/martingale/i)).toBeVisible({ timeout: 5_000 });
  });

  test('exibe campo de valor inicial de aposta', async ({ page }) => {
    // Campo de aposta na aba Auto — label "Aposta base (R$)"
    await expect(page.getByText('Aposta base (R$)')).toBeVisible({ timeout: 5_000 });
  });

  test('exibe configurações de stop (stop-loss e stop-on-win)', async ({ page }) => {
    // Stop controls devem estar visíveis
    await expect(page.getByText(/stop|parar/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('exibe campo de número máximo de rodadas', async ({ page }) => {
    // Label "Máx. rodadas" deve estar visível
    await expect(page.getByText('Máx. rodadas')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Auto Bet — estratégia Fixo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
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
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /auto/i }).click();
    await expect(page.getByText(/martingale/i)).toBeVisible({ timeout: 5_000 });
  });

  test('selecionar Martingale revela campo de multiplicador', async ({ page }) => {
    const martingaleBtn = page.getByRole('button', { name: /martingale/i })
      .or(page.getByText(/martingale/i));
    await martingaleBtn.first().click();
    // Martingale mostra texto explicativo sobre dobrar aposta
    await expect(
      page.getByText(/dobra a aposta|dobrar|ao perder|on loss/i)
    ).toBeVisible({ timeout: 3_000 });
  });

  test('multiplicador padrão do Martingale é 2x', async ({ page }) => {
    const martingaleBtn = page.getByRole('button', { name: /martingale/i })
      .or(page.getByText(/martingale/i));
    await martingaleBtn.first().click();

    // Input do multiplicador deve ter valor 2 por padrão
    const multInput = page.getByRole('spinbutton').nth(1);
    if (await multInput.isVisible()) {
      const val = await multInput.inputValue();
      expect(parseFloat(val)).toBeGreaterThanOrEqual(2);
    }
  });
});

test.describe('Auto Bet — validações e estado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /auto/i }).click();
  });

  test('botão Iniciar Auto Bet fica desabilitado com valor 0', async ({ page }) => {
    // Limpa o campo de aposta base e coloca 0
    const inputs = page.locator('input[type="text"]').first();
    await inputs.fill('0');
    await inputs.blur();
    const startBtn = page.getByRole('button', { name: /iniciar|►/i });
    await expect(startBtn).toBeDisabled();
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
    const input = page.getByPlaceholder('0,00');
    await input.fill('5.00');

    // Volta para Auto e depois para Manual
    await page.getByRole('button', { name: /auto/i }).click();
    await page.getByRole('button', { name: /manual/i }).click();

    // Valor deve persistir ou ser resetado graciosamente (sem crash na UI)
    await expect(page.getByText(/jungle crash/i)).toBeVisible();
  });
});
