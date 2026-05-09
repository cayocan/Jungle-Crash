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
    salt?: string;
    createdAt?: Date;
    updatedAt?: Date;
    bets?: BetProps[];
};

export class Round {
    private _props: RoundProps;
    private _bets: BetProps[];

    /** Constructs a Round from the given property bag. */
    constructor(props: RoundProps) {
        this._props = { ...props };
        this._bets = props.bets ?? [];
    }

    /**
     * Factory method: generates a new round with a random server seed and
     * a deterministic crash point using provably fair HMAC-SHA256.
     */
    static create(): Round {
        const serverSeed = randomBytes(32).toString('hex');
        const salt = randomBytes(8).toString('hex');
        const crashPoint = Round.computeCrashPoint(serverSeed, salt);
        const serverSeedHash = createHmac('sha256', 'public').update(serverSeed).digest('hex');
        return new Round({ status: 'PENDING', serverSeed, serverSeedHash, crashPoint, salt });
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
    get salt() { return this._props.salt; }
    get startsAt() { return this._props.startsAt; }
    get endsAt() { return this._props.endsAt; }
    get createdAt() { return this._props.createdAt; }
    get bets() { return this._bets; }

    /** Transitions the round from PENDING to OPEN, recording the start time. */
    openBetting(): void {
        if (this._props.status !== 'PENDING') throw new Error('Round must be PENDING to open betting');
        this._props.status = 'OPEN';
        this._props.startsAt = new Date();
    }

    /** Transitions the round from OPEN to CLOSED, stopping bet placement. */
    startRound(): void {
        if (this._props.status !== 'OPEN') throw new Error('Round must be OPEN to start');
        this._props.status = 'CLOSED';
    }

    /** Transitions the round from CLOSED to SETTLED, recording the end time. */
    settle(): void {
        if (this._props.status !== 'CLOSED') throw new Error('Round must be CLOSED to settle');
        this._props.status = 'SETTLED';
        this._props.endsAt = new Date();
    }

    /** Serializes the round to a plain object compatible with Prisma's write API. */
    toPrisma() {
        return {
            id: this._props.id,
            status: this._props.status,
            startsAt: this._props.startsAt,
            endsAt: this._props.endsAt,
            serverSeed: this._props.serverSeed,
            serverSeedHash: this._props.serverSeedHash,
            provablyFair: this._props.crashPoint !== undefined
                ? { crashPoint: this._props.crashPoint, salt: this._props.salt }
                : undefined,
        };
    }

    /**
     * Reconstructs a Round domain object from a Prisma database row.
     *
     * @param row - The raw Prisma round record.
     * @param bets - Optional array of related bet records to hydrate.
     */
    static fromPrisma(row: any, bets?: any[]): Round {
        const crashPoint = row.provablyFair ? (row.provablyFair as any).crashPoint : undefined;
        const salt = row.provablyFair ? (row.provablyFair as any).salt : undefined;
        return new Round({
            id: row.id,
            status: row.status as RoundStatus,
            startsAt: row.startsAt ?? undefined,
            endsAt: row.endsAt ?? undefined,
            serverSeed: row.serverSeed ?? undefined,
            serverSeedHash: row.serverSeedHash ?? undefined,
            crashPoint,
            salt,
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
