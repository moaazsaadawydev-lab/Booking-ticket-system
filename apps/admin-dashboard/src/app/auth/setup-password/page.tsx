'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import apiClient from '../../../lib/api-client';
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!token) {
      setError('Missing activation token in URL. Please use the link provided in your invitation email.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post('/auth/setup-password', {
        token,
        password,
      });

      const message =
        response.data?.message ||
        'Password configured successfully! Account is now active.';

      setSuccessMsg(message);

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      console.error('Setup password error:', err);
      const apiMsg =
        err.response?.data?.message ||
        err.message ||
        'The invitation link is invalid or has expired. Please contact your administrator for a new invite.';
      setError(apiMsg);
    } finally {
      setLoading(false);
    }
  };

  // Render Missing Token Warning
  if (!token) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-4 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Invalid Invitation Link
          </h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The activation token is missing from the link. Please make sure you click the complete invitation URL sent to your email or contact your administrator to reissue a new invitation.
          </p>

          <button
            onClick={() => router.push('/login')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 py-3 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            <span>Return to Login</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-8 shadow-xl">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-600 text-white mb-4 shadow-lg shadow-red-600/30">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Setup Staff Password
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Create a secure password to activate your staff account and access the manager portal.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Activation Failed</p>
            <p className="mt-0.5 text-[11px] opacity-90">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Account Activated!</p>
            <p className="mt-0.5 text-[11px] opacity-90">{successMsg}</p>
            <p className="mt-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
              Redirecting to login in 2 seconds...
            </p>
          </div>
        </div>
      )}

      {!successMsg && (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              New Password *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-10 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-10 text-slate-900 dark:text-slate-100 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-3 text-xs font-semibold text-white shadow-lg shadow-red-600/20 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Activating Account...
              </span>
            ) : (
              <>
                <span>Activate Account & Save Password</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090d16] p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
            Loading invitation context...
          </div>
        }
      >
        <SetupPasswordForm />
      </Suspense>
    </main>
  );
}
