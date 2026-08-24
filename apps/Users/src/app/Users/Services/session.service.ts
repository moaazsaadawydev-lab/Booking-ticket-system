import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from '@booking-ticket-system/Entities';
import {
  RedisService,
  SESSION_PREFIX,
  USER_SESSIONS_PREFIX,
} from '@booking-ticket-system/Redis';
import {
  ClientScope,
  UserRole,
  UserStatus,
} from '@booking-ticket-system/Utils';
import {
  AccessPayloadType,
  RefreshPayloadType,
} from '@booking-ticket-system/Types';
import {
  AuthTokensResponse,
  SessionData,
} from '@booking-ticket-system/Interfaces';
import {
  BCRYPT_SALT_ROUNDS,
  DEFAULT_ACCESS_TOKEN_EXPIRY,
  DEFAULT_REFRESH_TOKEN_EXPIRY,
} from '@booking-ticket-system/Constants';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  parseDurationToMs(duration?: string | number): number {
    if (typeof duration === 'number') {
      return duration * 1000;
    }
    if (!duration) return 7 * 24 * 60 * 60 * 1000;

    const match = /^(\d+)([smhd])?$/i.exec(duration.trim());
    if (!match) {
      const parsed = parseInt(duration, 10);
      return isNaN(parsed) ? 7 * 24 * 60 * 60 * 1000 : parsed * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = (match[2] || 's').toLowerCase();

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 1000;
    }
  }

  async validateAndResolveUserStatus(user: Users): Promise<void> {
    if (user.status === UserStatus.UNVERIFIED) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Please verify your email to activate your account.',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
        user.status = UserStatus.ACTIVE;
        user.statusReason = null;
        user.suspendedUntil = null;
        user.statusChangedAt = new Date();
        await this.userRepository.save(user);
      } else {
        const reason = user.statusReason
          ? `: ${user.statusReason}`
          : ' due to security hold.';
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message: `Account is suspended${reason}`,
        });
      }
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Account has been permanently blocked due to policy violations.',
      });
    }

    if (user.status === UserStatus.DELETED) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Account not found.',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Account is not active.',
      });
    }
  }

  async createSession(
    user: Users,
    userAgent?: string,
    ipAddress?: string,
    clientScope?: ClientScope | string,
  ): Promise<AuthTokensResponse> {
    const sessionId = randomUUID();
    const effectiveScope = clientScope || ClientScope.CLIENT_WEB;

    const accessPayload: AccessPayloadType = {
      id: user.id,
      role: user.role,
      status: user.status,
      sessionId,
      cinemaId: user.cinemaId || null,
      scope: effectiveScope,
    };

    const refreshPayload: RefreshPayloadType = {
      id: user.id,
      sessionId,
    };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const accessExpireIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRE_IN') ||
      DEFAULT_ACCESS_TOKEN_EXPIRY;

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpireIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRE_IN') ||
      DEFAULT_REFRESH_TOKEN_EXPIRY;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpireIn as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpireIn as any,
      }),
    ]);

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    const ttlSeconds = Math.floor(
      this.parseDurationToMs(refreshExpireIn) / 1000,
    );

    const sessionKey = `${SESSION_PREFIX}${user.id}:${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${user.id}`;

    const sessionData: SessionData = {
      refreshTokenHash,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.set(sessionKey, sessionData, ttlSeconds);
    await this.redisService.sadd(userSessionsKey, sessionId);

    return {
      accessToken,
      refreshToken,
      scope: effectiveScope,
      role: user.role,
      cinemaId: user.cinemaId || null,
    };
  }
}
