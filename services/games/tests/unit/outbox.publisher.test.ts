/// <reference types="bun-types" />
import { describe, it, expect } from 'bun:test';

import { OutboxPublisher } from '../../src/messaging/outbox.publisher';

function makeEvent(overrides: Partial<Record<string, any>> = {}) {
    return {
        id: 'evt-1',
        aggregateId: 'agg-1',
        eventType: 'WalletDebitRequested',
        payload: { requestId: 'r1', userId: 'u1', amountCents: '500' },
        published: false,
        attempts: 0,
        createdAt: new Date(),
        ...overrides,
    };
}

function makePrisma(events: any[], updates: any[] = []) {
    return {
        outboxEvent: {
            findMany: async () => events,
            update: async ({ where, data }: any) => {
                updates.push({ where, data });
                return { ...events[0], ...data };
            },
        },
    } as any;
}

describe('OutboxPublisher — processBatch', () => {
    it('publishes events and marks them as published', async () => {
        const published: any[] = [];
        const updates: any[] = [];
        const rabbit = { publish: async (type: string, payload: any) => published.push({ type, payload }) } as any;
        const prisma = makePrisma([makeEvent()], updates);

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = true;
        await pub.processBatch();

        expect(published.length).toBe(1);
        expect(published[0].type).toBe('WalletDebitRequested');
        expect(updates.length).toBe(1);
        expect(updates[0].data.published).toBe(true);
        expect(updates[0].data.attempts).toBe(1);
    });

    it('records publishedAt timestamp on success', async () => {
        const updates: any[] = [];
        const rabbit = { publish: async () => {} } as any;
        const prisma = makePrisma([makeEvent()], updates);

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = true;
        await pub.processBatch();

        expect(updates[0].data.publishedAt).toBeInstanceOf(Date);
    });

    it('increments attempts and records lastError on publish failure', async () => {
        const updates: any[] = [];
        const rabbit = { publish: async () => { throw new Error('connection refused'); } } as any;
        const prisma = makePrisma([makeEvent({ attempts: 2 })], updates);

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = true;
        await pub.processBatch();

        expect(updates.length).toBe(1);
        expect(updates[0].data.published).toBeUndefined();
        expect(updates[0].data.attempts).toBe(3);
        expect(updates[0].data.lastError).toContain('connection refused');
    });

    it('skips all processing when running flag is false', async () => {
        const calls: string[] = [];
        const rabbit = { publish: async () => {} } as any;
        const prisma = {
            outboxEvent: {
                findMany: async () => { calls.push('findMany'); return []; },
                update: async () => ({}),
            },
        } as any;

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = false;
        await pub.processBatch();

        expect(calls.length).toBe(0);
    });

    it('processes multiple events in a single batch', async () => {
        const published: string[] = [];
        const rabbit = { publish: async (type: string) => published.push(type) } as any;
        const events = [
            makeEvent({ id: 'e1', eventType: 'WalletDebitRequested' }),
            makeEvent({ id: 'e2', eventType: 'WalletCreditRequested' }),
        ];
        const updates: any[] = [];
        const prisma = {
            outboxEvent: {
                findMany: async () => events,
                update: async ({ where, data }: any) => { updates.push({ where, data }); return {}; },
            },
        } as any;

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = true;
        await pub.processBatch();

        expect(published).toEqual(['WalletDebitRequested', 'WalletCreditRequested']);
        expect(updates.length).toBe(2);
        expect(updates.every((u: any) => u.data.published === true)).toBe(true);
    });

    it('continues processing remaining events when one fails', async () => {
        const published: string[] = [];
        let callCount = 0;
        const rabbit = {
            publish: async (type: string) => {
                callCount++;
                if (callCount === 1) throw new Error('transient error');
                published.push(type);
            },
        } as any;
        const events = [
            makeEvent({ id: 'e1', eventType: 'WalletDebitRequested' }),
            makeEvent({ id: 'e2', eventType: 'WalletCreditRequested' }),
        ];
        const prisma = {
            outboxEvent: {
                findMany: async () => events,
                update: async () => ({}),
            },
        } as any;

        const pub = new OutboxPublisher(rabbit, prisma);
        (pub as any).running = true;
        await pub.processBatch();

        // Second event must still be published despite first failing
        expect(published).toEqual(['WalletCreditRequested']);
    });
});
