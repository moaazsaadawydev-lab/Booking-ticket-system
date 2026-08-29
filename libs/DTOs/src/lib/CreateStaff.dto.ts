import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UserRole } from '@booking-ticket-system/Utils';

export class CreateStaffDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  fullName!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phoneNumber?: string;

  @IsOptional()
  birthDate?: string | Date;

  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(UserRole, {
    message:
      'Role must be one of: admin, accountant, marketing, cinema_admin, gate_checker, staff, super_admin',
  })
  role!: UserRole;

  @IsOptional()
  @IsUUID('4', { message: 'cinemaId must be a valid UUID' })
  cinemaId?: string | null;

  @IsNotEmpty({ message: 'adminPassword is required for confirmation' })
  @IsString({ message: 'adminPassword must be a string' })
  adminPassword!: string;
}
