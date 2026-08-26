'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import { Auditorium, Cinema } from '../../../lib/types';
import apiClient, { extractList, normalizeAuditorium, normalizeCinema } from '../../../lib/api-client';
import {
  Tv,
  Plus,
  Building2,
  Armchair,
  AlertCircle,
  Trash2,
  Edit2,
  Volume2,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react';

export default function AuditoriumsPage() {
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAuditorium, setEditingAuditorium] = useState<Auditorium | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const initialForm = {
    cinemaId: '',
    name: '',
    totalSeats: 120,
    type: 'IMAX',
    soundSystem: 'Dolby Atmos 7.1',
  };

  const [formData, setFormData] = useState(initialForm);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [audsRes, cinemasRes] = await Promise.all([
        apiClient.get('/auditoriums').catch(() => ({ data: { items: [] } })),
        apiClient.get('/cinemas').catch(() => ({ data: { items: [] } })),
      ]);

      const rawAuds = extractList(audsRes.data);
      const rawCinemas = extractList(cinemasRes.data);

      const audsList = rawAuds.map(normalizeAuditorium);
      const cinList = rawCinemas.map(normalizeCinema);

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

  const openCreateModal = () => {
    setFormData({
      ...initialForm,
      cinemaId: cinemas[0]?.id || '',
    });
    setError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (hall: Auditorium) => {
    setEditingAuditorium(hall);
    setFormData({
      cinemaId: hall.cinemaId,
      name: hall.name || '',
      totalSeats: hall.totalSeats || 120,
      type: hall.type || 'IMAX',
      soundSystem: hall.soundSystem || 'Dolby Atmos 7.1',
    });
    setError(null);
  };

  const handleCreateAuditorium = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const seats = Number(formData.totalSeats) || 120;
      const rows = Math.ceil(Math.sqrt(seats)) || 10;
      const cols = Math.ceil(seats / rows) || 12;

      let expType = 'STANDARD_2D';
      const u = String(formData.type).toUpperCase();
      if (u === 'IMAX' || u === 'IMAX_3D') expType = 'IMAX_3D';
      else if (u === 'VIP' || u === 'VIP_LOUNGE') expType = 'VIP_LOUNGE';
      else if (u === '4DX' || u === 'FOUR_DX') expType = 'FOUR_DX';

      await apiClient.post('/auditoriums', {
        cinemaId: formData.cinemaId,
        name: formData.name,
        experienceType: expType,
        type: formData.type,
        soundSystem: formData.soundSystem,
        totalSeats: seats,
        totalRows: rows,
        totalColumns: cols,
      });
      setIsCreateOpen(false);
      setFormData(initialForm);
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

  const handleUpdateAuditorium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAuditorium) return;
    setSaving(true);
    setError(null);
    try {
      const seats = Number(formData.totalSeats) || 120;
      const rows = Math.ceil(Math.sqrt(seats)) || 10;
      const cols = Math.ceil(seats / rows) || 12;

      let expType = 'STANDARD_2D';
      const u = String(formData.type).toUpperCase();
      if (u === 'IMAX' || u === 'IMAX_3D') expType = 'IMAX_3D';
      else if (u === 'VIP' || u === 'VIP_LOUNGE') expType = 'VIP_LOUNGE';
      else if (u === '4DX' || u === 'FOUR_DX') expType = 'FOUR_DX';

      await apiClient.patch(`/auditoriums/${editingAuditorium.id}`, {
        name: formData.name,
        experienceType: expType,
        type: formData.type,
        soundSystem: formData.soundSystem,
        totalSeats: seats,
        totalRows: rows,
        totalColumns: cols,
      });
      setEditingAuditorium(null);
      await fetchData();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to update auditorium',
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
        return 'emerald';
    }
  };

  const safeAuditoriums = Array.isArray(auditoriums) ? auditoriums : [];
  const safeCinemas = Array.isArray(cinemas) ? cinemas : [];

  const filteredAuditoriums = safeAuditoriums.filter((h) => {
    const matchesSearch =
      h?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h?.cinemaName && h.cinemaName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || h.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Auditoriums & Halls
            </h1>
            <Badge variant="emerald" size="sm">
              {safeAuditoriums.length} Halls
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Configure theater screening halls, IMAX Laser / 4DX / VIP formats, and acoustic sound systems.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Auditorium
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search halls by name, cinema branch..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
          />
        </div>

        {/* Type Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {['ALL', 'IMAX', 'VIP', '4DX', 'STANDARD'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-colors cursor-pointer ${
                typeFilter === t
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs font-mono">
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              Loading auditoriums...
            </span>
          </div>
        ) : filteredAuditoriums.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs font-mono">
            No auditoriums configured yet. Click "Add Auditorium" to provision a screening hall.
          </div>
        ) : (
          filteredAuditoriums.map((hall) => {
            const linkedCinema = safeCinemas.find((c) => c.id === hall.cinemaId);
            const cinemaLabel = hall.cinemaName || linkedCinema?.name || 'Multiplex Complex';
            const cinemaCity = hall.cinemaCity || linkedCinema?.city || 'Cairo';

            return (
              <div
                key={hall.id}
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-emerald-600 dark:text-emerald-400">
                      <Tv className="h-5 w-5" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={getTypeVariant(hall.type)} size="sm">
                        {hall.type}
                      </Badge>
                      <button
                        onClick={() => openEditModal(hall)}
                        className="rounded p-1 text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        title="Edit Hall"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAuditorium(hall.id)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove Auditorium"
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
                        <span className="truncate">{cinemaLabel} ({cinemaCity})</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Armchair className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{hall.totalSeats || 120} Seats ({hall.totalRows || 10}R × {hall.totalColumns || 12}C)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3 text-slate-400" />
                    <span>{hall.soundSystem || 'Dolby Atmos'}</span>
                  </span>
                  <span className="rounded bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 font-semibold">
                    {hall.type === 'IMAX' ? '4K LASER' : hall.type === 'VIP' ? 'LEATHER RECLINERS' : 'DIGITAL 2K'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE AUDITORIUM MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add Auditorium"
        subtitle="Configure hall capacity, screen technology, and sound system"
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
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
            >
              {safeCinemas.length === 0 ? (
                <option value="">No cinemas available - Create one first</option>
              ) : (
                safeCinemas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.city})
                  </option>
                ))
              )}
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
              placeholder="e.g. Hall 1 - IMAX Laser, VIP Lounge 2"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Screen Format / Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-sans"
              >
                <option value="IMAX">IMAX 4K Laser</option>
                <option value="VIP">VIP Executive Lounge</option>
                <option value="4DX">4DX Motion EFX</option>
                <option value="STANDARD">Standard 2D/3D</option>
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
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Sound System
            </label>
            <input
              type="text"
              value={formData.soundSystem}
              onChange={(e) =>
                setFormData({ ...formData, soundSystem: e.target.value })
              }
              placeholder="e.g. Dolby Atmos 7.1, IMAX 12-Channel Acoustic"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-sans"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || safeCinemas.length === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? 'Provisioning...' : 'Create Hall'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT AUDITORIUM MODAL */}
      <Modal
        isOpen={!!editingAuditorium}
        onClose={() => setEditingAuditorium(null)}
        title="Edit Auditorium Details"
        subtitle={`Updating theater hall: ${editingAuditorium?.name}`}
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdateAuditorium} className="space-y-3.5 text-xs">
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
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Screen Format / Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as any })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-sans"
              >
                <option value="IMAX">IMAX 4K Laser</option>
                <option value="VIP">VIP Executive Lounge</option>
                <option value="4DX">4DX Motion EFX</option>
                <option value="STANDARD">Standard 2D/3D</option>
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
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Sound System
            </label>
            <input
              type="text"
              value={formData.soundSystem}
              onChange={(e) =>
                setFormData({ ...formData, soundSystem: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none font-sans"
            />
          </div>

          <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingAuditorium(null)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Hall Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
