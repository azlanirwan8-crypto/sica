import React from 'react';
import { Check, CircleDashed, Minus, Sparkles, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Reveal } from './motion';

export interface BenchmarkRow {
  readonly label: string;
  readonly cells: readonly string[];
}

export interface SevimaRow {
  readonly label: string;
  readonly status: string;
}

export interface BenchmarkCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly columns: readonly string[];
  readonly rows: readonly BenchmarkRow[];
  readonly sevimaTitle: string;
  readonly sevimaNote: string;
  readonly statusReady: string;
  readonly statusPartial: string;
  readonly statusRoadmap: string;
  readonly sevima: readonly SevimaRow[];
}

type Tone = NonNullable<BadgeProps['tone']>;

interface StatusStyle {
  readonly tone: Tone;
  readonly label: 'statusReady' | 'statusPartial' | 'statusRoadmap';
  readonly icon: LucideIcon;
}

/** Kesiapan modul: nada soft + ikon, bukan blok warna penuh. */
const STATUS_STYLE: Record<string, StatusStyle> = {
  ready: { tone: 'success', label: 'statusReady', icon: Check },
  partial: { tone: 'warning', label: 'statusPartial', icon: Minus },
  roadmap: { tone: 'neutral', label: 'statusRoadmap', icon: CircleDashed },
};

const FALLBACK_STATUS: StatusStyle = { tone: 'neutral', label: 'statusRoadmap', icon: CircleDashed };

/** Kolom pembanding terakhir adalah milik SICA dan mendapat sorotan lembut. */
const HIGHLIGHT = 'bg-primary/10 text-primary-hover';

/** Tabel benchmark: diferensiasi arsitektur + cakupan modul standar pasar. */
export function BenchmarkSection({ copy }: { copy: BenchmarkCopy }) {
  const highlightIndex = copy.columns.length - 1;

  const countOf = (status: string): number => copy.sevima.filter((s) => s.status === status).length;
  const readyCount = countOf('ready');

  return (
    <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-start">
      {/* Perbandingan diferensiator */}
      <Reveal>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table className="text-[12.5px]">
              <caption className="sr-only">{copy.title}</caption>
              <THead>
                <TH className="w-[34%]">
                  <span className="sr-only">Aspek</span>
                </TH>
                {copy.columns.map((col, i) => (
                  <TH key={col} align="center" className={i === highlightIndex ? HIGHLIGHT : undefined}>
                    {i === highlightIndex ? <span className="text-primary-hover">{col}</span> : col}
                  </TH>
                ))}
              </THead>
              <TBody>
                {copy.rows.map((row) => (
                  <TR key={row.label}>
                    <TD className="py-4 pr-3 font-semibold text-[color:var(--sica-text-heading)] sm:pr-4">
                      {row.label}
                    </TD>
                    {row.cells.map((cell, ci) => (
                      <TD
                        key={`${row.label}-${ci}`}
                        align="center"
                        className={
                          ci === highlightIndex
                            ? 'bg-primary/[0.07] py-4 font-semibold text-primary-hover'
                            : 'py-4 text-slate-500'
                        }
                      >
                        {cell}
                      </TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </Reveal>

      {/* Cakupan modul standar pasar — kartu kedua menyusul satu langkah stagger. */}
      <Reveal delay={48}>
        <Card>
          <CardHeader className="items-start">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>{copy.sevimaTitle}</CardTitle>
                <CardDescription>{copy.sevimaNote}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="section-label">{copy.statusReady}</span>
                <span className="text-[12px] tabular text-slate-500">
                  {readyCount} / {copy.sevima.length}
                </span>
              </div>
              <Progress
                value={readyCount}
                max={copy.sevima.length || 1}
                tone="success"
                label={`${copy.statusReady} ${readyCount} / ${copy.sevima.length}`}
                className="mt-2.5"
              />
            </div>

            <ul className="flex flex-col">
              {copy.sevima.map((s, i) => {
                const st = STATUS_STYLE[s.status] ?? FALLBACK_STATUS;
                const Icon = st.icon;
                return (
                  <li
                    key={s.label}
                    className={`flex items-center justify-between gap-3 py-2.5 ${
                      i === copy.sevima.length - 1 ? '' : 'border-b hairline'
                    }`}
                  >
                    <span className="min-w-0 text-[13px] font-medium text-slate-700">{s.label}</span>
                    <Badge tone={st.tone} size="sm" className="shrink-0">
                      <Icon className="h-3 w-3" aria-hidden strokeWidth={2.4} />
                      {copy[st.label]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
