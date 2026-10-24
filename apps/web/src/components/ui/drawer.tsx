'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Drawer (offcanvas) — pola utama Area Admin sesuai docs/UI_UX_DESIGN.md §9.2:
 * daftar → drawer, BUKAN modal bertumpuk. `Modal` tetap tersedia untuk
 * konfirmasi singkat (satu lapis saja).
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  width = 'max-w-xl',
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly footer?: React.ReactNode;
  readonly width?: string;
  readonly children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="overlay-backdrop absolute inset-0 animate-fade-in" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-drawer-in relative flex h-full w-full flex-col border-l bg-[color:var(--sica-surface-card)]',
          width,
        )}
        style={{ borderColor: 'var(--sica-border-color)', boxShadow: 'var(--sica-shadow-modal)' }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--sica-divider)' }}>
          <div className="min-w-0">
            <h2 className="card-title text-base">{title}</h2>
            {description ? <p className="card-subtitle mt-1">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[color:var(--sica-text-muted)] transition-colors hover:bg-slate-100/70 hover:text-[color:var(--sica-text-heading)]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <footer className="card-footer justify-end gap-3" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Lanjutkan',
  tone = 'primary',
  busy = false,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly tone?: 'primary' | 'danger';
  readonly busy?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="overlay-backdrop absolute inset-0 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="elevated-panel animate-scale-in w-full max-w-lg p-6"
      >
        <h2 className="text-base font-semibold tracking-tight text-[color:var(--sica-text-heading)]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--sica-text-body)]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              'h-10 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-60',
              tone === 'danger' ? 'bg-danger hover:bg-danger-hover' : 'bg-primary hover:bg-primary-hover',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
