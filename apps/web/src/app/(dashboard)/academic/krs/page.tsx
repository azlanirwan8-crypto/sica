/**
 * Halaman KRS (/academic/krs) — server component, data NYATA dari PostgreSQL.
 *
 * Menutup G-7/RD-154 (laporan forensik Fase 1): berkas ini sebelumnya
 * `'use client'` dan tidak pernah memanggil API kelas — yang tampil adalah
 * fixture `AVAILABLE_CLASSES` (8 baris fiktif), plafon 24 SKS konstanta, dan
 * tombol "Kirim KRS" yang pasti ber-403 untuk peran non-mahasiswa. Sekarang:
 *  1. Identitas dibaca dari header yang dipasang middleware HANYA dari klaim
 *     token terverifikasi (`apps/web/src/middleware.ts:84`; header kiriman klien
 *     sudah dibuang di :9) — pola yang sama dengan `/dashboard`.
 *  2. Hak ditanyakan ke GRANT berbasis tabel (`user_role_assignments` lewat
 *     `loadEffectiveAccess` + `holdsScoped`), bukan label peran. Yang tidak
 *     memegang `enrollment.krs.view` tidak menerima data sama sekali; yang tidak
 *     memegang `enrollment.krs.submit` menerima daftar hanya-baca tanpa satu
 *     pun tombol aksi (AGENTS §3.8: masking menu bukan penegakan, tapi
 *     affordance palsu juga bukan penegakan — jadi tidak ditawarkan).
 *  3. Kelas, plafon SKS, dan enrollment yang sudah ada dimuat lewat
 *     `loadKrsScreen()` di dalam `withTenantContext` (RLS) pada Primary.
 *
 * Interaksi (pilih kelas + kirim) hidup di `KrsCoursePicker` (komponen klien)
 * yang hanya menerima data lewat props. Wujud layar: loading (skeleton grid),
 * empty, error/degraded (`admin.loadFailed`), dan sukses — docs/UI_UX_DESIGN §9.8.
 */
import React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertTriangle, Gauge, GraduationCap, ShieldAlert, Sigma, Users } from 'lucide-react';
import type { PermissionCode } from '@sica/contracts';
import { PERM } from '@sica/contracts';
import { getDictionary } from '@/lib/i18n';
import { holdsScoped, loadEffectiveAccess, type EffectiveAccess } from '@/modules/authz/rbac-repository';
import {
  loadKrsScreen,
  type KrsClassScheduleView,
  type KrsEnrolledClassView,
  type KrsOpenClassView,
  type KrsScreenPeriod,
} from '@/modules/academic/services/krs-open-classes.service';
import {
  KrsCoursePicker,
  type KrsClassStatus,
  type KrsPeriodInfo,
  type KrsPeriodStatus,
  type KrsScreenError,
  type OpenClassItem,
  type OpenClassSchedule,
} from '@/modules/academic/components/krs-course-picker';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const dict = getDictionary('id');

export const metadata = {
  title: dict.krs.metaTitle,
  description: dict.krs.metaDescription,
};

/** Batas kelas per pengajuan — sama dengan `KrsSubmitRequestSchema` (`classIds.max(10)`). */
const MAX_CLASSES_PER_SUBMIT = 10;

const DATE_FORMAT = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'UTC' });

function periodStatusOf(value: string): KrsPeriodStatus {
  switch (value) {
    case 'OPEN':
      return 'OPEN';
    case 'CLOSING':
      return 'CLOSING';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'DRAFT';
  }
}

/** Kolom `date` PostgreSQL ('YYYY-MM-DD') → label tanggal Indonesia, tanpa pergeseran zona. */
function formatDate(value: string): string {
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(parsed) ? value : DATE_FORMAT.format(new Date(parsed));
}

function toScheduleList(
  schedules: readonly KrsClassScheduleView[],
): readonly OpenClassSchedule[] {
  return schedules.map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomCode: slot.roomCode,
  }));
}

/** Proyeksi item API → baris grid. Status selalu OPEN karena query menyaringnya. */
function toPickerItem(
  view: KrsOpenClassView,
  enrolledStatus: string | null,
): OpenClassItem {
  const status: KrsClassStatus = 'OPEN';
  return {
    id: view.classId,
    courseCode: view.courseCode,
    courseName: view.courseName,
    className: view.className,
    sks: view.sks,
    lecturerNames: view.lecturerNames,
    schedules: toScheduleList(view.schedules),
    capacity: view.capacity,
    enrolled: view.enrolledCount,
    status,
    enrolledStatus,
    hasConflict: view.hasConflict,
    conflictDescription: view.conflictDescription,
  };
}

function dayLabel(days: readonly string[], value: number): string {
  return days[value - 1] ?? String(value);
}

