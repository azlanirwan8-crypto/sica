'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * VelzonChart — grafis SVG tanpa dependensi tambahan.
 *
 * Kenapa tidak memakai pustaka chart: `package.json` @sica/web tidak memuat
 * apexcharts/recharts, dan docs/TECH_CONVENTIONS.md §6 melarang menulis
 * kemampuan seolah paketnya sudah ada. Primitif ini memberi hasil visual yang
 * diminta (spline halus, area gradient 0.15, tooltip glass, animasi mount,
 * legenda rapi) sekaligus ikut warna tema karena semua warna dibaca dari token.
 */

export type ChartPoint = { readonly label: string; readonly value: number };
export type ChartSeries = { readonly name: string; readonly points: readonly ChartPoint[]; readonly color?: string };

type Geometry = {
  readonly width: number;
  readonly height: number;
  readonly padLeft: number;
  readonly padRight: number;
  readonly padTop: number;
  readonly padBottom: number;
};

/** Interpolasi monotone cubic (Fritsch–Carlson) — halus tanpa overshoot. */
function monotonePath(points: readonly { x: number; y: number }[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
  if (n === 2) {
    const a = points[0]!;
    const b = points[1]!;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const width = p1.x - p0.x || 1;
    dx.push(width);
    slope.push((p1.y - p0.y) / width);
  }

  const tangent: number[] = [slope[0] ?? 0];
  for (let i = 1; i < n - 1; i++) {
    const left = slope[i - 1] ?? 0;
    const right = slope[i] ?? 0;
    if (left * right <= 0) {
      tangent.push(0);
    } else {
      const d0 = dx[i - 1] ?? 1;
      const d1 = dx[i] ?? 1;
      const common = d0 + d1;
      tangent.push((3 * common) / ((common + d1) / left + (common + d0) / right));
    }
  }
  tangent.push(slope[n - 2] ?? 0);

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const run = dx[i]! / 3;
    d += ` C ${p0.x + run} ${p0.y + (tangent[i] ?? 0) * run}, ${p1.x - run} ${p1.y - (tangent[i + 1] ?? 0) * run}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export type VelzonChartProps = {
  readonly series: readonly ChartSeries[];
  readonly height?: number;
  readonly area?: boolean;
  readonly smooth?: boolean;
  readonly grid?: boolean;
  readonly legend?: boolean;
  readonly tooltip?: boolean;
  readonly sparkline?: boolean;
  readonly yTicks?: number;
  readonly valueFormat?: (value: number) => string;
  readonly className?: string;
};

const PALETTE = ['var(--sica-chart-1)', 'var(--sica-chart-2)', 'var(--sica-chart-3)', 'var(--sica-chart-4)', 'var(--sica-chart-5)'];

export function VelzonChart({
  series,
  height = 260,
  area = true,
  smooth = true,
  grid = true,
  legend = true,
  tooltip = true,
  sparkline = false,
  yTicks = 4,
  valueFormat,
  className,
}: VelzonChartProps) {
  const uid = React.useId().replace(/:/g, '');
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(720);
  const [active, setActive] = React.useState<number | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.max(240, Math.round(node.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const values = series.flatMap((line) => line.points.map((point) => point.value));
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);
  const span = rawMax - rawMin || 1;
  const maxValue = rawMax + span * 0.12;
  const minValue = rawMin - span * 0.08;

  const geo: Geometry = {
    width,
    height,
    padLeft: sparkline ? 4 : 44,
    padRight: sparkline ? 4 : 16,
    padTop: sparkline ? 6 : 14,
    padBottom: sparkline ? 4 : 26,
  };

  const innerW = Math.max(10, geo.width - geo.padLeft - geo.padRight);
  const innerH = Math.max(10, geo.height - geo.padTop - geo.padBottom);
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : innerW;

  const xyFor = (index: number, value: number) => ({
    x: geo.padLeft + stepX * index,
    y: geo.padTop + innerH - ((value - minValue) / (maxValue - minValue || 1)) * innerH,
  });

  const format = valueFormat ?? ((value: number) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}rb` : `${Math.round(value)}`));

  const ticks = React.useMemo(
    () => Array.from({ length: yTicks + 1 }, (_, index) => minValue + ((maxValue - minValue) / yTicks) * index),
    [minValue, maxValue, yTicks],
  );

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tooltip) return;
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - geo.padLeft) / (innerW || 1);
    const index = Math.round(ratio * (labels.length - 1));
    setActive(Math.max(0, Math.min(labels.length - 1, index)));
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {legend && !sparkline ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {series.map((line, index) => (
            <span key={line.name} className="flex items-center gap-2 text-xs font-medium text-[color:var(--sica-text-muted)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: line.color ?? PALETTE[index % PALETTE.length] }}
              />
              {line.name}
            </span>
          ))}
        </div>
      ) : null}

      <div
        ref={hostRef}
        className="relative w-full"
        style={{ height: sparkline ? 56 : height }}
        onPointerMove={handleMove}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          width="100%"
          height={sparkline ? 56 : height}
          role="img"
          aria-label={series.map((line) => line.name).join(', ')}
          preserveAspectRatio="none"
        >
          <defs>
            {series.map((line, index) => (
              <linearGradient key={line.name} id={`sica-area-${uid}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={line.color ?? PALETTE[index % PALETTE.length]} stopOpacity={0.15} />
                <stop offset="100%" stopColor={line.color ?? PALETTE[index % PALETTE.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {grid && !sparkline
            ? ticks.map((tick) => {
                const point = xyFor(0, tick);
                return (
                  <g key={tick}>
                    <line
                      x1={geo.padLeft}
                      x2={geo.width - geo.padRight}
                      y1={point.y}
                      y2={point.y}
                      stroke="var(--sica-chart-grid)"
                      strokeWidth={1}
                      strokeDasharray={Math.abs(tick - ticks[0]!) < 0.0001 ? undefined : '3 5'}
                    />
                    <text
                      x={geo.padLeft - 8}
                      y={point.y + 3}
                      textAnchor="end"
                      fontSize={10}
                      fontWeight={500}
                      fill="var(--sica-chart-axis)"
                    >
                      {format(tick)}
                    </text>
                  </g>
                );
              })
            : null}

          {series.map((line, seriesIndex) => {
            const coords = line.points.map((point, index) => xyFor(index, point.value));
            const stroke = line.color ?? PALETTE[seriesIndex % PALETTE.length];
            const path = smooth ? monotonePath(coords) : `M ${coords.map((c) => `${c.x} ${c.y}`).join(' L ')}`;
            const areaPath = coords.length
              ? `${path} L ${coords[coords.length - 1]!.x} ${geo.padTop + innerH} L ${coords[0]!.x} ${geo.padTop + innerH} Z`
              : '';

            return (
              <g key={line.name}>
                {area && !sparkline ? (
                  <path
                    d={areaPath}
                    fill={`url(#sica-area-${uid}-${seriesIndex})`}
                    style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease-out 180ms' }}
                  />
                ) : null}
                <path
                  d={path}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sparkline ? 2 : 2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 2400,
                    strokeDashoffset: mounted ? 0 : 2400,
                    transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
                {!sparkline
                  ? coords.map((coord, index) => (
                      <circle
                        key={index}
                        cx={coord.x}
                        cy={coord.y}
                        r={active === index ? 4.2 : 2.4}
                        fill="var(--sica-surface-card)"
                        stroke={stroke}
                        strokeWidth={2}
                        style={{ opacity: mounted ? 1 : 0, transition: 'all 240ms ease-out' }}
                      />
                    ))
                  : null}
              </g>
            );
          })}

          {active !== null && !sparkline ? (
            <line
              x1={xyFor(active, 0).x}
              x2={xyFor(active, 0).x}
              y1={geo.padTop}
              y2={geo.padTop + innerH}
              stroke="var(--sica-primary)"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
        </svg>

        {!sparkline && labels.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 text-[10px] font-medium tracking-wide text-[color:var(--sica-chart-axis)]">
            {labels
              .filter((_, index) => index % Math.ceil(labels.length / 7) === 0 || index === labels.length - 1)
              .map((label) => (
                <span key={label}>{label}</span>
              ))}
          </div>
        ) : null}

        {tooltip && active !== null && !sparkline ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-xl border px-3.5 py-2.5"
            style={{
              left: `min(calc(100% - 10rem), ${xyFor(active, 0).x}px)`,
              background: 'var(--sica-chart-tooltip-bg)',
              borderColor: 'var(--sica-chart-tooltip-border)',
              boxShadow: 'var(--sica-shadow-dropdown)',
              backdropFilter: 'blur(10px) saturate(150%)',
              WebkitBackdropFilter: 'blur(10px) saturate(150%)',
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--sica-text-muted)]">
              {labels[active]}
            </p>
            <div className="mt-1.5 flex flex-col gap-1">
              {series.map((line, index) => (
                <p key={line.name} className="flex items-center justify-between gap-4 text-[12.5px]">
                  <span className="flex items-center gap-1.5 text-[color:var(--sica-text-body)]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: line.color ?? PALETTE[index % PALETTE.length] }}
                    />
                    {line.name}
                  </span>
                  <span className="font-semibold tabular text-[color:var(--sica-text-heading)]">
                    {format(line.points[active]?.value ?? 0)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = 'var(--sica-primary)' }: { readonly values: readonly number[]; readonly color?: string }) {
  const points: ChartPoint[] = values.map((value, index) => ({ label: `${index}`, value }));
  return <VelzonChart series={[{ name: 'spark', points, color }]} sparkline height={56} />;
}
