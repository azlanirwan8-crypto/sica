'use client';

/**
 * Layar "Dukungan Terawasi" (0083 `impersonation_grants`, API_SPEC §4.20 baris grant).
 *
 * Batas yang ditampilkan apa adanya: TTL dipangkas server ke maksimum 30 menit,
 * grant hanya terbit untuk pengguna yang terbukti menjadi anggota tenant target,
 * dan setiap grant (termasuk pencabutannya) menjadi baris audit di tenant target.
 * Riwayat lengkap per institusi tidak ditipu dari memori browser — ia dibaca lewat
 * layar Audit Lintas Institusi pada entitas `impersonation_grants`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Hourglass, LogOut, Stethoscope } from 'lucide-react';
import { CreateImpersonationGrantRequestSchema } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { describeFailure, formatStamp, issuesByField, apiRequest } from '@/lib/api-client';

interface GrantView {
  grantId: string;
  tenantId: string;
  grantKind: string;
  scope: string;
  state: string;
  reason: string;
  expiresAt: string;
}

interface TenantOption {
  tenantId: string;
  slug: string;
  legalName: string;
  status: string;
}

const EMPTY = {
  targetTenantSlug: '',
  targetTenantId: '',
  targetUserId: '',
  reason: '',
  ticketId: '',
  ttlMinutes: '15',
};

function remainingMs(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now();
}

function countdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function PlatformSupportScreen() {
  const t = getDictionary('id').platform;

  const [tenants, setTenants] = useState<readonly TenantOption[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [scope, setScope] = useState<'READ_ONLY' | 'HELPDESK_REPAIR'>('READ_ONLY');
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; title: string; body: string } | null>(null);
  const [grants, setGrants] = useState<readonly GrantView[]>([]);
  const [, setTick] = useState(0);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const result = await apiRequest<readonly TenantOption[]>('/api/v1/platform/tenants', { query: { limit: 200 } });
      if (result.ok) setTenants(result.data);
    })();
  }, []);

  // Hitung mundur jalan sendiri; grant yang lewat TTL tetap tampil berstatus kedaluwarsa
  // karena state akhirnya ditulis server, bukan oleh browser.
  useEffect(() => {
    if (grants.length === 0) return;
    const id = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [grants.length]);

  const setField = (key: keyof typeof EMPTY, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setBanner(null);
    const payload = {
      targetTenantSlug: form.targetTenantSlug || undefined,
      targetTenantId: form.targetTenantId || undefined,
      targetUserId: form.targetUserId,
      reason: form.reason,
      scope,
      ticketId: form.ticketId || undefined,
      ttlMinutes: Number(form.ttlMinutes) || 15,
    };

    const parsed = CreateImpersonationGrantRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      setBanner({ tone: 'danger', title: t.formInvalid, body: parsed.error.issues[0]?.message ?? '' });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    const result = await apiRequest<GrantView>('/api/v1/platform/impersonation-grants', {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: payload,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setFieldErrors(issuesByField(result.issues));
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setBanner({ tone: 'success', title: t.grantOk, body: `${result.data.scope} · ${result.data.state}` });
    setGrants((prev) => [result.data, ...prev]);
    setForm(EMPTY);
  }

  const revoke = useCallback(
    async (grant: GrantView) => {
      setBanner(null);
      setRevokingId(grant.grantId);
      const result = await apiRequest<{ grantId: string; state: string }>(
        `/api/v1/platform/impersonation-grants/${grant.grantId}`,
        {
          method: 'DELETE',
          query: { tenantId: grant.tenantId, reason: grant.reason },
        }
      );
      setRevokingId(null);

      if (!result.ok) {
        setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
        return;
      }
      setGrants((prev) => prev.map((g) => (g.grantId === grant.grantId ? { ...g, state: 'REVOKED' } : g)));
      setBanner({ tone: 'success', title: t.revokeOk, body: grant.grantId });
    },
    [t]
  );

  const columns = useMemo<readonly ColumnDef<GrantView>[]>(
    () => [
      {
        key: 'tenantId',
        header: t.colInstitution,
        render: (row) => {
          const match = tenants.find((c) => c.tenantId === row.tenantId);
          return (
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">
                {match?.legalName ?? row.tenantId}
              </p>
              <p className="text-[11.5px] tabular text-[color:var(--sica-text-muted)]">{match?.slug ?? '—'}</p>
            </div>
          );
        },
      },
      { key: 'scope', header: t.fScope },
      { key: 'state', header: t.colStatus, align: 'center', valueType: 'status' },
      {
        key: 'expiresAt',
        header: t.countdown,
        sortValue: (row) => row.expiresAt,
        render: (row) => {
          const left = remainingMs(row.expiresAt);
          if (left <= 0 || row.state !== 'ACTIVE') {
            return <span className="text-[12.5px] text-slate-500">{row.state === 'ACTIVE' ? t.expired : formatStamp(row.expiresAt)}</span>;
          }
          return (
            <span className="tabular text-[13px] font-semibold text-[color:var(--sica-text-heading)]">
              <Hourglass size={13} strokeWidth={2} className="mr-1.5 inline" aria-hidden />
              {countdown(left)}
            </span>
          );
        },
      },
      { key: 'reason', header: t.colReason },
    ],
    [t, tenants]
  );

  const rowActions = useMemo<readonly DataGridRowAction<GrantView>[]>(
    () => [
      {
        id: 'revoke',
        label: t.revoke,
        tone: 'danger',
        icon: <LogOut size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.state !== 'ACTIVE' || revokingId === row.grantId,
        onSelect: (row) => void revoke(row),
      },
    ],
    [t, revokingId, revoke]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.supportTitle}
        description={t.supportSubtitle}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbPlatform }, { label: t.crumbSupport }]}
        actions={
          <Badge tone="warning" look="label" size="lg">
            <Hourglass size={13} strokeWidth={2} aria-hidden />
            {t.ttlMaxBadge}
          </Badge>
        }
      />

      {banner ? <Alert tone={banner.tone} title={banner.title}>{banner.body}</Alert> : null}

      <Card>
        <CardHeader>
          <CardHeading>
            <CardTitle>{t.supportTitle}</CardTitle>
            <CardDescription>{t.targetTenantHint}</CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t.fTargetSlug} htmlFor="s-slug" error={fieldErrors['targetTenantSlug']}>
              <Select id="s-slug" value={form.targetTenantSlug} onChange={(e) => setField('targetTenantSlug', e.target.value)}>
                <option value="">{t.fTenantNone}</option>
                {tenants.map((option) => (
                  <option key={option.tenantId} value={option.slug}>
                    {option.legalName} · {option.slug}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.fTargetId} htmlFor="s-tid" error={fieldErrors['targetTenantId']}>
              <Input id="s-tid" value={form.targetTenantId} onChange={(e) => setField('targetTenantId', e.target.value)} placeholder="uuid" />
            </Field>
            <Field label={t.fTargetUser} htmlFor="s-uid" required error={fieldErrors['targetUserId']}>
              <Input id="s-uid" value={form.targetUserId} onChange={(e) => setField('targetUserId', e.target.value)} placeholder="uuid" />
            </Field>
            <Field label={t.fScope} htmlFor="s-scope">
              <Select id="s-scope" value={scope} onChange={(e) => setScope(e.target.value as 'READ_ONLY' | 'HELPDESK_REPAIR')}>
                <option value="READ_ONLY">{t.scopeReadOnly}</option>
                <option value="HELPDESK_REPAIR">{t.scopeRepair}</option>
              </Select>
            </Field>
            <Field label={t.fTtl} htmlFor="s-ttl" error={fieldErrors['ttlMinutes']} hint={t.ttlHint}>
              <Input id="s-ttl" type="number" min={1} max={30} value={form.ttlMinutes} onChange={(e) => setField('ttlMinutes', e.target.value)} />
            </Field>
            <Field label={t.fTicket} htmlFor="s-ticket" error={fieldErrors['ticketId']}>
              <Input id="s-ticket" value={form.ticketId} onChange={(e) => setField('ticketId', e.target.value)} placeholder="uuid" />
            </Field>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <Field label={t.fReason} htmlFor="s-reason" required error={fieldErrors['reason']} hint={t.reasonPlaceholder}>
              <Textarea id="s-reason" value={form.reason} onChange={(e) => setField('reason', e.target.value)} className="min-h-16" />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="default" size="sm" disabled={isSubmitting} onClick={() => void submit()}>
                <Stethoscope size={15} strokeWidth={2} aria-hidden />
                {isSubmitting ? t.grantBusy : t.grantSubmit}
              </Button>
              <Link
                href="/platform/audit"
                className="text-[12.5px] font-semibold text-[color:var(--sica-primary)] underline-offset-4 hover:underline"
              >
                {t.openAudit}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <VelzonDataGrid
        title={t.sessionLedgerTitle}
        subtitle={t.sessionLedger}
        columns={columns}
        data={grants}
        keyExtractor={(row) => row.grantId}
        isLoading={isSubmitting}
        emptyMessage={t.noGrants}
        rowActions={rowActions}
        ariaLabel={t.supportTitle}
      />
    </div>
  );
}
