'use client';

/**
 * Layar "Parameter Sistem" — `/admin/pengaturan/parameter` (`UI_UX_DESIGN §14.1–§14.7`,
 * `API_SPEC §4.16`, fase 1B item 3 / `SPE-8`).
 *
 * Yang ditegakkan di layar ini, dan hanya di sini:
 *  - **Tombol tidak dirender bila aksinya tidak diizinkan.** Sumbernya `allowedActions`
 *    proyeksi server (`G-18`), bukan nama peran yang ditebak di klien (`G-01`).
 *  - **Kelas `SECURITY` tidak pernah menawarkan angka bebas.** Bila kunci punya
 *    `allowedValues`, kontrolnya adalah pilihan dari daftar itu; penolakan datang dari
 *    transport DAN `CHECK` database, dan copy-nya menyebut yang kedua agar admin tidak
 *    mengira ada layar yang lebih berkuasa (§14.3 butir 4).
 *  - **Nilai tertahan tidak pernah tampil sebagai nilai berjalan.** Setelah `PUT` kelas
 *    `REGULATORY`/`SECURITY`, kartu "menunggu penyetuju kedua" menampilkan `effectiveValue`
 *    dan `proposedValue` berdampingan — menampilkan yang kedua sebagai resmi adalah
 *    kebohongan ke operator (`AC-PG-1`).
 *  - **Tidak ada optimistic UI.** Tulis master menunggu respons (§9.4); satu kunci satu
 *    keputusan, tanpa "terapkan semua".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  Eye,
  History,
  Landmark,
  Loader2,
  Network,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Send,
} from 'lucide-react';
import {
  PARAMETER_MODULE_CODES,
  PARAMETER_RISK_CLASSES,
  type ParameterApprovalView,
  type ParameterHistoryView,
  type SystemParameterView,
} from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { apiRequest, describeFailure, formatStamp, issuesByField } from '@/lib/api-client';

const LIST_PATH = '/api/v1/admin/system-parameters';
const QUEUE_PATH = '/api/v1/admin/system-parameter-approvals';

type Tab = 'catalog' | 'queue';
type DetailTab = 'value' | 'history' | 'impact';

interface ImpactPayload {
  key: string;
  readers: readonly string[];
  patterns: readonly { pattern: string; permissionCode: string; effect: string; active: boolean }[];
  enumKind: string | null;
  enumSurfaces: readonly string[];
  orphanKeys: readonly string[];
}

interface Banner {
  tone: 'success' | 'danger' | 'info' | 'warning';
  title: string;
  body: string;
}

const fmt = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)), template);

export function AdminParametersScreen() {
  const t = getDictionary('id').admin.param;

  const [tab, setTab] = useState<Tab>('catalog');
  const [rows, setRows] = useState<readonly SystemParameterView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editableOnly, setEditableOnly] = useState(false);
  const [atDate, setAtDate] = useState('');

  const [detail, setDetail] = useState<SystemParameterView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('value');
  const [history, setHistory] = useState<readonly ParameterHistoryView[]>([]);
  const [impact, setImpact] = useState<ImpactPayload | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editFieldError, setEditFieldError] = useState<string | null>(null);

  const [queue, setQueue] = useState<readonly ParameterApprovalView[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ParameterApprovalView | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decideBusy, setDecideBusy] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [pendingCard, setPendingCard] = useState<{ approvalId: string; effective: string; proposed: string } | null>(null);

  const load = useCallback(async () => {
    if (tab === 'queue') {
      setQueueLoading(true);
      const result = await apiRequest<readonly ParameterApprovalView[]>(QUEUE_PATH, {
        query: { state: 'PENDING', limit: 100 },
      });
      if (result.ok) setQueue(result.data);
      else setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t.error) });
      setQueueLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const result = await apiRequest<readonly SystemParameterView[]>(LIST_PATH, {
      query: {
        ...(moduleFilter ? { module: moduleFilter } : {}),
        ...(riskFilter ? { riskClass: riskFilter } : {}),
                ...(atDate ? { at: atDate } : {}),
        ...(includeInactive ? { includeInactive: 'true' } : {}),
        ...(editableOnly ? { editableOnly: 'true' } : {}),
        limit: 100,
      },
    });
    if (result.ok) {
      setRows(result.data);
      setTotal(result.pagination?.totalRecords ?? result.data.length);
    } else {
      setRows([]);
      setTotal(0);
      setLoadError(describeFailure(result, t.error));
    }
    setLoading(false);
  }, [tab, moduleFilter, riskFilter, atDate, includeInactive, editableOnly, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const canRegister = rows.some((row) => row.allowedActions.includes('register'));

  const openDetail = useCallback(async (row: SystemParameterView) => {
    setDetail(row);
    setDetailTab('value');
    setDetailOpen(true);
    setHistory([]);
    setImpact(null);
    setPendingCard(
      row.pendingApprovalId
        ? { approvalId: row.pendingApprovalId, effective: row.currentValue ?? '—', proposed: row.pendingValue ?? '—' }
        : null
    );

    const historyResult = await apiRequest<readonly ParameterHistoryView[]>(`${LIST_PATH}/${encodeURIComponent(row.parameterKey)}/history`, {
      query: { limit: 50 },
    });
    if (historyResult.ok) setHistory(historyResult.data);

    const impactResult = await apiRequest<ImpactPayload>(`${LIST_PATH}/${encodeURIComponent(row.parameterKey)}/impact`);
    if (impactResult.ok) setImpact(impactResult.data);
  }, []);

  function startEdit(row: SystemParameterView) {
    setDetail(null);
    setDetailOpen(false);
    setEditValue(row.currentValue ?? '');
    setEditReason('');
    setEditFieldError(null);
    setBanner(null);
    setPendingCard(null);
    // Drawer editor memakai drawer detail yang sama: baris target disimpan di `detail`.
    setDetail(row);
    setEditOpen(true);
  }

  async function submitEdit() {
    if (!detail) return;
    setEditBusy(true);
    setEditFieldError(null);
    const path = `${LIST_PATH}/${encodeURIComponent(detail.parameterKey)}`;
    const body = {
      value: editValue,
      reason: editReason,
      expectedVersion: detail.version,
    };
    const wantsApproval = detail.allowedActions.includes('request-approval');
    const result = wantsApproval
      ? await apiRequest<unknown>(`${path}/request-approval`, { method: 'POST', body })
      : await apiRequest<unknown>(path, { method: 'PUT', body });
    setEditBusy(false);

    if (!result.ok) {
      const field = issuesByField(result.issues);
      setEditFieldError(field['value'] ?? field['reason'] ?? null);
      setBanner({
        tone: result.code === 'PARAM_APPROVAL_REQUIRED' ? 'info' : 'danger',
        title: result.code,
        body: describeFailure(result, t.error),
      });
      return;
    }

    setEditOpen(false);
    setBanner({ tone: 'success', title: t.editor.title, body: `${detail.parameterKey} · v${detail.version + 1}` });
    void load();
  }

  async function decide(approval: ParameterApprovalView, action: 'approve' | 'reject', reason: string | null) {
    setDecideBusy(true);
    const result = await apiRequest<unknown>(`${QUEUE_PATH}/${approval.approvalId}/${action}`, {
      method: 'POST',
      body: reason === null ? {} : { reason },
    });
    setDecideBusy(false);
    setRejectTarget(null);

    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t.error) });
      return;
    }
    setBanner({
      tone: 'success',
      title: action === 'approve' ? t.queue.approve : t.queue.reject,
      body: `${approval.parameterKey} · ${approval.proposedValue}`,
    });
    void load();
  }

  const columns = useMemo<readonly ColumnDef<SystemParameterView>[]>(
    () => [
      {
        key: 'parameterKey',
        header: t.list.colKey,
        sortValue: (row) => row.parameterKey,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-[12.5px] text-[color:var(--sica-text-heading)]">{row.parameterKey}</p>
            <p className="text-[11.5px] text-[color:var(--sica-text-muted)]">{row.module}</p>
          </div>
        ),
      },
      {
        key: 'currentValue',
        header: t.list.colValue,
        sortValue: (row) => row.currentValue ?? '',
        render: (row) => (
          <span className="tabular text-[13px] font-semibold text-[color:var(--sica-text-heading)]">
            {row.currentValue ?? '—'}
            {row.unit ? <span className="ml-1 font-normal text-[color:var(--sica-text-muted)]">{row.unit}</span> : null}
            {row.pendingValue ? (
              <Badge look="soft" tone="warning" size="sm" className="ml-2">
                {t.pending.submitted}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        key: 'range',
        header: t.list.colRange,
        render: (row) => {
          const bounded = row.min !== null || row.max !== null;
          const allowed = row.allowedValues ? fmt(t.range.allowedValues, { values: row.allowedValues.join(' · ') }) : '';
          return bounded ? (
            <span className="tabular text-[12px] text-slate-600">
              {fmt(t.range.between, { min: row.min ?? '—', max: row.max ?? '—', unit: row.unit ? fmt(t.range.unitSuffix, { unit: row.unit }) : '' })}
              {allowed}
            </span>
          ) : (
            <span className="text-[12px] text-[color:var(--sica-text-muted)]">
              {t.range.noLimit}
              <span className="ml-1 text-[11px] font-semibold text-amber-600">⚠</span>
            </span>
          );
        },
      },
      {
        key: 'riskClass',
        header: t.list.colRisk,
        align: 'center',
        render: (row) => <RiskBadge risk={row.riskClass} label={riskLabel(t, row.riskClass)} />,
      },
      {
        key: 'version',
        header: t.list.colVersion,
        align: 'center',
        sortValue: (row) => row.version,
        render: (row) => <span className="tabular text-[12px]">v{row.version}</span>,
      },
      {
        key: 'status',
        header: t.list.colStatus,
        align: 'center',
        render: (row) => (
          <div className="flex flex-col items-center gap-1">
            <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} look="label" />
            {row.updateDisabledReason ? (
              <span className="text-[11px] text-[color:var(--sica-text-muted)]">{disabledReasonText(row, t)}</span>
            ) : null}
          </div>
        ),
      },
    ],
    [t]
  );

  const rowActions = useMemo<readonly DataGridRowAction<SystemParameterView>[]>(
    () => [
      {
        id: 'detail',
        label: t.tabs.value,
        icon: <Eye size={16} strokeWidth={2} aria-hidden />,
        onSelect: (row) => void openDetail(row),
      },
      {
        id: 'write',
        label: t.editor.title,
        icon: <Save size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => !row.allowedActions.includes('write') && !row.allowedActions.includes('request-approval'),
        onSelect: (row) => startEdit(row),
      },
      {
        id: 'revert',
        label: t.history.revert,
        icon: <RotateCcw size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => !row.allowedActions.includes('revert'),
        onSelect: (row) => void revertToDefault(row),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, openDetail]
  );

  async function revertToDefault(row: SystemParameterView) {
    const result = await apiRequest<unknown>(`${LIST_PATH}/${encodeURIComponent(row.parameterKey)}/revert`, {
      method: 'POST',
      body: { toDefault: true, reason: t.history.revertDefault, expectedVersion: row.version },
    });
    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t.error) });
      return;
    }
    setBanner({ tone: 'success', title: t.history.revert, body: row.parameterKey });
    void load();
  }

  const editorControl = (row: SystemParameterView) => {
    if (row.allowedValues && row.allowedValues.length > 0) {
      return (
        <Field label={t.editor.title} htmlFor="p-value" required hint={rangeHint(row, t)}>
          <Select id="p-value" value={editValue} onChange={(e) => setEditValue(e.target.value)}>
            {row.allowedValues.map((option) => (
              <option key={option} value={option}>
                {option}
                {row.unit ? ` ${row.unit}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      );
    }
    if (row.enumOptions && row.enumOptions.length > 0) {
      return (
        <Field label={t.editor.title} htmlFor="p-value" required hint={t.editor.appliesTo}>
          <Select id="p-value" value={editValue} onChange={(e) => setEditValue(e.target.value)}>
            {row.enumOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    }
    if (row.dataType === 'BOOL') {
      return (
        <Field label={t.editor.title} htmlFor="p-value" required hint={rangeHint(row, t)}>
          <Select id="p-value" value={editValue} onChange={(e) => setEditValue(e.target.value)}>
            <option value="true">true</option>
            <option value="false">false</option>
          </Select>
        </Field>
      );
    }
    if (row.dataType === 'JSON') {
      return (
        <Field label={t.editor.title} htmlFor="p-value" required hint={rangeHint(row, t)}>
          <Textarea
            id="p-value"
            spellCheck={false}
            className="font-mono text-xs"
            rows={6}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
        </Field>
      );
    }
    const numeric = ['INT', 'DECIMAL', 'PCT', 'BP', 'SECONDS', 'METERS'].includes(row.dataType);
    return (
      <Field label={t.editor.title} htmlFor="p-value" required error={editFieldError ?? undefined} hint={rangeHint(row, t)}>
        <Input
          id="p-value"
          inputMode={numeric ? 'numeric' : undefined}
          type={row.dataType === 'DATE' ? 'date' : row.dataType === 'TIME' ? 'time' : 'text'}
          className={numeric ? 'tabular' : row.dataType === 'REGEX' ? 'font-mono text-xs' : undefined}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
        />
      </Field>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.list.title}
        description={t.list.description}
        crumbs={[{ label: t.list.colKey, href: '/dashboard' }, { label: 'Admin', href: '/admin/pengguna' }, { label: t.list.title }]}
        actions={
          <div className="flex gap-2">
            <Button variant="soft" size="sm" onClick={() => void load()}>
              <Network size={15} strokeWidth={2} aria-hidden />
              {t.reload}
            </Button>
            {canRegister ? (
              <Button variant="default" size="sm" onClick={() => setRegisterOpen(true)}>
                <Plus size={15} strokeWidth={2} aria-hidden />
                {t.register.title}
              </Button>
            ) : null}
          </div>
        }
      />

      <MetaRow
        items={[
          { label: t.list.colStatus, value: `${rows.length} / ${total}` },
          { label: t.tabs.queue, value: String(queue.length) },
          { label: t.mode.clientNotice, value: 'server-resolved' },
        ]}
      />

      <div role="tablist" className="flex gap-2">
        <Button variant={tab === 'catalog' ? 'default' : 'outline'} size="sm" onClick={() => setTab('catalog')} aria-selected={tab === 'catalog'}>
          {t.tabs.catalog}
        </Button>
        <Button variant={tab === 'queue' ? 'default' : 'outline'} size="sm" onClick={() => setTab('queue')} aria-selected={tab === 'queue'}>
          {t.tabs.queue}
        </Button>
      </div>

      {banner ? (
        <Alert tone={banner.tone} title={banner.title}>
          {banner.body}
        </Alert>
      ) : null}

      {atDate ? (
        <Alert tone="info" title={t.filter.at}>
          {fmt(t.mode.readonlyReconstruct, { at: atDate })}
        </Alert>
      ) : null}

      {pendingCard ? (
        <section className="card" role="status" aria-live="polite">
          <div className="card-body flex flex-col gap-2">
            <p className="section-label">{t.pending.submitted}</p>
            <p className="text-[13px]">{t.pending.effective}</p>
            <div className="flex gap-4">
              <span className="tabular text-[13px] text-[color:var(--sica-text-muted)]">
                {t.editor.effectiveNow}: <strong>{pendingCard.effective}</strong>
              </span>
              <span className="tabular text-[13px] text-emerald-700">
                {t.editor.proposedValue}: <strong>{pendingCard.proposed}</strong>
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-[color:var(--sica-text-muted)]">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[color:var(--sica-border-color)] px-2 py-1"
                onClick={() => void navigator.clipboard.writeText(pendingCard.approvalId)}
              >
                <ClipboardCopy size={13} strokeWidth={2} aria-hidden />
                {pendingCard.approvalId.slice(0, 8)}…
              </button>
              {t.pending.selfApprovalNotice}
            </p>
          </div>
        </section>
      ) : null}

      {tab === 'catalog' ? (
        <VelzonDataGrid
          columns={columns}
          data={rows}
          keyExtractor={(row) => row.parameterKey}
          searchKeys={['parameterKey', 'description']}
          searchPlaceholder={t.filter.q}
          filter={{
            label: t.filter.riskClass,
            accessor: (row) => row.riskClass,
            options: PARAMETER_RISK_CLASSES.map((value) => ({ value, label: String(value) })),
          }}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <Select aria-label={t.filter.module} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-9 w-40 text-[12.5px]">
                <option value="">{t.filter.module}: —</option>
                {PARAMETER_MODULE_CODES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              <Select aria-label={t.filter.riskClass} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="h-9 w-44 text-[12.5px]">
                <option value="">{t.filter.riskClass}: —</option>
                {PARAMETER_RISK_CLASSES.map((value) => (
                  <option key={value} value={value}>
                    {t.risk[value]}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                {t.filter.includeInactive}
              </label>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
                <input type="checkbox" checked={editableOnly} onChange={(e) => setEditableOnly(e.target.checked)} />
                {t.filter.editableOnly}
              </label>
              <Input
                aria-label={t.filter.at}
                type="date"
                className="h-9 w-40 text-[12.5px]"
                value={atDate}
                onChange={(e) => setAtDate(e.target.value)}
              />
            </div>
          }
          isLoading={loading}
          error={loadError ? { message: loadError, code: 'PARAMETERS', retryLabel: t.reload, onRetry: () => void load() } : null}
          emptyMessage={t.error.notFound}
          rowActions={rowActions}
          ariaLabel={t.list.title}
        />
      ) : (
        <VelzonDataGrid
          columns={[
            {
              key: 'parameterKey',
              header: t.queue.colKey,
              render: (row) => <span className="font-mono text-[12.5px]">{row.parameterKey}</span>,
            },
            {
              key: 'proposed',
              header: t.queue.colProposed,
              render: (row) => (
                <span className="tabular text-[12.5px]">
                  <span className="text-[color:var(--sica-text-muted)] line-through">{row.previousValue}</span>
                  <span className="mx-1.5" aria-hidden>
                    →
                  </span>
                  <span className="font-semibold text-emerald-700">{row.proposedValue}</span>
                </span>
              ),
            },
            { key: 'state', header: t.queue.colState, align: 'center', valueType: 'status' },
            { key: 'requested', header: t.queue.colRequested, render: (row) => <span className="text-[12px]">{formatStamp(row.requestedAt)}</span> },
          ]}
          data={queue}
          keyExtractor={(row) => row.approvalId}
          searchKeys={['parameterKey', 'reason']}
          searchPlaceholder={t.queue.colKey}
          isLoading={queueLoading}
          emptyMessage={t.queue.empty}
          rowActions={[
            {
              id: 'approve',
              label: t.queue.approve,
              icon: <ShieldAlert size={16} strokeWidth={2} aria-hidden />,
              onSelect: (row) => void decide(row, 'approve', null),
            },
            {
              id: 'reject',
              label: t.queue.reject,
              tone: 'danger',
              icon: <RotateCcw size={16} strokeWidth={2} aria-hidden />,
              onSelect: (row) => {
                setRejectTarget(row);
                setRejectReason('');
              },
            },
          ]}
          ariaLabel={t.queue.title}
        />
      )}

      {/* ── Drawer detail kunci ── */}
      <Drawer
        open={detailOpen && !editOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        title={detail?.parameterKey ?? t.tabs.value}
        description={detail?.description}
        footer={
          detail ? (
            <div className="flex w-full items-center justify-between gap-3">
              <span className="tabular text-[11.5px] text-[color:var(--sica-text-muted)]">v{detail.version}</span>
              <div className="flex gap-2">
                {detail.allowedActions.includes('write') || detail.allowedActions.includes('request-approval') ? (
                  <Button variant="default" size="sm" onClick={() => startEdit(detail)}>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    {detail.allowedActions.includes('request-approval') ? t.editor.submit : t.editor.save}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>
                  {t.editor.close}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {detail ? (
          <div className="flex flex-col gap-5">
            <div role="tablist" className="flex gap-2">
              {(['value', 'history', 'impact'] as const).map((key) => (
                <Button
                  key={key}
                  variant={detailTab === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDetailTab(key)}
                  aria-selected={detailTab === key}
                >
                  {t.tabs[key]}
                </Button>
              ))}
            </div>

            {detailTab === 'value' ? (
              <>
                <MetaRow
                  items={[
                    { label: t.list.colValue, value: detail.currentValue ?? '—' },
                    { label: t.list.colDefault, value: detail.defaultValue },
                    { label: t.list.colVersion, value: `v${detail.version}` },
                  ]}
                />
                <MetaRow
                  items={[
                    { label: t.list.colRange, value: rangeHint(detail, t) },
                    { label: t.list.colScope, value: detail.effective.from ?? '—' },
                    { label: t.editor.inheritedScope, value: JSON.stringify(detail.effective.appliesTo) },
                  ]}
                />
                {detail.riskClass === 'SECURITY' || detail.riskClass === 'REGULATORY' ? (
                  <Alert tone={detail.riskClass === 'SECURITY' ? 'danger' : 'warning'} title={riskLabel(t, detail.riskClass)}>
                    {riskCopyFor(detail.parameterKey, t) ?? detail.description}
                  </Alert>
                ) : null}
                {detail.updateDisabledReason ? (
                  <p className="text-[12.5px] text-[color:var(--sica-text-muted)]">{disabledReasonText(detail, t)}</p>
                ) : null}
              </>
            ) : null}

            {detailTab === 'history' ? (
              <div className="flex flex-col gap-2.5">
                {history.length === 0 ? <p className="text-[13px] text-[color:var(--sica-text-muted)]">{t.history.empty}</p> : null}
                {history.map((entry) => (
                  <div key={entry.historyId} className="rounded-lg border border-[color:var(--sica-border-color)] px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular text-[12.5px] font-semibold">
                        {entry.oldValue ?? '—'} → {entry.newValue}
                      </span>
                      <Badge look="soft" tone="secondary" size="sm">
                        {entry.source}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11.5px] text-[color:var(--sica-text-muted)]">
                      v{entry.oldVersion ?? '—'} → v{entry.newVersion} · {formatStamp(entry.occurredAt)}
                      {entry.changedBy ? ` · ${entry.changedBy.slice(0, 8)}` : ` · ${t.history.redactedNotice}`}
                      {entry.ip ? ` · ${entry.ip}` : ''}
                    </p>
                    <p className="mt-1 text-[12px]">{entry.reason}</p>
                    {detail.allowedActions.includes('revert') ? (
                      <p className="mt-1.5 text-[11.5px] text-[color:var(--sica-text-muted)]">{t.history.approver}: {entry.approverId?.slice(0, 8) ?? '—'}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {detailTab === 'impact' ? (
              <div className="flex flex-col gap-3">
                <p className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.impact.openingLine}</p>
                {impact === null ? (
                  <Skeleton className="h-16 w-full rounded" />
                ) : (
                  <>
                    <ImpactGroup label={t.impact.groupService} items={impact.readers} empty={t.impact.empty} />
                    <ImpactGroup label={t.impact.groupDictionary} items={impact.enumSurfaces} empty="—" />
                    <ImpactGroup label={t.impact.groupPattern} items={impact.patterns.map((p) => `${p.effect} ${p.pattern} → ${p.permissionCode}${p.active ? '' : ' (draft)'}`)} empty="—" />
                    {impact.orphanKeys.length > 0 ? (
                      <Alert tone="warning" title={t.impact.ciDebt}>
                        {t.impact.orphan}
                      </Alert>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {/* ── Drawer editor nilai ── */}
      <Drawer
        open={editOpen && detail !== null}
        onClose={() => setEditOpen(false)}
        title={t.editor.title}
        description={detail?.parameterKey}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
              {t.editor.close}
            </Button>
            <Button variant="default" size="sm" disabled={editBusy || editReason.trim().length < 10} onClick={() => void submitEdit()}>
              {editBusy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : detail?.allowedActions.includes('request-approval') ? <Send size={15} strokeWidth={2} aria-hidden /> : <Save size={15} strokeWidth={2} aria-hidden />}
              {detail?.allowedActions.includes('request-approval') ? t.editor.submit : t.editor.save}
            </Button>
          </div>
        }
      >
        {detail ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="tabular text-[13px] text-[color:var(--sica-text-muted)]">
                {t.editor.effectiveNow}: <strong className="text-[color:var(--sica-text-heading)]">{detail.currentValue ?? '—'}</strong>
              </span>
              <RiskBadge risk={detail.riskClass} label={riskLabel(t, detail.riskClass)} />
            </div>

            {editorControl(detail)}

            {['INT', 'DECIMAL', 'PCT', 'BP', 'SECONDS', 'METERS'].includes(detail.dataType) && detail.min !== null && detail.max !== null ? (
              <Progress value={positionInRange(editValue, detail.min, detail.max)} className="h-1.5" />
            ) : null}

            <p className="text-[12px] text-[color:var(--sica-text-muted)]">
              {detail.consumerCount > 0
                ? fmt(t.editor.impactLine, { count: detail.consumerCount })
                : t.impact.orphan}
            </p>

            <Field
              label={t.editor.reasonLabel}
              htmlFor="p-reason"
              required
              hint={fmt(t.editor.reasonCounter, { n: editReason.length })}
            >
              <Textarea id="p-reason" rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} />
            </Field>

            {detail.riskClass === 'SECURITY' || detail.riskClass === 'REGULATORY' ? (
              <Alert tone="info" title={riskLabel(t, detail.riskClass)}>
                {fmt(t.mfa.gate, { riskClass: detail.riskClass })}
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      {/* ── Drawer tolak draf ── */}
      <Drawer
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={t.queue.reject}
        description={rejectTarget?.parameterKey}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              {t.editor.close}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={decideBusy || rejectTarget === null || rejectReason.trim().length < 10}
              onClick={() => rejectTarget && void decide(rejectTarget, 'reject', rejectReason)}
            >
              {t.queue.reject}
            </Button>
          </div>
        }
      >
        {rejectTarget ? (
          <Field label={t.queue.reasonRequired} htmlFor="p-reject" required>
            <Textarea id="p-reject" rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </Field>
        ) : null}
      </Drawer>

      <RegisterDrawer open={registerOpen} onClose={() => setRegisterOpen(false)} onDone={() => { setRegisterOpen(false); void load(); }} />
    </div>
  );
}

function ImpactGroup({ label, items, empty }: { label: string; items: readonly string[]; empty: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="section-label">{label}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-[color:var(--sica-text-muted)]">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item} className="font-mono text-[11.5px] text-slate-600">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskBadge({ risk, label }: { risk: string; label: string }) {
  const solid = risk === 'SECURITY' || risk === 'REGULATORY';
  const tone = risk === 'SECURITY' ? 'danger' : risk === 'REGULATORY' ? 'warning' : 'secondary';
  const Icon = risk === 'SECURITY' ? ShieldAlert : risk === 'REGULATORY' ? Landmark : History;
  return (
    <Badge look={solid ? 'label' : 'soft'} tone={tone} size="sm">
      <Icon size={12} strokeWidth={2} aria-hidden />
      {label}
    </Badge>
  );
}

function positionInRange(value: string, min: string, max: string): number {
  const n = Number(value);
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(n) || !Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return 0;
  return Math.max(0, Math.min(100, ((n - lo) / (hi - lo)) * 100));
}

function rangeHint(row: SystemParameterView, t: Dict): string {
  if (row.min === null && row.max === null) return t.range.noLimit;
  const base = fmt(t.range.between, { min: row.min ?? '—', max: row.max ?? '—', unit: row.unit ? fmt(t.range.unitSuffix, { unit: row.unit }) : '' });
  const allowed = row.allowedValues ? fmt(t.range.allowedValues, { values: row.allowedValues.join(' · ') }) : '';
  return `${base}${allowed}`;
}

function disabledReasonText(row: SystemParameterView, t: Dict): string {
  switch (row.updateDisabledReason) {
    case 'NOT_A_PARAM_SOURCE':
      return `${t.status.pointerIndex} — ${t.disabled.notParamSource}`;
    case 'NOT_EDITABLE':
      return t.disabled.checkLocked;
    case 'NO_EDIT_GRANT':
      return t.disabled.noEditGrant;
    case 'RESTART_REQUIRED':
      return t.error.restartRequired;
    default:
      return '';
  }
}

function riskCopyFor(key: string, t: Dict): string | null {
  const table: Record<string, string> = {
    'attendance.totp_rotate_seconds': t.riskCopy.totpRotate,
    'attendance.geofence_default_radius_m': t.riskCopy.geofenceRadius,
    'attendance.gps_max_accuracy_m': t.riskCopy.gpsAccuracy,
    'finance.webhook_max_clock_skew_s': t.riskCopy.clockSkew,
    'attendance.online_min_join_ratio': t.riskCopy.onlineMinJoin,
    'attendance.multi_source_policy': t.riskCopy.multiSourcePolicy,
  };
  return table[key] ?? null;
}

type Dict = ReturnType<typeof getDictionary>['admin']['param'];

/** Label kelas risiko —  adalah string DB, kamusnya bersKey enum. */
function riskLabel(t: Dict, riskClass: string): string {
  return riskClass in t.risk ? t.risk[riskClass as keyof Dict['risk']] : riskClass;
}

/** Drawer registrasi kunci baru (§4.16.4) — konsumen wajib terbukti. */
function RegisterDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const t = getDictionary('id').admin.param;
  const [form, setForm] = useState({ parameterKey: '', module: 'attendance', dataType: 'INT', defaultValue: '', minValue: '', maxValue: '', unit: '', description: '', riskClass: 'OPS', callSites: '', testRef: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await apiRequest<unknown>(`${LIST_PATH}/register`, {
      method: 'POST',
      body: {
        module: form.module,
        parameterKey: form.parameterKey,
        dataType: form.dataType,
        unit: form.unit || null,
        defaultValue: form.defaultValue,
        minValue: form.minValue || null,
        maxValue: form.maxValue || null,
        enumKind: null,
        description: form.description,
        riskClass: form.riskClass,
        appliesTo: {},
        requiresRestart: false,
        consumerEvidence: {
          callSites: form.callSites.split(',').map((s) => s.trim()).filter(Boolean),
          testRef: form.testRef,
        },
        reason: form.reason,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(`${result.code} — ${describeFailure(result, t.error)}`);
      return;
    }
    onDone();
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t.register.title}
      description={t.register.consumerHint}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.editor.close}
          </Button>
          <Button variant="default" size="sm" disabled={busy} onClick={() => void submit()}>
            {t.register.submit}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.list.colKey} htmlFor="r-key" required>
          <Input id="r-key" className="font-mono text-xs" value={form.parameterKey} onChange={set('parameterKey')} placeholder="attendance.new_threshold" />
        </Field>
        <Field label={t.filter.module} htmlFor="r-module" required>
          <Select id="r-module" value={form.module} onChange={set('module')}>
            {PARAMETER_MODULE_CODES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.register.dataTypeUnit} htmlFor="r-type" required>
          <Input id="r-type" value={form.dataType} onChange={set('dataType')} placeholder="INT" />
        </Field>
        <Field label={t.list.colStatus} htmlFor="r-risk" required hint={t.register.riskClassHint}>
          <Select id="r-risk" value={form.riskClass} onChange={set('riskClass')}>
            {PARAMETER_RISK_CLASSES.map((value) => (
              <option key={value} value={value}>
                {t.risk[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t.list.colDefault} htmlFor="r-default" required>
          <Input id="r-default" value={form.defaultValue} onChange={set('defaultValue')} />
        </Field>
        <Field label={t.list.colRange} htmlFor="r-min" hint="min · max">
          <div className="flex gap-2">
            <Input id="r-min" value={form.minValue} onChange={set('minValue')} placeholder="min" />
            <Input id="r-max" value={form.maxValue} onChange={set('maxValue')} placeholder="max" />
          </div>
        </Field>
        <Field label={t.list.colValue} htmlFor="r-unit">
          <Input id="r-unit" value={form.unit} onChange={set('unit')} placeholder="s" />
        </Field>
        <Field label={t.register.consumerHint} htmlFor="r-calls" required>
          <Input id="r-calls" className="font-mono text-[11.5px]" value={form.callSites} onChange={set('callSites')} />
        </Field>
        <Field label="testRef" htmlFor="r-test" required>
          <Input id="r-test" className="font-mono text-[11.5px]" value={form.testRef} onChange={set('testRef')} />
        </Field>
        <Field label={t.editor.reasonLabel} htmlFor="r-reason" required>
          <Textarea id="r-reason" rows={2} value={form.reason} onChange={set('reason')} />
        </Field>
        <Field label={t.list.colDescription} htmlFor="r-desc" required>
          <Textarea id="r-desc" rows={3} value={form.description} onChange={set('description')} />
        </Field>
      </div>
      {error ? (
        <Alert tone="danger" title="VALIDATION_FAILED">
          {error}
        </Alert>
      ) : null}
    </Drawer>
  );
}
