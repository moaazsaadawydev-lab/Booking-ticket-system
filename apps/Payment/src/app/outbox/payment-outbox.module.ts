import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  BOOKING_SERVICE,
  NOTIFICATION_SERVICE,
} from '@booking-ticket-system/Constants';
import { PaymentOutbox } from '@booking-ticket-system/Entities';
import { PaymentOutboxPublisherService } from './payment-outbox-publisher.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env['NODE_ENV'] || 'development'}`,
    }),
    TypeOrmModule.forFeature([PaymentOutbox]),
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: BOOKING_SERVICE,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('MQ_URL') ||
                (process.env['NODE_ENV'] === 'docker-development'
                  ? 'amqp://admin:admin123@rabbitmq:5672'
                  : 'amqp://guest:guest@localhost:5672'),
            ],
            queue: 'booking_queue',
            queueOptions: { durable: true },
          },
        }),
      },
      {
        name: NOTIFICATION_SERVICE,
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('MQ_URL') ||
                (process.env['NODE_ENV'] === 'docker-development'
                  ? 'amqp://admin:admin123@rabbitmq:5672'
                  : 'amqp://guest:guest@localhost:5672'),
            ],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [PaymentOutboxPublisherService],
  exports: [PaymentOutboxPublisherService],
})
export class PaymentOutboxModule {}
