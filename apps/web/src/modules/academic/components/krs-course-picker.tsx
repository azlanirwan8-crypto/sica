'use client';

/**
 * KrsCoursePicker — komponen KLIEN untuk layar pemilihan kelas KRS.
 *
 * Perubahan fase 1 (menutup G-7/RD-154): berkas ini pernah memegang
 * `DEMO_CLASSES`/`AVAILABLE_CLASSES` sebagai sumber data, sehingga halaman
 * menawarkan tombol "Kirim KRS" di atas delapan baris fiktif. Sekarang:
 *  - Seluruh data datang lewat props (`classes`) yang dimuat server component
 *    `/academic/krs` dari `krs-open-classes.service.ts`. Tidak ada fixture di
 *    berkas ini.
 *  - Tombol kirim memanggil rute nyata `POST /api/v1/academic/krs/submit`
 *    (kontrak body `{ periodId, classIds }` tidak diubah) lalu
 *    `router.refresh()` agar layar membaca ulang baris `enrollments` dari DB.
 *  - `canSubmit === false` (penonton tidak memegang `enrollment.krs.submit`):
 *    tidak ada satu pun affordance aksi — tanpa kolom aksi, tanpa selection,
 *    tanpa drawer bertombol. Yang tersisa hanya daftar hanya-baca.
 *
 * Aturan yang dipertahankan (docs/UI_UX_DESIGN.md §9.2/§9.8): pola daftar →
 * drawer (bukan modal), kapasitas kursi sebagai `Progress` token (warning di
 * atas 85%, danger penuh), status selalu `StatusBadge` dari enum, sebab
 * penolakan lewat `Alert` (bukan toast), dan loading = skeleton baris.
 *
 * Semua teks UI diambil dari kamus `krs` (id.json/en.json) — AGENTS §3.5.
 */

import React, { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Eye,
  Send,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { getDictionary } from '@/lib/i18n';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  VelzonDataGrid,
  type ColumnDef,
  type DataGridErrorState,
  type DataGridFilter,
} from '@/components/ui/velzon-data-grid';
import { cn } from '@/lib/utils';

/** `period_status` (packages/database/src/schema/enums.ts:84). */
export type KrsPeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSING' | 'CLOSED';

/** `classes.status` — kolom text dengan tiga nilai (schema/classes.ts:88). */
export type KrsClassStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

/** Satu jadwal kelas; `dayOfWeek` 1=Senin … 7=Minggu. */
export interface OpenClassSchedule {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomCode: string | null;
}

/**
 * Baris daftar kelas — diproyeksikan dari `KrsOpenClassView` oleh halaman.
 * `hasConflict`/`conflictDescription` adalah vonis SERVER terhadap jadwal
 * mahasiswa sendiri, bukan tebakan klien.
 */
export interface OpenClassItem {
  readonly id: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: number;
  readonly lecturerNames: readonly string[];
  readonly schedules: readonly OpenClassSchedule[];
  readonly capacity: number;
  readonly enrolled: number;
  readonly status: KrsClassStatus;
  /** `enrollment_status` milik mahasiswa ini pada kelas tersebut; null bila belum diambil. */
  readonly enrolledStatus: string | null;
  readonly hasConflict: boolean;
  readonly conflictDescription: string | null;
}

export interface KrsPeriodInfo {
  readonly label: string;
  readonly status: KrsPeriodStatus;
  readonly endsAtLabel: string;
}

export interface KrsScreenError {
  readonly code?: string;
  readonly message: string;
}

export interface KrsCoursePickerProps {
  readonly periodId: string;
  readonly period: KrsPeriodInfo;
  readonly classes: readonly OpenClassItem[];
  /** Plafon SKS dari `sks-quota-validator` (berbasis IPS + konfigurasi prodi). */
  readonly maxAllowedSks: number;
  /** SKS yang sudah terpakai di periode ini (enrollment aktif). */
  readonly takenSks: number;
  /** Plafon jumlah kelas per pengajuan — mengikuti kontrak `classIds.max(10)`. */
  readonly maxSelectable: number;
  /** Pegang `enrollment.krs.submit`? Bila false: layar hanya-baca tanpa tombol aksi. */
  readonly canSubmit: boolean;
  /** Sebab kegagalan muat dari server; ditayangkan sebagai keadaan error grid. */
  readonly error?: KrsScreenError | null;
}

