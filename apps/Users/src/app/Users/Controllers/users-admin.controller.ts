import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import { SanitizeUserInterceptor } from '@booking-ticket-system/Common';
import { UserStatus } from '@booking-ticket-system/Utils';
import { UpdateUserStatusPayload } from '@booking-ticket-system/Interfaces';
import {
  CreateStaffProvider,
  ListUsersProvider,
  UpdateUserRoleProvider,
  UpdateUserStatusProvider,
} from '../Providers';

@Controller()
@UseInterceptors(SanitizeUserInterceptor)
export class UsersAdminController {
  constructor(
    private readonly updateUserStatusProvider: UpdateUserStatusProvider,
    private readonly updateUserRoleProvider: UpdateUserRoleProvider,
    private readonly createStaffProvider: CreateStaffProvider,
    private readonly listUsersProvider: ListUsersProvider,
  ) {}

  @GrpcMethod('UsersService', 'ListUsers')
  async listUsers(@Payload() data: any) {
    return await this.listUsersProvider.execute({
      search: data?.search,
      role: data?.role,
      cinemaId: data?.cinemaId || data?.cinema_id,
      page: data?.page,
      limit: data?.limit,
    });
  }

  @GrpcMethod('UsersService', 'CreateStaff')
  async createStaff(@Payload() data: any) {
    return await this.createStaffProvider.execute({
      fullName: data.fullName || data.full_name || data.name,
      email: data.email,
      phoneNumber: data.phoneNumber || data.phone_number,
      birthDate: data.birthDate || data.birth_date,
      role: data.role,
      cinemaId: data.cinemaId || data.cinema_id,
      adminPassword: data.adminPassword || data.admin_password,
      actorId: data.actorId || data.actor_id,
      actorRole: data.actorRole || data.actor_role,
    });
  }

  @GrpcMethod('UsersService', 'UpdateUserStatus')
  async updateUserStatus(@Payload() data: any): Promise<{
    success: boolean;
    message: string;
    status: UserStatus;
  }> {
    const targetUserId = data?.targetUserId || data?.target_user_id;
    const userStatus = data?.status;
    const reason = data?.reason;
    const suspendedUntil = data?.suspendedUntil || data?.suspended_until;

    const payload: UpdateUserStatusPayload = {
      targetUserId,
      status: userStatus,
      reason,
      suspendedUntil,
    };

    return await this.updateUserStatusProvider.execute(payload);
  }

  @GrpcMethod('UsersService', 'UpdateUserRole')
  async updateUserRole(@Payload() data: any): Promise<{
    success: boolean;
    message: string;
    user_id: string;
    userId: string;
    role: string;
    cinema_id?: string | null;
    cinemaId?: string | null;
  }> {
    const targetUserId = data?.targetUserId || data?.target_user_id;
    const role = data?.role;
    const cinemaId = data?.cinemaId || data?.cinema_id;
    const actorId = data?.actorId || data?.actor_id;
    const actorRole = data?.actorRole || data?.actor_role;
    const actorCinemaId = data?.actorCinemaId || data?.actor_cinema_id;

    const result = await this.updateUserRoleProvider.execute({
      targetUserId,
      role,
      cinemaId,
      actorId,
      actorRole,
      actorCinemaId,
    });

    return {
      success: result.success,
      message: result.message,
      user_id: result.userId,
      userId: result.userId,
      role: result.role,
      cinema_id: result.cinemaId,
      cinemaId: result.cinemaId,
    };
  }
}
