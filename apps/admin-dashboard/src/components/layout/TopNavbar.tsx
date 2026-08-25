'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Badge } from '../ui/Badge';
import ThemeToggle from './ThemeToggle';

export const TopNavbar: React.FC = () => {
  const pathname = usePathname();
  const { user, role } = useAuth();

  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1));

  const roleVariant =
    role === 'super_admin'
      ? 'gold'
      : role === 'admin'
      ? 'blue'
      : role === 'cinema_admin'
      ? 'emerald'
      : 'slate';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#090d16]/80 px-6 backdrop-blur-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-200">
          Aflamak OS
        </span>
        {pathSegments.length > 0 && <span>/</span>}
        {pathSegments.map((segment, idx) => (
          <React.Fragment key={idx}>
            <span
              className={
                idx === pathSegments.length - 1
                  ? 'font-medium text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {segment}
            </span>
            {idx < pathSegments.length - 1 && <span>/</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Role Badge */}
        {role && (
          <Badge variant={roleVariant} size="sm">
            {role.replace('_', ' ')}
          </Badge>
        )}

        {/* Live Cluster Health */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          Connected
        </div>

        {/* Dark/Light Mode Toggle */}
        <ThemeToggle />

        {/* User Avatar */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {user?.name?.charAt(0) || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
