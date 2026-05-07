import { describe, it, expect } from 'bun:test';
import { toCents, fromCents, multiplyCents, addCents, formatCurrency } from '../../src/index';

describe('MoneyUtils', () => {
    it('toCents and fromCents roundtrip', () => {
        expect(toCents('12.34')).toBe(1234n);
        expect(fromCents(1234n)).toBe('12.34');
    });

    it('multiplyCents floors correctly', () => {
        expect(multiplyCents(1234n, '1.75')).toBe(2159n);
        expect(multiplyCents(100n, '2')).toBe(200n);
    });

    it('addCents and formatCurrency', () => {
        expect(addCents(100n, 234n)).toBe(334n);
        expect(formatCurrency(334n, 'BRL')).toBe('BRL 3.34');
    });

    it('invalid inputs throw', () => {
        expect(() => toCents('1.005')).toThrow();
        expect(() => multiplyCents(100n, 'abc')).toThrow();
    });
});
