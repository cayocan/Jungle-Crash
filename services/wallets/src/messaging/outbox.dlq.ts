import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RabbitService } from './rabbit.service';

@Injectable()
export class OutboxDlqHandler implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OutboxDlqHandler.name);
    private readonly prisma: PrismaClient;
    private running = false;
    private handle?: NodeJS.Timeout;

    constructor(private readonly rabbit: RabbitService, @Optional() prisma?: PrismaClient) {
        this.prisma = prisma ?? new PrismaClient();
    }

    async onModuleInit() {
        this.running = true;
        // check DLQ candidates every 10s
        this.handle = setInterval(() => this.processDlq().catch((e) => this.logger.error(e)), 10000);
        this.logger.log('OutboxDlqHandler started');
    }

    private async processDlq() {
        if (!this.running) return;
        const candidates = await this.prisma.outboxEvent.findMany({ where: { published: false, attempts: { gte: 5 } }, take: 20 });
        for (const ev of candidates) {
            try {
                const payload = { id: ev.id, aggregateId: ev.aggregateId, eventType: ev.eventType, payload: ev.payload, attempts: ev.attempts };
                await this.rabbit.publish('domain.events.dlq', payload);
                await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { published: true, publishedAt: new Date() } });
                this.logger.warn(`Moved outbox ${ev.id} to DLQ`);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { lastError: message, attempts: ev.attempts + 1 } });
                this.logger.error(`Failed moving outbox ${ev.id} to DLQ: ${message}`);
            }
        }
    }

    async onModuleDestroy() {
        this.running = false;
        if (this.handle) clearInterval(this.handle);
        try {
            await this.prisma.$disconnect();
        } catch { }
    }
}
