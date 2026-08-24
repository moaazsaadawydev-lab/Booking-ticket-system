import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Booking, Ticket } from '@booking-ticket-system/Entities';
import { BookingStatus, TicketStatus } from '@booking-ticket-system/Utils';

@Injectable()
export class CancelBookingProvider {
  private readonly logger = new Logger(CancelBookingProvider.name);

  constructor(private readonly dataSource: DataSource) {}

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
      relations: { tickets: true },
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
    });

    this.logger.log(
      `Booking ${booking.bookingReference} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    );

    return {
      success: true,
      message: 'Booking cancelled successfully',
    };
  }
}
