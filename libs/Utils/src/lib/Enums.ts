export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  MARKETING = 'marketing',
  CINEMA_ADMIN = 'cinema_admin',
  USER = 'user',
}

export enum UserStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
  DELETED = 'DELETED',
}

export enum AuthProviderType {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
}

export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum Country {
  EGYPT = 'Egypt',
  SAUDI_ARABIA = 'Saudi Arabia',
  UAE = 'UAE',
  KUWAIT = 'Kuwait',
  QATAR = 'Qatar',
  BAHRAIN = 'Bahrain',
  OMAN = 'Oman',
  MOROCCO = 'Morocco',
  ALGERIA = 'Algeria',
  TUNISIA = 'Tunisia',
  LIBYA = 'Libya',
  SUDAN = 'Sudan',
  SYRIA = 'Syria',
  JORDAN = 'Jordan',
  LEBANON = 'Lebanon',
  PALESTINE = 'Palestine',
  USA = 'USA',
  UK = 'UK',
  CANADA = 'Canada',
  AUSTRALIA = 'Australia',
  BRAZIL = 'Brazil',
  CHINA = 'China',
  INDIA = 'India',
  JAPAN = 'Japan',
  RUSSIA = 'Russia',
  SOUTH_KOREA = 'South Korea',
  SPAIN = 'Spain',
  GERMANY = 'Germany',
  FRANCE = 'France',
  ITALY = 'Italy',
  MEXICO = 'Mexico',
}

export enum ImageProfileType {
  AVATAR = 'AVATAR',
  MOVIE_THUMBNAIL = 'MOVIE_THUMBNAIL',
  MOVIE_COVER = 'MOVIE_COVER',
  MOVIE_GALLERY = 'MOVIE_GALLERY',
  CINEMA_THUMBNAIL = 'CINEMA_THUMBNAIL',
  CINEMA_GALLERY = 'CINEMA_GALLERY',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum NotificationType {
  NORMAL_MESSAGE = 'NORMAL_MESSAGE',
  ALERT_MESSAGE = 'ALERT_MESSAGE',
  WARNING_MESSAGE = 'WARNING_MESSAGE',
  CRITICAL_MESSAGE = 'CRITICAL_MESSAGE',
}

export enum EmailStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export enum MovieAgeRating {
  G = 'G',
  PG = 'PG',
  PG_13 = 'PG_13',
  R = 'R',
  NC_17 = 'NC_17',
}

export enum MovieStatus {
  COMING_SOON = 'COMING_SOON',
  NOW_SHOWING = 'NOW_SHOWING',
  ARCHIVED = 'ARCHIVED',
}

export enum ExperienceType {
  STANDARD_2D = 'STANDARD_2D',
  STANDARD_3D = 'STANDARD_3D',
  IMAX_3D = 'IMAX_3D',
  FOUR_DX = 'FOUR_DX',
  VIP_LOUNGE = 'VIP_LOUNGE',
}

export enum SeatType {
  REGULAR = 'REGULAR',
  VIP = 'VIP',
  PREMIUM = 'PREMIUM',
  COUPLE = 'COUPLE',
  WHEELCHAIR = 'WHEELCHAIR',
  EMPTY_SPACE = 'EMPTY_SPACE',
}

export enum ShowtimeStatus {
  SCHEDULED = 'SCHEDULED',
  SELLING = 'SELLING',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

