'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, BadgeCheck, CalendarCheck, Gauge } from 'lucide-react';
import { LoginForm } from '@/modules/auth/components/login-form';
import { LoginShowcase } from '@/components/auth/login-showcase';
import { SicaBrand } from '@/components/brand/sica-brand';

export default function LoginPage() {
  return (
    <div className="flex h-screen max-h-screen w-full overflow-hidden">
      {/* ── Panel kiri (50%): showcase produk ── */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-velzon-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-velzon-info/20 blur-3xl" />

        <div className="relative z-10 shrink-0">
          <Link href="/" aria-label="SICA">
            <SicaBrand height={38} variant="dark" />
          </Link>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-6">
          <LoginShowcase />
        </div>

        <div className="relative z-10 shrink-0">
          <h1 className="max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-white lg:text-4xl">
            Pengelolaan Akademik Kampus Modern &amp; Terintegrasi PDDIKTI
          </h1>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            <TrustBadge icon={<ShieldCheck className="h-4 w-4 text-velzon-success" />} title="ISO 27001" sub="Certified" />
            <TrustBadge icon={<BadgeCheck className="h-4 w-4 text-velzon-info" />} title="Permendikbudristek" sub="No. 39/2025" />
            <TrustBadge icon={<Gauge className="h-4 w-4 text-velzon-warning" />} title="SLA 99,9%" sub="Uptime" />
          </div>
        </div>
      </aside>

      {/* ── Panel kanan (50%): form login ── */}
      <main className="flex w-full flex-col bg-slate-50/50 lg:w-1/2">
        <div className="px-8 pt-8 sm:px-12 lg:hidden">
          <Link href="/" aria-label="SICA">
            <SicaBrand height={32} />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-y-auto p-8 lg:p-12">
          <LoginForm tenantSlug="demo" />
        </div>

        <footer className="px-8 pb-6 pt-2 text-center text-xs font-medium text-slate-500 sm:px-12">
          <p className="flex items-center justify-center gap-1.5">
            <CalendarCheck className="h-3 w-3" />
            © 2026 SICA (System Integration Central Academic). Hak Cipta Dilindungi Undang-Undang.
          </p>
          <p className="mt-1">
            Kepatuhan Permendikbudristek No. 39/2025 &amp; SN-Dikti • Terintegrasi Feeder PDDIKTI
          </p>
        </footer>
      </main>
    </div>
  );
}

function TrustBadge({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[13px] font-bold text-white">{title}</span>
        <span className="block text-[11px] font-medium text-slate-300">{sub}</span>
      </span>
    </div>
  );
}
