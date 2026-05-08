import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RabbitService } from './rabbit.service';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly prisma = new PrismaClient();
  private running = false;
  private intervalHandle?: NodeJS.Timeout;

  constructor(private readonly rabbit: RabbitService) {}

  async onModuleInit() {
    await this.rabbit.connect();
    this.running = true;
    // poll every 2 seconds
    this.intervalHandle = setInterval(() => this.processBatch().catch((e) => this.logger.error(e)), 2000);
    this.logger.log('OutboxPublisher started');
  }

  private async processBatch() {
    if (!this.running) return;
    const batch = await this.prisma.outboxEvent.findMany({
      where: { published: false, attempts: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const ev of batch) {
      try {
        const payload = { id: ev.id, aggregateId: ev.aggregateId, eventType: ev.eventType, payload: ev.payload };
        await this.rabbit.publish(ev.eventType, payload);
        await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { published: true, publishedAt: new Date(), attempts: ev.attempts + 1 } });
        this.logger.log(`Published outbox event ${ev.id} (${ev.eventType})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await this.prisma.outboxEvent.update({ where: { id: ev.id }, data: { attempts: ev.attempts + 1, lastError: message } });
        this.logger.warn(`Failed publishing outbox ${ev.id}: ${message}`);
      }
    }
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    try {
      await this.prisma.$disconnect();
    } catch {}
  }
}
