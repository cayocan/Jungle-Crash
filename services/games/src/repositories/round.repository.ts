import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/client';
import { Round, BetProps } from '../domain/round';

@Injectable()
export class RoundRepository implements OnModuleDestroy {
    private readonly prisma: PrismaClient;

/** Accepts an injected PrismaClient or creates a standalone instance. */
  constructor(@Optional() prisma?: PrismaClient) {
        this.prisma = prisma ?? new PrismaClient();
    }

    /** Persists a new round to the database and returns the saved entity. */
    async create(round: Round): Promise<Round> {
        const { id, ...data } = round.toPrisma();
        const created = await this.prisma.round.create({ data: data as any });
        return Round.fromPrisma(created);
    }

    /** Updates an existing round record with the current domain state. */
    async save(round: Round): Promise<Round> {
        const { id, ...data } = round.toPrisma();
        const updated = await this.prisma.round.update({
            where: { id: id! },
            data: {
                status: data.status as any,
                startsAt: data.startsAt,
                endsAt: data.endsAt,
                provablyFair: data.provablyFair as any,
            },
        });
        return Round.fromPrisma(updated);
    }
  /** Finds a round by its ID, including all related bets. Returns null if not found. */    async findById(id: string): Promise<Round | null> {
        const row = await this.prisma.round.findUnique({ where: { id }, include: { bets: true } });
        if (!row) return null;
        return Round.fromPrisma(row, row.bets);
    }

    /** Returns the most recent non-settled round (PENDING, OPEN, or CLOSED), or null. */
    async findCurrent(): Promise<Round | null> {
        const row = await this.prisma.round.findFirst({
            where: { status: { in: ['PENDING', 'OPEN', 'CLOSED'] } },
            orderBy: { createdAt: 'desc' },
            include: { bets: true },
        });
        if (!row) return null;
        return Round.fromPrisma(row, row.bets);
    }

    /** Returns a paginated list of all SETTLED rounds and the total count. */
    async findHistory(page = 1, limit = 20): Promise<{ rounds: Round[]; total: number }> {
        const skip = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this.prisma.round.findMany({
                where: { status: 'SETTLED' },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.round.count({ where: { status: 'SETTLED' } }),
        ]);
        return { rounds: rows.map((r) => Round.fromPrisma(r)), total };
    }

    /** Returns a paginated list of bets placed by a specific user, ordered by placement date. */
    async findBetsByUser(userId: string, page = 1, limit = 20): Promise<{ bets: BetProps[]; total: number }> {
        const skip = (page - 1) * limit;
        const [rows, total] = await Promise.all([
            this.prisma.bet.findMany({
                where: { userId },
                orderBy: { placedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.bet.count({ where: { userId } }),
        ]);
        return {
            bets: rows.map((b) => ({
                id: b.id,
                roundId: b.roundId,
                userId: b.userId,
                amountCents: typeof b.amountCents === 'bigint' ? b.amountCents : BigInt(b.amountCents),
                cashoutCents: b.cashoutCents != null
                    ? (typeof b.cashoutCents === 'bigint' ? b.cashoutCents : BigInt(b.cashoutCents))
                    : undefined,
                multiplierAtCashout: b.multiplierAtCashout ?? undefined,
                autoCashoutAt: b.autoCashoutAt ?? undefined,
                placedAt: b.placedAt ?? undefined,
                cashedOutAt: b.cashedOutAt ?? undefined,
                settledAt: b.settledAt ?? undefined,
            })),
            total,
        };
    }
  /**
   * Atomically places a bet, enqueues a WalletDebitRequested outbox event,
   * and records the request ID for idempotency — all within a single transaction.
   *
   * @throws {Error} On duplicate request, non-open round, or existing bet for the user.
   */    async placeBet(roundId: string, userId: string, amountCents: bigint, requestId: string, autoCashoutAt?: number): Promise<BetProps> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.processedRequest.findUnique({ where: { requestId } });
            if (existing) throw new Error('duplicate request');

            const round = await tx.round.findUnique({ where: { id: roundId } });
            if (!round || round.status !== 'OPEN') throw new Error('round not in betting phase');

            const existingBet = await tx.bet.findFirst({ where: { roundId, userId } });
            if (existingBet) throw new Error('already bet in this round');

            const bet = await tx.bet.create({
                data: { roundId, userId, amountCents, placedAt: new Date(), autoCashoutAt: autoCashoutAt ?? null },
            });

            // Publish WalletDebitRequested via outbox
            await tx.outboxEvent.create({
                data: {
                    aggregateId: roundId,
                    eventType: 'WalletDebitRequested',
                    payload: { requestId, userId, amountCents: amountCents.toString() },
                },
            });

            await tx.processedRequest.create({
                data: { requestId, requestType: 'place_bet', meta: { betId: bet.id } },
            });

            return {
                id: bet.id,
                roundId: bet.roundId,
                userId: bet.userId,
                amountCents: typeof bet.amountCents === 'bigint' ? bet.amountCents : BigInt(bet.amountCents),
                autoCashoutAt: bet.autoCashoutAt ?? undefined,
            };
        });
    }
  /**
   * Atomically records a cashout, computes the payout, enqueues a WalletCreditRequested
   * outbox event, and stores the request ID for idempotency — within a single transaction.
   *
   * @throws {Error} On duplicate request, missing bet, or already cashed-out bet.
   */    async cashout(betId: string, multiplier: number, requestId: string): Promise<BetProps> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.processedRequest.findUnique({ where: { requestId } });
            if (existing) throw new Error('duplicate cashout request');

