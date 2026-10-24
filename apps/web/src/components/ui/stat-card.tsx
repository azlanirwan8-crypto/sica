import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Sparkline } from '@/components/ui/velzon-chart';
import { cn } from '@/lib/utils';

export type StatTrend = 'up' | 'down' | 'flat';

/**
 * Kartu statistik Velzon: label kecil uppercase, angka tabular besar (bukan
 * hitam pekat), delta bertanda panah, dan sparkline opsional di kanan bawah.
 * Semua warna lewat token sehingga ikut tema.
 */
export function StatCard({
  label,
  value,
  hint,
  trend,
  trendValue,
  trendSemantic = 'neutral',
  spark,
  icon,
  loading = false,
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly trend?: StatTrend;
  readonly trendValue?: string;
  /** 'good-when-up' membalik warna saat tren turun (mis. tunggakan). */
  readonly trendSemantic?: 'neutral' | 'good-when-up' | 'good-when-down';
  readonly spark?: readonly number[];
  readonly icon?: React.ReactNode;
  readonly loading?: boolean;
  readonly className?: string;
}) {
  const goodDirection = trendSemantic === 'good-when-down' ? 'down' : 'up';
  const toneClass =
    !trend || !trendValue
      ? 'text-[color:var(--sica-text-muted)]'
      : trend === 'flat'
        ? 'text-[color:var(--sica-text-muted)]'
        : trend === goodDirection
          ? 'text-success'
          : 'text-danger-hover';

  const TrendIcon = trend === 'down' ? ArrowDownRight : trend === 'up' ? ArrowUpRight : Minus;

  if (loading) {
    return (
      <div className={cn('card', className)}>
        <div className="card-body flex flex-col gap-3">
          <span className="skeleton h-3 w-24 rounded" />
          <span className="skeleton h-8 w-32 rounded" />
          <span className="skeleton h-3 w-20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('card card-hover', className)}>
      <div className="card-body">
        <div className="flex items-start justify-between gap-4">
          <p className="section-label">{label}</p>
          {icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
              {icon}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[26px] font-semibold leading-none tracking-tightest tabular text-[color:var(--sica-text-heading)]">
          {value}
        </p>

        <div className="mt-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {trend && trendValue ? (
              <span className={cn('inline-flex items-center gap-1 text-[12.5px] font-semibold', toneClass)}>
                <TrendIcon size={13} strokeWidth={2.4} aria-hidden />
                {trendValue}
              </span>
            ) : null}
            {hint ? (
              <span className="text-[12.5px] text-[color:var(--sica-text-muted)]">{hint}</span>
            ) : null}
          </div>

          {spark && spark.length > 1 ? (
            <span className="w-24 shrink-0">
              <Sparkline values={spark} />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
