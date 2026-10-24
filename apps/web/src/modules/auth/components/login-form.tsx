'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { ZodError } from 'zod';
import { LoginRequestSchema, MfaVerifyRequestSchema } from '@sica/contracts';
import type { ApiError, ErrorDetail, ErrorEnvelope, LoginResponseEnvelope, MfaVerifyResponseEnvelope } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { getDictionary } from '@/lib/i18n';

interface LoginFormProps {
  tenantSlug?: string;
}

const LOGIN_ENDPOINT = '/api/v1/auth/login';
const MFA_ENDPOINT = '/api/v1/auth/mfa/verify';
const DEFAULT_DESTINATION = '/dashboard';
/** Whitelist tujuan pasca-login: hanya rute internal yang dilindungi middleware. */
const ALLOWED_DESTINATIONS: readonly string[] = ['/dashboard', '/academic'];
/** Nama parameter yang tidak boleh ikut terbawa ke URL pasca-login. */
const CREDENTIAL_PARAM = /token|otp|totp|password|pass|secret|code|session|credit|kredit/i;
/** Teks cadangan bila pesan Zod/server tidak menyebutkan kolom tertentu. */
const FIELD_FALLBACK = 'Periksa kembali isian ini.';

type CredentialField = 'tenantIdentifier' | 'username' | 'password';
type FieldErrors = Partial<Record<CredentialField, string>>;
const CREDENTIAL_FIELDS: readonly CredentialField[] = ['tenantIdentifier', 'username', 'password'];

/** Penjelasan kegagalan untuk pengguna: sebab + langkah berikutnya (bukan pesan mentah server). */
type Notice = {
  readonly title: string;
  readonly body: string;
  readonly steps: readonly string[];
  readonly reference?: string;
};

const IDS = {
  tenant: 'sica-login-tenant',
  username: 'sica-login-username',
  password: 'sica-login-password',
  totp: 'sica-login-totp',
} as const;

const NETWORK_NOTICE: Notice = {
  title: 'Tidak dapat terhubung ke portal',
  body: 'Proses masuk belum berhasil diselesaikan.',
  steps: [
    'Periksa koneksi jaringan perangkat Anda.',
    'Pastikan alamat portal sesuai dengan informasi dari kampus.',
    'Coba lagi beberapa saat kemudian.',
  ],
};

const SERVICE_NOTICE: Notice = {
  title: 'Portal sedang mengalami gangguan',
  body: 'Permintaan masuk belum dapat diselesaikan. Data akun Anda tidak berubah.',
  steps: ['Tunggu sebentar, lalu coba lagi.', 'Jika masih gagal, hubungi pengelola akun di kampus Anda.'],
};

/**
 * Pesan login selalu seragam untuk kredensial salah: tampilan tidak pernah
 * memberi tahu apakah email/NIM tersebut terdaftar (anti user-enumeration).
 */
const CREDENTIAL_NOTICE: Notice = {
  title: 'Data masuk tidak cocok',
  body: 'Kode kampus, NIM, NIDN, email, atau kata sandi yang dimasukkan tidak sesuai.',
  steps: [
    'Periksa kembali NIM, NIDN, atau email Anda.',
    'Pastikan kode kampus benar, misalnya: unpad.',
    'Jika lupa kata sandi, hubungi pengelola akun di kampus Anda.',
  ],
};

function lockedNotice(reference: string | undefined): Notice {
  return {
    title: 'Akun dikunci sementara',
    body: 'Terlalu banyak percobaan masuk. Akun akan dapat digunakan kembali setelah masa tunggu selesai.',
    steps: [
      'Tunggu sampai masa kunci selesai, lalu coba lagi.',
      'Hindari mencoba berulang kali selama akun masih dikunci.',
      'Jika masih terkunci, hubungi pengelola akun di kampus Anda.',
    ],
    reference,
  };
}

function disabledNotice(reference: string | undefined): Notice {
  return {
    title: 'Akun belum dapat digunakan',
    body: 'Akun atau akses kampus Anda sedang tidak aktif.',
    steps: [
      'Hubungi pengelola akun di kampus untuk memeriksa statusnya.',
      'Jika sudah pindah atau lulus, tanyakan cara memperbarui akses akun.',
    ],
    reference,
  };
}

