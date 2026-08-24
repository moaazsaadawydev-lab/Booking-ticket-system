import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Minio.Client({
      endPoint:
        this.config.get<string>('MINIO_ENDPOINT') ||
        (process.env['NODE_ENV'] === 'docker-development'
          ? 'minio'
          : 'localhost'),
      port: Number(this.config.get<string>('MINIO_PORT')) || 9000,
      useSSL: false,
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY'),
    });

    this.bucketName =
      this.config.get<string>('MINIO_BUCKET_NAME') || 'profile-photos';
  }

  async onModuleInit() {
    const exists = await this.client
      .bucketExists(this.bucketName)
      .catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
      this.logger.log(`Bucket "${this.bucketName}" created`);
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType = 'application/octet-stream',
  ): Promise<string> {
    await this.client.putObject(
      this.bucketName,
      objectKey,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType,
      },
    );
    this.logger.log(`Object "${objectKey}" uploaded`);
    return objectKey;
  }

  async getBuffer(objectKey: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucketName, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getPresignedUrl(
    objectKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedGetObject(
      this.bucketName,
      objectKey,
      expirySeconds,
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectKey);
  }

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, objectKey);
      return true;
    } catch {
      return false;
    }
  }
}
