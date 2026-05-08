import { Module } from "@nestjs/common";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import { WalletController } from "./presentation/controllers/wallet.controller";
import { WalletRepository } from "./repositories/wallet.repository";
import { RabbitService } from "./messaging/rabbit.service";
import { OutboxPublisher } from "./messaging/outbox.publisher";

@Module({
  controllers: [WalletsController, WalletController],
  providers: [WalletRepository, RabbitService, OutboxPublisher],
})
export class AppModule {}
