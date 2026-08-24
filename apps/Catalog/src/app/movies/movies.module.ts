import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genre, Movie, Showtime } from '@booking-ticket-system/Entities';
import { MoviesController } from './movies.controller';
import { CreateMovieProvider } from './providers/create-movie.provider';
import { GetMovieProvider } from './providers/get-movie.provider';
import { ListMoviesProvider } from './providers/list-movies.provider';
import { SearchMoviesProvider } from './providers/search-movies.provider';
import { UpdateMovieProvider } from './providers/update-movie.provider';
import { DeleteMovieProvider } from './providers/delete-movie.provider';
import { ListGenresProvider } from './providers/list-genres.provider';
import { GetDiscoveryFeedProvider } from './providers/get-discovery-feed.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Movie, Genre, Showtime])],
  controllers: [MoviesController],
  providers: [
    CreateMovieProvider,
    GetMovieProvider,
    ListMoviesProvider,
    SearchMoviesProvider,
    UpdateMovieProvider,
    DeleteMovieProvider,
    ListGenresProvider,
    GetDiscoveryFeedProvider,
  ],
  exports: [
    CreateMovieProvider,
    GetMovieProvider,
    ListMoviesProvider,
    SearchMoviesProvider,
    UpdateMovieProvider,
    DeleteMovieProvider,
    ListGenresProvider,
    GetDiscoveryFeedProvider,
  ],
})
export class MoviesModule {}
