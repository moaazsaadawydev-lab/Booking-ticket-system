import { Booking } from '@booking-ticket-system/Entities';

export function mapToBookingResponse(booking: Booking): any {
  return {
    id: booking.id,
    booking_reference: booking.bookingReference,
    bookingReference: booking.bookingReference,
    user_id: booking.userId,
    userId: booking.userId,
    showtime_id: booking.showtimeId,
    showtimeId: booking.showtimeId,
    cinema_id: booking.cinemaId,
    cinemaId: booking.cinemaId,
    auditorium_id: booking.auditoriumId,
    auditoriumId: booking.auditoriumId,
    total_amount: Number(booking.totalAmount),
    totalAmount: Number(booking.totalAmount),
    currency: booking.currency || 'EGP',
    status: booking.status,
    payment_id: booking.paymentId || null,
    paymentId: booking.paymentId || null,
    hold_expires_at:
      booking.holdExpiresAt instanceof Date
        ? booking.holdExpiresAt.toISOString()
        : String(booking.holdExpiresAt),
    holdExpiresAt:
      booking.holdExpiresAt instanceof Date
        ? booking.holdExpiresAt.toISOString()
        : String(booking.holdExpiresAt),
    confirmed_at: booking.confirmedAt
      ? booking.confirmedAt instanceof Date
        ? booking.confirmedAt.toISOString()
        : String(booking.confirmedAt)
      : null,
    confirmedAt: booking.confirmedAt
      ? booking.confirmedAt instanceof Date
        ? booking.confirmedAt.toISOString()
        : String(booking.confirmedAt)
      : null,
    created_at:
      booking.createdAt instanceof Date
        ? booking.createdAt.toISOString()
        : String(booking.createdAt),
    createdAt:
      booking.createdAt instanceof Date
        ? booking.createdAt.toISOString()
        : String(booking.createdAt),
    seats: (booking.seats || []).map((s) => ({
      seat_id: s.seatId,
      seatId: s.seatId,
      seat_identifier: s.seatIdentifier,
      seatIdentifier: s.seatIdentifier,
      seat_type: s.seatType,
      seatType: s.seatType,
      unit_price: Number(s.unitPrice),
      unitPrice: Number(s.unitPrice),
    })),
    tickets: (booking.tickets || []).map((t) => ({
      id: t.id,
      seat_id: t.seatId,
      seatId: t.seatId,
      ticket_number: t.ticketNumber,
      ticketNumber: t.ticketNumber,
      qr_code_token: t.qrCodeToken,
      qrCodeToken: t.qrCodeToken,
      status: t.status,
      used_at: t.usedAt
        ? t.usedAt instanceof Date
          ? t.usedAt.toISOString()
          : String(t.usedAt)
        : null,
      usedAt: t.usedAt
        ? t.usedAt instanceof Date
          ? t.usedAt.toISOString()
          : String(t.usedAt)
        : null,
    })),
  };
}
