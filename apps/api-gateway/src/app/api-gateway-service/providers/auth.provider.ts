import {
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { Response } from 'express';
import {
  LoginDto,
  VerifyEmailDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RequestEmailChangeDto,
  ConfirmEmailChangeDto,
  FreezeAccountDto,
  RollbackEmailDto,
  ResendVerificationCodeDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  CreateStaffDto,
  SetupPasswordDto,
} from '@booking-ticket-system/DTOs';
import { Users } from '@booking-ticket-system/Entities';

@Injectable()
export class AuthProvider implements OnModuleInit {
  private usersService: any;

  constructor(@Inject('USER_SERVICE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.usersService = this.client.getService('UsersService');
  }

  async login(
    body: LoginDto,
    userAgent: string,
    ipAddress: string,
    response: Response,
  ) {
    const result: any = await lastValueFrom(
      this.usersService.Login({
        email: body.email,
        password: body.password,
        user_agent: userAgent,
        ip_address: ipAddress,
        client_scope: body.clientScope,
      }),
    );

    const accessToken = result.accessToken || result.access_token;
    const refreshToken = result.refreshToken || result.refresh_token;
    const scope = result.scope;
    const role = result.role;
    const cinemaId = result.cinemaId || result.cinema_id;

    if (refreshToken) {
      response.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    return {
      accessToken,
      refreshToken,
      scope,
      role,
      cinemaId,
    };
  }

  async verifyEmail(body: VerifyEmailDto) {
    return await lastValueFrom(this.usersService.VerifyEmail(body));
  }

  async changePassword(
    user: Users,
    body: ChangePasswordDto,
    userAgent: string,
    ipAddress: string,
  ) {
    try {
      const result: any = await lastValueFrom(
        this.usersService.ChangePassword({
          user_id: user?.id,
          old_password: body.oldPassword,
          new_password: body.newPassword,
          confirm_password: body.confirmPassword,
          user_agent: userAgent,
          ip_address: ipAddress,
        }),
      );

      return {
        success: true,
        message:
          result?.message ||
          'Password updated successfully. Please log in again.',
      };
    } catch (error: any) {
      throw error;
    }
  }

  async refresh(refreshToken: string, response: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokens: any = await lastValueFrom(
      this.usersService.RefreshToken({ refresh_token: refreshToken }),
    );

    const newAccessToken = tokens.accessToken || tokens.access_token;
    const newRefreshToken = tokens.refreshToken || tokens.refresh_token;

    response.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      accessToken: newAccessToken,
    };
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const result: any = await lastValueFrom(
      this.usersService.ForgotPassword({
        email: body.email,
      }),
    );

    return {
      success: result?.success ?? true,
      message:
        result?.message || 'Password reset code has been sent to your email.',
    };
  }

  async resetPassword(body: ResetPasswordDto) {
    const result: any = await lastValueFrom(
      this.usersService.ResetPassword({
        email: body.email,
        otp: body.otp,
        new_password: body.newPassword,
        confirm_password: body.confirmPassword,
        newPassword: body.newPassword,
        confirmPassword: body.confirmPassword,
      }),
    );

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  async requestChangeEmail(user: Users, body: RequestEmailChangeDto) {
    const result: any = await lastValueFrom(
      this.usersService.RequestChangeEmail({
        user_id: user?.id,
        current_password: body.currentPassword,
        new_email: body.newEmail,
      }),
    );

    return {
      success: result?.success ?? true,
      message: result?.message || 'Verification code sent to your new email.',
    };
  }

  async confirmChangeEmail(
    user: Users,
    body: ConfirmEmailChangeDto,
    response: Response,
  ) {
    const result: any = await lastValueFrom(
      this.usersService.ConfirmChangeEmail({
        user_id: user?.id,
        code: body.code,
      }),
    );

    response.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Email changed successfully. Please log in again with your new email.',
    };
  }

  async freezeAccount(body: FreezeAccountDto, response: Response) {
    const result: any = await lastValueFrom(
      this.usersService.FreezeAccount({
        token: body.token,
      }),
    );

    response.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Account has been frozen and all active sessions revoked.',
    };
  }

  async rollbackEmail(body: RollbackEmailDto, response: Response) {
    const result: any = await lastValueFrom(
      this.usersService.RollbackEmail({
        token: body.token,
      }),
    );

    response.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Account email has been rolled back successfully. All sessions revoked. Please reset your password.',
    };
  }

  async resendVerificationCode(body: ResendVerificationCodeDto) {
    const result: any = await lastValueFrom(
      this.usersService.ResendVerificationCode({
        email: body.email,
      }),
    );

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Verification code resent successfully. Please check your inbox.',
    };
  }

  async updateUserStatus(targetUserId: string, body: UpdateUserStatusDto) {
    const result: any = await lastValueFrom(
      this.usersService.UpdateUserStatus({
        target_user_id: targetUserId,
        status: body.status,
        reason: body.reason,
        suspended_until: body.suspendedUntil,
      }),
    );

    return {
      success: result?.success ?? true,
      message: result?.message || 'User status updated successfully.',
      status: result?.status,
    };
  }

  async updateUserRole(targetUserId: string, body: UpdateUserRoleDto, actor: any) {
    const result: any = await lastValueFrom(
      this.usersService.UpdateUserRole({
        target_user_id: targetUserId,
        role: body.role,
        cinema_id: body.cinemaId,
        actor_id: actor?.id,
        actor_role: actor?.role,
        actor_cinema_id: actor?.cinemaId,
      }),
    );

    return {
      success: result?.success ?? true,
      message: result?.message || 'User role updated successfully.',
      userId: result?.user_id || result?.userId,
      role: result?.role,
      cinemaId: result?.cinema_id || result?.cinemaId,
    };
  }

  async logout(user: any, response: Response) {
    const userId = user?.id;
    const sessionId = user?.sessionId;

    const result: any = await lastValueFrom(
      this.usersService.Logout({
        user_id: userId,
        session_id: sessionId,
      }),
    );

    response.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return {
      success: result?.success ?? true,
      message: result?.message || 'Logged out successfully.',
    };
  }

  async googleLogin(
    googleUser: any,
    ipAddress: string,
    userAgent: string,
    response: Response,
  ) {
    const result: any = await lastValueFrom(
      this.usersService.GoogleLogin({
        google_id: googleUser?.googleId,
        email: googleUser?.email,
        name: googleUser?.name,
        avatar_url: googleUser?.avatarUrl,
        user_agent: userAgent,
        ip_address: ipAddress,
      }),
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const accessToken = result.access_token || result.accessToken;
    const refreshToken = result.refresh_token || result.refreshToken;

    if (accessToken) {
      response.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
    }

    if (refreshToken) {
      response.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }

    return {
      success: true,
      message: 'Google authentication successful',
      accessToken,
      refreshToken,
    };
  }

  async createStaff(body: CreateStaffDto, actor: any) {
    const result: any = await lastValueFrom(
      this.usersService.CreateStaff({
        full_name: body.fullName,
        email: body.email,
        phone_number: body.phoneNumber,
        birth_date: body.birthDate ? String(body.birthDate) : undefined,
        role: body.role,
        cinema_id: body.cinemaId,
        admin_password: body.adminPassword,
        actor_id: actor?.id,
        actor_role: actor?.role,
      }),
    );

    return {
      success: result.success ?? true,
      message: result.message || 'Staff member invited successfully',
      userId: result.userId || result.user_id,
      email: result.email,
      fullName: result.fullName || result.full_name,
      role: result.role,
      cinemaId: result.cinemaId || result.cinema_id,
      status: result.status,
      createdBy: result.createdBy || result.created_by,
      invitationToken: result.invitationToken || result.invitation_token,
    };
  }

  async setupPassword(body: SetupPasswordDto) {
    const result: any = await lastValueFrom(
      this.usersService.SetupPassword({
        token: body.token,
        password: body.password,
      }),
    );

    return {
      success: result?.success ?? true,
      message:
        result?.message ||
        'Password configured successfully. Account is now active.',
    };
  }

  async listUsers(query: {
    search?: string;
    role?: string;
    cinemaId?: string;
    page?: number;
    limit?: number;
  }) {
    const result: any = await lastValueFrom(
      this.usersService.ListUsers({
        search: query.search,
        role: query.role,
        cinema_id: query.cinemaId,
        page: query.page ? Number(query.page) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
      }),
    );

    return {
      items: result.users || [],
      total: result.total || (result.users ? result.users.length : 0),
      page: result.page || 1,
      limit: result.limit || 50,
    };
  }
}
