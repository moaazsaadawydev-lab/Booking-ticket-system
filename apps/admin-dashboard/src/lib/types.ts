export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'cinema_admin'
  | 'staff'
  | 'gate_checker'
  | 'user'
  | 'accountant'
  | 'marketing';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cinemaId?: string | null;
  status: 'ACTIVE' | 'UNVERIFIED' | 'SUSPENDED' | 'BLOCKED';
  avatarUrl?: string | null;
  createdAt: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  releaseDate: string;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  thumbnailUrl?: string | null;
  trailerUrl?: string | null;
  galleryUrls?: string[];
  genre?: string | null;
  rating?: number | null;
  ageRating?: string;
  status?: string;
  countryOfOrigin?: string | null;
  originalLanguage?: string;
  spokenLanguages?: string[];
  subtitles?: string[];
  isFeatured?: boolean;
  createdAt: string;
}

export interface Cinema {
  id: string;
  name: string;
  city: string;
  address: string;
  country: string;
  description?: string | null;
  phoneNumber?: string | null;
  facilities?: string[];
  thumbnailUrl?: string | null;
  galleryUrls?: string[];
  auditoriumsCount?: number;
  isActive?: boolean;
  createdAt: string;
}

export interface Auditorium {
  id: string;
  cinemaId: string;
  name: string;
  totalSeats: number;
  type: 'STANDARD' | 'VIP' | 'IMAX' | '4DX';
  experienceType?: string;
  soundSystem?: string;
  totalRows?: number;
  totalColumns?: number;
  cinemaName?: string;
  cinemaCity?: string;
  cinema?: Cinema;
  isActive?: boolean;
  createdAt: string;
}

export interface Showtime {
  id: string;
  movieId: string;
  cinemaId: string;
  auditoriumId: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  movie?: Movie;
  cinema?: Cinema;
  auditorium?: Auditorium;
  createdAt: string;
}

export interface BookingKPIs {
  totalRevenue: number;
  totalBookings: number;
  activeMovies: number;
  totalCinemas: number;
}
