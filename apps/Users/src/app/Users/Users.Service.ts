import { Injectable, Logger } from '@nestjs/common';
import {
  LoginDto,
  VerifyEmailDto,
  UpdateUserProfileDto,
} from '@booking-ticket-system/DTOs';
import {
  RegistrationProvider,
  AuthProvider,
  ProfileProvider,
  UpdateUserProvider,
  UpdatePasswordsProvider,
  ForgotPasswordProvider,
  ResetPasswordProvider,
  RequestChangeEmailProvider,
  ConfirmChangeEmailProvider,
  FreezeAccountProvider,
  RollbackEmailProvider,
  ResendVerificationCodeProvider,
  UpdateUserStatusProvider,
  LogoutProvider,
  GoogleLoginProvider,
} from './Providers';
import {
  UpdateUserStatusPayload,
  LogoutPayload,
  GoogleLoginPayload,
  ChangePasswordPayload,
  ResetPasswordPayload,
  RequestChangeEmailPayload,
  ConfirmChangeEmailPayload,
} from '@booking-ticket-system/Interfaces';

@Injectable()
export class UsersService {
  constructor(
    private readonly registrationProvider: RegistrationProvider,
    private readonly authProvider: AuthProvider,
    private readonly profileProvider: ProfileProvider,
    private readonly updateUserProvider: UpdateUserProvider,
    private readonly updatePasswordsProvider: UpdatePasswordsProvider,
    private readonly forgotPasswordProvider: ForgotPasswordProvider,
    private readonly resetPasswordProvider: ResetPasswordProvider,
    private readonly requestChangeEmailProvider: RequestChangeEmailProvider,
    private readonly confirmChangeEmailProvider: ConfirmChangeEmailProvider,
    private readonly freezeAccountProvider: FreezeAccountProvider,
    private readonly rollbackEmailProvider: RollbackEmailProvider,
    private readonly resendVerificationCodeProvider: ResendVerificationCodeProvider,
    private readonly updateUserStatusProvider: UpdateUserStatusProvider,
    private readonly logoutProvider: LogoutProvider,
    private readonly googleLoginProvider: GoogleLoginProvider,
  ) {}

  register(registerDto: any) {
    return this.registrationProvider.register(registerDto);
  }

  updateAvatar(userId: string, mediaUrl: string) {
    Logger.log('updateAvatar', userId, mediaUrl);
    return this.profileProvider.updateAvatar(userId, mediaUrl);
  }

  verifyEmail(verifyEmailDto: VerifyEmailDto) {
    return this.registrationProvider.verifyEmail(verifyEmailDto);
  }

  login(loginDto: LoginDto) {
    return this.authProvider.login(loginDto);
  }

  getProfile(userId: string) {
    return this.profileProvider.getProfile(userId);
  }

  updateProfile(userId: string, updateDto: UpdateUserProfileDto) {
    return this.updateUserProvider.execute(userId, updateDto);
  }

  changePassword(payload: ChangePasswordPayload) {
    return this.updatePasswordsProvider.execute(payload);
  }

  forgotPassword(email: string) {
    return this.forgotPasswordProvider.execute(email);
  }

  resetPassword(payload: ResetPasswordPayload) {
    return this.resetPasswordProvider.execute(payload);
  }

  requestChangeEmail(payload: RequestChangeEmailPayload) {
    return this.requestChangeEmailProvider.execute(payload);
  }

  confirmChangeEmail(payload: ConfirmChangeEmailPayload) {
    return this.confirmChangeEmailProvider.execute(payload);
  }

  freezeAccount(token: string) {
    return this.freezeAccountProvider.execute(token);
  }

  rollbackEmail(token: string) {
    return this.rollbackEmailProvider.execute(token);
  }

  resendVerificationCode(email: string) {
    return this.resendVerificationCodeProvider.execute({ email });
  }

  updateUserStatus(payload: UpdateUserStatusPayload) {
    return this.updateUserStatusProvider.execute(payload);
  }

  logout(payload: LogoutPayload) {
    return this.logoutProvider.execute(payload);
  }

  googleLogin(payload: GoogleLoginPayload) {
    return this.googleLoginProvider.execute(payload);
  }

  refresh(refreshToken: string) {
    return this.authProvider.refresh(refreshToken);
  }
}
