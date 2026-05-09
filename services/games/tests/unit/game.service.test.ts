/// <reference types="bun-types" />
import { describe, it, expect } from 'bun:test';

import { GameService } from '../../src/application/game.service';
import { Round } from '../../src/domain/round';

/** Creates a minimal mock RoundRepository, allowing per-test overrides. */
function makeMockRepo(overrides: Partial<Record<string, any>> = {}) {
    return {
        create: async (r: Round) => r,
        save: async (r: Round) => r,
        findById: async (_id: string) => null,
        findCurrent: async () => null,
        findHistory: async () => ({ rounds: [], total: 0 }),
        findBetsByUser: async () => ({ bets: [], total: 0 }),
        placeBet: async (roundId: string, userId: string, amountCents: bigint, _requestId: string) => ({
            id: 'bet-1',
            roundId,
            userId,
            amountCents,
        }),
        cashout: async (betId: string, multiplier: number, _requestId: string) => ({
            id: betId,
            roundId: 'round-1',
            userId: 'user-1',
            amountCents: 1000n,
            cashoutCents: BigInt(Math.floor(1000 * multiplier)),
            multiplierAtCashout: multiplier.toFixed(2),
            cashedOutAt: new Date(),
        }),
        settleLosers: async () => {},
        onModuleDestroy: async () => {},
        ...overrides,
    } as any;
}

/** Returns a Round at the given status (helper to skip lifecycle noise). */
function roundAtStatus(status: 'PENDING' | 'OPEN' | 'CLOSED') {
    const r = Round.create();
    if (status === 'OPEN' || status === 'CLOSED') r.openBetting();
    if (status === 'CLOSED') r.startRound();
    return r;
}

describe('GameService — getters', () => {
    it('returns null round and 1.0 multiplier on construction', () => {
        const svc = new GameService(makeMockRepo());
        expect(svc.getCurrentRound()).toBeNull();
        expect(svc.getCurrentMultiplier()).toBe(1.0);
    });

    it('setGateway stores the gateway reference', () => {
        const svc = new GameService(makeMockRepo());
        const gw = { broadcast: () => {} };
        svc.setGateway(gw);
        expect((svc as any).gateway).toBe(gw);
    });
});

describe('GameService — placeBet', () => {
    it('throws when there is no active round', async () => {
        const svc = new GameService(makeMockRepo());
        await expect(svc.placeBet('user-1', 500n, 'req-1')).rejects.toThrow('round not in betting phase');
    });

    it('throws when round exists but is PENDING', async () => {
        const svc = new GameService(makeMockRepo());
        (svc as any).currentRound = roundAtStatus('PENDING');
        await expect(svc.placeBet('user-1', 500n, 'req-1')).rejects.toThrow('round not in betting phase');
    });

    it('throws when round is already CLOSED', async () => {
        const svc = new GameService(makeMockRepo());
        (svc as any).currentRound = roundAtStatus('CLOSED');
        await expect(svc.placeBet('user-1', 500n, 'req-1')).rejects.toThrow('round not in betting phase');
    });

    it('delegates to roundRepo.placeBet when round is OPEN', async () => {
        const calls: any[] = [];
        const repo = makeMockRepo({
            placeBet: async (roundId: string, userId: string, amountCents: bigint, requestId: string) => {
                calls.push({ roundId, userId, amountCents, requestId });
                return { id: 'bet-1', roundId, userId, amountCents };
            },
        });

        const svc = new GameService(repo);
        const round = roundAtStatus('OPEN');
        (round as any)._props.id = 'round-99';
        (svc as any).currentRound = round;

        const bet = await svc.placeBet('user-1', 500n, 'req-1');

        expect(calls.length).toBe(1);
        expect(calls[0].roundId).toBe('round-99');
        expect(calls[0].userId).toBe('user-1');
        expect(calls[0].amountCents).toBe(500n);
        expect(bet.amountCents).toBe(500n);
    });

    it('broadcasts bet_placed via gateway after successful bet', async () => {
        const broadcasts: { event: string; payload: any }[] = [];
        const svc = new GameService(makeMockRepo());
        svc.setGateway({ broadcast: (e: string, p: any) => broadcasts.push({ event: e, payload: p }) });

        const round = roundAtStatus('OPEN');
        (round as any)._props.id = 'round-1';
        (svc as any).currentRound = round;

        await svc.placeBet('user-1', 500n, 'req-1');

        expect(broadcasts.length).toBe(1);
        expect(broadcasts[0].event).toBe('bet_placed');
        expect(broadcasts[0].payload.userId).toBe('user-1');
        expect(broadcasts[0].payload.amountCents).toBe('500');
    });

    it('does not broadcast when no gateway is set', async () => {
        const svc = new GameService(makeMockRepo());
        const round = roundAtStatus('OPEN');
        (round as any)._props.id = 'round-1';
        (svc as any).currentRound = round;

        // Should not throw even without a gateway
        const bet = await svc.placeBet('user-1', 100n, 'req-2');
        expect(bet.userId).toBe('user-1');
    });
});

