import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Cinema, Showtime } from '@booking-ticket-system/Entities';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class DeleteCinemaProvider {
  private readonly logger = new Logger(DeleteCinemaProvider.name);

  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Cinema ID is required',
      });
    }

    const cinema = await this.cinemaRepository.findOne({
      where: { id },
      relations: { auditoriums: true },
    });

    if (!cinema) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Cinema with ID "${id}" not found`,
      });
    }

    const auditoriumIds = (cinema.auditoriums || []).map((a) => a.id);
    if (auditoriumIds.length > 0) {
      const activeShowtimes = await this.showtimeRepository
        .createQueryBuilder('showtime')
        .where('showtime.auditoriumId IN (:...auditoriumIds)', {
          auditoriumIds,
        })
        .getCount();

      if (activeShowtimes > 0) {
        throw new RpcException({
          code: status.FAILED_PRECONDITION,
          message: `Cannot delete cinema with ${activeShowtimes} active showtimes across its auditoriums.`,
        });
      }
    }

    await this.cinemaRepository.softRemove(cinema);
    this.logger.log(`Soft-deleted cinema "${cinema.name}" (ID: ${cinema.id})`);

    await this.cacheService.invalidateTags([`cinema:${id}`]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return {
      success: true,
      message: `Cinema "${cinema.name}" deleted successfully`,
    };
  }
}