function tenantNotice(reference: string | undefined): Notice {
  return {
    title: 'Kode kampus tidak ditemukan',
    body: 'Kode kampus yang dimasukkan belum terdaftar.',
    steps: [
      'Periksa kembali ejaan kode kampus, misalnya: unpad.',
      'Jika belum tahu kodenya, tanyakan kepada pengelola akun kampus.',
    ],
    reference,
  };
}

function rateLimitNotice(reference: string | undefined): Notice {
  return {
    title: 'Terlalu banyak percobaan masuk',
    body: 'Akses dihentikan sementara untuk membantu melindungi akun Anda.',
    steps: [
      'Tunggu beberapa menit sebelum mencoba kembali.',
      'Pastikan data yang dimasukkan sudah benar.',
    ],
    reference,
  };
}

function mfaNotice(reference: string | undefined): Notice {
  return {
    title: 'Kode keamanan tidak cocok',
    body: 'Kode yang dimasukkan salah atau sudah tidak berlaku.',
    steps: [
      'Masukkan 6 angka terbaru dari aplikasi pembuat kode keamanan.',
      'Kode berubah setiap 30 detik, jadi masukkan kode yang terbaru.',
      'Jika kode tetap tidak cocok, hubungi pengelola akun di kampus Anda.',
    ],
    reference,
  };
}

/** Petakan status HTTP + kode error kontrak ke penjelasan yang aman untuk ditampilkan. */
function describeFailure(
  status: number,
  error: ApiError | undefined,
  reference: string | undefined,
  copy: { staleTitle: string; staleBody: string; staleStep1: string; staleStep2: string }
): Notice {
  const code = (error?.code ?? '').toUpperCase();
  const shortRef = reference ? reference.slice(0, 8).toUpperCase() : undefined;

  // Dicek sebelum cabang `MFA`: kode ini BUKAN tentang salah ketik kode, dan
  // mengirim kode benar ke tantangan yang sudah mati tetap menghasilkan 401.
  if (code.includes('CHALLENGE_STALE')) {
    return {
      title: copy.staleTitle,
      body: copy.staleBody,
      steps: [copy.staleStep1, copy.staleStep2],
      reference: shortRef,
    };
  }
  if (status === 429 || code.includes('RATE')) return rateLimitNotice(shortRef);
  if (code.includes('LOCK')) return lockedNotice(shortRef);
  if (code.includes('MFA') || code.includes('TOTP') || code.includes('OTP')) return mfaNotice(shortRef);
  if (code.includes('TENANT')) return tenantNotice(shortRef);
  if (code.includes('DISABLED') || code.includes('INACTIVE') || code.includes('SUSPEND')) return disabledNotice(shortRef);
  if (status >= 500 || code.includes('INTERNAL') || code.includes('CONFIG')) return { ...SERVICE_NOTICE, reference: shortRef };
  if (status === 401 || status === 403 || status === 422 || code.includes('CREDENTIAL') || code.includes('UNAUTHORIZED')) {
    return CREDENTIAL_NOTICE;
  }
  return { ...SERVICE_NOTICE, reference: shortRef };
}

function isCredentialField(key: unknown): key is CredentialField {
  return typeof key === 'string' && (CREDENTIAL_FIELDS as readonly string[]).includes(key);
}

/** Pakai pesan Zod dari kontrak (sudah Bahasa Indonesia) per kolom, tanpa menambah batas baru. */
function toFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (!isCredentialField(key)) continue;
    if (out[key]) continue;
    out[key] = issue.message.trim().length > 0 ? issue.message : FIELD_FALLBACK;
  }
  return out;
}

/** Kesalahan validasi dari server hanya dipakai untuk menunjuk kolom; teks server tidak ditampilkan. */
function detailsToFieldErrors(details: readonly ErrorDetail[] | undefined): FieldErrors {
  const out: FieldErrors = {};
  if (!details) return out;
  for (const detail of details) {
    if (detail.field === 'tenantIdentifier') out.tenantIdentifier = FIELD_FALLBACK;
    else if (detail.field === 'username') out.username = FIELD_FALLBACK;
    else if (detail.field === 'password') out.password = FIELD_FALLBACK;
  }
  return out;
}

