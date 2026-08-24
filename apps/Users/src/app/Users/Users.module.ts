import { Module } from '@nestjs/common';
import { UsersService } from './Users.Service';
import { SessionService } from './Services/session.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JwtModule } from '@nestjs/jwt';
import { Users, UserEmailHistory } from '@booking-ticket-system/Entities';
import { OutboxModule } from '../outbox/outbox.module';
import { RedisModule } from '@booking-ticket-system/Redis';
import { SanitizeUserInterceptor } from '@booking-ticket-system/Common';
import {
  UsersAuthController,
  UsersRegistrationController,
  UsersAccountController,
  UsersProfileController,
  UsersAdminController,
} from './Controllers';
import {
  RegistrationProvider,
  AuthProvider,
  ProfileProvider,
  UpdateUserProvider,
  UpdatePasswordsProvider,
  ForgotPasswordProvider,
  ResetPasswordProvider,
  RequestChangeEmailProvider,
  ConfirmChangeEmailProvider,
  FreezeAccountProvider,
  RollbackEmailProvider,
  ResendVerificationCodeProvider,
  UpdateUserStatusProvider,
  UpdateUserRoleProvider,
  LogoutProvider,
  GoogleLoginProvider,
} from './Providers';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `libs/env/.env.${process.env.NODE_ENV}`,
    }),
    TypeOrmModule.forFeature([Users, UserEmailHistory]),
    RedisModule,
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('MQ_URL')],
            queue: 'notification_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'MEDIA_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('MQ_URL')],
            queue: 'media_queue',
            queueOptions: { durable: true },
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
    OutboxModule,
  ],
  controllers: [
    UsersAuthController,
    UsersRegistrationController,
    UsersAccountController,
    UsersProfileController,
    UsersAdminController,
  ],
  providers: [
    UsersService,
    SessionService,
    RegistrationProvider,
    AuthProvider,
    ProfileProvider,
    UpdateUserProvider,
    UpdatePasswordsProvider,
    ForgotPasswordProvider,
    ResetPasswordProvider,
    RequestChangeEmailProvider,
    ConfirmChangeEmailProvider,
    FreezeAccountProvider,
    RollbackEmailProvider,
    ResendVerificationCodeProvider,
    UpdateUserStatusProvider,
    UpdateUserRoleProvider,
    LogoutProvider,
    GoogleLoginProvider,
    SanitizeUserInterceptor,
  ],
  exports: [
    UsersService,
    SessionService,
    RegistrationProvider,
    AuthProvider,
    ProfileProvider,
    UpdateUserProvider,
    UpdatePasswordsProvider,
    ForgotPasswordProvider,
    ResetPasswordProvider,
    RequestChangeEmailProvider,
    ConfirmChangeEmailProvider,
    FreezeAccountProvider,
    RollbackEmailProvider,
    ResendVerificationCodeProvider,
    UpdateUserStatusProvider,
    UpdateUserRoleProvider,
    LogoutProvider,
    GoogleLoginProvider,
    SanitizeUserInterceptor,
  ],
})
export class UsersModule {}
