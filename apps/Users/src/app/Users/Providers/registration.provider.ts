import { Injectable, Logger } from '@nestjs/common';
import { RegisterDto, VerifyEmailDto } from '@booking-ticket-system/DTOs';
import { OutboxMessage, Users } from '@booking-ticket-system/Entities';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import {
  Country,
  ImageProfileType,
  NotificationType,
  UserGender,
  UserStatus,
} from '@booking-ticket-system/Utils';
import {
  BCRYPT_SALT_ROUNDS,
  MAX_OTP_ATTEMPTS,
  OTP_EXPIRY_SECONDS,
  UserOutboxEvent,
} from '@booking-ticket-system/Constants';
import { RedisService } from '@booking-ticket-system/Redis';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { OutboxPublisherService } from '../../outbox/outbox-publisher.service';
import { status } from '@grpc/grpc-js';

@Injectable()
export class RegistrationProvider {
  private readonly logger = new Logger(RegistrationProvider.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly outboxService: OutboxPublisherService,
    private readonly redisService: RedisService,
  ) {}

  async register(registerDto: any): Promise<any> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    const userExists = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (userExists) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'Invalid email or password',
      });
    }

    const rawBirthDate =
      registerDto.birthDate || (registerDto as any).birth_date;
    const birthDate = rawBirthDate ? new Date(rawBirthDate) : null;

    const code = randomInt(100000, 1000000).toString();
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      await bcrypt.genSalt(BCRYPT_SALT_ROUNDS),
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userId = randomUUID();
      const tempKey = registerDto.tempObjectKey;
      const avatarKey = tempKey ? `avatars/${userId}.webp` : null;
      const baseUrl =
        process.env['MEDIA_BASE_URL'] || 'http://localhost:3000/api/v1/media';
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const avatarUrl = avatarKey ? `${cleanBaseUrl}/${avatarKey}` : null;

      const user = queryRunner.manager.create(Users, {
        id: userId,
        name: registerDto.name,
        email: normalizedEmail,
        password: passwordHash,
        birthDate: birthDate,
        gender: registerDto.gender as UserGender,
        country: registerDto.country as Country,
        avatarKey: avatarKey,
        avatarUrl: avatarUrl,
        status: UserStatus.UNVERIFIED,
      });

      await queryRunner.manager.save(user);

      await queryRunner.manager.save(
        queryRunner.manager.create(OutboxMessage, {
          eventType: UserOutboxEvent.USER_CREATED,
          payload: {
            email: user.email,
            name: user.name,
            code,
            dto: {
              UserId: user.id,
              title: 'Welcome to Aflamak',
              body: `Hi ${user.name}, we are happy to have you in our community`,
              type: NotificationType.ALERT_MESSAGE,
            },
          },
        }),
      );

      if (tempKey) {
        await queryRunner.manager.save(
          queryRunner.manager.create(OutboxMessage, {
            eventType: UserOutboxEvent.PROCESS_PROFILE_PHOTO,
            payload: {
              userId: user.id,
              tempObjectKey: tempKey,
              finalKey: `avatars/${user.id}.webp`,
              profileType: ImageProfileType.AVATAR,
              cropX: registerDto.cropX ?? (registerDto as any).crop_x,
              cropY: registerDto.cropY ?? (registerDto as any).crop_y,
              cropWidth:
                registerDto.cropWidth ?? (registerDto as any).crop_width,
              cropHeight:
                registerDto.cropHeight ?? (registerDto as any).crop_height,
              cropZoom: registerDto.cropZoom ?? (registerDto as any).crop_zoom,
            },
          }),
        );
      }

      await queryRunner.commitTransaction();

      const otpKey = `otp:verify-email:${normalizedEmail}`;
      const attemptsKey = `rate:verify-email-attempts:${normalizedEmail}`;

      await this.redisService.set(otpKey, code, OTP_EXPIRY_SECONDS);
      await this.redisService.del(attemptsKey);

      this.outboxService.publishPendingMessages().catch((err) => {
        this.logger.error(`Immediate publish attempt failed: ${err.message}`);
      });

      return {
        id: user.id,
        message: 'Account created successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarKey: user.avatarKey,
          gender: user.gender,
          country: user.country,
          birth_date: user.birthDate
            ? user.birthDate instanceof Date
              ? user.birthDate.toISOString().split('T')[0]
              : String(user.birthDate)
            : '',
          status: user.status,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    const normalizedEmail = verifyEmailDto.email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found',
      });
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new RpcException({
        code: status.FAILED_PRECONDITION,
        message: 'User is already verified',
      });
    }

    const otpKey = `otp:verify-email:${normalizedEmail}`;
    const attemptsKey = `rate:verify-email-attempts:${normalizedEmail}`;

    const attempts = await this.redisService.incrementCounter(
      attemptsKey,
      OTP_EXPIRY_SECONDS,
    );

    if (attempts > MAX_OTP_ATTEMPTS) {
      await this.redisService.del(otpKey);
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message:
          'Too many invalid attempts. Please request a new verification code.',
      });
    }

    const storedOtp = await this.redisService.get<string>(otpKey);

    if (
      !storedOtp ||
      String(storedOtp).trim() !== String(verifyEmailDto.code).trim()
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid or expired verification code.',
      });
    }

    user.status = UserStatus.ACTIVE;
    user.statusChangedAt = new Date();
    await this.userRepository.save(user);

    await this.redisService.del(otpKey);
    await this.redisService.del(attemptsKey);

    return { message: 'Email verified successfully' };
  }
}
