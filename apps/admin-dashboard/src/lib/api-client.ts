import axios, { AxiosInstance } from 'axios';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/api/v1' : 'http://localhost:3000/api/v1');

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

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
