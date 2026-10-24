'use client';

import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { VelzonChart } from '@/components/ui/velzon-chart';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export type MockTone = NonNullable<BadgeProps['tone']>;

export interface MockStat {
  readonly label: string;
  readonly value: string;
  /** Nada badge/progress — nama tone Velzon, bukan kelas warna. */
  readonly tone: MockTone;
  /** 0–100; bila diisi, kartu menampilkan Progress (bukan blok warna). */
  readonly progress?: number;
  /** Teks kecil penjelas bila kartu tidak memakai Progress. */
  readonly caption?: string;
}

export interface MockTrend {
  readonly title: string;
  readonly seriesName: string;
  readonly points: readonly { readonly label: string; readonly value: number }[];
}

export interface MockScheduleRow {
  readonly time: string;
  readonly course: string;
  readonly room: string;
  readonly status: string;
  readonly tone: MockTone;
}

const PROGRESS_TONE = {
  primary: 'primary',
  success: 'success',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  secondary: 'secondary',
  neutral: 'primary',
} as const satisfies Record<MockTone, 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'secondary'>;

/**
 * Pratinjau produk (bukan data nyata) untuk hero landing page.
 *
 * Modul ini ber-`'use client'` karena `valueFormat` chart berupa fungsi —
 * fungsi tidak boleh diserialisasi dari Server Component ke Client Component.
 */
export function HeroMockup({
  caption,
  periodLabel,
  stats,
  trend,
  scheduleTitle,
  schedule,
}: {
  caption: string;
  periodLabel: string;
  stats: readonly MockStat[];
  trend: MockTrend;
  scheduleTitle: string;
  schedule: readonly MockScheduleRow[];
}) {
  return (
    <figure className="relative mx-auto w-full max-w-5xl">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-tr from-primary/15 via-info/10 to-success/15 blur-2xl"
      />

      <div className="sica-drift overflow-hidden rounded-2xl border hairline bg-sica-card shadow-modal">
        {/* ── Chrome jendela peramban ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b hairline bg-slate-50/80 px-4 py-2.5">
          <span aria-hidden className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </span>
          <div className="ml-2 flex-1 truncate rounded-md border hairline bg-sica-inset px-3 py-1 text-[11px] tabular text-slate-500">
            SICA · pratinjau
          </div>
          <Badge look="label" tone="warning" size="sm">
            {periodLabel}
          </Badge>
        </div>

        {/* ── Isi dasbor ──────────────────────────────────────────────────── */}
        <div className="space-y-4 bg-sica-canvas p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="card p-4">
                <p className="section-label">{s.label}</p>
                <p className="mt-2 text-xl font-semibold leading-none tracking-tightest tabular text-[color:var(--sica-text-heading)]">
                  {s.value}
                </p>
                {typeof s.progress === 'number' ? (
                  <Progress
                    value={s.progress}
                    size="sm"
                    tone={PROGRESS_TONE[s.tone]}
                    label={s.label}
                    className="mt-3"
                  />
                ) : s.caption ? (
                  <p className="mt-3 text-[11px] text-slate-500">{s.caption}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <p className="card-title">{trend.title}</p>
              <Badge tone="primary" size="sm">
                {trend.seriesName}
              </Badge>
            </div>
            <div className="card-body pt-4">
              <VelzonChart
                series={[{ name: trend.seriesName, points: trend.points }]}
                height={136}
                yTicks={3}
                legend={false}
                grid
                area
                tooltip
                valueFormat={(value) => value.toFixed(2)}
              />
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="card-header">
              <p className="card-title">{scheduleTitle}</p>
              <span className="text-[11px] font-semibold text-primary-hover">Lihat semua</span>
            </div>
            <Table className="text-[12.5px]">
              <THead>
                <TH>Waktu</TH>
                <TH>Mata Kuliah</TH>
                <TH className="hidden sm:table-cell">Ruang</TH>
                <TH align="right">Status</TH>
              </THead>
              <TBody>
                {schedule.map((row) => (
                  <TR key={`${row.course}-${row.time}`}>
                    <TD className="whitespace-nowrap py-3 tabular text-slate-500">{row.time}</TD>
                    <TD className="py-3 font-semibold text-[color:var(--sica-text-heading)]">{row.course}</TD>
                    <TD className="hidden py-3 text-slate-500 sm:table-cell">{row.room}</TD>
                    <TD className="py-3 text-right">
                      <Badge tone={row.tone} dot size="sm" className="whitespace-nowrap">
                        {row.status}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-center text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}
