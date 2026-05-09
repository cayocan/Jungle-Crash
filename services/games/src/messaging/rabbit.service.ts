import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

const amqp: any = require('amqplib');

@Injectable()
export class RabbitService implements OnModuleInit, OnModuleDestroy {
    private conn?: any;
    private channel?: any;
    private readonly logger = new Logger(RabbitService.name);
    private connectionReady!: Promise<void>;
    private resolveConnection!: () => void;

    constructor() {
        this.connectionReady = new Promise<void>((resolve) => {
            this.resolveConnection = resolve;
        });
    }

    async onModuleInit(): Promise<void> {
        await this.connect();
    }

    /** Returns a promise that resolves once the RabbitMQ channel is ready. */
    waitForConnection(): Promise<void> {
        return this.connectionReady;
    }

    /**
     * Opens a connection and a confirm channel to the RabbitMQ broker,
     * and asserts the `domain.events` topic exchange.
     */
    async connect(url?: string): Promise<void> {
        const amqpUrl = url ?? process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
        this.conn = await amqp.connect(amqpUrl);
        this.channel = await this.conn.createConfirmChannel();
        await this.channel.assertExchange('domain.events', 'topic', { durable: true });
        this.logger.log(`Connected to RabbitMQ ${amqpUrl}`);
        this.resolveConnection();
    }

    /**
     * Publishes a message to the `domain.events` exchange using the event type as routing key.
     *
     * @throws {Error} If the channel is not yet initialized.
     */
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

    /**
     * Binds a durable queue to the exchange for the given routing keys and starts
     * consuming messages, delegating each to the provided handler.
     * Messages are ack'd on success and nack'd (dead-lettered) on failure.
     *
     * @throws {Error} If the channel is not yet initialized.
     */
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
                try { this.channel.nack(msg, false, false); } catch { try { this.channel.ack(msg); } catch { } }
            }
        }, { noAck: false });
    }

    /** Gracefully closes the channel and connection when the module is torn down. */
    async onModuleDestroy() {
        try { await this.channel?.close(); } catch { }
        try { await this.conn?.close(); } catch { }
    }
}
