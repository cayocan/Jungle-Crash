import { Controller, Post, Get, Body, Headers, BadRequestException, Query } from '@nestjs/common';
import { GameService } from '../../application/game.service';
import { RoundRepository } from '../../repositories/round.repository';
import { PlaceBetDto } from '../dtos/place-bet.dto';
import { randomUUID } from 'crypto';

@Controller()
export class BetController {
    constructor(
        private readonly gameService: GameService,
        private readonly roundRepo: RoundRepository,
    ) { }

    /**
     * Places a bet on the currently open round.
     * Requires `x-user-id` header; optionally accepts `x-request-id` for idempotency.
     */
    @Post('bet')
    async placeBet(
        @Body() dto: PlaceBetDto,
        @Headers('x-user-id') userId: string,
        @Headers('x-request-id') requestId?: string,
    ) {
        if (!userId) throw new BadRequestException('x-user-id header required');
        if (!dto.amountCents) throw new BadRequestException('amountCents is required');

        const amountCents = BigInt(dto.amountCents);
        const MIN = 100n;    // 1.00
        const MAX = 100000n; // 1000.00
        if (amountCents < MIN || amountCents > MAX) {
            throw new BadRequestException(`amountCents must be between ${MIN} and ${MAX}`);
        }

        const reqId = requestId ?? randomUUID();
        const bet = await this.gameService.placeBet(userId, amountCents, reqId);
        return {
            betId: bet.id,
            roundId: bet.roundId,
            amountCents: bet.amountCents.toString(),
        };
    }

    /** Cashes out the calling user's active bet at the current multiplier. */
    @Post('bet/cashout')
    async cashout(
        @Headers('x-user-id') userId: string,
        @Headers('x-request-id') requestId?: string,
    ) {
        if (!userId) throw new BadRequestException('x-user-id header required');
        const reqId = requestId ?? randomUUID();
        const bet = await this.gameService.cashout(userId, reqId);
        return {
            betId: bet.id,
            cashoutCents: bet.cashoutCents?.toString(),
            multiplierAtCashout: bet.multiplierAtCashout,
        };
    }

    /** Returns a paginated history of bets placed by the calling user. */
    @Get('bets/me')
    async myBets(
        @Headers('x-user-id') userId: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        if (!userId) throw new BadRequestException('x-user-id header required');
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
