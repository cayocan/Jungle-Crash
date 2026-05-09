import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;
  await app.listen(port, '0.0.0.0');
  console.log(`Games service running on port ${port}`);
}

bootstrap();
