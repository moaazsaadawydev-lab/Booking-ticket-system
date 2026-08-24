import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { randomUUID } from 'crypto';
import { Cinema, OutboxMessage } from '@booking-ticket-system/Entities';
import { UpdateCinemaDto } from '@booking-ticket-system/DTOs';
import { ImageProfileType, OutboxStatus, slugify } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class UpdateCinemaProvider {
  private readonly logger = new Logger(UpdateCinemaProvider.name);

  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(id: string, dto: UpdateCinemaDto): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Cinema ID is required',
      });
    }

    const cinema = await this.cinemaRepository.findOne({
      where: { id },
      relations: { auditoriums: true, admins: true },
    });

    if (!cinema) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Cinema with ID "${id}" not found`,
      });
    }

    if (dto.name && dto.name !== cinema.name) {
      let slug = slugify(dto.name);
      const existingSlug = await this.cinemaRepository.findOne({
        where: { slug },
      });
      if (existingSlug && existingSlug.id !== cinema.id) {
        slug = `${slug}-${slugify(dto.city || cinema.city)}-${Date.now().toString().slice(-4)}`;
      }
      cinema.name = dto.name;
      cinema.slug = slug;
    }

    const description = dto.description ?? (dto as any).description;
    const country = dto.country ?? (dto as any).country;
    const rawThumbnailUrl = dto.thumbnailUrl ?? (dto as any).thumbnail_url;
    const rawGalleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls;
    const phoneNumber = dto.phoneNumber ?? (dto as any).phone_number;
    const isActive =
      dto.isActive !== undefined
        ? dto.isActive
        : (dto as any).is_active !== undefined
          ? (dto as any).is_active
          : undefined;

    if (dto.city !== undefined) cinema.city = dto.city;
    if (country !== undefined) cinema.country = country;
    if (dto.address !== undefined) cinema.address = dto.address;
    if (description !== undefined) cinema.description = description;
    if (dto.latitude !== undefined) cinema.latitude = dto.latitude;
    if (dto.longitude !== undefined) cinema.longitude = dto.longitude;
    if (phoneNumber !== undefined) cinema.phoneNumber = phoneNumber;
    if (dto.facilities !== undefined) cinema.facilities = dto.facilities;
    if (isActive !== undefined) cinema.isActive = isActive;

    const outboxItems: Array<{
      bucket: string;
      tempKey: string;
      finalKey: string;
      profileType: ImageProfileType;
    }> = [];

    // Resolve Thumbnail
    if (rawThumbnailUrl !== undefined) {
      if (rawThumbnailUrl && rawThumbnailUrl.startsWith('temp/')) {
        const finalKey = `cinemas/${cinema.id}/thumbnails/${randomUUID()}.webp`;
        outboxItems.push({
          bucket: 'catalog',
          tempKey: rawThumbnailUrl,
          finalKey,
          profileType: ImageProfileType.CINEMA_THUMBNAIL,
        });
        cinema.thumbnailUrl = finalKey;
      } else {
        cinema.thumbnailUrl = rawThumbnailUrl;
      }
    }

    // Resolve Gallery
    if (rawGalleryUrls !== undefined) {
      const resolvedGallery: string[] = [];
      for (const item of rawGalleryUrls) {
        if (item && item.startsWith('temp/')) {
          const finalKey = `cinemas/${cinema.id}/gallery/${randomUUID()}.webp`;
          outboxItems.push({
            bucket: 'catalog',
            tempKey: item,
            finalKey,
            profileType: ImageProfileType.CINEMA_GALLERY,
          });
          resolvedGallery.push(finalKey);
        } else if (item) {
          resolvedGallery.push(item);
        }
      }
      cinema.galleryUrls = resolvedGallery;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updated = await queryRunner.manager.save(Cinema, cinema);

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
      this.logger.log(`Updated cinema "${updated.name}" (ID: ${updated.id}) with ${outboxItems.length} media processing jobs`);

      await this.cacheService.invalidateTags([`cinema:${id}`]);
      await this.cacheService.invalidatePatterns(['catalog:feed:*']);

      return {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description || null,
        city: updated.city,
        country: updated.country || 'EG',
        address: updated.address,
        latitude: updated.latitude ? Number(updated.latitude) : null,
        longitude: updated.longitude ? Number(updated.longitude) : null,
        phone_number: updated.phoneNumber || null,
        facilities: updated.facilities || [],
        thumbnail_url: updated.thumbnailUrl || null,
        gallery_urls: updated.galleryUrls || [],
        is_active: updated.isActive,
        admin_user_ids: (updated.admins || []).map((a) => a.userId),
        auditoriums: (updated.auditoriums || []).map((a) => ({
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
        created_at: updated.createdAt?.toISOString(),
        updated_at: updated.updatedAt?.toISOString(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
