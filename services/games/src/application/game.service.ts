import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Round, BetProps } from '../domain/round';
import { RoundRepository } from '../repositories/round.repository';

const BETTING_PHASE_MS = 10_000; // 10s para apostas
const COOLDOWN_MS = 3_000;       // 3s entre rodadas
const TICK_MS = 100;             // tick do multiplicador a cada 100ms

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Multiplier crescente exponencial — dobra a cada ~12s */
function calcMultiplier(elapsedMs: number): number {
  return parseFloat(Math.max(1.0, Math.pow(Math.E, 0.00006 * elapsedMs)).toFixed(2));
}

@Injectable()
export class GameService implements OnModuleInit {
  private readonly logger = new Logger(GameService.name);
  private gateway: any; // GameGateway, injetado pós-init para evitar dep circular

  private currentRound: Round | null = null;
  private currentMultiplier = 1.0;

  constructor(private readonly roundRepo: RoundRepository) {}

  setGateway(gateway: any) {
    this.gateway = gateway;
  }

  async onModuleInit() {
    // inicia o ciclo de rodadas num tick assíncrono para não bloquear o bootstrap
    setTimeout(() => this.runCycle(), 500);
  }

  getCurrentRound(): Round | null { return this.currentRound; }
  getCurrentMultiplier(): number { return this.currentMultiplier; }

  // ─── Bet placement ────────────────────────────────────────────────────────

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

  private async doRound(): Promise<void> {
    // 1. Cria rodada
    const round = await this.roundRepo.create(Round.create());
    this.currentRound = round;
    this.currentMultiplier = 1.0;

    // 2. Fase de apostas (OPEN)
    round.openBetting();
    await this.roundRepo.save(round);
    const bettingEndsAt = Date.now() + BETTING_PHASE_MS;
    this.gateway?.broadcast('round_waiting', {
      roundId: round.id,
      serverSeedHash: round.serverSeedHash,
      bettingEndsAt,
    });
    await sleep(BETTING_PHASE_MS);

    // 3. Rodada iniciada — multiplicador sobe (CLOSED)
    round.startRound();
    await this.roundRepo.save(round);
    // Atualiza referência com bets carregadas
    const startedRound = await this.roundRepo.findById(round.id!);
    if (startedRound) this.currentRound = startedRound;

    this.gateway?.broadcast('round_started', {
      roundId: round.id,
      serverSeedHash: round.serverSeedHash,
    });

    const startTime = Date.now();
    const crashPoint = round.crashPoint;

    // 4. Loop de ticks
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
