import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Booking, BookingSeat } from '@booking-ticket-system/Entities';
import { BookingStatus } from '@booking-ticket-system/Utils';

export interface ISeatLockProvider {
  checkAndLockSeats(
    showtimeId: string,
    seatIds: string[],
    manager: EntityManager,
  ): Promise<boolean>;
}

@Injectable()
export class SeatLockProvider implements ISeatLockProvider {
  private readonly logger = new Logger(SeatLockProvider.name);

  /**
   * Baseline PostgreSQL reservation check for active overlapping seats.
   * Extensible: Can be seamlessly wrapped or replaced with Redis Distributed Locks / Lua Scripts.
   */
  async checkAndLockSeats(
    showtimeId: string,
    seatIds: string[],
    manager: EntityManager,
  ): Promise<boolean> {
    if (!seatIds || seatIds.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'At least one seatId must be provided',
      });
    }

    const activeBookingsQuery = manager
      .createQueryBuilder(BookingSeat, 'bs')
      .innerJoin('bs.booking', 'b')
      .where('b.showtime_id = :showtimeId', { showtimeId })
      .andWhere('bs.seat_id IN (:...seatIds)', { seatIds })
      .andWhere(
        '(b.status = :confirmedStatus OR (b.status = :pendingStatus AND b.hold_expires_at > :now))',
        {
          confirmedStatus: BookingStatus.CONFIRMED,
          pendingStatus: BookingStatus.PENDING_PAYMENT,
          now: new Date(),
        },
      );

    const conflictingSeats = await activeBookingsQuery.getMany();

    if (conflictingSeats.length > 0) {
      const takenSeatIds = conflictingSeats.map((s) => s.seatId).join(', ');
      this.logger.warn(
        `Seat lock conflict: seats [${takenSeatIds}] are already reserved for showtime ${showtimeId}`,
      );
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: `One or more selected seats (${takenSeatIds}) are already reserved or on hold.`,
      });
    }

    return true;
  }
}
