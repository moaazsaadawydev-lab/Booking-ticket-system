import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Showtime } from '@booking-ticket-system/Entities';
import { GroupedShowtimesQueryDto } from '@booking-ticket-system/DTOs';
import { ShowtimeStatus } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class GroupedShowtimesProvider {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(query: GroupedShowtimesQueryDto): Promise<any> {
    if (!query.movieId || !query.date) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'movieId and date are required',
      });
    }

    const cacheKey = `catalog:showtimes:movie:${query.movieId}:date:${query.date}${query.city ? ':city:' + query.city.trim().toLowerCase() : ''}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const startOfDay = new Date(`${query.date}T00:00:00.000Z`);
    const endOfDay = new Date(`${query.date}T23:59:59.999Z`);

    const qb = this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.auditorium', 'auditorium')
      .leftJoinAndSelect('auditorium.cinema', 'cinema')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('showtime.seatPricings', 'pricing')
      .where('showtime.movieId = :movieId', { movieId: query.movieId })
      .andWhere('showtime.startTime BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      })
      .andWhere('showtime.status != :cancelledStatus', {
        cancelledStatus: ShowtimeStatus.CANCELLED,
      });

    if (query.city && query.city.trim()) {
      qb.andWhere('cinema.city ILIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    qb.orderBy('cinema.name', 'ASC').addOrderBy('showtime.startTime', 'ASC');

    const showtimes = await qb.getMany();

    const cinemaMap = new Map<string, { cinema: any; showtimes: any[] }>();

    for (const st of showtimes) {
      const cinema = st.auditorium?.cinema;
      if (!cinema) continue;

      if (!cinemaMap.has(cinema.id)) {
        cinemaMap.set(cinema.id, {
          cinema: {
            id: cinema.id,
            name: cinema.name,
            slug: cinema.slug,
            city: cinema.city,
            address: cinema.address,
            latitude: cinema.latitude ? Number(cinema.latitude) : null,
            longitude: cinema.longitude ? Number(cinema.longitude) : null,
            phone_number: cinema.phoneNumber || null,
            facilities: cinema.facilities || [],
            is_active: cinema.isActive,
          },
          showtimes: [],
        });
      }

      cinemaMap.get(cinema.id)!.showtimes.push({
        id: st.id,
        movie_id: st.movieId,
        auditorium_id: st.auditoriumId,
        start_time: st.startTime?.toISOString(),
        end_time: st.endTime?.toISOString(),
        experience_type: st.experienceType,
        base_price: Number(st.basePrice),
        status: st.status,
        auditorium: {
          id: st.auditorium.id,
          name: st.auditorium.name,
          experience_type: st.auditorium.experienceType,
          sound_system: st.auditorium.soundSystem,
        },
        seat_pricings: (st.seatPricings || []).map((p) => ({
          id: p.id,
          seat_type: p.seatType,
          price: Number(p.price),
        })),
      });
    }

    const result = {
      movie_id: query.movieId,
      date: query.date,
      cinemas: Array.from(cinemaMap.values()),
    };

    await this.cacheService.set(cacheKey, result, 600, [
      `movie:${query.movieId}`,
    ]);

    return result;
  }
}
