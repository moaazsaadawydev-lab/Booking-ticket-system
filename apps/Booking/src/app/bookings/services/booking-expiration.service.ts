import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { Booking, BookingOutbox } from '@booking-ticket-system/Entities';
import { BookingStatus, OutboxStatus } from '@booking-ticket-system/Utils';
import { BookingOutboxEvent } from '@booking-ticket-system/Constants';
import { SeatLockProvider } from '../providers/seat-lock.provider';

@Injectable()
export class BookingExpirationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpirationService.name);
  private isShuttingDown = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly seatLockProvider: SeatLockProvider,
  ) {}

  onModuleInit() {
    this.intervalTimer = setInterval(() => {
      this.processExpiredHolds().catch((err) =>
        this.logger.error(`Interval expiration processing error: ${err.message}`),
      );
    }, 10000);
  }

  onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processExpiredHolds() {
    if (this.isShuttingDown) return;

    try {
      const bookingRepo = this.dataSource.getRepository(Booking);
      const now = new Date();

      // Find bookings in PENDING_PAYMENT where holdExpiresAt <= NOW()
      const expiredBookings = await bookingRepo.find({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          holdExpiresAt: LessThanOrEqual(now),
        },
        relations: {
          seats: true,
        },
        take: 100,
        order: { holdExpiresAt: 'ASC' },
      });

      if (expiredBookings.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${expiredBookings.length} expired seat hold(s) to clean up`,
      );

      let processedCount = 0;

      for (const booking of expiredBookings) {
        try {
          await this.dataSource.transaction(async (manager) => {
            // Re-verify and update status to EXPIRED
            booking.status = BookingStatus.EXPIRED;
            await manager.save(Booking, booking);

            // Persist transactional outbox event
            const outboxEntity = manager.create(BookingOutbox, {
              eventType: BookingOutboxEvent.BOOKING_EXPIRED,
              payload: {
                bookingId: booking.id,
                bookingReference: booking.bookingReference,
                userId: booking.userId,
                showtimeId: booking.showtimeId,
                expiredAt: new Date().toISOString(),
              },
              status: OutboxStatus.PENDING,
            });
            await manager.save(BookingOutbox, outboxEntity);
          });

          // Free Redis distributed locks for the released seats
          const seatIds = (booking.seats || []).map((s) => s.seatId);
          if (seatIds.length > 0) {
            await this.seatLockProvider.releaseLock(
              booking.showtimeId,
              seatIds,
            );
          }

          processedCount++;
          this.logger.log(
            `Successfully expired booking ${booking.bookingReference} (${booking.id}) and released ${seatIds.length} seat lock(s)`,
          );
        } catch (itemErr: any) {
          this.logger.error(
            `Failed to expire booking ${booking.id}: ${itemErr.message}`,
          );
        }
      }

      if (processedCount > 0) {
        this.logger.log(
          `Completed hold expiration cycle: ${processedCount}/${expiredBookings.length} bookings transitioned to EXPIRED`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error during hold expiration cron cycle: ${err.message}`);
    }
  }
}
