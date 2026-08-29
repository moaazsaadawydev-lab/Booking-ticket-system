import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import { RegisterDto } from '@booking-ticket-system/DTOs';
import { MinioService } from '@booking-ticket-system/Storage';

@Injectable()
export class RegistrationProvider implements OnModuleInit {
  private usersService: any;

  constructor(
    @Inject('USER_SERVICE') private readonly client: ClientGrpc,
    private readonly minioService: MinioService,
  ) {}

  onModuleInit() {
    this.usersService = this.client.getService('UsersService');
  }

  async register(body: RegisterDto, file?: Express.Multer.File) {
    const parseNum = (val: any) =>
      val !== undefined && val !== null && val !== '' && !isNaN(Number(val))
        ? Number(val)
        : undefined;

    const cropX = parseNum(body.cropX ?? (body as any).crop_x);
    const cropY = parseNum(body.cropY ?? (body as any).crop_y);
    const cropWidth = parseNum(body.cropWidth ?? (body as any).crop_width);
    const cropHeight = parseNum(body.cropHeight ?? (body as any).crop_height);
    const cropZoom = parseNum(body.cropZoom ?? (body as any).crop_zoom);

    const isCropMissing =
      cropX === undefined ||
      cropY === undefined ||
      cropWidth === undefined ||
      cropHeight === undefined;

    if (file && isCropMissing) {
      Logger.log('Crop parameters are required');
      throw new BadRequestException('Crop parameters (cropX, cropY, cropWidth, cropHeight) are required when uploading avatar');
    }

    let objectKey: string | null = null;

    if (file) {
      try {
        objectKey = `temp/${randomUUID()}.raw`;

        await this.minioService.uploadBuffer(
          file.buffer,
          objectKey,
          file.mimetype,
        );
      } catch (error: any) {
        Logger.error(`Failed to upload temp file to MinIO: ${error.message}`);
        throw new BadRequestException('Failed to process uploaded image');
      }
    }

    try {
      const registerPayload = {
        ...body,
        birth_date: body.birthDate || (body as any).birth_date,
        temp_object_key: objectKey,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        cropZoom,
        crop_x: cropX,
        crop_y: cropY,
        crop_width: cropWidth,
        crop_height: cropHeight,
        crop_zoom: cropZoom,
      };

      Logger.log('registerPayload', registerPayload);

      const result: any = await lastValueFrom(
        this.usersService.Register(registerPayload),
      );

      return {
        message: result?.message || 'Account created successfully',
        user: result?.user || result,
      };
    } catch (error: any) {
      if (objectKey) {
        await this.minioService.deleteObject(objectKey).catch(() => null);
      }
      Logger.log('Failed to create account');
      throw new BadRequestException(
        error.message || 'Failed to create account',
      );
    }
  }
}
