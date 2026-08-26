'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Badge } from '../ui/Badge';
import ThemeToggle from './ThemeToggle';
import { Activity, Server, ShieldCheck, Search, Command } from 'lucide-react';

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
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#080c14]/80 px-6 backdrop-blur-md">
      {/* Breadcrumb & OS Identifier */}
      <div className="flex items-center gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-200">
          <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-pulse" />
          <span>AFLAMAK OS</span>
        </div>
        {pathSegments.length > 0 && <span className="text-slate-400">/</span>}
        {pathSegments.map((segment, idx) => (
          <React.Fragment key={idx}>
            <span
              className={
                idx === pathSegments.length - 1
                  ? 'font-semibold text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {segment}
            </span>
            {idx < pathSegments.length - 1 && <span className="text-slate-400">/</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Center Cluster Telemetry (Desktop Only) */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800/80 pr-4">
          <Server className="h-3.5 w-3.5 text-blue-500" />
          <span>GATEWAY: <strong className="text-emerald-600 dark:text-emerald-400 font-normal">HTTP/gRPC OK</strong></span>
        </div>
        <div className="flex items-center gap-1.5 border-r border-slate-200 dark:border-slate-800/80 pr-4">
          <Activity className="h-3.5 w-3.5 text-indigo-500" />
          <span>REDIS HOLD: <strong className="text-slate-700 dark:text-slate-300 font-normal">ACTIVE</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
          <span>SCOPED SCOPE: <strong className="text-amber-600 dark:text-amber-400 font-normal">ADMIN_PORTAL</strong></span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Role Badge */}
        {role && (
          <Badge variant={roleVariant} size="sm">
            {role.replace('_', ' ').toUpperCase()}
          </Badge>
        )}

        {/* Live Cluster Health Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>CLUSTER ONLINE</span>
        </div>

        {/* Dark/Light Mode Toggle */}
        <ThemeToggle />

        {/* User Avatar & Scope Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
            {user?.name?.charAt(0) || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
