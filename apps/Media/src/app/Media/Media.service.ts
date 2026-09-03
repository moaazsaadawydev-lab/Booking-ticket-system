import { Injectable, Logger } from '@nestjs/common';
import { ImageProcessorService } from '../Media/image-processor.service';
import { ProcessMediaEventDto } from '@booking-ticket-system/DTOs';
import { MinioService } from '@booking-ticket-system/Storage';
import { ImageProfileType } from '@booking-ticket-system/Utils';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly imageProcessor: ImageProcessorService,
    private readonly minioService: MinioService,
  ) {}

  private extractCropOptions(data: any) {
    const parseNum = (val: any) =>
      val !== undefined && val !== null && val !== '' && !isNaN(Number(val))
        ? Number(val)
        : undefined;

    const cropObj = data?.crop || {};
    const cropX = parseNum(data?.cropX ?? data?.crop_x ?? cropObj.cropX ?? cropObj.x);
    const cropY = parseNum(data?.cropY ?? data?.crop_y ?? cropObj.cropY ?? cropObj.y);
    const cropWidth = parseNum(
      data?.cropWidth ?? data?.crop_width ?? cropObj.cropWidth ?? cropObj.width,
    );
    const cropHeight = parseNum(
      data?.cropHeight ?? data?.crop_height ?? cropObj.cropHeight ?? cropObj.height,
    );
    const cropZoom = parseNum(
      data?.cropZoom ?? data?.crop_zoom ?? cropObj.cropZoom ?? cropObj.zoom,
    );

    if (
      cropX !== undefined ||
      cropY !== undefined ||
      cropWidth !== undefined ||
      cropHeight !== undefined
    ) {
      return {
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        cropZoom,
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
        zoom: cropZoom,
      };
    }

    return undefined;
  }

  async processAndSaveProfilePhoto(data: any) {
    Logger.log('media data', data);
    const tempKey = data.tempObjectKey;
    const userId = data.userId;
    const finalKey = data.finalKey;

    if (!tempKey) {
      this.logger.warn(`No tempKey provided for media processing.`);
      return;
    }

    const alreadyProcessed = await this.minioService.objectExists(finalKey);

    if (!alreadyProcessed) {
      const rawBuffer = await this.minioService.getBuffer(tempKey);
      const crop = this.extractCropOptions(data);

      const { buffer } = await this.imageProcessor.processImageByProfile(
        rawBuffer,
        data.profileType || ImageProfileType.AVATAR,
        crop,
      );

      await this.minioService.uploadBuffer(buffer, finalKey, 'image/webp');
      this.logger.log(`Processed and uploaded: ${finalKey}`);
    } else {
      this.logger.log(`Skipping reprocessing, already exists: ${finalKey}`);
    }

    await this.minioService.deleteObject(tempKey).catch(() => {
      this.logger.warn(`Temp object already removed: ${tempKey}`);
    });

    return {
      userId,
      finalKey,
    };
  }

  async processUserProfilePhotoUpdate(data: any) {
    const tempKey = data.tempKey;
    const finalKey = data.finalKey;
    const oldAvatarKey = data.oldAvatarKey;
    const userId = data.userId;

    if (!tempKey) {
      this.logger.warn(`No tempKey provided for profile photo update.`);
      return;
    }

    const tempExists = await this.minioService.objectExists(tempKey);
    if (!tempExists) {
      this.logger.log(
        `Idempotency Guard: tempKey ${tempKey} does not exist. Already processed or removed.`,
      );
      return { skipped: true };
    }

    const rawBuffer = await this.minioService.getBuffer(tempKey);
    const crop = this.extractCropOptions(data);

    const { buffer } = await this.imageProcessor.processImageByProfile(
      rawBuffer,
      data.profileType || ImageProfileType.AVATAR,
      crop,
    );

    await this.minioService.uploadBuffer(buffer, finalKey, 'image/webp');
    this.logger.log(
      `Processed and uploaded updated profile photo: ${finalKey}`,
    );

    await this.minioService.deleteObject(tempKey).catch(() => null);

    if (oldAvatarKey) {
      const oldExists = await this.minioService.objectExists(oldAvatarKey);
      if (oldExists) {
        await this.minioService.deleteObject(oldAvatarKey).catch(() => null);
        this.logger.log(`Deleted old avatar key: ${oldAvatarKey}`);
      }
    }

    return {
      userId,
      finalKey,
    };
  }

  async processCatalogMedia(data: any) {
    const tempKey = data.tempKey || data.tempObjectKey;
    const finalKey = data.finalKey;
    const bucket = data.bucket || 'catalog';
    const profileType = data.profileType || ImageProfileType.MOVIE_THUMBNAIL;

    if (!tempKey || !finalKey) {
      this.logger.warn(`Missing tempKey or finalKey for catalog media processing: ${JSON.stringify(data)}`);
      return { skipped: true };
    }

    // Idempotency check: if finalKey already exists in the target bucket, skip processing
    const alreadyExists = await this.minioService.objectExists(finalKey, bucket);
    if (alreadyExists) {
      this.logger.log(`Skipping reprocessing, ${bucket}/${finalKey} already exists`);
      return { skipped: true, finalKey, bucket };
    }

    // Determine which bucket holds the temp key
    let sourceBucket = bucket;
    let tempExists = await this.minioService.objectExists(tempKey, bucket);
    if (!tempExists) {
      const defaultBucketExists = await this.minioService.objectExists(tempKey);
      if (defaultBucketExists) {
        sourceBucket = (this.minioService as any).bucketName || 'profile-photos';
        tempExists = true;
      }
    }

    if (!tempExists) {
      this.logger.warn(
        `Idempotency Guard: tempKey "${tempKey}" not found in bucket "${bucket}". Already processed or deleted.`,
      );
      return { skipped: true };
    }

    const rawBuffer = await this.minioService.getBuffer(tempKey, sourceBucket);

    const { buffer } = await this.imageProcessor.processImageByProfile(
      rawBuffer,
      profileType,
      data.crop,
    );

    await this.minioService.uploadBuffer(buffer, finalKey, 'image/webp', bucket);
    this.logger.log(`Processed and uploaded catalog media to ${bucket}/${finalKey}`);

    await this.minioService.deleteObject(tempKey, sourceBucket).catch(() => null);

    return {
      finalKey,
      bucket,
    };
  }
}

// Github