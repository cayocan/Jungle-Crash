import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4001;

  const config = new DocumentBuilder()
    .setTitle('Games Service')
    .setDescription('Crash Game — rounds, bets and provably fair verification')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(port, '0.0.0.0');
  console.log(`Games service running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
