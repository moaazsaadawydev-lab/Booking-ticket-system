import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  CancelBookingDto,
  ConfirmBookingDto,
  GetUserBookingsQueryDto,
  HoldSeatsDto,
} from '@booking-ticket-system/DTOs';
import { JwtAuthGuard } from '@booking-ticket-system/Guards';
import { CurrentUser } from '@booking-ticket-system/Decorators';
import { UserRole } from '@booking-ticket-system/Utils';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';
import { BookingProvider } from '../../providers/booking.provider';

@Controller('bookings')
@UseInterceptors(TransformResponseInterceptor)
export class BookingsController {
  constructor(private readonly bookingProvider: BookingProvider) {}

  @Post('hold')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async holdSeats(
    @CurrentUser() user: any,
    @Body() body: HoldSeatsDto,
  ) {
    return this.bookingProvider.holdSeats(user.id, body);
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmBookingDto,
  ) {
    return this.bookingProvider.confirmBooking(id, body);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
    @Body() body: CancelBookingDto,
  ) {
    return this.bookingProvider.cancelBooking(id, user.id, body);
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserBookings(
    @CurrentUser() user: any,
    @Query() query: GetUserBookingsQueryDto,
  ) {
    return this.bookingProvider.getUserBookings(user.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getBookingById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    return this.bookingProvider.getBookingById(id, user.id, isAdmin);
  }
}
