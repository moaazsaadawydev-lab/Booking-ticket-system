import { Observable } from 'rxjs';

export interface BookingSeatItem {
  seat_id?: string;
  seatId?: string;
  seat_identifier?: string;
  seatIdentifier?: string;
  seat_type?: string;
  seatType?: string;
  unit_price?: number;
  unitPrice?: number;
}

export interface TicketItem {
  id: string;
  seat_id?: string;
  seatId?: string;
  ticket_number?: string;
  ticketNumber?: string;
  qr_code_token?: string;
  qrCodeToken?: string;
  status: string;
  used_at?: string;
  usedAt?: string;
}

export interface BookingResponse {
  id: string;
  booking_reference?: string;
  bookingReference?: string;
  user_id?: string;
  userId?: string;
  showtime_id?: string;
  showtimeId?: string;
  cinema_id?: string;
  cinemaId?: string;
  auditorium_id?: string;
  auditoriumId?: string;
  total_amount?: number;
  totalAmount?: number;
  currency: string;
  status: string;
  payment_id?: string | null;
  paymentId?: string | null;
  hold_expires_at?: string;
  holdExpiresAt?: string;
  confirmed_at?: string | null;
  confirmedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  seats: BookingSeatItem[];
  tickets: TicketItem[];
}

export interface HoldSeatsRequest {
  user_id?: string;
  userId?: string;
  showtime_id?: string;
  showtimeId?: string;
  seat_ids?: string[];
  seatIds?: string[];
}

export interface HoldSeatsResponse {
  booking: BookingResponse;
  hold_duration_seconds?: number;
  holdDurationSeconds?: number;
}

export interface ConfirmBookingRequest {
  booking_id?: string;
  bookingId?: string;
  payment_id?: string;
  paymentId?: string;
}

export interface ConfirmBookingResponse {
  booking: BookingResponse;
}

export interface CancelBookingRequest {
  booking_id?: string;
  bookingId?: string;
  user_id?: string;
  userId?: string;
  reason?: string;
}

export interface CancelBookingResponse {
  success: boolean;
  message: string;
}

export interface GetBookingByIdRequest {
  booking_id?: string;
  bookingId?: string;
  user_id?: string;
  userId?: string;
  is_admin?: boolean;
  isAdmin?: boolean;
}

export interface GetUserBookingsRequest {
  user_id?: string;
  userId?: string;
  page: number;
  limit: number;
}

export interface GetUserBookingsResponse {
  bookings: BookingResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface BookingServiceClient {
  HoldSeats(request: HoldSeatsRequest): Observable<HoldSeatsResponse>;
  ConfirmBooking(request: ConfirmBookingRequest): Observable<ConfirmBookingResponse>;
  CancelBooking(request: CancelBookingRequest): Observable<CancelBookingResponse>;
  GetBookingById(request: GetBookingByIdRequest): Observable<BookingResponse>;
  GetUserBookings(request: GetUserBookingsRequest): Observable<GetUserBookingsResponse>;
}
