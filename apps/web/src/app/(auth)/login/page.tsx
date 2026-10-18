'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, BadgeCheck, CalendarCheck, Gauge } from 'lucide-react';
import { LoginForm } from '@/modules/auth/components/login-form';
import { LoginShowcase } from '@/components/auth/login-showcase';
import { SicaBrand } from '@/components/brand/sica-brand';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* ── Panel kiri: showcase produk (dark) ── */}
      <aside className="relative hidden w-[54%] shrink-0 overflow-hidden bg-gradient-to-br from-[#0b1b3a] via-[#132a5c] to-[#0a1730] text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-velzon-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-velzon-info/20 blur-3xl" />

        <div className="relative z-10 flex h-full flex-col px-12 py-10 xl:px-16">
          <div className="shrink-0">
            <Link href="/" aria-label="SICA">
              <SicaBrand height={38} variant="dark" />
            </Link>
          </div>

          {/* Ilustrasi: pusat ruang tersisa; menyusut aman saat tinggi berubah */}
          <div className="flex min-h-0 flex-1 items-center justify-center py-10">
            <LoginShowcase />
          </div>

          <div className="shrink-0">
            <h1 className="max-w-md text-[24px] font-extrabold leading-tight tracking-tight text-white xl:text-[28px]">
              Pengelolaan Akademik Kampus Modern &amp; Terintegrasi PDDIKTI
            </h1>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              <TrustBadge icon={<ShieldCheck className="h-4 w-4 text-velzon-success" />} title="ISO 27001" sub="Certified" />
              <TrustBadge icon={<BadgeCheck className="h-4 w-4 text-velzon-info" />} title="Permendikbudristek" sub="No. 39/2025" />
              <TrustBadge icon={<Gauge className="h-4 w-4 text-velzon-warning" />} title="SLA 99,9%" sub="Uptime" />
            </div>
          </div>
        </div>
      </aside>

      {/* ── Panel kanan: form login (light) ── */}
      <main className="relative flex w-full flex-col bg-white lg:w-[46%]">
        <div className="flex items-center justify-between px-6 py-6 sm:px-10">
          <Link href="/" aria-label="SICA" className="lg:hidden">
            <SicaBrand height={32} />
          </Link>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-velzon-success" />
            Sistem Resmi Bersertifikasi ISO 27001
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-8 sm:px-10">
          <div className="w-full max-w-md">
            <LoginForm tenantSlug="demo" />
          </div>
        </div>

        <footer className="px-6 pb-8 text-center text-[11px] leading-relaxed text-slate-400 sm:px-10">
          <p className="flex items-center justify-center gap-1.5">
            <CalendarCheck className="h-3 w-3" />
            © 2026 SICA (System Integration Central Academic). Hak Cipta Dilindungi Undang-Undang.
          </p>
          <p className="mt-1 text-slate-400/80">
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
        <span className="block text-[12.5px] font-bold text-white">{title}</span>
        <span className="block text-[11px] text-slate-300">{sub}</span>
      </span>
    </div>
  );
}
