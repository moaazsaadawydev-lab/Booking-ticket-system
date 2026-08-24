import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Booking,
  BookingSeat,
  Ticket,
  BookingOutbox,
} from '@booking-ticket-system/Entities';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RedisModule } from '@booking-ticket-system/Redis';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env['NODE_ENV'] || 'development'}`,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT')!,
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database:
          config.get<string>('BOOKING_DATABASE_NAME') || 'Booking-Bookings',
        entities: [
          Booking,
          BookingSeat,
          Ticket,
          BookingOutbox,
        ],
        synchronize: process.env['NODE_ENV'] !== 'production',
        migrationsRun: process.env['NODE_ENV'] === 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
    TypeOrmModule.forFeature([
      Booking,
      BookingSeat,
      Ticket,
      BookingOutbox,
    ]),
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
