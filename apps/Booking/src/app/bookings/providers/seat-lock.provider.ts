import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { RedisService } from '@booking-ticket-system/Redis';
import { BookingSeat } from '@booking-ticket-system/Entities';
import { BookingStatus } from '@booking-ticket-system/Utils';

export const SEAT_LOCK_LUA_SCRIPT = `
for i, key in ipairs(KEYS) do
    if redis.call('EXISTS', key) == 1 then
        return { 0, key }
    end
end

for i, key in ipairs(KEYS) do
    redis.call('SET', key, ARGV[1], 'EX', tonumber(ARGV[2]))
end

return { 1, 'OK' }
`;

export interface ISeatLockProvider {
  acquireLock(
    showtimeId: string,
    seatIds: string[],
    userId: string,
    ttlSeconds?: number,
  ): Promise<{ success: boolean; keys: string[] }>;
  releaseLock(showtimeId: string, seatIds: string[]): Promise<number>;
  checkDatabaseOverlap(
    showtimeId: string,
    seatIds: string[],
    manager: EntityManager,
  ): Promise<boolean>;
}

@Injectable()
export class SeatLockProvider implements ISeatLockProvider {
  private readonly logger = new Logger(SeatLockProvider.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Acquire atomic distributed locks in Redis for all requested seats.
   * All-or-nothing: if any seat is already locked, none are acquired and 409/ALREADY_EXISTS is thrown.
   */
  async acquireLock(
    showtimeId: string,
    seatIds: string[],
    userId: string,
    ttlSeconds = 600,
  ): Promise<{ success: boolean; keys: string[] }> {
    if (!seatIds || seatIds.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'At least one seatId must be provided',
      });
    }

    const keys = seatIds.map((id) => `booking:lock:${showtimeId}:${id}`);
    const redis = this.redisService.getClient();

    try {
      const result: [number, string] = (await redis.eval(
        SEAT_LOCK_LUA_SCRIPT,
        keys.length,
        ...keys,
        userId,
        ttlSeconds,
      )) as any;

      if (!result || result[0] === 0) {
        const conflictingKey = result ? result[1] : 'unknown';
        const conflictingSeatId = conflictingKey.split(':').pop() || conflictingKey;

        this.logger.warn(
          `Redis seat lock collision: seat "${conflictingSeatId}" is already held for showtime "${showtimeId}"`,
        );

        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: `One or more selected seats (${conflictingSeatId}) are already reserved or on hold.`,
        });
      }

      this.logger.log(
        `Successfully acquired Redis locks for ${keys.length} seats (showtime: ${showtimeId}, user: ${userId}, TTL: ${ttlSeconds}s)`,
      );

      return { success: true, keys };
    } catch (err: any) {
      if (err instanceof RpcException || err?.code === status.ALREADY_EXISTS) {
        throw err;
      }
      this.logger.error(`Redis acquireLock error: ${err.message}`, err.stack);
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to acquire seat locks: ${err.message}`,
      });
    }
  }

  /**
   * Release Redis locks for specified seats (e.g., on cancellation, rollback, or expiry).
   */
  async releaseLock(showtimeId: string, seatIds: string[]): Promise<number> {
    if (!seatIds || seatIds.length === 0) {
      return 0;
    }

    const keys = seatIds.map((id) => `booking:lock:${showtimeId}:${id}`);
    try {
      const deletedCount = await this.redisService.del(keys);
      this.logger.log(
        `Released ${deletedCount} Redis lock(s) for showtime ${showtimeId}: [${seatIds.join(', ')}]`,
      );
      return deletedCount;
    } catch (err: any) {
      this.logger.error(
        `Failed to release Redis locks for showtime ${showtimeId}: ${err.message}`,
      );
      return 0;
    }
  }

  /**
   * Dual-layer check against PostgreSQL active reservations.
   */
  async checkDatabaseOverlap(
    showtimeId: string,
    seatIds: string[],
    manager: EntityManager,
  ): Promise<boolean> {
    if (!seatIds || seatIds.length === 0) {
      return true;
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
        `Database seat conflict: seats [${takenSeatIds}] already have active bookings for showtime ${showtimeId}`,
      );
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: `One or more selected seats (${takenSeatIds}) are already reserved or on hold.`,
      });
    }

    return true;
  }

  /**
   * Backward-compatible helper method.
   */
  async checkAndLockSeats(
    showtimeId: string,
    seatIds: string[],
    manager: EntityManager,
    userId?: string,
  ): Promise<boolean> {
    if (userId) {
      await this.acquireLock(showtimeId, seatIds, userId);
    }
    return await this.checkDatabaseOverlap(showtimeId, seatIds, manager);
  }
}
