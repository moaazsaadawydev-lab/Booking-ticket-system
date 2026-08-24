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
  @IsString()
  thumbnailUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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
  @IsString()
  thumbnailUrl?: string;

  @Transform(({ obj }) => obj.gallery_urls ?? obj.galleryUrls)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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

  @Transform(({ obj }) => obj.experience_type ?? obj.experienceType)
  @IsEnum(ExperienceType)
  experienceType!: ExperienceType;

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
  @IsInt()
  @Min(1)
  totalRows!: number;

  @Transform(({ obj }) =>
    obj.total_columns !== undefined
      ? Number(obj.total_columns)
      : obj.totalColumns !== undefined
        ? Number(obj.totalColumns)
        : undefined,
  )
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
