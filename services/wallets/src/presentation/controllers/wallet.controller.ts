import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { WalletRepository } from '../../repositories/wallet.repository';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { AmountDto } from '../dtos/amount.dto';
import { Wallet as DomainWallet } from '../../domain/wallet';

@Controller('wallets')
export class WalletController {
  constructor(private readonly repo: WalletRepository) {}

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

  @Post(':userId/credit')
  async credit(@Param('userId') userId: string, @Body() dto: AmountDto) {
    const amount = BigInt(dto.amountCents);
    const updated = await this.repo.credit(userId, amount);
    return { id: updated.id, userId: updated.userId, balanceCents: updated.balance.toString() };
  }

  @Post(':userId/debit')
  async debit(@Param('userId') userId: string, @Body() dto: AmountDto) {
    const amount = BigInt(dto.amountCents);
    const updated = await this.repo.debit(userId, amount);
    return { id: updated.id, userId: updated.userId, balanceCents: updated.balance.toString() };
  }
}
