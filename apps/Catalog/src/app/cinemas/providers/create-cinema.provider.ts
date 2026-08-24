import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Cinema, CinemaAdmin, OutboxMessage } from '@booking-ticket-system/Entities';
import { CreateCinemaDto } from '@booking-ticket-system/DTOs';
import { ImageProfileType, OutboxStatus, slugify } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class CreateCinemaProvider {
  private readonly logger = new Logger(CreateCinemaProvider.name);

  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(dto: CreateCinemaDto): Promise<any> {
    let slug = slugify(dto.name);
    const existingSlug = await this.cinemaRepository.findOne({
      where: { slug },
    });

    if (existingSlug) {
      slug = `${slug}-${slugify(dto.city)}-${Date.now().toString().slice(-4)}`;
    }

    const cinemaId = randomUUID();
    const description = dto.description ?? (dto as any).description ?? null;
    const country = dto.country ?? (dto as any).country ?? 'EG';
    const rawThumbnailUrl = dto.thumbnailUrl ?? (dto as any).thumbnail_url ?? null;
    const rawGalleryUrls: string[] = dto.galleryUrls ?? (dto as any).gallery_urls ?? [];
    const phoneNumber = dto.phoneNumber ?? (dto as any).phone_number ?? null;
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto as any).is_active !== undefined ? (dto as any).is_active : true;
    const adminUserIds: string[] = dto.adminUserIds ?? (dto as any).admin_user_ids ?? [];

    const outboxItems: Array<{
      bucket: string;
      tempKey: string;
      finalKey: string;
      profileType: ImageProfileType;
    }> = [];

    // Resolve Cinema Thumbnail
    let resolvedThumbnailUrl = rawThumbnailUrl;
    if (rawThumbnailUrl && rawThumbnailUrl.startsWith('temp/')) {
      const finalKey = `cinemas/${cinemaId}/thumbnails/${randomUUID()}.webp`;
      outboxItems.push({
        bucket: 'catalog',
        tempKey: rawThumbnailUrl,
        finalKey,
        profileType: ImageProfileType.CINEMA_THUMBNAIL,
      });
      resolvedThumbnailUrl = finalKey;
    }

    // Resolve Cinema Gallery
    const resolvedGalleryUrls: string[] = [];
    for (const item of rawGalleryUrls) {
      if (item && item.startsWith('temp/')) {
        const finalKey = `cinemas/${cinemaId}/gallery/${randomUUID()}.webp`;
        outboxItems.push({
          bucket: 'catalog',
          tempKey: item,
          finalKey,
          profileType: ImageProfileType.CINEMA_GALLERY,
        });
        resolvedGalleryUrls.push(finalKey);
      } else if (item) {
        resolvedGalleryUrls.push(item);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cinema = queryRunner.manager.create(Cinema, {
        id: cinemaId,
        name: dto.name,
        slug,
        city: dto.city,
        country,
        address: dto.address,
        description,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        phoneNumber,
        facilities: dto.facilities || [],
        thumbnailUrl: resolvedThumbnailUrl,
        galleryUrls: resolvedGalleryUrls,
        isActive,
      });

      const savedCinema = await queryRunner.manager.save(Cinema, cinema);

      if (adminUserIds && adminUserIds.length > 0) {
        const adminEntities = adminUserIds.map((userId) =>
          queryRunner.manager.create(CinemaAdmin, {
            cinemaId: savedCinema.id,
            userId,
          }),
        );
        await queryRunner.manager.save(CinemaAdmin, adminEntities);
      }

      // Save atomic Outbox rows for each media item
      for (const item of outboxItems) {
        const outbox = queryRunner.manager.create(OutboxMessage, {
          eventType: 'PROCESS_CATALOG_MEDIA',
          payload: {
            bucket: item.bucket,
            tempKey: item.tempKey,
            finalKey: item.finalKey,
            profileType: item.profileType,
          },
          status: OutboxStatus.PENDING,
        });
        await queryRunner.manager.save(OutboxMessage, outbox);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Created cinema "${savedCinema.name}" (ID: ${savedCinema.id}) with ${outboxItems.length} media processing jobs`);

      await this.cacheService.invalidatePatterns(['catalog:feed:*']);

      const fullCinema = await this.cinemaRepository.findOne({
        where: { id: savedCinema.id },
        relations: {
          auditoriums: true,
          admins: true,
        },
      });

      return this.mapToResponse(fullCinema || savedCinema);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private mapToResponse(cinema: Cinema): any {
    return {
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
    };
  }
}
