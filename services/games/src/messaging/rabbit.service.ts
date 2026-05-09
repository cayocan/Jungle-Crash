import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';

const amqp: any = require('amqplib');

@Injectable()
export class RabbitService implements OnModuleDestroy {
  private conn?: any;
  private channel?: any;
  private readonly logger = new Logger(RabbitService.name);

  async connect(url?: string): Promise<void> {
    const amqpUrl = url ?? process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    this.conn = await amqp.connect(amqpUrl);
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

  async consume(queue: string, routingKeys: string[], handler: (eventType: string, payload: any) => Promise<void>): Promise<void> {
    if (!this.channel) throw new Error('Rabbit channel not initialized');
    await this.channel.assertQueue(queue, { durable: true });
    for (const key of routingKeys) {
      await this.channel.bindQueue(queue, 'domain.events', key);
    }
    await this.channel.prefetch(5);
    await this.channel.consume(queue, async (msg: any) => {
      if (!msg) return;
      try {
        const raw = JSON.parse(msg.content.toString());
        const eventType = msg.fields?.routingKey ?? raw.eventType;
        const payload = raw.payload ?? raw;
        await handler(eventType, payload);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error('Error processing message', err);
        try { this.channel.nack(msg, false, false); } catch { try { this.channel.ack(msg); } catch {} }
      }
    }, { noAck: false });
  }

  async onModuleDestroy() {
    try { await this.channel?.close(); } catch {}
    try { await this.conn?.close(); } catch {}
  }
}