            const bet = await tx.bet.findUnique({ where: { id: betId } });
            if (!bet) throw new Error('bet not found');
            if (bet.cashedOutAt) throw new Error('already cashed out');
            if (!bet.walletConfirmed) throw new Error('wallet debit not yet confirmed — bet is pending');

            const amountCents = typeof bet.amountCents === 'bigint' ? bet.amountCents : BigInt(bet.amountCents);
            const cashoutCents = BigInt(Math.floor(Number(amountCents) * multiplier));

            const updated = await tx.bet.update({
                where: { id: betId },
                data: {
                    cashoutCents,
                    multiplierAtCashout: multiplier.toFixed(2),
                    cashedOutAt: new Date(),
                },
            });

            // Publish WalletCreditRequested via outbox
            await tx.outboxEvent.create({
                data: {
                    aggregateId: bet.roundId,
                    eventType: 'WalletCreditRequested',
                    payload: { requestId, userId: bet.userId, amountCents: cashoutCents.toString() },
                },
            });

            await tx.processedRequest.create({
                data: { requestId, requestType: 'cashout', meta: { betId } },
            });

            return {
                id: updated.id,
                roundId: updated.roundId,
                userId: updated.userId,
                amountCents,
                cashoutCents,
                multiplierAtCashout: updated.multiplierAtCashout ?? undefined,
                cashedOutAt: updated.cashedOutAt ?? undefined,
            };
        });
    }

    /**
     * Cancels a pending bet by deleting the bet record linked to the given request ID.
     * Used when a WalletDebitFailed event is received, rolling back the placed bet.
     */
    async cancelBet(requestId: string): Promise<void> {
        const req = await this.prisma.processedRequest.findUnique({ where: { requestId } });
        if (!req) return;
        const betId = (req.meta as any)?.betId as string | undefined;
        if (!betId) return;
        await this.prisma.bet.deleteMany({ where: { id: betId, cashedOutAt: null, settledAt: null } });
    }

    /** Marks all uncashed **wallet-confirmed** bets in a round as settled with a zero payout (losers).
     *  Bets where walletConfirmed=false are left untouched — they will be removed when
     *  WalletDebitFailed arrives, or refunded if WalletDebited arrives after the round settled.
     */
    async settleLosers(roundId: string): Promise<void> {
        await this.prisma.bet.updateMany({
            where: { roundId, cashedOutAt: null, settledAt: null, walletConfirmed: true },
            data: { settledAt: new Date(), cashoutCents: BigInt(0) },
        });
    }

    /**
     * Marks the bet linked to `requestId` as wallet-confirmed.
     * Called when WalletDebited is received from the saga.
     * Returns the confirmed bet so callers can handle edge cases
     * (e.g., refund if round already settled).
     */
    async confirmBetDebit(requestId: string): Promise<{ betId: string; roundId: string; userId: string; amountCents: bigint } | null> {
        const req = await this.prisma.processedRequest.findUnique({ where: { requestId } });
        if (!req) return null;
        const betId = (req.meta as any)?.betId as string | undefined;
        if (!betId) return null;

        const bet = await this.prisma.bet.findUnique({ where: { id: betId } });
        if (!bet) return null; // already cancelled

        await this.prisma.bet.update({ where: { id: betId }, data: { walletConfirmed: true } });
        return {
            betId: bet.id,
            roundId: bet.roundId,
            userId: bet.userId,
            amountCents: typeof bet.amountCents === 'bigint' ? bet.amountCents : BigInt(bet.amountCents),
        };
    }

    /**
     * Enqueues a WalletCreditRequested refund for a bet that was wallet-debited
     * but whose round settled before wallet confirmation arrived.
     * This makes the player whole after a rare timing edge case.
     */
    async issueRefund(betId: string, refundRequestId: string, amountCents: bigint): Promise<void> {
        const bet = await this.prisma.bet.findUnique({ where: { id: betId } });
        if (!bet) return;
        await this.prisma.$transaction(async (tx) => {
            await tx.outboxEvent.create({
                data: {
                    aggregateId: bet.roundId,
                    eventType: 'WalletCreditRequested',
                    payload: {
                        requestId: refundRequestId,
                        userId: bet.userId,
                        amountCents: amountCents.toString(),
                        metadata: { reason: 'refund_bet_late_confirmation', betId },
                    },
                },
            });
            // Mark the bet as settled with the refunded amount so it's not orphaned.
            await tx.bet.update({
                where: { id: betId },
                data: { settledAt: new Date(), cashoutCents: BigInt(0) },
            });
        });
    }

    /**
     * Returns top N players ranked by their BEST single-round profit
     * (cashoutCents - amountCents) within a given period.
     * Only cashout wins are considered — losses and net-negative players are excluded.
     */
    async getLeaderboard(limit = 10, periodHours = 24): Promise<Array<{
        userId: string;
        bestProfitCents: bigint;
        bestAmountCents: bigint;
        bestCashoutCents: bigint;
        bestMultiplier: number;
    }>> {
        const since = new Date(Date.now() - periodHours * 60 * 60 * 1000);
        // Subquery finds, for each user, the single bet with the highest profit.
        // FILTER ensures we only look at cashed-out bets with positive profit.
        const rows = await this.prisma.$queryRaw<Array<{
            userId: string;
            best_profit: bigint;
            best_amount: bigint;
            best_cashout: bigint;
        }>>`
            SELECT
                "userId",
                MAX("cashoutCents" - "amountCents") AS best_profit,
                (
                    SELECT b2."amountCents"
                    FROM "Bet" b2
                    WHERE b2."userId" = b."userId"
                      AND b2."settledAt" IS NOT NULL
                      AND b2."placedAt" >= ${since}
                      AND b2."cashoutCents" IS NOT NULL
                      AND b2."cashoutCents" > b2."amountCents"
                    ORDER BY (b2."cashoutCents" - b2."amountCents") DESC
                    LIMIT 1
                ) AS best_amount,
                (
                    SELECT b2."cashoutCents"
                    FROM "Bet" b2
                    WHERE b2."userId" = b."userId"
                      AND b2."settledAt" IS NOT NULL
                      AND b2."placedAt" >= ${since}
                      AND b2."cashoutCents" IS NOT NULL
                      AND b2."cashoutCents" > b2."amountCents"
                    ORDER BY (b2."cashoutCents" - b2."amountCents") DESC
                    LIMIT 1
                ) AS best_cashout
            FROM "Bet" b
            WHERE
                b."settledAt" IS NOT NULL
                AND b."placedAt" >= ${since}
                AND b."cashoutCents" IS NOT NULL
                AND b."cashoutCents" > b."amountCents"
            GROUP BY b."userId"
            ORDER BY best_profit DESC
            LIMIT ${limit}
        `;
        return rows.map((r) => {
            const profit   = BigInt(r.best_profit);
            const amount   = BigInt(r.best_amount);
            const cashout  = BigInt(r.best_cashout);
            const multiplier = amount > 0n
                ? Math.floor(Number(cashout) / Number(amount) * 100) / 100
                : 0;
            return {
                userId: r.userId,
                bestProfitCents: profit,
                bestAmountCents: amount,
                bestCashoutCents: cashout,
                bestMultiplier: multiplier,
            };
        });
    }

    /** Disconnects the Prisma client when the module is torn down. */
    async onModuleDestroy() {
        try { await this.prisma.$disconnect(); } catch { }
    }
}
