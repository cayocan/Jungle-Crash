export type WalletProps = {
    id?: string;
    userId: string;
    balance: bigint;
    currency?: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export class Wallet {
    private props: WalletProps;

    constructor(props: WalletProps) {
        this.props = {
            ...props,
            balance: props.balance ?? 0n,
            currency: props.currency ?? 'BRL',
        };
    }

    get id() {
        return this.props.id;
    }

    get userId() {
        return this.props.userId;
    }

    get balance() {
        return this.props.balance;
    }

    get currency() {
        return this.props.currency!;
    }

    credit(amount: bigint) {
        if (amount <= 0n) throw new Error('amount must be positive');
        this.props.balance = this.props.balance + amount;
    }

    debit(amount: bigint) {
        if (amount <= 0n) throw new Error('amount must be positive');
        if (this.props.balance < amount) throw new Error('insufficient funds');
        this.props.balance = this.props.balance - amount;
    }

    toPrisma() {
        return {
            id: this.props.id,
            userId: this.props.userId,
            balance: this.props.balance,
            currency: this.props.currency,
            createdAt: this.props.createdAt,
            updatedAt: this.props.updatedAt,
        };
    }

    static fromPrisma(row: any): Wallet | null {
        if (!row) return null;
        return new Wallet({
            id: row.id,
            userId: row.userId,
            balance: typeof row.balance === 'bigint' ? row.balance : BigInt(row.balance),
            currency: row.currency,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        });
    }
}
