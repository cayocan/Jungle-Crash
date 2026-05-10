import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Wallet } from '../domain/wallet';

@Injectable()
export class WalletRepository implements OnModuleDestroy {
    private prisma: PrismaClient;

    constructor(@Optional() prisma?: PrismaClient) {
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

    async debitWithProcessedRequest(requestId: string, userId: string, amount: bigint, meta?: any): Promise<{ alreadyProcessed: boolean; wallet?: Wallet; failed?: boolean; reason?: string }> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.processedRequest.findUnique({ where: { requestId } });
            if (existing) {
                const w = await tx.wallet.findUnique({ where: { userId } });
                return { alreadyProcessed: true, wallet: Wallet.fromPrisma(w!) ?? undefined };
            }

            const w = await tx.wallet.findUnique({ where: { userId } });
            if (!w) throw new Error('wallet not found');
            const current = typeof w.balance === 'bigint' ? w.balance : BigInt(w.balance);

            if (current < amount) {
                // Publish failure event via outbox and record idempotency key so retries are ignored.
                await tx.outboxEvent.create({
                    data: {
                        aggregateId: userId,
                        eventType: 'WalletDebitFailed',
                        payload: { requestId, userId, amountCents: amount.toString(), reason: 'insufficient funds' },
                    },
                });
                await tx.processedRequest.create({ data: { requestId, requestType: 'debit_failed', meta } });
                return { alreadyProcessed: false, failed: true, reason: 'insufficient funds' };
            }

            const newBalance = current - amount;
            const updated = await tx.wallet.update({ where: { userId }, data: { balance: newBalance } });

            await tx.outboxEvent.create({ data: { aggregateId: updated.id, eventType: 'WalletDebited', payload: { requestId, userId, amountCents: amount.toString() } } });
            await tx.processedRequest.create({ data: { requestId, requestType: 'debit', meta } });

            return { alreadyProcessed: false, wallet: Wallet.fromPrisma(updated)! };
        });
    }

    async creditWithProcessedRequest(requestId: string, userId: string, amount: bigint, meta?: any): Promise<{ alreadyProcessed: boolean; wallet?: Wallet }> {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.processedRequest.findUnique({ where: { requestId } });
            if (existing) {
                const w = await tx.wallet.findUnique({ where: { userId } });
                return { alreadyProcessed: true, wallet: Wallet.fromPrisma(w!) ?? undefined };
            }

            const w = await tx.wallet.findUnique({ where: { userId } });
            if (!w) throw new Error('wallet not found');
            const current = typeof w.balance === 'bigint' ? w.balance : BigInt(w.balance);
            const newBalance = current + amount;
            const updated = await tx.wallet.update({ where: { userId }, data: { balance: newBalance } });

            await tx.outboxEvent.create({ data: { aggregateId: updated.id, eventType: 'WalletCredited', payload: { requestId, userId, amountCents: amount.toString() } } });
            await tx.processedRequest.create({ data: { requestId, requestType: 'credit', meta } });

            return { alreadyProcessed: false, wallet: Wallet.fromPrisma(updated)! };
        });
    }

    async onModuleDestroy() {
        try {
            await this.prisma.$disconnect();
        } catch {
            // ignore
        }
    }
}
