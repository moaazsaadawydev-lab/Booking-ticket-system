import { Controller, Logger } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { NotificationDto } from '@booking-ticket-system/DTOs';
import { NotificationType } from '@booking-ticket-system/Utils';
import { BookingOutboxEvent } from '@booking-ticket-system/Constants';


@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly NotificationsService: NotificationService) {}

  @EventPattern('user_created')
  async handleUserCreated(
    @Payload()
    data: {
      email: string;
      name: string;
      code: number;
      dto: NotificationDto;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.eventId;

    try {
      await this.NotificationsService.createNotification(
        data.dto,
        {
          email: data.email,
          template: 'ActiveYourEmail',
          context: {
            name: data.name,
            activationCode: data.code,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user_created event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.account-verification.resend')
  async handleResendVerificationCode(
    @Payload()
    data: {
      userId: string;
      email: string;
      name: string;
      code: string | number;
      dto: NotificationDto;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.eventId;

    try {
      await this.NotificationsService.createNotification(
        data.dto,
        {
          email: data.email,
          template: 'ActiveYourEmail',
          context: {
            name: data.name,
            activationCode: data.code,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.account-verification.resend event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('send_notification')
  async handleSendNotification(
    @Payload()
    data: NotificationDto & { eventId?: string; sourceEventId?: string },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId =
      data.sourceEventId ||
      data.eventId ||
      `send_notification_${data.UserId}_${data.title}`;

    try {
      await this.NotificationsService.createNotification(
        data,
        undefined,
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for send_notification event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process send_notification event for user ${data.UserId}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('USER_PASSWORD_CHANGED')
  async handleUserPasswordChanged(
    @Payload()
    data: {
      userId: string;
      email: string;
      changedAt: string;
      ipAddress: string;
      userAgent: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Security Alert: Password Changed',
      body: 'Your account password was recently changed.',
      type: NotificationType.ALERT_MESSAGE,
    };


    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.email,
          template: 'PasswordChanged',
          context: {
            changedAt: data.changedAt,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process USER_PASSWORD_CHANGED event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('USER_FORGOT_PASSWORD')
  async handleUserForgotPassword(
    @Payload()
    data: {
      userId?: string;
      email: string;
      name?: string;
      otp: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId || 'anonymous',
      title: 'Reset Your Password',
      body: `Your password reset code is ${data.otp}. It is valid for 5 minutes.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.email,
          template: 'ForgotPassword',
          context: {
            name: data.name || 'User',
            otp: data.otp,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process USER_FORGOT_PASSWORD event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('USER_PASSWORD_RESET_SUCCESS')
  async handleUserPasswordResetSuccess(
    @Payload()
    data: {
      userId: string;
      email: string;
      name?: string;
      changedAt: string;
      ipAddress?: string;
      userAgent?: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Security Alert: Password Reset Successful',
      body: 'Your account password has been successfully reset.',
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.email,
          template: 'PasswordChanged',
          context: {
            name: data.name || 'User',
            changedAt: data.changedAt,
            ipAddress: data.ipAddress || '',
            userAgent: data.userAgent || '',
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process USER_PASSWORD_RESET_SUCCESS event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.email-change.otp-requested')
  async handleEmailChangeOtpRequested(
    @Payload()
    data: {
      userId: string;
      oldEmail: string;
      newEmail: string;
      name?: string;
      code: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Confirm Your New Email Address',
      body: `Your verification code is ${data.code}. It is valid for 10 minutes.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.newEmail,
          template: 'EmailChangeOtp',
          context: {
            name: data.name || 'User',
            otp: data.code,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.email-change.otp-requested event for ${data.newEmail}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.email-change.security-alert')
  async handleEmailChangeSecurityAlert(
    @Payload()
    data: {
      userId: string;
      oldEmail: string;
      newEmail: string;
      name?: string;
      requestedAt: string;
      freezeToken?: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Security Alert: Email Change Requested',
      body: `An email change was requested for your account to ${data.newEmail}.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.oldEmail,
          template: 'EmailChangeSecurityAlert',
          context: {
            name: data.name || 'User',
            oldEmail: data.oldEmail,
            newEmail: data.newEmail,
            requestedAt: data.requestedAt,
            freezeToken: data.freezeToken,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.email-change.security-alert event for ${data.oldEmail}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.email-change.success-alert')
  async handleEmailChangeSuccessAlert(
    @Payload()
    data: {
      userId: string;
      oldEmail: string;
      newEmail: string;
      name?: string;
      rollbackToken: string;
      changedAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Security Notice: Email Address Changed',
      body: `Your account email address was changed to ${data.newEmail}. If unauthorized, you can roll back within 30 days.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.oldEmail,
          template: 'EmailChangeSuccessAlert',
          context: {
            name: data.name || 'User',
            oldEmail: data.oldEmail,
            newEmail: data.newEmail,
            rollbackToken: data.rollbackToken,
            changedAt: data.changedAt,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.email-change.success-alert event for ${data.oldEmail}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.email-change.reverted')
  async handleEmailChangeReverted(
    @Payload()
    data: {
      userId: string;
      email: string;
      name?: string;
      revertedAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Account Restored Successfully',
      body: `Your account email has been successfully rolled back to ${data.email}. All sessions have been terminated.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        {
          email: data.email,
          template: 'AccountRecoveredAlert',
          context: {
            name: data.name || 'User',
            email: data.email,
            revertedAt: data.revertedAt,
          },
        },
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.email-change.reverted event for ${data.email}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern('user.email-change.success')
  async handleEmailChangeSuccess(
    @Payload()
    data: {
      userId: string;
      oldEmail: string;
      newEmail: string;
      name?: string;
      changedAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    const sourceEventId = data.sourceEventId || data.eventId;

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Email Address Changed Successfully',
      body: `Your account email address has been updated to ${data.newEmail}.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        undefined,
        sourceEventId,
      );

      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        this.logger.warn(
          `Unique constraint violation (23505) for event ${sourceEventId}. Treating as already processed.`,
        );
        channel.ack(originalMsg);
        return;
      }

      this.logger.error(
        `Failed to process user.email-change.success event for user ${data.userId}: ${error.message}`,
      );

      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern(BookingOutboxEvent.BOOKING_HOLD_CREATED)
  async handleBookingHoldCreated(
    @Payload()
    data: {
      bookingId: string;
      bookingReference: string;
      userId: string;
      showtimeId: string;
      totalAmount: number;
      holdExpiresAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const sourceEventId = data.sourceEventId || data.eventId;

    this.logger.log(
      `[NotificationsService] 🎟️ Received booking.hold.created for booking ${data.bookingReference} (User: ${data.userId})`,
    );

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Seats Held Successfully',
      body: `Your seats for booking ${data.bookingReference} are held for 10 minutes. Total: ${data.totalAmount} EGP. Please proceed with payment before hold expires.`,
      type: NotificationType.NORMAL_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        undefined,
        sourceEventId,
      );
      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        channel.ack(originalMsg);
        return;
      }
      this.logger.error(
        `Failed to process booking.hold.created event for booking ${data.bookingId}: ${error.message}`,
      );
      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern(BookingOutboxEvent.BOOKING_CONFIRMED)
  async handleBookingConfirmed(
    @Payload()
    data: {
      bookingId: string;
      bookingReference: string;
      userId: string;
      showtimeId: string;
      totalAmount: number;
      paymentId: string;
      confirmedAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const sourceEventId = data.sourceEventId || data.eventId;

    this.logger.log(
      `[NotificationsService] 🎟️ Received booking.confirmed for booking ${data.bookingReference} (Payment: ${data.paymentId})`,
    );

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Booking Confirmed!',
      body: `Your booking ${data.bookingReference} has been confirmed. Total Paid: ${data.totalAmount} EGP. Your tickets have been issued.`,
      type: NotificationType.ALERT_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        undefined,
        sourceEventId,
      );
      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        channel.ack(originalMsg);
        return;
      }
      this.logger.error(
        `Failed to process booking.confirmed event for booking ${data.bookingId}: ${error.message}`,
      );
      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern(BookingOutboxEvent.BOOKING_CANCELLED)
  async handleBookingCancelled(
    @Payload()
    data: {
      bookingId: string;
      bookingReference: string;
      userId: string;
      showtimeId: string;
      reason?: string;
      cancelledAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const sourceEventId = data.sourceEventId || data.eventId;

    this.logger.log(
      `[NotificationsService] 🎟️ Received booking.cancelled for booking ${data.bookingReference}`,
    );

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Booking Cancelled',
      body: `Your booking ${data.bookingReference} has been cancelled.${data.reason ? ` Reason: ${data.reason}` : ''} Your seats have been released.`,
      type: NotificationType.WARNING_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        undefined,
        sourceEventId,
      );
      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        channel.ack(originalMsg);
        return;
      }
      this.logger.error(
        `Failed to process booking.cancelled event for booking ${data.bookingId}: ${error.message}`,
      );
      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }

  @EventPattern(BookingOutboxEvent.BOOKING_EXPIRED)
  async handleBookingExpired(
    @Payload()
    data: {
      bookingId: string;
      bookingReference: string;
      userId: string;
      showtimeId: string;
      expiredAt: string;
      eventId?: string;
      sourceEventId?: string;
    },
    @Ctx() context: RmqContext,
  ) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const sourceEventId = data.sourceEventId || data.eventId;

    this.logger.log(
      `[NotificationsService] 🎟️ Received booking.expired for booking ${data.bookingReference}`,
    );

    const notificationDto: NotificationDto = {
      UserId: data.userId,
      title: 'Seat Hold Expired',
      body: `The seat hold for booking ${data.bookingReference} has expired. Please select your seats again.`,
      type: NotificationType.WARNING_MESSAGE,
    };

    try {
      await this.NotificationsService.createNotification(
        notificationDto,
        undefined,
        sourceEventId,
      );
      channel.ack(originalMsg);
    } catch (error: any) {
      if (error?.code === '23505') {
        channel.ack(originalMsg);
        return;
      }
      this.logger.error(
        `Failed to process booking.expired event for booking ${data.bookingId}: ${error.message}`,
      );
      const isRedelivered = originalMsg.fields.redelivered;
      channel.nack(originalMsg, false, !isRedelivered);
    }
  }
}


