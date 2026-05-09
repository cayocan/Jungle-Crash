import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameService } from '../../application/game.service';
import { WalletEventConsumer } from '../../messaging/consumer.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameService: GameService,
    private readonly walletConsumer: WalletEventConsumer,
  ) {}

  afterInit() {
    // Registra o gateway nos serviços que precisam emitir eventos
    this.gameService.setGateway(this);
    this.walletConsumer.setGateway(this);
    this.logger.log('GameGateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Envia estado atual da rodada ao conectar
    const round = this.gameService.getCurrentRound();
    if (round) {
      client.emit('current_state', {
        roundId: round.id,
        status: round.status,
        multiplier: this.gameService.getCurrentMultiplier(),
        serverSeedHash: round.serverSeedHash,
      });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcast(event: string, payload: any) {
    this.server?.emit(event, payload);
  }
}
