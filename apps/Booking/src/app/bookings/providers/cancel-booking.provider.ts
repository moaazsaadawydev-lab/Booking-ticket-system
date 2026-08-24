import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Booking, Ticket, BookingOutbox } from '@booking-ticket-system/Entities';
import { BookingStatus, TicketStatus, OutboxStatus } from '@booking-ticket-system/Utils';
import { BookingOutboxEvent } from '@booking-ticket-system/Constants';
import { SeatLockProvider } from './seat-lock.provider';

@Injectable()
export class CancelBookingProvider {
  private readonly logger = new Logger(CancelBookingProvider.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly seatLockProvider: SeatLockProvider,
  ) {}

  async execute(
    bookingId: string,
    userId?: string,
    reason?: string,
    isAdmin = false,
  ): Promise<{ success: boolean; message: string }> {
    if (!bookingId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'bookingId is required',
      });
    }

    const bookingRepo = this.dataSource.getRepository(Booking);

    const booking = await bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        seats: true,
        tickets: true,
      },
    });

    if (!booking) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Booking with ID "${bookingId}" was not found`,
      });
    }

    // Ownership check (unless admin)
    if (userId && !isAdmin && booking.userId !== userId) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'You do not have permission to cancel this booking',
      });
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return {
        success: true,
        message: 'Booking is already cancelled',
      };
    }

    await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CANCELLED;
      await manager.save(Booking, booking);

      if (booking.tickets && booking.tickets.length > 0) {
        for (const ticket of booking.tickets) {
          ticket.status = TicketStatus.CANCELLED;
        }
        await manager.save(Ticket, booking.tickets);
      }

      // Save transactional Outbox event
      const outboxEntity = manager.create(BookingOutbox, {
        eventType: BookingOutboxEvent.BOOKING_CANCELLED,
        payload: {
          bookingId: booking.id,
          bookingReference: booking.bookingReference,
          userId: booking.userId,
          showtimeId: booking.showtimeId,
          reason: reason || null,
          cancelledAt: new Date().toISOString(),
        },
        status: OutboxStatus.PENDING,
      });
      await manager.save(BookingOutbox, outboxEntity);
    });

    // Release Redis distributed locks for freed seats
    const seatIds = (booking.seats || []).map((s) => s.seatId);
    if (seatIds.length > 0) {
      await this.seatLockProvider.releaseLock(booking.showtimeId, seatIds);
    }

    this.logger.log(
      `Booking ${booking.bookingReference} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    );

    return {
      success: true,
      message: 'Booking cancelled successfully',
    };
  }
}
