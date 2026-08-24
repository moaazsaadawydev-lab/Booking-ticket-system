import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { BOOKING_SERVICE } from '@booking-ticket-system/Constants';
import {
  CancelBookingDto,
  ConfirmBookingDto,
  GetUserBookingsQueryDto,
  HoldSeatsDto,
  ValidateTicketDto,
} from '@booking-ticket-system/DTOs';

@Injectable()
export class BookingProvider implements OnModuleInit {
  private bookingService: any;

  constructor(
    @Inject(BOOKING_SERVICE) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.bookingService = this.client.getService('BookingService');
  }

  async holdSeats(userId: string, dto: HoldSeatsDto) {
    const res: any = await lastValueFrom(
      this.bookingService.HoldSeats({
        user_id: userId,
        userId,
        showtime_id: dto.showtimeId,
        showtimeId: dto.showtimeId,
        seat_ids: dto.seatIds,
        seatIds: dto.seatIds,
      }),
    );
    return res;
  }

  async confirmBooking(bookingId: string, dto: ConfirmBookingDto) {
    const res: any = await lastValueFrom(
      this.bookingService.ConfirmBooking({
        booking_id: bookingId,
        bookingId,
        payment_id: dto.paymentId,
        paymentId: dto.paymentId,
      }),
    );
    return res;
  }

  async cancelBooking(bookingId: string, userId: string, dto: CancelBookingDto) {
    const res: any = await lastValueFrom(
      this.bookingService.CancelBooking({
        booking_id: bookingId,
        bookingId,
        user_id: userId,
        userId,
        reason: dto?.reason,
      }),
    );
    return res;
  }

  async getBookingById(bookingId: string, userId: string, isAdmin = false) {
    const res: any = await lastValueFrom(
      this.bookingService.GetBookingById({
        booking_id: bookingId,
        bookingId,
        user_id: userId,
        userId,
        is_admin: isAdmin,
        isAdmin,
      }),
    );
    return res;
  }

  async getUserBookings(userId: string, query: GetUserBookingsQueryDto) {
    const res: any = await lastValueFrom(
      this.bookingService.GetUserBookings({
        user_id: userId,
        userId,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 10,
      }),
    );
    return {
      bookings: res?.bookings || [],
      total: Number(res?.total) || 0,
      page: Number(res?.page) || 1,
      limit: Number(res?.limit) || 10,
    };
  }

  async getTicketById(ticketId: string, userId: string, isAdmin = false) {
    const res: any = await lastValueFrom(
      this.bookingService.GetTicketById({
        ticket_id: ticketId,
        ticketId,
        user_id: userId,
        userId,
        is_admin: isAdmin,
        isAdmin,
      }),
    );
    return res;
  }

  async validateTicket(dto: ValidateTicketDto, user: any) {
    const res: any = await lastValueFrom(
      this.bookingService.ValidateTicket({
        qr_token: dto.qrToken,
        qrToken: dto.qrToken,
        gate_cinema_id: dto.gateCinemaId,
        gateCinemaId: dto.gateCinemaId,
        gate_auditorium_id: dto.gateAuditoriumId,
        gateAuditoriumId: dto.gateAuditoriumId,
        scanned_by_user_id: user?.id,
        scannedByUserId: user?.id,
        scanned_by_user_email: user?.email,
        scannedByUserEmail: user?.email,
      }),
    );
    return res;
  }
}
