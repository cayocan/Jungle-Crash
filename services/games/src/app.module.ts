import { Module } from '@nestjs/common';
import { PrismaClient } from '../node_modules/.prisma/client';
import { GamesController } from './presentation/controllers/games.controller';
import { RoundsController } from './presentation/controllers/rounds.controller';
import { BetController } from './presentation/controllers/bet.controller';
import { LeaderboardController } from './presentation/controllers/leaderboard.controller';
import { GameGateway } from './presentation/gateways/game.gateway';
import { RoundRepository } from './repositories/round.repository';
import { RabbitService } from './messaging/rabbit.service';
import { OutboxPublisher } from './messaging/outbox.publisher';
import { WalletEventConsumer } from './messaging/consumer.service';
import { GameService } from './application/game.service';

@Module({
  controllers: [GamesController, RoundsController, BetController, LeaderboardController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    RoundRepository,
    RabbitService,
    OutboxPublisher,
    WalletEventConsumer,
    GameService,
    GameGateway,
  ],
})
export class AppModule { }
