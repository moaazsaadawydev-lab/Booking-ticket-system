import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Movie, Showtime } from '@booking-ticket-system/Entities';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class DeleteMovieProvider {
  private readonly logger = new Logger(DeleteMovieProvider.name);

  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Movie ID is required',
      });
    }

    const movie = await this.movieRepository.findOne({ where: { id } });

    if (!movie) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Movie with ID "${id}" not found`,
      });
    }

    const activeShowtimes = await this.showtimeRepository.count({
      where: { movieId: id },
    });

    if (activeShowtimes > 0) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: `Cannot delete movie with ${activeShowtimes} associated showtimes. Remove showtimes first or archive movie.`,
      });
    }

    await this.movieRepository.softRemove(movie);
    this.logger.log(`Soft-deleted movie "${movie.title}" (ID: ${movie.id})`);

    await this.cacheService.invalidateTags([`movie:${id}`]);
    await this.cacheService.invalidatePatterns(['catalog:feed:*']);

    return {
      success: true,
      message: `Movie "${movie.title}" deleted successfully`,
    };
  }
}
