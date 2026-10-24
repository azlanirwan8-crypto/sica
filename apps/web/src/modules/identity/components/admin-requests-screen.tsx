'use client';

/**
 * Layar "Permintaan Hak" — antrean empat-mata (API_SPEC §4.6.9, `R-2.1`).
 *
 * Ini satu-satunya tempat keputusan diambil. Yang dijaga UI, bekerja di server:
 *  - baris yang DIAJUKAN SENDIRI tidak dapat disetujui aktor yang sama — tombolnya
 *    tetap ada (jejak harus terbuka) tapi penjelasannya muncul saat server menjawab
 *    `403 SELF_APPROVAL_FORBIDDEN`, bukan disembunyikan;
 *  - penolakan wajib beralasan ≥ 10 karakter, sama seperti gerbang DB
 *    (`chk_acr_decision_reason`);
 *  - sesi harus ber-MFA; 401 `MFA_REQUIRED` ditampilkan sebagai sebab yang bisa
 *    ditindaklanjuti (lengkapi MFA), bukan sebagai "kesalahan sistem".
 * Delta izin peran yang masih `PENDING` terlihat di sini sebagai baris, bukan sebagai
 * perubahan pada layar peran — ia baru berlaku setelah keputusan.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, History, ShieldAlert, XCircle } from 'lucide-react';
import type { AccessRequestView } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { apiRequest, describeFailure, formatStamp } from '@/lib/api-client';

type Decision = { row: AccessRequestView; outcome: 'APPROVED' | 'REJECTED' };

const KIND_TONE: Record<string, 'primary' | 'info' | 'warning' | 'secondary'> = {
  GRANT: 'primary',
  REVOKE: 'warning',
  SCOPE_CHANGE: 'info',
  ROLE_PERMISSION_CHANGE: 'info',
};

export function AdminRequestsScreen() {
  const t = getDictionary('id').admin;

  const [rows, setRows] = useState<readonly AccessRequestView[]>([]);
  const [status, setStatus] = useState<'PENDING' | 'all'>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger' | 'info'; title: string; body: string } | null>(null);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isDeciding, setIsDeciding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const result = await apiRequest<readonly AccessRequestView[]>('/api/v1/admin/permintaan-hak', {
      query: { status, limit: 100 },
    });
    if (result.ok) setRows(result.data);
    else {
      setRows([]);
      setLoadError(describeFailure(result, t));
    }
    setIsLoading(false);
  }, [status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitDecision() {
    if (!decision) return;
    setIsDeciding(true);
    const verb = decision.outcome === 'APPROVED' ? 'approve' : 'reject';
    const result = await apiRequest<{ status: string; effect: string }>(
      `/api/v1/admin/permintaan-hak/${decision.row.requestId}/${verb}`,
      { method: 'POST', body: decision.outcome === 'REJECTED' ? { reason: decisionReason } : {} }
    );
    setIsDeciding(false);
    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setDecision(null);
    setBanner({
      tone: 'success',
      title: decision.outcome === 'APPROVED' ? t.approved : t.rejected,
      body: `${decision.row.roleCode} · ${result.data.effect}`,
    });
    void load();
  }

  const columns = useMemo<readonly ColumnDef<AccessRequestView>[]>(
    () => [
      {
        key: 'requestKind',
        header: t.colKind,
        render: (row) => (
          <div className="min-w-0">
            <Badge tone={KIND_TONE[row.requestKind] ?? 'secondary'} look="label" size="sm">
              {row.requestKind}
            </Badge>
            <p className="mt-1 truncate text-[11.5px] tabular text-[color:var(--sica-text-muted)]">{row.roleCode}</p>
          </div>
        ),
      },
      {
        key: 'reason',
        header: t.colReason,
        render: (row) => <p className="line-clamp-2 text-[12.5px]">{row.reason}</p>,
      },
      {
        key: 'requestedAt',
        header: t.colRequestedAt,
        sortValue: (row) => row.requestedAt,
        render: (row) => <span className="text-[12.5px] tabular">{formatStamp(row.requestedAt)}</span>,
      },
      { key: 'status', header: t.colStatus, align: 'center', render: (row) => <StatusBadge status={row.status} look="label" /> },
      {
        key: 'decisionReason',
        header: t.colDecisionReason,
        render: (row) => (
          <span className="text-[12px] text-[color:var(--sica-text-muted)]">{row.decisionReason ?? '—'}</span>
        ),
      },
    ],
    [t]
  );

  const rowActions = useMemo<readonly DataGridRowAction<AccessRequestView>[]>(
    () => [
      {
        id: 'approve',
        label: t.approve,
        icon: <CheckCircle2 size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.status !== 'PENDING',
        onSelect: (row) => {
          setDecision({ row, outcome: 'APPROVED' });
          setDecisionReason('');
        },
      },
      {
        id: 'reject',
        label: t.reject,
        tone: 'danger',
        icon: <XCircle size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.status !== 'PENDING',
        onSelect: (row) => {
          setDecision({ row, outcome: 'REJECTED' });
          setDecisionReason('');
        },
      },
    ],
    [t]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.requestsTitle}
        description={t.requestsSubtitle}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbAdmin }, { label: t.crumbRequests }]}
        actions={
          <Button variant="soft" size="sm" onClick={() => void load()}>
            <History size={15} strokeWidth={2} aria-hidden />
            {t.reload}
          </Button>
        }
      />

      {banner ? <Alert tone={banner.tone} title={banner.title}>{banner.body}</Alert> : null}

      <Alert tone="info" title={t.fourEyesTitle}>
        {t.fourEyesBody}
      </Alert>

      <VelzonDataGrid
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.requestId}
        searchKeys={['requestKind', 'roleCode', 'reason', 'status']}
        searchPlaceholder={t.colReason}
        filter={{
          label: t.colStatus,
          accessor: (row) => row.status,
          options: [
            { value: 'PENDING', label: 'PENDING' },
            { value: 'APPROVED', label: 'APPROVED' },
            { value: 'REJECTED', label: 'REJECTED' },
          ],
        }}
        isLoading={isLoading}
        error={loadError ? { message: loadError, code: 'ADMIN_REQUESTS', retryLabel: t.reload, onRetry: () => void load() } : null}
        emptyMessage={t.empty}
        rowActions={rowActions}
        ariaLabel={t.requestsTitle}
      />

      <p className="text-[12px] text-[color:var(--sica-text-muted)]">{t.statusFilterNote}</p>
      <div className="flex gap-2">
        {(['PENDING', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={
              status === value
                ? 'btn-soft-primary rounded-full px-3.5 py-1.5 text-[12px] font-semibold'
                : 'rounded-full border border-[color:var(--sica-border-color)] px-3.5 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-50/70'
            }
          >
            {value === 'PENDING' ? t.onlyPending : t.allStatuses}
          </button>
        ))}
      </div>

      <Drawer
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision?.outcome === 'APPROVED' ? t.approve : t.reject}
        description={decision ? `${decision.row.requestKind} · ${decision.row.roleCode}` : undefined}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDecision(null)}>{t.close}</Button>
            <Button
              variant={decision?.outcome === 'REJECTED' ? 'destructive' : 'default'}
              size="sm"
              disabled={isDeciding || (decision?.outcome === 'REJECTED' && decisionReason.trim().length < 10)}
              onClick={() => void submitDecision()}
            >
              {isDeciding ? t.busy : decision?.outcome === 'APPROVED' ? t.approve : t.reject}
            </Button>
          </div>
        }
      >
        {decision ? (
          <div className="flex flex-col gap-4">
            <MetaRow
              items={[
                { label: t.colStatus, value: decision.row.status },
                { label: t.colRequestedAt, value: formatStamp(decision.row.requestedAt) },
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <p className="section-label">{t.colReason}</p>
              <p className="text-[13px] leading-relaxed">{decision.row.reason}</p>
            </div>
            <ShieldAlert size={16} strokeWidth={2} className="text-amber-600" aria-hidden />
            <p className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.decisionHint}</p>
            {decision.outcome === 'REJECTED' ? (
              <Field label={t.fReason} htmlFor="dr-reason" required hint={t.rejectHint}>
                <Textarea id="dr-reason" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
