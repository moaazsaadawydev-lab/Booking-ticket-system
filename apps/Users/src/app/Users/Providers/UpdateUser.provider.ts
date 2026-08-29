import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OutboxMessage, Users } from '@booking-ticket-system/Entities';
import { UpdateUserProfileDto } from '@booking-ticket-system/DTOs';
import { OutboxPublisherService } from '../../outbox/outbox-publisher.service';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

@Injectable()
export class UpdateUserProvider {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly outboxService: OutboxPublisherService,
  ) {}

  async execute(
    userId: string,
    updateDto: UpdateUserProfileDto,
  ): Promise<Users> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(Users, {
        where: { id: userId },
      });

      if (!user) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: 'User not found',
        });
      }


      const {
        name,
        country,
        birthDate,
        tempKey,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        cropZoom,
      } = updateDto;

      if (name !== undefined) {
        user.name = name;
      }
      if (country !== undefined) {
        user.country = country;
      }
      if (birthDate !== undefined) {
        user.birthDate = birthDate ? new Date(birthDate) : null;
      }

      if (tempKey) {
        const oldAvatarKey = user.avatarKey;
        const newAvatarKey = `avatars/${userId}-${Date.now()}.webp`;
        const baseUrl =
          process.env['MEDIA_BASE_URL'] || 'http://localhost:3000/api/v1/media';
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        user.avatarKey = newAvatarKey;
        user.avatarUrl = `${cleanBaseUrl}/${newAvatarKey}`;

        await queryRunner.manager.save(
          queryRunner.manager.create(OutboxMessage, {
            eventType: 'USER_PROFILE_PHOTO_UPDATED',
            payload: {
              userId,
              oldAvatarKey,
              tempKey,
              finalKey: newAvatarKey,
              cropX,
              cropY,
              cropWidth,
              cropHeight,
              cropZoom,
            },
          }),
        );
      }

      const savedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      this.outboxService.publishPendingMessages().catch((err) => {
        Logger.error(`Immediate publish attempt failed: ${err.message}`);
      });

      return savedUser;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
