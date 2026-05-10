import { test, expect } from '@playwright/test';

const GAMES_API = process.env.GAMES_API ?? 'http://localhost:8000/games';
const WALLETS_API = process.env.WALLETS_API ?? 'http://localhost:8000/wallets';

// ─── Games API ─────────────────────────────────────────────────────────────────

test.describe('API — rounds (público)', () => {
  test('GET /games/rounds/current retorna 200 com status', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/current`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(['PENDING', 'OPEN', 'CLOSED', 'SETTLED', 'idle', 'betting', 'running', 'crashed']).toContain(body.status);
  });

  test('GET /games/rounds/current tem serverSeedHash (commitamento)', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/current`);
    const body = await res.json();
    // Antes do crash, serverSeed não deve estar exposta
    if (body.status !== 'idle') {
      expect(body).toHaveProperty('serverSeedHash');
    }
    expect(body.serverSeed).toBeUndefined();
  });

  test('GET /games/rounds/history retorna 200 com data array paginado', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/history?limit=5&page=1`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  test('GET /games/rounds/history respeita parâmetro limit', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/history?limit=2`);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  test('rounds no histórico têm shape correto', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/history?limit=3`);
    const body = await res.json();
    for (const round of body.data as Array<Record<string, unknown>>) {
      expect(round).toHaveProperty('id');
      expect(round).toHaveProperty('status');
      expect(round).toHaveProperty('serverSeedHash');
    }
  });
});

test.describe('API — autenticação (protegida)', () => {
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

  test('GET /games/bets/me retorna 401 sem token', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/bets/me`);
    expect(res.status()).toBe(401);
  });

  test('GET /wallets/me retorna 401 sem token', async ({ request }) => {
    const res = await request.get(`${WALLETS_API}/me`);
    expect(res.status()).toBe(401);
  });
});

test.describe('API — leaderboard', () => {
  test('GET /games/leaderboard retorna 200 com data array', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=10`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('leaderboard 24h não contém ganhos nulos/negativos', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=10`);
    const body = await res.json();
    for (const entry of body.data as Array<{ bestGainCents: string }>) {
      expect(Number(entry.bestGainCents)).toBeGreaterThan(0);
    }
  });

  test('leaderboard 7d não contém ganhos nulos/negativos', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=168&limit=10`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const entry of body.data as Array<{ bestGainCents: string }>) {
      expect(Number(entry.bestGainCents)).toBeGreaterThan(0);
    }
  });

  test('entradas do leaderboard têm shape correto', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=5`);
    const body = await res.json();
    for (const entry of body.data as Array<Record<string, unknown>>) {
      expect(entry).toHaveProperty('userId');
      expect(entry).toHaveProperty('bestGainCents');
      expect(entry).toHaveProperty('bestMultiplier');
    }
  });

  test('leaderboard respeita parâmetro limit', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=3`);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(3);
  });

  test('leaderboard não repete usuário e mantém maior gain por usuário', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/leaderboard?period=24&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const rows = body.data as Array<{ userId: string; bestGainCents: string }>;

    const uniqueUsers = new Set(rows.map((r) => r.userId));
    expect(uniqueUsers.size).toBe(rows.length);

    const gains = rows.map((r) => Number(r.bestGainCents));
    for (let i = 1; i < gains.length; i += 1) {
      expect(gains[i]).toBeLessThanOrEqual(gains[i - 1]);
    }
  });
});

test.describe('API — rate limiting Kong', () => {
  test('responde com cabeçalhos de rate limit', async ({ request }) => {
    const res = await request.get(`${GAMES_API}/rounds/current`);
    // Kong injeta X-RateLimit-* ou RateLimit-* headers
    const headers = res.headers();
    const hasRateLimit = Object.keys(headers).some((h) =>
      h.toLowerCase().includes('ratelimit') || h.toLowerCase().includes('x-ratelimit')
    );
    expect(hasRateLimit).toBe(true);
  });
});
