'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { Showtime, Movie, Cinema, Auditorium } from '../../../lib/types';
import apiClient, {
  extractList,
  normalizeMovie,
  normalizeCinema,
  normalizeAuditorium,
  normalizeShowtime,
} from '../../../lib/api-client';
import {
  Calendar,
  Plus,
  Film,
  Clock,
  AlertCircle,
  Sparkles,
  DollarSign,
  Layers,
} from 'lucide-react';

const SEAT_TIER_META: Record<string, { label: string; desc: string; badge: string }> = {
  REGULAR: { label: 'Regular / Standard', desc: 'Standard auditorium seating', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  VIP: { label: 'VIP Lounge', desc: 'Plush recliners & waiter service', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60' },
  PREMIUM: { label: 'Premium / Prime', desc: 'Optimal central viewing angle', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60' },
  COUPLE: { label: 'Couple Sofa', desc: 'Double seat with privacy divider', badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60' },
  WHEELCHAIR: { label: 'Accessible', desc: 'Wheelchair access & companion space', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60' },
};

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State with Tiered Pricing Matrix
  const [formData, setFormData] = useState({
    movieId: '',
    cinemaId: '',
    auditoriumId: '',
    startTime: new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16),
    basePrice: 150,
    tierPricings: {
      REGULAR: 150,
      VIP: 250,
      PREMIUM: 200,
      COUPLE: 300,
      WHEELCHAIR: 150,
    } as Record<string, number>,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stRes, moviesRes, cinemasRes, audsRes] = await Promise.all([
        apiClient.get('/showtimes').catch(() => ({ data: { items: [] } })),
        apiClient.get('/movies').catch(() => ({ data: { items: [] } })),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
        apiClient.get('/auditoriums').catch(() => ({ data: { items: [] } })),
      ]);

      const stRaw = extractList(stRes.data);
      const mRaw = extractList(moviesRes.data);
      const cRaw = extractList(cinemasRes.data);
      const aRaw = extractList(audsRes.data);

      const stList = stRaw.map(normalizeShowtime);
      const mList = mRaw.map(normalizeMovie);
      const cList = cRaw.map(normalizeCinema);
      const aList = aRaw.map(normalizeAuditorium);

      setShowtimes(stList);
      setMovies(mList);
      setCinemas(cList);
      setAuditoriums(aList);

      if (mList.length > 0 && !formData.movieId) {
        setFormData((prev) => ({
          ...prev,
          movieId: mList[0].id,
          cinemaId: cList[0]?.id || '',
          auditoriumId: aList[0]?.id || '',
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch showtimes:', err);
      setShowtimes([]);
      setMovies([]);
      setCinemas([]);
      setAuditoriums([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBasePriceChange = (val: number) => {
    setFormData((prev) => ({
      ...prev,
      basePrice: val,
      tierPricings: {
        REGULAR: val,
        VIP: Math.round(val * 1.6),
        PREMIUM: Math.round(val * 1.3),
        COUPLE: Math.round(val * 2.0),
        WHEELCHAIR: val,
      },
    }));
  };

  const handleTierPriceChange = (tier: string, val: number) => {
    setFormData((prev) => ({
      ...prev,
      tierPricings: {
        ...prev.tierPricings,
        [tier]: val,
      },
    }));
  };

  const handleCreateShowtime = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const selectedAud = auditoriums.find((a) => a.id === formData.auditoriumId);
      const customPricings = Object.entries(formData.tierPricings)
        .filter(([_, price]) => Number(price) > 0)
        .map(([seatType, price]) => ({
          seatType,
          price: Number(price),
        }));

      await apiClient.post('/showtimes', {
        movieId: formData.movieId,
        cinemaId: formData.cinemaId,
        auditoriumId: formData.auditoriumId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        experienceType: selectedAud?.experienceType || 'STANDARD_2D',
        basePrice: Number(formData.basePrice),
        customPricings,
      });
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to schedule showtime',
      );
    } finally {
      setSaving(false);
    }
  };

  const safeShowtimes = Array.isArray(showtimes) ? showtimes : [];
  const safeMovies = Array.isArray(movies) ? movies : [];
  const safeCinemas = Array.isArray(cinemas) ? cinemas : [];
  const safeAuditoriums = Array.isArray(auditoriums) ? auditoriums : [];

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Showtimes Scheduler
            </h1>
            <Badge variant="blue" size="sm">
              {safeShowtimes.length} Screenings
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Program daily film schedules, set ticket prices, and orchestrate auditorium sessions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Schedule Showtime
        </button>
      </div>

      {/* Showtimes Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-5 py-3">Movie</th>
                <th className="px-5 py-3">Cinema & Hall</th>
                <th className="px-5 py-3">Start Time</th>
                <th className="px-5 py-3">End Time</th>
                <th className="px-5 py-3">Base Price</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Loading showtimes schedule...
                    </span>
                  </td>
                </tr>
              ) : safeShowtimes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No showtimes scheduled. Click "Schedule Showtime" to program screenings.
                  </td>
                </tr>
              ) : (
                safeShowtimes.map((st) => {
                  const m = safeMovies.find((mov) => mov.id === st.movieId) || st.movie;
                  const c = safeCinemas.find((cin) => cin.id === st.cinemaId) || st.cinema;
                  const a = safeAuditoriums.find((aud) => aud.id === st.auditoriumId) || st.auditorium;

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                            <Film className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {m?.title || 'Feature Film'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {m?.genre || 'Cinema'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">
                        <div>
                          <p className="font-medium">{c?.name || 'Assigned Branch'}</p>
                          <p className="text-[11px] text-slate-500">{a?.name || 'Main Hall'}</p>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{st.startTime ? new Date(st.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{st.endTime ? new Date(st.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {(() => {
                          const pricings = Array.isArray(st.seatPricings) ? st.seatPricings : [];
                          const prices = pricings.map((p) => Number(p.price)).filter((p) => !isNaN(p) && p > 0);
                          const minPrice = prices.length > 0 ? Math.min(...prices, Number(st.basePrice || 150)) : Number(st.basePrice || 150);
                          const maxPrice = prices.length > 0 ? Math.max(...prices, Number(st.basePrice || 150)) : Number(st.basePrice || 150);
                          const hasRange = minPrice !== maxPrice && prices.length > 1;

                          return (
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs">
                                {hasRange ? `${minPrice.toFixed(0)} - ${maxPrice.toFixed(0)} EGP` : `${Number(st.basePrice || 150).toFixed(2)} EGP`}
                              </div>
                              {pricings.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {pricings.map((p, pIdx) => {
                                    const meta = SEAT_TIER_META[p.seatType] || { label: p.seatType, badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' };
                                    return (
                                      <span
                                        key={pIdx}
                                        className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-medium ${meta.badge}`}
                                        title={`${meta.label}: ${p.price} EGP`}
                                      >
                                        {p.seatType}: {p.price} EGP
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Badge variant="emerald" size="sm">
                          SCHEDULED
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Showtime Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Showtime"
        subtitle="Select movie, venue hall, timeslot and configure tiered seat pricing"
        maxWidth="2xl"
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateShowtime} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Select Feature Movie *
            </label>
            <select
              required
              value={formData.movieId}
              onChange={(e) =>
                setFormData({ ...formData, movieId: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            >
              {safeMovies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Cinema Branch *
              </label>
              <select
                required
                value={formData.cinemaId}
                onChange={(e) =>
                  setFormData({ ...formData, cinemaId: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {safeCinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Auditorium Hall *
              </label>
              <select
                required
                value={formData.auditoriumId}
                onChange={(e) =>
                  setFormData({ ...formData, auditoriumId: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                {safeAuditoriums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Start Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                End Time *
              </label>
              <input
                type="datetime-local"
                required
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Dynamic Seat Tier Pricing Matrix */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-blue-500" />
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Tiered Seat Pricing Matrix
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Custom pricing per seat category
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Default Base Ticket Price (EGP) *
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  required
                  min={10}
                  value={formData.basePrice}
                  onChange={(e) => handleBasePriceChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. 150"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
                Seat Category Price Breakdown:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(SEAT_TIER_META).map(([tierKey, meta]) => {
                  const currentVal = formData.tierPricings[tierKey] ?? formData.basePrice;
                  return (
                    <div
                      key={tierKey}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-medium text-[11px] text-slate-800 dark:text-slate-200 truncate">
                          {meta.label}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate font-mono">{tierKey}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          value={currentVal}
                          onChange={(e) => handleTierPriceChange(tierKey, Number(e.target.value))}
                          className="w-20 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-right text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                        />
                        <span className="text-[10px] font-mono text-slate-400">EGP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Scheduling...' : 'Confirm Schedule'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
