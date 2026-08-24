import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NOTIFICATION_SERVICE } from '@booking-ticket-system/Constants';
import { BookingOutbox } from '@booking-ticket-system/Entities';
import { BookingOutboxPublisherService } from './booking-outbox-publisher.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env['NODE_ENV'] || 'development'}`,
    }),
    TypeOrmModule.forFeature([BookingOutbox]),
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
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
  providers: [BookingOutboxPublisherService],
  exports: [BookingOutboxPublisherService],
})
export class OutboxModule {}
