import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Booking, Ticket, BookingOutbox } from '@booking-ticket-system/Entities';
import { BookingStatus, TicketStatus, OutboxStatus } from '@booking-ticket-system/Utils';
import { BookingOutboxEvent } from '@booking-ticket-system/Constants';
import { mapToBookingResponse } from '../utils/booking-mapper';

export interface ConfirmBookingExtraDetails {
  customerEmail?: string;
  customerName?: string;
  email?: string;
  name?: string;
  movieTitle?: string;
  cinemaName?: string;
  auditoriumName?: string;
  startTime?: string;
}

@Injectable()
export class ConfirmBookingProvider {
  private readonly logger = new Logger(ConfirmBookingProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(
    bookingId: string,
    paymentId: string,
    extraDetails?: ConfirmBookingExtraDetails,
  ): Promise<any> {
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

    const jwtSecret =
      process.env['TICKET_JWT_SECRET'] ||
      process.env['JWT_SECRET'] ||
      'ticket-jwt-secret-key-12345';

    const confirmedBooking = await this.dataSource.transaction(
      async (manager) => {
        booking.status = BookingStatus.CONFIRMED;
        booking.paymentId = paymentId;
        booking.confirmedAt = now;

        const updatedBooking = await manager.save(Booking, booking);

        const currentYear = now.getFullYear();
        const seatMap = new Map(
          (booking.seats || []).map((s) => [s.seatId, s.seatIdentifier]),
        );

        // Fetch showtime info if available for dynamic expiration
        let showtimeExp: number = Math.floor(Date.now() / 1000) + 7 * 86400; // default 7 days
        if (extraDetails?.startTime) {
          const start = new Date(extraDetails.startTime).getTime();
          // Assume 2.5 hours + 30 min buffer if only start time known
          showtimeExp = Math.floor((start + 3 * 3600 * 1000) / 1000);
        }

        const ticketsToCreate = (booking.seats || []).map((seat) => {
          const ticketId = crypto.randomUUID();
          const ticketNumber = `TKT-${currentYear}-${crypto
            .randomBytes(4)
            .toString('hex')
            .toUpperCase()}`;
          const seatNumber =
            seat.seatIdentifier || seatMap.get(seat.seatId) || 'Standard';

          const tokenPayload = {
            sub: ticketId,
            bookingId: updatedBooking.id,
            showtimeId: updatedBooking.showtimeId,
            cinemaId: updatedBooking.cinemaId,
            auditoriumId: updatedBooking.auditoriumId,
            seatId: seat.seatId,
            seatNumber,
            type: 'TICKET_QR',
            exp: showtimeExp,
          };

          const qrCodeToken = jwt.sign(tokenPayload, jwtSecret);

          return manager.create(Ticket, {
            id: ticketId,
            bookingId: updatedBooking.id,
            seatId: seat.seatId,
            ticketNumber,
            qrCodeToken,
            status: TicketStatus.ISSUED,
          });
        });

        updatedBooking.tickets = await manager.save(Ticket, ticketsToCreate);

        // Resolve customer details with fallback
        let resolvedCustomerEmail =
          extraDetails?.customerEmail || extraDetails?.email;
        let resolvedCustomerName =
          extraDetails?.customerName || extraDetails?.name;

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
            customerEmail: resolvedCustomerEmail,
            customerName: resolvedCustomerName,
            movieTitle: extraDetails?.movieTitle,
            cinemaName: extraDetails?.cinemaName,
            auditoriumName: extraDetails?.auditoriumName,
            startTime: extraDetails?.startTime,
            tickets: (updatedBooking.tickets || []).map((t) => ({
              id: t.id,
              seatId: t.seatId,
              seatIdentifier: seatMap.get(t.seatId) || '',
              ticketNumber: t.ticketNumber,
              qrCodeToken: t.qrCodeToken,
              status: t.status,
            })),
          },
          status: OutboxStatus.PENDING,
        });
        await manager.save(BookingOutbox, outboxEntity);

        return updatedBooking;
      },
    );

    this.logger.log(
      `Booking ${booking.bookingReference} confirmed successfully with ${confirmedBooking.tickets.length} signed JWT tickets`,
    );

    return { booking: mapToBookingResponse(confirmedBooking) };
  }
}
