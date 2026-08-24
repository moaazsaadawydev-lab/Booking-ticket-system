import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as jwt from 'jsonwebtoken';
import { Ticket } from '@booking-ticket-system/Entities';
import { TicketStatus } from '@booking-ticket-system/Utils';

export interface ValidateTicketParams {
  qrToken: string;
  gateCinemaId?: string;
  gateAuditoriumId?: string;
  scannedByUserId: string;
  scannedByUserEmail?: string;
}

@Injectable()
export class ValidateTicketProvider {
  private readonly logger = new Logger(ValidateTicketProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(params: ValidateTicketParams): Promise<any> {
    const {
      qrToken,
      gateCinemaId,
      gateAuditoriumId,
      scannedByUserId,
      scannedByUserEmail,
    } = params;

    if (!qrToken) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'qrToken is required',
      });
    }

    const jwtSecret =
      process.env['TICKET_JWT_SECRET'] ||
      process.env['JWT_SECRET'] ||
      'ticket-jwt-secret-key-12345';

    // 1. Cryptographic & Expiration Check
    let payload: any;
    try {
      payload = jwt.verify(qrToken, jwtSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Ticket expired: showtime has ended',
        });
      }
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid ticket signature',
      });
    }

    if (payload.type !== 'TICKET_QR' || !payload.sub) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid ticket token format',
      });
    }

    // 2. Contextual Match (Branch & Hall Guard)
    if (gateCinemaId && payload.cinemaId && gateCinemaId !== payload.cinemaId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Wrong cinema branch: ticket is for another cinema branch',
      });
    }

    if (
      gateAuditoriumId &&
      payload.auditoriumId &&
      gateAuditoriumId !== payload.auditoriumId
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Wrong auditorium: ticket is for another hall/auditorium',
      });
    }

    // 3. Database State Verification (Inside DB Transaction with Row Lock)
    return await this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, {
        where: { id: payload.sub },
        relations: { booking: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!ticket) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'Ticket record not found in database',
        });
      }

      // Double Entrance Guard
      if (ticket.status === TicketStatus.USED) {
        const usedAtStr = ticket.usedAt
          ? ticket.usedAt.toISOString()
          : 'earlier check-in';
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: `Ticket already used at ${usedAtStr}`,
        });
      }

      if (ticket.status === TicketStatus.CANCELLED) {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Ticket has been cancelled or refunded',
        });
      }

      // 4. State Transition & Entrance Authorization
      const now = new Date();
      ticket.status = TicketStatus.USED;
      ticket.usedAt = now;
      ticket.scannedByUserId = scannedByUserId || null;
      await manager.save(Ticket, ticket);

      this.logger.log(
        `Gate check-in successful: Ticket ${ticket.ticketNumber} marked USED by ${scannedByUserEmail || scannedByUserId}`,
      );

      return {
        valid: true,
        ticket_number: ticket.ticketNumber,
        ticketNumber: ticket.ticketNumber,
        status: 'USED',
        movie_title: payload.movieTitle || 'Movie Feature',
        movieTitle: payload.movieTitle || 'Movie Feature',
        cinema_name: payload.cinemaName || 'Cinema Grand',
        cinemaName: payload.cinemaName || 'Cinema Grand',
        auditorium_name: payload.auditoriumName || 'Auditorium Hall',
        auditoriumName: payload.auditoriumName || 'Auditorium Hall',
        seat_number: payload.seatNumber || 'Standard Seat',
        seatNumber: payload.seatNumber || 'Standard Seat',
        showtime_start: payload.showtimeStart || '',
        showtimeStart: payload.showtimeStart || '',
        scanned_at: now.toISOString(),
        scannedAt: now.toISOString(),
        scanned_by: scannedByUserEmail || scannedByUserId || 'Staff',
        scannedBy: scannedByUserEmail || scannedByUserId || 'Staff',
      };
    });
  }
}
