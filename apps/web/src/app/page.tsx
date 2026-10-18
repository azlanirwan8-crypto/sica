'use client';

import React from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Calculator,
  Database,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const features = [
    {
      icon: <Layers className="h-6 w-6 text-velzon-primary" />,
      title: 'Siklus KRS Online Sevima Benchmark',
      description:
        'Validasi kuota SKS berbasis IPS semester lalu, prasyarat matakuliah bersyarat (taken/passed/co-requisite), dan gerbang lunas tagihan UKT/SPP.',
    },
    {
      icon: <QrCode className="h-6 w-6 text-velzon-success" />,
      title: 'Presensi QR Dinamis & GPS Geofencing',
      description:
        'Presensi perkuliahan anti-titip absen dengan QR Code ber-TTL 30 detik dan validasi radius geofencing Haversine, dilengkapi batas kelayakan ujian 75%.',
    },
    {
      icon: <Calculator className="h-6 w-6 text-velzon-info" />,
      title: 'Buku Nilai & Auto Kalkulasi Mutu',
      description:
        'Input nilai komponen fleksibel (Tugas/UTS/UAS) berjumlah 100%, konversi huruf mutu per kurikulum, dan penerbitan KHS serta Transkrip resmi.',
    },
    {
      icon: <Database className="h-6 w-6 text-velzon-warning" />,
      title: 'Kesiapan Sinkronisasi PDDIKTI Feeder',
      description:
        'Skema data master dan operasional dirancang 100% kompatibel dengan API Neo Feeder PDDIKTI untuk pelaporan berkala tanpa kendala penolakan format.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-velzon-primary selection:text-white">
      {/* Top Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-velzon-primary text-white font-bold shadow-md shadow-velzon-primary/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">SICA</span>
              <span className="text-[11px] text-slate-500 font-medium block -mt-1">Academic Cloud</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="default" className="bg-velzon-primary hover:bg-velzon-primary-hover text-white text-xs h-9 font-medium px-4">
                <span>Masuk Portal</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-20 pb-20 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-velzon-primary text-xs font-semibold mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              <span>SaaS Enterprise Akademik Kampus Indonesia</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Sistem Informasi Akademik <br className="hidden sm:inline" />
              <span className="text-velzon-primary">Modern, Andal, & Terintegrasi</span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              Platform all-in-one perguruan tinggi dengan arsitektur multi-tenant PostgreSQL Row-Level Security (RLS). 
              Menjamin kelancaran hari Open Wiring (KRS), presensi presisi tinggi, dan kepatuhan penuh regulasi nasional Dikti.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" className="bg-velzon-primary hover:bg-velzon-primary-hover text-white shadow-lg shadow-velzon-primary/25 h-12 px-8 text-sm font-semibold">
                  <span>Buka Portal Akademik</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/academic/krs">
                <Button size="lg" variant="outline" className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 h-12 px-6 text-sm font-semibold">
                  <span>Simulasi KRS Online</span>
                  <ExternalLink className="h-4 w-4 ml-2 text-slate-400" />
                </Button>
              </Link>
            </div>

            {/* Compliance Badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-velzon-success" />
                <span>Permendiktisaintek No. 39/2025</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-velzon-success" />
                <span>Standar SIAKAD Sevima Benchmark</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-velzon-primary" />
                <span>Zero-Trust RLS Tenant Isolation</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="py-16 bg-white border-y border-slate-200 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Fitur Unggulan Berstandar Sevima Benchmark
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Seluruh alur bisnis dirancang sesuai siklus operasional resmi kampus Indonesia dari registrasi awal hingga yudisium.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="mb-4 inline-flex p-3 rounded-xl bg-white shadow-sm border border-slate-100">
                      {feature.icon}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">SICA Enterprise</span> — System Integration Central Akademik.
          </div>
          <div>
            © 2026 PT SICA Solusi Akademik Indonesia. Hak Cipta Dilindungi Undang-Undang.
          </div>
        </div>
      </footer>
    </div>
  );
}
