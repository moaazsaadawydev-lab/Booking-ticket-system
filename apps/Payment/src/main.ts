import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('PaymentMicroservice');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const grpcUrl =
    configService.get<string>('PAYMENT_GRPC_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? '0.0.0.0:50054'
      : process.env.NODE_ENV === 'development'
        ? 'localhost:50054'
        : '0.0.0.0:50054');

  const mqUrl =
    configService.get<string>('MQ_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? 'amqp://admin:admin123@rabbitmq:5672'
      : 'amqp://guest:guest@localhost:5672');

  // 1. gRPC Transport
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'payment',
      protoPath: join(process.cwd(), 'libs/protos/Payment.proto'),
      url: grpcUrl,
      loader: {
        keepCase: true,
      },
    },
  });

  // 2. RabbitMQ Transport
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [mqUrl],
      queue: 'payment_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
    },
  });

  await app.startAllMicroservices();
  await app.init();

  logger.log(`🚀 Payment Microservice is listening on gRPC [${grpcUrl}]`);
  logger.log(`🐇 Payment Microservice is connected to RabbitMQ [${mqUrl}] queue: payment_queue`);
}

bootstrap();