describe('GameService — cashout', () => {
    it('throws when there is no active round', async () => {
        const svc = new GameService(makeMockRepo());
        await expect(svc.cashout('user-1', 'req-1')).rejects.toThrow('round is not running');
    });

    it('throws when round is OPEN (not yet running)', async () => {
        const svc = new GameService(makeMockRepo());
        (svc as any).currentRound = roundAtStatus('OPEN');
        await expect(svc.cashout('user-1', 'req-1')).rejects.toThrow('round is not running');
    });

    it('throws when user has no active bet in the round', async () => {
        // findById returns a round with zero bets
        const repo = makeMockRepo({
            findById: async () => roundAtStatus('CLOSED'),
        });
        const svc = new GameService(repo);
        const round = roundAtStatus('CLOSED');
        (round as any)._props.id = 'round-1';
        (svc as any).currentRound = round;

        await expect(svc.cashout('user-1', 'req-1')).rejects.toThrow('no active bet for user in this round');
    });

    it('calls roundRepo.cashout with the current multiplier', async () => {
        const activeBet = {
            id: 'bet-1', roundId: 'round-1', userId: 'user-1',
            amountCents: 1000n, cashoutCents: null, cashedOutAt: null,
            multiplierAtCashout: null, placedAt: new Date(), settledAt: null,
        };
        const roundWithBet = Round.fromPrisma(
            { id: 'round-1', status: 'CLOSED', serverSeedHash: 'h', provablyFair: { crashPoint: 3.0 } },
            [activeBet],
        );

        const calls: any[] = [];
        const repo = makeMockRepo({
            findById: async () => roundWithBet,
            cashout: async (betId: string, multiplier: number, requestId: string) => {
                calls.push({ betId, multiplier, requestId });
                return {
                    id: betId, roundId: 'round-1', userId: 'user-1',
                    amountCents: 1000n,
                    cashoutCents: BigInt(Math.floor(1000 * multiplier)),
                    multiplierAtCashout: multiplier.toFixed(2),
                    cashedOutAt: new Date(),
                };
            },
        });

        const svc = new GameService(repo);
        const round = roundAtStatus('CLOSED');
        (round as any)._props.id = 'round-1';
        (svc as any).currentRound = round;
        (svc as any).currentMultiplier = 2.5;

        const result = await svc.cashout('user-1', 'req-1');

        expect(calls.length).toBe(1);
        expect(calls[0].betId).toBe('bet-1');
        expect(calls[0].multiplier).toBe(2.5);
        expect(result.multiplierAtCashout).toBe('2.50');
        expect(result.cashoutCents).toBe(2500n);
    });

    it('broadcasts cashout event via gateway on success', async () => {
        const activeBet = {
            id: 'bet-1', roundId: 'round-1', userId: 'user-1',
            amountCents: 1000n, cashoutCents: null, cashedOutAt: null,
            multiplierAtCashout: null, placedAt: new Date(), settledAt: null,
        };
        const roundWithBet = Round.fromPrisma(
            { id: 'round-1', status: 'CLOSED', serverSeedHash: 'h', provablyFair: { crashPoint: 3.0 } },
            [activeBet],
        );

        const repo = makeMockRepo({ findById: async () => roundWithBet });
        const broadcasts: { event: string; payload: any }[] = [];
        const svc = new GameService(repo);
        svc.setGateway({ broadcast: (e: string, p: any) => broadcasts.push({ event: e, payload: p }) });

        const round = roundAtStatus('CLOSED');
        (round as any)._props.id = 'round-1';
        (svc as any).currentRound = round;
        (svc as any).currentMultiplier = 1.8;

        await svc.cashout('user-1', 'req-2');

        expect(broadcasts.length).toBe(1);
        expect(broadcasts[0].event).toBe('cashout');
        expect(broadcasts[0].payload.userId).toBe('user-1');
    });
});
