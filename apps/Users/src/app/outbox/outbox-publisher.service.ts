import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { OutboxMessage } from '@booking-ticket-system/Entities';
import { OutboxStatus } from '@booking-ticket-system/Utils';
import { Client } from 'pg';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly MAX_RETRIES = 5;

  private client: Client;
  private isShuttingDown = false;

  constructor(
    @InjectRepository(OutboxMessage)
    private readonly outboxRepo: Repository<OutboxMessage>,
    @Inject('MEDIA_SERVICE')
    private readonly mediaRmqClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationRmqClient: ClientProxy,
  ) {}

  async onModuleInit() {
    await this.publishPendingMessages();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    if (this.client) {
      await this.client.end().catch(() => null);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async publishPendingMessages() {
    const pendingMessages = await this.outboxRepo.find({
      where: { status: OutboxStatus.PENDING },
      take: 20,
      order: { createdAt: 'ASC' },
    });

    if (pendingMessages.length === 0) return;

    for (const message of pendingMessages) {
      try {
        Logger.log(message.eventType);
        const client =
          message.eventType === 'process_profile_photo' ||
          message.eventType === 'USER_PROFILE_PHOTO_UPDATED'
            ? this.mediaRmqClient
            : this.notificationRmqClient;

        await firstValueFrom(
          client.emit(message.eventType, {
            eventId: message.id,
            ...message.payload,
          }),
        );

        message.status = OutboxStatus.PUBLISHED;
        message.publishedAt = new Date();
        await this.outboxRepo.save(message);
      } catch (error) {
        message.retryCount += 1;
        message.status =
          message.retryCount >= this.MAX_RETRIES
            ? OutboxStatus.FAILED
            : OutboxStatus.PENDING;

        await this.outboxRepo.save(message);
        this.logger.error(
          `Failed to publish outbox message ${message.id}: ${error.message}`,
        );
      }
    }
  }
}
