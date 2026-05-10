/**
 * Event schemas shared between Game and Wallet services.
 * All comments and identifiers are in English per project rules.
 */

/** Generic event envelope for inter-service messages. */
export interface EventEnvelope<T> {
	eventId: string; // UUID for this event
	eventType: string; // e.g. 'WalletDebitRequested'
	version?: string; // optional schema version
	source?: string; // logical producer id
	correlationId?: string; // saga correlation id
	idempotencyKey?: string; // idempotency token for the operation
	timestamp: string; // ISO 8601
	payload: T;
}

/** Wallet debit requested payload */
export interface WalletDebitRequestedPayload {
	requestId: string;
	userId: string;
	amountCents: string; // cents as string
	metadata?: Record<string, string>;
}

/** Wallet debit succeeded payload */
export interface WalletDebitSucceededPayload {
	requestId: string;
	userId: string;
	amountCents: string;
	balanceBeforeCents: string;
	balanceAfterCents: string;
	transactionId: string;
}

/** Wallet debit failed payload */
export interface WalletDebitFailedPayload {
	requestId: string;
	userId: string;
	amountCents: string;
	reason: string;
}

/** Wallet credit requested payload */
export interface WalletCreditRequestedPayload {
	requestId: string;
	userId: string;
	amountCents: string;
	metadata?: Record<string, string>;
}

export interface WalletCreditSucceededPayload {
	requestId: string;
	userId: string;
	amountCents: string;
	balanceBeforeCents: string;
	balanceAfterCents: string;
	transactionId: string;
}

export interface WalletCreditFailedPayload {
	requestId: string;
	userId: string;
	amountCents: string;
	reason: string;
}

/** Bet placed payload */
export interface BetPlacedPayload {
	betId: string;
	roundId: string;
	userId: string;
	amountCents: string;
	idempotencyKey?: string;
	placedAt: string; // ISO 8601
}

/** Bet cashout requested payload */
export interface BetCashoutRequestedPayload {
	betId: string;
	roundId: string;
	userId: string;
	requestedAt: string; // ISO 8601
}

/** Bet resolved payload */
export interface BetResolvedPayload {
	betId: string;
	roundId: string;
	userId: string;
	result: 'WIN' | 'LOSE';
	payoutCents?: string;
	multiplier?: string; // e.g. '1.75'
	resolvedAt: string; // ISO 8601
}

export type WalletEvents =
	| EventEnvelope<WalletDebitRequestedPayload>
	| EventEnvelope<WalletDebitSucceededPayload>
	| EventEnvelope<WalletDebitFailedPayload>
	| EventEnvelope<WalletCreditRequestedPayload>
	| EventEnvelope<WalletCreditSucceededPayload>
	| EventEnvelope<WalletCreditFailedPayload>;

export type GameEvents =
	| EventEnvelope<BetPlacedPayload>
	| EventEnvelope<BetCashoutRequestedPayload>
	| EventEnvelope<BetResolvedPayload>;

export {};
