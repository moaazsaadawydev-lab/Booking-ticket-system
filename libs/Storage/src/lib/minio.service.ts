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
    const bucketsToInit = [this.bucketName, 'catalog', 'profile-photos'];
    for (const bucket of Array.from(new Set(bucketsToInit))) {
      await this.ensureBucketExists(bucket);
    }
  }

  async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      const exists = await this.client
        .bucketExists(bucketName)
        .catch(() => false);
      if (!exists) {
        await this.client.makeBucket(bucketName);
        this.logger.log(`Bucket "${bucketName}" created`);
      }
    } catch (err: any) {
      this.logger.warn(`Could not verify/create bucket "${bucketName}": ${err.message}`);
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    objectKey: string,
    contentType = 'application/octet-stream',
    bucketName?: string,
  ): Promise<string> {
    const targetBucket = bucketName || this.bucketName;
    await this.ensureBucketExists(targetBucket);
    await this.client.putObject(
      targetBucket,
      objectKey,
      buffer,
      buffer.length,
      {
        'Content-Type': contentType,
      },
    );
    this.logger.log(`Object "${objectKey}" uploaded to bucket "${targetBucket}"`);
    return objectKey;
  }

  async getBuffer(objectKey: string, bucketName?: string): Promise<Buffer> {
    const targetBucket = bucketName || this.bucketName;
    const stream = await this.client.getObject(targetBucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async getPresignedUrl(
    objectKey: string,
    expirySeconds = 3600,
    bucketName?: string,
  ): Promise<string> {
    const targetBucket = bucketName || this.bucketName;
    return this.client.presignedGetObject(
      targetBucket,
      objectKey,
      expirySeconds,
    );
  }

  async deleteObject(objectKey: string, bucketName?: string): Promise<void> {
    const targetBucket = bucketName || this.bucketName;
    await this.client.removeObject(targetBucket, objectKey);
  }

  async objectExists(objectKey: string, bucketName?: string): Promise<boolean> {
    const targetBucket = bucketName || this.bucketName;
    try {
      await this.client.statObject(targetBucket, objectKey);
      return true;
    } catch {
      return false;
    }
  }
}

