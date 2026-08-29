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
  Clock,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Clapperboard,
  Armchair,
  Ticket,
  DoorOpen,
  MapPin,
} from 'lucide-react';
import apiClient, { extractList, normalizeMovie, normalizeCinema, normalizeShowtime, normalizeAuditorium } from '../../lib/api-client';

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
      const [moviesRes, cinemasRes, showtimesRes, audsRes] = await Promise.all([
        apiClient.get('/movies').catch(() => ({ data: { items: [] } })),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
        apiClient.get('/showtimes').catch(() => ({ data: { items: [] } })),
        apiClient.get('/auditoriums').catch(() => ({ data: { items: [] } })),
      ]);

      const rawMovies = extractList(moviesRes.data);
      const rawCinemas = extractList(cinemasRes.data);
      const rawShowtimes = extractList(showtimesRes.data);
      const rawAuds = extractList(audsRes.data);

      const movies = rawMovies.map(normalizeMovie);
      const cinemas = rawCinemas.map(normalizeCinema);
      const showtimes = rawShowtimes.map(normalizeShowtime);
      const auds = rawAuds.map(normalizeAuditorium);

      setStats({
        moviesCount: movies.length,
        cinemasCount: cinemas.length,
        auditoriumsCount: auds.length || cinemas.reduce(
          (acc: number, c: any) => acc + (c?.auditoriumsCount || c?.auditoriums?.length || 2),
          0,
        ),
        showtimesCount: showtimes.length,
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

  const cinemaMetrics = [
    {
      title: 'Active Movies',
      value: stats.moviesCount,
      subtitle: 'In Catalog & Showing',
      icon: Film,
      href: '/dashboard/movies',
      accentColor: 'text-red-500',
      badge: 'Catalog Active',
      badgeVariant: 'crimson' as const,
      borderHover: 'hover:border-red-500/40',
      bgGlow: 'from-red-600/10 via-transparent to-transparent',
    },
    {
      title: 'Cinema Complexes',
      value: stats.cinemasCount,
      subtitle: 'Active Branches',
      icon: Building2,
      href: '/dashboard/cinemas',
      accentColor: 'text-amber-500',
      badge: 'All Branches Open',
      badgeVariant: 'gold' as const,
      borderHover: 'hover:border-amber-500/40',
      bgGlow: 'from-amber-500/10 via-transparent to-transparent',
    },
    {
      title: 'Auditoriums & Halls',
      value: stats.auditoriumsCount,
      subtitle: 'IMAX, VIP & Standard',
      icon: Tv,
      href: '/dashboard/auditoriums',
      accentColor: 'text-cyan-500',
      badge: 'Screen Capacity',
      badgeVariant: 'imax' as const,
      borderHover: 'hover:border-cyan-500/40',
      bgGlow: 'from-cyan-500/10 via-transparent to-transparent',
    },
    {
      title: 'Scheduled Showtimes',
      value: stats.showtimesCount,
      subtitle: 'Active Daily Screenings',
      icon: Calendar,
      href: '/dashboard/showtimes',
      accentColor: 'text-purple-500',
      badge: 'Schedule Active',
      badgeVariant: 'purple' as const,
      borderHover: 'hover:border-purple-500/40',
      bgGlow: 'from-purple-500/10 via-transparent to-transparent',
    },
  ];

  return (
    <DashboardShell>
      {/* Cinema Operations Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-6 shadow-sm">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-red-600/10 dark:bg-red-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-amber-600/10 dark:bg-amber-600/10 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
              <span>Cinema Manager Operations Hub</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Cinema & Showtime Overview
            </h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Welcome back! Schedule movie showtimes, manage auditorium seat capacities, update ticket pricing, and review cinema branches.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>

            <Link
              href="/dashboard/movies"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-red-600/25 hover:bg-red-500 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Movie</span>
            </Link>

            <Link
              href="/dashboard/showtimes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Create Showtime</span>
            </Link>
          </div>
        </div>

        {/* Operational Business Status Strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Box Office Status: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Open for Booking</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-amber-500" />
              Gate Scanners: <strong className="text-amber-600 dark:text-amber-400 font-semibold">Ready for Admissions</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-cyan-500" />
              Multiplex Network: <strong className="text-cyan-600 dark:text-cyan-400 font-semibold">All Branches Active</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Role: {role ? role.replace('_', ' ').toUpperCase() : 'MANAGER'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cinemaMetrics.map((item, idx) => {
          const Icon = item.icon;
          return (
            <Link
              key={idx}
              href={item.href}
              className={`group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm transition-all cursor-pointer ${item.borderHover}`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.bgGlow}`} />

              <div className="relative flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {item.title}
                </span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 ${item.accentColor} transition-transform group-hover:scale-110 shadow-sm`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="relative mt-4 flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                    {loading ? '—' : item.value}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Activity className="h-3 w-3 text-emerald-500" />
                    <span>{item.subtitle}</span>
                  </div>
                </div>

                <Badge variant={item.badgeVariant} size="xs" dot={false}>
                  {item.badge}
                </Badge>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Live Screening Schedules & Hall Capacity */}
      <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/70 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 shadow-sm">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Live Screening Status & Hall Occupancy
                </h2>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current screenings, auditorium formats (IMAX / VIP), and real-time seat load
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/showtimes"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
            >
              View Full Program Schedule →
            </Link>
          </div>
        </div>

        {/* Screening Cards Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              hall: 'Hall 1 - Grand Laser',
              type: 'IMAX Laser',
              sound: 'Dolby Atmos 12.1',
              movie: 'Dune: Part Two',
              time: '18:30 (In 25 min)',
              bookedSeats: 164,
              totalSeats: 180,
              badgeVariant: 'imax' as const,
              status: 'Boarding Now',
            },
            {
              hall: 'Hall 2 - VIP Royale',
              type: 'VIP Platinum',
              sound: 'Dolby 7.1',
              movie: 'Oppenheimer',
              time: '19:15 (In 1h 10m)',
              bookedSeats: 42,
              totalSeats: 48,
              badgeVariant: 'vip' as const,
              status: 'Almost Sold Out',
            },
            {
              hall: 'Hall 3 - Motion Dome',
              type: '4DX Experience',
              sound: 'Spatial 3D',
              movie: 'Avatar: The Way of Water',
              time: '20:00 (In 1h 55m)',
              bookedSeats: 88,
              totalSeats: 120,
              badgeVariant: 'crimson' as const,
              status: 'Selling Fast',
            },
            {
              hall: 'Hall 4 - Prime Cinema',
              type: 'Standard Screen',
              sound: 'Dolby 7.1',
              movie: 'Spider-Man: Across the Spider-Verse',
              time: '21:30 (In 3h 25m)',
              bookedSeats: 95,
              totalSeats: 150,
              badgeVariant: 'emerald' as const,
              status: 'Open Booking',
            },
          ].map((screen, sIdx) => {
            const occupancy = Math.round((screen.bookedSeats / screen.totalSeats) * 100);
            return (
              <div
                key={sIdx}
                className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {screen.hall}
                    </span>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {screen.sound}
                    </p>
                  </div>
                  <Badge variant={screen.badgeVariant} size="xs" dot={false}>
                    {screen.type}
                  </Badge>
                </div>

                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {screen.movie}
                  </h4>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-red-500" />
                    <span>{screen.time}</span>
                  </div>
                </div>

                {/* Seat Occupancy Meter */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Seats Reserved:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {screen.bookedSeats} / {screen.totalSeats} ({occupancy}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        occupancy > 85
                          ? 'bg-red-500'
                          : occupancy > 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${occupancy}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Operational Modules Grid */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Module 1: Film Catalog & Media */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
                  <Film className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  Movies & Media Catalog
                </h3>
              </div>
              <Link
                href="/dashboard/movies"
                className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5"
              >
                Manage <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Manage film posters, trailers, backdrop photos, genres, and age ratings (PG-13, 18+).
            </p>

            <div className="mt-4 space-y-1.5 text-xs">
              <Link
                href="/dashboard/movies"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Film className="h-3.5 w-3.5 text-red-500" />
                  <span>Movies Catalog</span>
                </div>
                <span className="text-xs text-slate-400">{stats.moviesCount} Titles →</span>
              </Link>
              <Link
                href="/dashboard/cinemas"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-amber-500" />
                  <span>Cinemas & Branches</span>
                </div>
                <span className="text-xs text-slate-400">{stats.cinemasCount} Branches →</span>
              </Link>
              <Link
                href="/dashboard/auditoriums"
                className="flex items-center justify-between rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Tv className="h-3.5 w-3.5 text-cyan-500" />
                  <span>Auditoriums & Halls</span>
                </div>
                <span className="text-xs text-slate-400">IMAX/VIP Halls →</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Module 2: Showtime Schedule & Pricing */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  Showtime Schedules & Pricing
                </h3>
              </div>
              <Link
                href="/dashboard/showtimes"
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
              >
                Schedule <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Create daily screening showtimes with custom ticket pricing for VIP lounges, IMAX, and regular seats.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Ticket Reservation:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Live & Protected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Supported Seat Categories:</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  VIP, IMAX, Couple, Standard
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500 dark:text-slate-400">Online Ticket Delivery:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                  QR Code & Digital Pass
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Module 3: Staff & Access Control */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">
                  Staff & Gate Scanners
                </h3>
              </div>
              {role === 'super_admin' && (
                <Link
                  href="/dashboard/users"
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                >
                  Manage Staff <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
              Manage accounts and permissions for Super Admins, Branch Managers, Cashiers, and Gate Ticket Scanners.
            </p>

            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Your Current Role:</span>
                <span className="text-red-600 dark:text-red-400 font-bold">
                  {role ? role.replace('_', ' ').toUpperCase() : 'ADMIN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Gate Ticket Checker:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Active & Authorized
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                <span className="text-slate-500 dark:text-slate-400">Staff Account Security:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Protected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}


