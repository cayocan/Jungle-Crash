import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Round, BetProps } from '../domain/round';
import { RoundRepository } from '../repositories/round.repository';

const BETTING_PHASE_MS = 10_000; // 10s betting phase
const COOLDOWN_MS = 3_000;       // 3s cooldown between rounds
const TICK_MS = 100;             // multiplier tick interval

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

/** Exponential multiplier — doubles every ~12s. */
function calcMultiplier(elapsedMs: number): number {
    return parseFloat(Math.max(1.0, Math.pow(Math.E, 0.00006 * elapsedMs)).toFixed(2));
}

@Injectable()
export class GameService implements OnModuleInit {
    private readonly logger = new Logger(GameService.name);
    /** GameGateway — injected post-init to avoid circular dependency. */
    private gateway: any;

    private currentRound: Round | null = null;
    private currentMultiplier = 1.0;

    constructor(private readonly roundRepo: RoundRepository) { }

    /**
     * Injects the WebSocket gateway after initialization to prevent
     * a circular dependency between GameService and GameGateway.
     */
    setGateway(gateway: any) {
        this.gateway = gateway;
    }

    /** Starts the round cycle on an async tick to avoid blocking bootstrap. */
    async onModuleInit() {
        setTimeout(() => this.runCycle(), 500);
    }

    /** Returns the currently active round, or null if between rounds. */
    getCurrentRound(): Round | null { return this.currentRound; }
    /** Returns the current multiplier value for the active round. */
    getCurrentMultiplier(): number { return this.currentMultiplier; }

    // ─── Bet placement ────────────────────────────────────────────────────────

    /**
     * Places a bet for the given user on the currently open round.
     * Broadcasts a `bet_placed` WebSocket event on success.
     *
     * @throws {Error} If there is no round in the betting phase.
     */
    async placeBet(userId: string, amountCents: bigint, requestId: string): Promise<BetProps> {
        if (!this.currentRound || this.currentRound.status !== 'OPEN') {
            throw new Error('round not in betting phase');
        }
        const bet = await this.roundRepo.placeBet(this.currentRound.id!, userId, amountCents, requestId);
        this.gateway?.broadcast('bet_placed', {
            betId: bet.id,
            roundId: bet.roundId,
            userId: bet.userId,
            amountCents: bet.amountCents.toString(),
        });
        return bet;
    }

    /**
     * Cashes out the user's active bet at the current multiplier.
     * Broadcasts a `cashout` WebSocket event on success.
     *
     * @throws {Error} If there is no active round or no open bet for the user.
     */
    async cashout(userId: string, requestId: string): Promise<BetProps> {
        if (!this.currentRound || this.currentRound.status !== 'CLOSED') {
            throw new Error('round is not running');
        }
        const round = await this.roundRepo.findById(this.currentRound.id!);
        const activeBet = round?.bets.find((b) => b.userId === userId && !b.cashedOutAt);
        if (!activeBet?.id) throw new Error('no active bet for user in this round');

        const multiplier = this.currentMultiplier;
        const bet = await this.roundRepo.cashout(activeBet.id, multiplier, requestId);
        this.gateway?.broadcast('cashout', {
            betId: bet.id,
            roundId: bet.roundId,
            userId: bet.userId,
            cashoutCents: bet.cashoutCents?.toString(),
            multiplierAtCashout: bet.multiplierAtCashout,
        });
        return bet;
    }

    // ─── Round lifecycle ───────────────────────────────────────────────────────

    /**
     * Infinite loop that orchestrates round creation with a cooldown between each.
     * Errors within a single round are caught and logged so the cycle never stops.
     */
    private async runCycle(): Promise<void> {
        while (true) {
            try {
                await this.doRound();
            } catch (err) {
                this.logger.error('Round cycle error', err);
            }
            await sleep(COOLDOWN_MS);
        }
    }

    /**
     * Executes the full lifecycle of a single round:
     * PENDING → OPEN (betting) → CLOSED (multiplier ticking) → SETTLED (crash).
     */
    private async doRound(): Promise<void> {
        // 1. Create round
        const round = await this.roundRepo.create(Round.create());
        this.currentRound = round;
        this.currentMultiplier = 1.0;

        // 2. Betting phase (OPEN)
        round.openBetting();
        await this.roundRepo.save(round);
        const bettingEndsAt = Date.now() + BETTING_PHASE_MS;
        this.gateway?.broadcast('round_waiting', {
            roundId: round.id,
            serverSeedHash: round.serverSeedHash,
            bettingEndsAt,
        });
        await sleep(BETTING_PHASE_MS);

        // 3. Round started — multiplier rising (CLOSED)
        round.startRound();
        await this.roundRepo.save(round);
        // Reload reference with bets included
        const startedRound = await this.roundRepo.findById(round.id!);
        if (startedRound) this.currentRound = startedRound;

        this.gateway?.broadcast('round_started', {
            roundId: round.id,
            serverSeedHash: round.serverSeedHash,
        });

        const startTime = Date.now();
        const crashPoint = round.crashPoint;

        // 4. Tick loop
        while (true) {
            const elapsed = Date.now() - startTime;
            this.currentMultiplier = calcMultiplier(elapsed);
            this.gateway?.broadcast('multiplier_tick', {
                roundId: round.id,
                multiplier: this.currentMultiplier,
            });

            if (this.currentMultiplier >= crashPoint) break;
            await sleep(TICK_MS);
        }

        // 5. Crash
        round.settle();
        await this.roundRepo.save(round);
        await this.roundRepo.settleLosers(round.id!);

        this.gateway?.broadcast('round_crashed', {
            roundId: round.id,
            crashPoint,
            serverSeed: round.serverSeed,
        });

        this.currentRound = null;
        this.currentMultiplier = 0;
        this.logger.log(`Round ${round.id} crashed at ${crashPoint}x`);
    }
}
