import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  Genre,
  Movie,
  Cinema,
  CinemaAdmin,
  Auditorium,
  Seat,
  Showtime,
  ShowtimeSeatPricing,
  OutboxMessage,
} from '@booking-ticket-system/Entities';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogEventsController } from './events/catalog-events.controller';
import { MoviesModule } from './movies/movies.module';
import { CinemasModule } from './cinemas/cinemas.module';
import { SeatsModule } from './seats/seats.module';
import { ShowtimesModule } from './showtimes/showtimes.module';
import { CatalogCacheModule } from './cache/catalog-cache.module';

@Module({
  imports: [
    CatalogCacheModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env['NODE_ENV'] || 'development'}`,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT')!,
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database:
          config.get<string>('CATALOG_DATABASE_NAME') || 'Booking-Catalog',
        entities: [
          Genre,
          Movie,
          Cinema,
          CinemaAdmin,
          Auditorium,
          Seat,
          Showtime,
          ShowtimeSeatPricing,
          OutboxMessage,
        ],
        synchronize: process.env['NODE_ENV'] !== 'production',
        migrationsRun: process.env['NODE_ENV'] === 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
    TypeOrmModule.forFeature([
      Genre,
      Movie,
      Cinema,
      CinemaAdmin,
      Auditorium,
      Seat,
      Showtime,
      ShowtimeSeatPricing,
      OutboxMessage,
    ]),
    MoviesModule,
    CinemasModule,
    SeatsModule,
    ShowtimesModule,
  ],
  controllers: [AppController, CatalogEventsController],
  providers: [AppService],
})
export class AppModule {}
