import axios, { AxiosInstance } from 'axios';
import { Movie, Cinema, Auditorium, Showtime } from './types';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000/api/v1`
    : 'http://localhost:3000/api/v1');

export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined'
    ? `ws://${window.location.hostname}:3000`
    : 'ws://localhost:3000');

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Helper to resolve MinIO bucket keys, relative paths, and full URLs
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const minioHost =
    process.env.NEXT_PUBLIC_MINIO_HOST ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:9000`
      : 'http://localhost:9000');

  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (cleanPath.startsWith('avatars/') || cleanPath.startsWith('profile-photos/')) {
    const withoutPrefix = cleanPath.replace(/^profile-photos\//, '');
    return `${minioHost}/profile-photos/${withoutPrefix}`;
  }
  if (cleanPath.startsWith('catalog/')) {
    return `${minioHost}/${cleanPath}`;
  }
  return `${minioHost}/catalog/${cleanPath}`;
}

// Safe list extractor utility to handle NestJS pagination objects & arrays
export function extractList<T = any>(payload: any): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  if (Array.isArray(payload.data?.data)) return payload.data.data;
  return [];
}

// Normalizers to seamlessly map snake_case API microservice responses to camelCase
export function normalizeMovie(m: any): Movie {
  const poster = m.posterUrl ?? m.poster_url ?? m.thumbnailUrl ?? m.thumbnail_url ?? null;
  const banner = m.bannerUrl ?? m.banner_url ?? null;
  const trailer = m.trailerUrl ?? m.trailer_url ?? null;
  const gallery = m.galleryUrls ?? m.gallery_urls ?? [];

  const rawGenres = m.genres ?? (m.genre ? [m.genre] : []);
  const extractedGenres: string[] = Array.isArray(rawGenres)
    ? rawGenres
        .map((g: any) => (typeof g === 'object' ? g.name || g.slug || '' : String(g)))
        .filter(Boolean)
    : typeof m.genre === 'string'
    ? m.genre.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    id: m.id,
    title: m.title || '',
    description: m.description || '',
    durationMinutes: Number(m.durationMinutes ?? m.duration_minutes ?? 120),
    releaseDate: m.releaseDate ?? m.release_date ?? '',
    posterUrl: poster,
    bannerUrl: banner,
    thumbnailUrl: poster,
    trailerUrl: trailer,
    galleryUrls: Array.isArray(gallery) ? gallery : [],
    genres: extractedGenres,
    genre:
      extractedGenres.length > 0
        ? extractedGenres.join(', ')
        : m.genre || 'Feature Film',
    rating: Number(m.rating ?? m.rating_average ?? m.ratingAverage ?? 8.5),
    ageRating: m.ageRating ?? m.age_rating ?? 'PG_13',
    status: m.status || 'NOW_SHOWING',
    countryOfOrigin: m.countryOfOrigin ?? m.country_of_origin ?? 'EG',
    originalLanguage: m.originalLanguage ?? m.original_language ?? 'en',
    spokenLanguages: m.spokenLanguages ?? m.spoken_languages ?? [],
    subtitles: m.subtitles || [],
    isFeatured: !!(m.isFeatured ?? m.is_featured),
    createdAt: m.createdAt ?? m.created_at ?? new Date().toISOString(),
  };
}

export function normalizeCinema(c: any): Cinema {
  const thumb = c.thumbnailUrl ?? c.thumbnail_url ?? null;
  const gallery = c.galleryUrls ?? c.gallery_urls ?? [];

  return {
    id: c.id,
    name: c.name || '',
    city: c.city || '',
    address: c.address || '',
    country: c.country || 'Egypt',
    description: c.description || '',
    phoneNumber: c.phoneNumber ?? c.phone_number ?? '',
    facilities: Array.isArray(c.facilities) ? c.facilities : [],
    thumbnailUrl: thumb,
    galleryUrls: Array.isArray(gallery) ? gallery : [],
    auditoriumsCount: Number(
      c.auditoriumsCount ??
        c.auditoriums_count ??
        (Array.isArray(c.auditoriums) ? c.auditoriums.length : 2),
    ),
    isActive:
      c.isActive !== undefined
        ? c.isActive
        : c.is_active !== undefined
        ? c.is_active
        : true,
    createdAt: c.createdAt ?? c.created_at ?? new Date().toISOString(),
  };
}

export function normalizeAuditorium(a: any): Auditorium {
  const expType = a.experienceType ?? a.experience_type ?? a.type ?? 'STANDARD_2D';
  let cleanType: 'STANDARD' | 'VIP' | 'IMAX' | '4DX' = 'STANDARD';
  const u = String(expType).toUpperCase();
  if (u.includes('IMAX')) cleanType = 'IMAX';
  else if (u.includes('VIP')) cleanType = 'VIP';
  else if (u.includes('4DX') || u.includes('FOUR_DX')) cleanType = '4DX';
  else cleanType = 'STANDARD';

  const rows = Number(a.totalRows ?? a.total_rows ?? 10);
  const cols = Number(a.totalColumns ?? a.total_columns ?? 12);
  const seats = Number(a.totalSeats ?? a.total_seats ?? rows * cols);

  return {
    id: a.id,
    cinemaId: a.cinemaId ?? a.cinema_id ?? '',
    name: a.name || '',
    totalSeats: seats,
    type: cleanType,
    experienceType: expType,
    soundSystem: a.soundSystem ?? a.sound_system ?? 'Dolby Atmos 7.1',
    totalRows: rows,
    totalColumns: cols,
    cinemaName: a.cinemaName ?? a.cinema_name ?? a.cinema?.name,
    cinemaCity: a.cinemaCity ?? a.cinema_city ?? a.cinema?.city,
    isActive:
      a.isActive !== undefined
        ? a.isActive
        : a.is_active !== undefined
        ? a.is_active
        : true,
    createdAt: a.createdAt ?? a.created_at ?? new Date().toISOString(),
  };
}

export function normalizeShowtime(st: any): Showtime {
  const pricings = Array.isArray(st.seatPricings)
    ? st.seatPricings
    : Array.isArray(st.seat_pricings)
    ? st.seat_pricings
    : [];

  return {
    id: st.id,
    movieId: st.movieId ?? st.movie_id ?? '',
    cinemaId:
      st.cinemaId ??
      st.cinema_id ??
      st.auditorium?.cinemaId ??
      st.auditorium?.cinema_id ??
      '',
    auditoriumId: st.auditoriumId ?? st.auditorium_id ?? '',
    startTime: st.startTime ?? st.start_time ?? '',
    endTime: st.endTime ?? st.end_time ?? '',
    basePrice: Number(st.basePrice ?? st.base_price ?? 150),
    movie: st.movie ? normalizeMovie(st.movie) : undefined,
    cinema: st.cinema
      ? normalizeCinema(st.cinema)
      : st.auditorium?.cinema
      ? normalizeCinema(st.auditorium.cinema)
      : undefined,
    auditorium: st.auditorium ? normalizeAuditorium(st.auditorium) : undefined,
    seatPricings: pricings.map((p: any) => ({
      id: p.id,
      showtimeId: p.showtimeId ?? p.showtime_id,
      seatType: p.seatType ?? p.seat_type ?? 'REGULAR',
      price: Number(p.price),
    })),
    createdAt: st.createdAt ?? st.created_at ?? new Date().toISOString(),
  };
}

// Request interceptor to attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor to handle unauthenticated & unauthorized redirects
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      if (status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_user_data');
        document.cookie =
          'admin_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login?error=session_expired';
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
