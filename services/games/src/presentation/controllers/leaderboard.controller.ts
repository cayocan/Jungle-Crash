import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RoundRepository } from '../../repositories/round.repository';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
    constructor(private readonly roundRepo: RoundRepository) { }

    /**
     * Returns top players ranked by best gain (highest cashout) for a given period.
     * Period defaults to 24h; supported values: 24, 168 (7d).
     */
    @ApiOperation({ summary: 'Top players by best gain for a period (24h or 168h)' })
    @ApiQuery({ name: 'period', required: false, description: 'Period in hours: 24 (default) or 168' })
    @ApiQuery({ name: 'limit', required: false, description: 'Max entries (default 10, max 50)' })
    @Get()
    async getLeaderboard(
        @Query('period') period = '24',
        @Query('limit') limit = '10',
    ) {
        const periodHours = Number(period) === 168 ? 168 : 24;
        const top = Math.min(Number(limit) || 10, 50);
        const entries = await this.roundRepo.getLeaderboard(top, periodHours);
        return {
            period: periodHours === 168 ? '7d' : '24h',
            updatedAt: new Date().toISOString(),
            data: entries.map((e, i) => ({
                rank: i + 1,
                userId: e.userId,
                bestGainCents: e.bestGainCents.toString(),
                bestAmountCents: e.bestAmountCents.toString(),
                bestCashoutCents: e.bestCashoutCents.toString(),
                bestMultiplier: e.bestMultiplier,
            })),
        };
    }
}