/** Hasil `KrsSubmitRequestSchema` — body tidak boleh berubah bentuknya. */
interface SubmitBody {
  readonly periodId: string;
  readonly classIds: readonly string[];
}

interface SubmitEnvelope {
  readonly success?: boolean;
  readonly data?: {
    readonly enrollments?: readonly unknown[];
    readonly alreadyEnrolled?: readonly unknown[];
  };
  readonly error?: { readonly code?: string; readonly message?: string };
}

interface PickerOutcome {
  readonly kind: 'sent' | 'blocked';
  readonly code?: string;
  readonly message: string;
}

const MINUTES_PER_HOUR = 60;

function toMinutes(time: string): number | null {
  const [hour, minute] = time.split(':');
  const h = Number.parseInt(hour ?? '', 10);
  const m = Number.parseInt(minute ?? '', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * MINUTES_PER_HOUR + m;
}

/**
 * Cermin aturan interval setengah-terbuka milik
 * `schedule-conflict-detector.service.ts` (08:00–09:40 dan 09:40–11:20 TIDAK
 * bentrok). Dipakai HANYA untuk peringatan dini antar-kelas yang baru dipilih —
 * vonis resmi tetap di server saat submit, dan `hasConflict` baris datang dari
 * server untuk jadwal yang sudah dipegang.
 */
export function schedulesOverlap(
  left: readonly OpenClassSchedule[],
  right: readonly OpenClassSchedule[],
): OpenClassSchedule[] | null {
  for (const a of left) {
    const aStart = toMinutes(a.startTime);
    const aEnd = toMinutes(a.endTime);
    if (aStart === null || aEnd === null) continue;
    for (const b of right) {
      if (b.dayOfWeek !== a.dayOfWeek) continue;
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);
      if (bStart === null || bEnd === null) continue;
      if (aStart < bEnd && bStart < aEnd) return [a, b];
    }
  }
  return null;
}

export interface KrsScheduleConflict {
  readonly a: OpenClassItem;
  readonly b: OpenClassItem;
  readonly dayOfWeek: number;
}

/** Bentrok antar-pilihan baru (server tidak tahu apa yang sedang dipilih). */
export function findSelectionConflicts(
  items: readonly OpenClassItem[],
): KrsScheduleConflict[] {
  const found: KrsScheduleConflict[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!a || !b) continue;
      const pair = schedulesOverlap(a.schedules, b.schedules);
      const slot = pair?.[0];
      if (slot) found.push({ a, b, dayOfWeek: slot.dayOfWeek });
    }
  }
  return found;
}

function seatRatio(taken: number, capacity: number): number {
  return capacity <= 0 ? 1 : taken / capacity;
}

function seatTone(taken: number, capacity: number): 'primary' | 'warning' | 'danger' {
  if (taken >= capacity) return 'danger';
  return seatRatio(taken, capacity) > 0.85 ? 'warning' : 'primary';
}

function DetailRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-[color:var(--sica-divider)] pb-2.5 last:border-b-0">
      <span className="section-label pt-0.5">{label}</span>
      <span className="min-w-0 text-right text-[13px] font-medium text-slate-700">{children}</span>
    </div>
  );
}

