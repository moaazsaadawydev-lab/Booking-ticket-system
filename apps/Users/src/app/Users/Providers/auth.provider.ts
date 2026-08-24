import { Injectable } from '@nestjs/common';
import { LoginDto } from '@booking-ticket-system/DTOs';
import { Users } from '@booking-ticket-system/Entities';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccessPayloadType, RefreshPayloadType } from '@booking-ticket-system/Types';
import {
  ClientScope,
  UserRole,
  UserStatus,
} from '@booking-ticket-system/Utils';
import {
  AuthTokensResponse,
  SessionData,
} from '@booking-ticket-system/Interfaces';
import {
  BCRYPT_SALT_ROUNDS,
  DEFAULT_ACCESS_TOKEN_EXPIRY,
  DEFAULT_REFRESH_TOKEN_EXPIRY,
} from '@booking-ticket-system/Constants';
import {
  RedisService,
  SESSION_PREFIX,
  USER_SESSIONS_PREFIX,
} from '@booking-ticket-system/Redis';
import { SessionService } from '../Services/session.service';

@Injectable()
export class AuthProvider {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly sessionService: SessionService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthTokensResponse> {
    const { email, password, userAgent, ipAddress, clientScope } = loginDto;

    const normalizedEmail = email.trim().toLowerCase();
    const effectiveScope =
      clientScope === ClientScope.ADMIN_PORTAL ||
      (clientScope as string) === 'ADMIN_PORTAL'
        ? ClientScope.ADMIN_PORTAL
        : ClientScope.CLIENT_WEB;

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (
      !user ||
      !user.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid email or password',
      });
    }

    // Client Scope Authorization Check
    if (effectiveScope === ClientScope.ADMIN_PORTAL) {
      const allowedAdminRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.CINEMA_ADMIN,
        UserRole.STAFF,
        UserRole.GATE_CHECKER,
        'super_admin',
        'admin',
        'cinema_admin',
        'staff',
        'gate_checker',
      ];
      if (!allowedAdminRoles.includes(user.role)) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message:
            'Access denied: Staff or admin role required for the admin portal',
        });
      }
    }

    await this.sessionService.validateAndResolveUserStatus(user);

    return await this.sessionService.createSession(
      user,
      userAgent,
      ipAddress,
      effectiveScope,
    );
  }

  async refresh(refreshToken: string): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
  }> {
    let refreshTokenPayload:
      | RefreshPayloadType
      | (RefreshPayloadType & { iat: number; exp: number });
    try {
      refreshTokenPayload =
        await this.jwtService.verifyAsync<RefreshPayloadType>(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        });
    } catch {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid or expired refresh token',
      });
    }

    if (!refreshTokenPayload.sessionId || !refreshTokenPayload.id) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid or expired refresh token',
      });
    }

    const userId = refreshTokenPayload.id;
    const sessionId = refreshTokenPayload.sessionId;
    const sessionKey = `${SESSION_PREFIX}${userId}:${sessionId}`;
    const userSessionsKey = `${USER_SESSIONS_PREFIX}${userId}`;

    const sessionData = await this.redisService.get<SessionData>(sessionKey);

    if (!sessionData) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid or expired session. Please log in again.',
      });
    }

    const isMatch = await bcrypt.compare(
      refreshToken,
      sessionData.refreshTokenHash,
    );

    if (!isMatch) {
      await this.redisService.del(sessionKey);
      await this.redisService.srem(userSessionsKey, sessionId);
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid or expired refresh token',
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'User not found',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Account is not active.',
      });
    }

    const accessPayload: AccessPayloadType = {
      id: user.id,
      role: user.role,
      status: user.status,
      sessionId,
      cinemaId: user.cinemaId || null,
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

    const [accessToken, newRefreshToken] = await Promise.all([
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
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, salt);
    const ttlSeconds = Math.floor(
      this.sessionService.parseDurationToMs(refreshExpireIn) / 1000,
    );

    await this.redisService.set(
      sessionKey,
      {
        ...sessionData,
        refreshTokenHash: newRefreshTokenHash,
        updatedAt: new Date().toISOString(),
      },
      ttlSeconds,
    );

    return {
      message: 'Success',
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
