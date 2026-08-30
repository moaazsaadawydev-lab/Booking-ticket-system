'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, Link as LinkIcon, X, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import apiClient from '../../lib/api-client';

interface SingleMediaInputProps {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (url: string) => void;
  aspectRatio?: 'portrait' | 'landscape' | 'square';
  placeholder?: string;
  required?: boolean;
}

export default function SingleMediaInput({
  label,
  subtitle,
  value,
  onChange,
  aspectRatio = 'portrait',
  placeholder = 'https://...',
  required = false,
}: SingleMediaInputProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('url');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectClass =
    aspectRatio === 'portrait'
      ? 'aspect-[2/3] w-28 max-w-[120px]'
      : aspectRatio === 'landscape'
      ? 'aspect-[16/9] w-48 max-w-[200px]'
      : 'aspect-square w-28 max-w-[120px]';

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const tempKey = res.data?.data?.tempKey || res.data?.tempKey;
      if (tempKey) {
        onChange(tempKey);
      } else {
        throw new Error('Upload response missing tempKey');
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      setUploadError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <label className="font-medium text-slate-700 dark:text-slate-300">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              mode === 'url'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <LinkIcon className="h-2.5 w-2.5" />
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UploadCloud className="h-2.5 w-2.5" />
            Upload
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Preview Thumbnail Card */}
        <div
          className={`relative shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900 flex items-center justify-center ${aspectClass}`}
        >
          {value ? (
            <>
              {value.startsWith('temp/') ? (
                <div className="flex flex-col items-center justify-center p-2 text-center text-[10px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 mb-1" />
                  <span className="font-semibold line-clamp-1">Media Ready</span>
                  <span className="text-[9px] text-slate-400">MinIO Staged</span>
                </div>
              ) : (
                <img
                  src={value}
                  alt={label}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-rose-600 transition-colors"
                title="Remove asset"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400">
              <ImageIcon className="h-4 w-4 mb-1 text-slate-400 dark:text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">No Asset</span>
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="flex-1 space-y-2">
          {mode === 'url' ? (
            <div>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Paste direct image link, CDN URL, or base64 data stream.
              </p>
            </div>
          ) : (
            <div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 p-4 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                {isUploading ? (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-medium text-[11px]">Uploading to MinIO storage...</span>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="h-5 w-5 text-slate-400 mb-1" />
                    <p className="font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      Click or Drag & Drop file here
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      JPG, PNG, WebP up to 15MB
                    </p>
                  </>
                )}
              </div>
              {uploadError && (
                <p className="mt-1 text-[11px] text-rose-500">{uploadError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
