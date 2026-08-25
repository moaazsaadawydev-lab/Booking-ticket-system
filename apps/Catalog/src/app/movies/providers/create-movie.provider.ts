import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Genre, Movie, OutboxMessage } from '@booking-ticket-system/Entities';
import { CreateMovieDto } from '@booking-ticket-system/DTOs';
import {
  ImageProfileType,
  MovieAgeRating,
  MovieStatus,
  OutboxStatus,
  slugify,
} from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class CreateMovieProvider {
  private readonly logger = new Logger(CreateMovieProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(dto: CreateMovieDto): Promise<any> {
    let slug = slugify(dto.title);
    const existingSlug = await this.movieRepository.findOne({
      where: { slug },
    });

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString().slice(-6)}`;
    }

    const genreIds = dto.genreIds ?? (dto as any).genre_ids ?? [];
    let genres: Genre[] = [];
    if (genreIds.length > 0) {
      genres = await this.genreRepository.find({
        where: { id: In(genreIds) },
      });
    }

    const movieId = randomUUID();
    const durationMinutes = Number(
      dto.durationMinutes ?? (dto as any).duration_minutes ?? 120,
    );
    const releaseDate = dto.releaseDate ?? (dto as any).release_date ?? new Date();
    
    let ageRating = dto.ageRating ?? (dto as any).age_rating;
    if (!ageRating || ageRating === 'undefined' || ageRating === 'PG-13') {
      ageRating = MovieAgeRating.PG_13;
    }

    let status = dto.status ?? (dto as any).status;
    if (!status || status === 'undefined') {
      status = MovieStatus.NOW_SHOWING;
    }

    const countryOfOrigin =
      dto.countryOfOrigin ?? (dto as any).country_of_origin ?? 'EG';
    let originalLanguage =
      dto.originalLanguage ?? (dto as any).original_language;
    if (!originalLanguage || originalLanguage === 'undefined') {
      originalLanguage = 'en';
    }
    const spokenLanguages =
      dto.spokenLanguages ?? (dto as any).spoken_languages ?? [];
    const subtitles = dto.subtitles ?? [];
    const trailerUrl = dto.trailerUrl ?? (dto as any).trailer_url ?? null;
    const directors = dto.directors ?? [];
    const cast = dto.cast ?? [];

    const rawPosterUrl =
      dto.posterUrl ??
      (dto as any).poster_url ??
      (dto as any).thumbnailUrl ??
      (dto as any).thumbnail_url ??
      null;
    const rawBannerUrl =
      dto.bannerUrl ??
      (dto as any).banner_url ??
      (dto as any).coverUrl ??
      (dto as any).cover_url ??
      null;
    const rawGalleryUrls: string[] =
      dto.galleryUrls ?? (dto as any).gallery_urls ?? [];

    const outboxItems: Array<{
      bucket: string;
      tempKey: string;
      finalKey: string;
      profileType: ImageProfileType;
    }> = [];

    let resolvedPosterUrl = rawPosterUrl;
    if (rawPosterUrl && rawPosterUrl.startsWith('temp/')) {
      const finalKey = `movies/${movieId}/thumbnails/${randomUUID()}.webp`;
      outboxItems.push({
        bucket: 'catalog',
        tempKey: rawPosterUrl,
        finalKey,
        profileType: ImageProfileType.MOVIE_THUMBNAIL,
      });
      resolvedPosterUrl = finalKey;
    }

    // Resolve Banner / Cover
    let resolvedBannerUrl = rawBannerUrl;
    if (rawBannerUrl && rawBannerUrl.startsWith('temp/')) {
      const finalKey = `movies/${movieId}/covers/${randomUUID()}.webp`;
      outboxItems.push({
        bucket: 'catalog',
        tempKey: rawBannerUrl,
        finalKey,
        profileType: ImageProfileType.MOVIE_COVER,
      });
      resolvedBannerUrl = finalKey;
    }

    // Resolve Gallery
    const resolvedGalleryUrls: string[] = [];
    for (const item of rawGalleryUrls) {
      if (item && item.startsWith('temp/')) {
        const finalKey = `movies/${movieId}/gallery/${randomUUID()}.webp`;
        outboxItems.push({
          bucket: 'catalog',
          tempKey: item,
          finalKey,
          profileType: ImageProfileType.MOVIE_GALLERY,
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
      const movie = queryRunner.manager.create(Movie, {
        id: movieId,
        title: dto.title,
        slug,
        description: dto.description,
        durationMinutes,
        releaseDate,
        ageRating,
        status: dto.status,
        countryOfOrigin,
        originalLanguage,
        spokenLanguages,
        subtitles,
        posterUrl: resolvedPosterUrl,
        bannerUrl: resolvedBannerUrl,
        trailerUrl,
        galleryUrls: resolvedGalleryUrls,
        directors,
        cast,
        genres,
        ratingAverage: 0,
        ratingCount: 0,
      });

      const savedMovie = await queryRunner.manager.save(Movie, movie);

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
      this.logger.log(
        `Created movie "${savedMovie.title}" (ID: ${savedMovie.id}) with ${outboxItems.length} media processing jobs`,
      );

      await this.cacheService.invalidatePatterns(['catalog:feed:*']);

      return this.mapToResponse(savedMovie);
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
