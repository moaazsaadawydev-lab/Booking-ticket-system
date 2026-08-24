import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import {
  Payment,
  PaymentLog,
  PaymentOutbox,
} from '@booking-ticket-system/Entities';
import {
  PaymentStatus,
  OutboxStatus,
} from '@booking-ticket-system/Utils';
import { PaymentOutboxEvent } from '@booking-ticket-system/Constants';
import { PaymobProvider } from './paymob.provider';

export interface ProcessWebhookParams {
  rawPayload: any;
  hmacSignature?: string;
}

@Injectable()
export class ProcessWebhookProvider {
  private readonly logger = new Logger(ProcessWebhookProvider.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymobProvider: PaymobProvider,
  ) {}

  async execute(params: ProcessWebhookParams): Promise<any> {
    const raw = params.rawPayload || {};
    const obj = raw.obj || raw;
    const eventType = raw.type || 'TRANSACTION';
    const transactionId = obj.id ? String(obj.id) : null;
    const providerOrderId = obj.order?.id ? String(obj.order.id) : (obj.order ? String(obj.order) : null);
    const merchantOrderId = obj.order?.merchant_order_id || null;
    const isSuccess = Boolean(obj.success);
    const signature = params.hmacSignature || '';

    this.logger.log(
      `Received Paymob Webhook: type=${eventType}, txId=${transactionId}, orderId=${providerOrderId}, success=${isSuccess}`,
    );

    // 1. Acquire Distributed Lock to prevent concurrent racing webhooks
    if (transactionId) {
      const lockAcquired = await this.paymobProvider.acquireWebhookLock(
        transactionId,
      );
      if (!lockAcquired) {
        this.logger.warn(
          `Webhook transaction ${transactionId} is currently being processed concurrently. Acknowledging.`,
        );
        return {
          success: true,
          message: 'Webhook is already being processed concurrently',
          transactionId,
        };
      }
    }

    try {
      // 2. Validate HMAC Signature
      let isValidSignature = false;
      if (signature) {
        isValidSignature = this.paymobProvider.verifyHmac(raw, signature);
      } else {
        this.logger.warn('Webhook received without HMAC signature');
      }

      // 3. Save Immutable Audit Log in payment_logs
      const paymentLogRepo = this.dataSource.getRepository(PaymentLog);
      let matchedPayment: Payment | null = null;
      const paymentRepo = this.dataSource.getRepository(Payment);

      // Find matching payment by providerOrderId or merchantOrderId (bookingId/paymentId)
      if (providerOrderId) {
        matchedPayment = await paymentRepo.findOne({
          where: { providerOrderId },
          order: { createdAt: 'DESC' },
        });
      }

      if (!matchedPayment && merchantOrderId) {
        matchedPayment = await paymentRepo.findOne({
          where: [{ bookingId: merchantOrderId }, { id: merchantOrderId }],
          order: { createdAt: 'DESC' },
        });
      }

      const logEntity = paymentLogRepo.create({
        paymentId: matchedPayment?.id || null,
        eventType,
        providerTransactionId: transactionId,
        rawPayload: raw,
        signature,
        isValidSignature,
      });
      await paymentLogRepo.save(logEntity);

      if (!isValidSignature) {
        this.logger.error(
          `Rejecting webhook: Invalid HMAC signature for transaction ${transactionId}`,
        );
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: 'Invalid Paymob webhook HMAC signature',
        });
      }

      if (!matchedPayment) {
        this.logger.warn(
          `No matching payment found for providerOrderId: ${providerOrderId}, merchantOrderId: ${merchantOrderId}`,
        );
        return {
          success: true,
          message: 'Webhook logged, but no matching payment found',
          transactionId,
        };
      }

      // 4. Idempotency Guard: If already SUCCEEDED with this transaction ID, acknowledge immediately
      if (
        matchedPayment.status === PaymentStatus.SUCCEEDED &&
        matchedPayment.providerTransactionId === transactionId
      ) {
        this.logger.log(
          `Payment ${matchedPayment.id} already marked SUCCEEDED for transaction ${transactionId}. Idempotent return.`,
        );
        return {
          success: true,
          message: 'Payment already processed successfully',
          paymentId: matchedPayment.id,
          bookingId: matchedPayment.bookingId,
          status: matchedPayment.status,
          transactionId,
        };
      }

      // 5. Atomic Database Transaction: Update Payment & Persist Outbox Event
      const updatedPayment = await this.dataSource.transaction(
        async (manager) => {
          if (isSuccess) {
            matchedPayment.status = PaymentStatus.SUCCEEDED;
            matchedPayment.providerTransactionId = transactionId;
            matchedPayment.failureReason = null;
          } else {
            matchedPayment.status = PaymentStatus.FAILED;
            matchedPayment.providerTransactionId = transactionId;
            matchedPayment.failureReason =
              obj.data_message || 'Payment transaction failed or declined';
          }

          const savedPayment = await manager.save(Payment, matchedPayment);

          // Create Outbox Event
          const eventTypeOutbox = isSuccess
            ? PaymentOutboxEvent.PAYMENT_SUCCEEDED
            : PaymentOutboxEvent.PAYMENT_FAILED;

          const outboxEntity = manager.create(PaymentOutbox, {
            eventType: eventTypeOutbox,
            routingKey: 'payment.events',
            payload: {
              paymentId: savedPayment.id,
              bookingId: savedPayment.bookingId,
              userId: savedPayment.userId,
              amount: savedPayment.amount,
              currency: savedPayment.currency,
              providerTransactionId: transactionId,
              providerOrderId: savedPayment.providerOrderId,
              method: savedPayment.method,
              status: savedPayment.status,
              failureReason: savedPayment.failureReason,
              timestamp: new Date().toISOString(),
            },
            status: OutboxStatus.PENDING,
          });
          await manager.save(PaymentOutbox, outboxEntity);

          return savedPayment;
        },
      );

      this.logger.log(
        `Successfully transitioned payment ${updatedPayment.id} to ${updatedPayment.status} and created outbox event`,
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
        payment_id: updatedPayment.id,
        paymentId: updatedPayment.id,
        booking_id: updatedPayment.bookingId,
        bookingId: updatedPayment.bookingId,
        status: updatedPayment.status,
        transaction_id: transactionId,
        transactionId,
      };
    } finally {
      // 6. Release Distributed Lock
      if (transactionId) {
        await this.paymobProvider.releaseWebhookLock(transactionId);
      }
    }
  }
}
