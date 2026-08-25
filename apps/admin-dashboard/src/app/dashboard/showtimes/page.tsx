'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { Showtime, Movie, Cinema, Auditorium } from '../../../lib/types';
import apiClient, { extractList } from '../../../lib/api-client';
import {
  Calendar,
  Plus,
  Film,
  Clock,
  AlertCircle,
} from 'lucide-react';

export default function ShowtimesPage() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    movieId: '',
    cinemaId: '',
    auditoriumId: '',
    startTime: new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16),
    basePrice: 150,
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

      const stList = extractList<Showtime>(stRes.data);
      const mList = extractList<Movie>(moviesRes.data);
      const cList = extractList<Cinema>(cinemasRes.data);
      const aList = extractList<Auditorium>(audsRes.data);

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

  const handleCreateShowtime = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/showtimes', {
        movieId: formData.movieId,
        cinemaId: formData.cinemaId,
        auditoriumId: formData.auditoriumId,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        basePrice: Number(formData.basePrice),
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
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {Number(st.basePrice || 150).toFixed(2)} EGP
                        </span>
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
        subtitle="Select movie, venue hall, timeslot and ticket price"
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

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Base Ticket Price (EGP) *
            </label>
            <input
              type="number"
              required
              min={10}
              value={formData.basePrice}
              onChange={(e) =>
                setFormData({ ...formData, basePrice: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
            />
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
