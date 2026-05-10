/// <reference types="bun-types" />
import { describe, it, expect } from 'bun:test';

import { Round } from '../../src/domain/round';

describe('Round — computeCrashPoint', () => {
    it('is deterministic for the same inputs', () => {
        const seed = 'abc123deadbeef';
        const salt = 'cafebabe';
        expect(Round.computeCrashPoint(seed, salt)).toBe(Round.computeCrashPoint(seed, salt));
    });

    it('always returns at least 1.0', () => {
        for (let i = 0; i < 30; i++) {
            const result = Round.computeCrashPoint(`seed-${i}`, `salt-${i}`);
            expect(result).toBeGreaterThanOrEqual(1.0);
        }
    });

    it('produces different values for different inputs', () => {
        const results = new Set<number>();
        for (let i = 0; i < 15; i++) {
            results.add(Round.computeCrashPoint(`seed-${i}`, `salt-${i}`));
        }
        expect(results.size).toBeGreaterThan(1);
    });
});

describe('Round — create()', () => {
    it('creates a round with PENDING status', () => {
        const round = Round.create();
        expect(round.status).toBe('PENDING');
    });

    it('generates a non-empty serverSeed and serverSeedHash', () => {
        const round = Round.create();
        expect(round.serverSeed).toBeTruthy();
        expect(round.serverSeedHash).toBeTruthy();
    });

    it('serverSeed and serverSeedHash are different strings', () => {
        const round = Round.create();
        expect(round.serverSeed).not.toBe(round.serverSeedHash);
    });

    it('computes a crashPoint >= 1.0', () => {
        for (let i = 0; i < 10; i++) {
            expect(Round.create().crashPoint).toBeGreaterThanOrEqual(1.0);
        }
    });

    it('generates unique seeds on each call', () => {
        const r1 = Round.create();
        const r2 = Round.create();
        expect(r1.serverSeed).not.toBe(r2.serverSeed);
    });
});

describe('Round — state transitions', () => {
    it('transitions PENDING → OPEN on openBetting and records startsAt', () => {
        const round = Round.create();
        round.openBetting();
        expect(round.status).toBe('OPEN');
        expect(round.startsAt).toBeInstanceOf(Date);
    });

    it('throws when calling openBetting from non-PENDING state', () => {
        const round = Round.create();
        round.openBetting();
        expect(() => round.openBetting()).toThrow('Round must be PENDING to open betting');
    });

    it('transitions OPEN → CLOSED on startRound', () => {
        const round = Round.create();
        round.openBetting();
        round.startRound();
        expect(round.status).toBe('CLOSED');
    });

    it('throws when calling startRound from non-OPEN state', () => {
        const round = Round.create();
        expect(() => round.startRound()).toThrow('Round must be OPEN to start');
    });

    it('transitions CLOSED → SETTLED on settle and records endsAt', () => {
        const round = Round.create();
        round.openBetting();
        round.startRound();
        round.settle();
        expect(round.status).toBe('SETTLED');
        expect(round.endsAt).toBeInstanceOf(Date);
    });

    it('throws when calling settle from non-CLOSED state', () => {
        const round = Round.create();
        expect(() => round.settle()).toThrow('Round must be CLOSED to settle');
    });

    it('throws when calling settle from OPEN state', () => {
        const round = Round.create();
        round.openBetting();
        expect(() => round.settle()).toThrow('Round must be CLOSED to settle');
    });
});

describe('Round — toPrisma / fromPrisma', () => {
    it('round-trips status and serverSeedHash correctly', () => {
        const original = Round.create();
        const prismaRow = { ...original.toPrisma(), id: 'r-1', createdAt: new Date(), updatedAt: new Date() };
        const restored = Round.fromPrisma(prismaRow);
        expect(restored.status).toBe('PENDING');
        expect(restored.serverSeedHash).toBe(original.serverSeedHash);
    });

    it('preserves crashPoint through serialization', () => {
        const original = Round.create();
        const prismaRow = { ...original.toPrisma(), id: 'r-1' };
        const restored = Round.fromPrisma(prismaRow);
        expect(restored.crashPoint).toBe(original.crashPoint);
    });

    it('hydrates bets when provided', () => {
        const bet = {
            id: 'bet-1',
            roundId: 'r-1',
            userId: 'user-1',
            amountCents: 500n,
            cashoutCents: null,
            multiplierAtCashout: null,
            placedAt: new Date(),
            cashedOutAt: null,
            settledAt: null,
        };
        const round = Round.fromPrisma(
            { id: 'r-1', status: 'OPEN', serverSeedHash: 'hash', provablyFair: { crashPoint: 2.5 } },
            [bet],
        );
        expect(round.bets).toHaveLength(1);
        expect(round.bets[0].userId).toBe('user-1');
        expect(round.bets[0].amountCents).toBe(500n);
    });

    it('converts numeric amountCents string from DB to bigint', () => {
        const bet = {
            id: 'bet-2',
            roundId: 'r-1',
            userId: 'user-2',
            amountCents: '1000', // string as it might come from JSON
            cashoutCents: null,
            placedAt: new Date(),
            cashedOutAt: null,
            settledAt: null,
        };
        const round = Round.fromPrisma(
            { id: 'r-1', status: 'OPEN', serverSeedHash: 'hash', provablyFair: { crashPoint: 1.5 } },
            [bet],
        );
        expect(typeof round.bets[0].amountCents).toBe('bigint');
        expect(round.bets[0].amountCents).toBe(1000n);
    });
});
