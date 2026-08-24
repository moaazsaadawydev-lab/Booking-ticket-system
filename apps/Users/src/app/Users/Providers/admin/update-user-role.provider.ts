import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '@booking-ticket-system/Entities';
import { RedisService } from '@booking-ticket-system/Redis';
import { UserRole } from '@booking-ticket-system/Utils';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export interface UpdateUserRolePayload {
  targetUserId: string;
  role: UserRole | string;
  cinemaId?: string | null;
  actorId: string;
  actorRole: UserRole | string;
  actorCinemaId?: string | null;
}

@Injectable()
export class UpdateUserRoleProvider {
  private readonly logger = new Logger(UpdateUserRoleProvider.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    private readonly redisService: RedisService,
  ) {}

  async execute(payload: UpdateUserRolePayload): Promise<{
    success: boolean;
    message: string;
    userId: string;
    role: string;
    cinemaId?: string | null;
  }> {
    const {
      targetUserId,
      role: rawRole,
      cinemaId,
      actorId,
      actorRole: rawActorRole,
      actorCinemaId,
    } = payload;

    if (!targetUserId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Target user ID is required.',
      });
    }

    if (!rawRole) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Role is required.',
      });
    }

    const newRole = rawRole.toLowerCase().trim() as UserRole;
    const actorRole = rawActorRole ? rawActorRole.toLowerCase().trim() : '';

    if (!Object.values(UserRole).includes(newRole)) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: `Invalid role "${rawRole}". Must be one of [${Object.values(
          UserRole,
        ).join(', ')}]`,
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found.',
      });
    }

    const currentTargetRole = user.role?.toLowerCase();

    // 1. Hierarchical RBAC validation
    if (actorRole === UserRole.SUPER_ADMIN) {
      // Super Admin has unrestricted promotion privileges
    } else if (actorRole === UserRole.ADMIN) {
      // Admin cannot modify Super Admins or other Admins
      if (
        currentTargetRole === UserRole.SUPER_ADMIN ||
        currentTargetRole === UserRole.ADMIN
      ) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message: 'Admins cannot modify other Admins or Super Admins.',
        });
      }

      // Admin cannot promote users to Super Admin or Admin
      if (
        newRole === UserRole.SUPER_ADMIN ||
        newRole === UserRole.ADMIN
      ) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message: 'Admins cannot elevate users to Admin or Super Admin.',
        });
      }
    } else if (actorRole === UserRole.CINEMA_ADMIN) {
      // Cinema Admin can only manage standard users or branch staff
      if (
        currentTargetRole === UserRole.SUPER_ADMIN ||
        currentTargetRole === UserRole.ADMIN ||
        currentTargetRole === UserRole.CINEMA_ADMIN
      ) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message: 'Cinema Admins can only manage branch staff and customers.',
        });
      }

      // Cinema Admin can only assign staff or gate_checker
      if (
        newRole !== UserRole.STAFF &&
        newRole !== UserRole.GATE_CHECKER &&
        newRole !== UserRole.USER
      ) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message:
            'Cinema Admins can only assign STAFF, GATE_CHECKER, or USER roles.',
        });
      }

      // Scoped to own cinema branch
      if (actorCinemaId && cinemaId && actorCinemaId !== cinemaId) {
        throw new RpcException({
          code: status.PERMISSION_DENIED,
          message:
            'Cinema Admins can only assign staff to their own cinema branch.',
        });
      }
    } else {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Access denied: Insufficient permissions to modify user roles.',
      });
    }

    // 2. Branch-specific Role Validation
    const isBranchRole =
      newRole === UserRole.CINEMA_ADMIN ||
      newRole === UserRole.STAFF ||
      newRole === UserRole.GATE_CHECKER;

    const effectiveCinemaId = cinemaId || (actorRole === UserRole.CINEMA_ADMIN ? actorCinemaId : null);

    if (isBranchRole && !effectiveCinemaId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: `cinemaId is required when assigning ${newRole.toUpperCase()} role.`,
      });
    }

    // 3. Persist Changes
    user.role = newRole;
    user.cinemaId = isBranchRole ? effectiveCinemaId : null;
    await this.userRepository.save(user);

    // 4. Invalidate Sessions in Redis
    try {
      await this.redisService.revokeAllUserSessions(user.id);
      await this.redisService.del(`auth:token:${user.id}`);
      await this.redisService.del(`user:${user.id}`);
    } catch (e: any) {
      this.logger.warn(
        `Failed to revoke Redis session for user ${user.id}: ${e.message}`,
      );
    }

    this.logger.log(
      `User ${user.id} role updated from ${currentTargetRole} to ${newRole} (cinemaId: ${user.cinemaId}) by actor ${actorId} (${actorRole})`,
    );

    return {
      success: true,
      message: `User role updated to ${newRole} successfully.`,
      userId: user.id,
      role: user.role,
      cinemaId: user.cinemaId,
    };
  }
}
