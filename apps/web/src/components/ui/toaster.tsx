'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Sonner dengan kulit Velzon: border halus, bayangan lembut, ikon indikator
 * berwarna, dan warna datang dari token supaya ikut tema gelap.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors={false}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast:
            'group !rounded-xl !border !bg-[color:var(--sica-surface-raised)] !text-[color:var(--sica-text-heading)] !shadow-[var(--sica-shadow-dropdown)] !px-4 !py-3.5 !text-[13.5px] !font-medium',
          title: '!text-[13.5px] !font-semibold !tracking-[-0.006em] !text-[color:var(--sica-text-heading)]',
          description:
            '!text-[12.5px] !font-normal !leading-relaxed !text-[color:var(--sica-text-muted)] group-[.toaster]:!text-[color:var(--sica-text-muted)]',
          actionButton: '!bg-primary !text-primary-on !rounded-md !text-[12px] !font-semibold !px-2 !py-1',
          cancelButton: '!bg-slate-100 !text-slate-600 !rounded-md !text-[12px] !px-2 !py-1',
          success: '!border-l-[3px] !border-l-success',
          error: '!border-l-[3px] !border-l-danger',
          warning: '!border-l-[3px] !border-l-warning',
          info: '!border-l-[3px] !border-l-info',
          default: '!border-l-[3px] !border-l-primary/40',
        },
      }}
    />
  );
}
