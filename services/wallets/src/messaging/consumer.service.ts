import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WalletRepository } from '../repositories/wallet.repository';

const defaultAmqp = require('amqplib');

@Injectable()
export class WalletConsumer implements OnModuleInit, OnModuleDestroy {
  private conn?: any;
  private channel?: any;
  private readonly logger = new Logger(WalletConsumer.name);
  private amqpClient: any;

  constructor(private readonly repo: WalletRepository, amqpClient?: any) {
    this.amqpClient = amqpClient ?? defaultAmqp;
  }

  async onModuleInit() {
    const amqpUrl = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    this.conn = await this.amqpClient.connect(amqpUrl);
    this.channel = await this.conn.createChannel();

    await this.channel.assertExchange('domain.events', 'topic', { durable: true });
    const q = 'wallets.events';
    await this.channel.assertQueue(q, { durable: true });
    await this.channel.bindQueue(q, 'domain.events', 'WalletDebitRequested');
    await this.channel.bindQueue(q, 'domain.events', 'WalletCreditRequested');
    await this.channel.prefetch(5);

    await this.channel.consume(q, async (msg: any) => {
      if (!msg) return;
      try {
        const raw = JSON.parse(msg.content.toString());
        const eventType = msg.fields?.routingKey ?? raw.eventType;
        const payload = raw.payload ?? raw;

        await this.handleEvent(eventType, payload);
        this.channel.ack(msg);
      } catch (err) {
        this.logger.error('Error processing message', err as any);
        try {
          this.channel.nack(msg, false, false);
        } catch {
          try { this.channel.ack(msg); } catch {}
        }
      }
    }, { noAck: false });

    this.logger.log('WalletConsumer started and consuming');
  }

  async handleEvent(eventType: string, payload: any): Promise<{ handled: boolean; alreadyProcessed?: boolean; wallet?: any }> {
    if (eventType === 'WalletDebitRequested') {
      const { requestId, userId, amountCents } = payload;
      const res = await this.repo.debitWithProcessedRequest(requestId, userId, BigInt(amountCents));
      this.logger.log(`Processed debit ${requestId} alreadyProcessed=${res.alreadyProcessed}`);
      return { handled: true, alreadyProcessed: res.alreadyProcessed, wallet: res.wallet };
    }

    if (eventType === 'WalletCreditRequested') {
      const { requestId, userId, amountCents } = payload;
      const res = await this.repo.creditWithProcessedRequest(requestId, userId, BigInt(amountCents));
      this.logger.log(`Processed credit ${requestId} alreadyProcessed=${res.alreadyProcessed}`);
      return { handled: true, alreadyProcessed: res.alreadyProcessed, wallet: res.wallet };
    }

    this.logger.warn(`Unhandled event ${eventType}`);
    return { handled: false };
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.conn?.close();
    } catch (err) {
      this.logger.error('Error closing consumer', err as any);
    }
  }
}
