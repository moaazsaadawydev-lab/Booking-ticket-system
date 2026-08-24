import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OutboxStatus } from '@booking-ticket-system/Utils';

@Entity('payment_outbox')
export class PaymentOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: false })
  eventType!: string;

  @Column({
    name: 'routing_key',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  routingKey?: string | null;

  @Column({
    type: 'jsonb',
    nullable: false,
  })
  payload!: any;

  @Index()
  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
    nullable: false,
  })
  status!: OutboxStatus;

  @Column({
    name: 'retry_count',
    type: 'int',
    default: 0,
    nullable: false,
  })
  retryCount!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({
    name: 'published_at',
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
  })
  publishedAt?: Date | null;
}
