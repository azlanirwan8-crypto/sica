'use client';

/**
 * Layar "Audit Lintas Institusi" (API_SPEC §4.21 baris platform, pemegang M-05).
 *
 * Dua hal yang membuat layar ini tidak boleh dibuat santai:
 *  1. `reason` wajib (≥ 10 karakter) karena pembacaan ini menyentuh jejak tenant lain;
 *     server menulis baris audit baru untuk setiap pembacaan (`audit.cross_tenant.read`).
 *  2. Target wajib UUID yang sudah diselesaikan server — tidak ada proyeksi PII di
 *     daftar, hanya ringkasan event + hash rantai.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSearch, ShieldAlert } from 'lucide-react';
import { CrossTenantAuditQuerySchema } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { VelzonDataGrid, type ColumnDef } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { describeFailure, formatStamp, apiRequest, type ApiPagination } from '@/lib/api-client';

interface TenantOption {
  tenantId: string;
  slug: string;
  legalName: string;
  status: string;
}

interface AuditEvent {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  targetEntity: string;
  targetId: string | null;
  action: string;
  reason: string | null;
  occurredAt: string;
  hash: string;
  prevHash: string | null;
}

/** `datetime-local` → ISO; nilai tak valid dianggap kosong (server menyaring rentang). */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function PlatformAuditScreen() {
  const t = getDictionary('id').platform;

  const [tenants, setTenants] = useState<readonly TenantOption[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [action, setAction] = useState('');
  const [targetEntity, setTargetEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<readonly AuditEvent[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `window.location.search` dibaca manual: `useSearchParams` pada layar dinamis
    // memaksa boundary Suspense tambahan tanpa memberi nilai tambah di sini.
    const preset = new URLSearchParams(window.location.search).get('tenantId');
    if (preset) setTenantId(preset);
  }, []);

  useEffect(() => {
    void (async () => {
      const result = await apiRequest<readonly TenantOption[]>('/api/v1/platform/tenants', { query: { limit: 200 } });
      if (result.ok) setTenants(result.data);
    })();
  }, []);

  const run = useCallback(
    async (nextPage: number) => {
      setError(null);
      const parsed = CrossTenantAuditQuerySchema.safeParse({
        tenantId,
        reason,
        page: nextPage,
        limit: 50,
        ...(action ? { action } : {}),
        ...(targetEntity ? { targetEntity } : {}),
        ...(toIso(from) ? { from: toIso(from) } : {}),
        ...(toIso(to) ? { to: toIso(to) } : {}),
      });
      if (!parsed.success) {
        setError(`${t.formInvalid} — ${parsed.error.issues[0]?.message ?? ''}`.trim());
        return;
      }

      const { data } = parsed;
      const query: Record<string, string | number | undefined> = {
        tenantId: data.tenantId,
        reason: data.reason,
        page: data.page,
        limit: data.limit,
        action: data.action,
        targetEntity: data.targetEntity,
        from: data.from,
        to: data.to,
      };

      setIsLoading(true);
      const result = await apiRequest<readonly AuditEvent[]>('/api/v1/platform/audit-events', { query });
      setIsLoading(false);
      setHasRun(true);
      setPage(nextPage);

      if (!result.ok) {
        setRows([]);
        setPagination(null);
        setError(describeFailure(result, t));
        return;
      }
      setRows(result.data);
      setPagination(result.pagination);
    },
    [tenantId, reason, action, targetEntity, from, to, t]
  );

  const columns = useMemo<readonly ColumnDef<AuditEvent>[]>(
    () => [
      {
        key: 'occurredAt',
        header: t.colOccurred,
        width: '170px',
        render: (row) => <span className="text-[12.5px] tabular text-slate-500">{formatStamp(row.occurredAt)}</span>,
      },
      { key: 'action', header: t.colAction },
      { key: 'targetEntity', header: t.colTarget },
      {
        key: 'targetId',
        header: t.colTargetId,
        render: (row) => <span className="text-[12px] tabular text-slate-500">{row.targetId ?? '—'}</span>,
      },
      {
        key: 'actorUserId',
        header: t.colActor,
        render: (row) => <span className="text-[12px] tabular text-slate-500">{row.actorUserId ?? '—'}</span>,
      },
      { key: 'reason', header: t.colReason },
      {
        key: 'hash',
        header: t.colHash,
        render: (row) => (
          <span className="tabular text-[11.5px] text-slate-500" title={`${row.hash} · prev ${row.prevHash ?? '—'}`}>
            {row.hash.slice(0, 12)}…
          </span>
        ),
      },
    ],
    [t]
  );

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.auditTitle}
        description={t.chainNote}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbPlatform }, { label: t.crumbAudit }]}
        actions={
          <Badge tone="info" look="label" size="lg">
            <ShieldAlert size={13} strokeWidth={2} aria-hidden />
            {t.reasonRequiredBadge}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardHeading>
            <CardTitle>{t.auditTitle}</CardTitle>
            <CardDescription>{t.auditSubtitle}</CardDescription>
          </CardHeading>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t.fTenant} htmlFor="a-tenant" required>
              <Select id="a-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">{t.fTenantNone}</option>
                {tenants.map((option) => (
                  <option key={option.tenantId} value={option.tenantId}>
                    {option.legalName} · {option.slug} ({option.status})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.fActionFilter} htmlFor="a-action">
              <Input id="a-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="identity.mfa.enrolled" />
            </Field>
            <Field label={t.fTargetEntity} htmlFor="a-entity">
              <Input id="a-entity" value={targetEntity} onChange={(e) => setTargetEntity(e.target.value)} placeholder="audit_logs" />
            </Field>
            <Field label={t.fFrom} htmlFor="a-from">
              <Input id="a-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t.fTo} htmlFor="a-to">
              <Input id="a-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label={t.fReason} htmlFor="a-reason" required hint={t.reasonPlaceholder}>
              <Textarea id="a-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="default" size="sm" disabled={isLoading} onClick={() => void run(1)}>
              <FileSearch size={15} strokeWidth={2} aria-hidden />
              {isLoading ? t.auditBusy : t.auditRun}
            </Button>
            {pagination ? (
              <div className="flex items-center gap-2">
                <Button variant="soft" size="sm" disabled={page <= 1 || isLoading} onClick={() => void run(page - 1)}>
                  ‹
                </Button>
                <span className="text-[12.5px] tabular text-slate-500">
                  {t.auditPage} {pagination.page} {t.auditOf} {totalPages} · {pagination.totalRecords} {t.auditRows}
                </span>
                <Button variant="soft" size="sm" disabled={page >= totalPages || isLoading} onClick={() => void run(page + 1)}>
                  ›
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? <Alert tone="danger" title={t.loadError}>{error}</Alert> : null}
      {hasRun && !error ? <Alert tone="info" title={t.reasonRequiredBadge}>{t.writeOnRead}</Alert> : null}

      <VelzonDataGrid
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.id}
        searchable
        searchPlaceholder={t.colAction}
        isLoading={isLoading}
        pagination={false}
        emptyMessage={hasRun ? t.auditNoRows : t.auditIdle}
        ariaLabel={t.auditTitle}
      />
    </div>
  );
}
