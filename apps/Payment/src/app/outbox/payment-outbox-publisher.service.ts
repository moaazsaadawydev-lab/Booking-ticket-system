import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  BOOKING_SERVICE,
  NOTIFICATION_SERVICE,
} from '@booking-ticket-system/Constants';
import { PaymentOutbox } from '@booking-ticket-system/Entities';
import { OutboxStatus } from '@booking-ticket-system/Utils';

@Injectable()
export class PaymentOutboxPublisherService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentOutboxPublisherService.name);
  private readonly MAX_RETRIES = 5;
  private isShuttingDown = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(PaymentOutbox)
    private readonly outboxRepo: Repository<PaymentOutbox>,
    @Inject(BOOKING_SERVICE)
    private readonly bookingClient: ClientProxy,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationClient: ClientProxy,
  ) {}

  async onModuleInit() {
    try {
      await this.bookingClient.connect();
      this.logger.log('Connected to RabbitMQ for Booking Service');
    } catch (e: any) {
      this.logger.warn(`Eager connection to Booking RabbitMQ warning: ${e.message}`);
    }

    try {
      await this.notificationClient.connect();
      this.logger.log('Connected to RabbitMQ for Notification Service');
    } catch (e: any) {
      this.logger.warn(`Eager connection to Notification RabbitMQ warning: ${e.message}`);
    }

    await this.publishPendingMessages();
    this.intervalTimer = setInterval(() => {
      this.publishPendingMessages().catch((e) =>
        this.logger.error(`Interval publish error: ${e.message}`),
      );
    }, 2000);
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPendingMessages() {
    if (this.isShuttingDown) return;

    try {
      const pendingMessages = await this.outboxRepo.find({
        where: { status: OutboxStatus.PENDING },
        take: 50,
        order: { createdAt: 'ASC' },
      });

      if (pendingMessages.length === 0) return;

      for (const message of pendingMessages) {
        try {
          this.logger.log(
            `Publishing payment outbox event "${message.eventType}" (${message.id}) to BOOKING_SERVICE & NOTIFICATION_SERVICE`,
          );

          const eventPayload = {
            eventId: message.id,
            ...message.payload,
          };

          // 1. Emit to Booking Service (booking_queue)
          await firstValueFrom(
            this.bookingClient.emit(message.eventType, eventPayload),
          );

          // 2. Emit to Notification Service (notification_queue)
          try {
            await firstValueFrom(
              this.notificationClient.emit(message.eventType, eventPayload),
            );
          } catch (notifErr: any) {
            this.logger.warn(
              `Non-critical notification emit warning: ${notifErr.message}`,
            );
          }

          message.status = OutboxStatus.PUBLISHED;
          message.publishedAt = new Date();
          await this.outboxRepo.save(message);

          this.logger.log(
            `Successfully published payment event "${message.eventType}" (${message.id})`,
          );
        } catch (error: any) {
          message.retryCount += 1;
          message.status =
            message.retryCount >= this.MAX_RETRIES
              ? OutboxStatus.FAILED
              : OutboxStatus.PENDING;

          await this.outboxRepo.save(message);
          this.logger.error(
            `Failed to publish payment outbox message ${message.id}: ${error.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error querying pending payment outbox messages: ${err.message}`);
    }
  }
}
