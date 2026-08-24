import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod, Payload, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { LoginDto } from '@booking-ticket-system/DTOs';
import { SanitizeUserInterceptor } from '@booking-ticket-system/Common';
import {
  AuthTokensResponse,
  GoogleLoginPayload,
  LogoutPayload,
} from '@booking-ticket-system/Interfaces';
import {
  AuthProvider,
  GoogleLoginProvider,
  LogoutProvider,
} from '../Providers';

@Controller()
@UseInterceptors(SanitizeUserInterceptor)
export class UsersAuthController {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly googleLoginProvider: GoogleLoginProvider,
    private readonly logoutProvider: LogoutProvider,
  ) {}

  @GrpcMethod('UsersService', 'Login')
  async login(@Payload() data: any): Promise<AuthTokensResponse> {
    const loginDto: LoginDto = {
      email: data.email,
      password: data.password,
      userAgent: data.userAgent || data.user_agent,
      ipAddress: data.ipAddress || data.ip_address,
      clientScope: data.clientScope || data.client_scope,
    };
    return await this.authProvider.login(loginDto);
  }

  @GrpcMethod('UsersService', 'GoogleLogin')
  async googleLogin(@Payload() data: any): Promise<AuthTokensResponse> {
    const googleId = data?.googleId || data?.google_id;
    const email = data?.email;
    const name = data?.name;
    const avatarUrl = data?.avatarUrl || data?.avatar_url;
    const birthDate = data?.birthDate || data?.birth_date;
    const userAgent = data?.userAgent || data?.user_agent;
    const ipAddress = data?.ipAddress || data?.ip_address;

    const payload: GoogleLoginPayload = {
      googleId,
      email,
      name,
      avatarUrl,
      birthDate,
      userAgent,
      ipAddress,
    };

    return await this.googleLoginProvider.execute(payload);
  }

  @GrpcMethod('UsersService', 'Logout')
  async logout(@Payload() data: any): Promise<{ success: boolean; message: string }> {
    const userId = data?.userId || data?.user_id;
    const sessionId = data?.sessionId || data?.session_id;

    const payload: LogoutPayload = {
      userId,
      sessionId,
    };

    return await this.logoutProvider.execute(payload);
  }

  @GrpcMethod('UsersService', 'RefreshToken')
  async refreshToken(@Payload() data: any): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const token = data?.refresh_token || data?.refreshToken;

    if (!token) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Refresh token missing from request payload',
      });
    }

    return await this.authProvider.refresh(token);
  }
}
