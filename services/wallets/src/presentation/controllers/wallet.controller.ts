import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { JwtAuthGuard } from '../../infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/current-user.decorator';
import { WalletService } from '../../application/wallet.service';

@Controller()
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@CurrentUser() user: { userId: string }) {
        return this.walletService.getByUserId(user.userId);
    }

    @Get(':userId')
    async getByUser(@Param('userId') userId: string) {
        const w = await this.walletService.getByUserId(userId).catch(() => null);
        if (!w) throw new NotFoundException();
        return w;
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateWalletDto) {
        // userId always comes from the JWT; body fields are optional overrides for currency/initial balance
        return this.walletService.create(user.userId, dto.initialBalanceCents, dto.currency);
    }
}
