import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { MinioService } from '@booking-ticket-system/Storage';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];

@Controller('media')
export class MediaController {
  constructor(private readonly minioService: MinioService) {}

  @Get('*')
  async getMedia(@Req() req: Request, @Res() res: Response) {
    const rawPath = req.params[0] || (req as any).params?.['0'] || '';
    const cleanKey = (rawPath || '')
      .replace(/^\/api\/v1\/media\/?/, '')
      .replace(/^\/media\/?/, '')
      .replace(/^\//, '');

    if (!cleanKey) {
      throw new NotFoundException('Media key not specified');
    }

    const bucketsToTry = ['profile-photos', 'catalog'];
    let buffer: Buffer | null = null;

    for (const bucket of bucketsToTry) {
      const exists = await this.minioService
        .objectExists(cleanKey, bucket)
        .catch(() => false);
      if (exists) {
        buffer = await this.minioService
          .getBuffer(cleanKey, bucket)
          .catch(() => null);
        if (buffer) {
          break;
        }
      }
    }

    if (!buffer) {
      throw new NotFoundException(`Media object "${cleanKey}" not found`);
    }

    const ext = cleanKey.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };
    const contentType = (ext && mimeMap[ext]) || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.end(buffer);
  }

  @Post('upload-temp')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    TransformResponseInterceptor,
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
    TransformResponseInterceptor,
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
    TransformResponseInterceptor,
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
