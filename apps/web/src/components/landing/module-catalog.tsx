'use client';

import React, { useMemo, useState } from 'react';
import {
  Fingerprint,
  GraduationCap,
  KeyRound,
  Landmark,
  LayoutGrid,
  LineChart,
  Lock,
  MessagesSquare,
  Presentation,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { Reveal } from './motion';

export type CatalogRole = 'mahasiswa' | 'dosen' | 'baak' | 'pimpinan' | 'ortu';

export interface CatalogModule {
  readonly code: string;
  readonly name: string;
  readonly category: string;
  readonly license: string;
  readonly roles: readonly string[];
  readonly desc: string;
  readonly depends?: readonly string[];
}

export interface CatalogCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly allRoles: string;
  readonly coreTab: string;
  readonly addonTab: string;
  readonly allTab: string;
  readonly rolesLabel: string;
  readonly dependsLabel: string;
  readonly licenseLabel: string;
  readonly empty: string;
  readonly coreLabel: string;
  readonly addonLabel: string;
  readonly roles: Record<string, string>;
  readonly license: Record<string, string>;
  readonly items: readonly CatalogModule[];
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  identity: Users,
  academic: GraduationCap,
  teaching: LayoutGrid,
  enrollment: Workflow,
  attendance: ShieldCheck,
  assessment: LineChart,
  finance: Wallet,
  feeder_pddikti: ScrollText,
  audit: Lock,
  pmb: UserCog,
  cbt: MessagesSquare,
  lms: Presentation,
  mbkm: Landmark,
  thesis: GraduationCap,
  spmi: KeyRound,
  hr_bkd: Users,
  parent_portal: Fingerprint,
  graduation: Presentation,
  tracer_iku: LineChart,
};

const ROLE_ORDER: CatalogRole[] = ['mahasiswa', 'dosen', 'baak', 'pimpinan', 'ortu'];

/**
 * Katalog 19 modul (9 inti + 10 tambahan) yang dapat disaring per peran dan
 * kategori — nilai jual utama: seluruh siklus kampus terpetakan, bukan segelintir menu.
 */
export function ModuleCatalog({ copy }: { copy: CatalogCopy }) {
  const [role, setRole] = useState<CatalogRole | 'all'>('all');
  const [cat, setCat] = useState<'all' | 'CORE' | 'ADDON'>('all');

  const nameByCode = useMemo(
    () => new Map(copy.items.map((m) => [m.code, m.name])),
    [copy.items]
  );

  const filtered = useMemo(
    () =>
      copy.items.filter(
        (m) => (role === 'all' || m.roles.includes(role)) && (cat === 'all' || m.category === cat)
      ),
    [copy.items, role, cat]
  );

  const coreCount = copy.items.filter((m) => m.category === 'CORE').length;
  const addonCount = copy.items.length - coreCount;

  return (
    <div>
      {/* Counter + filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Saring berdasarkan peran">
          <FilterChip active={role === 'all'} onClick={() => setRole('all')}>
            {copy.allRoles}
            <Count>{copy.items.length}</Count>
          </FilterChip>
          {ROLE_ORDER.map((r) => (
            <FilterChip key={r} active={role === r} onClick={() => setRole(r)}>
              {copy.roles[r]}
              <Count>{copy.items.filter((m) => m.roles.includes(r)).length}</Count>
            </FilterChip>
          ))}
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-slate-200 bg-slate-50 p-1 lg:self-auto"
          role="group"
          aria-label="Saring berdasarkan kategori"
        >
          <SegChip active={cat === 'all'} onClick={() => setCat('all')}>{copy.allTab}</SegChip>
          <SegChip active={cat === 'CORE'} onClick={() => setCat('CORE')}>{copy.coreTab} ({coreCount})</SegChip>
          <SegChip active={cat === 'ADDON'} onClick={() => setCat('ADDON')}>{copy.addonTab} ({addonCount})</SegChip>
        </div>
      </div>

      {/* Grid modul */}
      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-sm text-slate-500">{copy.empty}</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => {
            const Icon = MODULE_ICONS[m.code] ?? GraduationCap;
            const isCore = m.category === 'CORE';
            return (
              <Reveal key={m.code} delay={(i % 3) * 70}>
                <article className="sica-lift flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 hover:border-velzon-primary/30 hover:shadow-xl hover:shadow-slate-900/5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                        isCore ? 'bg-velzon-primary-light text-velzon-primary' : 'bg-velzon-success/10 text-velzon-success'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        isCore ? 'bg-velzon-primary/10 text-velzon-primary' : 'bg-velzon-success/10 text-velzon-success'
                      }`}
                    >
                      {isCore ? copy.coreLabel : copy.addonLabel}
                    </span>
                  </div>

                  <h3 className="mt-4 text-[15px] font-bold text-slate-900">{m.name}</h3>
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-600">{m.desc}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {m.roles.map((r) => (
                      <span key={r} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                        {copy.roles[r]}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                    <span className="text-slate-400">
                      {copy.licenseLabel}: <span className="font-medium text-slate-600">{copy.license[m.license]}</span>
                    </span>
                    {m.depends && m.depends.length > 0 && (
                      <span className="text-slate-400" title={m.depends.map((d) => nameByCode.get(d) ?? d).join(', ')}>
                        {copy.dependsLabel} {m.depends.length}
                      </span>
                    )}
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-slate-200/70 px-1 text-[10px] font-bold text-slate-600">
      {children}
    </span>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
        active
          ? 'bg-velzon-primary text-white shadow-sm shadow-velzon-primary/25'
          : 'border border-slate-200 bg-white text-slate-600 hover:border-velzon-primary/40 hover:text-velzon-primary'
      }`}
    >
      {children}
    </button>
  );
}

function SegChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? 'bg-white text-velzon-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
