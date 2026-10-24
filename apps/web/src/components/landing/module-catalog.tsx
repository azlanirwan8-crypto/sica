'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CatalogModule {
  readonly code: string;
  readonly name: string;
  readonly displayName: string;
  readonly audience: string;
  readonly desc: string;
  readonly packageType: string;
}

export interface CatalogCopy {
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  readonly roleFilterLabel: string;
  readonly roleFilterAll: string;
  readonly packageFilterLabel: string;
  readonly packageFilters: {
    readonly all: string;
    readonly core: string;
    readonly addon: string;
    readonly role: string;
    readonly unmapped: string;
  };
  readonly audienceLabel: string;
  readonly packageLabels: {
    readonly core: string;
    readonly addon: string;
    readonly role: string;
    readonly unmapped: string;
  };
  readonly classificationNote: string;
  readonly resultLabel: string;
  readonly expandAll: string;
  readonly collapseAll: string;
  readonly empty: string;
  readonly registryNote: string;
  readonly superApp: {
    readonly title: string;
    readonly desc: string;
    readonly note: string;
  };
  readonly items: readonly CatalogModule[];
}

/** Katalog mengikuti registri produk; isinya menjelaskan rancangan, bukan ketersediaan. */
export function ModuleCatalog({ copy }: { readonly copy: CatalogCopy }) {
  const [query, setQuery] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('');
  const [selectedPackageType, setSelectedPackageType] = useState('');
  const [expandedAll, setExpandedAll] = useState(false);
  const [expandedModules, setExpandedModules] = useState<ReadonlySet<string>>(() => new Set());
  const audiences = useMemo(
    () => [...new Set(copy.items.flatMap((module) => module.audience.split(',').map((role) => role.trim())))].sort(),
    [copy.items]
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return copy.items.filter((module) => {
      const matchesQuery =
        !normalized ||
        `${module.name} ${module.displayName} ${module.audience} ${module.desc}`.toLocaleLowerCase().includes(normalized);
      const matchesAudience =
        !selectedAudience || module.audience.split(',').some((role) => role.trim() === selectedAudience);
      const matchesPackageType = !selectedPackageType || module.packageType === selectedPackageType;
      return matchesQuery && matchesAudience && matchesPackageType;
    });
  }, [copy.items, query, selectedAudience, selectedPackageType]);

  function packageLabel(packageType: string): string {
    if (packageType === 'CORE') return copy.packageLabels.core;
    if (packageType === 'ADDON') return copy.packageLabels.addon;
    if (packageType === 'ROLE') return copy.packageLabels.role;
    if (packageType === 'UNMAPPED') return copy.packageLabels.unmapped;
    throw new Error(`Unknown catalog package category: ${packageType}`);
  }

  function packageClass(packageType: string): string {
    if (packageType === 'CORE') return 'bg-primary-soft text-primary-hover';
    if (packageType === 'ADDON') return 'badge-soft-info';
    if (packageType === 'UNMAPPED') return 'badge-soft-warning';
    if (packageType === 'ROLE') return 'bg-sica-inset text-slate-600';
    throw new Error(`Unknown catalog package category: ${packageType}`);
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border hairline bg-sica-card p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(16rem,1.6fr)_minmax(12rem,1fr)_minmax(12rem,1fr)] md:items-end">
          <div>
            <label htmlFor="module-catalog-search" className="section-label">
              {copy.searchLabel}
            </label>
            <div className="relative mt-2">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                strokeWidth={1.8}
              />
              <input
                id="module-catalog-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="h-11 w-full rounded-lg border hairline bg-sica-inset pl-10 pr-4 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-500 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
          <div>
            <label htmlFor="module-catalog-role" className="section-label">
              {copy.roleFilterLabel}
            </label>
            <select
              id="module-catalog-role"
              value={selectedAudience}
              onChange={(event) => setSelectedAudience(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border hairline bg-sica-inset px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            >
              <option value="">{copy.roleFilterAll}</option>
              {audiences.map((audience) => (
                <option key={audience} value={audience}>
                  {audience}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="module-catalog-package" className="section-label">
              {copy.packageFilterLabel}
            </label>
            <select
              id="module-catalog-package"
              value={selectedPackageType}
              onChange={(event) => setSelectedPackageType(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border hairline bg-sica-inset px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
            >
              {Object.entries(copy.packageFilters).map(([value, label]) => (
                <option key={value} value={value === 'all' ? '' : value.toUpperCase()}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t hairline pt-3">
          <p aria-live="polite" className="text-sm font-medium text-slate-500">
            <span className="tabular text-[color:var(--sica-text-heading)]">{filtered.length}</span>
            <span> {copy.resultLabel}</span>
          </p>
          <button
            type="button"
            aria-expanded={expandedAll}
            onClick={() => {
              setExpandedAll((expanded) => !expanded);
              setExpandedModules(new Set());
            }}
            className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          >
            {expandedAll ? copy.collapseAll : copy.expandAll}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed2 text-slate-500">{copy.classificationNote}</p>
      </div>

      {filtered.length > 0 ? (
        <div className="grid gap-3 min-[360px]:grid-cols-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((module) => (
            <details
              key={module.code}
              open={expandedAll || query.trim().length > 0 || expandedModules.has(module.code)}
              onToggle={(event) => {
                if (expandedAll || query.trim().length > 0) return;
                const isOpen = event.currentTarget.open;
                setExpandedModules((current) => {
                  const next = new Set(current);
                  if (isOpen) next.add(module.code);
                  else next.delete(module.code);
                  return next;
                });
              }}
              className="catalog-detail group h-full rounded-lg border hairline bg-sica-card transition-colors duration-200 hover:border-primary/35 open:border-primary/35"
            >
              <summary className="min-h-[6.5rem] cursor-pointer list-none rounded-lg px-4 py-3.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/15 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      'inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      packageClass(module.packageType)
                    )}
                  >
                    {packageLabel(module.packageType)}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                    strokeWidth={1.8}
                  />
                </span>
                <h3 className="mt-2 text-sm font-semibold leading-snug text-[color:var(--sica-text-heading)]">
                  {module.displayName}
                </h3>
                <span role="group" aria-label={`${copy.audienceLabel}: ${module.audience}`} className="mt-2 flex flex-wrap gap-1.5">
                  {module.audience.split(',').map((audience) => (
                    <span
                      key={audience.trim()}
                      className="inline-flex min-h-6 items-center rounded-full bg-sica-inset px-2 py-0.5 text-[11px] font-medium leading-tight text-slate-600"
                    >
                      {audience.trim()}
                    </span>
                  ))}
                </span>
              </summary>
              <div className="catalog-detail-content border-t hairline px-4 pb-4 pt-3">
                <p className="text-[13px] leading-relaxed2 text-slate-600">{module.desc}</p>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border hairline bg-sica-card px-5 py-10 text-center text-sm text-slate-500">
          {copy.empty}
        </p>
      )}

      <aside className="mt-5 flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary-soft/40 p-5 sm:flex-row sm:items-start sm:gap-4">
        <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-primary-hover">Ponsel</span>
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--sica-text-heading)]">{copy.superApp.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed2 text-slate-600">{copy.superApp.desc}</p>
          <p className="mt-2 text-xs leading-relaxed2 text-slate-500">{copy.superApp.note}</p>
        </div>
      </aside>

      <p className="mt-4 text-center text-xs leading-relaxed2 text-slate-500">{copy.registryNote}</p>
    </div>
  );
}
