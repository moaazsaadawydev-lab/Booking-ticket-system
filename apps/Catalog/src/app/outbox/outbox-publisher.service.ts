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
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly MAX_RETRIES = 5;
  private isShuttingDown = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(OutboxMessage)
    private readonly outboxRepo: Repository<OutboxMessage>,
    @Inject('MEDIA_SERVICE')
    private readonly mediaRmqClient: ClientProxy,
  ) {}

  async onModuleInit() {
    try {
      await this.mediaRmqClient.connect();
    } catch (e: any) {
      this.logger.warn(`Could not connect eagerly to media RMQ: ${e.message}`);
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

    const pendingMessages = await this.outboxRepo.find({
      where: { status: OutboxStatus.PENDING },
      take: 20,
      order: { createdAt: 'ASC' },
    });

    if (pendingMessages.length === 0) return;

    for (const message of pendingMessages) {
      try {
        this.logger.log(`Publishing outbox event "${message.eventType}" (${message.id}) to MEDIA_SERVICE`);

        await firstValueFrom(
          this.mediaRmqClient.emit(message.eventType, {
            eventId: message.id,
            ...message.payload,
          }),
        );

        message.status = OutboxStatus.PUBLISHED;
        message.publishedAt = new Date();
        await this.outboxRepo.save(message);
        this.logger.log(`Successfully published outbox event "${message.eventType}" (${message.id})`);
      } catch (error: any) {
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
