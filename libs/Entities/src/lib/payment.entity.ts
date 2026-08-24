import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@booking-ticket-system/Utils';
import type { PaymentLog } from './payment-log.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'booking_id', type: 'uuid', nullable: false })
  bookingId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: false,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP' })
  currency!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: PaymentProvider.PAYMOB,
  })
  provider!: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    nullable: false,
  })
  method!: PaymentMethod;

  @Index()
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    nullable: false,
  })
  status!: PaymentStatus;

  @Index()
  @Column({
    name: 'provider_order_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  providerOrderId?: string | null;

  @Index({ unique: true })
  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 100,
    unique: true,
    nullable: true,
  })
  providerTransactionId?: string | null;

  @Column({
    name: 'payment_token',
    type: 'text',
    nullable: true,
  })
  paymentToken?: string | null;

  @Column({
    name: 'failure_reason',
    type: 'text',
    nullable: true,
  })
  failureReason?: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToMany('PaymentLog', 'payment')
  logs!: PaymentLog[];
}
