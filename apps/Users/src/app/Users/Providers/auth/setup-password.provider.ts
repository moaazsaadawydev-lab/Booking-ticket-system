import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '@booking-ticket-system/Entities';
import { UserStatus } from '@booking-ticket-system/Utils';
import { BCRYPT_SALT_ROUNDS } from '@booking-ticket-system/Constants';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface SetupPasswordPayload {
  token: string;
  password: string;
}

@Injectable()
export class SetupPasswordProvider {
  private readonly logger = new Logger(SetupPasswordProvider.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  async execute(payload: SetupPasswordPayload): Promise<{
    success: boolean;
    message: string;
  }> {
    const { token, password } = payload;

    if (!token || !password) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Token and password are required.',
      });
    }

    if (password.length < 6) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 1. Hash incoming plain token via SHA-256
    const hashedToken = crypto
      .createHash('sha256')
      .update(token.trim())
      .digest('hex');

    // 2. Lookup user by invitationTokenHash
    const user = await this.userRepository.findOne({
      where: { invitationTokenHash: hashedToken },
    });

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Invalid or expired invitation token.',
      });
    }

    // 3. Expiration Check
    if (user.invitationExpiresAt && new Date(user.invitationExpiresAt) < new Date()) {
      throw new RpcException({
        code: status.DEADLINE_EXCEEDED,
        message: 'Invitation token has expired. Please request a new invitation.',
      });
    }

    // 4. Hash password and activate user account
    const passwordHash = await bcrypt.hash(
      password,
      await bcrypt.genSalt(BCRYPT_SALT_ROUNDS),
    );

    user.password = passwordHash;
    user.status = UserStatus.ACTIVE;
    user.statusChangedAt = new Date();
    user.passwordChangedAt = new Date();
    user.invitationTokenHash = null;
    user.invitationExpiresAt = null;

    await this.userRepository.save(user);

    this.logger.log(`User password setup completed successfully: ${user.email} (${user.id})`);

    return {
      success: true,
      message: 'Password configured successfully. Account is now active.',
    };
  }
}
