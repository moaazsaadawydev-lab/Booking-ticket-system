import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MovieAgeRating, MovieStatus } from '@booking-ticket-system/Utils';
import { IsUrlOrTempKey } from './validators/is-url-or-temp-key.decorator';

export class CreateMovieDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Transform(({ obj }) =>
    obj.duration_minutes !== undefined
      ? Number(obj.duration_minutes)
      : obj.durationMinutes !== undefined
        ? Number(obj.durationMinutes)
        : undefined,
  )
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @Transform(({ obj }) => obj.release_date ?? obj.releaseDate)
  @IsDateString()
  releaseDate!: string;

  @Transform(({ obj }) => obj.age_rating ?? obj.ageRating)
  @IsEnum(MovieAgeRating)
  ageRating!: MovieAgeRating;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @Transform(({ obj }) => obj.country_of_origin ?? obj.countryOfOrigin)
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryOfOrigin?: string;

  @Transform(({ obj }) => obj.original_language ?? obj.originalLanguage)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  originalLanguage!: string;

  @Transform(({ obj }) => obj.spoken_languages ?? obj.spokenLanguages)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spokenLanguages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtitles?: string[];

  @Transform(({ obj }) => obj.poster_url ?? obj.posterUrl ?? obj.thumbnail_url ?? obj.thumbnailUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  posterUrl?: string;

  @Transform(({ obj }) => obj.banner_url ?? obj.bannerUrl ?? obj.cover_url ?? obj.coverUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  bannerUrl?: string;

  @Transform(({ obj }) => obj.trailer_url ?? obj.trailerUrl)
  @IsOptional()
  @IsUrl({}, { message: 'trailerUrl must be a valid URL' })
  trailerUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsUrlOrTempKey({ each: true })
  galleryUrls?: string[];

  @IsArray()
  @IsString({ each: true })
  directors!: string[];

  @IsArray()
  @IsString({ each: true })
  cast!: string[];

  @Transform(({ obj }) => obj.genre_ids ?? obj.genreIds)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ obj }) =>
    obj.duration_minutes !== undefined
      ? Number(obj.duration_minutes)
      : obj.durationMinutes !== undefined
        ? Number(obj.durationMinutes)
        : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @Transform(({ obj }) => obj.release_date ?? obj.releaseDate)
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @Transform(({ obj }) => obj.age_rating ?? obj.ageRating)
  @IsOptional()
  @IsEnum(MovieAgeRating)
  ageRating?: MovieAgeRating;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @Transform(({ obj }) => obj.country_of_origin ?? obj.countryOfOrigin)
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryOfOrigin?: string;

  @Transform(({ obj }) => obj.original_language ?? obj.originalLanguage)
  @IsOptional()
  @IsString()
  @MaxLength(10)
  originalLanguage?: string;

  @Transform(({ obj }) => obj.spoken_languages ?? obj.spokenLanguages)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spokenLanguages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtitles?: string[];

  @Transform(({ obj }) => obj.poster_url ?? obj.posterUrl ?? obj.thumbnail_url ?? obj.thumbnailUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  posterUrl?: string;

  @Transform(({ obj }) => obj.banner_url ?? obj.bannerUrl ?? obj.cover_url ?? obj.coverUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  bannerUrl?: string;

  @Transform(({ obj }) => obj.trailer_url ?? obj.trailerUrl)
  @IsOptional()
  @IsUrl({}, { message: 'trailerUrl must be a valid URL' })
  trailerUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsUrlOrTempKey({ each: true })
  galleryUrls?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  directors?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cast?: string[];

  @Transform(({ obj }) => obj.genre_ids ?? obj.genreIds)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  genreIds?: string[];
}

export class ListMoviesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(MovieStatus)
  status?: MovieStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @Transform(({ obj }) => obj.genre_id ?? obj.genreId)
  @IsOptional()
  @IsUUID('4')
  genreId?: string;

  @Transform(({ obj }) => obj.genre_slug ?? obj.genreSlug)
  @IsOptional()
  @IsString()
  genreSlug?: string;
}

export class DiscoveryFeedQueryDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

export class SearchMoviesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/[<>'"&;]/g, '').trim()
      : value,
  )
  query?: string;

  @Transform(({ obj }) =>
    obj.from_year !== undefined
      ? Number(obj.from_year)
      : obj.fromYear !== undefined
        ? Number(obj.fromYear)
        : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2030)
  @Type(() => Number)
  fromYear?: number;

  @Transform(({ obj }) =>
    obj.to_year !== undefined
      ? Number(obj.to_year)
      : obj.toYear !== undefined
        ? Number(obj.toYear)
        : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2030)
  @Type(() => Number)
  toYear?: number;

  @Transform(({ obj }) => obj.from_date ?? obj.fromDate)
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @Transform(({ obj }) => obj.to_date ?? obj.toDate)
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @Transform(({ obj }) =>
    obj.similarity_threshold !== undefined
      ? Number(obj.similarity_threshold)
      : obj.similarityThreshold !== undefined
        ? Number(obj.similarityThreshold)
        : 0.25,
  )
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  @Type(() => Number)
  similarityThreshold?: number = 0.25;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

