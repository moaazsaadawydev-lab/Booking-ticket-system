import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Movie } from '@booking-ticket-system/Entities';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class GetMovieProvider {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async getById(id: string): Promise<any> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Movie ID is required',
      });
    }

    const cacheKey = `catalog:movie:id:${id}`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached !== undefined) {
      if (cached === null) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Movie with ID "${id}" not found`,
        });
      }
      return cached;
    }

    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: { genres: true },
    });

    if (!movie) {
      await this.cacheService.setNullSentinel(cacheKey, 60);
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Movie with ID "${id}" not found`,
      });
    }

    const response = this.mapToResponse(movie);
    await this.cacheService.set(cacheKey, response, 14400, [`movie:${id}`]);
    if (movie.slug) {
      await this.cacheService.set(
        `catalog:movie:slug:${movie.slug}`,
        response,
        14400,
        [`movie:${id}`],
      );
    }

    return response;
  }

  async getBySlug(slug: string): Promise<any> {
    if (!slug) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Movie slug is required',
      });
    }

    const cacheKey = `catalog:movie:slug:${slug}`;
    const cached = await this.cacheService.get<any>(cacheKey);

    if (cached !== undefined) {
      if (cached === null) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Movie with slug "${slug}" not found`,
        });
      }
      return cached;
    }

    const movie = await this.movieRepository.findOne({
      where: { slug },
      relations: { genres: true },
    });

    if (!movie) {
      await this.cacheService.setNullSentinel(cacheKey, 60);
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Movie with slug "${slug}" not found`,
      });
    }

    const response = this.mapToResponse(movie);
    await this.cacheService.set(cacheKey, response, 14400, [`movie:${movie.id}`]);
    await this.cacheService.set(
      `catalog:movie:id:${movie.id}`,
      response,
      14400,
      [`movie:${movie.id}`],
    );

    return response;
  }

  public mapToResponse(movie: Movie): any {
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
