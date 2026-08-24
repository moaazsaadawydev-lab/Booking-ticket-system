import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { CATALOG_SERVICE } from '@booking-ticket-system/Constants';
import {
  Booking,
  BookingSeat,
  Ticket,
  BookingOutbox,
} from '@booking-ticket-system/Entities';
import { BookingsController } from './bookings.controller';
import {
  SeatLockProvider,
  HoldSeatsProvider,
  ConfirmBookingProvider,
  CancelBookingProvider,
  GetBookingProvider,
} from './providers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingSeat,
      Ticket,
      BookingOutbox,
    ]),
    ClientsModule.registerAsync([
      {
        name: CATALOG_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'catalog',
            protoPath: join(process.cwd(), 'libs/protos/Catalog.proto'),
            url:
              process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('CATALOG_GRPC_DEV_DOC_URL')
                : process.env.NODE_ENV === 'development'
                  ? config.get<string>('CATALOG_GRPC_DEV_URL')
                  : config.get<string>('CATALOG_GRPC_DEV_DOC_URL'),
            loader: {
              keepCase: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [BookingsController],
  providers: [
    SeatLockProvider,
    HoldSeatsProvider,
    ConfirmBookingProvider,
    CancelBookingProvider,
    GetBookingProvider,
  ],
  exports: [
    SeatLockProvider,
    HoldSeatsProvider,
    ConfirmBookingProvider,
    CancelBookingProvider,
    GetBookingProvider,
  ],
})
export class BookingsModule {}
