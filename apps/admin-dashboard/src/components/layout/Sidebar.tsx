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
  Shield,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  const navItems = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['super_admin', 'admin', 'cinema_admin', 'staff', 'gate_checker'],
    },
    {
      name: 'Movies',
      href: '/dashboard/movies',
      icon: Film,
      roles: ['super_admin', 'admin', 'cinema_admin'],
    },
    {
      name: 'Cinemas & Branches',
      href: '/dashboard/cinemas',
      icon: Building2,
      roles: ['super_admin', 'admin'],
    },
    {
      name: 'Auditoriums',
      href: '/dashboard/auditoriums',
      icon: Tv,
      roles: ['super_admin', 'admin', 'cinema_admin'],
    },
    {
      name: 'Showtimes',
      href: '/dashboard/showtimes',
      icon: Calendar,
      roles: ['super_admin', 'admin', 'cinema_admin'],
    },
    {
      name: 'User & Staff Roles',
      href: '/dashboard/users',
      icon: Users,
      badge: 'Super Admin',
      roles: ['super_admin'],
    },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0b0f19] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-100 dark:border-slate-800/80 px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs shadow-sm">
              A
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Aflamak
              </span>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                Admin
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-xs shadow-sm">
            A
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
      <nav className="flex-1 space-y-0.5 px-2.5 py-3">
        {navItems
          .filter((item) => !role || item.roles.includes(role))
          .map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 font-semibold'
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
                  <div className="flex flex-1 items-center justify-between">
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="rounded bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 text-[9px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
      </nav>

      {/* User Info Footer */}
      <div className="border-t border-slate-100 dark:border-slate-800/80 p-2.5">
        {!collapsed ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0f172a] p-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {user?.name?.slice(0, 2) || 'AD'}
              </div>
              <div className="truncate">
                <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-200">
                  {user?.name || 'Admin'}
                </p>
                <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono">
                  {role || 'ADMIN'}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="rounded p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
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