function scheduleSummary(
  days: readonly string[],
  schedules: readonly OpenClassSchedule[],
): string {
  if (schedules.length === 0) return dict.krs.noSchedule;
  const first = schedules[0];
  if (!first) return dict.krs.noSchedule;
  const rest = schedules.length - 1;
  const base = `${dayLabel(days, first.dayOfWeek)} ${first.startTime}–${first.endTime}`;
  return rest > 0 ? `${base} · ${dict.krs.moreSchedules.replace('{n}', String(rest))}` : base;
}

/** Keadaan "tidak ada hak": tanpa data, tanpa tombol. */
function NotYourArea({ code }: { readonly code: PermissionCode }) {
  const t = dict.krs;
  return (
    <div className="animate-fade-up flex flex-col gap-6">
      <PageHeader
        title={t.title}
        description={t.description}
        crumbs={[{ label: t.crumbHome, href: '/dashboard' }, { label: t.crumbAcademic }, { label: t.crumbKrs }]}
      />
      <Card>
        <CardHeader>
          <CardHeading>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert size={17} strokeWidth={2} aria-hidden />
              {t.notYourAreaTitle}
            </CardTitle>
            <CardDescription>{t.notYourAreaBody}</CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <MetaRow items={[{ label: t.requiredPermission, value: code }]} />
        </CardContent>
      </Card>
    </div>
  );
}

