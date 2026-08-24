import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Auditorium, Cinema, Seat, Showtime } from '@booking-ticket-system/Entities';
import { CreateAuditoriumDto, UpdateAuditoriumDto } from '@booking-ticket-system/DTOs';
import { SeatType } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class AuditoriumProvider {
  private readonly logger = new Logger(AuditoriumProvider.name);

  constructor(
    @InjectRepository(Auditorium)
    private readonly auditoriumRepository: Repository<Auditorium>,
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async create(dto: CreateAuditoriumDto): Promise<any> {
    const cinema = await this.cinemaRepository.findOne({
      where: { id: dto.cinemaId },
    });

    if (!cinema) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Cinema with ID "${dto.cinemaId}" not found`,
      });
    }

    const totalSeats = dto.totalRows * dto.totalColumns;

    const auditorium = this.auditoriumRepository.create({
      cinemaId: dto.cinemaId,
      name: dto.name,
      experienceType: dto.experienceType,
      soundSystem: dto.soundSystem || null,
      totalRows: dto.totalRows,
      totalColumns: dto.totalColumns,
      totalSeats,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const savedAuditorium = await this.auditoriumRepository.save(auditorium);

    // Auto-generate standard grid seats
    const seatsToInsert: Seat[] = [];
    for (let r = 0; r < dto.totalRows; r++) {
      const rowLabel = String.fromCharCode(65 + r); // A, B, C...
      for (let c = 1; c <= dto.totalColumns; c++) {
        seatsToInsert.push(
          this.seatRepository.create({
            auditoriumId: savedAuditorium.id,
            rowLabel,
            seatNumber: c,
            gridRow: r + 1,
            gridColumn: c,
            seatType: SeatType.REGULAR,
            isOperational: true,
          }),
        );
      }
    }

    await this.seatRepository.save(seatsToInsert);
    this.logger.log(
      `Created auditorium "${savedAuditorium.name}" with ${seatsToInsert.length} auto-generated seats.`,
    );

    await this.cacheService.invalidateTags([
      `cinema:${dto.cinemaId}`,
      `auditorium:${savedAuditorium.id}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return this.mapToResponse(savedAuditorium);
  }

  async getById(id: string): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Auditorium ID is required',
      });
    }

    const auditorium = await this.auditoriumRepository.findOne({
      where: { id },
    });

    if (!auditorium) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Auditorium with ID "${id}" not found`,
      });
    }

    return this.mapToResponse(auditorium);
  }

  async listByCinema(cinemaId: string): Promise<any> {
    if (!cinemaId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Cinema ID is required',
      });
    }

    const items = await this.auditoriumRepository.find({
      where: { cinemaId },
      order: { name: 'ASC' },
    });

    return {
      items: items.map((a) => this.mapToResponse(a)),
    };
  }

  async update(id: string, dto: UpdateAuditoriumDto): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Auditorium ID is required',
      });
    }

    const auditorium = await this.auditoriumRepository.findOne({
      where: { id },
    });

    if (!auditorium) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Auditorium with ID "${id}" not found`,
      });
    }

    if (dto.name !== undefined) auditorium.name = dto.name;
    if (dto.experienceType !== undefined)
      auditorium.experienceType = dto.experienceType;
    if (dto.soundSystem !== undefined) auditorium.soundSystem = dto.soundSystem;
    if (dto.isActive !== undefined) auditorium.isActive = dto.isActive;

    if (dto.totalRows !== undefined && dto.totalColumns !== undefined) {
      auditorium.totalRows = dto.totalRows;
      auditorium.totalColumns = dto.totalColumns;
      auditorium.totalSeats = dto.totalRows * dto.totalColumns;
    }

    const updated = await this.auditoriumRepository.save(auditorium);

    await this.cacheService.invalidateTags([
      `cinema:${auditorium.cinemaId}`,
      `auditorium:${id}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return this.mapToResponse(updated);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Auditorium ID is required',
      });
    }

    const auditorium = await this.auditoriumRepository.findOne({
      where: { id },
    });

    if (!auditorium) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Auditorium with ID "${id}" not found`,
      });
    }

    const showtimeCount = await this.showtimeRepository.count({
      where: { auditoriumId: id },
    });

    if (showtimeCount > 0) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Cannot delete auditorium with ${showtimeCount} scheduled showtimes.`,
      });
    }

    await this.auditoriumRepository.softRemove(auditorium);

    await this.cacheService.invalidateTags([
      `cinema:${auditorium.cinemaId}`,
      `auditorium:${id}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return {
      success: true,
      message: `Auditorium "${auditorium.name}" deleted successfully`,
    };
  }

  private mapToResponse(auditorium: Auditorium): any {
    return {
      id: auditorium.id,
      cinema_id: auditorium.cinemaId,
      name: auditorium.name,
      experience_type: auditorium.experienceType,
      sound_system: auditorium.soundSystem || null,
      total_rows: auditorium.totalRows,
      total_columns: auditorium.totalColumns,
      total_seats: auditorium.totalSeats,
      is_active: auditorium.isActive,
      created_at: auditorium.createdAt?.toISOString(),
      updated_at: auditorium.updatedAt?.toISOString(),
    };
  }
}
