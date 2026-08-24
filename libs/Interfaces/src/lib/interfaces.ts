export interface ImageProfileConfig {
  width?: number;
  height?: number;
  quality: number;
  folder: string;
  fit: 'cover' | 'contain' | 'inside' | 'fill';
}

export interface ImageProcessedEventPayload {
  entityId: string;
  mediaUrl: string;
  profileType: string;
}

export interface ProcessedImageResult {
  buffer: Buffer;
  config: ImageProfileConfig;
}

export interface CropOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zoom?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  cropZoom?: number;
}

export interface GoogleLoginPayload {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  birthDate?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LogoutPayload {
  userId: string;
  sessionId?: string;
}

export interface ChangePasswordPayload {
  userId: string;
  oldPassword?: string;
  newPassword: string;
  confirmPassword?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface ResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface RequestChangeEmailPayload {
  userId: string;
  currentPassword?: string;
  newEmail: string;
}

export interface ConfirmChangeEmailPayload {
  userId: string;
  code: string;
}

export interface UpdateUserStatusPayload {
  targetUserId: string;
  status: any;
  reason?: string;
  suspendedUntil?: string;
}

export interface ResendVerificationCodePayload {
  email: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  scope?: string;
  role?: string;
  cinemaId?: string | null;
}

export interface SessionData {
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
}
