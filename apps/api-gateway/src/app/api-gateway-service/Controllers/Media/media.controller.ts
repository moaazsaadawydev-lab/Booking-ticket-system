import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { MinioService } from '@booking-ticket-system/Storage';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];

@Controller('media')
@UseInterceptors(TransformResponseInterceptor)
export class MediaController {
  constructor(private readonly minioService: MinioService) {}

  @Post('upload-temp')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadTemp(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
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
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadSingle(@UploadedFile() file?: Express.Multer.File) {
    return this.uploadTemp(file);
  }

  @Post('upload-multiple')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FilesInterceptor('files', 15, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadMultiple(@UploadedFiles() files?: Array<Express.Multer.File>) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const uploaded = await Promise.all(
      files.map(async (file) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          throw new BadRequestException(
            `Invalid file type for ${file.originalname}. Only JPEG, PNG, and WebP images are allowed.`,
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
          filename: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        };
      }),
    );

    return {
      items: uploaded,
      count: uploaded.length,
    };
  }
}
