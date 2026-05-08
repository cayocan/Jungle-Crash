/// <reference types="bun-types" />

import amqp from 'amqplib';
import { PrismaClient } from '@prisma/client';

describe('Wallets e2e', () => {
  it('processa WalletDebitRequested pelo RabbitMQ e atualiza saldo', async () => {
    const prisma = new PrismaClient();
    const amqpUrl = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';
    const conn = await amqp.connect(amqpUrl);
    const ch = await conn.createConfirmChannel();
    const exchange = 'domain.events';

    const userId = 'e2e-user-' + Date.now();
    // criar carteira inicial com 10000 cents
    await prisma.wallet.create({ data: { userId, balance: BigInt(10000), currency: 'BRL' } });

    const requestId = 'e2e-' + Date.now();
    const envelope = {
      eventId: 'evt-' + requestId,
      eventType: 'WalletDebitRequested',
      timestamp: new Date().toISOString(),
      payload: { requestId, userId, amountCents: '2500' },
    };

    await ch.assertExchange(exchange, 'topic', { durable: true });
    await new Promise<void>((resolve, reject) => {
      ch.publish(exchange, 'WalletDebitRequested', Buffer.from(JSON.stringify(envelope)), { persistent: true }, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // aguardar até 15s verificando DB
    let ok = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const w = await prisma.wallet.findUnique({ where: { userId } });
      const pr = await prisma.processedRequest.findUnique({ where: { requestId } });
      if (pr && w && w.balance.toString() === (BigInt(10000) - BigInt(2500)).toString()) {
        ok = true;
        break;
      }
    }

    await ch.close();
    await conn.close();
    await prisma.$disconnect();

    expect(ok).toBe(true);
  }, 20000);
});
