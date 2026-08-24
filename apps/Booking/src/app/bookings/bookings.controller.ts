import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
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
  constructor(
    private readonly holdSeatsProvider: HoldSeatsProvider,
    private readonly confirmBookingProvider: ConfirmBookingProvider,
    private readonly cancelBookingProvider: CancelBookingProvider,
    private readonly getBookingProvider: GetBookingProvider,
  ) {}

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
  async getTicketById(data: { ticket_id?: string; ticketId?: string; user_id?: string; userId?: string; is_admin?: boolean; isAdmin?: boolean }) {
    const ticketId = data.ticketId || data.ticket_id || '';
    const userId = data.userId || data.user_id || '';
    const isAdmin = Boolean(data.isAdmin ?? data.is_admin);

    return await this.getBookingProvider.getTicketById(ticketId, userId, isAdmin);
  }
}
