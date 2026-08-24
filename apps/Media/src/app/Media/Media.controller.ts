import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { MediaService } from './Media.service';
import { ProcessMediaEventDto } from '@booking-ticket-system/DTOs';
import { firstValueFrom } from 'rxjs';

@Controller()
export class MediaController {
  private readonly logger = new Logger(MediaController.name);
  constructor(
    private readonly MediaService: MediaService,
    @Inject('USERS_SERVICE') private readonly rmqClient: ClientProxy,
  ) {}

  @EventPattern('process_profile_photo')
  async handleProcessImage(@Payload() data: any, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.MediaService.processAndSaveProfilePhoto(data);
      channel.ack(originalMsg);
    } catch (error) {

      this.logger.error(`Error processing media: ${error.message}`);

      const isRedelivered = originalMsg.fields.redelivered;

      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('USER_PROFILE_PHOTO_UPDATED')
  async handleUserProfilePhotoUpdated(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.MediaService.processUserProfilePhotoUpdate(data);
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `Error processing USER_PROFILE_PHOTO_UPDATED: ${error.message}`,
        error.stack,
      );
      channel.nack(originalMsg, false, true);
    }
  }

  @EventPattern('PROCESS_CATALOG_MEDIA')
  async handleProcessCatalogMedia(
    @Payload() data: any,
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      await this.MediaService.processCatalogMedia(data);
      channel.ack(originalMsg);
    } catch (error: any) {
      this.logger.error(
        `Error processing PROCESS_CATALOG_MEDIA: ${error.message}`,
        error.stack,
      );
      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }
}
