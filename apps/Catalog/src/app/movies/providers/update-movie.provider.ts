import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Genre, Movie } from '@booking-ticket-system/Entities';
import { UpdateMovieDto } from '@booking-ticket-system/DTOs';
import { slugify } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class UpdateMovieProvider {
  private readonly logger = new Logger(UpdateMovieProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
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
    const posterUrl = dto.posterUrl ?? (dto as any).poster_url;
    const bannerUrl = dto.bannerUrl ?? (dto as any).banner_url;
    const trailerUrl = dto.trailerUrl ?? (dto as any).trailer_url;
    const galleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls;
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
    if (posterUrl !== undefined) movie.posterUrl = posterUrl;
    if (bannerUrl !== undefined) movie.bannerUrl = bannerUrl;
    if (trailerUrl !== undefined) movie.trailerUrl = trailerUrl;
    if (galleryUrls !== undefined) movie.galleryUrls = galleryUrls;
    if (dto.directors !== undefined) movie.directors = dto.directors;
    if (dto.cast !== undefined) movie.cast = dto.cast;

    if (genreIds !== undefined) {
      if (genreIds.length > 0) {
        movie.genres = await this.genreRepository.find({
          where: { id: In(genreIds) },
        });
      } else {
        movie.genres = [];
      }
    }

    const updated = await this.movieRepository.save(movie);
    this.logger.log(`Updated movie "${updated.title}" (ID: ${updated.id})`);

    await this.cacheService.invalidateTags([`movie:${id}`]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return this.mapToResponse(updated);
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
