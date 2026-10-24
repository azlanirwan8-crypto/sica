'use client';

import React, { useRef } from 'react';
import { BookOpen, CalendarCheck, QrCode, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Ilustrasi produk untuk panel kiri login (ala "cover" Velzon).
 * Kartu dashboard memberi tinggi intrinsik; kartu melayang absolut RELATIF ke kartu
 * itu (tidak collapse/terpotong saat zoom).
 *
 * Disiplin warna: tidak ada hexa & tidak ada lapisan putih keras. Semua permukaan
 * dibaca dari token (`--sica-*`, `primary/*`, `slate-*`) sehingga ilustrasi ikut
 * theme-sadar — `data-bs-theme` membalik kanal `slate` & permukaan, sedangkan warna
 * merek (`secondary`, `primary`) sengaja stabil sebagai kanvas.
 *
 * Efek: kartu melayang ber-parallax mengikuti kursor (via CSS var --mx/--my),
 * nonaktif otomatis bila pengguna memilih `prefers-reduced-motion: reduce`.
 * Seluruh isi ini dekoratif murni → `aria-hidden` di root, data angkanya fiktif.
 */

export type LoginShowcaseVariant = 'full' | 'compact';

/** Style parallax: geser kartu sejauh (dx, dy) px mengikuti posisi kursor (-1..1). */
function float(dx: number, dy: number): React.CSSProperties {
  return {
    transform: `translate3d(calc(var(--mx, 0) * ${dx}px), calc(var(--my, 0) * ${dy}px), 0)`,
    transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: 'transform',
  };
}

const INK_HEADING = 'text-[color:var(--sica-text-heading)]';
const INK_MUTED = 'text-slate-500';

export function LoginShowcase({ variant = 'full' }: { readonly variant?: LoginShowcaseVariant }) {
  const ref = useRef<HTMLDivElement>(null);
  const compact = variant === 'compact';

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.setProperty('--mx', mx.toFixed(3));
    el.style.setProperty('--my', my.toFixed(3));
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--mx', '0');
    el.style.setProperty('--my', '0');
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-hidden
      className={cn('relative mx-auto w-full', compact ? 'max-w-[300px]' : 'max-w-[460px]')}
    >
      {/* Bayangan dasar — memakai token backdrop, bukan hitam keras. */}
      <div className="absolute inset-x-8 bottom-0 h-8 rounded-full bg-sica-backdrop blur-2xl" />

      {/* Kartu dashboard (memberi tinggi) */}
      <div className="relative overflow-hidden rounded-xl bg-sica-card shadow-modal">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 border-b border-sica-border bg-sica-inset px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-danger" />
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="h-2 w-2 rounded-full bg-success" />
          <div className="ml-2 h-3.5 flex-1 rounded bg-slate-200/70" />
        </div>

        <div className="flex">
          {/* Sidebar mini */}
          <div
            className={cn(
              'flex shrink-0 flex-col items-center gap-3 border-r border-sica-border bg-slate-50/70 py-4',
              compact ? 'w-9 px-1' : 'w-14',
            )}
          >
            <div className="h-6 w-6 rounded-md bg-primary" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  'h-5 w-5 rounded-md',
                  i === 1 ? 'bg-primary/20 ring-1 ring-primary/40' : 'bg-slate-200',
                )}
              />
            ))}
          </div>

          {/* Konten */}
          <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-slate-300" />
              <div className="h-5 w-14 rounded-md bg-primary/90" />
            </div>

            {/* Donut + legenda */}
            <div className="flex items-center gap-3 rounded-lg border border-sica-border bg-sica-card p-3 shadow-sm">
              <div
                className="h-16 w-16 shrink-0 rounded-full"
                style={{
                  background:
                    'conic-gradient(var(--sica-chart-1) 0 45%, var(--sica-chart-2) 45% 70%, var(--sica-chart-3) 70% 88%, var(--sica-border-color) 88% 100%)',
                }}
              >
                <div className="grid h-full w-full place-items-center">
                  <div className="h-9 w-9 rounded-full bg-sica-card" />
                </div>
              </div>
              <div className="space-y-1.5">
                {[
                  { c: 'bg-primary', w: 'w-16' },
                  { c: 'bg-info', w: 'w-12' },
                  { c: 'bg-warning', w: 'w-10' },
                ].map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-sm', l.c)} />
                    <span className={cn('h-2 rounded bg-slate-200', l.w)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart */}
            <div className="rounded-lg border border-sica-border bg-sica-card p-3 shadow-sm">
              <div className="mb-2 h-2 w-14 rounded bg-slate-300" />
              <div className="flex h-14 items-end gap-1.5">
                {[45, 70, 55, 90, 60, 80, 50, 75, 65, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-primary/70 to-info/70"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Tabel mini */}
            <div className="overflow-hidden rounded-lg border border-sica-border bg-sica-card shadow-sm">
              <div className="flex gap-2 border-b border-sica-border bg-slate-50 px-3 py-1.5">
                <div className="h-2 w-8 rounded bg-slate-300" />
                <div className="h-2 w-12 rounded bg-slate-300" />
                <div className="ml-auto h-2 w-6 rounded bg-slate-300" />
              </div>
              {[0, 1, 2].map((r) => (
                <div key={r} className="flex items-center gap-2 border-b border-sica-divider px-3 py-1.5 last:border-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  <div className="h-2 w-14 rounded bg-slate-200" />
                  <div className="h-2 w-8 rounded bg-slate-200" />
                  <div className="ml-auto h-2 w-6 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Kartu melayang: IPK (kiri-atas) */}
      <div
        className={cn(
          'absolute top-8 w-36 rounded-xl border border-sica-border bg-sica-card p-3 shadow-raised',
          compact ? '-left-2 w-[8.5rem]' : '-left-6 sm:-left-10',
        )}
        style={float(16, 12)}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Star className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className={cn('block text-[10px] font-medium', INK_MUTED)}>IPK Kumulatif</span>
            <span className={cn('block text-base font-semibold tracking-tightest tabular', INK_HEADING)}>3,74</span>
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-[74%] rounded-full bg-gradient-to-r from-primary to-info" />
        </div>
      </div>

      {compact ? null : (
        <>
          {/* Kartu melayang: Aktivitas Belajar (kiri, di bawah IPK) */}
          <div
            className="absolute -left-6 top-32 w-32 rounded-xl border border-sica-border bg-sica-card p-3 shadow-raised sm:-left-9"
            style={float(10, 16)}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-info/10 text-info">
                <BookOpen className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className={cn('block text-[10px] font-medium', INK_MUTED)}>Aktivitas</span>
                <span className={cn('block text-base font-semibold tracking-tightest tabular', INK_HEADING)}>6 sesi</span>
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[62%] rounded-full bg-info" />
            </div>
          </div>

          {/* Kartu melayang: Kehadiran (kanan-bawah) */}
          <div
            className="absolute -right-5 bottom-16 w-32 rounded-xl border border-sica-border bg-sica-card p-3 shadow-raised sm:-right-8"
            style={float(-14, -10)}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                <Users className="h-4 w-4" />
              </span>
              <span className="leading-tight">
                <span className={cn('block text-[10px] font-medium', INK_MUTED)}>Kehadiran</span>
                <span className={cn('block text-base font-semibold tracking-tightest tabular', INK_HEADING)}>87,5%</span>
              </span>
            </div>
            <div className="mt-2 flex items-end gap-0.5">
              {[40, 65, 50, 80, 60, 72].map((h, i) => (
                <div key={i} className="w-1.5 rounded-sm bg-success/60" style={{ height: `${h * 0.28}px` }} />
              ))}
            </div>
          </div>

          {/* Ponsel pemindai QR (bawah-tengah, keluar tepi bawah) */}
          <div
            className="absolute -bottom-8 left-1/2 w-[92px] rounded-[1.3rem] border-[3px] border-secondary bg-secondary p-1.5 shadow-raised"
            style={{
              transform: 'translate3d(calc(-50% + var(--mx, 0) * 8px), calc(var(--my, 0) * 6px), 0)',
              transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
          >
            <div className="mx-auto mb-1 h-1 w-7 rounded-full bg-slate-400/50" />
            <div className="rounded-xl bg-sica-card p-2">
              <div className="mb-1 flex items-center gap-1">
                <QrCode className="h-2.5 w-2.5 text-primary" />
                <div className="h-1.5 w-8 rounded bg-slate-300" />
              </div>
              <div className="relative grid h-16 w-full place-items-center rounded-lg bg-slate-50">
                <div className="grid h-12 w-12 grid-cols-4 grid-rows-4 gap-0.5">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn('rounded-[1px]', [0, 1, 3, 4, 6, 9, 10, 12, 15].includes(i) ? 'bg-slate-400' : 'bg-transparent')}
                    />
                  ))}
                </div>
                <span className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_2px_rgb(var(--sica-rgb-primary)/0.45)]" />
              </div>
            </div>
          </div>

          {/* Chip kecil jadwal (kiri-bawah) */}
          <div
            className="absolute -left-4 bottom-2 flex items-center gap-1.5 rounded-lg border border-sica-border bg-sica-card px-2.5 py-1.5 shadow-raised"
            style={float(6, 6)}
          >
            <CalendarCheck className="h-3.5 w-3.5 text-info" />
            <span className={cn('text-[10px] font-semibold', 'text-[color:var(--sica-text-body)]')}>Jadwal Hari Ini</span>
          </div>
        </>
      )}
    </div>
  );
}
