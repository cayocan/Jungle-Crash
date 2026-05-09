import { test, expect } from '@playwright/test';

const GAMES_API = process.env.GAMES_API ?? 'http://localhost:8000/games';

test.describe('API — contratos públicos', () => {
  test('GET /games/rounds/current retorna 200 com status', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/current`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(['PENDING', 'OPEN', 'CLOSED', 'SETTLED']).toContain(body.status);
  });

  test('GET /games/rounds/history retorna 200 com data array', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/history?limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /games/bet retorna 401 sem token', async ({ request }) => {
    const res = await request.post(`${GAMES_API}/bet`, {
      data: { amountCents: 1000 },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /games/bet/cashout retorna 401 sem token', async ({ request }) => {
    const res = await request.post(`${GAMES_API}/bet/cashout`);
    expect(res.status()).toBe(401);
  });

  test('GET /games/leaderboard retorna 200 com data array', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=10`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    // Garantir que entradas não mostram lucros negativos
    for (const entry of body.data as Array<{ bestProfitCents: string }>) {
      expect(Number(entry.bestProfitCents)).toBeGreaterThan(0);
    }
  });
});
