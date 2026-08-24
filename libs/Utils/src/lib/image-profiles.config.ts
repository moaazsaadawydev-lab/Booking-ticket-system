import { ImageProfileConfig } from '@booking-ticket-system/Interfaces';
import { ImageProfileType } from './Enums';

export const IMAGE_PROFILES: Record<ImageProfileType, ImageProfileConfig> = {
  [ImageProfileType.AVATAR]: {
    width: 300,
    height: 300,
    quality: 80,
    folder: 'avatars',
    fit: 'cover',
  },
  [ImageProfileType.MOVIE_THUMBNAIL]: {
    width: 500,
    height: 750, // 2:3 standard poster aspect ratio
    quality: 85,
    folder: 'movies/thumbnails',
    fit: 'cover',
  },
  [ImageProfileType.MOVIE_COVER]: {
    width: 1920,
    height: 1080, // 16:9 banner
    quality: 85,
    folder: 'movies/covers',
    fit: 'inside',
  },
  [ImageProfileType.MOVIE_GALLERY]: {
    width: 1280,
    height: 720,
    quality: 80,
    folder: 'movies/gallery',
    fit: 'inside',
  },
  [ImageProfileType.CINEMA_THUMBNAIL]: {
    width: 600,
    height: 400, // 3:2 ratio for cinema exterior/lobby
    quality: 85,
    folder: 'cinemas/thumbnails',
    fit: 'cover',
  },
  [ImageProfileType.CINEMA_GALLERY]: {
    width: 1280,
    height: 720,
    quality: 80,
    folder: 'cinemas/gallery',
    fit: 'inside',
  },
};
