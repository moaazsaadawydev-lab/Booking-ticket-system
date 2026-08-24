import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '@booking-ticket-system/Guards';
import { CurrentUser } from '@booking-ticket-system/Decorators';
import { UserRole } from '@booking-ticket-system/Utils';
import { QrCodeService } from '@booking-ticket-system/Common';
import { BookingProvider } from '../../providers/booking.provider';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly bookingProvider: BookingProvider,
    private readonly qrCodeService: QrCodeService,
  ) {}

  @Get(':id/qr-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTicketQrCode(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;

    const data = await this.bookingProvider.getTicketById(
      id,
      user.id,
      isAdmin,
    );

    const qrCodeToken =
      data?.ticket?.qr_code_token || data?.ticket?.qrCodeToken;

    if (!qrCodeToken) {
      throw new NotFoundException('QR Code token not found for this ticket');
    }

    const qrBuffer = await this.qrCodeService.generateQrBuffer(qrCodeToken);

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': qrBuffer.length.toString(),
    });

    return res.end(qrBuffer);
  }
}
