'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import apiClient from './api-client';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load session from localStorage on initial render
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('admin_access_token');
      const savedUserStr = localStorage.getItem('admin_user_data');

      if (savedToken && savedUserStr) {
        setToken(savedToken);
        setUser(JSON.parse(savedUserStr));
      }
    } catch (e) {
      console.error('Failed to parse saved user data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        clientScope: 'ADMIN_PORTAL',
      });

      const responseData = response.data?.data || response.data;
      const accessToken = responseData.accessToken;
      const userRole = (responseData.role || 'admin').toLowerCase() as UserRole;
      const cinemaId = responseData.cinemaId || null;

      // Extract user details or construct from payload
      const loggedUser: User = {
        id: responseData.userId || 'admin-user',
        name: email.split('@')[0].toUpperCase(),
        email,
        role: userRole,
        cinemaId,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };

      // Set cookie for Next.js middleware protection
      document.cookie = `admin_access_token=${accessToken}; path=/; max-age=${
        7 * 24 * 60 * 60
      }; SameSite=Lax`;
      document.cookie = `admin_user_role=${userRole}; path=/; max-age=${
        7 * 24 * 60 * 60
      }; SameSite=Lax`;

      localStorage.setItem('admin_access_token', accessToken);
      localStorage.setItem('admin_user_data', JSON.stringify(loggedUser));

      setToken(accessToken);
      setUser(loggedUser);

      router.push('/dashboard');
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Authentication failed';
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_user_data');
    document.cookie =
      'admin_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie =
      'admin_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const hasRole = (roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
