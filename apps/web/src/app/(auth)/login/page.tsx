import React, { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/modules/auth/components/login-form';
import { Skeleton } from '@/components/ui/skeleton';
import { SicaBrand } from '@/components/brand/sica-brand';
import { getDictionary } from '@/lib/i18n';

/**
 * Kerangka `auth-signin-cover` Velzon (UI_UX_DESIGN §2.6): `.auth-fluid` dua kolom
 * dengan panel `.auth-fluid-sidebg` di kiri dan `.auth-fluid-content`
 * (logo → `.auth-content > .auth-inner > .card` → `.auth-fluid-footer`) di kanan.
 *
 * Kelasnya kerangka Velzon; isinya tetap pernyataan lingkup SICA — panel kiri
 * sengaja tidak menjual fitur yang belum ada.
 */
export default function LoginPage() {
  const t = getDictionary('id').auth;

  return (
    <div className="auth-fluid">
      <aside aria-label="Rencana layanan SICA" className="auth-fluid-sidebg">
        <div className="hidden lg:block">
          <Link href="/" aria-label="Kembali ke beranda SICA" className="auth-logo rounded-lg">
            <SicaBrand height={38} variant="dark" />
          </Link>
        </div>

        <div>
          <p className="auth-eyebrow">{t.scopeEyebrow}</p>
          <h2 className="auth-headline">{t.scopeTitle}</h2>
          <p className="auth-lede">{t.scopeDescription}</p>

          <div className="auth-stats">
            <div className="auth-stat">
              <p className="auth-stat-value">{t.scopeModuleCount}</p>
              <p className="auth-stat-label">{t.scopeModuleLabel}</p>
            </div>
            <div className="auth-stat">
              <p className="auth-stat-value">{t.scopeAppCount}</p>
              <p className="auth-stat-label">{t.scopeAppLabel}</p>
            </div>
          </div>

          <p className="auth-note">{t.scopeRegistryNote}</p>
        </div>
      </aside>

      <div className="auth-fluid-content">
        <div className="px-6 pt-6 sm:px-10 lg:hidden">
          <Link href="/" aria-label="Kembali ke beranda SICA" className="auth-logo rounded-lg">
            <SicaBrand height={34} />
          </Link>
        </div>

        <main className="auth-content">
          <div className="auth-inner">
            <Suspense fallback={<LoginCardSkeleton />}>
              <LoginForm />
            </Suspense>
          </div>
        </main>

        <footer className="auth-fluid-footer">
          <p>{t.publicFooter.replace('{year}', String(new Date().getFullYear()))}</p>
        </footer>
      </div>
    </div>
  );
}

/** Fallback selama `useSearchParams` di dalam form disuspensi — bentuknya disamakan dengan kartu aslinya. */
function LoginCardSkeleton() {
  return (
    <section className="card">
      <div className="card-body">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-6 w-44" />
        <Skeleton className="mt-2.5 h-3.5 w-56" />
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </section>
  );
}
