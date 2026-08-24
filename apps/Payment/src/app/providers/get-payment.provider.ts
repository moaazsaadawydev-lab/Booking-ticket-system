import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { Payment } from '@booking-ticket-system/Entities';

function formatPaymentEntity(p: Payment) {
  return {
    id: p.id,
    booking_id: p.bookingId,
    bookingId: p.bookingId,
    user_id: p.userId,
    userId: p.userId,
    amount: Number(p.amount),
    currency: p.currency,
    provider: p.provider,
    method: p.method,
    status: p.status,
    provider_order_id: p.providerOrderId || '',
    providerOrderId: p.providerOrderId || '',
    provider_transaction_id: p.providerTransactionId || '',
    providerTransactionId: p.providerTransactionId || '',
    payment_token: p.paymentToken || '',
    paymentToken: p.paymentToken || '',
    failure_reason: p.failureReason || '',
    failureReason: p.failureReason || '',
    created_at: p.createdAt ? p.createdAt.toISOString() : '',
    updated_at: p.updatedAt ? p.updatedAt.toISOString() : '',
  };
}

@Injectable()
export class GetPaymentProvider {
  private readonly logger = new Logger(GetPaymentProvider.name);

  constructor(private readonly dataSource: DataSource) {}

  async getPaymentById(
    paymentId: string,
    userId?: string,
    isAdmin = false,
  ): Promise<any> {
    if (!paymentId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'paymentId is required',
      });
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    const payment = await paymentRepo.findOne({
      where: { id: paymentId },
      relations: {
        logs: true,
      },
    });

    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Payment with ID "${paymentId}" was not found`,
      });
    }

    if (userId && !isAdmin && payment.userId !== userId) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'You do not have permission to view this payment',
      });
    }

    return { payment: formatPaymentEntity(payment) };
  }

  async getPaymentByBookingId(
    bookingId: string,
    userId?: string,
    isAdmin = false,
  ): Promise<any> {
    if (!bookingId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'bookingId is required',
      });
    }

    const paymentRepo = this.dataSource.getRepository(Payment);
    const payment = await paymentRepo.findOne({
      where: { bookingId },
      relations: {
        logs: true,
      },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Payment for booking "${bookingId}" was not found`,
      });
    }

    if (userId && !isAdmin && payment.userId !== userId) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'You do not have permission to view this payment',
      });
    }

    return { payment: formatPaymentEntity(payment) };
  }
}
