import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  UserCheck,
} from 'lucide-react';
import { getDictionary } from '@/lib/i18n';
import { loadDashboard, type DashboardStatCard, type TodayClassRow } from '@/modules/academic/services/dashboard.service';
import { menuHref, QUICK_ACTIONS_BY_SURFACE } from '@/modules/authz/menu';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

const dict = getDictionary('id');

export const metadata = {
  title: dict.dashboard.metaTitle,
  description: dict.dashboard.metaDescription,
};

/**
 * Ikon kartu statistik. Service mengembalikan 4 kartu untuk semua peran, jadi
 * urutannya stabil dan ikon cukup dipetakan per posisi (bukan lewat menebak
 * label string).
 */
const CARD_ICONS: readonly React.ReactNode[] = [
  <Award key="capaian" size={16} strokeWidth={2} aria-hidden />,
  <BookOpen key="beban" size={16} strokeWidth={2} aria-hidden />,
  <CalendarCheck2 key="presensi" size={16} strokeWidth={2} aria-hidden />,
  <UserCheck key="status" size={16} strokeWidth={2} aria-hidden />,
];

/** Status sesi kelas bukan enum kanonik `docs/DATA_MODEL.md §15` — dipetakan eksplisit. */
const CLASS_TONE: Record<TodayClassRow['tone'], NonNullable<BadgeProps['tone']>> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
};

/** Kartu yang menandakan perlu perhatian (tone dari service, bukan tebakan warna). */
const STAT_ATTENTION_TONES: readonly DashboardStatCard['tone'][] = ['warning'];

/**
 * Pintasan Dashboard menunjuk `code` menu, bukan URL, dan **disaring per permukaan**
 * (`QUICK_ACTIONS_BY_SURFACE` di `modules/authz/menu.ts`). Daftar tunggal yang
 * lama menawarkan "Pengisian KRS" kepada Admin SICA dan Admin IT Kampus — aksi
 * yang grant-nya hanya dimiliki STUDENT dan layarnya masih mock (`RD-154`).
 * Path dihitung `menuHref` dari `route_key` baris menu, sehingga "layar mana yang
 * sudah ada" tetap punya satu pemilik (`route-keys.ts`) setelah menu menjadi data.
 */

