/// <reference types="bun-types" />
import { describe, it, expect } from 'bun:test';

import { WalletEventConsumer } from '../../src/messaging/consumer.service';

function makeConsumer() {
    // RabbitService is only used in onModuleInit (not called in unit tests)
    const mockRabbit = { consume: async () => {} } as any;
    return new WalletEventConsumer(mockRabbit);
}

describe('WalletEventConsumer — handleEvent', () => {
    it('broadcasts balance_updated with type=debit for WalletDebited', async () => {
        const broadcasts: { event: string; payload: any }[] = [];
        const consumer = makeConsumer();
        consumer.setGateway({ broadcast: (e: string, p: any) => broadcasts.push({ event: e, payload: p }) });

        await (consumer as any).handleEvent('WalletDebited', { userId: 'u1', amountCents: '500' });

        expect(broadcasts.length).toBe(1);
        expect(broadcasts[0].event).toBe('balance_updated');
        expect(broadcasts[0].payload.userId).toBe('u1');
        expect(broadcasts[0].payload.amountCents).toBe('500');
        expect(broadcasts[0].payload.type).toBe('debit');
    });

    it('broadcasts balance_updated with type=credit for WalletCredited', async () => {
        const broadcasts: { event: string; payload: any }[] = [];
        const consumer = makeConsumer();
        consumer.setGateway({ broadcast: (e: string, p: any) => broadcasts.push({ event: e, payload: p }) });

        await (consumer as any).handleEvent('WalletCredited', { userId: 'u2', amountCents: '1000' });

        expect(broadcasts.length).toBe(1);
        expect(broadcasts[0].event).toBe('balance_updated');
        expect(broadcasts[0].payload.type).toBe('credit');
        expect(broadcasts[0].payload.amountCents).toBe('1000');
    });

    it('does nothing for unknown event types', async () => {
        const broadcasts: any[] = [];
        const consumer = makeConsumer();
        consumer.setGateway({ broadcast: (e: string, p: any) => broadcasts.push({ e, p }) });

        await (consumer as any).handleEvent('UnknownEventType', { userId: 'u3' });

        expect(broadcasts.length).toBe(0);
    });

    it('does not crash when no gateway is set (optional chaining)', async () => {
        const consumer = makeConsumer();
        // No setGateway call — gateway is undefined
        const result = await (consumer as any).handleEvent('WalletDebited', { userId: 'u1', amountCents: '100' });
        expect(result).toBeUndefined();
    });
});

describe('WalletEventConsumer — setGateway', () => {
    it('stores the gateway reference for later use', () => {
        const consumer = makeConsumer();
        const gw = { broadcast: () => {} };
        consumer.setGateway(gw);
        expect((consumer as any).gateway).toBe(gw);
    });

    it('replaces an existing gateway reference', () => {
        const consumer = makeConsumer();
        const gw1 = { broadcast: () => {} };
        const gw2 = { broadcast: () => {} };
        consumer.setGateway(gw1);
        consumer.setGateway(gw2);
        expect((consumer as any).gateway).toBe(gw2);
    });
});
