import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitService } from './rabbit.service';
import { RoundRepository } from '../repositories/round.repository';

/** Consumes wallet saga reply events (WalletDebited, WalletCredited, WalletDebitFailed)
 *  from the domain.events exchange and reacts accordingly:
 *  — success events broadcast balance_updated via WebSocket;
 *  — failure events cancel the pending bet and notify the player. */
@Injectable()
export class WalletEventConsumer implements OnModuleInit {
    private readonly logger = new Logger(WalletEventConsumer.name);
    private gateway: any; // injected lazily to avoid circular dep

    constructor(
        private readonly rabbit: RabbitService,
        private readonly roundRepo: RoundRepository,
    ) { }

    /**
     * Injects the WebSocket gateway reference after initialization
     * to avoid a circular dependency.
     */
    setGateway(gateway: any) {
        this.gateway = gateway;
    }

    /** Subscribes to wallet saga reply events from RabbitMQ. */
    async onModuleInit() {
        await this.rabbit.waitForConnection();
        await this.rabbit.consume(
            'games.wallet-events',
            ['WalletDebited', 'WalletCredited', 'WalletDebitFailed'],
            async (eventType, payload) => this.handleEvent(eventType, payload),
        );
        this.logger.log('WalletEventConsumer started');
    }

    /** Routes an incoming wallet event: broadcasts balance updates or cancels a failed bet. */
    async handleEvent(eventType: string, payload: any) {
        if (eventType === 'WalletDebited' || eventType === 'WalletCredited') {
            this.gateway?.broadcast('balance_updated', {
                userId: payload.userId,
                amountCents: payload.amountCents,
                type: eventType === 'WalletDebited' ? 'debit' : 'credit',
            });
            return;
        }

        if (eventType === 'WalletDebitFailed') {
            // Roll back the pending bet and notify the player.
            await this.roundRepo.cancelBet(payload.requestId);
            this.gateway?.broadcast('bet_rejected', {
                requestId: payload.requestId,
                userId: payload.userId,
                reason: payload.reason,
            });
            this.logger.warn(`Bet cancelled for request ${payload.requestId}: ${payload.reason}`);
        }
    }
}
