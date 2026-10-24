import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONFIG = {
  info: { icon: Info, box: 'bg-info-soft border-info/25', ink: 'text-info-hover' },
  success: { icon: CheckCircle2, box: 'bg-success-soft border-success/25', ink: 'text-success' },
  warning: { icon: AlertTriangle, box: 'bg-warning-soft border-warning/40', ink: 'text-[color:var(--sica-warning-hover)]' },
  danger: { icon: XCircle, box: 'bg-danger-soft border-danger/25', ink: 'text-danger-hover' },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  readonly tone?: keyof typeof CONFIG;
  readonly title?: string;
  readonly children?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly className?: string;
}) {
  const { icon: Icon, box, ink } = CONFIG[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5', box, className)}
    >
      <Icon size={17} strokeWidth={2} className={cn('mt-0.5 shrink-0', ink)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className={cn('text-sm font-semibold', ink)}>{title}</p> : null}
        {children ? (
          <div className={cn('text-[13px] leading-relaxed text-[color:var(--sica-text-body)]', title && 'mt-0.5')}>
            {children}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
