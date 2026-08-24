import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class HoldSeatsDto {
  @Transform(({ obj }) => obj.showtime_id ?? obj.showtimeId)
  @IsUUID('4')
  @IsNotEmpty()
  showtimeId!: string;

  @Transform(({ obj }) => obj.seat_ids ?? obj.seatIds)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  seatIds!: string[];
}

export class ConfirmBookingDto {
  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID('4')
  @IsNotEmpty()
  bookingId!: string;

  @Transform(({ obj }) => obj.payment_id ?? obj.paymentId)
  @IsUUID('4')
  @IsNotEmpty()
  paymentId!: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class GetUserBookingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
