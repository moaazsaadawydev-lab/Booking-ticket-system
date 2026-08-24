import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovieAgeRating, MovieStatus } from '@booking-ticket-system/Utils';
import { TIMESTAMP } from '@booking-ticket-system/Constants';
import type { Genre } from './genre.entity';
import type { Showtime } from './showtime.entity';

@Entity('movies')
@Index(['slug'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['countryOfOrigin', 'originalLanguage', 'status'])
export class Movie {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  slug!: string;

  @Column({ type: 'text', nullable: false })
  description!: string;

  @Column({ name: 'duration_minutes', type: 'int', nullable: false })
  durationMinutes!: number;

  @Column({ name: 'release_date', type: 'date', nullable: false })
  releaseDate!: Date | string;

  @Column({
    name: 'age_rating',
    type: 'enum',
    enum: MovieAgeRating,
    nullable: false,
  })
  ageRating!: MovieAgeRating;

  @Column({
    type: 'enum',
    enum: MovieStatus,
    default: MovieStatus.COMING_SOON,
    nullable: false,
  })
  status!: MovieStatus;

  @Column({
    name: 'country_of_origin',
    type: 'varchar',
    length: 2,
    nullable: true,
    default: null,
  })
  countryOfOrigin!: string | null;

  @Column({
    name: 'original_language',
    type: 'varchar',
    length: 10,
    nullable: false,
    default: 'en',
  })
  originalLanguage!: string;

  @Column({
    name: 'spoken_languages',
    type: 'text',
    array: true,
    nullable: true,
    default: null,
  })
  spokenLanguages!: string[] | null;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    default: null,
  })
  subtitles!: string[] | null;

  @Column({ name: 'poster_url', type: 'varchar', length: 500, nullable: true, default: null })
  posterUrl!: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true, default: null })
  bannerUrl!: string | null;

  @Column({ name: 'trailer_url', type: 'varchar', length: 500, nullable: true, default: null })
  trailerUrl!: string | null;

  @Column({
    name: 'gallery_urls',
    type: 'text',
    array: true,
    nullable: false,
    default: '{}',
  })
  galleryUrls!: string[];

  @Column({ type: 'text', array: true, nullable: false, default: '{}' })
  directors!: string[];

  @Column({ type: 'text', array: true, nullable: false, default: '{}' })
  cast!: string[];

  @Column({
    name: 'rating_average',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0.0,
  })
  ratingAverage!: number;

  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount!: number;

  @ManyToMany('Genre', (genre: Genre) => genre.movies, { cascade: true })
  @JoinTable({
    name: 'movie_genres',
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres!: Genre[];

  @OneToMany('Showtime', (showtime: Showtime) => showtime.movie)
  showtimes!: Showtime[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => TIMESTAMP,
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => TIMESTAMP,
    onUpdate: TIMESTAMP,
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt?: Date | null;
}
