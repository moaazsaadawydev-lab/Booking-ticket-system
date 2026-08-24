import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogCacheService } from './catalog-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CatalogCacheService],
  exports: [CatalogCacheService],
})
export class CatalogCacheModule {}
