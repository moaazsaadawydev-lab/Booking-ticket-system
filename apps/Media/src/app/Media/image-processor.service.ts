import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import sharp from 'sharp';
import { IMAGE_PROFILES } from './config/image-profiles.config';
import {
  ProcessedImageResult,
  CropOptions,
} from '@booking-ticket-system/Interfaces';
import { ImageProfileType } from '@booking-ticket-system/Utils';

@Injectable()
export class ImageProcessorService {
  async processImageByProfile(
    fileBuffer: Buffer,
    profileType: ImageProfileType | string,
    crop?: CropOptions,
  ): Promise<ProcessedImageResult> {
    try {
      const normalizedType =
        typeof profileType === 'string'
          ? (profileType.toUpperCase() as ImageProfileType)
          : profileType;

      const profile =
        IMAGE_PROFILES[normalizedType] ||
        IMAGE_PROFILES[profileType as ImageProfileType] ||
        IMAGE_PROFILES[ImageProfileType.AVATAR];

      let pipeline = sharp(fileBuffer);
      const metadata = await pipeline.metadata();

      const imgWidth = metadata.width || 0;
      const imgHeight = metadata.height || 0;

      const parseNum = (val: any) =>
        val !== undefined && val !== null && val !== '' && !isNaN(Number(val))
          ? Number(val)
          : undefined;

      const cropX = parseNum(crop?.cropX ?? crop?.x);
      const cropY = parseNum(crop?.cropY ?? crop?.y);
      const cropWidth = parseNum(crop?.cropWidth ?? crop?.width);
      const cropHeight = parseNum(crop?.cropHeight ?? crop?.height);

      if (
        cropX !== undefined &&
        cropY !== undefined &&
        cropWidth !== undefined &&
        cropHeight !== undefined &&
        cropWidth > 0 &&
        cropHeight > 0 &&
        imgWidth > 0 &&
        imgHeight > 0
      ) {
        const left = Math.max(0, Math.min(Math.round(cropX), imgWidth - 1));
        const top = Math.max(0, Math.min(Math.round(cropY), imgHeight - 1));
        const width = Math.max(
          1,
          Math.min(Math.round(cropWidth), imgWidth - left),
        );
        const height = Math.max(
          1,
          Math.min(Math.round(cropHeight), imgHeight - top),
        );

        pipeline = pipeline.extract({ left, top, width, height });
      }

      const targetWidth = profile.width;
      const targetHeight = profile.height;

      if (profile.width || profile.height) {
        pipeline = pipeline.resize({
          width: profile.width,
          height: profile.height,
          fit: profile.fit,
          withoutEnlargement: true,
        });
      }

      if (normalizedType === ImageProfileType.AVATAR) {
        const circleWidth = targetWidth || 300;
        const circleHeight = targetHeight || 300;
        const circleShape = Buffer.from(
          `<svg width="${circleWidth}" height="${circleHeight}">
            <circle cx="${circleWidth / 2}" cy="${
            circleHeight / 2
          }" r="${circleWidth / 2}" fill="#fff"/>
          </svg>`,
        );

        pipeline = pipeline.composite([
          {
            input: circleShape,
            blend: 'dest-in',
          },
        ]);
      }

      const processedBuffer = await pipeline
        .webp({ quality: profile.quality })
        .toBuffer();

      return {
        buffer: processedBuffer,
        config: profile,
      };
    } catch (error: any) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: `Failed to process image: ${error.message || 'Invalid image file.'}`,
      });
    }
  }
}
