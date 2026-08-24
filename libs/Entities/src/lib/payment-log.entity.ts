import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Payment } from './payment.entity';

@Entity('payment_logs')
export class PaymentLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId?: string | null;

  @Index()
  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: false })
  eventType!: string;

  @Index()
  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  providerTransactionId?: string | null;

  @Column({
    name: 'raw_payload',
    type: 'jsonb',
    nullable: false,
  })
  rawPayload!: any;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  signature?: string | null;

  @Column({
    name: 'is_valid_signature',
    type: 'boolean',
    default: false,
  })
  isValidSignature!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne('Payment', 'logs', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;
}
