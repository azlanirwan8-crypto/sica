'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Dropdown tanpa dependensi UI eksternal (repo belum memasang Radix — lihat
 * docs/TECH_CONVENTIONS.md §6). Penutupan: klik luar, Escape, atau pilih item.
 */
export function Dropdown({
  trigger,
  children,
  align = 'end',
  width = 'w-64',
  className,
  label,
}: {
  readonly trigger: (open: boolean) => React.ReactNode;
  readonly children: (close: () => void) => React.ReactNode;
  readonly align?: 'start' | 'end';
  readonly width?: string;
  readonly className?: string;
  /** Nama aksesibel pemicu; wajib diisi bila pemicunya hanya ikon. */
  readonly label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const close = React.useCallback(() => setOpen(false), []);

  React.useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} aria-expanded={open} aria-label={label}>
        {trigger(open)}
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            // `show` bukan hiasan: `.dropdown-menu` bawaan Bootstrap 5.3 ber-`display:none`
            // sampai `.show` pasang. Posisi & z-index tetap milik utilitas Tailwind di bawah.
            'dropdown-menu show animate-scale-in absolute top-[calc(100%+8px)] z-50',
            align === 'end' ? 'right-0' : 'left-0',
            width,
          )}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  children,
  onSelect,
  icon,
  tone = 'default',
  as,
}: {
  readonly children: React.ReactNode;
  readonly onSelect?: () => void;
  readonly icon?: React.ReactNode;
  readonly tone?: 'default' | 'danger';
  readonly as?: 'button' | 'link';
}) {
  const classes = cn('dropdown-item w-full text-left', as === 'link' && 'cursor-pointer');
  if (as === 'link') {
    return (
      <a className={classes} onClick={onSelect}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={cn(classes, tone === 'danger' && 'text-danger-hover hover:bg-danger-soft hover:text-danger-hover')}
      onClick={onSelect}
    >
      {icon}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[color:var(--sica-divider)]" />;
}

export function DropdownLabel({ children }: { readonly children: React.ReactNode }) {
  return <p className="section-label px-2.5 pb-1 pt-2">{children}</p>;
}
