import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import {
  JwtAuthGuard,
  RolesGuard,
  ChangePasswordRateLimitGuard,
  ForgotPasswordRateLimitGuard,
  ChangeEmailRateLimitGuard,
} from '@booking-ticket-system/Guards';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '@booking-ticket-system/Redis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from '@booking-ticket-system/Storage';
import { PassportModule } from '@nestjs/passport';
import { CATALOG_SERVICE, BOOKING_SERVICE } from '@booking-ticket-system/Constants';
import {
  UsersAuthController,
  UsersRegistrationController,
  UsersAccountController,
  UsersProfileController,
  UsersAdminController,
} from './Controllers/Users';
import {
  CatalogMoviesController,
  CatalogCinemasController,
  CatalogSeatsController,
  CatalogShowtimesController,
} from './Controllers/Catalog';
import { MediaController } from './Controllers/Media';
import { BookingsController } from './Controllers/Booking';
import {
  AuthProvider,
  RegistrationProvider,
  UserProfileProvider,
  GoogleStrategy,
  CatalogProvider,
  BookingProvider,
} from './providers';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'google' }),
    StorageModule,
    RedisModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env.NODE_ENV}`,
    }),
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'user',
            protoPath: join(process.cwd(), 'libs/protos/Users.proto'),
            url:
              process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('USERS_GRPC_DEV_DOC_URL')
                : process.env.NODE_ENV === 'development'
                  ? config.get<string>('USERS_GRPC_DEV_URL')
                  : config.get<string>('USERS_GRPC_DEV_DOC_URL'),
            loader: {
              keepCase: true,
            },
          },
        }),
      },
      {
        name: CATALOG_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'catalog',
            protoPath: join(process.cwd(), 'libs/protos/Catalog.proto'),
            url:
              process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('CATALOG_GRPC_DEV_DOC_URL')
                : process.env.NODE_ENV === 'development'
                  ? config.get<string>('CATALOG_GRPC_DEV_URL')
                  : config.get<string>('CATALOG_GRPC_DEV_DOC_URL'),
            loader: {
              keepCase: true,
            },
          },
        }),
      },
      {
        name: BOOKING_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'booking',
            protoPath: join(process.cwd(), 'libs/protos/Booking.proto'),
            url:
              (process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('BOOKING_GRPC_DEV_DOC_URL')
                : config.get<string>('BOOKING_GRPC_DEV_URL')) ||
              (process.env.NODE_ENV === 'docker-development'
                ? 'booking-service:50053'
                : 'localhost:50053'),
            loader: {
              keepCase: true,
            },
          },
        }),
      },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRE_IN') as any,
        },
      }),
    }),
  ],
  controllers: [
    UsersAuthController,
    UsersRegistrationController,
    UsersAccountController,
    UsersProfileController,
    UsersAdminController,
    CatalogMoviesController,
    CatalogCinemasController,
    CatalogSeatsController,
    CatalogShowtimesController,
    BookingsController,
    MediaController,
  ],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    ChangePasswordRateLimitGuard,
    ForgotPasswordRateLimitGuard,
    ChangeEmailRateLimitGuard,
    AuthProvider,
    RegistrationProvider,
    UserProfileProvider,
    GoogleStrategy,
    CatalogProvider,
    BookingProvider,
  ],
})
export class ApiGatewayModule {}

