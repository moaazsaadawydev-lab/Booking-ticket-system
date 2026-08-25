'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import apiClient from '../../lib/api-client';

interface MediaGalleryInputProps {
  label: string;
  subtitle?: string;
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function MediaGalleryInput({
  label,
  subtitle,
  images = [],
  onChange,
  maxImages = 12,
}: MediaGalleryInputProps) {
  const [urlInput, setUrlInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeImages = Array.isArray(images) ? images : [];

  const handleAddUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (safeImages.includes(trimmed)) {
      setUploadError('Image already exists in gallery');
      return;
    }
    onChange([...safeImages, trimmed]);
    setUrlInput('');
    setUploadError(null);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    onChange(safeImages.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFilesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    fileArray.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await apiClient.post('/media/upload-multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedItems: Array<{ tempKey: string }> =
        res.data?.data?.items || res.data?.items || [];
      const newKeys = uploadedItems.map((item) => item.tempKey).filter(Boolean);

      if (newKeys.length > 0) {
        onChange([...safeImages, ...newKeys]);
      } else {
        // Fallback if single upload format
        const fallbackKey = res.data?.data?.tempKey || res.data?.tempKey;
        if (fallbackKey) {
          onChange([...safeImages, fallbackKey]);
        }
      }
    } catch (err: any) {
      console.error('Gallery upload error:', err);
      setUploadError(
        err.response?.data?.message || err.message || 'Failed to upload files',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-2 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {safeImages.length} / {maxImages} Assets
        </span>
      </div>

      {/* Input Bar: URL + Upload Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="Paste image URL (https://...) and press Add"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button
          type="button"
          onClick={() => handleAddUrl()}
          disabled={!urlInput.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors border border-slate-300 dark:border-slate-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add URL
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-sm"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5" />
          )}
          Upload Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesUpload(e.target.files);
            }
          }}
        />
      </div>

      {uploadError && (
        <p className="text-[11px] text-rose-500">{uploadError}</p>
      )}

      {/* Dropzone & Gallery Grid */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="min-h-[100px] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-3"
      >
        {safeImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
            <ImageIcon className="h-6 w-6 text-slate-400 mb-1.5" />
            <p className="font-medium text-slate-600 dark:text-slate-300 text-[11px]">
              No gallery images added yet
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Drag & drop scene stills / photos here, or use URL input above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
            {safeImages.map((img, idx) => (
              <div
                key={`${img}-${idx}`}
                className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm"
              >
                {img.startsWith('temp/') ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 mb-0.5" />
                    <span className="text-[9px] font-semibold">MinIO File</span>
                  </div>
                ) : (
                  <img
                    src={img}
                    alt={`Gallery ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!img.startsWith('temp/') && (
                    <a
                      href={img}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-white/20 p-1 text-white hover:bg-white/40 transition-colors"
                      title="Open full image"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="rounded-md bg-rose-600/80 p-1 text-white hover:bg-rose-600 transition-colors"
                    title="Remove from gallery"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
