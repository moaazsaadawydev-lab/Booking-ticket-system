import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIMESTAMP } from '@booking-ticket-system/Constants';
import type { Auditorium } from './auditorium.entity';
import type { CinemaAdmin } from './cinema-admin.entity';

@Entity('cinemas')
@Index(['slug'], { unique: true, where: 'deleted_at IS NULL' })
export class Cinema {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 160, nullable: false })
  slug!: string;

  @Column({ type: 'text', nullable: true, default: null })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: false })
  city!: string;

  @Index()
  @Column({ type: 'varchar', length: 2, default: 'EG', nullable: false })
  country!: string;

  @Column({ type: 'text', nullable: false })
  address!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 8,
    nullable: true,
    default: null,
  })
  latitude!: number | null;

  @Column({
    type: 'decimal',
    precision: 11,
    scale: 8,
    nullable: true,
    default: null,
  })
  longitude!: number | null;

  @Column({
    name: 'phone_number',
    type: 'varchar',
    length: 20,
    nullable: true,
    default: null,
  })
  phoneNumber!: string | null;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    default: null,
  })
  facilities!: string[] | null;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    default: null,
  })
  thumbnailUrl!: string | null;

  @Column({
    name: 'gallery_urls',
    type: 'text',
    array: true,
    nullable: false,
    default: '{}',
  })
  galleryUrls!: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: false })
  isActive!: boolean;

  @OneToMany('Auditorium', (auditorium: Auditorium) => auditorium.cinema, {
    cascade: true,
  })
  auditoriums!: Auditorium[];

  @OneToMany('CinemaAdmin', (admin: CinemaAdmin) => admin.cinema, {
    cascade: true,
  })
  admins!: CinemaAdmin[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => TIMESTAMP,
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => TIMESTAMP,
    onUpdate: TIMESTAMP,
  })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  deletedAt?: Date | null;
}
