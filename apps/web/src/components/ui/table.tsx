import * as React from 'react';
import { cn } from '@/lib/utils';

/** Bagian tabel dengan kelas Velzon yang seragam (head uppercase tipis, row hairline). */
export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, children }: { readonly className?: string; readonly children: React.ReactNode }) {
  return (
    <thead className={cn('table-head', className)}>
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className,
  align = 'left',
  sortable = false,
  active = false,
  onSort,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly align?: 'left' | 'right' | 'center';
  readonly sortable?: boolean;
  readonly active?: boolean;
  readonly onSort?: () => void;
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (!sortable) {
    return <th className={cn('px-4 py-3.5 font-semibold', alignClass, className)} scope="col">{children}</th>;
  }

  return (
    <th className={cn('px-4 py-3.5', alignClass, className)} scope="col">
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1.5 rounded transition-colors hover:text-primary-hover',
          active && 'text-primary-hover',
        )}
      >
        {children}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={cn(active ? 'opacity-100' : 'opacity-40')}>
          <path d="M5 1.5 8 6H2z" fill="currentColor" />
        </svg>
      </button>
    </th>
  );
}

export function TBody({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <tbody className={className}>{children}</tbody>;
}

export function TR({
  children,
  className,
  onOpen,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly onOpen?: () => void;
}) {
  return (
    <tr
      className={cn('table-row', onOpen && 'cursor-pointer', className)}
      onClick={onOpen}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter') onOpen();
            }
          : undefined
      }
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  align = 'left',
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly align?: 'left' | 'right' | 'center';
}) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return <td className={cn('px-4 py-3.5 align-middle', alignClass, className)}>{children}</td>;
}
