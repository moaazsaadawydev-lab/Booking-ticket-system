import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('CatalogMicroservice');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const grpcUrl =
    configService.get<string>('CATALOG_GRPC_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? '0.0.0.0:50052'
      : process.env.NODE_ENV === 'development'
        ? 'localhost:50052'
        : '0.0.0.0:50052');

  const mqUrl =
    configService.get<string>('MQ_URL') || 'amqp://guest:guest@localhost:5672';

  // 1. gRPC Transport
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'catalog',
      protoPath: join(process.cwd(), 'libs/protos/Catalog.proto'),
      url: grpcUrl,
      loader: {
        keepCase: true,
      },
    },
  });

  // 2. RabbitMQ Transport (with Manual Ack)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [mqUrl],
      queue: 'catalog_events_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false, // Strict requirement: manual acknowledgment
    },
  });

  await app.startAllMicroservices();
  await app.init();
  logger.log(`🚀 Catalog Microservice is listening on gRPC [${grpcUrl}]`);
  logger.log(`🐇 Catalog Microservice is connected to RabbitMQ [${mqUrl}] queue: catalog_events_queue`);
}

bootstrap();
