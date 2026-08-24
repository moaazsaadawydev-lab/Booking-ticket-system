import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaymentMethod } from '@booking-ticket-system/Utils';

export class BillingDataDto {
  @IsString()
  @IsNotEmpty()
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  last_name!: string;

  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  apartment?: string;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  shipping_method?: string;

  @IsOptional()
  @IsString()
  postal_code?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class InitiatePaymentDto {
  @Transform(({ obj }) => obj.booking_id ?? obj.bookingId)
  @IsUUID('4')
  @IsNotEmpty()
  bookingId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string = 'EGP';

  @IsEnum(PaymentMethod)
  method: PaymentMethod = PaymentMethod.CARD;

  @IsOptional()
  @ValidateNested()
  @Type(() => BillingDataDto)
  billingData?: BillingDataDto;
}

export class PaymobWebhookQueryDto {
  @IsOptional()
  @IsString()
  hmac?: string;
}
