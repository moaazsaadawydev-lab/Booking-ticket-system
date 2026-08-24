import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { PAYMENT_SERVICE } from '@booking-ticket-system/Constants';
import { InitiatePaymentDto } from '@booking-ticket-system/DTOs';

@Injectable()
export class PaymentProvider implements OnModuleInit {
  private paymentService: any;

  constructor(
    @Inject(PAYMENT_SERVICE) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.paymentService = this.client.getService('PaymentService');
  }

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const res: any = await lastValueFrom(
      this.paymentService.InitiatePayment({
        booking_id: dto.bookingId,
        bookingId: dto.bookingId,
        user_id: userId,
        userId,
        amount: dto.amount,
        currency: dto.currency || 'EGP',
        method: dto.method,
        billing_data: dto.billingData,
        billingData: dto.billingData,
      }),
    );

    return {
      paymentId: res.payment_id || res.paymentId,
      bookingId: res.booking_id || res.bookingId,
      status: res.status,
      paymentToken: res.payment_token || res.paymentToken,
      iframeUrl: res.iframe_url || res.iframeUrl,
      providerOrderId: res.provider_order_id || res.providerOrderId,
      amount: res.amount,
      currency: res.currency,
    };
  }

  async processWebhook(rawPayload: any, hmacSignature?: string) {
    const rawJson =
      typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);

    const res: any = await lastValueFrom(
      this.paymentService.ProcessWebhook({
        raw_payload_json: rawJson,
        rawPayloadJson: rawJson,
        hmac_signature: hmacSignature || '',
        hmacSignature: hmacSignature || '',
      }),
    );

    return {
      success: res.success,
      message: res.message,
      paymentId: res.payment_id || res.paymentId,
      bookingId: res.booking_id || res.bookingId,
      status: res.status,
      transactionId: res.transaction_id || res.transactionId,
    };
  }

  async getPaymentById(paymentId: string, userId: string, isAdmin = false) {
    const res: any = await lastValueFrom(
      this.paymentService.GetPaymentById({
        payment_id: paymentId,
        paymentId,
        user_id: userId,
        userId,
        is_admin: isAdmin,
        isAdmin,
      }),
    );
    const p = res?.payment || {};
    return {
      payment: {
        id: p.id,
        bookingId: p.booking_id || p.bookingId,
        userId: p.user_id || p.userId,
        amount: p.amount,
        currency: p.currency,
        provider: p.provider,
        method: p.method,
        status: p.status,
        providerOrderId: p.provider_order_id || p.providerOrderId,
        providerTransactionId: p.provider_transaction_id || p.providerTransactionId,
        paymentToken: p.payment_token || p.paymentToken,
        failureReason: p.failure_reason || p.failureReason,
        createdAt: p.created_at || p.createdAt,
        updatedAt: p.updated_at || p.updatedAt,
      },
    };
  }

  async getPaymentByBookingId(bookingId: string, userId: string, isAdmin = false) {
    const res: any = await lastValueFrom(
      this.paymentService.GetPaymentByBookingId({
        booking_id: bookingId,
        bookingId,
        user_id: userId,
        userId,
        is_admin: isAdmin,
        isAdmin,
      }),
    );
    const p = res?.payment || {};
    return {
      payment: {
        id: p.id,
        bookingId: p.booking_id || p.bookingId,
        userId: p.user_id || p.userId,
        amount: p.amount,
        currency: p.currency,
        provider: p.provider,
        method: p.method,
        status: p.status,
        providerOrderId: p.provider_order_id || p.providerOrderId,
        providerTransactionId: p.provider_transaction_id || p.providerTransactionId,
        paymentToken: p.payment_token || p.paymentToken,
        failureReason: p.failure_reason || p.failureReason,
        createdAt: p.created_at || p.createdAt,
        updatedAt: p.updated_at || p.updatedAt,
      },
    };
  }
}
