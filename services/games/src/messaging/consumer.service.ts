import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitService } from './rabbit.service';
import { RoundRepository } from '../repositories/round.repository';
import { randomUUID } from 'crypto';

/** Consumes wallet saga reply events (WalletDebited, WalletCredited, WalletDebitFailed)
 *  from the domain.events exchange and reacts accordingly:
 *  — WalletDebited: marks the bet as wallet-confirmed so cashout is allowed;
 *    if the round already settled before confirmation, issues a refund credit.
 *  — WalletCredited: broadcasts balance_updated.
 *  — WalletDebitFailed: cancels the pending bet and notifies the player. */
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
        if (eventType === 'WalletDebited') {
            // Mark the bet as wallet-confirmed so cashout becomes possible.
            const confirmed = await this.roundRepo.confirmBetDebit(payload.requestId);

            if (confirmed) {
                // Check if the round already settled while waiting for confirmation.
                // If so, the bet was excluded from settleLosers (walletConfirmed was false).
                // The wallet WAS debited, so we must refund the player immediately.
                const round = await this.roundRepo.findById(confirmed.roundId);
                const betStillPending = round?.bets.find(
                    (b) => b.id === confirmed.betId && !b.cashedOutAt && !b.settledAt,
                );
                if (!betStillPending && round?.status === 'SETTLED') {
                    // Round ended before this bet was confirmed — issue a full refund.
                    const refundReqId = randomUUID();
                    await this.roundRepo.issueRefund(confirmed.betId, refundReqId, confirmed.amountCents);
                    this.logger.warn(
                        `Refund issued for bet ${confirmed.betId} (round settled before wallet confirmation). reqId=${refundReqId}`,
                    );
                }
            }

            this.gateway?.broadcast('balance_updated', {
                userId: payload.userId,
                amountCents: payload.amountCents,
                type: 'debit',
            });
            return;
        }

        if (eventType === 'WalletCredited') {
            this.gateway?.broadcast('balance_updated', {
                userId: payload.userId,
                amountCents: payload.amountCents,
                type: 'credit',
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
