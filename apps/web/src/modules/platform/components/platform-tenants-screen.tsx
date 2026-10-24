'use client';

/**
 * Layar "Institusi & Provisioning" (API_SPEC §4.20, pemegang kontrak M-01).
 *
 * Yang ditegakkan di sini, dan hanya di sini:
 *  - `Idempotency-Key` dikirim sekali per sesi wizard dan dipakai ulang sampai
 *    permintaan sukses — replay dengan isi berbeda = 409, bukan tenant kembar.
 *  - Payload divalidasi dengan skema kontrak yang sama dipakai server (L1), lalu
 *    `details[]` dari server dipetakan balik ke error per kolom.
 *  - Aksi tulis menuntut sesi MFA; 401 `MFA_REQUIRED` ditampilkan sebagai sebab,
 *    bukan sebagai kegagalan tak dikenal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CircleSlash,
  Eye,
  FileSearch,
  History,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MODULE_CODES, ProvisionTenantRequestSchema } from '@sica/contracts';
import type { ProvisionTenantRequest } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { describeFailure, formatStamp, issuesByField, apiRequest } from '@/lib/api-client';

interface TenantRow {
  tenantId: string;
  slug: string;
  legalName: string;
  status: string;
  createdAt: string;
}

interface TenantDetail {
  tenantId: string;
  slug: string;
  legalName: string;
  status: string;
  createdAt: string;
  modulesActive: number;
  modulesTotal: number;
  rolesSeeded: number;
  subscription: { status: string; planId: string; trialEndsAt: string | null } | null;
}

interface ProvisionOutcome {
  tenantId: string;
  slug: string;
  status: string;
  adminUserId: string;
  rolesSeeded: number;
  modulesActivated: number;
}

type TransitionTarget = 'suspend' | 'reinstate';

const EMPTY_FORM = {
  slug: '',
  legalName: '',
  adminEmail: '',
  adminFullName: '',
  adminInitialPassword: '',
  initialMemberCode: 'ADMIN01',
  reason: '',
};

export function PlatformTenantsScreen() {
  const t = getDictionary('id').platform;

  const [rows, setRows] = useState<readonly TenantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [modules, setModules] = useState<readonly string[]>(['identity', 'academic', 'teaching', 'assessment', 'audit']);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger' | 'info'; title: string; body: string } | null>(null);
  const [outcome, setOutcome] = useState<ProvisionOutcome | null>(null);

  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);

  const [transition, setTransition] = useState<{ row: TenantRow; target: TransitionTarget } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const result = await apiRequest<readonly TenantRow[]>('/api/v1/platform/tenants', { query: { limit: 200 } });
    if (result.ok) {
      setRows(result.data);
    } else {
      setRows([]);
      setLoadError(describeFailure(result, t));
    }
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submitProvision() {
    setBanner(null);
    const payload: ProvisionTenantRequest = {
      slug: form.slug,
      legalName: form.legalName,
      adminEmail: form.adminEmail,
      adminFullName: form.adminFullName,
      adminInitialPassword: form.adminInitialPassword,
      initialMemberCode: form.initialMemberCode || undefined,
      moduleCodes: [...modules],
      reason: form.reason,
    };

    const parsed = ProvisionTenantRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]))
      );
      setBanner({ tone: 'danger', title: t.formInvalid, body: parsed.error.issues[0]?.message ?? '' });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    const result = await apiRequest<ProvisionOutcome>('/api/v1/platform/tenants', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey },
      body: payload,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setFieldErrors(issuesByField(result.issues));
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }

    setOutcome(result.data);
    setBanner({ tone: 'success', title: t.provisionOk, body: `${result.data.slug} · ${result.data.status}` });
    setIdempotencyKey(crypto.randomUUID());
    setForm(EMPTY_FORM);
    setModules(['identity', 'academic', 'teaching', 'assessment', 'audit']);
    void load();
  }

  const openDetail = useCallback(
    async (row: TenantRow) => {
      setDetailOpen(true);
      setDetailBusy(true);
      setDetail(null);
      const result = await apiRequest<TenantDetail>(`/api/v1/platform/tenants/${row.tenantId}`);
      if (result.ok) setDetail(result.data);
      else setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      setDetailBusy(false);
    },
    [t]
  );

  function askTransition(row: TenantRow, target: TransitionTarget) {
    setTransition({ row, target });
    setTransitionReason('');
  }

  async function runTransition() {
    if (!transition) return;
    setIsTransitioning(true);
    const path = `/api/v1/platform/tenants/${transition.row.tenantId}/${transition.target}`;
    const result = await apiRequest<unknown>(path, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: { reason: transitionReason },
    });
    setIsTransitioning(false);

    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setBanner({ tone: 'success', title: t.transitionOk, body: `${transition.row.slug} → ${transition.target === 'suspend' ? 'SUSPENDED' : 'ACTIVE'}` });
    setTransition(null);
    void load();
  }

  const columns = useMemo<readonly ColumnDef<TenantRow>[]>(
    () => [
      {
        key: 'legalName',
        header: t.colInstitution,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">{row.legalName}</p>
            <p className="text-[11.5px] tabular text-[color:var(--sica-text-muted)]">{row.slug}</p>
          </div>
        ),
      },
      { key: 'status', header: t.colStatus, align: 'center', valueType: 'status' },
      {
        key: 'createdAt',
        header: t.colCreated,
        sortValue: (row) => row.createdAt,
        render: (row) => <span className="text-[12.5px] tabular text-slate-500">{formatStamp(row.createdAt)}</span>,
      },
    ],
    [t]
  );

  const rowActions = useMemo<readonly DataGridRowAction<TenantRow>[]>(
    () => [
      { id: 'detail', label: t.detailTitle, icon: <Eye size={16} strokeWidth={2} aria-hidden />, onSelect: (row) => void openDetail(row) },
      {
        id: 'suspend',
        label: t.suspend,
        tone: 'danger',
        icon: <CircleSlash size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.status === 'SUSPENDED' || row.status === 'ARCHIVED',
        onSelect: (row) => askTransition(row, 'suspend'),
      },
      {
        id: 'reinstate',
        label: t.reinstate,
        icon: <RotateCcw size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.status === 'ACTIVE' || row.status === 'ARCHIVED',
        onSelect: (row) => askTransition(row, 'reinstate'),
      },
      {
        id: 'audit',
        label: t.openAudit,
        icon: <FileSearch size={16} strokeWidth={2} aria-hidden />,
        onSelect: (row) => {
          window.location.href = `/platform/audit?tenantId=${row.tenantId}`;
        },
      },
    ],
    [t, openDetail]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.tenantsTitle}
        description={t.tenantsSubtitle}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbPlatform }, { label: t.crumbTenants }]}
        actions={
          <Button variant="default" size="sm" onClick={() => setWizardOpen(true)}>
            <Plus size={15} strokeWidth={2} aria-hidden />
            {t.newTenant}
          </Button>
        }
      />

      {banner ? (
        <Alert tone={banner.tone} title={banner.title}>
          {banner.body}
        </Alert>
      ) : null}

      {outcome ? (
        <section className="card">
          <div className="card-header">
            <div className="flex flex-col gap-0.5">
              <p className="section-label">{t.provisionTitle}</p>
              <h3 className="card-title">{outcome.slug}</h3>
            </div>
            <Badge tone="success" look="label" size="sm" className="ml-auto">
              <ShieldCheck size={13} strokeWidth={2} aria-hidden />
              {outcome.status}
            </Badge>
          </div>
          <div className="px-5 py-4">
            <MetaRow
              items={[
                { label: t.rolesSeeded, value: String(outcome.rolesSeeded) },
                { label: t.modulesActivated, value: String(outcome.modulesActivated) },
                { label: 'tenantId', value: outcome.tenantId },
              ]}
            />
          </div>
        </section>
      ) : null}

      <VelzonDataGrid
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.tenantId}
        searchKeys={['legalName', 'slug', 'status']}
        searchPlaceholder={t.colInstitution}
        filter={{
          label: t.colStatus,
          accessor: (row) => row.status,
          options: [
            { value: 'ONBOARDING', label: 'ONBOARDING' },
            { value: 'ACTIVE', label: 'ACTIVE' },
            { value: 'SUSPENDED', label: 'SUSPENDED' },
            { value: 'ARCHIVED', label: 'ARCHIVED' },
          ],
        }}
        actions={
          <Button variant="soft" size="sm" onClick={() => void load()}>
            <History size={15} strokeWidth={2} aria-hidden />
            {t.reload}
          </Button>
        }
        isLoading={isLoading}
        error={loadError ? { message: loadError, code: 'PLATFORM_TENANTS', retryLabel: t.reload, onRetry: () => void load() } : null}
        emptyMessage={t.empty}
        rowActions={rowActions}
        ariaLabel={t.tenantsTitle}
      />

      {/* ── Wizard provisioning ── */}
      <Drawer
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title={t.provisionTitle}
        description={t.provisionHint}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[11.5px] tabular text-[color:var(--sica-text-muted)]">Idempotency-Key · {idempotencyKey.slice(0, 8)}…</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(false)}>
                {t.close}
              </Button>
              <Button variant="default" size="sm" disabled={isSubmitting} onClick={() => void submitProvision()}>
                <Sparkles size={15} strokeWidth={2} aria-hidden />
                {isSubmitting ? t.provisionBusy : t.provisionSubmit}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fSlug} htmlFor="p-slug" required error={fieldErrors['slug']} hint={t.slugHint}>
              <Input id="p-slug" value={form.slug} onChange={(e) => setField('slug', e.target.value)} placeholder="unikomo" />
            </Field>
            <Field label={t.fLegalName} htmlFor="p-legal" required error={fieldErrors['legalName']}>
              <Input id="p-legal" value={form.legalName} onChange={(e) => setField('legalName', e.target.value)} placeholder="Universitas Nurul Fikri" />
            </Field>
            <Field label={t.fAdminEmail} htmlFor="p-email" required error={fieldErrors['adminEmail']}>
              <Input id="p-email" type="email" value={form.adminEmail} onChange={(e) => setField('adminEmail', e.target.value)} placeholder="admin@kampus.test" />
            </Field>
            <Field label={t.fAdminFullName} htmlFor="p-name" required error={fieldErrors['adminFullName']}>
              <Input id="p-name" value={form.adminFullName} onChange={(e) => setField('adminFullName', e.target.value)} placeholder="Administrator Pertama" />
            </Field>
            <Field label={t.fAdminPassword} htmlFor="p-pass" required error={fieldErrors['adminInitialPassword']} hint={t.passwordHint}>
              <Input id="p-pass" type="password" value={form.adminInitialPassword} onChange={(e) => setField('adminInitialPassword', e.target.value)} />
            </Field>
            <Field label={t.fMemberCode} htmlFor="p-code" error={fieldErrors['initialMemberCode']}>
              <Input id="p-code" value={form.initialMemberCode} onChange={(e) => setField('initialMemberCode', e.target.value)} />
            </Field>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="field-label">{t.fModules}</legend>
            <div className="flex flex-wrap gap-2">
              {MODULE_CODES.map((code) => {
                const active = modules.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setModules((prev) => (active ? prev.filter((c) => c !== code) : [...prev, code]))}
                    className={
                      active
                        ? 'btn-soft-primary rounded-full border border-primary/25 px-3 py-1.5 text-[12px] font-semibold'
                        : 'rounded-full border border-[color:var(--sica-border-color)] px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50/70'
                    }
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field label={t.fReason} htmlFor="p-reason" required error={fieldErrors['reason']} hint={t.reasonPlaceholder}>
            <Textarea id="p-reason" value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
          </Field>
        </div>
      </Drawer>

      {/* ── Detail institusi ── */}
      <Drawer open={detailOpen} onClose={() => setDetailOpen(false)} title={t.detailTitle} description={detail?.legalName}>
        {detailBusy ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <MetaRow
                items={[
                  { label: t.colSlug, value: detail.slug },
                  { label: t.currentStatus, value: detail.status },
                ]}
              />
              <StatusBadge status={detail.status} look="label" />
            </div>
            <MetaRow
              items={[
                { label: t.colModules, value: `${detail.modulesActive} / ${detail.modulesTotal}` },
                { label: t.colRoles, value: String(detail.rolesSeeded) },
              ]}
            />
            <MetaRow
              items={[
                { label: t.colSubscription, value: detail.subscription ? detail.subscription.status : '—' },
                { label: t.colCreated, value: formatStamp(detail.createdAt) },
              ]}
            />
            <Link
              href={`/platform/audit?tenantId=${detail.tenantId}`}
              className="btn-soft-secondary inline-flex w-fit items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold"
            >
              <FileSearch size={15} strokeWidth={2} aria-hidden />
              {t.openAudit}
            </Link>
          </div>
        ) : (
          <p className="text-[13px] text-[color:var(--sica-text-muted)]">{t.detailEmpty}</p>
        )}
      </Drawer>

      {/* ── Transisi status ── */}
      <Drawer
        open={transition !== null}
        onClose={() => setTransition(null)}
        title={transition?.target === 'suspend' ? t.suspend : t.reinstate}
        description={t.transitionHint}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransition(null)}>
              {t.close}
            </Button>
            <Button
              variant={transition?.target === 'suspend' ? 'destructive' : 'default'}
              size="sm"
              disabled={isTransitioning || transitionReason.trim().length < 10}
              onClick={() => void runTransition()}
            >
              {isTransitioning ? t.transitionBusy : t.save}
            </Button>
          </div>
        }
      >
        {transition ? (
          <div className="flex flex-col gap-4">
            <MetaRow
              items={[
                { label: t.colInstitution, value: transition.row.legalName },
                { label: t.currentStatus, value: transition.row.status },
              ]}
            />
            <Field label={t.fReason} htmlFor="tr-reason" hint={t.reasonPlaceholder}>
              <Textarea id="tr-reason" value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
