import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '../../node_modules/.prisma/client';
import { RabbitService } from './rabbit.service';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OutboxPublisher.name);
    private readonly prisma: PrismaClient;
    private running = false;
    private intervalHandle?: NodeJS.Timeout;

    constructor(private readonly rabbit: RabbitService, @Optional() prisma?: PrismaClient) {
        this.prisma = prisma ?? new PrismaClient();
    }

    /** Starts the polling interval that publishes pending outbox events every 2 seconds. */
    async onModuleInit() {
        this.running = true;
        this.intervalHandle = setInterval(() => this.processBatch().catch((e) => this.logger.error(e)), 2000);
        this.logger.log('OutboxPublisher started');
    }

    /**
     * Fetches up to 10 unpublished outbox events and attempts to publish each one
     * to RabbitMQ. Updates the record's status on success or increments the retry
     * counter on failure (max 5 attempts).
     */
    async processBatch() {
        if (!this.running) return;
        const batch = await this.prisma.outboxEvent.findMany({
            where: { published: false, attempts: { lt: 5 } },
            orderBy: { createdAt: 'asc' },
            take: 10,
        });

        for (const ev of batch) {
            try {
                await this.rabbit.publish(ev.eventType, ev.payload);
                await this.prisma.outboxEvent.update({
                    where: { id: ev.id },
                    data: { published: true, publishedAt: new Date(), attempts: ev.attempts + 1 },
                });
                this.logger.log(`Published outbox event ${ev.id} (${ev.eventType})`);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                await this.prisma.outboxEvent.update({
                    where: { id: ev.id },
                    data: { lastError: message, attempts: ev.attempts + 1 },
                });
                this.logger.error(`Failed publishing outbox ${ev.id}: ${message}`);
            }
        }
    }

    /** Stops the polling interval and disconnects Prisma when the module is torn down. */
    async onModuleDestroy() {
        this.running = false;
        if (this.intervalHandle) clearInterval(this.intervalHandle);
        try { await this.prisma.$disconnect(); } catch { }
    }
}
