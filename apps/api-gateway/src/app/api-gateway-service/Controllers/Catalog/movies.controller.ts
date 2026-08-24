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
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  CreateMovieDto,
  DiscoveryFeedQueryDto,
  ListMoviesQueryDto,
  SearchMoviesQueryDto,
  UpdateMovieDto,
} from '@booking-ticket-system/DTOs';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  RolesGuard,
} from '@booking-ticket-system/Guards';
import { CurrentUser, Roles } from '@booking-ticket-system/Decorators';
import { UserRole } from '@booking-ticket-system/Utils';
import { TransformResponseInterceptor } from '@booking-ticket-system/Common';
import { CatalogProvider } from '../../providers';

@Controller('movies')
@UseInterceptors(TransformResponseInterceptor)
export class CatalogMoviesController {
  constructor(private readonly catalogProvider: CatalogProvider) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CINEMA_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createMovie(@Body() body: CreateMovieDto) {
    return this.catalogProvider.createMovie(body);
  }

  @Get('discovery/feed')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDiscoveryFeed(
    @Query() query: DiscoveryFeedQueryDto,
    @CurrentUser() user?: any,
  ) {
    const country = query.country || user?.country || 'EG';
    const language = query.language || 'ar';
    const limit = query.limit ? Number(query.limit) : 10;
    return this.catalogProvider.getDiscoveryFeed({ country, language, limit });
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchMovies(@Query() query: SearchMoviesQueryDto) {
    return this.catalogProvider.searchMovies(query);
  }

  @Get('genres')
  @HttpCode(HttpStatus.OK)
  async listGenres() {
    return this.catalogProvider.listGenres();
  }

  @Get('slug/:slug')
  @HttpCode(HttpStatus.OK)
  async getMovieBySlug(@Param('slug') slug: string) {
    return this.catalogProvider.getMovieBySlug(slug);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getMovieById(@Param('id') id: string) {
    return this.catalogProvider.getMovieById(id);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listMovies(@Query() query: ListMoviesQueryDto) {
    return this.catalogProvider.listMovies(query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CINEMA_ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateMovie(
    @Param('id') id: string,
    @Body() body: UpdateMovieDto,
  ) {
    return this.catalogProvider.updateMovie(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteMovie(@Param('id') id: string) {
    return this.catalogProvider.deleteMovie(id);
  }
}
