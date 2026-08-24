import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  GrpcMethod,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { PaymentOutboxEvent } from '@booking-ticket-system/Constants';
import {
  HoldSeatsProvider,
  ConfirmBookingProvider,
  CancelBookingProvider,
  GetBookingProvider,
} from './providers';
import type {
  CancelBookingRequest,
  ConfirmBookingRequest,
  GetBookingByIdRequest,
  GetUserBookingsRequest,
  HoldSeatsRequest,
} from '@booking-ticket-system/Interfaces';

@Controller()
export class BookingsController {
  private readonly logger = new Logger(BookingsController.name);

  constructor(
    private readonly holdSeatsProvider: HoldSeatsProvider,
    private readonly confirmBookingProvider: ConfirmBookingProvider,
    private readonly cancelBookingProvider: CancelBookingProvider,
    private readonly getBookingProvider: GetBookingProvider,
  ) {}

  // -------------------------------------------------------------
  // gRPC Methods
  // -------------------------------------------------------------

  @GrpcMethod('BookingService', 'HoldSeats')
  async holdSeats(data: HoldSeatsRequest) {
    const userId = data.userId || (data as any).user_id;
    const showtimeId = data.showtimeId || (data as any).showtime_id;
    const seatIds = data.seatIds || (data as any).seat_ids || [];

    return await this.holdSeatsProvider.execute(userId, showtimeId, seatIds);
  }

  @GrpcMethod('BookingService', 'ConfirmBooking')
  async confirmBooking(data: ConfirmBookingRequest) {
    const bookingId = data.bookingId || (data as any).booking_id;
    const paymentId = data.paymentId || (data as any).payment_id;

    return await this.confirmBookingProvider.execute(bookingId, paymentId);
  }

  @GrpcMethod('BookingService', 'CancelBooking')
  async cancelBooking(data: CancelBookingRequest) {
    const bookingId = data.bookingId || (data as any).booking_id;
    const userId = data.userId || (data as any).user_id;
    const reason = data.reason;

    return await this.cancelBookingProvider.execute(bookingId, userId, reason);
  }

  @GrpcMethod('BookingService', 'GetBookingById')
  async getBookingById(data: GetBookingByIdRequest) {
    const bookingId = data.bookingId || (data as any).booking_id;
    const userId = data.userId || (data as any).user_id;
    const isAdmin = Boolean(data.isAdmin ?? (data as any).is_admin);

    return await this.getBookingProvider.getById(bookingId, userId, isAdmin);
  }

  @GrpcMethod('BookingService', 'GetUserBookings')
  async getUserBookings(data: GetUserBookingsRequest) {
    const userId = data.userId || (data as any).user_id;
    const page = Number(data.page) || 1;
    const limit = Number(data.limit) || 10;

    return await this.getBookingProvider.getUserBookings(userId, page, limit);
  }

  @GrpcMethod('BookingService', 'GetTicketById')
  async getTicketById(data: {
    ticket_id?: string;
    ticketId?: string;
    user_id?: string;
    userId?: string;
    is_admin?: boolean;
    isAdmin?: boolean;
  }) {
    const ticketId = data.ticketId || data.ticket_id || '';
    const userId = data.userId || data.user_id || '';
    const isAdmin = Boolean(data.isAdmin ?? data.is_admin);

    return await this.getBookingProvider.getTicketById(
      ticketId,
      userId,
      isAdmin,
    );
  }

  // -------------------------------------------------------------
  // RabbitMQ Event Consumers
  // -------------------------------------------------------------

  @EventPattern(PaymentOutboxEvent.PAYMENT_SUCCEEDED)
  async handlePaymentSucceeded(
    @Payload()
    data: {
      bookingId: string;
      paymentId: string;
      userId?: string;
      amount?: number;
      providerTransactionId?: string;
      eventId?: string;
      customerEmail?: string;
      customerName?: string;
      email?: string;
      name?: string;
      movieTitle?: string;
      cinemaName?: string;
      auditoriumName?: string;
      startTime?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(
      `📥 Received "${PaymentOutboxEvent.PAYMENT_SUCCEEDED}" for booking ${data.bookingId} (Payment: ${data.paymentId})`,
    );

    try {
      await this.confirmBookingProvider.execute(data.bookingId, data.paymentId, {
        customerEmail: data.customerEmail || data.email,
        customerName: data.customerName || data.name,
        movieTitle: data.movieTitle,
        cinemaName: data.cinemaName,
        auditoriumName: data.auditoriumName,
        startTime: data.startTime,
      });
      this.logger.log(
        `✅ Booking ${data.bookingId} confirmed and tickets issued successfully via RabbitMQ event`,
      );
      channel.ack(originalMsg);
    } catch (err: any) {
      this.logger.error(
        `Failed to confirm booking ${data.bookingId} from payment event: ${err.message}`,
      );
      // If the booking is already confirmed, acknowledge to prevent redelivery loop
      if (err?.message?.includes('already') || err?.code === 'ALREADY_EXISTS') {
        channel.ack(originalMsg);
        return;
      }
      const isRedelivered = originalMsg.fields?.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern(PaymentOutboxEvent.PAYMENT_FAILED)
  async handlePaymentFailed(
    @Payload()
    data: {
      bookingId: string;
      userId?: string;
      reason?: string;
      failureReason?: string;
      eventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(
      `📥 Received "${PaymentOutboxEvent.PAYMENT_FAILED}" for booking ${data.bookingId}`,
    );

    try {
      await this.cancelBookingProvider.execute(
        data.bookingId,
        data.userId,
        data.reason || data.failureReason || 'Payment failed or declined',
        true, // admin override to allow system cancellation
      );
      this.logger.log(
        `✅ Booking ${data.bookingId} cancelled and seat holds released via RabbitMQ event`,
      );
      channel.ack(originalMsg);
    } catch (err: any) {
      this.logger.error(
        `Failed to cancel booking ${data.bookingId} from payment failed event: ${err.message}`,
      );
      channel.ack(originalMsg);
    }
  }
}
