import React from 'react';

interface MockStat {
  label: string;
  value: string;
  tone: string;
}

/** Pratinjau produk (bukan data nyata) untuk hero landing page. */
export function HeroMockup({
  caption,
  periodLabel,
  stats,
  scheduleTitle,
  schedule,
}: {
  caption: string;
  periodLabel: string;
  stats: MockStat[];
  scheduleTitle: string;
  schedule: Array<{ time: string; course: string; room: string; status: string; tone: string }>;
}) {
  return (
    <figure className="relative mx-auto mt-14 w-full max-w-5xl">
      <div className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-tr from-velzon-primary/15 via-velzon-info/10 to-velzon-success/15 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-velzon-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-velzon-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-velzon-success/70" />
          <div className="ml-3 flex-1 truncate rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-400">
            sica.ac.id/dashboard
          </div>
          <span className="hidden rounded-full bg-velzon-primary-light px-2.5 py-1 text-[10px] font-semibold text-velzon-primary sm:inline">
            {periodLabel}
          </span>
        </div>

        <div className="bg-sica-canvas p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-medium text-slate-500">{s.label}</div>
                <div className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{s.value}</div>
                <div className={`mt-1 text-[10px] font-semibold ${s.tone}`}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-slate-900">{scheduleTitle}</div>
              <div className="text-[11px] font-medium text-velzon-primary">Lihat semua</div>
            </div>
            <div className="grid gap-2">
              {schedule.map((row) => (
                <div key={row.course} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-slate-800">{row.course}</div>
                    <div className="text-[11px] text-slate-500">
                      {row.time} · {row.room}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${row.tone}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-slate-500">{caption}</figcaption>
    </figure>
  );
}
