import { test, expect } from '@playwright/test';

const GAMES_API = process.env.GAMES_API ?? 'http://localhost:8000/games';

/**
 * Testes do sistema Provably Fair.
 * Cobre: modal na UI, endpoint de verificação, hash chain, campos revelados após crash.
 */

test.describe('Provably Fair — modal e UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/R\$\s*\d/)).toBeVisible({ timeout: 15_000 });
  });

  test('modal abre com título de verificação', async ({ page }) => {
    // O botão de verificação pode estar no histórico de rodadas
    const verifyBtn = page.getByRole('button', { name: /verificar|provably|fair/i }).first();
    await verifyBtn.waitFor({ timeout: 15_000 });
    await verifyBtn.click();

    await expect(page.getByText(/provably fair/i)).toBeVisible({ timeout: 5_000 });
  });

  test('modal exibe server seed hash da rodada', async ({ page }) => {
    const verifyBtn = page.getByRole('button', { name: /verificar|provably|fair/i }).first();
    await verifyBtn.waitFor({ timeout: 15_000 });
    await verifyBtn.click();

    // O hash SHA-256 é uma string hex de 64 caracteres
    await expect(page.getByText(/[0-9a-f]{64}/i)).toBeVisible({ timeout: 5_000 });
  });

  test('modal exibe crash point da rodada', async ({ page }) => {
    const verifyBtn = page.getByRole('button', { name: /verificar|provably|fair/i }).first();
    await verifyBtn.waitFor({ timeout: 15_000 });
    await verifyBtn.click();

    // Deve mostrar o crash point no formato "X.XXx"
    await expect(page.getByText(/\d+\.\d+x/i)).toBeVisible({ timeout: 5_000 });
  });

  test('modal pode ser fechado', async ({ page }) => {
    const verifyBtn = page.getByRole('button', { name: /verificar|provably|fair/i }).first();
    await verifyBtn.waitFor({ timeout: 15_000 });
    await verifyBtn.click();

    await expect(page.getByText(/provably fair/i)).toBeVisible({ timeout: 5_000 });

    // Fecha pressionando Escape ou clicando no botão fechar
    await page.keyboard.press('Escape');
    await expect(page.getByText(/provably fair/i)).not.toBeVisible({ timeout: 3_000 });
  });

  test('botão ƒ(t) exibe fórmula da curva', async ({ page }) => {
    // O botão de fórmula fica sobre o gráfico
    const formulaBtn = page.getByRole('button', { name: /ƒ|formula|f\(t\)/i });
    if (await formulaBtn.isVisible()) {
      await formulaBtn.click();
      // Tooltip com fórmula exponencial
      await expect(page.getByText(/e\^|exp|0\.00006/i)).toBeVisible({ timeout: 3_000 });
    }
  });
});

test.describe('Provably Fair — API de verificação', () => {
  test('GET /rounds/history retorna serverSeedHash em rounds settled', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/history?limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const rounds = body.data as Array<{
      status: string;
      serverSeedHash: string | null;
      serverSeed: string | null;
    }>;

    // Rounds settled devem ter serverSeedHash
    const settled = rounds.filter((r) => r.status === 'SETTLED');
    for (const r of settled) {
      expect(r.serverSeedHash).toBeTruthy();
      // A seed é revelada apenas após settle
      expect(r.serverSeed).toBeTruthy();
    }
  });

  test('GET /rounds/:id/verify retorna dados de verificação', async ({ request }) => {
    // Busca rounds no histórico para pegar um ID real
    const histRes = await request.get(`${GAMES_API}/rounds/history?limit=1`);
    expect(histRes.status()).toBe(200);
    const hist = await histRes.json();
    const rounds = hist.data as Array<{ id: string; status: string }>;
    const settled = rounds.find((r) => r.status === 'SETTLED');

    if (!settled) {
      test.skip(true, 'Nenhum round SETTLED no histórico — rode seed:e2e primeiro');
    }

    const res = await request.get(`${GAMES_API}/rounds/${settled!.id}/verify`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('serverSeed');
    expect(body).toHaveProperty('serverSeedHash');
    expect(body).toHaveProperty('crashPoint');
    // Crash point deve ser >= 1.00
    expect(Number(body.crashPoint)).toBeGreaterThanOrEqual(1.0);
  });

  test('hash chain: SHA256(serverSeed) == serverSeedHash', async ({ request }) => {
    const histRes = await request.get(`${GAMES_API}/rounds/history?limit=5`);
    const hist = await histRes.json();
    const rounds = hist.data as Array<{
      id: string;
      status: string;
      serverSeed: string | null;
      serverSeedHash: string | null;
    }>;
    const settled = rounds.find((r) => r.status === 'SETTLED' && r.serverSeed);

    if (!settled) {
      test.skip(true, 'Nenhum round SETTLED com seed revelada');
    }

    // Usa SubtleCrypto via node crypto para verificar
    const { createHash } = await import('node:crypto');
    const computed = createHash('sha256')
      .update(`public${settled!.serverSeed}`)
      .digest('hex');

    expect(computed).toBe(settled!.serverSeedHash);
  });
});
