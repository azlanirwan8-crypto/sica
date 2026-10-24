import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — tiga families Velzon: solid, soft, label (outline berlatar), ghost.
 * Tidak ada hexa: semua lewat token (`--sica-*`) supaya ikut tema.
 *
 * Radius dasar = `rounded-md` (8px) mengikuti §2.0 "radius kanonik Velzon" dan
 * `.btn` Bootstrap; sebelumnya `rounded-lg` (12px) sehingga tombol kita terlihat
 * seperti kartu, bukan kontrol Velzon.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.006em] transition-all duration-200 ease-velzon focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary disabled:pointer-events-none disabled:opacity-55 hover:-translate-y-px active:scale-[0.985] motion-reduce:hover:translate-y-0 motion-reduce:transition-none motion-reduce:transform-none',
  {
    variants: {
      variant: {
        default:
          'btn-sweep border border-transparent bg-primary-solid text-primary-on shadow-sm hover:bg-primary-solid-hover hover:shadow-raised',
        soft: 'border border-primary/20 bg-primary-soft text-primary-ink hover:bg-primary/15 hover:border-primary/35',
        label: 'border bg-primary-soft text-primary-ink hover:bg-primary-solid hover:text-primary-on',
        secondary:
          'btn-sweep border border-transparent bg-secondary text-secondary-on shadow-sm hover:bg-secondary-hover',
        success:
          'btn-sweep border border-transparent bg-primary-solid text-primary-on shadow-sm hover:bg-primary-solid-hover',
        info: 'btn-sweep border border-transparent bg-info-solid text-info-on shadow-sm hover:bg-info-solid-hover',
        warning: 'btn-sweep border border-transparent bg-warning text-warning-on shadow-sm hover:bg-warning-hover',
        destructive:
          'btn-sweep border border-transparent bg-danger-solid text-danger-on shadow-sm hover:bg-danger-solid-hover',
        outline:
          'border bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900',
        ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900',
        link: 'border border-transparent bg-transparent text-primary-ink underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-7 rounded-md px-2.5 text-xs',
        sm: 'h-8 rounded-md px-3 text-[13px]',
        lg: 'h-11 px-6 text-[15px]',
        xl: 'h-12 px-7 text-base',
        icon: 'h-10 w-10 px-0',
        'icon-sm': 'h-8 w-8 rounded-md px-0',
      },
      block: { true: 'w-full', false: undefined },
    },
    defaultVariants: { variant: 'default', size: 'default', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonVariants({ variant, size, block, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
