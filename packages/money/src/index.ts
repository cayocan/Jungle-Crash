// Money utilities
// All identifiers and comments in English per project rules.

const DECIMAL_REGEX = /^(\d+)(?:\.(\d{1,2}))?$/;
const MULTIPLIER_REGEX = /^(\d+)(?:\.(\d+))?$/;

/**
 * Convert a decimal monetary value (string or number) to cents (bigint).
 * Accepts strings like "12.34" or numbers (number will be converted with 2 decimals).
 */
export function toCents(value: string | number): bigint {
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || Number.isNaN(value)) throw new Error('Invalid number');
		// toFixed(2) provides a stable 2-decimal representation
		value = value.toFixed(2);
	}

	if (typeof value !== 'string') throw new Error('Invalid value type');

	const m = value.match(DECIMAL_REGEX);
	if (!m) throw new Error('Invalid monetary format. Expect digits with up to 2 decimals');

	const integerPart = m[1];
	const fractionPart = m[2] ?? '0';
	const cents = BigInt(integerPart) * 100n + BigInt(fractionPart.padEnd(2, '0'));
	return cents;
}

/**
 * Convert cents (bigint) to decimal string with two fraction digits.
 */
export function fromCents(cents: bigint): string {
	const sign = cents < 0n ? '-' : '';
	const abs = cents < 0n ? -cents : cents;
	const whole = abs / 100n;
	const fraction = abs % 100n;
	return `${sign}${whole.toString()}.${fraction.toString().padStart(2, '0')}`;
}

/**
 * Multiply cents by a decimal multiplier expressed as string (e.g. "1.75").
 * Implementation uses integer arithmetic: (cents * numerator) / denominator
 * Result uses integer division (floor for positive numbers).
 */
export function multiplyCents(cents: bigint, multiplier: string): bigint {
	if (typeof multiplier !== 'string') throw new Error('Multiplier must be string');
	const m = multiplier.match(MULTIPLIER_REGEX);
	if (!m) throw new Error('Invalid multiplier format');

	const intPart = m[1];
	const fracPart = m[2] ?? '';
	const numerator = BigInt(intPart + fracPart);
	const denom = BigInt(10) ** BigInt(fracPart.length);

	return (cents * numerator) / denom;
}

/**
 * Deterministic addition of cents.
 */
export function addCents(a: bigint, b: bigint): bigint {
	return a + b;
}

/**
 * Format cents to human-friendly string, optionally with currency prefix.
 */
export function formatCurrency(cents: bigint, currency?: string): string {
	const s = fromCents(cents);
	return currency ? `${currency} ${s}` : s;
}
