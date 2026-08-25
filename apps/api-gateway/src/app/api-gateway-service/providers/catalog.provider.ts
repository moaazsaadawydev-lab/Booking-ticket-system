import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CATALOG_SERVICE } from '@booking-ticket-system/Constants';
import {
  BatchUpdateSeatsDto,
  CreateAuditoriumDto,
  CreateCinemaDto,
  CreateMovieDto,
  CreateShowtimeDto,
  DiscoveryFeedQueryDto,
  GenerateSeatLayoutDto,
  GroupedShowtimesQueryDto,
  ListCinemasQueryDto,
  ListMoviesQueryDto,
  ListShowtimesQueryDto,
  SearchMoviesQueryDto,
  SetShowtimeSeatPricingsDto,
  UpdateAuditoriumDto,
  UpdateCinemaDto,
  UpdateMovieDto,
  UpdateSeatDto,
  UpdateShowtimeDto,
} from '@booking-ticket-system/DTOs';
import { ShowtimeStatus } from '@booking-ticket-system/Utils';

@Injectable()
export class CatalogProvider implements OnModuleInit {
  private moviesService: any;
  private cinemasService: any;
  private seatsService: any;
  private showtimesService: any;

  constructor(
    @Inject(CATALOG_SERVICE) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.moviesService = this.client.getService('MoviesService');
    this.cinemasService = this.client.getService('CinemasService');
    this.seatsService = this.client.getService('SeatsService');
    this.showtimesService = this.client.getService('ShowtimesService');
  }

  // --- Movies ---
  async createMovie(dto: CreateMovieDto) {
    const durationMinutes = Number(dto.durationMinutes ?? (dto as any).duration_minutes ?? 120);
    const releaseDate = dto.releaseDate
      ? String(dto.releaseDate)
      : (dto as any).release_date
        ? String((dto as any).release_date)
        : new Date().toISOString();
    
    let ageRating = dto.ageRating ?? (dto as any).age_rating;
    if (!ageRating || ageRating === 'undefined' || ageRating === 'PG-13') {
      ageRating = 'PG_13';
    }
    
    let status = dto.status ?? (dto as any).status;
    if (!status || status === 'undefined') {
      status = 'NOW_SHOWING';
    }

    const countryOfOrigin = (dto.countryOfOrigin ?? (dto as any).country_of_origin) || 'EG';
    
    let originalLanguage = dto.originalLanguage ?? (dto as any).original_language;
    if (!originalLanguage || originalLanguage === 'undefined') {
      originalLanguage = 'en';
    }

    const spokenLanguages = dto.spokenLanguages ?? (dto as any).spoken_languages ?? ['en'];
    const subtitles = dto.subtitles ?? ['ar'];
    const posterUrl = dto.posterUrl ?? (dto as any).poster_url ?? null;
    const bannerUrl = dto.bannerUrl ?? (dto as any).banner_url ?? null;
    const trailerUrl = dto.trailerUrl ?? (dto as any).trailer_url ?? null;
    const galleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls ?? [];
    const directors = dto.directors ?? [];
    const cast = dto.cast ?? [];
    const genreIds = dto.genreIds ?? (dto as any).genre_ids ?? [];

    return await lastValueFrom(
      this.moviesService.CreateMovie({
        title: dto.title,
        description: dto.description,
        durationMinutes,
        duration_minutes: durationMinutes,
        releaseDate,
        release_date: releaseDate,
        ageRating,
        age_rating: ageRating,
        status,
        countryOfOrigin,
        country_of_origin: countryOfOrigin,
        originalLanguage,
        original_language: originalLanguage,
        spokenLanguages,
        spoken_languages: spokenLanguages,
        subtitles,
        posterUrl,
        poster_url: posterUrl,
        bannerUrl,
        banner_url: bannerUrl,
        trailerUrl,
        trailer_url: trailerUrl,
        galleryUrls,
        gallery_urls: galleryUrls,
        directors,
        cast,
        genreIds,
        genre_ids: genreIds,
      }),
    );
  }

  async getMovieById(id: string) {
    return await lastValueFrom(this.moviesService.GetMovieById({ id }));
  }

  async getMovieBySlug(slug: string) {
    return await lastValueFrom(this.moviesService.GetMovieBySlug({ slug }));
  }

