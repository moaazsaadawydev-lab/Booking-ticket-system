import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Showtime } from '@booking-ticket-system/Entities';
import { ListShowtimesQueryDto } from '@booking-ticket-system/DTOs';

@Injectable()
export class ListShowtimesProvider {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
  ) {}

  async execute(query: ListShowtimesQueryDto): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .leftJoinAndSelect('showtime.auditorium', 'auditorium')
      .leftJoinAndSelect('auditorium.cinema', 'cinema')
      .leftJoinAndSelect('showtime.seatPricings', 'pricing');

    if (query.movieId) {
      qb.andWhere('showtime.movieId = :movieId', { movieId: query.movieId });
    }

    if (query.auditoriumId) {
      qb.andWhere('showtime.auditoriumId = :auditoriumId', {
        auditoriumId: query.auditoriumId,
      });
    }

    if (query.cinemaId) {
      qb.andWhere('auditorium.cinemaId = :cinemaId', {
        cinemaId: query.cinemaId,
      });
    }

    if (query.experienceType) {
      qb.andWhere('showtime.experienceType = :experienceType', {
        experienceType: query.experienceType,
      });
    }

    if (query.status) {
      qb.andWhere('showtime.status = :status', { status: query.status });
    }

    if (query.date) {
      const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
      const endOfDay = new Date(`${query.date}T23:59:59.999Z`);
      qb.andWhere('showtime.startTime BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      });
    } else {
      if (query.startDate) {
        qb.andWhere('showtime.startTime >= :startDate', {
          startDate: new Date(query.startDate),
        });
      }
      if (query.endDate) {
        qb.andWhere('showtime.endTime <= :endDate', {
          endDate: new Date(query.endDate),
        });
      }
    }

    qb.orderBy('showtime.startTime', 'ASC');
    qb.skip(skip).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((showtime) => ({
        id: showtime.id,
        movie_id: showtime.movieId,
        auditorium_id: showtime.auditoriumId,
        start_time: showtime.startTime?.toISOString(),
        end_time: showtime.endTime?.toISOString(),
        experience_type: showtime.experienceType,
        base_price: Number(showtime.basePrice),
        status: showtime.status,
        movie: showtime.movie
          ? {
              id: showtime.movie.id,
              title: showtime.movie.title,
              slug: showtime.movie.slug,
              description: showtime.movie.description,
              duration_minutes: showtime.movie.durationMinutes,
              release_date:
                showtime.movie.releaseDate instanceof Date
                  ? showtime.movie.releaseDate.toISOString().split('T')[0]
                  : String(showtime.movie.releaseDate),
              age_rating: showtime.movie.ageRating,
              status: showtime.movie.status,
              original_language: showtime.movie.originalLanguage,
              poster_url: showtime.movie.posterUrl,
              banner_url: showtime.movie.bannerUrl,
              trailer_url: showtime.movie.trailerUrl || null,
              rating_average: Number(showtime.movie.ratingAverage) || 0,
              rating_count: showtime.movie.ratingCount || 0,
              genres: (showtime.movie.genres || []).map((g) => ({
                id: g.id,
                name: g.name,
                slug: g.slug,
              })),
            }
          : null,
        auditorium: showtime.auditorium
          ? {
              id: showtime.auditorium.id,
              cinema_id: showtime.auditorium.cinemaId,
              name: showtime.auditorium.name,
              experience_type: showtime.auditorium.experienceType,
              sound_system: showtime.auditorium.soundSystem,
              total_rows: showtime.auditorium.totalRows,
              total_columns: showtime.auditorium.totalColumns,
              total_seats: showtime.auditorium.totalSeats,
              is_active: showtime.auditorium.isActive,
            }
          : null,
        cinema: showtime.auditorium?.cinema
          ? {
              id: showtime.auditorium.cinema.id,
              name: showtime.auditorium.cinema.name,
              slug: showtime.auditorium.cinema.slug,
              city: showtime.auditorium.cinema.city,
              address: showtime.auditorium.cinema.address,
              latitude: showtime.auditorium.cinema.latitude
                ? Number(showtime.auditorium.cinema.latitude)
                : null,
              longitude: showtime.auditorium.cinema.longitude
                ? Number(showtime.auditorium.cinema.longitude)
                : null,
              is_active: showtime.auditorium.cinema.isActive,
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
      })),
      meta: {
        total_items: totalItems,
        item_count: items.length,
        items_per_page: limit,
        total_pages: totalPages,
        current_page: page,
      },
    };
  }
}
