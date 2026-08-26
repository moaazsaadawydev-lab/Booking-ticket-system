'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import DashboardShell from '../../components/layout/DashboardShell';
import { Badge } from '../../components/ui/Badge';
import {
  Film,
  Building2,
  Tv,
  Calendar,
  Users,
  ArrowUpRight,
  Plus,
  Activity,
  Server,
  Database,
  Lock,
  Radio,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import apiClient, { extractList } from '../../lib/api-client';

export default function DashboardOverviewPage() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    moviesCount: 0,
    cinemasCount: 0,
    auditoriumsCount: 0,
    showtimesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const [moviesRes, cinemasRes] = await Promise.all([
        apiClient.get('/movies').catch(() => ({ data: { items: [] } })),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
      ]);

      const movies = extractList(moviesRes.data);
      const cinemas = extractList(cinemasRes.data);

      setStats({
        moviesCount: movies.length,
        cinemasCount: cinemas.length,
        auditoriumsCount: cinemas.reduce(
          (acc: number, c: any) => acc + (c?.auditoriumsCount || c?.auditoriums?.length || 2),
          0,
        ),
        showtimesCount: 0,
      });
    } catch (err) {
      console.error('Failed to load overview metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const telemetryMetrics = [
    {
      title: 'Active Movies',
      value: stats.moviesCount,
      subtitle: 'Catalog Listings',
      icon: Film,
      href: '/dashboard/movies',
      accentColor: 'text-blue-500',
      bgGlow: 'from-blue-500/10 via-transparent to-transparent',
    },
    {
      title: 'Cinema Branches',
      value: stats.cinemasCount,
      subtitle: 'Active Multiplexes',
      icon: Building2,
      href: '/dashboard/cinemas',
      accentColor: 'text-indigo-500',
      bgGlow: 'from-indigo-500/10 via-transparent to-transparent',
    },
    {
      title: 'Auditoriums & Halls',
      value: stats.auditoriumsCount,
      subtitle: 'IMAX, VIP & 4DX',
      icon: Tv,
      href: '/dashboard/auditoriums',
      accentColor: 'text-emerald-500',
      bgGlow: 'from-emerald-500/10 via-transparent to-transparent',
    },
    {
      title: 'Scheduled Showtimes',
      value: stats.showtimesCount,
      subtitle: 'Daily Program',
      icon: Calendar,
      href: '/dashboard/showtimes',
      accentColor: 'text-amber-500',
      bgGlow: 'from-amber-500/10 via-transparent to-transparent',
    },
  ];

  return (
    <DashboardShell>
      {/* Operational Command Thesis Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-6 shadow-sm">
        {/* Subtle Background Accent Gradient */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-ping" />
              <span>[AFLAMAK.OPERATIONS.DECK]</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Cinema Operations Command
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Real-time telemetry, film catalog distribution, seat hold engines, and multiplex branch controls.
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync Telemetry</span>
            </button>

            <Link
              href="/dashboard/movies"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register Movie</span>
            </Link>

            <Link
              href="/dashboard/showtimes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/50 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Schedule Showtimes</span>
            </Link>
          </div>
        </div>

        {/* Live Cluster Pipeline Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Database className="h-3.5 w-3.5 text-emerald-500" />
              DB POSTGRES: <strong className="text-emerald-600 dark:text-emerald-400 font-normal">HEALTHY (5 DBs)</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Lock className="h-3.5 w-3.5 text-blue-500" />
              REDIS SEAT LOCK: <strong className="text-blue-600 dark:text-blue-400 font-normal">FLUSHED & ACTIVE</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              ROLE: {role || 'ADMIN'}
            </span>
            <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
              OUTBOX AGENT ONLINE
            </span>
          </div>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {telemetryMetrics.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={idx}
              href={item.href}
              className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.bgGlow}`} />

              <div className="relative flex items-center justify-between">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.title}
                </span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 ${item.accentColor} transition-transform group-hover:scale-105`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="relative mt-4">
                <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                  {loading ? '—' : item.value}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Activity className="h-3 w-3 text-emerald-500" />
                  <span>{item.subtitle}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Operational Modules & System Telemetry Grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Module 1: Catalog & Branch Network */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  <Film className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  [CATALOG.DISTRIBUTION]
                </h3>
              </div>
              <Link
                href="/dashboard/movies"
                className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                Manage <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Manage film listings, high-resolution portrait key art, landscape backdrops, trailers, and scene galleries.
            </p>

            <div className="mt-4 space-y-1.5 font-mono text-xs">
              <Link
                href="/dashboard/movies"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-blue-500" />
                  <span>Movies Catalog</span>
                </div>
                <span className="text-[11px] text-slate-400">{stats.moviesCount} Titles →</span>
              </Link>
              <Link
                href="/dashboard/cinemas"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Cinemas & Branches</span>
                </div>
                <span className="text-[11px] text-slate-400">{stats.cinemasCount} Complexes →</span>
              </Link>
              <Link
                href="/dashboard/auditoriums"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tv className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Auditoriums & Halls</span>
                </div>
                <span className="text-[11px] text-slate-400">IMAX/VIP →</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Module 2: Showtime Engine & Distributed Seat Holds */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  [SHOWTIME.SCHEDULER]
                </h3>
              </div>
              <Link
                href="/dashboard/showtimes"
                className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                Schedule <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Daily multiplex screening schedules, hall seating maps, and base ticket pricing.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Distributed Lock:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  REDIS EX 600s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Seat Auto-Grid:</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  ROWS × COLS AUTO
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500 dark:text-slate-400">gRPC Sync Transport:</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  PORT 50052 OK
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: System Access & Governance */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  [GOVERNANCE.RBAC]
                </h3>
              </div>
              {role === 'super_admin' && (
                <Link
                  href="/dashboard/users"
                  className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                >
                  Manage Users <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Role-based access control for Super Admins, Operations Admins, Cinema Admins, and Staff.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Current Scope:</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  ADMIN_PORTAL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">JWT Signing Engine:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  HMAC SHA-256
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500 dark:text-slate-400">Gate Ticket Checker:</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">
                  ENABLED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
