/**
 * E2E Tests — Wallets Service
 *
 * Prerequisites:
 *   docker compose up -d (all services healthy)
 *
 * Run: bun test tests/e2e from services/wallets
 */
import { describe, it, expect, beforeAll } from 'bun:test';

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
});

describe('Wallets E2E', () => {
  it('GET /me → 404 before wallet is created OR returns wallet', async () => {
    const res = await fetch(`${WALLETS_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status);
  });

  it('POST / → creates wallet with initial balance', async () => {
    // May already exist — idempotent via upsert
    const res = await fetch(`${WALLETS_URL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalanceCents: 100000 }),
    });
    // 201 first time, 409 if already exists — both are acceptable
    expect([201, 409]).toContain(res.status);
  });

  it('GET /me → returns wallet with balance', async () => {
    // Ensure wallet exists first
    await fetch(`${WALLETS_URL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialBalanceCents: 100000 }),
    });

    const res = await fetch(`${WALLETS_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.balanceCents).toBe('number');
    expect(body.balanceCents).toBeGreaterThanOrEqual(0);
    expect(typeof body.currency).toBe('string');
  });

  it('GET /me → 401 without token', async () => {
    const res = await fetch(`${WALLETS_URL}/me`);
    expect(res.status).toBe(401);
  });

  it('POST / → 401 without token', async () => {
    const res = await fetch(`${WALLETS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});
