import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const NULL_SENTINEL = '__NULL__';

@Injectable()
export class CatalogCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogCacheService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    this.initRedis();
  }

  private initRedis() {
    try {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port =
        Number(this.configService.get<number | string>('REDIS_PORT')) || 6379;
      const password = this.configService.get<string>('REDIS_PASSWORD');

      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        connectTimeout: 5000,
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Catalog Redis Cache connected at ${host}:${port}`);
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Catalog Redis Cache error (failing open): ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.error(`Failed to initialize Redis client: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Catalog Redis connection closed gracefully.');
      } catch (err: any) {
        this.logger.error(`Error closing Redis connection: ${err.message}`);
      }
    }
  }

  /**
   * Get cached data.
   * Returns:
   * - `undefined`: Cache miss (or Redis unavailable) -> fetch from DB.
   * - `null`: Cached NULL sentinel (entity does not exist, avoid DB hammering).
   * - `T`: Cached entity payload.
   */
  async get<T>(key: string): Promise<T | null | undefined> {
    if (!this.client || !this.isConnected) {
      return undefined;
    }

    try {
      const data = await this.client.get(key);
      if (data === null) {
        return undefined; // Cache miss
      }

      if (data === NULL_SENTINEL) {
        return null; // Cached not found
      }

      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch (err: any) {
      this.logger.warn(`Redis GET error for key "${key}": ${err.message} (failing open)`);
      return undefined;
    }
  }

  /**
   * Set cached data with dynamic TTL jitter and tag registration.
   */
  async set(
    key: string,
    value: any,
    ttlSeconds: number,
    tags?: string[],
  ): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      // Dynamic TTL Jitter: +0% to +10%
      const jitter = Math.floor(Math.random() * (ttlSeconds * 0.1));
      const actualTtl = ttlSeconds + jitter;

      const serialized =
        typeof value === 'object' && value !== null
          ? JSON.stringify(value)
          : String(value);

      if (actualTtl > 0) {
        await this.client.set(key, serialized, 'EX', actualTtl);
      } else {
        await this.client.set(key, serialized);
      }

      // Tag registration in Redis Sets
      if (tags && tags.length > 0) {
        const pipeline = this.client.pipeline();
        for (const tag of tags) {
          const tagKey = `catalog:tags:${tag}`;
          pipeline.sadd(tagKey, key);
          pipeline.expire(tagKey, actualTtl * 2);
        }
        await pipeline.exec();
      }
    } catch (err: any) {
      this.logger.warn(`Redis SET error for key "${key}": ${err.message}`);
    }
  }

  /**
   * Cache null sentinel to prevent cache penetration on missing resources.
   */
  async setNullSentinel(key: string, ttlSeconds: number = 60): Promise<void> {
    if (!this.client || !this.isConnected) {
      return;
    }

    try {
      await this.client.set(key, NULL_SENTINEL, 'EX', ttlSeconds);
    } catch (err: any) {
      this.logger.warn(`Redis SET NULL_SENTINEL error for key "${key}": ${err.message}`);
    }
  }

  /**
   * Invalidate all keys mapped to the given tag sets.
   */
  async invalidateTags(tags: string[]): Promise<void> {
    if (!this.client || !this.isConnected || !tags || tags.length === 0) {
      return;
    }

    try {
      const allKeysToUnlink: string[] = [];
      const tagKeysToUnlink: string[] = [];

      for (const tag of tags) {
        const tagKey = `catalog:tags:${tag}`;
        tagKeysToUnlink.push(tagKey);

        const memberKeys = await this.client.smembers(tagKey);
        if (memberKeys && memberKeys.length > 0) {
          allKeysToUnlink.push(...memberKeys);
        }
      }

      const uniqueKeys = Array.from(
        new Set([...allKeysToUnlink, ...tagKeysToUnlink]),
      );

      if (uniqueKeys.length > 0) {
        await this.client.unlink(...uniqueKeys);
        this.logger.log(
          `Invalidated ${uniqueKeys.length} cache keys for tags: [${tags.join(', ')}]`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Redis invalidateTags error for tags "${tags}": ${err.message}`);
    }
  }

  /**
   * Invalidate keys matching glob patterns using SCAN and UNLINK.
   */
  async invalidatePatterns(patterns: string[]): Promise<void> {
    if (!this.client || !this.isConnected || !patterns || patterns.length === 0) {
      return;
    }

    try {
      for (const pattern of patterns) {
        let cursor = '0';
        const matchedKeys: string[] = [];

        do {
          const [nextCursor, keys] = await this.client.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          cursor = nextCursor;
          if (keys && keys.length > 0) {
            matchedKeys.push(...keys);
          }
        } while (cursor !== '0');

        if (matchedKeys.length > 0) {
          await this.client.unlink(...matchedKeys);
          this.logger.log(
            `Invalidated ${matchedKeys.length} keys for pattern: "${pattern}"`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Redis invalidatePatterns error for patterns "${patterns}": ${err.message}`,
      );
    }
  }
}
