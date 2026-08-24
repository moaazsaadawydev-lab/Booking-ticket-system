import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SeatType } from '@booking-ticket-system/Utils';
import type { Booking } from './booking.entity';

@Entity('booking_seats')
export class BookingSeat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid', nullable: false })
  bookingId!: string;

  @Column({ name: 'seat_id', type: 'uuid', nullable: false })
  seatId!: string;

  @Column({
    name: 'seat_identifier',
    type: 'varchar',
    length: 10,
    nullable: false,
  })
  seatIdentifier!: string;

  @Column({
    name: 'seat_type',
    type: 'enum',
    enum: SeatType,
    nullable: false,
  })
  seatType!: SeatType;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: false,
  })
  unitPrice!: number;

  @Index()
  @ManyToOne('Booking', 'seats', { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;
}
