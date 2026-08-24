export const TIMESTAMP = 'CURRENT_TIMESTAMP(6)';
export const VERIFICATION_CODE_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const ROLES_KEY = 'roles';
export const MAX_RETRIES = 5;

// Security & Auth Constants
export const BCRYPT_SALT_ROUNDS = 10;
export const MAX_OTP_ATTEMPTS = 5;
export const OTP_EXPIRY_SECONDS = 600;
export const PASSWORD_RESET_OTP_EXPIRY_SECONDS = 300;
export const RATE_LIMIT_COOLDOWN_SECONDS = 60;
export const BRUTE_FORCE_LOCKOUT_SECONDS = 900;
export const EMERGENCY_FREEZE_LOCKOUT_SECONDS = 86400;
export const EMAIL_ROLLBACK_EXPIRY_DAYS = 30;

export const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
export const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';

export enum UserOutboxEvent {
  USER_CREATED = 'user_created',
  PROCESS_PROFILE_PHOTO = 'process_profile_photo',
  USER_PROFILE_PHOTO_UPDATED = 'USER_PROFILE_PHOTO_UPDATED',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_FORGOT_PASSWORD = 'USER_FORGOT_PASSWORD',
  USER_PASSWORD_RESET_SUCCESS = 'USER_PASSWORD_RESET_SUCCESS',
  EMAIL_CHANGE_OTP_REQUESTED = 'user.email-change.otp-requested',
  EMAIL_CHANGE_SECURITY_ALERT = 'user.email-change.security-alert',
  EMAIL_CHANGE_SUCCESS = 'user.email-change.success',
  EMAIL_CHANGE_SUCCESS_ALERT = 'user.email-change.success-alert',
  ACCOUNT_VERIFICATION_RESEND = 'user.account-verification.resend',
}

export const CATALOG_SERVICE = 'CATALOG_SERVICE';
export const CATALOG_PACKAGE_NAME = 'catalog';
export const CATALOG_EVENTS_QUEUE = 'catalog_events_queue';

export const BOOKING_SERVICE = 'BOOKING_SERVICE';
export const BOOKING_PACKAGE_NAME = 'booking';
export const BOOKING_QUEUE = 'booking_queue';

export enum BookingOutboxEvent {
  BOOKING_HOLD_CREATED = 'booking.hold.created',
  BOOKING_CONFIRMED = 'booking.confirmed',
  BOOKING_CANCELLED = 'booking.cancelled',
  BOOKING_EXPIRED = 'booking.expired',
}

export const NOTIFICATION_SERVICE = 'NOTIFICATION_SERVICE';
export const NOTIFICATION_QUEUE = 'notification_queue';
