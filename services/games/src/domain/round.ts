import { createHmac, randomBytes } from 'crypto';

export type RoundStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'SETTLED' | 'CANCELLED';

export type BetProps = {
  id?: string;
  roundId: string;
  userId: string;
  amountCents: bigint;
  cashoutCents?: bigint;
  multiplierAtCashout?: string;
  placedAt?: Date;
  cashedOutAt?: Date;
  settledAt?: Date;
};

export type RoundProps = {
  id?: string;
  status: RoundStatus;
  startsAt?: Date;
  endsAt?: Date;
  serverSeed?: string;
  serverSeedHash?: string;
  crashPoint?: number;
  createdAt?: Date;
  updatedAt?: Date;
  bets?: BetProps[];
};

export class Round {
  private _props: RoundProps;
  private _bets: BetProps[];

  constructor(props: RoundProps) {
    this._props = { ...props };
    this._bets = props.bets ?? [];
  }

  static create(): Round {
    const serverSeed = randomBytes(32).toString('hex');
    const salt = randomBytes(8).toString('hex');
    const crashPoint = Round.computeCrashPoint(serverSeed, salt);
    const serverSeedHash = createHmac('sha256', 'public').update(serverSeed).digest('hex');
    return new Round({ status: 'PENDING', serverSeed, serverSeedHash, crashPoint });
  }

  /** Deterministic crash point from HMAC-SHA256 (provably fair). */
  static computeCrashPoint(serverSeed: string, salt: string): number {
    const h = createHmac('sha256', serverSeed).update(salt).digest('hex');
    const n = parseInt(h.slice(0, 13), 16);
    const e = Math.pow(2, 52);
    const raw = (100 * e - n) / (e - n);
    return Math.max(1.0, Math.floor(raw) / 100);
  }

  get id() { return this._props.id; }
  get status() { return this._props.status; }
  get serverSeed() { return this._props.serverSeed; }
  get serverSeedHash() { return this._props.serverSeedHash; }
  get crashPoint() { return this._props.crashPoint ?? 1.0; }
  get startsAt() { return this._props.startsAt; }
  get endsAt() { return this._props.endsAt; }
  get createdAt() { return this._props.createdAt; }
  get bets() { return this._bets; }

  openBetting(): void {
    if (this._props.status !== 'PENDING') throw new Error('Round must be PENDING to open betting');
    this._props.status = 'OPEN';
    this._props.startsAt = new Date();
  }

  startRound(): void {
    if (this._props.status !== 'OPEN') throw new Error('Round must be OPEN to start');
    this._props.status = 'CLOSED';
  }

  settle(): void {
    if (this._props.status !== 'CLOSED') throw new Error('Round must be CLOSED to settle');
    this._props.status = 'SETTLED';
    this._props.endsAt = new Date();
  }

  toPrisma() {
    return {
      id: this._props.id,
      status: this._props.status,
      startsAt: this._props.startsAt,
      endsAt: this._props.endsAt,
      serverSeed: this._props.serverSeed,
      serverSeedHash: this._props.serverSeedHash,
      provablyFair: this._props.crashPoint !== undefined
        ? { crashPoint: this._props.crashPoint }
        : undefined,
    };
  }

  static fromPrisma(row: any, bets?: any[]): Round {
    const crashPoint = row.provablyFair ? (row.provablyFair as any).crashPoint : undefined;
    return new Round({
      id: row.id,
      status: row.status as RoundStatus,
      startsAt: row.startsAt ?? undefined,
      endsAt: row.endsAt ?? undefined,
      serverSeed: row.serverSeed ?? undefined,
      serverSeedHash: row.serverSeedHash ?? undefined,
      crashPoint,
      createdAt: row.createdAt ?? undefined,
      updatedAt: row.updatedAt ?? undefined,
      bets: bets?.map((b) => ({
        id: b.id,
        roundId: b.roundId,
        userId: b.userId,
        amountCents: typeof b.amountCents === 'bigint' ? b.amountCents : BigInt(b.amountCents),
        cashoutCents: b.cashoutCents != null
          ? (typeof b.cashoutCents === 'bigint' ? b.cashoutCents : BigInt(b.cashoutCents))
          : undefined,
        multiplierAtCashout: b.multiplierAtCashout ?? undefined,
        placedAt: b.placedAt ?? undefined,
        cashedOutAt: b.cashedOutAt ?? undefined,
        settledAt: b.settledAt ?? undefined,
      })),
    });
  }
}
