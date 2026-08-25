'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../../../components/layout/DashboardShell';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import SingleMediaInput from '../../../components/ui/SingleMediaInput';
import MediaGalleryInput from '../../../components/ui/MediaGalleryInput';
import TrailerInput from '../../../components/ui/TrailerInput';
import { Movie } from '../../../lib/types';
import apiClient, { extractList } from '../../../lib/api-client';
import {
  Film,
  Plus,
  Search,
  Trash2,
  Clock,
  Calendar,
  Star,
  ExternalLink,
  AlertCircle,
  Images,
  Video,
} from 'lucide-react';

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    durationMinutes: 120,
    releaseDate: new Date().toISOString().split('T')[0],
    posterUrl: '',
    bannerUrl: '',
    trailerUrl: '',
    galleryUrls: [] as string[],
    genre: 'Action',
    rating: 8.5,
    ageRating: 'PG_13',
    status: 'NOW_SHOWING',
  });

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/movies');
      const data = extractList<Movie>(res.data);
      setMovies(data);
    } catch (err: any) {
      console.error('Failed to fetch movies:', err);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/movies', {
        title: formData.title,
        description: formData.description,
        durationMinutes: Number(formData.durationMinutes),
        releaseDate: new Date(formData.releaseDate).toISOString(),
        posterUrl: formData.posterUrl || undefined,
        bannerUrl: formData.bannerUrl || undefined,
        trailerUrl: formData.trailerUrl || undefined,
        galleryUrls: formData.galleryUrls.length > 0 ? formData.galleryUrls : undefined,
        genre: formData.genre,
        rating: Number(formData.rating),
        ageRating: formData.ageRating,
        status: formData.status,
        countryOfOrigin: 'EG',
        originalLanguage: 'en',
      });
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        durationMinutes: 120,
        releaseDate: new Date().toISOString().split('T')[0],
        posterUrl: '',
        bannerUrl: '',
        trailerUrl: '',
        galleryUrls: [],
        genre: 'Action',
        rating: 8.5,
        ageRating: 'PG_13',
        status: 'NOW_SHOWING',
      });
      await fetchMovies();
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to create movie',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMovie = async (id: string) => {
    if (!confirm('Are you sure you want to delete this movie from the catalog?'))
      return;
    try {
      await apiClient.delete(`/movies/${id}`);
      await fetchMovies();
    } catch (err: any) {
      alert(
        err.response?.data?.message || err.message || 'Failed to delete movie',
      );
    }
  };

  const safeMovies = Array.isArray(movies) ? movies : [];
  const filteredMovies = safeMovies.filter(
    (m) =>
      m?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m?.genre && m.genre.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <DashboardShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Movies Catalog
            </h1>
            <Badge variant="blue" size="sm">
              {safeMovies.length} Films
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage movie listings, portrait posters, landscape backdrops, video trailers, and scene galleries.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Movie
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
            placeholder="Search movies by title, genre..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-5 py-3">Movie & Media Assets</th>
                <th className="px-5 py-3">Genre</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3">Release Date</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                      Loading movies catalog...
                    </span>
                  </td>
                </tr>
              ) : filteredMovies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No movies found in the catalog.
                  </td>
                </tr>
              ) : (
                filteredMovies.map((movie) => {
                  const galleryCount = movie.galleryUrls?.length || 0;
                  return (
                    <tr
                      key={movie.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Title & Poster */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            {movie.posterUrl ? (
                              <img
                                src={movie.posterUrl}
                                alt={movie.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Film className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                {movie.title}
                              </p>
                              {movie.ageRating && (
                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.2 text-[9px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {movie.ageRating}
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-1 max-w-xs text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                              {movie.description}
                            </p>
                            {/* Media pills */}
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                              {galleryCount > 0 && (
                                <span className="inline-flex items-center gap-0.5 font-medium text-slate-500 dark:text-slate-400">
                                  <Images className="h-2.5 w-2.5" />
                                  {galleryCount} stills
                                </span>
                              )}
                              {movie.trailerUrl && (
                                <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                                  <Video className="h-2.5 w-2.5" />
                                  Trailer
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Genre */}
                      <td className="px-5 py-3.5">
                        <Badge variant="slate" size="sm">
                          {movie.genre || 'Feature'}
                        </Badge>
                      </td>

                      {/* Duration */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{movie.durationMinutes || 120} min</span>
                        </div>
                      </td>

                      {/* Release Date */}
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>
                            {movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-current" />
                          <span>{movie.rating ? Number(movie.rating).toFixed(1) : '8.5'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {movie.trailerUrl && (
                            <a
                              href={movie.trailerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:text-slate-200 transition-colors"
                              title="Watch Trailer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteMovie(movie.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Delete Movie"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Movie Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Movie"
        subtitle="Catalog Entry, High-Res Posters, Trailers & Gallery"
        maxWidth="2xl"
      >
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateMovie} className="space-y-4 text-xs">
          {/* Basic Info */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Movie Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g. Inception, Dune: Part Two"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Description / Synopsis *
            </label>
            <textarea
              rows={3}
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Plot summary, narrative overview, and director notes..."
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Duration (Minutes) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={formData.durationMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    durationMinutes: Number(e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Release Date *
              </label>
              <input
                type="date"
                required
                value={formData.releaseDate}
                onChange={(e) =>
                  setFormData({ ...formData, releaseDate: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Genre
              </label>
              <select
                value={formData.genre}
                onChange={(e) =>
                  setFormData({ ...formData, genre: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="Action">Action</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Drama">Drama</option>
                <option value="Comedy">Comedy</option>
                <option value="Horror">Horror</option>
                <option value="Animation">Animation</option>
                <option value="Adventure">Adventure</option>
                <option value="Thriller">Thriller</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Rating (1 - 10)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={formData.rating}
                onChange={(e) =>
                  setFormData({ ...formData, rating: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Age Rating
              </label>
              <select
                value={formData.ageRating}
                onChange={(e) =>
                  setFormData({ ...formData, ageRating: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="PG_13">PG-13 (Parents Strongly Cautioned)</option>
                <option value="R">R (Restricted)</option>
                <option value="PG">PG (Parental Guidance Suggested)</option>
                <option value="G">G (General Audiences)</option>
                <option value="NC_17">NC-17 (Adults Only)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300">
                Screening Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
              >
                <option value="NOW_SHOWING">Now Showing</option>
                <option value="COMING_SOON">Coming Soon</option>
              </select>
            </div>
          </div>

          {/* Media Section */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Media & Creative Assets
            </h3>

            {/* Poster Input */}
            <SingleMediaInput
              label="Portrait Poster"
              subtitle="Tall key art for movie cards & listings (~2:3 ratio)"
              value={formData.posterUrl}
              onChange={(url) => setFormData({ ...formData, posterUrl: url })}
              aspectRatio="portrait"
              placeholder="https://images.unsplash.com/photo-..."
            />

            {/* Banner / Backdrop Input */}
            <SingleMediaInput
              label="Backdrop / Hero Banner"
              subtitle="Landscape banner for featured hero headers (~16:9 ratio)"
              value={formData.bannerUrl}
              onChange={(url) => setFormData({ ...formData, bannerUrl: url })}
              aspectRatio="landscape"
              placeholder="https://images.unsplash.com/photo-..."
            />

            {/* Trailer Input */}
            <TrailerInput
              value={formData.trailerUrl}
              onChange={(url) => setFormData({ ...formData, trailerUrl: url })}
            />

            {/* Multi-Image Gallery */}
            <MediaGalleryInput
              label="Scene Stills & Photo Gallery"
              subtitle="High-res screenshots, promotional stills, and production photos"
              images={formData.galleryUrls}
              onChange={(images) => setFormData({ ...formData, galleryUrls: images })}
              maxImages={12}
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
              {saving ? 'Registering Film...' : 'Register Movie & Media'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
