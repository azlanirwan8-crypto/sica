import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Crumb = { readonly label: string; readonly href?: string };

/** Page header Velzon: eyebrow/roti breadcrumb, judul, penjelasan, aksi kanan. */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: {
  readonly title: string;
  readonly description?: string;
  readonly crumbs?: readonly Crumb[];
  readonly actions?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[color:var(--sica-text-muted)]">
              {crumbs.map((crumb, index) => (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight size={13} strokeWidth={2} aria-hidden className="opacity-60" /> : null}
                  {crumb.href ? (
                    <Link href={crumb.href} className="transition-colors hover:text-primary-hover">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[color:var(--sica-text-body)]">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description mt-1.5">{description}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/** Baris ringkasan metrik kecil di bawah judul (mis. periode aktif). */
export function MetaRow({ items }: { readonly items: readonly { readonly label: string; readonly value: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {items.map((item) => (
        <p key={item.label} className="flex items-baseline gap-2">
          <span className="section-label">{item.label}</span>
          <span className="text-[13.5px] font-semibold text-[color:var(--sica-text-heading)] tabular">{item.value}</span>
        </p>
      ))}
    </div>
  );
}
