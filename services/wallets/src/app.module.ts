import { Module } from "@nestjs/common";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import { WalletController } from "./presentation/controllers/wallet.controller";
import { WalletRepository } from "./repositories/wallet.repository";

@Module({
  controllers: [WalletsController, WalletController],
  providers: [WalletRepository],
})
export class AppModule {}
