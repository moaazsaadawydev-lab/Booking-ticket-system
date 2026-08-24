import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('BookingMicroservice');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const grpcUrl =
    configService.get<string>('BOOKING_GRPC_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? '0.0.0.0:50053'
      : process.env.NODE_ENV === 'development'
        ? 'localhost:50053'
        : '0.0.0.0:50053');

  const mqUrl =
    configService.get<string>('MQ_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? 'amqp://admin:admin123@rabbitmq:5672'
      : 'amqp://guest:guest@localhost:5672');

  // 1. gRPC Transport
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'booking',
      protoPath: join(process.cwd(), 'libs/protos/Booking.proto'),
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
      queue: 'booking_queue',
      queueOptions: {
        durable: true,
      },
      noAck: false,
    },
  });

  await app.startAllMicroservices();
  await app.init();

  logger.log(`🚀 Booking Microservice is listening on gRPC [${grpcUrl}]`);
  logger.log(`🐇 Booking Microservice is connected to RabbitMQ [${mqUrl}] queue: booking_queue`);
}

bootstrap();
