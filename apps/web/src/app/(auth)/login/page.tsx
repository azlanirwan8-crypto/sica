'use client';

import React from 'react';
import Link from 'next/link';
import { LoginForm } from '@/modules/auth/components/login-form';
import { GraduationCap, Shield } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-[#1b223c] via-[#2a3458] to-[#121626] text-white overflow-hidden">
      {/* Background Pattern Deco */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-velzon-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-velzon-secondary/20 blur-3xl pointer-events-none" />

      {/* Top Bar Branding */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-velzon-primary text-white font-bold shadow-lg shadow-velzon-primary/30 transition-transform group-hover:scale-105">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">SICA</span>
            <span className="text-xs block text-slate-400 font-medium -mt-1">Academic Cloud</span>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-300 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
          <Shield className="h-3.5 w-3.5 text-velzon-success" />
          <span>Sistem Resmi Bersertifikasi ISO 27001</span>
        </div>
      </header>

      {/* Main Center Auth Form */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <LoginForm tenantSlug="demo" />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-400">
        <p>© 2026 SICA (System Integration Central Akademik). Hak Cipta Dilindungi Undang-Undang.</p>
        <p className="mt-1 text-slate-500">
          Kepatuhan Permendiktisaintek No. 39/2025 & SN-Dikti • Terintegrasi Feeder PDDIKTI
        </p>
      </footer>
    </div>
  );
}
