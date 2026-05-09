/**
 * seed-e2e.ts — Deterministic seed for E2E tests
 *
 * Populates the `games` database with a set of pre-computed SETTLED rounds
 * whose serverSeed and salt are known, so tests can assert exact crashPoints.
 *
 * Usage (from project root):
 *   DATABASE_URL=postgresql://admin:admin@127.0.0.1:5432/games bun scripts/seed-e2e.ts
 *
 * Or via npm script: bun run seed:e2e
 *
 * Pre-computed scenarios (HMAC-SHA256 provably fair):
 *   serverSeed: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" (64 hex chars)
 *   salt variants produce deterministic crashPoints:
 *
 *   | salt       | crashPoint |
 *   |------------|-----------|
 *   | 00000001   | 2.94x      |
 *   | deadbeef   | 12.99x     |
 *   | 12345678   | 1.11x      |
 *   | cafebabe   | 4.74x      |
 *   | aabbccdd   | 2.10x      |
 */

import { createHmac, createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Provably fair (must match services/games/src/domain/round.ts) ────────────

function computeCrashPoint(serverSeed: string, salt: string): number {
  const h = createHmac('sha256', serverSeed).update(salt).digest('hex');
  const n = parseInt(h.slice(0, 13), 16);
  const e = Math.pow(2, 52);
  const raw = (100 * e - n) / (e - n);
  return Math.max(1.0, Math.floor(raw) / 100);
}

function serverSeedHash(serverSeed: string): string {
  return createHmac('sha256', 'public').update(serverSeed).digest('hex');
}

// ─── Deterministic test scenarios ─────────────────────────────────────────────

const SERVER_SEED = 'a'.repeat(64); // known seed for all scenarios

const SCENARIOS: Array<{ label: string; salt: string }> = [
  { label: 'crash-at-2.94x',  salt: '00000001' },
  { label: 'crash-at-12.99x', salt: 'deadbeef' },
  { label: 'crash-at-1.11x',  salt: '12345678' },
  { label: 'crash-at-4.74x',  salt: 'cafebabe' },
  { label: 'crash-at-2.1x',   salt: 'aabbccdd' },
];

async function main() {
  console.log('🌱  Seeding E2E deterministic rounds...\n');

  for (const { label, salt } of SCENARIOS) {
    const crashPoint = computeCrashPoint(SERVER_SEED, salt);
    const seedHash   = serverSeedHash(SERVER_SEED);

    // Upsert: check if a round with this exact provablyFair already exists
    const existing = await prisma.round.findFirst({
      where: {
        provablyFair: {
          path: ['salt'],
          equals: salt,
        },
        status: 'SETTLED',
      },
    });

    if (existing) {
      console.log(`  [SKIP] ${label} (${crashPoint}x) — already seeded (id: ${existing.id})`);
      continue;
    }

    const now = new Date();
    const created = await prisma.round.create({
      data: {
        status: 'SETTLED',
        serverSeed: SERVER_SEED,
        serverSeedHash: seedHash,
        provablyFair: { crashPoint, salt },
        startsAt: new Date(now.getTime() - 30_000),
        endsAt: now,
      },
    });

    console.log(`  [OK]   ${label} → ${crashPoint}x  (id: ${created.id})`);
  }

  console.log('\n✅  Done. Computed crash points:');
  console.log('─'.repeat(50));
  console.log('  Scenario           salt        crashPoint');
  console.log('─'.repeat(50));
  for (const { label, salt } of SCENARIOS) {
    const cp = computeCrashPoint(SERVER_SEED, salt);
    console.log(`  ${label.padEnd(20)} ${salt.padEnd(12)} ${cp}x`);
  }
  console.log('─'.repeat(50));
  console.log(`\n  SERVER_SEED: ${SERVER_SEED.slice(0, 16)}…`);
  console.log(`  SEED_HASH:   ${serverSeedHash(SERVER_SEED).slice(0, 24)}…\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
