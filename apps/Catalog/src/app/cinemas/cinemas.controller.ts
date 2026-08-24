import { Controller } from '@nestjs/common';
import { GrpcMethod, Payload } from '@nestjs/microservices';
import {
  CreateAuditoriumDto,
  CreateCinemaDto,
  ListCinemasQueryDto,
  UpdateAuditoriumDto,
  UpdateCinemaDto,
} from '@booking-ticket-system/DTOs';
import { CreateCinemaProvider } from './providers/create-cinema.provider';
import { GetCinemaProvider } from './providers/get-cinema.provider';
import { ListCinemasProvider } from './providers/list-cinemas.provider';
import { UpdateCinemaProvider } from './providers/update-cinema.provider';
import { DeleteCinemaProvider } from './providers/delete-cinema.provider';
import { AuditoriumProvider } from './providers/auditorium.provider';
import { CinemaAdminProvider } from './providers/cinema-admin.provider';

@Controller()
export class CinemasController {
  constructor(
    private readonly createCinemaProvider: CreateCinemaProvider,
    private readonly getCinemaProvider: GetCinemaProvider,
    private readonly listCinemasProvider: ListCinemasProvider,
    private readonly updateCinemaProvider: UpdateCinemaProvider,
    private readonly deleteCinemaProvider: DeleteCinemaProvider,
    private readonly auditoriumProvider: AuditoriumProvider,
    private readonly cinemaAdminProvider: CinemaAdminProvider,
  ) {}

  @GrpcMethod('CinemasService', 'CreateCinema')
  async createCinema(@Payload() data: any): Promise<any> {
    const dto: CreateCinemaDto = {
      name: data.name,
      city: data.city,
      country: data.country,
      address: data.address,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      phoneNumber: data.phoneNumber || data.phone_number,
      facilities: data.facilities || [],
      thumbnailUrl: data.thumbnailUrl || data.thumbnail_url,
      galleryUrls: data.galleryUrls || data.gallery_urls || [],
      isActive: data.isActive !== undefined ? data.isActive : data.is_active,
      adminUserIds: data.adminUserIds || data.admin_user_ids || [],
    };
    return await this.createCinemaProvider.execute(dto);
  }

  @GrpcMethod('CinemasService', 'GetCinemaById')
  async getCinemaById(@Payload() data: any): Promise<any> {
    return await this.getCinemaProvider.getById(data.id);
  }

  @GrpcMethod('CinemasService', 'GetCinemaBySlug')
  async getCinemaBySlug(@Payload() data: any): Promise<any> {
    return await this.getCinemaProvider.getBySlug(data.slug);
  }

  @GrpcMethod('CinemasService', 'ListCinemas')
  async listCinemas(@Payload() data: any): Promise<any> {
    const query: ListCinemasQueryDto = {
      page: data.page,
      limit: data.limit,
      city: data.city,
      country: data.country,
      search: data.search,
      isActive: data.isActive !== undefined ? data.isActive : data.is_active,
    };
    return await this.listCinemasProvider.execute(query);
  }

  @GrpcMethod('CinemasService', 'UpdateCinema')
  async updateCinema(@Payload() data: any): Promise<any> {
    const id = data.id;
    const dto: UpdateCinemaDto = {
      name: data.name,
      city: data.city,
      country: data.country,
      address: data.address,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      phoneNumber: data.phoneNumber || data.phone_number,
      facilities: data.facilities,
      thumbnailUrl: data.thumbnailUrl || data.thumbnail_url,
      galleryUrls: data.galleryUrls || data.gallery_urls,
      isActive: data.isActive !== undefined ? data.isActive : data.is_active,
    };
    return await this.updateCinemaProvider.execute(id, dto);
  }

  @GrpcMethod('CinemasService', 'DeleteCinema')
  async deleteCinema(@Payload() data: any): Promise<any> {
    return await this.deleteCinemaProvider.execute(data.id);
  }

  @GrpcMethod('CinemasService', 'CreateAuditorium')
  async createAuditorium(@Payload() data: any): Promise<any> {
    const dto: CreateAuditoriumDto = {
      cinemaId: data.cinemaId || data.cinema_id,
      name: data.name,
      experienceType: data.experienceType || data.experience_type,
      soundSystem: data.soundSystem || data.sound_system,
      totalRows: data.totalRows || data.total_rows,
      totalColumns: data.totalColumns || data.total_columns,
      isActive: data.isActive !== undefined ? data.isActive : data.is_active,
    };
    return await this.auditoriumProvider.create(dto);
  }

  @GrpcMethod('CinemasService', 'GetAuditoriumById')
  async getAuditoriumById(@Payload() data: any): Promise<any> {
    return await this.auditoriumProvider.getById(data.id);
  }

  @GrpcMethod('CinemasService', 'ListAuditoriumsByCinema')
  async listAuditoriumsByCinema(@Payload() data: any): Promise<any> {
    const cinemaId = data.cinemaId || data.cinema_id;
    return await this.auditoriumProvider.listByCinema(cinemaId);
  }

  @GrpcMethod('CinemasService', 'UpdateAuditorium')
  async updateAuditorium(@Payload() data: any): Promise<any> {
    const id = data.id;
    const dto: UpdateAuditoriumDto = {
      name: data.name,
      experienceType: data.experienceType || data.experience_type,
      soundSystem: data.soundSystem || data.sound_system,
      totalRows: data.totalRows || data.total_rows,
      totalColumns: data.totalColumns || data.total_columns,
      isActive: data.isActive !== undefined ? data.isActive : data.is_active,
    };
    return await this.auditoriumProvider.update(id, dto);
  }

  @GrpcMethod('CinemasService', 'DeleteAuditorium')
  async deleteAuditorium(@Payload() data: any): Promise<any> {
    return await this.auditoriumProvider.delete(data.id);
  }

  @GrpcMethod('CinemasService', 'AssignCinemaAdmin')
  async assignCinemaAdmin(@Payload() data: any): Promise<any> {
    const cinemaId = data.cinemaId || data.cinema_id;
    const userId = data.userId || data.user_id;
    return await this.cinemaAdminProvider.assignAdmin(cinemaId, userId);
  }

  @GrpcMethod('CinemasService', 'RemoveCinemaAdmin')
  async removeCinemaAdmin(@Payload() data: any): Promise<any> {
    const cinemaId = data.cinemaId || data.cinema_id;
    const userId = data.userId || data.user_id;
    return await this.cinemaAdminProvider.removeAdmin(cinemaId, userId);
  }

  @GrpcMethod('CinemasService', 'GetCinemaAdmins')
  async getCinemaAdmins(@Payload() data: any): Promise<any> {
    const cinemaId = data.cinemaId || data.cinema_id;
    return await this.cinemaAdminProvider.getAdmins(cinemaId);
  }
}
