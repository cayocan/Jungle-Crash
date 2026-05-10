import { Controller, Post, Get, Body, Headers, BadRequestException, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GameService } from '../../application/game.service';
import { RoundRepository } from '../../repositories/round.repository';
import { PlaceBetDto } from '../dtos/place-bet.dto';
import { JwtAuthGuard } from '../../infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../infrastructure/current-user.decorator';
import { randomUUID } from 'crypto';

@ApiTags('Bets')
@ApiBearerAuth()
@Controller()
export class BetController {
    constructor(
        private readonly gameService: GameService,
        private readonly roundRepo: RoundRepository,
    ) { }

    /**
     * Places a bet on the currently open round.
     * Requires a valid Bearer JWT; optionally accepts `x-request-id` for idempotency.
     */
    @ApiOperation({ summary: 'Place a bet on the current round' })
    @UseGuards(JwtAuthGuard)
    @Post('bet')
    async placeBet(
        @Body() dto: PlaceBetDto,
        @CurrentUser() user: { userId: string },
        @Headers('x-request-id') requestId?: string,
    ) {
        const userId = user.userId;
        if (!dto.amountCents) throw new BadRequestException('amountCents is required');

        const amountCents = BigInt(dto.amountCents);
        const MIN = 100n;    // 1.00
        const MAX = 100000n; // 1000.00
        if (amountCents < MIN || amountCents > MAX) {
            throw new BadRequestException(`amountCents must be between ${MIN} and ${MAX}`);
        }

        const reqId = requestId ?? randomUUID();
        const bet = await this.gameService.placeBet(userId, amountCents, reqId, dto.autoCashoutAt);
        return {
            betId: bet.id,
            roundId: bet.roundId,
            amountCents: bet.amountCents.toString(),
        };
    }

    /** Cashes out the calling user's active bet at the current multiplier. */
    @ApiOperation({ summary: 'Cash out at the current multiplier' })
    @UseGuards(JwtAuthGuard)
    @Post('bet/cashout')
    async cashout(
        @CurrentUser() user: { userId: string },
        @Headers('x-request-id') requestId?: string,
    ) {
        const userId = user.userId;
        const reqId = requestId ?? randomUUID();
        const bet = await this.gameService.cashout(userId, reqId);
        return {
            betId: bet.id,
            cashoutCents: bet.cashoutCents?.toString(),
            multiplierAtCashout: bet.multiplierAtCashout,
        };
    }

    /** Returns a paginated history of bets placed by the calling user. */
    @ApiOperation({ summary: 'Paginated bet history for the authenticated user' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @UseGuards(JwtAuthGuard)
    @Get('bets/me')
    async myBets(
        @CurrentUser() user: { userId: string },
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const userId = user.userId;
        const { bets, total } = await this.roundRepo.findBetsByUser(userId, Number(page), Number(limit));
        return {
            data: bets.map((b) => ({
                id: b.id,
                roundId: b.roundId,
                amountCents: b.amountCents.toString(),
                cashoutCents: b.cashoutCents?.toString(),
                multiplierAtCashout: b.multiplierAtCashout,
                placedAt: b.placedAt?.toISOString(),
                cashedOutAt: b.cashedOutAt?.toISOString(),
            })),
            total,
            page: Number(page),
            limit: Number(limit),
        };
    }
}
