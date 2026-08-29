import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Users } from '@booking-ticket-system/Entities';

export interface ListUsersPayload {
  search?: string;
  role?: string;
  cinemaId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListUsersProvider {
  private readonly logger = new Logger(ListUsersProvider.name);

  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}

  async execute(payload: ListUsersPayload) {
    const page = Math.max(1, Number(payload.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(payload.limit) || 50));
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (payload.search && payload.search.trim() !== '') {
      const s = `%${payload.search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        '(LOWER(user.name) LIKE :s OR LOWER(user.email) LIKE :s OR user.phoneNumber LIKE :s)',
        { s },
      );
    }

    if (payload.role && payload.role.trim() !== '') {
      queryBuilder.andWhere('user.role = :role', {
        role: payload.role.trim().toLowerCase(),
      });
    }

    if (payload.cinemaId && payload.cinemaId.trim() !== '') {
      queryBuilder.andWhere('user.cinemaId = :cinemaId', {
        cinemaId: payload.cinemaId.trim(),
      });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [rawUsers, total] = await queryBuilder.getManyAndCount();

    const users = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      cinemaId: u.cinemaId || null,
      cinema_id: u.cinemaId || null,
      status: u.status,
      avatarUrl: u.avatarUrl || null,
      avatar_url: u.avatarUrl || null,
      createdBy: u.createdBy || null,
      created_by: u.createdBy || null,
      createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
      created_at: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
      phoneNumber: u.phoneNumber || null,
      phone_number: u.phoneNumber || null,
    }));

    return {
      users,
      total,
      page,
      limit,
    };
  }
}
