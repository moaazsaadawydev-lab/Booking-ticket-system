import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@booking-ticket-system/Utils';

export class UpdateUserRoleDto {
  @Transform(({ obj }) => {
    const val = obj.role;
    if (typeof val === 'string') {
      return val.toLowerCase();
    }
    return val;
  })
  @IsEnum(UserRole, {
    message: `role must be a valid UserRole (${Object.values(UserRole).join(', ')})`,
  })
  @IsNotEmpty()
  role!: UserRole;

  @Transform(({ obj }) => obj.cinema_id ?? obj.cinemaId)
  @IsOptional()
  @IsUUID('4')
  cinemaId?: string;
}
