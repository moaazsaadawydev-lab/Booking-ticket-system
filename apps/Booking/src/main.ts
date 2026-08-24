import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const logger = new Logger('BookingMicroservice');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const mqUrl =
    configService.get<string>('MQ_URL') ||
    (process.env.NODE_ENV === 'docker-development'
      ? 'amqp://admin:admin123@rabbitmq:5672'
      : 'amqp://guest:guest@localhost:5672');

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

  logger.log(`🐇 Booking Microservice is connected to RabbitMQ [${mqUrl}] queue: booking_queue`);
  logger.log(`🚀 Booking Microservice initialized successfully`);
}

bootstrap();
