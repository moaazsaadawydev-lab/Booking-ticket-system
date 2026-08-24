import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '@booking-ticket-system/Entities';
import { MovieStatus } from '@booking-ticket-system/Utils';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

export interface DiscoveryFeedInput {
  country?: string;
  language?: string;
  limit?: number;
}

@Injectable()
export class GetDiscoveryFeedProvider {
  private readonly logger = new Logger(GetDiscoveryFeedProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(input: DiscoveryFeedInput): Promise<any> {
    const targetCountry = (input.country || 'EG').trim().toUpperCase();
    const targetLanguage = (input.language || 'ar').trim().toLowerCase();
    const limit = Math.max(1, Math.min(50, Number(input.limit) || 10));

    const cacheKey = `catalog:feed:${targetCountry}:${targetLanguage}:${limit}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached !== undefined && cached !== null) {
      this.logger.log(`Cache HIT for discovery feed: ${cacheKey}`);
      return cached;
    }

    this.logger.log(
      `Generating discovery feed for country: ${targetCountry}, language: ${targetLanguage}, limit: ${limit}`,
    );

    // 1. Section 1: Now Showing Local
    // Movies with status NOW_SHOWING scheduled in auditoriums of cinemas in targetCountry
    let nowShowingLocal = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .innerJoin('movie.showtimes', 'showtime')
      .innerJoin('showtime.auditorium', 'auditorium')
      .innerJoin('auditorium.cinema', 'cinema')
      .where('cinema.country = :country', { country: targetCountry })
      .andWhere('movie.status = :status', { status: MovieStatus.NOW_SHOWING })
      .andWhere('showtime.startTime >= :now', { now: new Date() })
      .distinct(true)
      .limit(limit)
      .getMany();

    // Fallback: If no future showtimes match, return NOW_SHOWING movies matching target country or general NOW_SHOWING
    if (nowShowingLocal.length === 0) {
      nowShowingLocal = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.genres', 'genre')
        .where('movie.status = :status', { status: MovieStatus.NOW_SHOWING })
        .andWhere('(movie.countryOfOrigin = :country OR movie.originalLanguage = :language)', {
          country: targetCountry,
          language: targetLanguage,
        })
        .limit(limit)
        .getMany();

      if (nowShowingLocal.length === 0) {
        nowShowingLocal = await this.movieRepository
          .createQueryBuilder('movie')
          .leftJoinAndSelect('movie.genres', 'genre')
          .where('movie.status = :status', { status: MovieStatus.NOW_SHOWING })
          .limit(limit)
          .getMany();
      }
    }

    // 2. Section 2: Coming Soon Local
    // Upcoming movies matching user country or language, ordered by earliest release date
    let comingSoonLocal = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .where('movie.status = :status', { status: MovieStatus.COMING_SOON })
      .andWhere('(movie.countryOfOrigin = :country OR movie.originalLanguage = :language)', {
        country: targetCountry,
        language: targetLanguage,
      })
      .orderBy('movie.releaseDate', 'ASC')
      .limit(limit)
      .getMany();

    // Fallback if no specific localized upcoming movies exist
    if (comingSoonLocal.length === 0) {
      comingSoonLocal = await this.movieRepository
        .createQueryBuilder('movie')
        .leftJoinAndSelect('movie.genres', 'genre')
        .where('movie.status = :status', { status: MovieStatus.COMING_SOON })
        .orderBy('movie.releaseDate', 'ASC')
        .limit(limit)
        .getMany();
    }

    // 3. Section 3: Featured (Dynamic Relevance Scoring)
    // discovery_score = (is_language * 40) + (is_country * 30) + (rating_average * 6)
    const featured = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .addSelect(
        `((CASE WHEN movie.original_language = :language THEN 40 ELSE 0 END) + ` +
          `(CASE WHEN movie.country_of_origin = :country THEN 30 ELSE 0 END) + ` +
          `(COALESCE(movie.rating_average, 0) * 6))`,
        'discovery_score',
      )
      .where('movie.status IN (:...statuses)', {
        statuses: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON],
      })
      .setParameters({ language: targetLanguage, country: targetCountry })
      .orderBy('discovery_score', 'DESC')
      .addOrderBy('movie.ratingAverage', 'DESC')
      .addOrderBy('movie.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    // 4. Section 4: Top Rated
    const topRated = await this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .where('movie.status IN (:...statuses)', {
        statuses: [MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON],
      })
      .orderBy('movie.ratingAverage', 'DESC')
      .addOrderBy('movie.ratingCount', 'DESC')
      .limit(limit)
      .getMany();

    const feedResult = {
      featured: featured.map((m) => this.mapToResponse(m)),
      now_showing_local: nowShowingLocal.map((m) => this.mapToResponse(m)),
      coming_soon_local: comingSoonLocal.map((m) => this.mapToResponse(m)),
      top_rated: topRated.map((m) => this.mapToResponse(m)),
    };

    await this.cacheService.set(cacheKey, feedResult, 1800, [
      `feed:${targetCountry}`,
    ]);

    return feedResult;
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
