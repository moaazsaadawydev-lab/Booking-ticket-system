'use client';

import React, { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../../components/layout/ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(
        err.message ||
          'Failed to sign in. Please verify your credentials and permissions.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] px-4 py-12 selection:bg-blue-600 selection:text-white">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0f172a] p-8 shadow-sm">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-base shadow-sm">
            A
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Aflamak Admin OS
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Operations & Theater Management Console
          </p>
        </div>

        {/* Scope Pill */}
        <div className="mt-5 flex items-center justify-center gap-1.5 rounded-md border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>SCOPE: ADMIN_PORTAL</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
            <p className="flex-1 font-medium">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Email address
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aflamak.com"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in...
              </span>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Aflamak Cinema OS &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