  async listMovies(query: ListMoviesQueryDto) {
    const res: any = await lastValueFrom(
      this.moviesService.ListMovies({
        page: query.page,
        limit: query.limit,
        status: query.status,
        search: query.search,
        genreId: query.genreId ?? (query as any).genre_id,
        genre_id: query.genreId ?? (query as any).genre_id,
        genreSlug: query.genreSlug ?? (query as any).genre_slug,
        genre_slug: query.genreSlug ?? (query as any).genre_slug,
      }),
    );
    return {
      items: res?.items || [],
      meta: res?.meta || {},
    };
  }

  async searchMovies(query: SearchMoviesQueryDto) {
    const res: any = await lastValueFrom(
      this.moviesService.SearchMovies({
        query: query.query,
        fromYear: query.fromYear,
        from_year: query.fromYear,
        toYear: query.toYear,
        to_year: query.toYear,
        fromDate: query.fromDate,
        from_date: query.fromDate,
        toDate: query.toDate,
        to_date: query.toDate,
        similarityThreshold: query.similarityThreshold,
        similarity_threshold: query.similarityThreshold,
        page: query.page,
        limit: query.limit,
      }),
    );
    return {
      items: res?.items || [],
      meta: res?.meta || {},
    };
  }

  async getDiscoveryFeed(query: DiscoveryFeedQueryDto) {
    const res: any = await lastValueFrom(
      this.moviesService.GetDiscoveryFeed({
        country: query.country,
        language: query.language,
        limit: query.limit,
      }),
    );
    return {
      featured: res?.featured || [],
      now_showing_local: res?.now_showing_local || res?.nowShowingLocal || [],
      coming_soon_local: res?.coming_soon_local || res?.comingSoonLocal || [],
      top_rated: res?.top_rated || res?.topRated || [],
    };
  }

  async updateMovie(id: string, dto: UpdateMovieDto) {
    const durationMinutes =
      dto.durationMinutes !== undefined
        ? Number(dto.durationMinutes)
        : (dto as any).duration_minutes !== undefined
          ? Number((dto as any).duration_minutes)
          : undefined;

    const countryOfOrigin = dto.countryOfOrigin ?? (dto as any).country_of_origin;

    return await lastValueFrom(
      this.moviesService.UpdateMovie({
        id,
        title: dto.title,
        description: dto.description,
        durationMinutes,
        duration_minutes: durationMinutes,
        releaseDate: dto.releaseDate ?? (dto as any).release_date,
        release_date: dto.releaseDate ?? (dto as any).release_date,
        ageRating: dto.ageRating ?? (dto as any).age_rating,
        age_rating: dto.ageRating ?? (dto as any).age_rating,
        status: dto.status,
        countryOfOrigin,
        country_of_origin: countryOfOrigin,
        originalLanguage: dto.originalLanguage ?? (dto as any).original_language,
        original_language: dto.originalLanguage ?? (dto as any).original_language,
        spokenLanguages: dto.spokenLanguages ?? (dto as any).spoken_languages,
        spoken_languages: dto.spokenLanguages ?? (dto as any).spoken_languages,
        subtitles: dto.subtitles,
        posterUrl: dto.posterUrl ?? (dto as any).poster_url,
        poster_url: dto.posterUrl ?? (dto as any).poster_url,
        bannerUrl: dto.bannerUrl ?? (dto as any).banner_url,
        banner_url: dto.bannerUrl ?? (dto as any).banner_url,
        trailerUrl: dto.trailerUrl ?? (dto as any).trailer_url,
        trailer_url: dto.trailerUrl ?? (dto as any).trailer_url,
        galleryUrls: dto.galleryUrls ?? (dto as any).gallery_urls,
        gallery_urls: dto.galleryUrls ?? (dto as any).gallery_urls,
        directors: dto.directors,
        cast: dto.cast,
        genreIds: dto.genreIds ?? (dto as any).genre_ids,
        genre_ids: dto.genreIds ?? (dto as any).genre_ids,
      }),
    );
  }

  async deleteMovie(id: string) {
    return await lastValueFrom(this.moviesService.DeleteMovie({ id }));
  }

  async listGenres() {
    return await lastValueFrom(this.moviesService.ListGenres({}));
  }

  // --- Cinemas ---
  async createCinema(dto: CreateCinemaDto) {
    const phoneNumber = dto.phoneNumber ?? (dto as any).phone_number ?? null;
    const country = dto.country ?? (dto as any).country ?? 'EG';
    const description = dto.description ?? (dto as any).description ?? null;
    const thumbnailUrl = dto.thumbnailUrl ?? (dto as any).thumbnail_url ?? null;
    const galleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls ?? [];
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto as any).is_active;
    const adminUserIds = dto.adminUserIds ?? (dto as any).admin_user_ids ?? [];

