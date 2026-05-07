/// <reference types="bun-types" />

import { Wallet } from '../../src/domain/wallet';

describe('Wallet domain', () => {
  it('credits balance', () => {
    const w = new Wallet({ userId: 'u1', balance: 1000n });
    w.credit(500n);
    expect(w.balance).toBe(1500n);
  });

  it('debits balance', () => {
    const w = new Wallet({ userId: 'u2', balance: 2000n });
    w.debit(500n);
    expect(w.balance).toBe(1500n);
  });

  it('throws on insufficient funds', () => {
    const w = new Wallet({ userId: 'u3', balance: 100n });
    expect(() => w.debit(200n)).toThrow();
  });
});
