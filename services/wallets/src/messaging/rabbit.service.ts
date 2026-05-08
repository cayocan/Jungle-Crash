import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
const amqp: any = require('amqplib');

@Injectable()
export class RabbitService implements OnModuleDestroy {
  private conn?: any;
  private channel?: any;
  private readonly logger = new Logger(RabbitService.name);

  async connect(url?: string) {
    const amqpUrl = url ?? process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    this.conn = await amqp.connect(amqpUrl);
    // use a confirm channel for publish confirmations
    this.channel = await this.conn.createConfirmChannel();
    await this.channel.assertExchange('domain.events', 'topic', { durable: true });
    this.logger.log(`Connected to RabbitMQ ${amqpUrl}`);
  }

  async publish(eventType: string, payload: any): Promise<void> {
    if (!this.channel) throw new Error('Rabbit channel not initialized');
    const content = Buffer.from(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
        this.channel!.publish('domain.events', eventType, content, { persistent: true }, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
    });
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.conn?.close();
    } catch (err) {
      this.logger.error('Error closing Rabbit connection', err as any);
    }
  }
}
