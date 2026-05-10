import { Injectable, NotFoundException } from '@nestjs/common';
import { Wallet } from '../domain/wallet';
import { WalletRepository } from '../repositories/wallet.repository';

/** Response shape returned by WalletService methods. */
export interface WalletDto {
    id: string;
    userId: string;
    balanceCents: string;
    currency: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Application service for wallet operations.
 * Orchestrates domain logic and delegates persistence to WalletRepository.
 */
@Injectable()
export class WalletService {
    constructor(private readonly repo: WalletRepository) {}

    /** Returns the wallet for the given user, or throws NotFoundException. */
    async getByUserId(userId: string): Promise<WalletDto> {
        const w = await this.repo.findByUserId(userId);
        if (!w) throw new NotFoundException('wallet not found');
        return this.serialize(w);
    }

    /** Creates a new wallet for the authenticated user with an optional initial balance. */
    async create(userId: string, initialBalanceCents?: string, currency?: string): Promise<WalletDto> {
        const balance = initialBalanceCents ? BigInt(initialBalanceCents) : 0n;
        const wallet = await this.repo.create(
            new Wallet({ userId, balance, currency: currency ?? 'BRL' }),
        );
        return this.serialize(wallet);
    }

    /** Serializes a Wallet domain object to a plain JSON-safe DTO. */
    private serialize(w: Wallet): WalletDto {
        return {
            id: w.id!,
            userId: w.userId,
            balanceCents: w.balance.toString(),
            currency: w.currency,
            createdAt: w.createdAt?.toISOString(),
            updatedAt: w.updatedAt?.toISOString(),
        };
    }
}
