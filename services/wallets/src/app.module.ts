import { Module } from "@nestjs/common";
import { PrismaClient } from '@prisma/client';
import { WalletsController } from "./presentation/controllers/wallets.controller";
import { WalletController } from "./presentation/controllers/wallet.controller";
import { WalletRepository } from "./repositories/wallet.repository";
import { RabbitService } from "./messaging/rabbit.service";
import { OutboxPublisher } from "./messaging/outbox.publisher";
import { OutboxDlqHandler } from "./messaging/outbox.dlq";
import { WalletConsumer } from "./messaging/consumer.service";

@Module({
  controllers: [WalletsController, WalletController],
  providers: [
    // PrismaClient provider for Nest DI
    {
      provide: PrismaClient,
      useFactory: () => {
        const p = new PrismaClient();
        // do not await connect here to keep startup fast; providers can call $connect if needed
        return p;
      },
    },
    WalletRepository,
    RabbitService,
    OutboxPublisher,
    OutboxDlqHandler,
    WalletConsumer,
  ],
})
export class AppModule {}
