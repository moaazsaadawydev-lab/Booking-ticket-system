import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetupPasswordDto {
  @IsNotEmpty({ message: 'Invitation token is required' })
  @IsString({ message: 'Invitation token must be a string' })
  token!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