function requestIdOf(payload: { readonly meta?: { readonly requestId?: string } } | undefined): string | undefined {
  const value = payload?.meta?.requestId;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Tujuan pasca-login dari `?redirect=…` (ditulis oleh middleware, nilainya hanya path).
 * Hanya path internal ber-whitelist; nilai mencurigakan (protokol, `//`, backslash,
 * karakter kontrol, fragmen) dibuang supaya tidak menjadi open redirect, dan parameter
 * yang berkamuflase kredensial/credit tidak pernah ikut terbawa ke URL.
 */
function resolveDestination(raw: string | null): string {
  if (!raw) return DEFAULT_DESTINATION;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_DESTINATION;
  if (value.includes('\\') || /[\s\p{Cc}]/u.test(value)) return DEFAULT_DESTINATION;
  if (value.includes('%2f') || value.includes('%2F') || value.includes('#')) return DEFAULT_DESTINATION;

  const path = value.split('?')[0] ?? '';
  if (!ALLOWED_DESTINATIONS.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) {
    return DEFAULT_DESTINATION;
  }
  const query = value.slice(path.length + 1);
  if (query.length === 0 || !query.includes('=')) return path;

  const safeParams = query.split('&').filter((pair) => pair.includes('=') && !CREDENTIAL_PARAM.test(pair.split('=')[0] ?? ''));
  return safeParams.length > 0 ? `${path}?${safeParams.join('&')}` : path;
}

function describedBy(...parts: (string | boolean | undefined)[]): string | undefined {
  const list = parts.filter((part): part is string => typeof part === 'string' && part.length > 0);
  return list.length > 0 ? list.join(' ') : undefined;
}

const Hint = ({ id, text }: { readonly id: string; readonly text: string }) => (
  <p id={id} className="field-hint">
    {text}
  </p>
);

const ErrorText = ({ id, text }: { readonly id: string; readonly text: string | undefined }) =>
  text ? (
    <p id={id} className="field-error" role="alert">
      {text}
    </p>
  ) : null;

export function LoginForm({ tenantSlug = '' }: LoginFormProps) {
  const searchParams = useSearchParams();
  const authCopy = getDictionary('id').auth;

  const [tenantIdentifier, setTenantIdentifier] = useState(tenantSlug);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState(false);

  const [isMfaStep, setIsMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState<string | undefined>(undefined);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resetDialogRef = useRef<HTMLDialogElement | null>(null);

  /** Penjaga double-submit: state React belum tentu tersetel saat Enter ditekan dua kali. */
  const inFlight = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destination = resolveDestination(searchParams.get('redirect'));

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    [],
  );

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    if (isResetDialogOpen && !dialog.open) dialog.showModal();
    else if (!isResetDialogOpen && dialog.open) dialog.close();
  }, [isResetDialogOpen]);

  function begin(): boolean {
    if (inFlight.current) return false;
    inFlight.current = true;
    setIsSubmitting(true);
    setNotice(null);
    return true;
  }

  function finish(): void {
    inFlight.current = false;
    setIsSubmitting(false);
  }

  function closeResetDialog(): void {
    setIsResetDialogOpen(false);
    setResetNotice(false);
  }

  function handleResetRequest(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setResetNotice(true);
  }

  function completeSession(message: string): void {
    // Sesi dipakai lewat cookie httpOnly yang disetel rute API; accessToken/refreshToken
    // di body JSON sengaja tidak pernah dibaca, disimpan, atau ditampilkan di URL.
    toast.success(message);
    redirectTimer.current = setTimeout(() => {
      // Navigasi DOKUMEN, bukan `router.push`: pohon klien halaman masuk dibangun saat
      // sesi belum ada (grup `(auth)` di-prerender statis), jadi navigasi klien dapat
      // melayani segmen `(dashboard)` dari cache tanpa cookie baru dan pengguna tetap
      // berdiri di `/login` setelah "Berhasil masuk". Muat ulang dokumen memaksa server
      // merender ulang dengan `Set-Cookie` yang sudah tersimpan.
      window.location.assign(destination);
    }, 600);
  }

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErrors({});

    // Batas minimum sengaja longgar: ikut `LoginRequestSchema` (8 karakter).
    // Kebijakan 12 karakter (SECURITY_COMPLIANCE §2.1) ditegakkan saat membuat /
    // mengganti sandi, bukan di sini — menaikkan batas akan mengunci akun warisan.
    const parsed = LoginRequestSchema.safeParse({
      tenantIdentifier: tenantIdentifier.trim(),
      username: username.trim(),
      password,
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    if (!begin()) return;

    let holdPending = false;
    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as LoginResponseEnvelope | ErrorEnvelope;

      if (!response.ok || payload.success !== true) {
        const error = payload.success === false ? payload.error : undefined;
        const fieldErrors = detailsToFieldErrors(error?.details);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        setNotice(
          describeFailure(response.status, error, requestIdOf(payload), {
            staleTitle: authCopy.staleTitle,
            staleBody: authCopy.staleBody,
            staleStep1: authCopy.staleStep1,
            staleStep2: authCopy.staleStep2,
          })
        );
        return;
      }

      const data = payload.data;
      if (data.requireMfa && data.mfaToken) {
        setIsMfaStep(true);
        setMfaToken(data.mfaToken);
        setTotpCode('');
        setTotpError(undefined);
        return;
      }

      completeSession('Login berhasil! Mengalihkan ke portal...');
      holdPending = true;
    } catch {
      setNotice(NETWORK_NOTICE);
    } finally {
      if (!holdPending) finish();
    }
  }

  async function handleMfaSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setTotpError(undefined);

    const parsed = MfaVerifyRequestSchema.safeParse({ mfaToken, totpCode });
    if (!parsed.success) {
      const codeIssue = parsed.error.issues.find((issue) => issue.path[0] === 'totpCode');
      if (codeIssue) {
        setTotpError(codeIssue.message.trim().length > 0 ? codeIssue.message : FIELD_FALLBACK);
        return;
      }
      // Token challenge hilang/kedaluwarsa: mulai ulang, jangan pernah kirim token kosong.
      backToCredentials();
      setNotice(mfaNotice(undefined));
      return;
    }
    if (!begin()) return;

    let holdPending = false;
    try {
      const response = await fetch(MFA_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as MfaVerifyResponseEnvelope | ErrorEnvelope;

      if (!response.ok || payload.success !== true) {
        const error = payload.success === false ? payload.error : undefined;
        const code = (error?.code ?? '').toUpperCase();
        if (code.includes('MFA') || code.includes('OTP') || code.includes('TOTP')) {
          setTotpError('Kode tersebut tidak cocok. Gunakan kode terbaru.');
        }
        setNotice(
          describeFailure(response.status, error, requestIdOf(payload), {
            staleTitle: authCopy.staleTitle,
            staleBody: authCopy.staleBody,
            staleStep1: authCopy.staleStep1,
            staleStep2: authCopy.staleStep2,
          })
        );
        return;
      }

      completeSession('Berhasil masuk. Membuka portal...');
      holdPending = true;
    } catch {
      setNotice(NETWORK_NOTICE);
    } finally {
      if (!holdPending) finish();
    }
  }

  function backToCredentials(): void {
    setIsMfaStep(false);
    setMfaToken('');
    setTotpCode('');
    setTotpError(undefined);
    setNotice(null);
    setErrors({});
  }

  const tenantError = errors.tenantIdentifier;
  const usernameError = errors.username;
  const passwordError = errors.password;

  return (
    <section aria-busy={isSubmitting} className="card animate-scale-in motion-reduce:animate-none">
      <div className="card-body">
        <header className="flex flex-col gap-1.5">
          <p className="section-label text-slate-600">{authCopy.portalEyebrow}</p>
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-tightest text-[color:var(--sica-text-heading)]">
            {isMfaStep ? authCopy.mfaRequired : authCopy.loginTitle}
          </h1>
          <p className="text-sm leading-relaxed2 text-[color:var(--sica-text-muted)]">{authCopy.loginSubtitle}</p>
        </header>

      <div className="mt-5 flex flex-col gap-5">
        {notice ? (
          <Alert tone="danger" title={notice.title} className="animate-scale-in motion-reduce:animate-none">
            <p>{notice.body}</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              {notice.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            {notice.reference ? (
              <p className="mt-2 text-xs text-slate-600">
                Kode laporan: <span className="font-mono tabular">{notice.reference}</span>
              </p>
            ) : null}
          </Alert>
        ) : null}

        {isMfaStep ? (
          <Alert tone="info" title="Mengapa kode ini diperlukan?">
            <p>Kampus meminta pemeriksaan tambahan untuk melindungi akun Anda. Kode berlaku selama 30 detik.</p>
          </Alert>
        ) : null}

        {isMfaStep ? (
          <form onSubmit={handleMfaSubmit} noValidate className="flex flex-col gap-5">
              <Field label={authCopy.otpLabel} htmlFor={IDS.totp} required>
                <Input
                  id={IDS.totp}
                  name="totpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ''))}
                  placeholder={authCopy.otpPlaceholder}
                  aria-required
                  aria-invalid={totpError ? true : undefined}
                  aria-describedby={describedBy(`${IDS.totp}-hint`, totpError ? `${IDS.totp}-error` : false)}
                  className="text-center font-mono text-xl tracking-[0.3em]"
                />
                <Hint id={`${IDS.totp}-hint`} text={authCopy.mfaInstruction} />
                <ErrorText id={`${IDS.totp}-error`} text={totpError} />
              </Field>

              <div className="flex flex-col gap-2">
                <Button type="submit" variant="default" size="lg" block disabled={isSubmitting || totpCode.length !== 6} aria-busy={isSubmitting}>
                  {isSubmitting ? (
                    <i className="ri-loader-4-line animate-spin text-base motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <i className="ri-shield-check-line text-base" aria-hidden />
                  )}
                  <span>{isSubmitting ? authCopy.verifying : authCopy.verifyOtp}</span>
                </Button>
                {isSubmitting ? <Skeleton className="h-1 w-full rounded-full" /> : null}
              </div>

              <Button type="button" variant="ghost" size="lg" block onClick={backToCredentials}>
                {authCopy.backToLogin}
              </Button>
          </form>
        ) : (
          <>
            <form onSubmit={handleLoginSubmit} noValidate className="flex flex-col gap-5">
              <Field label={authCopy.tenantLabel} htmlFor={IDS.tenant} required>
                <Input
                  id={IDS.tenant}
                  name="tenantIdentifier"
                  type="text"
                  autoComplete="organization"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={64}
                  value={tenantIdentifier}
                  onChange={(event) => setTenantIdentifier(event.target.value)}
                  placeholder={authCopy.tenantPlaceholder}
                  startIcon={<i className="ri-bank-line text-base" aria-hidden />}
                  aria-required
                  aria-invalid={tenantError ? true : undefined}
                  aria-describedby={describedBy(tenantError ? `${IDS.tenant}-error` : false)}
                />
                <ErrorText id={`${IDS.tenant}-error`} text={tenantError} />
              </Field>

              <Field label={authCopy.usernameLabel} htmlFor={IDS.username} required>
                <Input
                  id={IDS.username}
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={100}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={authCopy.usernamePlaceholder}
                  startIcon={<i className="ri-user-line text-base" aria-hidden />}
                  aria-required
                  aria-invalid={usernameError ? true : undefined}
                  aria-describedby={describedBy(usernameError ? `${IDS.username}-error` : false)}
                />
                <ErrorText id={`${IDS.username}-error`} text={usernameError} />
              </Field>

              {/* Velzon menaruh "lupa sandi?" sebaris dengan label, bukan di bawah form. */}
              <div className="auth-field-head">
                <label htmlFor={IDS.password} className="field-label mb-0">
                  {authCopy.passwordLabel}
                  <span className="ml-0.5 text-danger">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail('');
                    setResetNotice(false);
                    setIsResetDialogOpen(true);
                  }}
                  className="auth-field-link min-h-11 rounded-md px-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                >
                  {authCopy.forgotPassword}
                </button>
              </div>

              <Field htmlFor={IDS.password} required>
                <div className="relative">
                  <Input
                    id={IDS.password}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={authCopy.passwordPlaceholder}
                    startIcon={<i className="ri-lock-line text-base" aria-hidden />}
                    className="[&>input]:pr-11"
                    aria-required
                    aria-invalid={passwordError ? true : undefined}
                    aria-describedby={describedBy(passwordError ? `${IDS.password}-error` : false)}
                  />
                  {/* Kontrol tampilan sandi: status dibaca dari aria-pressed, tidak pernah menulis URL. */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? authCopy.hidePassword : authCopy.showPassword}
                    aria-pressed={showPassword}
                    className="absolute right-1 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-[color:var(--sica-text-muted)] transition-colors hover:bg-slate-100/70 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                  >
                    <i className={showPassword ? 'ri-eye-off-line text-lg' : 'ri-eye-line text-lg'} aria-hidden />
                  </button>
                </div>
                <ErrorText id={`${IDS.password}-error`} text={passwordError} />
              </Field>

              <div className="flex flex-col gap-2">
                <Button type="submit" variant="default" size="lg" block disabled={isSubmitting} aria-busy={isSubmitting}>
                  {isSubmitting ? (
                    <i className="ri-loader-4-line animate-spin text-base motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <i className="ri-arrow-right-line text-base" aria-hidden />
                  )}
                  <span>{isSubmitting ? authCopy.loggingIn : authCopy.loginButton}</span>
                </Button>

                {isSubmitting ? (
                  <>
                    <Skeleton className="h-1 w-full rounded-full" />
                    <p className="sr-only" role="status">
                      Sedang memeriksa akun Anda…
                    </p>
                  </>
                ) : null}
              </div>
            </form>
          </>
        )}
      </div>

      <dialog
        ref={resetDialogRef}
        aria-labelledby="reset-password-title"
        aria-describedby="reset-password-description"
        onClose={closeResetDialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeResetDialog();
        }}
        className="auth-reset-dialog elevated-panel m-auto w-[calc(100%-2rem)] max-w-md p-0 text-[color:var(--sica-text-body)] backdrop:bg-slate-950/40"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--sica-divider)] px-6 py-5">
          <div>
            <h2 id="reset-password-title" className="text-base font-semibold text-[color:var(--sica-text-heading)]">
              {authCopy.resetPassword.title}
            </h2>
            <p id="reset-password-description" className="mt-1 text-sm leading-relaxed text-[color:var(--sica-text-body)]">
              {authCopy.resetPassword.description}
            </p>
          </div>
          <button
            type="button"
            onClick={closeResetDialog}
            aria-label={authCopy.resetPassword.close}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[color:var(--sica-text-muted)] transition-colors hover:bg-sica-inset hover:text-[color:var(--sica-text-heading)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            <i className="ri-close-line text-xl" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleResetRequest} className="flex flex-col gap-5 p-6">
          <Field label={authCopy.resetPassword.emailLabel} htmlFor="sica-reset-email" required>
            <Input
              id="sica-reset-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              autoFocus
              value={resetEmail}
              onChange={(event) => {
                setResetEmail(event.target.value);
                setResetNotice(false);
              }}
              placeholder={authCopy.resetPassword.emailPlaceholder}
            />
          </Field>
          {resetNotice ? (
            <p role="status" aria-live="polite" className="rounded-lg bg-sica-inset px-3 py-2 text-sm leading-relaxed text-slate-600">
              {authCopy.resetPassword.notConnected}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" size="lg" onClick={closeResetDialog}>
              {authCopy.resetPassword.cancel}
            </Button>
            <Button type="submit" variant="default" size="lg">
              {authCopy.resetPassword.send}
            </Button>
          </div>
        </form>
      </dialog>
      </div>
    </section>
  );
}
