import { Body, Controller, Get, Headers, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { WalletRepository } from '../../repositories/wallet.repository';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { Wallet as DomainWallet } from '../../domain/wallet';
import { JwtAuthGuard } from '../../infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/current-user.decorator';

@Controller()
export class WalletController {
    constructor(private readonly repo: WalletRepository) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@CurrentUser() user: { userId: string }) {
        const userId = user.userId;
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

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateWalletDto) {
        // userId always comes from the JWT; body fields are optional overrides for currency/initial balance
        const userId = user.userId;
        const balance = dto.initialBalanceCents ? BigInt(dto.initialBalanceCents) : 0n;
        const wallet = await this.repo.create(new DomainWallet({ userId, balance, currency: dto.currency }));
        return { id: wallet.id, userId: wallet.userId, balanceCents: wallet.balance.toString(), currency: wallet.currency };
    }
}
