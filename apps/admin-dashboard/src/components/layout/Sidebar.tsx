'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film,
  Building2,
  Tv,
  Calendar,
  Users,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { resolveImageUrl } from '../../lib/api-client';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
  pulse?: boolean;
  badge?: string;
  badgeVariant?: 'gold' | 'crimson' | 'imax';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}) => {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const [imgError, setImgError] = useState(false);

  const avatarSrc = user?.avatarUrl ? resolveImageUrl(user.avatarUrl) : '';

  const navGroups: NavGroup[] = [
    {
      label: 'MAIN DASHBOARD',
      items: [
        {
          name: 'Dashboard Overview',
          href: '/dashboard',
          icon: LayoutDashboard,
          roles: ['super_admin', 'admin', 'cinema_admin', 'staff', 'gate_checker'],
          pulse: true,
        },
      ],
    },
    {
      label: 'CINEMA MANAGEMENT',
      items: [
        {
          name: 'Movies Catalog',
          href: '/dashboard/movies',
          icon: Film,
          roles: ['super_admin', 'admin', 'cinema_admin'],
        },
        {
          name: 'Cinema Branches',
          href: '/dashboard/cinemas',
          icon: Building2,
          roles: ['super_admin', 'admin'],
        },
        {
          name: 'Auditoriums & Halls',
          href: '/dashboard/auditoriums',
          icon: Tv,
          roles: ['super_admin', 'admin', 'cinema_admin'],
        },
        {
          name: 'Showtime Schedules',
          href: '/dashboard/showtimes',
          icon: Calendar,
          roles: ['super_admin', 'admin', 'cinema_admin'],
        },
      ],
    },
    {
      label: 'STAFF & PERMISSIONS',
      items: [
        {
          name: 'Staff & Gate Checkers',
          href: '/dashboard/users',
          icon: Users,
          roles: ['super_admin', 'admin'],
        },
      ],
    },
  ];

  const isExpanded = !collapsed || mobileOpen;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#080c14] transition-all duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0 ${
        collapsed ? 'lg:w-16 w-64' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-3.5">
        {isExpanded ? (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white font-bold text-xs shadow-md shadow-red-600/30">
              <Clapperboard className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#080c14]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  AFLAMAK
                </span>
                <span className="rounded bg-red-50 dark:bg-red-950/80 px-1.5 py-0.2 text-[9px] font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                  CINEMA
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 tracking-wider">
                Manager Portal
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white font-bold text-xs shadow-md shadow-red-600/30">
            <Clapperboard className="h-4 w-4" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#080c14]" />
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Close button on mobile */}
          <button
            onClick={onMobileClose}
            className="lg:hidden rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            title="Close menu"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Desktop collapse button */}
          <button
            onClick={onToggle}
            className="hidden lg:inline-flex rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-4 px-2.5 py-4">
        {navGroups.map((group, groupIdx) => {
          const visibleItems = group.items.filter(
            (item) => !role || item.roles.includes(role),
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx} className="space-y-1">
              {isExpanded && (
                <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  {group.label}
                </div>
              )}

              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onMobileClose?.()}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400 font-semibold border border-red-200/60 dark:border-red-900/60 active-nav-glow'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />
                    {isExpanded && (
                      <div className="flex flex-1 items-center justify-between overflow-hidden">
                        <span className="truncate">{item.name}</span>
                        {item.pulse && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        {item.badge && (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/70 px-1.5 py-0.2 text-[9px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Operational System Footer */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 p-2.5">
        {isExpanded ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0f172a] p-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                {avatarSrc && !imgError ? (
                  <img
                    src={avatarSrc}
                    alt={user?.name || 'Admin'}
                    onError={() => setImgError(true)}
                    className="h-7 w-7 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/80 text-[11px] font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                    {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                )}
                <div className="truncate">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {user?.name || 'Cinema Manager'}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                      {role?.replace('_', ' ') || 'ADMIN'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex w-full justify-center rounded-lg p-2 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title="Sign out"
          >
            {avatarSrc && !imgError ? (
              <img
                src={avatarSrc}
                alt={user?.name || 'Admin'}
                onError={() => setImgError(true)}
                className="h-6 w-6 rounded-md object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;



