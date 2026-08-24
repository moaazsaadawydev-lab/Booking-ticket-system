import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketStatus } from '@booking-ticket-system/Utils';
import type { Booking } from './booking.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid', nullable: false })
  bookingId!: string;

  @Column({ name: 'seat_id', type: 'uuid', nullable: false })
  seatId!: string;

  @Index({ unique: true })
  @Column({
    name: 'ticket_number',
    type: 'varchar',
    length: 30,
    unique: true,
    nullable: false,
  })
  ticketNumber!: string;

  @Column({
    name: 'qr_code_token',
    type: 'text',
    nullable: false,
  })
  qrCodeToken!: string;

  @Index()
  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ISSUED,
    nullable: false,
  })
  status!: TicketStatus;

  @Column({
    name: 'used_at',
    type: 'timestamp with time zone',
    nullable: true,
    default: null,
  })
  usedAt!: Date | null;

  @Column({
    name: 'scanned_by_user_id',
    type: 'uuid',
    nullable: true,
    default: null,
  })
  scannedByUserId!: string | null;

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

  @Index()
  @ManyToOne('Booking', 'tickets', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;
}
