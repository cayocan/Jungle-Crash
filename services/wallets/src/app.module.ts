import { Module } from "@nestjs/common";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import { WalletController } from "./presentation/controllers/wallet.controller";
import { WalletRepository } from "./repositories/wallet.repository";
import { RabbitService } from "./messaging/rabbit.service";
import { OutboxPublisher } from "./messaging/outbox.publisher";
import { OutboxDlqHandler } from "./messaging/outbox.dlq";
import { WalletConsumer } from "./messaging/consumer.service";

@Module({
  controllers: [WalletsController, WalletController],
  providers: [WalletRepository, RabbitService, OutboxPublisher, OutboxDlqHandler, WalletConsumer],
})
export class AppModule {}
