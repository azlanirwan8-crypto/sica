'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, User, Lock, ShieldCheck, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import type { LoginResponseEnvelope, MfaVerifyResponseEnvelope, ErrorEnvelope } from '@sica/contracts';

interface LoginFormProps {
  tenantSlug?: string;
}

const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700';
const FIELD =
  'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-velzon-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-velzon-primary/20';

export function LoginForm({ tenantSlug = 'demo' }: LoginFormProps) {
  const router = useRouter();

  const [tenantIdentifier, setTenantIdentifier] = useState(tenantSlug);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const [loading, setLoading] = useState(false);

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIdentifier, username, password }),
      });
      const data = (await response.json()) as LoginResponseEnvelope | ErrorEnvelope;
      if (!response.ok || !data.success) {
        toast.error((data as ErrorEnvelope).error?.message || 'Kredensial login tidak valid.');
        setLoading(false);
        return;
      }
      const successData = data as LoginResponseEnvelope;
      if (successData.data.requireMfa && successData.data.mfaToken) {
        setIsMfaStep(true);
        setMfaToken(successData.data.mfaToken);
        setLoading(false);
        toast.info('Autentikasi Dua Faktor (2FA) diperlukan. Masukkan kode TOTP Anda.');
        return;
      }
      toast.success('Login berhasil! Mengalihkan ke dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 700);
    } catch {
      toast.error('Gagal menghubungi server otentikasi. Silakan periksa koneksi.');
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, totpCode }),
      });
      const data = (await response.json()) as MfaVerifyResponseEnvelope | ErrorEnvelope;
      if (!response.ok || !data.success) {
        toast.error((data as ErrorEnvelope).error?.message || 'Kode verifikasi 2FA salah.');
        setLoading(false);
        return;
      }
      toast.success('Verifikasi 2FA sukses! Mengalihkan ke dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 700);
    } catch {
      toast.error('Gagal memverifikasi 2FA. Silakan coba kembali.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {isMfaStep ? 'Verifikasi Dua Faktor (2FA)' : 'Masuk ke Portal Akademik'}
        </h2>
        <p className="mb-6 mt-1 text-sm font-medium text-slate-600">
          {isMfaStep
            ? 'Masukkan 6 digit kode dari aplikasi Authenticator Anda'
            : 'Sistem Informasi Kampus Terpadu (SICA Multi-Tenant)'}
        </p>
      </div>

      {!isMfaStep ? (
        <>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className={LABEL}>
                <span className="mr-1 inline-flex align-middle text-velzon-primary"><Building2 className="h-3.5 w-3.5" /></span>
                Institusi Kampus
              </label>
              <input
                type="text"
                required
                value={tenantIdentifier}
                onChange={(e) => setTenantIdentifier(e.target.value)}
                placeholder="Slug tenant (contoh: demo atau untar)"
                className={FIELD}
              />
            </div>

            <div>
              <label className={LABEL}>
                <span className="mr-1 inline-flex align-middle text-velzon-primary"><User className="h-3.5 w-3.5" /></span>
                NIM / NIDN / Email
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2201010045 atau dosen@kampus.ac.id"
                className={FIELD}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  <span className="mr-1 inline-flex align-middle text-velzon-primary"><Lock className="h-3.5 w-3.5" /></span>
                  Kata Sandi
                </label>
                <a
                  href="#forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Silakan hubungi Biro Administrasi Akademik (BAAK) kampus untuk reset kata sandi.');
                  }}
                  className="text-xs font-semibold text-velzon-primary hover:underline"
                >
                  Lupa sandi?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`${FIELD} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-velzon-primary"
              />
              <label htmlFor="rememberMe" className="cursor-pointer select-none text-xs font-medium text-slate-600">
                Ingat sesi saya di perangkat ini
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-velzon-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-velzon-primary/30 transition-all duration-200 hover:bg-velzon-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Akun</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400">Atau masuk dengan SSO Kampus</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => toast.info('SSO Google Workspace belum aktif pada versi demo.')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50"
            >
              <GoogleIcon />
              Google Workspace
            </button>
            <button
              type="button"
              onClick={() => toast.info('SSO Microsoft 365 belum aktif pada versi demo.')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50"
            >
              <MicrosoftIcon />
              Microsoft 365
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleMfaSubmit} className="space-y-4">
          <div>
            <label className={LABEL}>Kode Autentikator (TOTP)</label>
            <input
              type="text"
              required
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className={`${FIELD} text-center font-mono text-xl tracking-[0.3em]`}
            />
          </div>
          <button
            type="submit"
            disabled={loading || totpCode.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-velzon-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-velzon-primary/30 transition-all duration-200 hover:bg-velzon-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memverifikasi TOTP...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>Verifikasi &amp; Lanjutkan</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMfaStep(false);
              setTotpCode('');
            }}
            className="w-full text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            Kembali ke Login Username
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.5h11.84c-.5 2.75-2.03 5.08-4.33 6.64v5.52h7.01c4.1-3.77 6.46-9.32 6.46-15.9z" />
      <path fill="#34A853" d="M24 46c5.84 0 10.74-1.94 14.32-5.27l-7.01-5.52c-1.94 1.3-4.43 2.07-7.31 2.07-5.61 0-10.37-3.78-12.07-8.87H4.74v5.75C8.31 41.27 15.53 46 24 46z" />
      <path fill="#FBBC05" d="M11.93 28.41c-.43-1.3-.68-2.68-.68-4.11s.25-2.81.68-4.11v-5.75H4.74C3.21 17.19 2.4 20.45 2.4 24s.81 6.81 2.34 9.56l7.19-5.15z" />
      <path fill="#EA4335" d="M24 10.75c3.18 0 6.04 1.1 8.29 3.24l6.21-6.21C34.73 4.31 29.83 2 24 2 15.53 2 8.31 6.73 4.74 13.69l7.19 5.75c1.7-5.09 6.46-8.69 12.07-8.69z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 48 48" width="15" height="15" aria-hidden className="shrink-0">
      <rect x="4" y="4" width="17" height="17" fill="#F25022" />
      <rect x="25" y="4" width="17" height="17" fill="#7FBA00" />
      <rect x="4" y="25" width="17" height="17" fill="#00A4EF" />
      <rect x="25" y="25" width="17" height="17" fill="#FFB900" />
    </svg>
  );
}
