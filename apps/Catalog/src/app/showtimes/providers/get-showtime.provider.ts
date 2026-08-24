import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Showtime } from '@booking-ticket-system/Entities';

@Injectable()
export class GetShowtimeProvider {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
  ) {}

  async execute(id: string): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Showtime ID is required',
      });
    }

    const showtime = await this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .leftJoinAndSelect('showtime.auditorium', 'auditorium')
      .leftJoinAndSelect('auditorium.cinema', 'cinema')
      .leftJoinAndSelect('showtime.seatPricings', 'pricing')
      .where('showtime.id = :id', { id })
      .getOne();

    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID "${id}" not found`,
      });
    }

    return this.mapToResponse(showtime);
  }

  public mapToResponse(showtime: Showtime): any {
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
            trailer_url: movie.trailerUrl || null,
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
