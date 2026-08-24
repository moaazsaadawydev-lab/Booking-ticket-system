import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Showtime, ShowtimeSeatPricing } from '@booking-ticket-system/Entities';
import { SetShowtimeSeatPricingsDto } from '@booking-ticket-system/DTOs';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class ShowtimePricingProvider {
  private readonly logger = new Logger(ShowtimePricingProvider.name);

  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(ShowtimeSeatPricing)
    private readonly pricingRepository: Repository<ShowtimeSeatPricing>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async setPricings(dto: SetShowtimeSeatPricingsDto): Promise<any> {
    const showtimeId = dto.showtimeId ?? (dto as any).showtime_id;
    const rawPricings =
      dto.pricings ?? (dto as any).custom_pricings ?? (dto as any).customPricings ?? [];

    if (!showtimeId || !Array.isArray(rawPricings) || rawPricings.length === 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'showtimeId and a non-empty pricings array are required',
      });
    }

    const showtime = await this.showtimeRepository.findOne({
      where: { id: showtimeId },
      relations: {
        movie: { genres: true },
        auditorium: { cinema: true },
      },
    });

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${showtimeId}" not found`,
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.delete(ShowtimeSeatPricing, {
        showtimeId,
      });

      const entities = rawPricings.map((p: any) =>
        queryRunner.manager.create(ShowtimeSeatPricing, {
          showtimeId,
          seatType: p.seatType ?? p.seat_type,
          price: Number(p.price),
        }),
      );

      await queryRunner.manager.save(ShowtimeSeatPricing, entities);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Set ${entities.length} seat pricings for showtime ${showtimeId}`,
      );

      const updatedPricings = await this.pricingRepository.find({
        where: { showtimeId },
      });

      showtime.seatPricings = updatedPricings;

      await this.cacheService.invalidateTags([
        `movie:${showtime.movieId}`,
        `auditorium:${showtime.auditoriumId}`,
      ]);

      return this.mapToResponse(showtime);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to set seat pricings: ${(error as Error).message}`,
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
