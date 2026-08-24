import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import {
  Auditorium,
  Movie,
  Showtime,
  ShowtimeSeatPricing,
} from '@booking-ticket-system/Entities';
import { CreateShowtimeDto } from '@booking-ticket-system/DTOs';
import { ShowtimeStatus } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class CreateShowtimeProvider {
  private readonly logger = new Logger(CreateShowtimeProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Auditorium)
    private readonly auditoriumRepository: Repository<Auditorium>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(dto: CreateShowtimeDto): Promise<any> {
    const movie = await this.movieRepository.findOne({
      where: { id: dto.movieId },
      relations: { genres: true },
    });

    if (!movie) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Movie with ID "${dto.movieId}" not found`,
      });
    }

    const auditorium = await this.auditoriumRepository.findOne({
      where: { id: dto.auditoriumId },
      relations: { cinema: true },
    });

    if (!auditorium) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Auditorium with ID "${dto.auditoriumId}" not found`,
      });
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

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

    // Check overlapping schedule for auditorium including 20-minute cleaning buffer
    const CLEANING_BUFFER_MINUTES = 20;
    const bufferedStartTime = new Date(startTime.getTime() - CLEANING_BUFFER_MINUTES * 60 * 1000);
    const bufferedEndTime = new Date(endTime.getTime() + CLEANING_BUFFER_MINUTES * 60 * 1000);

    const overlapping = await this.showtimeRepository
      .createQueryBuilder('showtime')
      .where('showtime.auditoriumId = :auditoriumId', {
        auditoriumId: dto.auditoriumId,
      })
      .andWhere('showtime.status != :cancelledStatus', {
        cancelledStatus: ShowtimeStatus.CANCELLED,
      })
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const showtime = queryRunner.manager.create(Showtime, {
        movieId: dto.movieId,
        auditoriumId: dto.auditoriumId,
        startTime,
        endTime,
        experienceType: dto.experienceType || auditorium.experienceType,
        basePrice: dto.basePrice,
        status: dto.status || ShowtimeStatus.SCHEDULED,
      });

      const savedShowtime = await queryRunner.manager.save(Showtime, showtime);

      const seatPricings: ShowtimeSeatPricing[] = [];
      const customPricings = dto.customPricings ?? (dto as any).custom_pricings ?? [];
      if (customPricings && customPricings.length > 0) {
        for (const pricing of customPricings) {
          seatPricings.push(
            queryRunner.manager.create(ShowtimeSeatPricing, {
              showtimeId: savedShowtime.id,
              seatType: pricing.seatType ?? (pricing as any).seat_type,
              price: Number(pricing.price),
            }),
          );
        }
        await queryRunner.manager.save(ShowtimeSeatPricing, seatPricings);
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Created showtime ${savedShowtime.id} for movie "${movie.title}" in auditorium "${auditorium.name}"`,
      );

      savedShowtime.movie = movie;
      savedShowtime.auditorium = auditorium;
      savedShowtime.seatPricings = seatPricings;

      await this.cacheService.invalidateTags([
        `movie:${dto.movieId}`,
        `auditorium:${dto.auditoriumId}`,
        `cinema:${auditorium.cinemaId}`,
      ]);
      await this.cacheService.invalidatePatterns(['catalog:feed:*']);

      return this.mapToResponse(savedShowtime);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to create showtime: ${(error as Error).message}`,
      });
    } finally {
      await queryRunner.release();
    }
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
            rating_average: Number(movie.ratingAverage) || 0,
            rating_count: movie.ratingCount || 0,
            genres: (movie.genres || []).map((g) => ({
              id: g.id,
              name: g.name,
              slug: g.slug,
            })),
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
            city: cinema.city,
            address: cinema.address,
            latitude: cinema.latitude ? Number(cinema.latitude) : null,
            longitude: cinema.longitude ? Number(cinema.longitude) : null,
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
