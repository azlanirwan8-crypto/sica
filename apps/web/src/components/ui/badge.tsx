import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.02em] leading-none transition-colors',
  {
    variants: {
      tone: {
        primary: '',
        secondary: '',
        success: '',
        info: '',
        warning: '',
        danger: '',
        neutral: '',
      },
      look: { soft: '', label: '', solid: '', outline: '' },
      size: { sm: 'px-2 py-[3px] text-[11px]', md: 'px-2.5 py-1 text-xs', lg: 'px-3 py-1.5 text-[13px]' },
    },
    defaultVariants: { tone: 'neutral', look: 'soft', size: 'md' },
  },
);

/**
 * Pemetaan (tone, look) → kelas Velzon.
 *
 * `soft` dan `label` **mendelegasikan ke kelas design-system** (`badge-soft-*`,
 * `badge-label-*`) di `app/globals.css`, bukan meniru warnanya di sini. Alasan:
 * kombinasi nada-putih itu sudah diukur WCAG (lihat UI_UX_DESIGN §11.10), dan
 * setiap keputusan warna per-komponen adalah jalan masuk kembalinya kontras
 * rendah yang persis sedang kita tutup. Nama kelas ditulis utuh (bukan
 * `badge-soft-${tone}`) supaya pemindai konten Tailwind dapat melihatnya.
 */
const toneClass: Record<string, string> = {
  primary: 'badge-soft-primary',
  secondary: 'badge-soft-secondary',
  success: 'badge-soft-success',
  info: 'badge-soft-info',
  warning: 'badge-soft-warning',
  danger: 'badge-soft-danger',
  neutral: 'badge-soft-neutral',
};

const labelClass: Record<string, string> = {
  primary: 'badge-label-primary',
  secondary: 'badge-label-secondary',
  success: 'badge-label-success',
  info: 'badge-label-info',
  warning: 'badge-label-warning',
  danger: 'badge-label-danger',
  neutral: 'badge-soft-neutral',
};

/** Isian padat: teks putih hanya di atas `-solid` (≥ 4,5:1), bukan aksen merek. */
const solidClass: Record<string, string> = {
  primary: 'bg-primary-solid text-primary-on',
  secondary: 'bg-secondary text-secondary-on',
  success: 'bg-primary-solid text-primary-on',
  info: 'bg-info-solid text-info-on',
  warning: 'bg-warning text-warning-on',
  danger: 'bg-danger-solid text-danger-on',
  neutral: 'bg-slate-500 text-white',
};

/** Garis luar: teks di atas permukaan kartu, jadi pakai warna tinta, bukan aksen. */
const outlineClass: Record<string, string> = {
  primary: 'border border-primary/45 text-primary-ink',
  secondary: 'border border-secondary/45 text-secondary',
  success: 'border border-success/45 text-primary-ink',
  info: 'border border-info/45 text-info-solid',
  warning: 'border border-warning/60 text-[color:var(--sica-on-warning-soft)]',
  danger: 'border border-danger/45 text-danger-ink',
  neutral: 'border border-slate-300 text-slate-600',
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  readonly dot?: boolean;
}

const palette: Record<string, Record<string, string>> = {
  soft: toneClass,
  label: labelClass,
  solid: solidClass,
  outline: outlineClass,
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = 'neutral', look = 'soft', size, dot = false, children, ...props }, ref) => {
    const lookKey = look ?? 'soft';
    const toneKey = tone ?? 'neutral';
    const color = palette[lookKey]?.[toneKey] ?? toneClass['neutral'];

    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ tone, look, size }), color, className)}
        {...props}
      >
        {dot ? (
          <span
            className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
            aria-hidden
          />
        ) : null}
        {children}
      </span>
    );
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
