import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsEntity } from '@booking-ticket-system/Entities';
import { NotificationGateway } from '../Gateway/notification.gateway';
import { NotificationController } from './notifications.controller';
import { NotificationService } from './notifications.service';
import { NotificationEmailPublisherService } from './notification-email-publisher.service';

import { QrModule } from '../qr/qr.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationsEntity]),
    ScheduleModule.forRoot(),
    QrModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    NotificationEmailPublisherService,
  ],
})
export class NotificationsModule {}
