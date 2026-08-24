import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@booking-ticket-system/Redis';
import {
  Payment,
  PaymentLog,
  PaymentOutbox,
} from '@booking-ticket-system/Entities';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsController } from './payments.controller';
import {
  PaymobProvider,
  InitiatePaymentProvider,
  ProcessWebhookProvider,
  GetPaymentProvider,
} from './providers';

@Module({
  imports: [
    RedisModule,
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
          config.get<string>('PAYMENT_DATABASE_NAME') || 'Booking-Payments',
        entities: [Payment, PaymentLog, PaymentOutbox],
        synchronize: process.env['NODE_ENV'] !== 'production',
        migrationsRun: process.env['NODE_ENV'] === 'production',
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
      }),
    }),
    TypeOrmModule.forFeature([Payment, PaymentLog, PaymentOutbox]),
  ],
  controllers: [AppController, PaymentsController],
  providers: [
    AppService,
    PaymobProvider,
    InitiatePaymentProvider,
    ProcessWebhookProvider,
    GetPaymentProvider,
  ],
  exports: [
    PaymobProvider,
    InitiatePaymentProvider,
    ProcessWebhookProvider,
    GetPaymentProvider,
    TypeOrmModule,
  ],
})
export class AppModule {}
