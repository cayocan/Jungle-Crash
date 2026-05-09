import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateWalletDto } from '../dtos/create-wallet.dto';
import { JwtAuthGuard } from '../../infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/current-user.decorator';
import { WalletService } from '../../application/wallet.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller()
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    @ApiOperation({ summary: 'Get authenticated player wallet' })
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

    @ApiOperation({ summary: 'Create wallet for the authenticated player' })
    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@CurrentUser() user: { userId: string }, @Body() dto: CreateWalletDto) {
        // userId always comes from the JWT; body fields are optional overrides for currency/initial balance
        return this.walletService.create(user.userId, dto.initialBalanceCents, dto.currency);
    }
}
