import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Payment } from '@booking-ticket-system/Entities';
import { PaymentMethod, PaymentStatus, PaymentProvider as PaymentProviderEnum } from '@booking-ticket-system/Utils';
import { PaymobProvider, PaymobBillingData } from './paymob.provider';

export interface InitiatePaymentParams {
  bookingId: string;
  userId: string;
  amount: number;
  currency?: string;
  method?: PaymentMethod;
  billingData?: PaymobBillingData;
}

@Injectable()
export class InitiatePaymentProvider {
  private readonly logger = new Logger(InitiatePaymentProvider.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymobProvider: PaymobProvider,
  ) {}

  async execute(params: InitiatePaymentParams): Promise<any> {
    if (!params.bookingId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'bookingId is required',
      });
    }

    if (!params.userId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'userId is required',
      });
    }

    if (!params.amount || params.amount <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'amount must be a positive number',
      });
    }

    const method = params.method || PaymentMethod.CARD;
    const currency = params.currency || 'EGP';
    const integrationId =
      method === PaymentMethod.WALLET
        ? this.paymobProvider.getWalletIntegrationId()
        : this.paymobProvider.getCardIntegrationId();

    const paymentRepo = this.dataSource.getRepository(Payment);

    // Check if an existing payment for this booking is already SUCCEEDED
    const existing = await paymentRepo.findOne({
      where: { bookingId: params.bookingId },
      order: { createdAt: 'DESC' },
    });

    if (existing && existing.status === PaymentStatus.SUCCEEDED) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'Payment for this booking has already been completed',
      });
    }

    // Create a new PENDING payment record
    const payment = paymentRepo.create({
      bookingId: params.bookingId,
      userId: params.userId,
      amount: params.amount,
      currency,
      provider: PaymentProviderEnum.PAYMOB,
      method,
      status: PaymentStatus.PENDING,
    });
    await paymentRepo.save(payment);

    this.logger.log(
      `Initiated payment record ${payment.id} for booking ${params.bookingId} (${params.amount} ${currency})`,
    );

    // Call Paymob 3-Step Checkout Flow
    const billing: PaymobBillingData = params.billingData || {
      first_name: 'Customer',
      last_name: 'Customer',
      email: 'customer@booking.local',
      phone_number: '+201000000000',
    };

    try {
      const paymobResult = await this.paymobProvider.initiatePayment(
        params.amount,
        params.bookingId,
        integrationId,
        billing,
      );

      payment.providerOrderId = String(paymobResult.orderId);
      payment.paymentToken = paymobResult.paymentToken;
      await paymentRepo.save(payment);

      this.logger.log(
        `Paymob session established for payment ${payment.id}. OrderId: ${paymobResult.orderId}`,
      );

      return {
        payment_id: payment.id,
        paymentId: payment.id,
        booking_id: payment.bookingId,
        bookingId: payment.bookingId,
        status: payment.status,
        payment_token: payment.paymentToken,
        paymentToken: payment.paymentToken,
        iframe_url: paymobResult.iframeUrl,
        iframeUrl: paymobResult.iframeUrl,
        provider_order_id: payment.providerOrderId,
        providerOrderId: payment.providerOrderId,
        amount: payment.amount,
        currency: payment.currency,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to establish Paymob payment session: ${err.message}`,
      );
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = err.message;
      await paymentRepo.save(payment);

      throw new RpcException({
        code: status.INTERNAL,
        message: `Failed to initiate payment with provider: ${err.message}`,
      });
    }
  }
}
