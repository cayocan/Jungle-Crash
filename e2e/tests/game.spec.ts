import { test, expect } from '@playwright/test';

test.describe('Game Page — estrutura e elementos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('exibe o header com logo e saldo', async ({ page }) => {
    await expect(page.getByText('JUNGLE CRASH')).toBeVisible();
    // Saldo carrega via API — aguarda o valor aparecer
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
  });

  test('exibe o gráfico de crash', async ({ page }) => {
    // O SVG do crash graph deve estar presente
    await expect(page.locator('svg')).toBeVisible();
    // O multiplicador começa em 1.00x ou mostra CRASHED
    await expect(page.getByText(/\d+\.\d+x|crashed/i)).toBeVisible({ timeout: 10_000 });
  });

  test('painel de aposta tem abas Manual e Auto', async ({ page }) => {
    await expect(page.getByRole('button', { name: /manual/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /auto/i })).toBeVisible();
  });

  test('painel de aposta tem input de valor e botão apostar', async ({ page }) => {
    await expect(page.getByPlaceholder(/valor|amount/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /apostar|bet/i })).toBeVisible();
  });

  test('exibe o leaderboard com título "Maiores ganhos"', async ({ page }) => {
    await expect(page.getByText(/maiores ganhos/i)).toBeVisible({ timeout: 10_000 });
  });

  test('exibe o histórico de rodadas', async ({ page }) => {
    await expect(page.getByText(/histórico de rodadas/i)).toBeVisible({ timeout: 10_000 });
  });

  test('username do jogador é exibido no header', async ({ page }) => {
    // Em desktop o username fica visível; pode estar truncado
    await expect(page.getByText('player')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Game Page — fluxo de aposta', () => {
  test('botão Apostar fica habilitado durante fase de apostas', async ({ page }) => {
    await page.goto('/');
    const betButton = page.getByRole('button', { name: /apostar/i });
    // Aguarda até 30s para a fase de apostas iniciar
    await expect(betButton).toBeEnabled({ timeout: 30_000 });
  });

  test('campo de valor aceita entrada numérica', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('10.00');
    await expect(input).toHaveValue('10.00');
  });

  test('aposta com valor inválido não envia', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/valor|amount/i);
    await input.fill('0');
    const betButton = page.getByRole('button', { name: /apostar/i });
    // Com valor 0 o botão permanece desabilitado
    await expect(betButton).toBeDisabled();
  });
});

test.describe('Game Page — aba Auto Bet', () => {
  test('aba Auto mostra campos de estratégia', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /auto/i }).click();
    // Deve mostrar opção de estratégia (Fixo / Martingale)
    await expect(page.getByText(/martingale|fixo/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Game Page — Provably Fair', () => {
  test('botão de verificação está acessível', async ({ page }) => {
    await page.goto('/');
    // O botão "Verificar" ou o ícone de verificação deve estar no histórico
    await expect(page.getByRole('button', { name: /verificar/i })).toBeVisible({ timeout: 10_000 });
  });

  test('modal Provably Fair abre ao clicar em verificar', async ({ page }) => {
    await page.goto('/');
    const verifyBtn = page.getByRole('button', { name: /verificar/i });
    await verifyBtn.waitFor({ timeout: 10_000 });
    await verifyBtn.click();
    // O modal deve aparecer com título sobre verificação
    await expect(page.getByText(/provably fair|verificação/i)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Game Page — Leaderboard', () => {
  test('toggle de período 24h / 7d funciona', async ({ page }) => {
    await page.goto('/');
    const btn7d = page.getByRole('button', { name: '7d' });
    await btn7d.waitFor({ timeout: 10_000 });
    await btn7d.click();
    // Após clicar, botão 7d deve estar ativo (highlighted)
    await expect(btn7d).toHaveCSS('color', /f0f0f0|rgb\(240, 240, 240\)/);
  });
});
