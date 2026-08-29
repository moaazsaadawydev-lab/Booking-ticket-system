import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { sanitizeData } from './sanitize-user.interceptor';

export interface StandardResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

function formatAvatarUrl(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => formatAvatarUrl(item));
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date || Buffer.isBuffer(obj)) {
      return obj;
    }

    const baseUrl =
      process.env['MEDIA_BASE_URL'] || 'http://localhost:3000/api/v1/media';
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    const rawKey = obj['avatarKey'] || obj['avatar_key'];
    let rawUrl = obj['avatarUrl'] || obj['avatar_url'];

    if (typeof rawKey === 'string' && rawKey.trim() !== '') {
      const cleanKey = rawKey
        .replace(/^(https?:\/\/[^\/]+\/(profile-photos|catalog|media)\/|profile-photos\/|catalog\/)/, '')
        .replace(/^\//, '');

      obj['avatarKey'] = cleanKey;

      if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim() === '') {
        rawUrl = cleanKey.startsWith('http')
          ? cleanKey
          : `${cleanBaseUrl}/${cleanKey}`;
      }
    }

    if (typeof rawUrl === 'string' && rawUrl.trim() !== '') {
      obj['avatarUrl'] = rawUrl.trim();
    }

    delete obj['avatar_key'];
    delete obj['avatar_url'];

    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        obj[key] = formatAvatarUrl(obj[key]);
      }
    }
  }

  return obj;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<any>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<any>> {
    return next.handle().pipe(
      map((resData) => {
        let plainData = resData;
        if (resData !== null && resData !== undefined && typeof resData === 'object') {
          try {
            plainData = JSON.parse(JSON.stringify(resData));
          } catch {
            plainData = resData;
          }
        }

        const sanitized = formatAvatarUrl(sanitizeData(plainData));

        if (sanitized === null || sanitized === undefined) {
          return {
            success: true,
            message: 'Operation successful',
            data: {},
          };
        }

        let message = 'Operation successful';
        let dataPayload: any = sanitized;

        if (typeof sanitized === 'object' && !Array.isArray(sanitized)) {
          if ('message' in sanitized && typeof sanitized.message === 'string') {
            message = sanitized.message;
            const { message: _, ...rest } = sanitized;
            dataPayload = rest;
          }

          if (
            'email' in sanitized &&
            !('user' in dataPayload) &&
            !('accessToken' in dataPayload) &&
            !('access_token' in dataPayload)
          ) {
            dataPayload = { user: dataPayload };
          }
        }

        return {
          success: true,
          message,
          data: dataPayload,
        };
      }),
    );
  }
}

