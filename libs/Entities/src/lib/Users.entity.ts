import {
  AfterLoad,
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  Country,
  UserGender,
  UserRole,
  UserStatus,
  AuthProviderType,
} from '@booking-ticket-system/Utils';
import { TIMESTAMP } from '@booking-ticket-system/Constants';
import type { UserEmailHistory } from './UserEmailHistory.entity';

export { UserStatus, AuthProviderType };

@Entity()
export class Users {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password!: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate!: Date | null;

  @Column({
    type: 'enum',
    enum: UserGender,
    nullable: true,
  })
  gender!: UserGender | null;

  @Column({
    type: 'enum',
    enum: Country,
    nullable: true,
  })
  country!: Country | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  avatarKey!: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  avatarUrl?: string | null;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  googleId!: string | null;

  @Column({
    type: 'enum',
    enum: AuthProviderType,
    default: AuthProviderType.LOCAL,
    nullable: false,
  })
  provider!: AuthProviderType;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
    nullable: false,
  })
  role!: UserRole;

  @Column({ type: 'uuid', nullable: true, default: null })
  cinemaId!: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.UNVERIFIED,
    nullable: false,
  })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  statusReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  suspendedUntil!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  statusChangedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  passwordChangedAt!: Date | null;

  @Column({ type: 'boolean', default: false, nullable: false })
  mustChangePassword!: boolean;

  @OneToMany('UserEmailHistory', 'user')
  emailHistory!: UserEmailHistory[];

  @CreateDateColumn({
    type: 'timestamp',
    default: () => TIMESTAMP,
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => TIMESTAMP,
    onUpdate: TIMESTAMP,
  })
  updatedAt!: Date;

  @AfterLoad()
  @BeforeInsert()
  @BeforeUpdate()
  populateAvatarUrl() {
    if (!this.avatarUrl && this.avatarKey) {
      const baseUrl =
        process.env['MEDIA_BASE_URL'] || 'http://localhost:3000/api/v1/media';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const cleanKey = this.avatarKey.startsWith('/')
        ? this.avatarKey.slice(1)
        : this.avatarKey;
      this.avatarUrl = cleanKey.startsWith('http')
        ? cleanKey
        : `${cleanBase}/${cleanKey}`;
    }
  }
}
