import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { randomUUID } from 'crypto';
import { Genre, Movie, OutboxMessage } from '@booking-ticket-system/Entities';
import { UpdateMovieDto } from '@booking-ticket-system/DTOs';
import { ImageProfileType, OutboxStatus, slugify } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class UpdateMovieProvider {
  private readonly logger = new Logger(UpdateMovieProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(id: string, dto: UpdateMovieDto): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Movie ID is required',
      });
    }

    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: { genres: true },
    });

    if (!movie) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Movie with ID "${id}" not found`,
      });
    }

    if (dto.title && dto.title !== movie.title) {
      let slug = slugify(dto.title);
      const existingSlug = await this.movieRepository.findOne({
        where: { slug },
      });
      if (existingSlug && existingSlug.id !== movie.id) {
        slug = `${slug}-${Date.now().toString().slice(-6)}`;
      }
      movie.title = dto.title;
      movie.slug = slug;
    }

    const durationMinutes =
      dto.durationMinutes !== undefined
        ? Number(dto.durationMinutes)
        : (dto as any).duration_minutes !== undefined
          ? Number((dto as any).duration_minutes)
          : undefined;

    const releaseDate = dto.releaseDate ?? (dto as any).release_date;
    const ageRating = dto.ageRating ?? (dto as any).age_rating;
    const countryOfOrigin = dto.countryOfOrigin ?? (dto as any).country_of_origin;
    const originalLanguage = dto.originalLanguage ?? (dto as any).original_language;
    const spokenLanguages = dto.spokenLanguages ?? (dto as any).spoken_languages;
    const rawPosterUrl = dto.posterUrl ?? (dto as any).poster_url ?? (dto as any).thumbnailUrl ?? (dto as any).thumbnail_url;
    const rawBannerUrl = dto.bannerUrl ?? (dto as any).banner_url ?? (dto as any).coverUrl ?? (dto as any).cover_url;
    const trailerUrl = dto.trailerUrl ?? (dto as any).trailer_url;
    const rawGalleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls;
    const genreIds = dto.genreIds ?? (dto as any).genre_ids;

    if (dto.description !== undefined) movie.description = dto.description;
    if (durationMinutes !== undefined) movie.durationMinutes = durationMinutes;
    if (releaseDate !== undefined) movie.releaseDate = releaseDate;
    if (ageRating !== undefined) movie.ageRating = ageRating;
    if (dto.status !== undefined) movie.status = dto.status;
    if (countryOfOrigin !== undefined) movie.countryOfOrigin = countryOfOrigin;
    if (originalLanguage !== undefined) movie.originalLanguage = originalLanguage;
    if (spokenLanguages !== undefined) movie.spokenLanguages = spokenLanguages;
    if (dto.subtitles !== undefined) movie.subtitles = dto.subtitles;
    if (trailerUrl !== undefined) movie.trailerUrl = trailerUrl;
    if (dto.directors !== undefined) movie.directors = dto.directors;
    if (dto.cast !== undefined) movie.cast = dto.cast;

    const rawGenres = dto.genreIds ?? (dto as any).genre_ids ?? (dto as any).genres;
    if (rawGenres !== undefined) {
      if (Array.isArray(rawGenres) && rawGenres.length > 0) {
        const isUUID = (str: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        const uuidList: string[] = [];
        const nameList: string[] = [];
        for (const g of rawGenres) {
          if (typeof g === 'string') {
            const trimmed = g.trim();
            if (isUUID(trimmed)) {
              uuidList.push(trimmed);
            } else {
              nameList.push(trimmed);
            }
          }
        }

        const conditions: any[] = [];
        if (uuidList.length > 0) {
          conditions.push({ id: In(uuidList) });
        }
        if (nameList.length > 0) {
          conditions.push({ name: In(nameList) });
          conditions.push({ slug: In(nameList.map((n) => n.toLowerCase().trim())) });
        }

        if (conditions.length > 0) {
          movie.genres = await this.genreRepository.find({
            where: conditions,
          });
        } else {
          movie.genres = [];
        }
      } else {
        movie.genres = [];
      }
    }

    const outboxItems: Array<{
      bucket: string;
      tempKey: string;
      finalKey: string;
      profileType: ImageProfileType;
    }> = [];

    // Resolve Poster / Thumbnail
    if (rawPosterUrl !== undefined) {
      if (rawPosterUrl && rawPosterUrl.startsWith('temp/')) {
        const finalKey = `movies/${movie.id}/thumbnails/${randomUUID()}.webp`;
        outboxItems.push({
          bucket: 'catalog',
          tempKey: rawPosterUrl,
          finalKey,
          profileType: ImageProfileType.MOVIE_THUMBNAIL,
        });
        movie.posterUrl = finalKey;
      } else {
        movie.posterUrl = rawPosterUrl;
      }
    }

    // Resolve Banner / Cover
    if (rawBannerUrl !== undefined) {
      if (rawBannerUrl && rawBannerUrl.startsWith('temp/')) {
        const finalKey = `movies/${movie.id}/covers/${randomUUID()}.webp`;
        outboxItems.push({
          bucket: 'catalog',
          tempKey: rawBannerUrl,
          finalKey,
          profileType: ImageProfileType.MOVIE_COVER,
        });
        movie.bannerUrl = finalKey;
      } else {
        movie.bannerUrl = rawBannerUrl;
      }
    }

    // Resolve Gallery
    if (rawGalleryUrls !== undefined) {
      const resolvedGallery: string[] = [];
      for (const item of rawGalleryUrls) {
        if (item && item.startsWith('temp/')) {
          const finalKey = `movies/${movie.id}/gallery/${randomUUID()}.webp`;
          outboxItems.push({
            bucket: 'catalog',
            tempKey: item,
            finalKey,
            profileType: ImageProfileType.MOVIE_GALLERY,
          });
          resolvedGallery.push(finalKey);
        } else if (item) {
          resolvedGallery.push(item);
        }
      }
      movie.galleryUrls = resolvedGallery;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const updated = await queryRunner.manager.save(Movie, movie);

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
      this.logger.log(`Updated movie "${updated.title}" (ID: ${updated.id}) with ${outboxItems.length} media processing jobs`);

      await this.cacheService.invalidateTags([`movie:${id}`]);
      await this.cacheService.invalidatePatterns(['catalog:feed:*']);

      return this.mapToResponse(updated);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private mapToResponse(movie: Movie): any {
    return {
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
      country_of_origin: movie.countryOfOrigin || null,
      original_language: movie.originalLanguage,
      spoken_languages: movie.spokenLanguages || [],
      subtitles: movie.subtitles || [],
      poster_url: movie.posterUrl || null,
      banner_url: movie.bannerUrl || null,
      trailer_url: movie.trailerUrl || null,
      gallery_urls: movie.galleryUrls || [],
      directors: movie.directors || [],
      cast: movie.cast || [],
      rating_average: Number(movie.ratingAverage) || 0,
      rating_count: movie.ratingCount || 0,
      genres: (movie.genres || []).map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        created_at: g.createdAt?.toISOString(),
        updated_at: g.updatedAt?.toISOString(),
      })),
      created_at: movie.createdAt?.toISOString(),
      updated_at: movie.updatedAt?.toISOString(),
    };
  }
}
