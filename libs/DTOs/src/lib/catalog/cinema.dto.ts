import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ExperienceType } from '@booking-ticket-system/Utils';
import { IsUrlOrTempKey } from './validators/is-url-or-temp-key.decorator';

export class CreateCinemaDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @Transform(({ obj }) => obj.phone_number ?? obj.phoneNumber)
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  @Transform(({ obj }) => obj.thumbnail_url ?? obj.thumbnailUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  thumbnailUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsUrlOrTempKey({ each: true })
  galleryUrls?: string[];

  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(({ obj }) => obj.admin_user_ids ?? obj.adminUserIds)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  adminUserIds?: string[];
}

export class UpdateCinemaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @Transform(({ obj }) => obj.phone_number ?? obj.phoneNumber)
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  facilities?: string[];

  @Transform(({ obj }) => obj.thumbnail_url ?? obj.thumbnailUrl)
  @IsOptional()
  @IsUrlOrTempKey()
  thumbnailUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsUrlOrTempKey({ each: true })
  galleryUrls?: string[];

  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListCinemasQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAuditoriumDto {
  @Transform(({ obj }) => obj.cinema_id ?? obj.cinemaId)
  @IsUUID('4')
  cinemaId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @Transform(({ obj }) => {
    const raw = obj.experience_type ?? obj.experienceType ?? obj.type ?? 'STANDARD_2D';
    const u = String(raw).toUpperCase();
    if (u === 'IMAX' || u === 'IMAX_3D') return ExperienceType.IMAX_3D;
    if (u === 'VIP' || u === 'VIP_LOUNGE') return ExperienceType.VIP_LOUNGE;
    if (u === '4DX' || u === 'FOUR_DX') return ExperienceType.FOUR_DX;
    if (u === 'STANDARD_3D') return ExperienceType.STANDARD_3D;
    return ExperienceType.STANDARD_2D;
  })
  @IsEnum(ExperienceType)
  experienceType!: ExperienceType;

  @Transform(({ obj }) => obj.sound_system ?? obj.soundSystem)
  @IsOptional()
  @IsString()
  soundSystem?: string;

  @Transform(({ obj }) => {
    const val = obj.total_rows ?? obj.totalRows;
    if (val !== undefined && val !== null) return Number(val);
    const seats = Number(obj.totalSeats ?? obj.total_seats ?? 120);
    return Math.ceil(Math.sqrt(seats)) || 10;
  })
  @IsInt()
  @Min(1)
  totalRows!: number;

  @Transform(({ obj }) => {
    const val = obj.total_columns ?? obj.totalColumns;
    if (val !== undefined && val !== null) return Number(val);
    const seats = Number(obj.totalSeats ?? obj.total_seats ?? 120);
    const rows = Math.ceil(Math.sqrt(seats)) || 10;
    return Math.ceil(seats / rows) || 12;
  })
  @IsInt()
  @Min(1)
  totalColumns!: number;

  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAuditoriumDto {
  @IsOptional()
  @IsString()
  name?: string;

  @Transform(({ obj }) => obj.experience_type ?? obj.experienceType)
  @IsOptional()
  @IsEnum(ExperienceType)
  experienceType?: ExperienceType;

  @Transform(({ obj }) => obj.sound_system ?? obj.soundSystem)
  @IsOptional()
  @IsString()
  soundSystem?: string;

  @Transform(({ obj }) =>
    obj.total_rows !== undefined
      ? Number(obj.total_rows)
      : obj.totalRows !== undefined
        ? Number(obj.totalRows)
        : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  totalRows?: number;

  @Transform(({ obj }) =>
    obj.total_columns !== undefined
      ? Number(obj.total_columns)
      : obj.totalColumns !== undefined
        ? Number(obj.totalColumns)
        : undefined,
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  totalColumns?: number;

  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignCinemaAdminDto {
  @Transform(({ obj }) => obj.user_id ?? obj.userId)
  @IsUUID('4')
  @IsNotEmpty()
  userId!: string;
}
