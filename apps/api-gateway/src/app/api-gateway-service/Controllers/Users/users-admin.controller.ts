import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from '@booking-ticket-system/DTOs';
import { JwtAuthGuard, RolesGuard } from '@booking-ticket-system/Guards';
import { CurrentUser, Roles } from '@booking-ticket-system/Decorators';
import { UserRole, UserStatus } from '@booking-ticket-system/Utils';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';
import { AuthProvider } from '../../providers';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TransformResponseInterceptor)
export class UsersAdminController {
  constructor(private readonly authProvider: AuthProvider) {}

  @Patch(['users/:id/role', 'admin/users/:id/role'])
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.CINEMA_ADMIN,
    'super_admin' as any,
    'admin' as any,
    'cinema_admin' as any,
  )
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserRoleDto,
    @CurrentUser() actor: any,
  ) {
    return this.authProvider.updateUserRole(id, body, actor);
  }

  @Patch(['users/:id/status', 'admin/users/:id/status'])
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    'admin' as any,
    'super_admin' as any,
  )
  @HttpCode(HttpStatus.OK)
  async updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    return this.authProvider.updateUserStatus(id, body);
  }

  @Patch(['users/:id/block', 'admin/users/:id/block'])
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    'admin' as any,
    'super_admin' as any,
  )
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Param('id') id: string,
    @Body() body?: Partial<UpdateUserStatusDto>,
  ) {
    return this.authProvider.updateUserStatus(id, {
      ...body,
      status: UserStatus.BLOCKED,
    } as UpdateUserStatusDto);
  }

  @Patch(['users/:id/suspend', 'admin/users/:id/suspend'])
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    'admin' as any,
    'super_admin' as any,
  )
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') id: string,
    @Body() body: Partial<UpdateUserStatusDto>,
  ) {
    return this.authProvider.updateUserStatus(id, {
      ...body,
      status: UserStatus.SUSPENDED,
    } as UpdateUserStatusDto);
  }

  @Patch(['users/:id/unblock', 'admin/users/:id/unblock'])
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    'admin' as any,
    'super_admin' as any,
  )
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @Param('id') id: string,
    @Body() body?: Partial<UpdateUserStatusDto>,
  ) {
    return this.authProvider.updateUserStatus(id, {
      ...body,
      status: UserStatus.ACTIVE,
    } as UpdateUserStatusDto);
  }
}
