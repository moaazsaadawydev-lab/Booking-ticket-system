import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ClientScope } from '@booking-ticket-system/Utils';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @Transform(({ obj }) => obj.client_scope ?? obj.clientScope ?? ClientScope.CLIENT_WEB)
  @IsOptional()
  @IsEnum(ClientScope, {
    message: 'clientScope must be CLIENT_WEB or ADMIN_PORTAL',
  })
  clientScope?: ClientScope;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
