import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OutboxMessage, Users } from '@booking-ticket-system/Entities';
import { RedisService } from '@booking-ticket-system/Redis';
import { UserRole, UserStatus } from '@booking-ticket-system/Utils';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OutboxPublisherService } from '../../../outbox/outbox-publisher.service';

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  phoneNumber?: string;
  birthDate?: string | Date;
  role: UserRole | string;
  cinemaId?: string | null;
  adminPassword: string;
  actorId: string;
  actorRole: UserRole | string;
}

@Injectable()
export class CreateStaffProvider {
  private readonly logger = new Logger(CreateStaffProvider.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly redisService: RedisService,
    private readonly outboxService: OutboxPublisherService,
  ) {}

  async execute(payload: CreateStaffPayload) {
    const {
      fullName,
      email,
      phoneNumber,
      birthDate,
      role: rawRole,
      cinemaId,
      adminPassword,
      actorId,
      actorRole: rawActorRole,
    } = payload;

    if (!actorId) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Actor ID is required for administrative actions.',
      });
    }

    if (!adminPassword) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Administrative confirmation password is required.',
      });
    }

    if (!email || !fullName || !rawRole) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Full name, email, and role are required.',
      });
    }

    // 1. Sudo Rate Limiting (Redis Counter: Max 5 failed attempts per 15-minute sliding window)
    const rateLimitKey = `rate:sudo:staff-create:${actorId}`;
    const failedAttempts = await this.redisService.get<number>(rateLimitKey);

    if (failedAttempts && Number(failedAttempts) >= 5) {
      throw new RpcException({
        code: status.RESOURCE_EXHAUSTED,
        message:
          'Too many failed administrative confirmation attempts. Please try again in 15 minutes.',
      });
    }

    // 2. Caller Password Verification
    const caller = await this.userRepository.findOne({
      where: { id: actorId },
    });

    if (!caller || !caller.password) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Calling administrator account not found or invalid.',
      });
    }

    const isPasswordValid = await bcrypt.compare(
      adminPassword,
      caller.password,
    );

    if (!isPasswordValid) {
      await this.redisService.incrementCounter(rateLimitKey, 900); // 15 minutes TTL
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid administrative confirmation password',
      });
    }

    // Clear failed attempts counter on successful authentication
    await this.redisService.del(rateLimitKey);

    // 3. RBAC Hierarchy Enforcement
    const actorRole: string = (rawActorRole || caller.role || '')
      .toString()
      .toLowerCase()
      .trim();
    const newRole: string = rawRole.toString().toLowerCase().trim();

    if (actorRole !== 'super_admin' && actorRole !== 'admin') {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Only administrators can create staff accounts.',
      });
    }

    if (actorRole === 'admin') {
      const allowedRolesForAdmin = [
        UserRole.CINEMA_ADMIN,
        UserRole.ACCOUNTANT,
        UserRole.MARKETING,
        UserRole.GATE_CHECKER,
        UserRole.STAFF,
      ];
      if (!allowedRolesForAdmin.includes(newRole as UserRole)) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message: 'Admins cannot create other Admin or Super Admin accounts',
        });
      }
    }

    // 4. Cinema Assignment Constraints
    const branchRoles = ['cinema_admin', 'gate_checker', 'staff'];

    let effectiveCinemaId: string | null = null;
    if (branchRoles.includes(newRole)) {
      if (!cinemaId || String(cinemaId).trim() === '') {
        throw new RpcException({
          code: status.INVALID_ARGUMENT,
          message: `cinemaId is mandatory for role: ${newRole}`,
        });
      }
      effectiveCinemaId = String(cinemaId).trim();
    }

    // 5. Check Duplicate Email
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'A user with this email address already exists.',
      });
    }

    // 6. Cryptographic Invitation Token Generation
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = crypto
      .createHash('sha256')
      .update(rawInvitationToken)
      .digest('hex');
    const invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 Hours

    // 7. Transactional User & Outbox Persistence
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const parsedBirthDate = birthDate ? new Date(birthDate) : null;
      const user = queryRunner.manager.create(Users, {
        id: crypto.randomUUID(),
        name: fullName.trim(),
        email: normalizedEmail,
        phoneNumber: phoneNumber?.trim() || null,
        birthDate: parsedBirthDate,
        role: newRole as UserRole,
        cinemaId: effectiveCinemaId,
        status: UserStatus.PENDING_ACTIVATION,
        password: null,
        createdBy: actorId,
        invitationTokenHash,
        invitationExpiresAt,
      });

      await queryRunner.manager.save(user);

      // Outbox Message Dispatch
      const outboxEvent = queryRunner.manager.create(OutboxMessage, {
        eventType: 'staff.invitation.created',
        payload: {
          userId: user.id,
          email: user.email,
          fullName: user.name,
          invitationToken: rawInvitationToken,
          role: user.role,
          cinemaId: user.cinemaId,
          createdBy: actorId,
        },
      });

      await queryRunner.manager.save(outboxEvent);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Staff invitation created successfully: ${user.email} (${user.role}) by ${actorId}`,
      );

      return {
        success: true,
        message: 'Staff invitation created and dispatched successfully',
        userId: user.id,
        user_id: user.id,
        email: user.email,
        fullName: user.name,
        full_name: user.name,
        role: user.role,
        cinemaId: user.cinemaId,
        cinema_id: user.cinemaId,
        status: user.status,
        createdBy: user.createdBy,
        created_by: user.createdBy,
      };
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err instanceof RpcException) throw err;
      this.logger.error(`Error saving staff user: ${err.message}`, err.stack);
      throw new RpcException({
        code: status.INTERNAL,
        message: 'Failed to create staff member.',
      });
    } finally {
      await queryRunner.release();
    }
  }
}
