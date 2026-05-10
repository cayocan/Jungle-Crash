import { test, expect } from '../fixtures';

test.describe('Game Page – estrutura e elementos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
  });

  test('exibe o header com logo e saldo', async ({ page }) => {
    await expect(page.getByText('JUNGLE CRASH')).toBeVisible();
    // Saldo carrega via API — aguarda o valor aparecer
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 15_000 });
  });

  test('exibe o gráfico de crash', async ({ page }) => {
    // O SVG do crash graph tem viewBox específico
    await expect(page.locator('svg[viewBox="0 0 800 300"]')).toBeVisible();
    // O multiplicador começa em 1.00x ou mostra CRASHED
    await expect(page.getByText(/\d+\.\d+x|crashed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('painel de aposta tem abas Manual e Auto', async ({ page }) => {
    await expect(page.getByRole('button', { name: /manual/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /auto/i })).toBeVisible();
  });

  test('painel de aposta tem input de valor e botão apostar', async ({ page }) => {
    await expect(page.getByPlaceholder('0,00')).toBeVisible();
    // O botão muda de texto conforme o estado do jogo (apostas/running/aguardando)
    // Verifica que o botão primário de ação existe — não importa o texto atual
    const actionBtn = page.getByRole('button').filter({ hasText: /apostar|apostado|aguardando/i }).first();
    await expect(actionBtn).toBeVisible();
  });

  test('exibe o leaderboard com título "Maiores ganhos"', async ({ page }) => {
    await expect(page.getByText(/maiores ganhos/i)).toBeVisible({ timeout: 10_000 });
  });

  test('exibe o histórico de rodadas', async ({ page }) => {
    await expect(page.getByText(/histórico de rodadas/i)).toBeVisible({ timeout: 10_000 });
  });

  test('username do jogador é exibido no header', async ({ page }, testInfo) => {
    const username = page.getByText('player', { exact: true });
    if (testInfo.project.name.includes('mobile')) {
      await expect(username).toBeHidden();
      return;
    }
    await expect(username).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Game Page — fluxo de aposta', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
  });

  test('botão Apostar fica habilitado durante fase de apostas', async ({ page }) => {
    const input = page.getByPlaceholder('0,00');
    await input.fill('1.00');
    const betButton = page.getByRole('button', { name: /apostar/i });
    const opened = await betButton.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!opened) test.skip();
    await expect(betButton).toBeEnabled({ timeout: 5_000 });
  });

  test('campo de valor aceita entrada numérica', async ({ page }) => {
    const input = page.getByPlaceholder('0,00');
    await input.fill('10.00');
    await expect(input).toHaveValue('10.00');
  });

  test('aposta com valor inválido não envia', async ({ page }) => {
    const input = page.getByPlaceholder('0,00');
    await input.fill('0');
    const betButton = page.getByRole('button').filter({ hasText: /apostar|apostado|aguardando/i }).first();
    // Com valor 0 o botão permanece desabilitado
    await expect(betButton).toBeDisabled();
  });
});

test.describe('Game Page — aba Auto Bet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
  });

  test('aba Auto mostra campos de estratégia', async ({ page }) => {
    await page.getByRole('button', { name: /auto/i }).click();
    // Deve mostrar opção de estratégia (Fixo / Martingale)
    await expect(page.getByRole('button', { name: 'Martingale' })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Game Page — Provably Fair', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
  });

  test('botão de verificação está acessível', async ({ page }) => {
    // O botão "Verificar" ou o ícone de verificação deve estar no histórico
    await expect(page.getByRole('button', { name: /verificar/i })).toBeVisible({ timeout: 10_000 });
  });

  test('modal Provably Fair abre ao clicar em verificar', async ({ page }) => {
    const verifyBtn = page.getByRole('button', { name: /verificar/i });
    await verifyBtn.waitFor({ timeout: 10_000 });
    await verifyBtn.click();
    // O modal deve aparecer com título sobre verificação
    await expect(page.getByRole('heading', { name: /provably fair/i })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Game Page — Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/R\$\s*\d+[.,]\d{2}/)).toBeVisible({ timeout: 30_000 });
  });

  test('toggle de período 24h / 7d funciona', async ({ page }) => {
    const btn7d = page.getByRole('button', { name: '7d' });
    await btn7d.waitFor({ timeout: 10_000 });
    await btn7d.click();
    // Após clicar, botão 7d deve estar ativo (highlighted)
    await expect(btn7d).toHaveCSS('color', /f0f0f0|rgb\(240, 240, 240\)/);
  });
});




