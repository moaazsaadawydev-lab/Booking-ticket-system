'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import SingleMediaInput from '../../../components/ui/SingleMediaInput';
import MediaGalleryInput from '../../../components/ui/MediaGalleryInput';
import { Cinema } from '../../../lib/types';
import apiClient, { extractList } from '../../../lib/api-client';
import {
  Building2,
  Plus,
  MapPin,
  Globe,
  Tv,
  Trash2,
  AlertCircle,
  Search,
  Images,
  Phone,
} from 'lucide-react';

export default function CinemasPage() {
  const [cinemas, setCinemas] = useState<Cinema[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    city: 'Cairo',
    address: '',
    country: 'Egypt',
    description: '',
    phoneNumber: '+20 2 3855 0000',
    thumbnailUrl: '',
    galleryUrls: [] as string[],
  });

  const fetchCinemas = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/cinemas');
      const data = extractList<Cinema>(res.data);
      setCinemas(data);
    } catch (err: any) {
      console.error('Failed to fetch cinemas:', err);
      setCinemas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCinemas();
  }, []);

  const handleCreateCinema = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/cinemas', {
        name: formData.name,
        city: formData.city,
        address: formData.address,
        country: formData.country,
        description: formData.description || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        thumbnailUrl: formData.thumbnailUrl || undefined,
        galleryUrls: formData.galleryUrls.length > 0 ? formData.galleryUrls : undefined,
      });
      setIsModalOpen(false);
      setFormData({
        name: '',
        city: 'Cairo',
        address: '',
        country: 'Egypt',
        description: '',
        phoneNumber: '+20 2 3855 0000',
        thumbnailUrl: '',
        galleryUrls: [],
      });
      await fetchCinemas();
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to create cinema branch',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCinema = async (id: string) => {
    if (!confirm('Are you sure you want to remove this cinema branch?')) return;
    try {
      await apiClient.delete(`/cinemas/${id}`);
      await fetchCinemas();
    } catch (err: any) {
      alert(
        err.response?.data?.message || err.message || 'Failed to delete cinema branch',
      );
    }
  };

  const safeCinemas = Array.isArray(cinemas) ? cinemas : [];
  const filteredCinemas = safeCinemas.filter(
    (c) =>
      c?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c?.city && c.city.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Cinemas & Branches
            </h1>
            <Badge variant="blue" size="sm">
              {safeCinemas.length} Locations
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure multiplex complexes, addresses, branch cover imagery, and VIP lounge photo galleries.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Branch
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search branches by name, city..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            <span className="inline-flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Loading cinema branches...
            </span>
          </div>
        ) : filteredCinemas.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No cinema branches found. Click "Add Branch" to create your first complex.
          </div>
        ) : (
          filteredCinemas.map((cinema) => {
            const galleryCount = cinema.galleryUrls?.length || 0;

            return (
              <div
                key={cinema.id}
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between"
              >
                {/* Branch Cover Header */}
                <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                  {cinema.thumbnailUrl ? (
                    <img
                      src={cinema.thumbnailUrl}
                      alt={cinema.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Building2 className="h-8 w-8 mb-1" />
                      <span className="text-[10px] font-medium">Standard Branch Cover</span>
                    </div>
                  )}

                  {/* Actions overlay */}
                  <div className="absolute right-2 top-2">
                    <button
                      onClick={() => handleDeleteCinema(cinema.id)}
                      className="rounded-full bg-black/60 p-1.5 text-white hover:bg-rose-600 transition-colors shadow-sm"
                      title="Remove Branch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {galleryCount > 0 && (
                    <div className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      <Images className="h-3 w-3" />
                      <span>{galleryCount} Photos</span>
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {cinema.name}
                    </h3>
                    <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{cinema.address}, {cinema.city}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{cinema.country}</span>
                      </div>
                      {cinema.phoneNumber && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{cinema.phoneNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Tv className="h-3 w-3 text-slate-400" />
                      Auditoriums: <strong>{cinema.auditoriumsCount || 2} Halls</strong>
                    </span>
                    <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                      OPERATIONAL
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Cinema Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Cinema Branch"
        subtitle="Provision a new multiplex complex with cover media & venue gallery"
        maxWidth="xl"
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateCinema} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Branch / Complex Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Mall of Arabia Megaplex"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                City *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
                placeholder="e.g. Cairo, Giza"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Country *
              </label>
              <input
                type="text"
                required
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="e.g. 26th of July Corridor"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Contact Phone
              </label>
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="+20 2 3855 0000"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Description & Highlights
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="State-of-the-art flagship multiplex featuring IMAX Laser and VIP lounges..."
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Media Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Venue Media & Photography
            </h3>

            {/* Cinema Cover Banner */}
            <SingleMediaInput
              label="Branch Banner / Exterior Cover"
              subtitle="Main venue hero photo (~16:9 ratio)"
              value={formData.thumbnailUrl}
              onChange={(url) => setFormData({ ...formData, thumbnailUrl: url })}
              aspectRatio="landscape"
              placeholder="https://images.unsplash.com/photo-..."
            />

            {/* Cinema Gallery */}
            <MediaGalleryInput
              label="Branch & VIP Lounge Gallery"
              subtitle="Interior seating, confectionery counters, VIP amenities, and lobby photos"
              images={formData.galleryUrls}
              onChange={(images) => setFormData({ ...formData, galleryUrls: images })}
              maxImages={8}
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
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors shadow-sm"
            >
              {saving ? 'Creating Branch...' : 'Create Branch & Media'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
