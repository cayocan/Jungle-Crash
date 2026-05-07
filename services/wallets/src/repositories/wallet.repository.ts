import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Wallet } from '../domain/wallet';

@Injectable()
export class WalletRepository implements OnModuleDestroy {
    private prisma: PrismaClient;

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma ?? new PrismaClient();
    }

    async findByUserId(userId: string): Promise<Wallet | null> {
        const row = await this.prisma.wallet.findUnique({ where: { userId } });
        return Wallet.fromPrisma(row);
    }

    async create(wallet: Wallet): Promise<Wallet> {
        const data = wallet.toPrisma();
        const created = await this.prisma.wallet.create({ data });
        return Wallet.fromPrisma(created)!;
    }

    async credit(userId: string, amount: bigint): Promise<Wallet> {
        return this.prisma.$transaction(async (tx) => {
            const w = await tx.wallet.findUnique({ where: { userId } });
            if (!w) throw new Error('wallet not found');
            const newBalance = (typeof w.balance === 'bigint' ? w.balance : BigInt(w.balance)) + amount;
            const updated = await tx.wallet.update({ where: { userId }, data: { balance: newBalance } });
            return Wallet.fromPrisma(updated)!;
        });
    }

    async debit(userId: string, amount: bigint): Promise<Wallet> {
        return this.prisma.$transaction(async (tx) => {
            const w = await tx.wallet.findUnique({ where: { userId } });
            if (!w) throw new Error('wallet not found');
            const current = typeof w.balance === 'bigint' ? w.balance : BigInt(w.balance);
            if (current < amount) throw new Error('insufficient funds');
            const newBalance = current - amount;
            const updated = await tx.wallet.update({ where: { userId }, data: { balance: newBalance } });
            return Wallet.fromPrisma(updated)!;
        });
    }

    async createProcessedRequest(requestId: string, requestType: string, meta?: any) {
        return this.prisma.processedRequest.create({ data: { requestId, requestType, meta } });
    }

    async addOutboxEvent(event: { aggregateId?: string; eventType: string; payload: any }) {
        return this.prisma.outboxEvent.create({ data: { aggregateId: event.aggregateId, eventType: event.eventType, payload: event.payload } });
    }

    async onModuleDestroy() {
        try {
            await this.prisma.$disconnect();
        } catch {
            // ignore
        }
    }
}
