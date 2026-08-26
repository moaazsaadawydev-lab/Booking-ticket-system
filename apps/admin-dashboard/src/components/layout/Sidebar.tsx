'use client';

import React from 'react';
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
  ShieldAlert,
  Radio,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
  pulse?: boolean;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  const navGroups: NavGroup[] = [
    {
      label: 'SYSTEM OPS',
      items: [
        {
          name: 'Command Center',
          href: '/dashboard',
          icon: LayoutDashboard,
          roles: ['super_admin', 'admin', 'cinema_admin', 'staff', 'gate_checker'],
          pulse: true,
        },
      ],
    },
    {
      label: 'CATALOG & VENUES',
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
          name: 'Showtime Schedule',
          href: '/dashboard/showtimes',
          icon: Calendar,
          roles: ['super_admin', 'admin', 'cinema_admin'],
        },
      ],
    },
    {
      label: 'GOVERNANCE & ACCESS',
      items: [
        {
          name: 'Users & Staff RBAC',
          href: '/dashboard/users',
          icon: Users,
          badge: 'Super Admin',
          roles: ['super_admin'],
        },
      ],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#080c14] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-3.5">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20">
              <span>A</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#080c14]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  AFLAMAK
                </span>
                <span className="rounded bg-blue-50 dark:bg-blue-950/80 px-1 py-0.2 text-[9px] font-mono font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                  OS v2.4
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-wider">
                CINEMA CONTROL
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20">
            <span>A</span>
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#080c14]" />
          </div>
        )}

        <button
          onClick={onToggle}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
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
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
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
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 font-semibold border border-blue-200/60 dark:border-blue-900/60 active-nav-glow'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                    title={collapsed ? item.name : undefined}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />
                    {!collapsed && (
                      <div className="flex flex-1 items-center justify-between overflow-hidden">
                        <span className="truncate">{item.name}</span>
                        {item.pulse && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                        {item.badge && (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/70 px-1.5 py-0.2 text-[9px] font-mono font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
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
        {!collapsed ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0f172a] p-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                  {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                <div className="truncate">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {user?.name || 'Operations Admin'}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">
                      {role || 'ADMIN'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex w-full justify-center rounded-lg p-2 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