function EnrolledTable({ rows }: { readonly rows: readonly KrsEnrolledClassView[] }) {
  const t = dict.krs;
  const days = t.days;
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t.colCode}</TH>
          <TH>{t.colCourse}</TH>
          <TH>{t.colSks}</TH>
          <TH>{t.colSchedule}</TH>
          <TH>{t.colStatus}</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((row) => (
          <TR key={row.classId}>
            <TD>
              <span className="font-semibold tabular">{row.courseCode}</span>
            </TD>
            <TD>
              <span className="block truncate font-medium text-[color:var(--sica-text-heading)]">{row.courseName}</span>
              <span className="block text-[12px] text-slate-500">{row.className}</span>
            </TD>
            <TD>
              <span className="tabular">{row.sks}</span> {t.sksUnit}
            </TD>
            <TD>{scheduleSummary(days, toScheduleList(row.schedules))}</TD>
            <TD>
              <StatusBadge status={row.status} look="label" />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

export default async function KrsPage() {
  const t = dict.krs;
  const h = await headers();
  const tenantId = h.get('x-tenant-id');
  const userId = h.get('x-user-id');

  // Middleware sudah menolak token cacat; ini penjaga kedua agar halaman tidak
  // pernah merender data tenant lain bila header konteks hilang (pola /dashboard).
  if (!tenantId || !userId) redirect('/login?redirect=/academic/krs');

  // ── L3/L4: hak dibaca dari tabel penugasan, bukan dari label peran ──
  let access: EffectiveAccess | null = null;
  let guardMessage: string | null = null;
  try {
    access = await loadEffectiveAccess(tenantId, userId);
  } catch (error) {
    guardMessage = error instanceof Error ? error.message : 'Basis data tidak dapat dihubungi.';
  }

  // `let` tidak menyempit lewat boolean perantara, jadi dibaca sekali sebagai const.
  const grants: EffectiveAccess | null = access;
  const canView = grants !== null && holdsScoped(grants, PERM.enrollmentKrsView);
  const canSubmit = grants !== null && holdsScoped(grants, PERM.enrollmentKrsSubmit);

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      title={t.title}
      description={t.description}
      crumbs={[{ label: t.crumbHome, href: '/dashboard' }, { label: t.crumbAcademic }, { label: t.crumbKrs }]}
      actions={actions}
    />
  );

  if (!canView) {
    // Tanpa izin baca: tidak ada satu query kelas pun, tidak ada tombol.
    return (
      <div className="animate-fade-up flex flex-col gap-6">
        {header()}
        {guardMessage ? (
          <Alert tone="danger" title={t.loadFailedTitle}>
            {dict.admin.loadFailed.replace('{message}', guardMessage)}
          </Alert>
        ) : null}
        <NotYourArea code={PERM.enrollmentKrsView} />
      </div>
    );
  }

  const screen = await loadKrsScreen(tenantId, userId);

  const periodView: KrsScreenPeriod | null = screen.ok ? screen.data.period : null;
  const periodInfo: KrsPeriodInfo | null = periodView
    ? { label: periodView.label, status: periodStatusOf(periodView.status), endsAtLabel: formatDate(periodView.endsOn) }
    : null;

  // Pesan kegagalan muat memakai kunci yang sudah ada (`admin.loadFailed`) —
  // kunci UI tidak boleh diduplikasi per layar (AGENTS §3.5).
  const failedCopy = (message: string): string =>
    dict.admin.loadFailed.replace('{message}', message);

  const pickerError: KrsScreenError | null = !screen.ok
    ? { code: 'LOAD_FAILED', message: failedCopy(screen.message) }
    : guardMessage
      ? { code: 'RBAC_UNAVAILABLE', message: failedCopy(guardMessage) }
      : null;

  return (
    <div className="animate-fade-up flex flex-col gap-6">
      {header(
        periodInfo ? (
          <Badge tone={periodInfo.status === 'OPEN' ? 'success' : 'warning'} look="label" size="sm">
            {periodInfo.label} · {periodInfo.status}
          </Badge>
        ) : undefined,
      )}

      {screen.ok && screen.data.identity === null ? (
        <Alert tone="warning" title={t.noStudentTitle}>
          {t.noStudentBody}
        </Alert>
      ) : null}

      {screen.ok && screen.data.period === null ? (
        <Alert tone="info" title={t.noPeriodTitle}>
          {t.noPeriodBody}
        </Alert>
      ) : null}

      {screen.ok && screen.data.quota?.blockedReason ? (
        <Alert tone="danger" title={t.quotaBlockedTitle}>
          {screen.data.quota.blockedReason}
        </Alert>
      ) : null}

      {screen.ok && screen.data.truncated ? (
        <Alert tone="warning" title={t.degradedTitle}>
          {t.degradedBody
            .replace('{shown}', String(screen.data.classes.length))
            .replace('{total}', String(screen.data.totalClasses))}
        </Alert>
      ) : null}

      {screen.ok ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={t.plafonTitle}
            value={screen.data.quota ? `${screen.data.quota.maxAllowedSks} ${t.sksUnit}` : '—'}
            hint={t.plafonHint}
            icon={<GraduationCap size={17} strokeWidth={2} aria-hidden />}
          />
          <StatCard
            label={t.takenTitle}
            value={`${screen.data.usedSks} ${t.sksUnit}`}
            hint={t.takenHint.replace('{count}', String(screen.data.enrolled.length))}
            icon={<Sigma size={17} strokeWidth={2} aria-hidden />}
          />
          <StatCard
            label={t.remainingTitle}
            value={
              screen.data.quota
                ? `${Math.max(0, screen.data.quota.remainingSks)} ${t.sksUnit}`
                : '—'
            }
            hint={
              screen.data.quota
                ? t.remainingHint
                    .replace('{max}', String(screen.data.quota.maxAllowedSks))
                    .replace('{used}', String(screen.data.usedSks))
                : t.remainingUnknown
            }
            icon={<Gauge size={17} strokeWidth={2} aria-hidden />}
          />
        </div>
      ) : null}

      {screen.ok && screen.data.enrolled.length > 0 ? (
        <Card>
          <CardHeader className="flex-wrap items-start">
            <CardHeading>
              <CardTitle className="flex items-center gap-2">
                <Users size={17} strokeWidth={2} aria-hidden />
                {t.enrolledTitle}
              </CardTitle>
              <CardDescription>{t.enrolledSubtitle}</CardDescription>
            </CardHeading>
            <Badge tone="info" look="label" size="sm">
              <AlertTriangle size={13} strokeWidth={2} aria-hidden />
              {t.enrolledHint}
            </Badge>
          </CardHeader>
          <CardContent>
            <EnrolledTable rows={screen.data.enrolled} />
          </CardContent>
        </Card>
      ) : null}

      {periodInfo === null && !screen.ok ? (
        /* Muat gagal: grid tetap ditampilkan (ada keadaan error + muat ulang di
           sisi klien) tetapi tanpa satu pun affordance aksi — plafon tidak
           dikenal, jadi kirim pun tidak masuk akal. */
        <KrsCoursePicker
          periodId=""
          period={{ label: t.periodUnknown, status: 'DRAFT', endsAtLabel: '—' }}
          classes={[]}
          maxAllowedSks={0}
          takenSks={0}
          maxSelectable={MAX_CLASSES_PER_SUBMIT}
          canSubmit={false}
          error={pickerError}
        />
      ) : periodInfo !== null ? (
        <KrsCoursePicker
          periodId={periodView ? periodView.id : ''}
          period={periodInfo}
          classes={
            screen.ok
              ? screen.data.classes.map((view) =>
                  toPickerItem(
                    view,
                    screen.data.enrolled.find((row) => row.classId === view.classId)?.status ?? null,
                  ),
                )
              : []
          }
          maxAllowedSks={screen.ok && screen.data.quota ? screen.data.quota.maxAllowedSks : 0}
          takenSks={screen.ok ? screen.data.usedSks : 0}
          maxSelectable={MAX_CLASSES_PER_SUBMIT}
          canSubmit={canSubmit && screen.ok}
          error={pickerError}
        />
      ) : (
        /* Periode belum ada / akun tidak tertaut mahasiswa → daftar apa pun
           akan menjadi karangan, jadi tidak ada aksi yang ditawarkan. */
        <Alert tone="info" title={t.notYourAreaTitle}>
          {t.noDataNoAction}
        </Alert>
      )}
    </div>
  );
}
