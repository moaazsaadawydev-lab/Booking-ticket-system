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
import { CATALOG_SERVICE, BOOKING_SERVICE, PAYMENT_SERVICE } from '@booking-ticket-system/Constants';
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
import { BookingsController, TicketsController } from './Controllers/Booking';
import { PaymentsController } from './Controllers/Payment';
import {
  AuthProvider,
  RegistrationProvider,
  UserProfileProvider,
  GoogleStrategy,
  CatalogProvider,
  BookingProvider,
  PaymentProvider,
} from './providers';
import { QrCodeService } from '@booking-ticket-system/Common';

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
              (process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('USERS_GRPC_DEV_DOC_URL')
                : config.get<string>('USERS_GRPC_DEV_URL')) ||
              (process.env.NODE_ENV === 'docker-development'
                ? 'users-service:50051'
                : 'localhost:50051'),
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
              (process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('CATALOG_GRPC_DEV_DOC_URL')
                : config.get<string>('CATALOG_GRPC_DEV_URL')) ||
              (process.env.NODE_ENV === 'docker-development'
                ? 'catalog-service:50052'
                : 'localhost:50052'),
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
      {
        name: PAYMENT_SERVICE,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'payment',
            protoPath: join(process.cwd(), 'libs/protos/Payment.proto'),
            url:
              (process.env.NODE_ENV === 'docker-development'
                ? config.get<string>('PAYMENT_GRPC_DEV_DOC_URL')
                : config.get<string>('PAYMENT_GRPC_DEV_URL')) ||
              (process.env.NODE_ENV === 'docker-development'
                ? 'payment-service:50054'
                : 'localhost:50054'),
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
    TicketsController,
    PaymentsController,
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
    PaymentProvider,
    QrCodeService,
  ],
})
export class ApiGatewayModule {}
