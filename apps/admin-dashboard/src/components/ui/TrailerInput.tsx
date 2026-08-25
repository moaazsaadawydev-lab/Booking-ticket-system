'use client';

import React, { useState } from 'react';
import { Video, ExternalLink, Play, X } from 'lucide-react';

interface TrailerInputProps {
  label?: string;
  subtitle?: string;
  value: string;
  onChange: (url: string) => void;
}

export default function TrailerInput({
  label = 'Official Trailer URL',
  subtitle = 'YouTube, Vimeo, or direct MP4 stream link',
  value,
  onChange,
}: TrailerInputProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Extract YouTube embed URL if valid
  const getEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    try {
      if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        const v = urlObj.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (url.includes('vimeo.com/')) {
        const id = url.split('vimeo.com/')[1]?.split('?')[0];
        if (id) return `https://player.vimeo.com/video/${id}`;
      }
    } catch {
      return null;
    }
    return null;
  };

  const embedUrl = getEmbedUrl(value);

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {embedUrl && (
          <button
            type="button"
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Play className="h-3 w-3" />
            {isPreviewOpen ? 'Hide Preview' : 'Live Preview'}
          </button>
        )}
      </div>

      <div className="relative">
        <Video className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-8 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {subtitle && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
      )}

      {/* Embedded Video Preview Accordion */}
      {isPreviewOpen && embedUrl && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black">
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              title="Trailer Preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