export function KrsCoursePicker({
  periodId,
  period,
  classes,
  maxAllowedSks,
  takenSks,
  maxSelectable,
  canSubmit,
  error = null,
}: KrsCoursePickerProps) {
  const t = getDictionary('id').krs;
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [picked, setPicked] = useState<readonly OpenClassItem[]>([]);
  const [outcome, setOutcome] = useState<PickerOutcome | null>(null);
  const [detailClass, setDetailClass] = useState<OpenClassItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();

  const pickedIds = useMemo(() => new Set(picked.map((item) => item.id)), [picked]);
  const pickedSks = useMemo(() => picked.reduce((total, item) => total + item.sks, 0), [picked]);
  const projectedSks = takenSks + pickedSks;
  const isOverQuota = projectedSks > maxAllowedSks;
  const conflicts = useMemo(() => findSelectionConflicts(picked), [picked]);

  const isPeriodOpen = period.status === 'OPEN' || period.status === 'CLOSING';
  const isLoading = submitting || isRefreshing;

  const reload = useCallback(() => {
    setOutcome(null);
    startRefresh(() => router.refresh());
  }, [router]);

  /** Baris yang sudah menjadi enrollment tidak dapat dilepas dari layar ini. */
  const isTaken = useCallback((cls: OpenClassItem) => cls.enrolledStatus !== null, []);
  const isSelected = useCallback((cls: OpenClassItem) => pickedIds.has(cls.id), [pickedIds]);

  const gridError: DataGridErrorState | null = error
    ? { code: error.code, message: error.message, retryLabel: t.retryLoad, onRetry: reload }
    : null;

  /** Sebab baris tidak dapat diambil — dipakai untuk disabled + `title`. */
  const blockReason = useCallback(
    (cls: OpenClassItem): string | null => {
      if (isTaken(cls)) return t.reasonTaken;
      if (isSelected(cls)) return null;
      if (!isPeriodOpen) return t.reasonPeriodClosed.replace('{period}', period.label).replace('{status}', period.status);
      if (cls.status === 'CLOSED') return t.reasonClassClosed;
      if (cls.status === 'CANCELLED') return t.reasonClassCancelled;
      if (cls.enrolled >= cls.capacity) return t.reasonFull;
      if (cls.hasConflict) return t.reasonConflict.replace('{detail}', cls.conflictDescription ?? '—');
      if (picked.length >= maxSelectable) return t.reasonMaxClasses.replace('{max}', String(maxSelectable));
      if (projectedSks + cls.sks > maxAllowedSks) {
        return t.reasonQuota.replace('{max}', String(maxAllowedSks));
      }
      return null;
    },
    [
      isPeriodOpen,
      isSelected,
      isTaken,
      maxAllowedSks,
      maxSelectable,
      period.label,
      period.status,
      picked.length,
      projectedSks,
      t.reasonClassCancelled,
      t.reasonClassClosed,
      t.reasonConflict,
      t.reasonMaxClasses,
      t.reasonPeriodClosed,
      t.reasonQuota,
      t.reasonTaken,
      t.reasonFull,
    ],
  );

  const changePicked = useCallback(
    (next: readonly OpenClassItem[]) => {
      setOutcome(null);
      setPicked(next);
    },
    [],
  );

  const togglePick = useCallback(
    (cls: OpenClassItem) => {
      changePicked(
        isSelected(cls) ? picked.filter((item) => item.id !== cls.id) : [...picked, cls],
      );
    },
    [changePicked, isSelected, picked],
  );

  /** Status baris: enrollment yang sudah ada mengikuti `enrollment_status`. */
  const rowStatus = useCallback(
    (cls: OpenClassItem): string => cls.enrolledStatus ?? cls.status,
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (picked.length === 0) return;

    if (!isPeriodOpen) {
      setOutcome({
        kind: 'blocked',
        code: 'PERIOD_NOT_OPEN',
        message: t.reasonPeriodClosed.replace('{period}', period.label).replace('{status}', period.status),
      });
      return;
    }
    if (isOverQuota) {
      setOutcome({
        kind: 'blocked',
        code: 'QUOTA_EXCEEDED',
        message: t.quotaAlertBody
          .replace('{total}', String(projectedSks))
          .replace('{max}', String(maxAllowedSks))
          .replace('{over}', String(projectedSks - maxAllowedSks)),
      });
      return;
    }
    if (conflicts.length > 0) {
      setOutcome({
        kind: 'blocked',
        code: 'SCHEDULE_CONFLICT',
        message: t.conflictBlocked.replace('{count}', String(conflicts.length)),
      });
      return;
    }
    if (picked.length > maxSelectable) {
      setOutcome({
        kind: 'blocked',
        code: 'TOO_MANY_CLASSES',
        message: t.reasonMaxClasses.replace('{max}', String(maxSelectable)),
      });
      return;
    }

    const body: SubmitBody = { periodId, classIds: picked.map((item) => item.id) };
    setSubmitting(true);
    try {
      const response = await fetch('/api/v1/academic/krs/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as SubmitEnvelope | null;

      if (!response.ok || payload?.success !== true) {
        const code = payload?.error?.code ?? String(response.status);
        const message =
          payload?.error?.message ?? t.requestFailed.replace('{status}', String(response.status));
        setOutcome({ kind: 'blocked', code, message });
        return;
      }

      const createdCount = payload.data?.enrollments?.length ?? 0;
      const alreadyCount = payload.data?.alreadyEnrolled?.length ?? 0;
      setPicked([]);
      setDetailClass(null);
      setOutcome({
        kind: 'sent',
        message: t.sentBody
          .replace('{count}', String(createdCount))
          .concat(alreadyCount > 0 ? ` ${t.sentAlready.replace('{count}', String(alreadyCount))}` : ''),
      });
      // Baca-ulang dari server: kursi & status enrollment yang baru ditulis
      // harus tampil dari Primary, bukan dari perkiraan klien.
      startRefresh(() => router.refresh());
    } catch {
      setOutcome({ kind: 'blocked', code: 'NETWORK', message: t.networkFailed });
    } finally {
      setSubmitting(false);
    }
  }, [
    conflicts.length,
    isOverQuota,
    isPeriodOpen,
    maxAllowedSks,
    maxSelectable,
    period.label,
    period.status,
    picked,
    projectedSks,
    periodId,
    startRefresh,
    router,
    t.conflictBlocked,
    t.networkFailed,
    t.quotaAlertBody,
    t.reasonMaxClasses,
    t.reasonPeriodClosed,
    t.requestFailed,
    t.sentAlready,
    t.sentBody,
  ]);

  const dayName = useCallback(
    (value: number): string => t.days[value - 1] ?? String(value),
    [t.days],
  );

  const scheduleLine = useCallback(
    (slot: OpenClassSchedule): string =>
      `${dayName(slot.dayOfWeek)} ${slot.startTime}–${slot.endTime}`,
    [dayName],
  );

  const lecturerLabel = useCallback(
    (names: readonly string[]): string =>
      names.length > 0 ? names.join(', ') : t.noLecturer,
    [t.noLecturer],
  );

  const columns = useMemo<ColumnDef<OpenClassItem>[]>(() => {
    const base: ColumnDef<OpenClassItem>[] = [
      {
        key: 'courseCode',
        header: t.colCode,
        width: '120px',
        render: (cls) => (
          <span className="font-semibold tracking-[-0.01em] text-slate-800 tabular">{cls.courseCode}</span>
        ),
      },
      {
        key: 'courseName',
        header: t.colCourse,
        render: (cls) => (
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-semibold text-[color:var(--sica-text-heading)]">{cls.courseName}</span>
            <span className="truncate text-[12px] text-slate-500">
              {cls.className} · {lecturerLabel(cls.lecturerNames)}
            </span>
          </div>
        ),
      },
      {
        key: 'sks',
        header: t.colSks,
        width: '84px',
        align: 'center',
        render: (cls) => (
          <Badge tone="secondary" look="label" size="sm">
            <span className="tabular">{cls.sks}</span> {t.sksUnit}
          </Badge>
        ),
      },
      {
        key: 'schedule',
        header: t.colSchedule,
        sortValue: (cls) => cls.schedules[0]?.dayOfWeek ?? 0,
        render: (cls) => {
          const isConflicting =
            cls.hasConflict || conflicts.some((conflict) => conflict.a.id === cls.id || conflict.b.id === cls.id);
          const shown = cls.schedules.slice(0, 2);
          const extra = cls.schedules.length - shown.length;
          return (
            <div className="flex flex-col gap-1">
              {shown.length === 0 ? (
                <span className="text-[12px] text-slate-500">{t.noSchedule}</span>
              ) : (
                shown.map((slot, index) => (
                  <span
                    key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}
                    className={cn(
                      'flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700',
                      isConflicting && 'text-[color:var(--sica-warning-hover)]',
                    )}
                  >
                    {isConflicting ? (
                      <AlertTriangle size={14} strokeWidth={2} aria-hidden />
                    ) : (
                      <CalendarDays size={14} strokeWidth={2} aria-hidden className="text-slate-400" />
                    )}
                    <span>{dayName(slot.dayOfWeek)}</span>
                    <span className="tabular text-slate-500">
                      {slot.startTime}–{slot.endTime}
                    </span>
                    <span className="truncate text-slate-500">
                      {slot.roomCode ?? t.noRoom}
                    </span>
                  </span>
                ))
              )}
              {extra > 0 ? (
                <span className="text-[11.5px] text-slate-500">
                  {t.moreSchedules.replace('{n}', String(extra))}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'capacity',
        header: t.colSeats,
        width: '168px',
        sortValue: (cls) => seatRatio(cls.enrolled, cls.capacity),
        render: (cls) => {
          const tone = seatTone(cls.enrolled, cls.capacity);
          const sisa = Math.max(0, cls.capacity - cls.enrolled);
          const pct = Math.round(seatRatio(cls.enrolled, cls.capacity) * 100);
          return (
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-slate-700 tabular">
                  {cls.enrolled}/{cls.capacity}
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold tabular',
                    tone === 'danger'
                      ? 'text-danger-hover'
                      : tone === 'warning'
                        ? 'text-[color:var(--sica-warning-hover)]'
                        : 'text-slate-500',
                  )}
                >
                  {sisa === 0 ? t.seatsFull : t.seatsRemaining.replace('{n}', String(sisa))}
                </span>
              </div>
              <Progress
                value={cls.enrolled}
                max={cls.capacity}
                size="sm"
                tone={tone}
                label={t.seatProgressAria.replace('{pct}', String(pct))}
              />
            </div>
          );
        },
      },
      {
        key: 'status',
        header: t.colStatus,
        width: '148px',
        sortValue: (cls) => rowStatus(cls),
        render: (cls) => <StatusBadge status={rowStatus(cls)} />,
      },
    ];

    if (!canSubmit) return base;

    return [
      ...base,
      {
        key: 'action',
        header: t.colAction,
        width: '168px',
        align: 'right',
        sortable: false,
        render: (cls) => {
          if (isTaken(cls)) {
            return (
              <span className="flex justify-end">
                <Badge tone="neutral" look="label" size="sm">
                  {t.takenAlready}
                </Badge>
              </span>
            );
          }
          const taken = isSelected(cls);
          const reason = blockReason(cls);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant={taken ? 'label' : 'default'}
                disabled={!taken && reason !== null}
                title={taken ? t.releaseHint : (reason ?? t.takeHint)}
                aria-label={
                  taken
                    ? t.releaseAria.replace('{code}', cls.courseCode)
                    : t.takeAria.replace('{code}', cls.courseCode)
                }
                className="transition-all duration-200 ease-velzon active:scale-[0.985]"
                onClick={(event) => {
                  event.stopPropagation();
                  togglePick(cls);
                }}
              >
                {taken ? (
                  <UserMinus size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <UserPlus size={16} strokeWidth={2} aria-hidden />
                )}
                {taken ? t.release : t.take}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="rounded-full"
                aria-label={t.detailAria.replace('{code}', cls.courseCode)}
                title={t.detailHint}
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailClass(cls);
                }}
              >
                <Eye size={16} strokeWidth={2} aria-hidden />
              </Button>
            </div>
          );
        },
      },
    ];
  }, [
    blockReason,
    canSubmit,
    conflicts,
    dayName,
    isTaken,
    isSelected,
    lecturerLabel,
    rowStatus,
    t.colAction,
    t.colCode,
    t.colCourse,
    t.colSchedule,
    t.colSeats,
    t.colSks,
    t.colStatus,
    t.detailAria,
    t.detailHint,
    t.moreSchedules,
    t.noRoom,
    t.noSchedule,
    t.release,
    t.releaseAria,
    t.releaseHint,
    t.seatProgressAria,
    t.seatsFull,
    t.seatsRemaining,
    t.sksUnit,
    t.take,
    t.takeAria,
    t.takeHint,
    t.takenAlready,
    togglePick,
  ]);

  /**
   * Filter dibaca dari keadaan NYATA daftar: `listOpenClasses` hanya memuat
   * `classes.status = 'OPEN'`, jadi menyaring pada status kelas hanya menawarkan
   * pilihan yang tidak mungkin cocok. Yang berbeda per baris adalah status
   * rencana studi mahasiswa (`enrollment_status`), dan itu yang disaring.
   */
  const statusFilter: DataGridFilter<OpenClassItem> = {
    label: t.filterStatusLabel,
    allLabel: t.filterAllStatuses,
    accessor: (cls) => cls.enrolledStatus ?? 'NOT_TAKEN',
    options: [
      { value: 'NOT_TAKEN', label: t.statusNotTaken },
      { value: 'SUBMITTED', label: t.statusSubmitted },
      { value: 'APPROVED', label: t.statusApproved },
      { value: 'EFFECTIVE', label: t.statusEffective },
    ],
  };

  const detailSelected = detailClass ? isSelected(detailClass) : false;
  const detailReason = detailClass ? blockReason(detailClass) : null;
  const entrance = reducedMotion ? undefined : { opacity: 0, y: -6 };

  if (!canSubmit) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="info" title={t.readOnlyTitle}>
          {t.readOnlyBody}
        </Alert>
        <VelzonDataGrid
          ariaLabel={t.gridTitle}
          eyebrow={t.eyebrow.replace('{period}', period.label)}
          title={t.gridTitle}
          subtitle={t.gridSubtitle}
          columns={columns}
          data={classes}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          skeletonRows={6}
          error={gridError}
          emptyState={{
            title: t.emptyTitle,
            description: t.emptyBody,
            actionLabel: t.emptyAction,
            onAction: reload,
          }}
          searchable
          searchPlaceholder={t.searchPlaceholder}
          searchKeys={['courseCode', 'courseName', 'className', 'lecturerNames']}
          filter={statusFilter}
          defaultPageSize={10}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {isOverQuota ? (
            <motion.div
              key="over-quota"
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              exit={entrance}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Alert tone="danger" title={t.quotaAlertTitle}>
                {t.quotaAlertBody
                  .replace('{total}', String(projectedSks))
                  .replace('{max}', String(maxAllowedSks))
                  .replace('{over}', String(projectedSks - maxAllowedSks))}
              </Alert>
            </motion.div>
          ) : null}

          {conflicts.length > 0 ? (
            <motion.div
              key="selection-conflict"
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              exit={entrance}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Alert tone="warning" title={t.conflictAlertTitle.replace('{count}', String(conflicts.length))}>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {conflicts.map((conflict) => (
                    <li key={`${conflict.a.id}-${conflict.b.id}`} className="flex items-start gap-2">
                      <Clock size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
                      <span>
                        {t.conflictRow
                          .replace('{day}', dayName(conflict.dayOfWeek))
                          .replace('{a}', conflict.a.courseCode)
                          .replace('{b}', conflict.b.courseCode)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Alert>
            </motion.div>
          ) : null}

          {outcome ? (
            <motion.div
              key={`outcome-${outcome.kind}-${outcome.code ?? 'ok'}`}
              initial={entrance}
              animate={{ opacity: 1, y: 0 }}
              exit={entrance}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Alert
                tone={outcome.kind === 'sent' ? 'success' : 'danger'}
                title={outcome.kind === 'sent' ? t.sentTitle : t.blockedTitle}
                action={
                  outcome.code ? (
                    <Badge tone={outcome.kind === 'sent' ? 'success' : 'danger'} look="label" size="sm">
                      {outcome.code}
                    </Badge>
                  ) : undefined
                }
              >
                {outcome.message}
                {outcome.kind === 'sent' ? (
                  <span className="mt-1 flex items-center justify-end gap-2 text-[12.5px] text-slate-500">
                    {t.statusUntilDpa}
                    <StatusBadge status="SUBMITTED" look="label" />
                  </span>
                ) : null}
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <VelzonDataGrid
        ariaLabel={t.gridTitle}
        eyebrow={t.eyebrow.replace('{period}', period.label)}
        title={t.gridTitle}
        subtitle={t.gridSubtitle}
        columns={columns}
        data={classes}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={6}
        error={gridError}
        emptyState={{
          title: t.emptyTitle,
          description: t.emptyBody,
          actionLabel: t.emptyAction,
          onAction: reload,
        }}
        searchable
        searchPlaceholder={t.searchPlaceholder}
        searchKeys={['courseCode', 'courseName', 'className', 'lecturerNames']}
        filter={statusFilter}
        defaultPageSize={10}
        onRowOpen={(row) => setDetailClass(row)}
        rowAriaLabel={(row) => t.rowAria.replace('{course}', row.courseName).replace('{class}', row.className)}
        selection={{
          label: t.selectionLabel,
          isSelected,
          onToggle: togglePick,
          isDisabled: (cls) => !isSelected(cls) && blockReason(cls) !== null,
          onSelectMany: (rows, next) => {
            if (!next) {
              changePicked(picked.filter((item) => !rows.some((row) => row.id === item.id)));
              return;
            }
            const additions = rows.filter(
              (row) => !picked.some((item) => item.id === row.id) && blockReason(row) === null,
            );
            changePicked([...picked, ...additions]);
          },
        }}
        actions={
          <>
            <span className="hidden items-center gap-2 text-[12.5px] font-medium text-slate-600 sm:flex">
              <span className="tabular">{pickedSks}</span>
              {t.pickedPrefix.replace('{max}', String(maxAllowedSks))}
            </span>
            {picked.length > 0 ? (
              <Button variant="outline" onClick={() => changePicked([])}>
                {t.clearSelection}
              </Button>
            ) : null}
            <Button
              variant="default"
              disabled={picked.length === 0 || isOverQuota || conflicts.length > 0 || !isPeriodOpen || submitting}
              title={isPeriodOpen ? undefined : t.periodClosedHint}
              className="transition-all duration-200 ease-velzon active:scale-[0.985]"
              onClick={() => void handleSubmit()}
            >
              <Send size={16} strokeWidth={2} aria-hidden />
              {submitting ? t.submitting : t.submit} · <span className="tabular">{projectedSks} {t.sksUnit}</span>
            </Button>
          </>
        }
        toolbar={
          <Button variant="ghost" size="sm" onClick={reload} aria-label={t.reloadAria} title={t.reloadHint}>
            {t.reload}
          </Button>
        }
      />

      <Drawer
        open={detailClass !== null}
        onClose={() => setDetailClass(null)}
        title={detailClass?.courseName ?? t.detailTitle}
        description={
          detailClass
            ? `${detailClass.courseCode} · ${detailClass.className} · ${detailClass.sks} ${t.sksUnit}`
            : undefined
        }
        footer={
          detailClass && !isTaken(detailClass) ? (
            <>
              <Button variant="outline" onClick={() => setDetailClass(null)}>
                {t.detailClose}
              </Button>
              <Button
                variant={detailSelected ? 'label' : 'default'}
                disabled={!detailSelected && detailReason !== null}
                title={detailSelected ? t.releaseHint : (detailReason ?? undefined)}
                className="transition-all duration-200 ease-velzon active:scale-[0.985]"
                onClick={() => {
                  togglePick(detailClass);
                  setDetailClass(null);
                }}
              >
                {detailSelected ? (
                  <>
                    <UserMinus size={16} strokeWidth={2} aria-hidden />
                    {t.releaseSeat}
                  </>
                ) : (
                  <>
                    <UserPlus size={16} strokeWidth={2} aria-hidden />
                    {t.takeSeat}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setDetailClass(null)}>
              {t.detailClose}
            </Button>
          )
        }
      >
        {detailClass ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={rowStatus(detailClass)} look="label" />
              <Badge tone="neutral" size="sm">
                {t.periodLabel.replace('{period}', period.label)}
              </Badge>
              {detailReason && !detailSelected ? (
                <Badge tone="danger" size="sm">
                  {detailReason}
                </Badge>
              ) : null}
            </div>

            <div className="card">
              <div className="card-body flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="section-label">{t.detailSeatTitle}</p>
                  <p className="text-[13px] font-semibold text-[color:var(--sica-text-heading)] tabular">
                    {detailClass.enrolled}/{detailClass.capacity}
                  </p>
                </div>
                <Progress
                  value={detailClass.enrolled}
                  max={detailClass.capacity}
                  tone={seatTone(detailClass.enrolled, detailClass.capacity)}
                  label={t.seatProgressAria.replace('{pct}', String(Math.round(seatRatio(detailClass.enrolled, detailClass.capacity) * 100)))}
                />
                <p className="text-[12.5px] text-slate-500">
                  {detailClass.enrolled >= detailClass.capacity
                    ? t.seatsFullNote
                    : t.seatsRemainingNote.replace('{n}', String(detailClass.capacity - detailClass.enrolled))}
                </p>
              </div>
            </div>

            {detailClass.hasConflict && detailClass.conflictDescription ? (
              <Alert tone="warning" title={t.serverConflictTitle}>
                {detailClass.conflictDescription}
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2.5">
              <DetailRow label={t.detailLecturer}>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {detailClass.lecturerNames.map((name) => (
                    <span key={name} className="flex items-center gap-1.5">
                      <Avatar name={name} size="xs" />
                      <span className="min-w-0">{name}</span>
                    </span>
                  ))}
                  {detailClass.lecturerNames.length === 0 ? t.noLecturer : null}
                </span>
              </DetailRow>
              <DetailRow label={t.detailSchedule}>
                <ul className="flex flex-col items-end gap-1">
                  {detailClass.schedules.length === 0 ? (
                    <li>{t.noSchedule}</li>
                  ) : (
                    detailClass.schedules.map((slot, index) => (
                      <li key={`${slot.dayOfWeek}-${slot.startTime}-${index}`} className="flex items-center gap-1.5">
                        <CalendarDays size={13} strokeWidth={2} aria-hidden className="text-slate-400" />
                        <span>{scheduleLine(slot)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </DetailRow>
              <DetailRow label={t.detailRoom}>
                {detailClass.schedules.map((slot, index) => (
                  <span key={`${slot.startTime}-${index}`}>
                    {index > 0 ? ', ' : ''}
                    {slot.roomCode ?? t.noRoom}
                  </span>
                ))}
                {detailClass.schedules.length === 0 ? t.noRoom : null}
              </DetailRow>
              <DetailRow label={t.detailSks}>
                <span className="tabular">
                  {detailClass.sks} {t.sksUnit}
                </span>
              </DetailRow>
              <DetailRow label={t.detailAfterLoad}>
                <span className="tabular">
                  {takenSks + (detailSelected || isTaken(detailClass) ? 0 : detailClass.sks)}/{maxAllowedSks} {t.sksUnit}
                </span>
              </DetailRow>
            </div>

            <Alert tone="info" title={t.detailHowTitle}>
              {t.detailHowBody}
            </Alert>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
