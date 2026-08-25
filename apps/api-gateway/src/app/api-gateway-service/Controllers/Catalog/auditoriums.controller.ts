import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  CreateAuditoriumDto,
  UpdateAuditoriumDto,
} from '@booking-ticket-system/DTOs';
import { JwtAuthGuard, RolesGuard } from '@booking-ticket-system/Guards';
import { Roles } from '@booking-ticket-system/Decorators';
import { UserRole } from '@booking-ticket-system/Utils';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';
import { CatalogProvider } from '../../providers';

@Controller('auditoriums')
@UseInterceptors(TransformResponseInterceptor)
export class CatalogAuditoriumsController {
  constructor(private readonly catalogProvider: CatalogProvider) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listAllAuditoriums() {
    const cinemasRes: any = await this.catalogProvider.listCinemas({
      page: 1,
      limit: 100,
    });
    const cinemas: any[] =
      cinemasRes?.items ||
      (Array.isArray(cinemasRes?.data?.items) ? cinemasRes.data.items : []) ||
      (Array.isArray(cinemasRes) ? cinemasRes : []);

    const allAuditoriums: any[] = [];
    for (const cinema of cinemas) {
      try {
        const audsRes: any = await this.catalogProvider.listAuditoriumsByCinema(
          cinema.id,
        );
        const auds: any[] = Array.isArray(audsRes)
          ? audsRes
          : audsRes?.items || audsRes?.auditoriums || [];

        for (const aud of auds) {
          allAuditoriums.push({
            ...aud,
            cinemaName: cinema.name,
            cinemaCity: cinema.city,
          });
        }
      } catch (err) {
        // ignore per-cinema fetch errors
      }
    }
    return { items: allAuditoriums };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CINEMA_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createAuditorium(@Body() body: CreateAuditoriumDto) {
    return this.catalogProvider.createAuditorium(body);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAuditoriumById(@Param('id') id: string) {
    return this.catalogProvider.getAuditoriumById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CINEMA_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateAuditorium(
    @Param('id') id: string,
    @Body() body: UpdateAuditoriumDto,
  ) {
    return this.catalogProvider.updateAuditorium(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteAuditorium(@Param('id') id: string) {
    return this.catalogProvider.deleteAuditorium(id);
  }
}
