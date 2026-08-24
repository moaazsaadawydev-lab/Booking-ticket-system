import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  InitiatePaymentProvider,
  ProcessWebhookProvider,
  GetPaymentProvider,
} from './providers';

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly initiatePaymentProvider: InitiatePaymentProvider,
    private readonly processWebhookProvider: ProcessWebhookProvider,
    private readonly getPaymentProvider: GetPaymentProvider,
  ) {}

  @GrpcMethod('PaymentService', 'InitiatePayment')
  async initiatePayment(data: {
    booking_id?: string;
    bookingId?: string;
    user_id?: string;
    userId?: string;
    amount: number;
    currency?: string;
    method?: any;
    billing_data?: any;
    billingData?: any;
  }) {
    const bookingId = data.bookingId || data.booking_id || '';
    const userId = data.userId || data.user_id || '';
    const billingData = data.billingData || data.billing_data;

    return await this.initiatePaymentProvider.execute({
      bookingId,
      userId,
      amount: data.amount,
      currency: data.currency || 'EGP',
      method: data.method,
      billingData,
    });
  }

  @GrpcMethod('PaymentService', 'ProcessWebhook')
  async processWebhook(data: {
    raw_payload_json?: string;
    rawPayloadJson?: string;
    hmac_signature?: string;
    hmacSignature?: string;
  }) {
    const rawJson = data.rawPayloadJson || data.raw_payload_json || '{}';
    let rawPayload: any = {};
    try {
      rawPayload = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch {
      rawPayload = {};
    }

    const hmacSignature = data.hmacSignature || data.hmac_signature;

    return await this.processWebhookProvider.execute({
      rawPayload,
      hmacSignature,
    });
  }

  @GrpcMethod('PaymentService', 'GetPaymentById')
  async getPaymentById(data: {
    payment_id?: string;
    paymentId?: string;
    user_id?: string;
    userId?: string;
    is_admin?: boolean;
    isAdmin?: boolean;
  }) {
    const paymentId = data.paymentId || data.payment_id || '';
    const userId = data.userId || data.user_id;
    const isAdmin = Boolean(data.isAdmin ?? data.is_admin);

    return await this.getPaymentProvider.getPaymentById(
      paymentId,
      userId,
      isAdmin,
    );
  }

  @GrpcMethod('PaymentService', 'GetPaymentByBookingId')
  async getPaymentByBookingId(data: {
    booking_id?: string;
    bookingId?: string;
    user_id?: string;
    userId?: string;
    is_admin?: boolean;
    isAdmin?: boolean;
  }) {
    const bookingId = data.bookingId || data.booking_id || '';
    const userId = data.userId || data.user_id;
    const isAdmin = Boolean(data.isAdmin ?? data.is_admin);

    return await this.getPaymentProvider.getPaymentByBookingId(
      bookingId,
      userId,
      isAdmin,
    );
  }
}
