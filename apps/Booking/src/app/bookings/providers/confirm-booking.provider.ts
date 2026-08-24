import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as crypto from 'crypto';
import { Booking, Ticket, BookingOutbox } from '@booking-ticket-system/Entities';
import { BookingStatus, TicketStatus, OutboxStatus } from '@booking-ticket-system/Utils';
import { BookingOutboxEvent } from '@booking-ticket-system/Constants';
import { mapToBookingResponse } from '../utils/booking-mapper';

@Injectable()
export class ConfirmBookingProvider {
  private readonly logger = new Logger(ConfirmBookingProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(bookingId: string, paymentId: string): Promise<any> {
    if (!bookingId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'bookingId is required',
      });
    }

    if (!paymentId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'paymentId is required',
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

    // Idempotency: If already confirmed with the same paymentId
    if (booking.status === BookingStatus.CONFIRMED) {
      return { booking: mapToBookingResponse(booking) };
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Booking cannot be confirmed from status "${booking.status}"`,
      });
    }

    // Check expiration
    const now = new Date();
    if (now > new Date(booking.holdExpiresAt)) {
      booking.status = BookingStatus.EXPIRED;
      await bookingRepo.save(booking);

      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: 'Booking hold has expired. Please select seats again.',
      });
    }

    const confirmedBooking = await this.dataSource.transaction(
      async (manager) => {
        booking.status = BookingStatus.CONFIRMED;
        booking.paymentId = paymentId;
        booking.confirmedAt = now;

        const updatedBooking = await manager.save(Booking, booking);

        const currentYear = now.getFullYear();
        const ticketsToCreate = (booking.seats || []).map((seat) => {
          const ticketNumber = `TKT-${currentYear}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
          const qrCodeToken = crypto.randomBytes(32).toString('hex');

          return manager.create(Ticket, {
            bookingId: updatedBooking.id,
            seatId: seat.seatId,
            ticketNumber,
            qrCodeToken,
            status: TicketStatus.ISSUED,
          });
        });

        updatedBooking.tickets = await manager.save(Ticket, ticketsToCreate);

        // Save transactional Outbox event
        const outboxEntity = manager.create(BookingOutbox, {
          eventType: BookingOutboxEvent.BOOKING_CONFIRMED,
          payload: {
            bookingId: updatedBooking.id,
            bookingReference: updatedBooking.bookingReference,
            userId: updatedBooking.userId,
            showtimeId: updatedBooking.showtimeId,
            totalAmount: updatedBooking.totalAmount,
            paymentId: updatedBooking.paymentId,
            confirmedAt: updatedBooking.confirmedAt?.toISOString(),
          },
          status: OutboxStatus.PENDING,
        });
        await manager.save(BookingOutbox, outboxEntity);

        return updatedBooking;
      },
    );

    this.logger.log(
      `Booking ${booking.bookingReference} confirmed successfully with ${confirmedBooking.tickets.length} tickets`,
    );

    return { booking: mapToBookingResponse(confirmedBooking) };
  }
}
