import React from 'react';
import { Check, Minus, Sparkles } from 'lucide-react';
import { Reveal } from './motion';

export interface BenchmarkRow {
  readonly label: string;
  readonly cells: readonly string[];
}

export interface SevimaRow {
  readonly label: string;
  readonly status: string;
}

export interface BenchmarkCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly columns: readonly string[];
  readonly rows: readonly BenchmarkRow[];
  readonly sevimaTitle: string;
  readonly sevimaNote: string;
  readonly statusReady: string;
  readonly statusPartial: string;
  readonly statusRoadmap: string;
  readonly sevima: readonly SevimaRow[];
}

const STATUS_STYLE: Record<string, { pill: string; icon: React.ReactNode }> = {
  ready: { pill: 'bg-velzon-success/12 text-velzon-success', icon: <Check className="h-3 w-3" /> },
  partial: { pill: 'bg-velzon-warning/15 text-[#b57614]', icon: <Minus className="h-3 w-3" /> },
  roadmap: { pill: 'bg-slate-100 text-slate-500', icon: <span className="text-[9px] font-bold">•••</span> },
};

const FALLBACK_STATUS: { pill: string; icon: React.ReactNode } = {
  pill: 'bg-slate-100 text-slate-500',
  icon: <span className="text-[9px] font-bold">•••</span>,
};

/** Tabel benchmark: diferensiasi arsitektur + cakupan modul standar pasar. */
export function BenchmarkSection({ copy }: { copy: BenchmarkCopy }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      {/* Perbandingan diferensiator */}
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-5">&nbsp;</th>
                {copy.columns.map((col, i) => (
                  <th
                    key={col}
                    className={`px-3 py-3 text-center text-[12px] font-bold sm:px-4 ${
                      i === 2 ? 'bg-velzon-primary text-white' : 'text-slate-600'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copy.rows.map((row, ri) => (
                <tr key={row.label} className={ri % 2 ? 'bg-slate-50/40' : 'bg-white'}>
                  <td className="px-4 py-3.5 text-[13px] font-semibold text-slate-800 sm:px-5">{row.label}</td>
                  {row.cells.map((cell, ci) =>
                    ci === 2 ? (
                      <td key={ci} className="bg-velzon-primary/[0.06] px-3 py-3.5 text-center text-[12.5px] font-bold text-velzon-primary sm:px-4">
                        {cell}
                      </td>
                    ) : (
                      <td key={ci} className="px-3 py-3.5 text-center text-[12.5px] text-slate-500 sm:px-4">
                        {cell}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Cakupan modul standar pasar */}
      <Reveal delay={120}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-velzon-primary" />
            <h3 className="text-sm font-bold text-slate-900">{copy.sevimaTitle}</h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{copy.sevimaNote}</p>
          <ul className="mt-5 space-y-2.5">
            {copy.sevima.map((s) => {
              const st = STATUS_STYLE[s.status] ?? FALLBACK_STATUS;
              return (
                <li key={s.label} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-slate-700">{s.label}</span>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${st.pill}`}>
                    {st.icon}
                    {s.status === 'ready' ? copy.statusReady : s.status === 'partial' ? copy.statusPartial : copy.statusRoadmap}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}
