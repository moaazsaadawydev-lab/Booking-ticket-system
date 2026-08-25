'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { ArrowRight, Film, Building2, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../components/layout/ThemeToggle';

export default function RootHomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] px-4 text-center selection:bg-blue-600 selection:text-white">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      {/* Main Hero */}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
        A
      </div>

      <h1 className="mt-6 max-w-xl text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
        Aflamak Cinema OS
      </h1>
      <p className="mt-2 max-w-md text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
        Unified theater operations, movie catalog curation, dynamic showtimes
        scheduling, and staff role governance.
      </p>

      {/* Action Button */}
      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors cursor-pointer"
        >
          <span>Enter Admin Console</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Minimal Feature Highlights */}
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-3xl text-left">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-4 shadow-sm">
          <Film className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            Movie Catalog
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Posters, ratings, durations, and multi-genre tagging.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-4 shadow-sm">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            Multiplex Branches
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            IMAX, 4DX, and VIP hall configurations and capacities.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-4 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            Hierarchical RBAC
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Super Admin, Branch Managers, and Gate Staff validation.
          </p>
        </div>
      </div>
    </div>
  );
}
