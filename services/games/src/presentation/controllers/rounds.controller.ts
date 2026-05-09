import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoundRepository } from '../../repositories/round.repository';
import { GameService } from '../../application/game.service';
import { Round } from '../../domain/round';

/** Serializes a Round entity to a JSON-safe response object. */
function serializeRound(round: Round, includeServerSeed = false) {
    return {
        id: round.id,
        status: round.status,
        serverSeedHash: round.serverSeedHash,
        serverSeed: includeServerSeed ? round.serverSeed : undefined,
        crashPoint: round.status === 'SETTLED' || includeServerSeed ? round.crashPoint : undefined,
        startsAt: round.startsAt?.toISOString(),
        endsAt: round.endsAt?.toISOString(),
        bets: round.bets.map((b) => ({
            id: b.id,
            userId: b.userId,
            amountCents: b.amountCents.toString(),
            cashoutCents: b.cashoutCents?.toString(),
            multiplierAtCashout: b.multiplierAtCashout,
            cashedOutAt: b.cashedOutAt?.toISOString(),
        })),
    };
}

@ApiTags('Rounds')
@Controller('rounds')
export class RoundsController {
    constructor(
        private readonly roundRepo: RoundRepository,
        private readonly gameService: GameService,
    ) { }

    @ApiOperation({ summary: 'Get current round state and live multiplier' })
    @Get('current')
    async getCurrent() {
        const round = this.gameService.getCurrentRound();
        if (!round) return { status: 'idle', multiplier: 0 };
        return {
            ...serializeRound(round),
            multiplier: this.gameService.getCurrentMultiplier(),
        };
    }

    @ApiOperation({ summary: 'Paginated history of settled rounds' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @Get('history')
    async getHistory(@Query('page') page = '1', @Query('limit') limit = '20') {
        const { rounds, total } = await this.roundRepo.findHistory(Number(page), Number(limit));
        return {
            data: rounds.map((r) => serializeRound(r, true)),
            total,
            page: Number(page),
            limit: Number(limit),
        };
    }

    @ApiOperation({ summary: 'Verify provably fair seed and crash point for a settled round' })
    @Get(':roundId/verify')
    async verify(@Param('roundId') roundId: string) {
        const round = await this.roundRepo.findById(roundId);
        if (!round) throw new NotFoundException('round not found');
        if (round.status !== 'SETTLED') {
            return { roundId, status: round.status, message: 'round not yet settled — seed will be revealed after crash' };
        }
        return {
            roundId,
            serverSeed: round.serverSeed,
            serverSeedHash: round.serverSeedHash,
            crashPoint: round.crashPoint,
            howToVerify: 'HMAC-SHA256(serverSeed, "public") must equal serverSeedHash. Then compute crash point using the same algorithm.',
        };
    }
}
