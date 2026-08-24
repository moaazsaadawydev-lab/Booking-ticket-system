import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '@booking-ticket-system/Guards';
import { CurrentUser } from '@booking-ticket-system/Decorators';
import { UserRole } from '@booking-ticket-system/Utils';
import {
  InitiatePaymentDto,
  PaymobWebhookQueryDto,
} from '@booking-ticket-system/DTOs';
import { PaymentProvider } from '../../providers/payment.provider';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentProvider: PaymentProvider) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async initiatePayment(
    @CurrentUser() user: any,
    @Body() dto: InitiatePaymentDto,
  ) {
    return await this.paymentProvider.initiatePayment(user.id, dto);
  }

  @Post(['webhook', 'webhook/paymob'])
  @HttpCode(HttpStatus.OK)
  async processPaymobWebhook(
    @Body() body: any,
    @Query() query: PaymobWebhookQueryDto,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const signature =
      query.hmac ||
      (req.query?.hmac as string) ||
      headers['x-callback-hmac'] ||
      headers['hmac'] ||
      body?.hmac ||
      '';

    return await this.paymentProvider.processWebhook(body, signature);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPaymentById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    return await this.paymentProvider.getPaymentById(id, user.id, isAdmin);
  }

  @Get('booking/:bookingId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPaymentByBookingId(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    return await this.paymentProvider.getPaymentByBookingId(
      bookingId,
      user.id,
      isAdmin,
    );
  }
}
