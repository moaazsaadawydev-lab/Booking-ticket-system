import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from '@booking-ticket-system/Entities';
import { CatalogCacheService } from '../../cache/catalog-cache.service';

@Injectable()
export class ListGenresProvider {
  constructor(
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
    private readonly cacheService: CatalogCacheService,
  ) {}

  async execute(): Promise<any> {
    const cacheKey = 'catalog:genres:all';
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    const genres = await this.genreRepository.find({
      order: { name: 'ASC' },
    });

    const response = {
      genres: genres.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        created_at: g.createdAt?.toISOString(),
        updated_at: g.updatedAt?.toISOString(),
      })),
    };

    await this.cacheService.set(cacheKey, response, 86400, ['genres:all']);
    return response;
  }
}
