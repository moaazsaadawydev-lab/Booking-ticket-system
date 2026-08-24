import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@booking-ticket-system/Entities';
import { SearchMoviesQueryDto } from '@booking-ticket-system/DTOs';

@Injectable()
export class SearchMoviesProvider {
  private readonly logger = new Logger(SearchMoviesProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async execute(dto: SearchMoviesQueryDto): Promise<any> {
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(dto.limit) || 10));
    const skip = (page - 1) * limit;
    const similarityThreshold =
      dto.similarityThreshold !== undefined
        ? Number(dto.similarityThreshold)
        : 0.25;

    const qb = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre');

    const searchStr = dto.query
      ? String(dto.query)
          .replace(/<[^>]*>?/gm, '')
          .replace(/[<>'"&;]/g, '')
          .trim()
      : '';

    if (searchStr) {
      this.logger.log(
        `Executing fuzzy trigram search for: "${searchStr}" (threshold: ${similarityThreshold})`,
      );
      qb.addSelect(
        'GREATEST(similarity(movie.title, :query), word_similarity(:query, movie.title))',
        'similarity_score',
      );
      qb.andWhere(
        '(GREATEST(similarity(movie.title, :query), word_similarity(:query, movie.title)) >= :similarityThreshold OR movie.title ILIKE :contains)',
        {
          query: searchStr,
          similarityThreshold,
          contains: `%${searchStr}%`,
        },
      );
      qb.orderBy('similarity_score', 'DESC');
      qb.addOrderBy('movie.releaseDate', 'DESC');
    } else {
      qb.orderBy('movie.releaseDate', 'DESC');
      qb.addOrderBy('movie.createdAt', 'DESC');
    }

    // Year Range Filtering
    if (dto.fromYear) {
      qb.andWhere('movie.releaseDate >= :fromYearDate', {
        fromYearDate: `${dto.fromYear}-01-01`,
      });
    }

    if (dto.toYear) {
      qb.andWhere('movie.releaseDate <= :toYearDate', {
        toYearDate: `${dto.toYear}-12-31`,
      });
    }

    // Exact Date Range Filtering
    if (dto.fromDate) {
      qb.andWhere('movie.releaseDate >= :fromDate', {
        fromDate: dto.fromDate,
      });
    }

    if (dto.toDate) {
      qb.andWhere('movie.releaseDate <= :toDate', {
        toDate: dto.toDate,
      });
    }

    qb.skip(skip).take(limit);

    const [items, totalItems] = await qb.getManyAndCount();
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items.map((movie) => ({
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
