import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cinema } from '@booking-ticket-system/Entities';
import { ListCinemasQueryDto } from '@booking-ticket-system/DTOs';

@Injectable()
export class ListCinemasProvider {
  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
  ) {}

  async execute(query: ListCinemasQueryDto): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const qb = this.cinemaRepository
      .createQueryBuilder('cinema')
      .leftJoinAndSelect('cinema.auditoriums', 'auditorium')
      .leftJoinAndSelect('cinema.admins', 'admin');

    if (query.city && query.city.trim()) {
      qb.andWhere('cinema.city ILIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    const country = query.country ?? (query as any).country;
    if (country && country.trim()) {
      qb.andWhere('cinema.country = :country', {
        country: country.trim().toUpperCase(),
      });
    }

    if (query.search && query.search.trim()) {
      qb.andWhere(
        '(cinema.name ILIKE :search OR cinema.address ILIKE :search OR cinema.city ILIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    const isActive =
      query.isActive !== undefined
        ? query.isActive
        : (query as any).is_active !== undefined
          ? (query as any).is_active
          : undefined;

    if (isActive !== undefined) {
      qb.andWhere('cinema.isActive = :isActive', {
        isActive,
      });
    }

    qb.orderBy('cinema.name', 'ASC');
    qb.skip(skip).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((cinema) => ({
        id: cinema.id,
        name: cinema.name,
        slug: cinema.slug,
        description: cinema.description || null,
        city: cinema.city,
        country: cinema.country || 'EG',
        address: cinema.address,
        latitude: cinema.latitude ? Number(cinema.latitude) : null,
        longitude: cinema.longitude ? Number(cinema.longitude) : null,
        phone_number: cinema.phoneNumber || null,
        facilities: cinema.facilities || [],
        thumbnail_url: cinema.thumbnailUrl || null,
        gallery_urls: cinema.galleryUrls || [],
        is_active: cinema.isActive,
        admin_user_ids: (cinema.admins || []).map((a) => a.userId),
        auditoriums: (cinema.auditoriums || []).map((a) => ({
          id: a.id,
          cinema_id: a.cinemaId,
          name: a.name,
          experience_type: a.experienceType,
          sound_system: a.soundSystem || null,
          total_rows: a.totalRows,
          total_columns: a.totalColumns,
          total_seats: a.totalSeats,
          is_active: a.isActive,
          created_at: a.createdAt?.toISOString(),
          updated_at: a.updatedAt?.toISOString(),
        })),
        created_at: cinema.createdAt?.toISOString(),
        updated_at: cinema.updatedAt?.toISOString(),
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
