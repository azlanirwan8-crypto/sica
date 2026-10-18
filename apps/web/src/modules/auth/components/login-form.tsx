'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, User, Lock, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { LoginResponseEnvelope, MfaVerifyResponseEnvelope, ErrorEnvelope } from '@sica/contracts';

interface LoginFormProps {
  tenantSlug?: string;
}

export function LoginForm({ tenantSlug = 'demo' }: LoginFormProps) {
  const router = useRouter();

  const [tenantIdentifier, setTenantIdentifier] = useState(tenantSlug);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // State alur MFA
  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Status UI
  const [loading, setLoading] = useState(false);

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantIdentifier,
          username,
          password,
        }),
      });

      const data = (await response.json()) as LoginResponseEnvelope | ErrorEnvelope;

      if (!response.ok || !data.success) {
        const errorData = data as ErrorEnvelope;
        toast.error(errorData.error?.message || 'Kredensial login tidak valid.');
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
        body: JSON.stringify({
          mfaToken,
          totpCode,
        }),
      });

      const data = (await response.json()) as MfaVerifyResponseEnvelope | ErrorEnvelope;

      if (!response.ok || !data.success) {
        const errorData = data as ErrorEnvelope;
        toast.error(errorData.error?.message || 'Kode verifikasi 2FA salah.');
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
    <Card className="w-full max-w-md border-gray-100 shadow-xl bg-white/95 backdrop-blur dark:bg-gray-900/95 dark:border-gray-800">
      <CardHeader className="space-y-1 text-center pb-4">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-velzon-primary/10 text-velzon-primary">
          {isMfaStep ? <ShieldCheck className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </div>
        <CardTitle className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {isMfaStep ? 'Verifikasi Dua Faktor (2FA)' : 'Masuk ke Portal Akademik'}
        </CardTitle>
        <CardDescription className="text-xs text-gray-500 dark:text-gray-400">
          {isMfaStep
            ? 'Masukkan 6 digit kode dari aplikasi Authenticator Anda'
            : 'Sistem Informasi Campus Terpadu (SICA Multi-Tenant)'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!isMfaStep ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Input Kode Tenant / Kampus */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-velzon-primary" />
                Institusi Kampus
              </label>
              <div className="relative">
                <Input
                  type="text"
                  required
                  value={tenantIdentifier}
                  onChange={(e) => setTenantIdentifier(e.target.value)}
                  placeholder="Slug tenant (contoh: demo atau untar)"
                  className="pl-3 text-sm focus-visible:ring-velzon-primary"
                />
              </div>
            </div>

            {/* Input Username / NIM / NIDN */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-velzon-primary" />
                NIM / NIDN / Email
              </label>
              <Input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2201010045 atau dosen@kampus.ac.id"
                className="text-sm focus-visible:ring-velzon-primary"
              />
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-velzon-primary" />
                  Kata Sandi
                </label>
                <a
                  href="#forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Silakan hubungi Biro Administrasi Akademik (BAAK) kampus untuk reset kata sandi.');
                  }}
                  className="text-xs font-medium text-velzon-primary hover:underline"
                >
                  Lupa sandi?
                </a>
              </div>
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="text-sm focus-visible:ring-velzon-primary"
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-velzon-primary focus:ring-velzon-primary accent-velzon-primary"
              />
              <label htmlFor="rememberMe" className="text-xs text-gray-600 dark:text-gray-400 select-none cursor-pointer">
                Ingat sesi saya di perangkat ini
              </label>
            </div>

            {/* Tombol Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-velzon-primary hover:bg-velzon-primary-hover text-white font-medium h-10 mt-2 transition-all flex items-center justify-center gap-2"
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
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Kode Autentikator (TOTP)
              </label>
              <Input
                type="text"
                required
                maxLength={6}
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center font-mono text-xl tracking-widest h-12 focus-visible:ring-velzon-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-velzon-primary hover:bg-velzon-primary-hover text-white font-medium h-10 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memverifikasi TOTP...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verifikasi & Lanjutkan</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsMfaStep(false);
                setTotpCode('');
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Kembali ke Login Username
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
