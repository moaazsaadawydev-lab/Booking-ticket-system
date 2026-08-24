import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Showtime } from '@booking-ticket-system/Entities';
import { UpdateShowtimeDto } from '@booking-ticket-system/DTOs';
import { ShowtimeStatus } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class UpdateShowtimeProvider {
  private readonly logger = new Logger(UpdateShowtimeProvider.name);

  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async update(id: string, dto: UpdateShowtimeDto): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Showtime ID is required',
      });
    }

    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: {
        movie: { genres: true },
        auditorium: { cinema: true },
        seatPricings: true,
      },
    });

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${id}" not found`,
      });
    }

    const auditoriumId = dto.auditoriumId || showtime.auditoriumId;
    const startTime = dto.startTime ? new Date(dto.startTime) : showtime.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : showtime.endTime;
    const showtimeStatus = dto.status || showtime.status;

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid start or end time timestamp',
      });
    }

    if (startTime >= endTime) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Showtime start time must be before end time',
      });
    }

    // Check overlapping schedule for auditorium including 20-minute cleaning buffer (excluding current showtime)
    if (showtimeStatus !== ShowtimeStatus.CANCELLED) {
      const CLEANING_BUFFER_MINUTES = 20;
      const bufferedStartTime = new Date(startTime.getTime() - CLEANING_BUFFER_MINUTES * 60 * 1000);
      const bufferedEndTime = new Date(endTime.getTime() + CLEANING_BUFFER_MINUTES * 60 * 1000);

      const overlapping = await this.showtimeRepository
        .createQueryBuilder('showtime')
        .where('showtime.auditoriumId = :auditoriumId', { auditoriumId })
        .andWhere('showtime.status != :cancelledStatus', {
          cancelledStatus: ShowtimeStatus.CANCELLED,
        })
        .andWhere('showtime.id != :currentShowtimeId', { currentShowtimeId: id })
        .andWhere('showtime.startTime < :bufferedEndTime', { bufferedEndTime })
        .andWhere('showtime.endTime > :bufferedStartTime', { bufferedStartTime })
        .getOne();

      if (overlapping) {
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message:
            'The selected time slot conflicts with an existing showtime or its required 20-minute cleaning buffer.',
        });
      }
    }

    if (dto.movieId !== undefined) showtime.movieId = dto.movieId;
    showtime.auditoriumId = auditoriumId;
    showtime.startTime = startTime;
    showtime.endTime = endTime;
    if (dto.experienceType !== undefined)
      showtime.experienceType = dto.experienceType;
    if (dto.basePrice !== undefined)
      showtime.basePrice = Number(dto.basePrice);
    showtime.status = showtimeStatus;

    const updated = await this.showtimeRepository.save(showtime);
    this.logger.log(`Updated showtime ${updated.id}`);

    await this.cacheService.invalidateTags([
      `movie:${showtime.movieId}`,
      `auditorium:${showtime.auditoriumId}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return this.mapToResponse(updated);
  }

  async updateStatus(id: string, newStatus: ShowtimeStatus): Promise<any> {
    if (!id || !newStatus) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Showtime ID and status are required',
      });
    }

    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: {
        movie: { genres: true },
        auditorium: { cinema: true },
        seatPricings: true,
      },
    });

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${id}" not found`,
      });
    }

    showtime.status = newStatus;
    const updated = await this.showtimeRepository.save(showtime);
    this.logger.log(`Updated showtime ${id} status to ${newStatus}`);

    await this.cacheService.invalidateTags([
      `movie:${showtime.movieId}`,
      `auditorium:${showtime.auditoriumId}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return this.mapToResponse(updated);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Showtime ID is required',
      });
    }

    const showtime = await this.showtimeRepository.findOne({ where: { id } });

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${id}" not found`,
      });
    }

    await this.showtimeRepository.softRemove(showtime);

    await this.cacheService.invalidateTags([
      `movie:${showtime.movieId}`,
      `auditorium:${showtime.auditoriumId}`,
    ]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return {
      success: true,
      message: `Showtime "${id}" deleted successfully`,
    };
  }

  private mapToResponse(showtime: Showtime): any {
    const movie = showtime.movie;
    const auditorium = showtime.auditorium;
    const cinema = auditorium?.cinema;

    return {
      id: showtime.id,
      movie_id: showtime.movieId,
      auditorium_id: showtime.auditoriumId,
      start_time: showtime.startTime?.toISOString(),
      end_time: showtime.endTime?.toISOString(),
      experience_type: showtime.experienceType,
      base_price: Number(showtime.basePrice),
      status: showtime.status,
      movie: movie
        ? {
            id: movie.id,
            title: movie.title,
            slug: movie.slug,
            description: movie.description,
            duration_minutes: movie.durationMinutes,
            release_date:
              movie.releaseDate instanceof Date
                ? movie.releaseDate.toISOString().split('T')[0]
                : String(movie.releaseDate),
            age_rating: movie.ageRating,
            status: movie.status,
            original_language: movie.originalLanguage,
            poster_url: movie.posterUrl,
            banner_url: movie.bannerUrl,
            trailer_url: movie.trailerUrl,
            gallery_urls: movie.galleryUrls || [],
            rating_average: Number(movie.ratingAverage) || 0,
            rating_count: movie.ratingCount || 0,
          }
        : null,
      auditorium: auditorium
        ? {
            id: auditorium.id,
            cinema_id: auditorium.cinemaId,
            name: auditorium.name,
            experience_type: auditorium.experienceType,
            sound_system: auditorium.soundSystem,
            total_rows: auditorium.totalRows,
            total_columns: auditorium.totalColumns,
            total_seats: auditorium.totalSeats,
            is_active: auditorium.isActive,
          }
        : null,
      cinema: cinema
        ? {
            id: cinema.id,
            name: cinema.name,
            slug: cinema.slug,
            description: cinema.description,
            city: cinema.city,
            address: cinema.address,
            latitude: cinema.latitude ? Number(cinema.latitude) : null,
            longitude: cinema.longitude ? Number(cinema.longitude) : null,
            thumbnail_url: cinema.thumbnailUrl,
            gallery_urls: cinema.galleryUrls || [],
            is_active: cinema.isActive,
          }
        : null,
      seat_pricings: (showtime.seatPricings || []).map((p) => ({
        id: p.id,
        showtime_id: p.showtimeId,
        seat_type: p.seatType,
        price: Number(p.price),
        created_at: p.createdAt?.toISOString(),
        updated_at: p.updatedAt?.toISOString(),
      })),
      created_at: showtime.createdAt?.toISOString(),
      updated_at: showtime.updatedAt?.toISOString(),
    };
  }
}
