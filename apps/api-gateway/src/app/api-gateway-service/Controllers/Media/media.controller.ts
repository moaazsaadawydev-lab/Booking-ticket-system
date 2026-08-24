import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { MinioService } from '@booking-ticket-system/Storage';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('media')
@UseInterceptors(TransformResponseInterceptor)
export class MediaController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload-temp')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }
    }),
  )
  async uploadTemp(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    const sanitizedFilename = file.originalname
      ? file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      : 'upload.raw';
    const tempKey = `temp/${randomUUID()}-${sanitizedFilename}`;

    await this.minioService.uploadBuffer(
      file.buffer,
      tempKey,
      file.mimetype,
      'catalog',
    );

    return {
      tempKey,
    };
  }
}
