import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Auditorium, Seat } from '@booking-ticket-system/Entities';
import { GenerateSeatLayoutDto } from '@booking-ticket-system/DTOs';
import { SeatType } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class GenerateSeatLayoutProvider {
  private readonly logger = new Logger(GenerateSeatLayoutProvider.name);

  constructor(
    @InjectRepository(Auditorium)
    private readonly auditoriumRepository: Repository<Auditorium>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(dto: GenerateSeatLayoutDto): Promise<any> {
    const auditorium = await this.auditoriumRepository.findOne({
      where: { id: dto.auditoriumId },
    });

    if (!auditorium) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Auditorium with ID "${dto.auditoriumId}" not found`,
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Clear existing seats for auditorium in transaction
      await queryRunner.manager.delete(Seat, { auditoriumId: dto.auditoriumId });

      const totalRows = dto.totalRows || auditorium.totalRows;
      const totalColumns = dto.totalColumns || auditorium.totalColumns;

      const seatsToInsert: Seat[] = [];

      if (dto.customSeats && dto.customSeats.length > 0) {
        for (const customSeat of dto.customSeats) {
          seatsToInsert.push(
            queryRunner.manager.create(Seat, {
              auditoriumId: dto.auditoriumId,
              rowLabel: customSeat.rowLabel,
              seatNumber: customSeat.seatNumber,
              gridRow: customSeat.gridRow,
              gridColumn: customSeat.gridColumn,
              seatType: customSeat.seatType || SeatType.REGULAR,
              isOperational:
                customSeat.isOperational !== undefined
                  ? customSeat.isOperational
                  : true,
            }),
          );
        }
      } else {
        // Auto-generate standard grid
        for (let r = 0; r < totalRows; r++) {
          const rowLabel = String.fromCharCode(65 + r);
          for (let c = 1; c <= totalColumns; c++) {
            seatsToInsert.push(
              queryRunner.manager.create(Seat, {
                auditoriumId: dto.auditoriumId,
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
      }

      await queryRunner.manager.save(Seat, seatsToInsert);

      // Update totalSeats on auditorium
      auditorium.totalRows = totalRows;
      auditorium.totalColumns = totalColumns;
      auditorium.totalSeats = seatsToInsert.length;
      await queryRunner.manager.save(Auditorium, auditorium);

      await queryRunner.commitTransaction();
      this.logger.log(
        `Generated seat layout for auditorium "${auditorium.name}" with ${seatsToInsert.length} seats.`,
      );

      const savedSeats = await this.seatRepository.find({
        where: { auditoriumId: dto.auditoriumId },
        order: { gridRow: 'ASC', gridColumn: 'ASC' },
      });

      await this.cacheService.invalidateTags([
        `auditorium:${dto.auditoriumId}`,
      ]);

      return {
        auditorium_id: auditorium.id,
        total_rows: auditorium.totalRows,
        total_columns: auditorium.totalColumns,
        total_seats: auditorium.totalSeats,
        seats: savedSeats.map((s) => ({
          id: s.id,
          auditorium_id: s.auditoriumId,
          row_label: s.rowLabel,
          seat_number: s.seatNumber,
          grid_row: s.gridRow,
          grid_column: s.gridColumn,
          seat_type: s.seatType,
          is_operational: s.isOperational,
          created_at: s.createdAt?.toISOString(),
          updated_at: s.updatedAt?.toISOString(),
        })),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to generate seat layout: ${(error as Error).message}`,
      );
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to generate seat layout: ${(error as Error).message}`,
      });
    } finally {
      await queryRunner.release();
    }
  }
}