export default async function DashboardPage() {
  const t = dict.dashboard;
  const h = await headers();
  const tenantId = h.get('x-tenant-id');
  const userId = h.get('x-user-id');

  // Middleware sudah menolak token cacat; ini penjaga kedua agar halaman tidak
  // pernah merender data tenant lain bila header konteks hilang.
  if (!tenantId || !userId) redirect('/login?redirect=/dashboard');

  const view = await loadDashboard(tenantId, userId);
  if (!view) redirect('/login?redirect=/dashboard');

  const classLabel: Record<TodayClassRow['status'], string> = {
    SELESAI: t.classDone,
    BERLANGSUNG: t.classRunning,
    MENDATANG: t.classUpcoming,
  };

  const attention = view.cards.filter((card) => STAT_ATTENTION_TONES.includes(card.tone));
  const scheduleHref = menuHref('akademik.schedule');
  const isAkademik = view.surface === 'akademik';
  const quickActions = QUICK_ACTIONS_BY_SURFACE[view.surface].map((action) => ({
    ...action,
    href: menuHref(action.menuCode),
    title: (dict.navigation as Record<string, string>)[action.labelKey] ?? action.labelKey,
    desc: action.descKey ? dict.dashboard[action.descKey as keyof typeof dict.dashboard] : undefined,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${t.welcome}, ${view.greetingName}`}
        description={view.identityLine}
        actions={
          <Badge tone="primary" look="label" size="lg">
            <CalendarDays size={13} strokeWidth={2} aria-hidden />
            {view.activePeriodLabel}
          </Badge>
        }
      />

      {attention.length > 0 ? (
        <Alert tone="warning" title={t.attentionTitle}>
          <p>{t.attentionBody.replace('{items}', attention.map((card) => card.label).join(' · '))}</p>
        </Alert>
      ) : null}

      {view.cards.length === 0 ? (
        <Alert tone="info" title={t.noSummaryTitle}>
          <p>{t.noSummaryBody}</p>
        </Alert>
      ) : (
        <section aria-label={t.summaryAria} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {view.cards.map((card, index) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.badge}
              icon={CARD_ICONS[index] ?? CARD_ICONS[0]}
            />
          ))}
        </section>
      )}

      <section
        aria-label={t.scheduleActionsAria}
        className={isAkademik ? 'grid gap-6 xl:grid-cols-[1.45fr_1fr]' : 'grid gap-6'}
      >
        {/* Jadwal kuliah bukan milik layar IT (§17.2.6); menyembunyikannya lebih
            jujur daripada menampilkan "Tidak ada kelas terjadwal" yang benar
            tetapi tidak relevan. */}
        {isAkademik ? (
        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>{t.scheduleTitle}</CardTitle>
              <CardDescription>
                {view.todayClasses.length > 0
                  ? t.scheduleCount.replace('{count}', String(view.todayClasses.length))
                  : t.scheduleNone}
              </CardDescription>
            </CardHeading>
            {scheduleHref ? (
              <Link
                href={scheduleHref}
                className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary-hover transition-colors duration-200 ease-velzon hover:text-primary-active"
              >
                {t.viewAll}
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
          </CardHeader>

          {view.todayClasses.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <CalendarOff size={18} strokeWidth={2} aria-hidden />
              </span>
              <p className="text-sm font-semibold text-[color:var(--sica-text-heading)]">
                {t.scheduleEmptyTitle}
              </p>
              <p className="max-w-sm text-[13px] leading-relaxed text-[color:var(--sica-text-muted)]">
                {t.scheduleEmptyBody}
              </p>
            </div>
          ) : (
            <Table>
              <THead>
                <TH>{t.colTime}</TH>
                <TH>{t.colCourse}</TH>
                <TH>{t.colLecturer}</TH>
                <TH align="right">{t.colStatus}</TH>
              </THead>
              <TBody>
                {view.todayClasses.map((item) => (
                  <TR key={`${item.code}-${item.time}`}>
                    <TD className="whitespace-nowrap text-[13px] font-medium tabular text-[color:var(--sica-text-body)]">
                      {item.time}
                      <span className="block text-[12px] font-normal text-[color:var(--sica-text-muted)]">
                        {item.room}
                      </span>
                    </TD>
                    <TD>
                      <span className="block text-[12px] font-semibold tabular text-primary-hover">
                        {item.code}
                      </span>
                      <span className="block text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">
                        {item.name}
                      </span>
                    </TD>
                    <TD className="text-[13px] text-[color:var(--sica-text-body)]">{item.lecturer}</TD>
                    <TD align="right">
                      <Badge tone={CLASS_TONE[item.tone]} look="label">
                        {classLabel[item.status]}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardHeading>
              <CardTitle>{t.quickActions}</CardTitle>
              <CardDescription>{t.quickActionsHint}</CardDescription>
            </CardHeading>
          </CardHeader>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            {quickActions.map((action) => {
              const inner = (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
                    <i className={`${action.icon} text-base`} aria-hidden />
                  </span>
                  <span className="text-[13.5px] font-semibold text-[color:var(--sica-text-heading)]">
                    {action.title}
                  </span>
                  {action.desc ? (
                    <span className="text-[12.5px] leading-relaxed text-[color:var(--sica-text-muted)]">
                      {action.desc}
                    </span>
                  ) : null}
                </>
              );
              // Layar yang belum dibangun tetap terlihat tetapi tidak dapat diklik —
              // sama seperti perlakuan navigasi kiri, supaya tidak ada janji 404.
              return action.href ? (
                <Link key={action.menuCode} href={action.href} className="card card-hover flex flex-col gap-2 p-5">
                  {inner}
                </Link>
              ) : (
                <div
                  key={action.menuCode}
                  className="card flex flex-col gap-2 p-5 opacity-70"
                  aria-disabled="true"
                >
                  {inner}
                  <span>
                    <Badge tone="neutral" look="label" size="sm">
                      {dict.navigation.soon}
                    </Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
