import { Body, Controller, Get, Headers, NotFoundException, Param, Post } from '@nestjs/common';
import { WalletRepository } from '../../repositories/wallet.repository';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { Wallet as DomainWallet } from '../../domain/wallet';

@Controller()
export class WalletController {
    constructor(private readonly repo: WalletRepository) { }

    @Get('me')
    async getMe(@Headers('x-user-id') userId: string) {
        if (!userId) throw new NotFoundException('x-user-id header required');
        const w = await this.repo.findByUserId(userId);
        if (!w) throw new NotFoundException();
        return {
            id: w.id,
            userId: w.userId,
            balanceCents: w.balance.toString(),
            currency: w.currency,
            createdAt: w.createdAt ? w.createdAt.toISOString() : undefined,
            updatedAt: w.updatedAt ? w.updatedAt.toISOString() : undefined,
        };
    }

    @Get(':userId')
    async getByUser(@Param('userId') userId: string) {
        const w = await this.repo.findByUserId(userId);
        if (!w) throw new NotFoundException();
        return {
            id: w.id,
            userId: w.userId,
            balanceCents: w.balance.toString(),
            currency: w.currency,
            createdAt: w.createdAt ? w.createdAt.toISOString() : undefined,
            updatedAt: w.updatedAt ? w.updatedAt.toISOString() : undefined,
        };
    }

    @Post()
    async create(@Body() dto: CreateWalletDto) {
        const balance = dto.initialBalanceCents ? BigInt(dto.initialBalanceCents) : 0n;
        const wallet = await this.repo.create(new DomainWallet({ userId: dto.userId, balance, currency: dto.currency }));
        return { id: wallet.id, userId: wallet.userId, balanceCents: wallet.balance.toString(), currency: wallet.currency };
    }
}
