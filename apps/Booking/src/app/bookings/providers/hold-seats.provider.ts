import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { lastValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { CATALOG_SERVICE } from '@booking-ticket-system/Constants';
import { Booking, BookingSeat } from '@booking-ticket-system/Entities';
import { BookingStatus, SeatType } from '@booking-ticket-system/Utils';
import { SeatLockProvider } from './seat-lock.provider';
import { mapToBookingResponse } from '../utils/booking-mapper';

@Injectable()
export class HoldSeatsProvider implements OnModuleInit {
  private readonly logger = new Logger(HoldSeatsProvider.name);
  private showtimesService: any;
  private seatsService: any;

  constructor(
    @Inject(CATALOG_SERVICE) private readonly catalogClient: ClientGrpc,
    private readonly dataSource: DataSource,
    private readonly seatLockProvider: SeatLockProvider,
  ) {}

  onModuleInit() {
    this.showtimesService = this.catalogClient.getService('ShowtimesService');
    this.seatsService = this.catalogClient.getService('SeatsService');
  }

  async execute(userId: string, showtimeId: string, seatIds: string[]): Promise<any> {
    if (!userId) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'User authentication is required to hold seats',
      });
    }

    if (!showtimeId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'showtimeId is required',
      });
    }

    if (!seatIds || seatIds.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'At least one seatId must be selected',
      });
    }

    if (seatIds.length > 10) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Cannot hold more than 10 seats per transaction',
      });
    }

    // 1. Fetch showtime details from Catalog Service
    let showtime: any;
    try {
      showtime = await lastValueFrom(
        this.showtimesService.GetShowtimeById({ id: showtimeId }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to fetch showtime ${showtimeId}: ${err.message}`);
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${showtimeId}" was not found`,
      });
    }

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${showtimeId}" was not found`,
      });
    }

    const auditoriumId =
      showtime.auditorium_id || showtime.auditorium?.id;
    const cinemaId =
      showtime.cinema_id || showtime.cinema?.id;

    if (!auditoriumId || !cinemaId) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: 'Showtime is missing auditorium or cinema references',
      });
    }

    // 2. Fetch auditorium seat layout from Catalog Service
    let layoutResponse: any;
    try {
      layoutResponse = await lastValueFrom(
        this.seatsService.GetSeatsByAuditorium({ auditorium_id: auditoriumId }),
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch seat layout for auditorium ${auditoriumId}: ${err.message}`,
      );
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to retrieve auditorium seat layout',
      });
    }

    const availableSeats: any[] = layoutResponse?.seats || [];
    const seatMap = new Map<string, any>();
    for (const s of availableSeats) {
      seatMap.set(s.id, s);
    }

    // Verify all requested seatIds exist and are operational
    const pricings: any[] = showtime.seat_pricings || showtime.seatPricings || [];
    let totalAmount = 0;
    const resolvedSeats: {
      seatId: string;
      seatIdentifier: string;
      seatType: SeatType;
      unitPrice: number;
    }[] = [];

    for (const seatId of seatIds) {
      const seat = seatMap.get(seatId);
      if (!seat) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Seat with ID "${seatId}" does not exist in this auditorium`,
        });
      }

      if (seat.is_operational === false) {
        throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: `Seat "${seat.row_label}-${seat.seat_number}" is currently not operational`,
        });
      }

      const seatTypeStr = (seat.seat_type || 'REGULAR').toUpperCase();
      const customPricing = pricings.find(
        (p) => (p.seat_type || p.seatType)?.toUpperCase() === seatTypeStr,
      );

      const unitPrice = customPricing
        ? Number(customPricing.price)
        : Number(showtime.base_price || showtime.basePrice || 0);

      totalAmount += unitPrice;

      resolvedSeats.push({
        seatId,
        seatIdentifier: `${seat.row_label}-${seat.seat_number}`,
        seatType: seatTypeStr as SeatType,
        unitPrice,
      });
    }

    // 3. Database transaction: Check active seat overlap and persist hold
    const holdDurationSeconds = 600; // 10 minutes
    const holdExpiresAt = new Date(Date.now() + holdDurationSeconds * 1000);
    const bookingReference = 'BK-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    const savedBooking = await this.dataSource.transaction(async (manager) => {
      // Locking & Conflict Check
      await this.seatLockProvider.checkAndLockSeats(
        showtimeId,
        seatIds,
        manager,
      );

      const bookingEntity = manager.create(Booking, {
        bookingReference,
        userId,
        showtimeId,
        cinemaId,
        auditoriumId,
        totalAmount,
        currency: 'EGP',
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt,
      });

      const persistedBooking = await manager.save(Booking, bookingEntity);

      const bookingSeatsEntities = resolvedSeats.map((rs) =>
        manager.create(BookingSeat, {
          bookingId: persistedBooking.id,
          seatId: rs.seatId,
          seatIdentifier: rs.seatIdentifier,
          seatType: rs.seatType,
          unitPrice: rs.unitPrice,
        }),
      );

      persistedBooking.seats = await manager.save(
        BookingSeat,
        bookingSeatsEntities,
      );
      persistedBooking.tickets = [];

      return persistedBooking;
    });

    return {
      booking: mapToBookingResponse(savedBooking),
      hold_duration_seconds: holdDurationSeconds,
      holdDurationSeconds,
    };
  }
}
