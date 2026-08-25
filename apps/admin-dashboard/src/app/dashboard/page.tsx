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

  useEffect(() => {
    async function fetchStats() {
      try {
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
            (acc: number, c: any) => acc + (c?.auditoriums?.length || 0),
            0,
          ),
          showtimesCount: 0,
        });
      } catch (err) {
        console.error('Failed to load overview metrics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const kpis = [
    {
      title: 'Active Movies',
      value: stats.moviesCount,
      change: 'Catalog Listings',
      icon: Film,
      href: '/dashboard/movies',
    },
    {
      title: 'Cinema Branches',
      value: stats.cinemasCount,
      change: 'Active Megaplexes',
      icon: Building2,
      href: '/dashboard/cinemas',
    },
    {
      title: 'Auditoriums & Halls',
      value: stats.auditoriumsCount || 0,
      change: 'IMAX, VIP & Standard',
      icon: Tv,
      href: '/dashboard/auditoriums',
    },
    {
      title: 'Daily Showtimes',
      value: stats.showtimesCount,
      change: 'Scheduled Today',
      icon: Calendar,
      href: '/dashboard/showtimes',
    },
  ];

  return (
    <DashboardShell>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Overview
            </h1>
            <Badge
              variant={role === 'super_admin' ? 'gold' : 'blue'}
              size="sm"
            >
              {role || 'ADMIN'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Welcome back, {user?.name || 'Administrator'}. Here is your operations snapshot.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/movies"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            New Movie
          </Link>
          <Link
            href="/dashboard/showtimes"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            Schedule Showtime
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={idx}
              href={kpi.href}
              className="group rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {kpi.title}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {loading ? '—' : kpi.value}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Activity className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{kpi.change}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Navigation Modules */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Module 1: Catalog */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Film className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Catalog & Branches
            </h3>
            <Link
              href="/dashboard/movies"
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Feature films, genre categorization, multi-screen branches.
          </p>
          <div className="mt-3 space-y-1 text-xs">
            <Link
              href="/dashboard/movies"
              className="flex items-center justify-between rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span>Movies Catalog</span>
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              href="/dashboard/cinemas"
              className="flex items-center justify-between rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span>Cinemas & Locations</span>
              <span className="text-slate-400">→</span>
            </Link>
            <Link
              href="/dashboard/auditoriums"
              className="flex items-center justify-between rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span>Auditoriums & Seating</span>
              <span className="text-slate-400">→</span>
            </Link>
          </div>
        </div>

        {/* Module 2: Showtimes */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Showtime Scheduling
            </h3>
            <Link
              href="/dashboard/showtimes"
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              Schedule <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Program daily film schedules and set base ticket prices.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-xs">
            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
              <span>Booking Lock Engine</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                ONLINE
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Redis Distributed Seat Locking (NX EX 600) Active
            </div>
          </div>
        </div>

        {/* Module 3: Security & Staff */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Staff & Gate Access
            </h3>
            {role === 'super_admin' && (
              <Link
                href="/dashboard/users"
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
              >
                Manage <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Role elevation and gate checker assignments.
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Gate Entrance Guard</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                STAFF ONLY
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">JWT Ticket Signing</span>
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                ACTIVE (exp: +30m)
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
