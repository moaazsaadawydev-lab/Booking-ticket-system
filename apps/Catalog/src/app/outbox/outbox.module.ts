import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OutboxMessage } from '@booking-ticket-system/Entities';
import { OutboxPublisherService } from './outbox-publisher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forFeature([OutboxMessage]),
    ScheduleModule.forRoot(),
    ClientsModule.registerAsync([
      {
        name: 'MEDIA_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('MQ_URL') || 'amqp://guest:guest@localhost:5672'],
            queue: 'media_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  providers: [OutboxPublisherService],
  exports: [OutboxPublisherService],
})
export class OutboxModule {}
