import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Seat } from '@booking-ticket-system/Entities';
import { BatchUpdateSeatsDto, UpdateSeatDto } from '@booking-ticket-system/DTOs';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class UpdateSeatProvider {
  private readonly logger = new Logger(UpdateSeatProvider.name);

  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async updateSingle(id: string, dto: UpdateSeatDto): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Seat ID is required',
      });
    }

    const seat = await this.seatRepository.findOne({ where: { id } });

    if (!seat) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Seat with ID "${id}" not found`,
      });
    }

    if (dto.seatType !== undefined) seat.seatType = dto.seatType;
    if (dto.isOperational !== undefined)
      seat.isOperational = dto.isOperational;

    const updated = await this.seatRepository.save(seat);

    await this.cacheService.invalidateTags([
      `auditorium:${updated.auditoriumId}`,
    ]);

    return {
      id: updated.id,
      auditorium_id: updated.auditoriumId,
      row_label: updated.rowLabel,
      seat_number: updated.seatNumber,
      grid_row: updated.gridRow,
      grid_column: updated.gridColumn,
      seat_type: updated.seatType,
      is_operational: updated.isOperational,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    };
  }

  async batchUpdate(dto: BatchUpdateSeatsDto): Promise<any> {
    if (!dto.auditoriumId || !dto.seats || dto.seats.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Auditorium ID and list of seats are required',
      });
    }

    const seatIds = dto.seats.map((s) => s.id);
    const existingSeats = await this.seatRepository.find({
      where: { id: In(seatIds), auditoriumId: dto.auditoriumId },
    });

    const seatMap = new Map(existingSeats.map((s) => [s.id, s]));

    let updatedCount = 0;
    const toSave: Seat[] = [];

    for (const updateItem of dto.seats) {
      const seat = seatMap.get(updateItem.id);
      if (seat) {
        if (updateItem.seatType !== undefined)
          seat.seatType = updateItem.seatType;
        if (updateItem.isOperational !== undefined)
          seat.isOperational = updateItem.isOperational;
        toSave.push(seat);
        updatedCount++;
      }
    }

    if (toSave.length > 0) {
      await this.seatRepository.save(toSave);
    }

    this.logger.log(
      `Batch updated ${updatedCount} seats for auditorium "${dto.auditoriumId}"`,
    );

    await this.cacheService.invalidateTags([`auditorium:${dto.auditoriumId}`]);

    return {
      success: true,
      updated_count: updatedCount,
      message: `Successfully updated ${updatedCount} seats.`,
    };
  }
}
