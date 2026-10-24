'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Progress({
  value,
  max = 100,
  size = 'md',
  tone = 'primary',
  label,
  className,
}: {
  readonly value: number;
  readonly max?: number;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly tone?: 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'secondary';
  readonly label?: string;
  readonly className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  const toneVar: Record<string, string> = {
    primary: 'linear-gradient(90deg, var(--sica-primary), rgb(var(--sica-rgb-primary) / 0.7))',
    success: 'linear-gradient(90deg, var(--sica-success), rgb(var(--sica-rgb-success) / 0.7))',
    info: 'linear-gradient(90deg, var(--sica-info), rgb(var(--sica-rgb-info) / 0.7))',
    warning: 'linear-gradient(90deg, var(--sica-warning), rgb(var(--sica-rgb-warning) / 0.7))',
    danger: 'linear-gradient(90deg, var(--sica-danger), rgb(var(--sica-rgb-danger) / 0.7))',
    secondary: 'linear-gradient(90deg, var(--sica-secondary), rgb(var(--sica-rgb-secondary) / 0.7))',
  };

  return (
    <div
      className={cn('progress', size === 'sm' && 'progress-sm', size === 'lg' && 'progress-lg', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="progress-bar" style={{ width: `${pct}%`, backgroundImage: toneVar[tone] }} />
    </div>
  );
}

/** Bar bertumpuk untuk komposisi (mis. sumber pembayaran). */
export function ProgressStack({
  segments,
  className,
}: {
  readonly segments: readonly { readonly label: string; readonly value: number; readonly color: string }[];
  readonly className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  return (
    <div className={cn('progress', className)}>
      <div className="flex h-full w-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            title={`${segment.label}: ${Math.round((segment.value / total) * 100)}%`}
            style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
    </div>
  );
}
