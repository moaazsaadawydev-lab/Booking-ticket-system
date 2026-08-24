import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Booking } from '@booking-ticket-system/Entities';
import { mapToBookingResponse } from '../utils/booking-mapper';

@Injectable()
export class GetBookingProvider {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async getById(
    bookingId: string,
    userId?: string,
    isAdmin = false,
  ): Promise<any> {
    if (!bookingId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'bookingId is required',
      });
    }

    const booking = await this.bookingRepository.findOne({
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

    if (userId && !isAdmin && booking.userId !== userId) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'You do not have permission to view this booking',
      });
    }

    return mapToBookingResponse(booking);
  }

  async getUserBookings(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ bookings: any[]; total: number; page: number; limit: number }> {
    if (!userId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'userId is required',
      });
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

    const [items, total] = await this.bookingRepository.findAndCount({
      where: { userId },
      relations: {
        seats: true,
        tickets: true,
      },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      bookings: items.map((b) => mapToBookingResponse(b)),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }
}
