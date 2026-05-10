/// <reference types="bun-types" />
import { describe, it, expect } from 'bun:test';

import { WalletConsumer } from '../../src/messaging/consumer.service';

describe('WalletConsumer.handleEvent', () => {
  it('processa WalletDebitRequested corretamente', async () => {
    const calls: any[] = [];
    const mockRepo = {
      debitWithProcessedRequest: async (requestId: string, userId: string, amount: bigint) => {
        calls.push({ method: 'debit', requestId, userId, amount });
        return { alreadyProcessed: false, wallet: { id: 'w1', userId, balance: 1000n, currency: 'BRL' } };
      },
      creditWithProcessedRequest: async () => { throw new Error('not expected'); }
    } as any;

    const consumer = new WalletConsumer(mockRepo as any, null);
    const payload = { requestId: 'r1', userId: 'u1', amountCents: '250' };
    const res = await consumer.handleEvent('WalletDebitRequested', payload);

    expect(res.handled).toBe(true);
    expect(res.alreadyProcessed).toBe(false);
    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe('debit');
    expect(calls[0].amount).toBe(BigInt('250'));
  });

  it('processa WalletCreditRequested corretamente', async () => {
    const calls: any[] = [];
    const mockRepo = {
      debitWithProcessedRequest: async () => { throw new Error('not expected'); },
      creditWithProcessedRequest: async (requestId: string, userId: string, amount: bigint) => {
        calls.push({ method: 'credit', requestId, userId, amount });
        return { alreadyProcessed: true, wallet: { id: 'w2', userId, balance: 2000n, currency: 'BRL' } };
      }
    } as any;

    const consumer = new WalletConsumer(mockRepo as any, null);
    const payload = { requestId: 'r2', userId: 'u2', amountCents: '500' };
    const res = await consumer.handleEvent('WalletCreditRequested', payload);

    expect(res.handled).toBe(true);
    expect(res.alreadyProcessed).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe('credit');
    expect(calls[0].amount).toBe(BigInt('500'));
  });
});
