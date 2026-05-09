import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4002;

  const config = new DocumentBuilder()
    .setTitle('Wallets Service')
    .setDescription('Crash Game — player wallet management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(port, '0.0.0.0');
  console.log(`Wallets service running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