    return await lastValueFrom(
      this.cinemasService.CreateCinema({
        name: dto.name,
        city: dto.city,
        country,
        address: dto.address,
        description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phoneNumber,
        phone_number: phoneNumber,
        facilities: dto.facilities || [],
        thumbnailUrl,
        thumbnail_url: thumbnailUrl,
        galleryUrls,
        gallery_urls: galleryUrls,
        isActive: isActive !== undefined ? isActive : true,
        is_active: isActive !== undefined ? isActive : true,
        adminUserIds,
        admin_user_ids: adminUserIds,
      }),
    );
  }

  async getCinemaById(id: string) {
    return await lastValueFrom(this.cinemasService.GetCinemaById({ id }));
  }

  async getCinemaBySlug(slug: string) {
    return await lastValueFrom(this.cinemasService.GetCinemaBySlug({ slug }));
  }

  async listCinemas(query: ListCinemasQueryDto) {
    const isActive =
      query.isActive !== undefined ? query.isActive : (query as any).is_active;

    return await lastValueFrom(
      this.cinemasService.ListCinemas({
        page: query.page,
        limit: query.limit,
        city: query.city,
        country: query.country,
        search: query.search,
        isActive,
        is_active: isActive,
      }),
    );
  }

  async updateCinema(id: string, dto: UpdateCinemaDto) {
    const phoneNumber = dto.phoneNumber ?? (dto as any).phone_number;
    const country = dto.country ?? (dto as any).country;
    const description = dto.description ?? (dto as any).description;
    const thumbnailUrl = dto.thumbnailUrl ?? (dto as any).thumbnail_url;
    const galleryUrls = dto.galleryUrls ?? (dto as any).gallery_urls;
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto as any).is_active;

    return await lastValueFrom(
      this.cinemasService.UpdateCinema({
        id,
        name: dto.name,
        city: dto.city,
        address: dto.address,
        description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phoneNumber,
        phone_number: phoneNumber,
        facilities: dto.facilities,
        thumbnailUrl,
        thumbnail_url: thumbnailUrl,
        galleryUrls,
        gallery_urls: galleryUrls,
        isActive,
        is_active: isActive,
      }),
    );
  }

  async deleteCinema(id: string) {
    return await lastValueFrom(this.cinemasService.DeleteCinema({ id }));
  }

  async createAuditorium(dto: CreateAuditoriumDto) {
    const cinemaId = dto.cinemaId ?? (dto as any).cinema_id;
    const experienceType = dto.experienceType ?? (dto as any).experience_type;
    const soundSystem = dto.soundSystem ?? (dto as any).sound_system;
    const totalRows = Number(dto.totalRows ?? (dto as any).total_rows);
    const totalColumns = Number(dto.totalColumns ?? (dto as any).total_columns);
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto as any).is_active;

    return await lastValueFrom(
      this.cinemasService.CreateAuditorium({
        cinemaId,
        cinema_id: cinemaId,
        name: dto.name,
        experienceType,
        experience_type: experienceType,
        soundSystem,
        sound_system: soundSystem,
        totalRows,
        total_rows: totalRows,
        totalColumns,
        total_columns: totalColumns,
        isActive: isActive !== undefined ? isActive : true,
        is_active: isActive !== undefined ? isActive : true,
      }),
    );
  }

  async getAuditoriumById(id: string) {
    return await lastValueFrom(this.cinemasService.GetAuditoriumById({ id }));
  }

  async listAuditoriumsByCinema(cinemaId: string) {
    return await lastValueFrom(
      this.cinemasService.ListAuditoriumsByCinema({
        cinemaId,
        cinema_id: cinemaId,
      }),
    );
  }

  async updateAuditorium(id: string, dto: UpdateAuditoriumDto) {
    const experienceType = dto.experienceType ?? (dto as any).experience_type;
    const soundSystem = dto.soundSystem ?? (dto as any).sound_system;
    const totalRows =
      dto.totalRows !== undefined
        ? Number(dto.totalRows)
        : (dto as any).total_rows !== undefined
          ? Number((dto as any).total_rows)
          : undefined;
    const totalColumns =
      dto.totalColumns !== undefined
        ? Number(dto.totalColumns)
        : (dto as any).total_columns !== undefined
          ? Number((dto as any).total_columns)
          : undefined;
    const isActive = dto.isActive !== undefined ? dto.isActive : (dto as any).is_active;

    return await lastValueFrom(
      this.cinemasService.UpdateAuditorium({
        id,
        name: dto.name,
        experienceType,
        experience_type: experienceType,
        soundSystem,
        sound_system: soundSystem,
        totalRows,
        total_rows: totalRows,
        totalColumns,
        total_columns: totalColumns,
        isActive,
        is_active: isActive,
      }),
    );
  }

  async deleteAuditorium(id: string) {
    return await lastValueFrom(this.cinemasService.DeleteAuditorium({ id }));
  }

  async assignCinemaAdmin(cinemaId: string, userId: string) {
    return await lastValueFrom(
      this.cinemasService.AssignCinemaAdmin({
        cinemaId,
        cinema_id: cinemaId,
        userId,
        user_id: userId,
      }),
    );
  }

  async removeCinemaAdmin(cinemaId: string, userId: string) {
    return await lastValueFrom(
      this.cinemasService.RemoveCinemaAdmin({
        cinemaId,
        cinema_id: cinemaId,
        userId,
        user_id: userId,
      }),
    );
  }

  async getCinemaAdmins(cinemaId: string) {
    return await lastValueFrom(
      this.cinemasService.GetCinemaAdmins({
        cinemaId,
        cinema_id: cinemaId,
      }),
    );
  }

  // --- Seats ---
  async generateSeatLayout(dto: GenerateSeatLayoutDto) {
    const auditoriumId = dto.auditoriumId ?? (dto as any).auditorium_id;
    const totalRows = Number(dto.totalRows ?? (dto as any).total_rows);
    const totalColumns = Number(dto.totalColumns ?? (dto as any).total_columns);
    const customSeats = (dto.customSeats ?? (dto as any).custom_seats ?? []).map((s: any) => ({
      rowLabel: s.rowLabel ?? s.row_label,
      row_label: s.rowLabel ?? s.row_label,
      seatNumber: Number(s.seatNumber ?? s.seat_number),
      seat_number: Number(s.seatNumber ?? s.seat_number),
      gridRow: Number(s.gridRow ?? s.grid_row),
      grid_row: Number(s.gridRow ?? s.grid_row),
      gridColumn: Number(s.gridColumn ?? s.grid_column),
      grid_column: Number(s.gridColumn ?? s.grid_column),
      seatType: s.seatType ?? s.seat_type,
      seat_type: s.seatType ?? s.seat_type,
      isOperational: s.isOperational !== undefined ? s.isOperational : s.is_operational,
      is_operational: s.isOperational !== undefined ? s.isOperational : s.is_operational,
    }));

    return await lastValueFrom(
      this.seatsService.GenerateSeatLayout({
        auditoriumId,
        auditorium_id: auditoriumId,
        totalRows,
        total_rows: totalRows,
        totalColumns,
        total_columns: totalColumns,
        customSeats,
        custom_seats: customSeats,
      }),
    );
  }

  async getSeatsByAuditorium(auditoriumId: string) {
    return await lastValueFrom(
      this.seatsService.GetSeatsByAuditorium({
        auditoriumId,
        auditorium_id: auditoriumId,
      }),
    );
  }

  async updateSeat(id: string, dto: UpdateSeatDto) {
    const seatType = dto.seatType ?? (dto as any).seat_type;
    const isOperational =
      dto.isOperational !== undefined
        ? dto.isOperational
        : (dto as any).is_operational;

    return await lastValueFrom(
      this.seatsService.UpdateSeat({
        id,
        seatType,
        seat_type: seatType,
        isOperational,
        is_operational: isOperational,
      }),
    );
  }

  async batchUpdateSeats(dto: BatchUpdateSeatsDto) {
    const auditoriumId = dto.auditoriumId ?? (dto as any).auditorium_id;
    const seats = (dto.seats || []).map((s: any) => ({
      id: s.id,
      seatType: s.seatType ?? s.seat_type,
      seat_type: s.seatType ?? s.seat_type,
      isOperational: s.isOperational !== undefined ? s.isOperational : s.is_operational,
      is_operational: s.isOperational !== undefined ? s.isOperational : s.is_operational,
    }));

    return await lastValueFrom(
      this.seatsService.BatchUpdateSeats({
        auditoriumId,
        auditorium_id: auditoriumId,
        seats,
      }),
    );
  }

  // --- Showtimes ---
  async createShowtime(dto: CreateShowtimeDto) {
    const movieId = dto.movieId ?? (dto as any).movie_id;
    const auditoriumId = dto.auditoriumId ?? (dto as any).auditorium_id;
    const startTime = dto.startTime ?? (dto as any).start_time;
    const endTime = dto.endTime ?? (dto as any).end_time;
    const experienceType = dto.experienceType ?? (dto as any).experience_type;
    const basePrice = Number(dto.basePrice ?? (dto as any).base_price);
    const customPricings = (dto.customPricings ?? (dto as any).custom_pricings ?? []).map(
      (p: any) => ({
        seatType: p.seatType ?? p.seat_type,
        seat_type: p.seatType ?? p.seat_type,
        price: Number(p.price),
      }),
    );

    return await lastValueFrom(
      this.showtimesService.CreateShowtime({
        movieId,
        movie_id: movieId,
        auditoriumId,
        auditorium_id: auditoriumId,
        startTime,
        start_time: startTime,
        endTime,
        end_time: endTime,
        experienceType,
        experience_type: experienceType,
        basePrice,
        base_price: basePrice,
        status: dto.status,
        customPricings,
        custom_pricings: customPricings,
      }),
    );
  }

  async getShowtimeById(id: string) {
    return await lastValueFrom(this.showtimesService.GetShowtimeById({ id }));
  }

  async listShowtimes(query: ListShowtimesQueryDto) {
    const movieId = query.movieId ?? (query as any).movie_id;
    const cinemaId = query.cinemaId ?? (query as any).cinema_id;
    const auditoriumId = query.auditoriumId ?? (query as any).auditorium_id;
    const startDate = query.startDate ?? (query as any).start_date;
    const endDate = query.endDate ?? (query as any).end_date;
    const experienceType = query.experienceType ?? (query as any).experience_type;

    return await lastValueFrom(
      this.showtimesService.ListShowtimes({
        page: query.page,
        limit: query.limit,
        movieId,
        movie_id: movieId,
        cinemaId,
        cinema_id: cinemaId,
        auditoriumId,
        auditorium_id: auditoriumId,
        date: query.date,
        startDate,
        start_date: startDate,
        endDate,
        end_date: endDate,
        experienceType,
        experience_type: experienceType,
        status: query.status,
      }),
    );
  }

  async getShowtimesGroupedByCinema(query: GroupedShowtimesQueryDto) {
    const movieId = query.movieId ?? (query as any).movie_id;

    return await lastValueFrom(
      this.showtimesService.GetShowtimesGroupedByCinema({
        movieId,
        movie_id: movieId,
        date: query.date,
        city: query.city,
      }),
    );
  }

  async updateShowtime(id: string, dto: UpdateShowtimeDto) {
    const movieId = dto.movieId ?? (dto as any).movie_id;
    const auditoriumId = dto.auditoriumId ?? (dto as any).auditorium_id;
    const startTime = dto.startTime ?? (dto as any).start_time;
    const endTime = dto.endTime ?? (dto as any).end_time;
    const experienceType = dto.experienceType ?? (dto as any).experience_type;
    const basePrice =
      dto.basePrice !== undefined
        ? Number(dto.basePrice)
        : (dto as any).base_price !== undefined
          ? Number((dto as any).base_price)
          : undefined;

    return await lastValueFrom(
      this.showtimesService.UpdateShowtime({
        id,
        movieId,
        movie_id: movieId,
        auditoriumId,
        auditorium_id: auditoriumId,
        startTime,
        start_time: startTime,
        endTime,
        end_time: endTime,
        experienceType,
        experience_type: experienceType,
        basePrice,
        base_price: basePrice,
        status: dto.status,
      }),
    );
  }

  async updateShowtimeStatus(id: string, status: ShowtimeStatus) {
    return await lastValueFrom(
      this.showtimesService.UpdateShowtimeStatus({ id, status }),
    );
  }

  async deleteShowtime(id: string) {
    return await lastValueFrom(this.showtimesService.DeleteShowtime({ id }));
  }

  async setShowtimeSeatPricings(dto: SetShowtimeSeatPricingsDto) {
    const showtimeId = dto.showtimeId ?? (dto as any).showtime_id;
    const rawPricings = Array.isArray(dto)
      ? dto
      : dto.pricings ?? (dto as any).custom_pricings ?? (dto as any).customPricings ?? [];

    const pricings = (rawPricings || []).map((p: any) => ({
      seatType: p.seatType ?? p.seat_type,
      seat_type: p.seatType ?? p.seat_type,
      price: Number(p.price),
    }));

    return await lastValueFrom(
      this.showtimesService.SetShowtimeSeatPricings({
        showtimeId,
        showtime_id: showtimeId,
        pricings,
      }),
    );
  }
}
