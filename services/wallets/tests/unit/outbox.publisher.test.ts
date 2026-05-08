/// <reference types="bun-types" />

import { OutboxPublisher } from '../../src/messaging/outbox.publisher';

describe('OutboxPublisher', () => {
  it('publica eventos do outbox e marca como published', async () => {
    const published: Array<any> = [];
    const mockRabbit = {
      connect: async () => {},
      publish: async (eventType: string, payload: any) => {
        published.push({ eventType, payload });
      },
    } as any;

    const sampleEvent = {
      id: 'evt-1',
      aggregateId: 'agg-1',
      eventType: 'WalletCredited',
      payload: { requestId: 'r1', amountCents: '100' },
      published: false,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    const updates: Array<any> = [];
    const mockPrisma = {
      outboxEvent: {
        findMany: async () => [sampleEvent],
        update: async ({ where, data }: any) => {
          updates.push({ where, data });
          return { ...sampleEvent, ...data };
        },
      },
    } as any;

    const publisher = new OutboxPublisher(mockRabbit as any, mockPrisma as any);
    // simulate running state so processBatch will execute
    (publisher as any).running = true;
    await publisher.processBatch();

    expect(published.length).toBe(1);
    expect(published[0].eventType).toBe('WalletCredited');
    expect(updates.length).toBe(1);
    expect(updates[0].data.published).toBe(true);
  });
});
