import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GamesController } from './presentation/controllers/games.controller';
import { RoundsController } from './presentation/controllers/rounds.controller';
import { BetController } from './presentation/controllers/bet.controller';
import { GameGateway } from './presentation/gateways/game.gateway';
import { RoundRepository } from './repositories/round.repository';
import { RabbitService } from './messaging/rabbit.service';
import { OutboxPublisher } from './messaging/outbox.publisher';
import { WalletEventConsumer } from './messaging/consumer.service';
import { GameService } from './application/game.service';

@Module({
  controllers: [GamesController, RoundsController, BetController],
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
