import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitService } from './rabbit.service';

/** Consumes WalletDebited and WalletCredited events from wallets service.
 *  Broadcasts balance_updated via WebSocket so the frontend can update the UI. */
@Injectable()
export class WalletEventConsumer implements OnModuleInit {
    private readonly logger = new Logger(WalletEventConsumer.name);
    private gateway: any; // injected lazily to avoid circular dep

    constructor(private readonly rabbit: RabbitService) { }

    /**
     * Injects the WebSocket gateway reference after initialization
     * to avoid a circular dependency.
     */
    setGateway(gateway: any) {
        this.gateway = gateway;
    }

    /** Subscribes to WalletDebited and WalletCredited events from RabbitMQ. */
    async onModuleInit() {
        await this.rabbit.consume(
            'games.wallet-events',
            ['WalletDebited', 'WalletCredited'],
            async (eventType, payload) => this.handleEvent(eventType, payload),
        );
        this.logger.log('WalletEventConsumer started');
    }

    /** Routes an incoming wallet event and broadcasts a balance update via WebSocket. */
    private async handleEvent(eventType: string, payload: any) {
        if (eventType === 'WalletDebited' || eventType === 'WalletCredited') {
            this.gateway?.broadcast('balance_updated', {
                userId: payload.userId,
                amountCents: payload.amountCents,
                type: eventType === 'WalletDebited' ? 'debit' : 'credit',
            });
        }
    }
}
