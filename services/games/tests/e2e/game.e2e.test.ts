/**
 * E2E Tests — Games Service
 *
 * Prerequisites:
 *   docker compose up -d (all services healthy)
 *   Wallet for 'player' user must exist with sufficient balance.
 *
 * Run: bun test tests/e2e from services/games
 */
import { describe, it, expect, beforeAll } from 'bun:test';

const GAMES_URL = process.env.E2E_GAMES_URL ?? 'http://localhost:4001';
const WALLETS_URL = process.env.E2E_WALLETS_URL ?? 'http://localhost:4002';
const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8080';
const REALM = 'crash-game';
const CLIENT_ID = 'crash-game-client';

async function getAccessToken(username: string, password: string): Promise<string> {
  const res = await fetch(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username,
      password,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Keycloak token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

let token: string;

beforeAll(async () => {
  token = await getAccessToken('player', 'player123');

  // Ensure wallet exists
  await fetch(`${WALLETS_URL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialBalanceCents: 100000 }),
  });
});

describe('Games E2E — rounds', () => {
  it('GET /rounds/current → returns current round or idle', async () => {
    const res = await fetch(`${GAMES_URL}/rounds/current`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Either has an id (active round) or status=idle
    expect(typeof body).toBe('object');
  });

  it('GET /rounds/history → returns paginated rounds', async () => {
    const res = await fetch(`${GAMES_URL}/rounds/history?page=1&limit=5`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rounds)).toBe(true);
  });

  it('GET /health → 200', async () => {
    const res = await fetch(`${GAMES_URL}/health`);
    expect(res.status).toBe(200);
  });
});

describe('Games E2E — bet validation', () => {
  it('POST /bet → 401 without token', async () => {
    const res = await fetch(`${GAMES_URL}/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents: '1000' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /bet → 400 or 409 with invalid/missing amount', async () => {
    const res = await fetch(`${GAMES_URL}/bet`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // 400 (validation) or 409 (no active round or already bet) are both valid
    expect([400, 409, 422]).toContain(res.status);
  });

  it('GET /bets/me → 200 with array', async () => {
    const res = await fetch(`${GAMES_URL}/bets/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.bets ?? body)).toBe(true);
  });

  it('POST /bet/cashout → 401 without token', async () => {
    const res = await fetch(`${GAMES_URL}/bet/cashout`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });
});
