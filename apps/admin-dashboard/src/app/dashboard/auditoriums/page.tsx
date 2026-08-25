'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { Auditorium, Cinema } from '../../../lib/types';
import apiClient, { extractList } from '../../../lib/api-client';
import {
  Tv,
  Plus,
  Building2,
  Armchair,
  AlertCircle,
  Trash2,
} from 'lucide-react';

export default function AuditoriumsPage() {
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    cinemaId: '',
    name: '',
    totalSeats: 120,
    type: 'IMAX',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [audsRes, cinemasRes] = await Promise.all([
        apiClient.get('/auditoriums').catch(() => ({ data: { items: [] } })),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
      ]);

      const audsList = extractList<Auditorium>(audsRes.data);
      const cinList = extractList<Cinema>(cinemasRes.data);

      setAuditoriums(audsList);
      setCinemas(cinList);
      if (cinList.length > 0 && !formData.cinemaId) {
        setFormData((prev) => ({ ...prev, cinemaId: cinList[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to fetch auditoriums:', err);
      setAuditoriums([]);
      setCinemas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAuditorium = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/auditoriums', {
        cinemaId: formData.cinemaId,
        name: formData.name,
        totalSeats: Number(formData.totalSeats),
        type: formData.type,
      });
      setIsModalOpen(false);
      setFormData({
        cinemaId: cinemas[0]?.id || '',
        name: '',
        totalSeats: 120,
        type: 'IMAX',
      });
      await fetchData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to create auditorium',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAuditorium = async (id: string) => {
    if (!confirm('Are you sure you want to remove this auditorium?')) return;
    try {
      await apiClient.delete(`/auditoriums/${id}`);
      await fetchData();
    } catch (err: any) {
      alert(
        err.response?.data?.message || err.message || 'Failed to delete auditorium',
      );
    }
  };

  const getTypeVariant = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'IMAX':
        return 'gold';
      case 'VIP':
        return 'rose';
      case '4DX':
        return 'blue';
      default:
        return 'slate';
    }
  };

  const safeAuditoriums = Array.isArray(auditoriums) ? auditoriums : [];
  const safeCinemas = Array.isArray(cinemas) ? cinemas : [];

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Auditoriums & Halls
            </h1>
            <Badge variant="emerald" size="sm">
              {safeAuditoriums.length} Halls
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure theater halls, screen technologies, and seat capacities.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Auditorium
        </button>
      </div>

      {/* Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              Loading auditoriums...
            </span>
          </div>
        ) : safeAuditoriums.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No auditoriums configured yet. Click "Add Auditorium" to provision a screening hall.
          </div>
        ) : (
          safeAuditoriums.map((hall) => {
            const linkedCinema = safeCinemas.find((c) => c.id === hall.cinemaId);

            return (
              <div
                key={hall.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-emerald-600 dark:text-emerald-400">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={getTypeVariant(hall.type)} size="sm">
                      {hall.type || 'STANDARD'}
                    </Badge>
                    <button
                      onClick={() => handleDeleteAuditorium(hall.id)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Delete Auditorium"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {hall.name}
                  </h3>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {(hall as any).cinemaName || linkedCinema?.name || 'Assigned Branch'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                      <Armchair className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{hall.totalSeats || 120} Seats</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Dolby Atmos Audio</span>
                  <span className="font-mono text-[10px]">
                    4K Laser
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Auditorium Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Auditorium"
        subtitle="Configure hall capacity and screen type"
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateAuditorium} className="space-y-3.5 text-xs">
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
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              {safeCinemas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Hall Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. IMAX Hall 1, VIP Screen A"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Screen Technology
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="IMAX">IMAX 4K Laser</option>
                <option value="VIP">VIP Lounge</option>
                <option value="4DX">4DX Motion</option>
                <option value="STANDARD">Standard Digital</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Seat Capacity *
              </label>
              <input
                type="number"
                required
                min={10}
                max={500}
                value={formData.totalSeats}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    totalSeats: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
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
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Creating...' : 'Create Hall'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
