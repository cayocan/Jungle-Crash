/// <reference types="bun-types" />

describe('Event schemas runtime checks', () => {
    it('envelope serialization preserves string cents and timestamp', () => {
        const envelope = {
            eventId: 'evt-1',           
            eventType: 'WalletDebitRequested',
            timestamp: new Date().toISOString(),
            payload: {
                requestId: 'r1',
                userId: 'u1',
                amountCents: '1234'
            }
        } as const;

        const s = JSON.stringify(envelope);
        const parsed = JSON.parse(s);

        expect(parsed.eventType).toBe('WalletDebitRequested');
        expect(typeof parsed.payload.amountCents).toBe('string');
        expect(!isNaN(Date.parse(parsed.timestamp))).toBe(true);
    });

    it('bet events contain required fields', () => {
        const bet = {
            betId: 'b1',
            roundId: 'r1',
            userId: 'u1',
            amountCents: '500',
            placedAt: new Date().toISOString()
        };

        expect(bet.betId).toBe('b1');
        expect(typeof bet.amountCents).toBe('string');
        expect(!isNaN(Date.parse(bet.placedAt))).toBe(true);
    });
});
