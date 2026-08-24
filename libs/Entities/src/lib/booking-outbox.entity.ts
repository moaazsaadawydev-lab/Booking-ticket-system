import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OutboxStatus } from '@booking-ticket-system/Utils';

@Entity('booking_outbox')
export class BookingOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100, nullable: false })
  eventType!: string;

  @Column({ type: 'jsonb', nullable: false })
  payload!: Record<string, any>;

  @Index()
  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
    nullable: false,
  })
  status!: OutboxStatus;

  @Column({ name: 'retry_count', type: 'int', default: 0, nullable: false })
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
  publishedAt!: Date | null;
}
