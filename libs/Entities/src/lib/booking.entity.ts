import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingStatus } from '@booking-ticket-system/Utils';
import type { BookingSeat } from './booking-seat.entity';
import type { Ticket } from './ticket.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({
    name: 'booking_reference',
    type: 'varchar',
    length: 12,
    unique: true,
    nullable: false,
  })
  bookingReference!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  @Index()
  @Column({ name: 'showtime_id', type: 'uuid', nullable: false })
  showtimeId!: string;

  @Column({ name: 'cinema_id', type: 'uuid', nullable: false })
  cinemaId!: string;

  @Column({ name: 'auditorium_id', type: 'uuid', nullable: false })
  auditoriumId!: string;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
  })
  totalAmount!: number;

  @Column({ type: 'varchar', length: 3, default: 'EGP', nullable: false })
  currency!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING_PAYMENT,
    nullable: false,
  })
  status!: BookingStatus;

  @Column({
    name: 'payment_id',
    type: 'uuid',
    nullable: true,
    default: null,
  })
  paymentId!: string | null;

  @Column({
    name: 'hold_expires_at',
    type: 'timestamp with time zone',
    nullable: false,
  })
  holdExpiresAt!: Date;

  @Column({
    name: 'confirmed_at',
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
  })
  confirmedAt!: Date | null;

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

  @OneToMany('BookingSeat', 'booking', { cascade: true })
  seats!: BookingSeat[];

  @OneToMany('Ticket', 'booking', { cascade: true })
  tickets!: Ticket[];
}
