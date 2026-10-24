'use client';

/**
 * Layar "Hak Akses" area Admin kampus (API_SPEC §4.6.9, `R-2.1` + sub-rincian `R-2.2`).
 *
 * Dua tab, satu norma: tidak ada tombol yang mengubah hak secara langsung.
 *  - Tab "Peran" membuka sub-rinci izin efektif peran; pengajuan delta memakai
 *    `PUT …/peran/:id/izin` dan jawabannya `202 PENDING` — daftar izin di layar
 *    sengaja belum berubah setelah submit.
 *  - Tab "Penugasan" menampilkan keadaan NYATA dari `user_role_assignments`
 *    (termasuk yang kedaluwarsa) dan pencabutan pun hanya mengajukan permintaan.
 *
 * Peran sistem (`is_system`) tampil tetapi terkunci: deltas tidak dapat diajukan,
 * dan alasannya tertulis di layar, bukan hanya di respons server.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleSlash, History, KeyRound, ShieldCheck, Users2 } from 'lucide-react';
import { type AdminAssignmentRow, type AdminPermissionRow, type AdminRoleRow } from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { apiRequest, describeFailure, formatStamp, issuesByField } from '@/lib/api-client';

type Tab = 'roles' | 'assignments';

interface RolePermissionView extends AdminRoleRow {
  permissions?: readonly AdminPermissionRow[];
}

export function AdminRbacScreen() {
  const t = getDictionary('id').admin;

  const [tab, setTab] = useState<Tab>('roles');
  const [roles, setRoles] = useState<readonly AdminRoleRow[]>([]);
  const [assignments, setAssignments] = useState<readonly AdminAssignmentRow[]>([]);
  const [catalog, setCatalog] = useState<readonly AdminPermissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger' | 'info'; title: string; body: string } | null>(null);

  const [detailRole, setDetailRole] = useState<RolePermissionView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [granted, setGranted] = useState<readonly string[]>([]);
  const [revoked, setRevoked] = useState<readonly string[]>([]);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState('');
  const [deltaErrors, setDeltaErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [revokeRow, setRevokeRow] = useState<AdminAssignmentRow | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const [roleList, assignmentList, permissionCatalog] = await Promise.all([
      apiRequest<readonly AdminRoleRow[]>('/api/v1/admin/hak-akses/peran'),
      apiRequest<readonly AdminAssignmentRow[]>('/api/v1/admin/hak-akses/penugasan', { query: { includeExpired: 'true', limit: 100 } }),
      apiRequest<readonly AdminPermissionRow[]>('/api/v1/admin/hak-akses/izin'),
    ]);
    if (roleList.ok) setRoles(roleList.data);
    if (assignmentList.ok) setAssignments(assignmentList.data);
    if (permissionCatalog.ok) setCatalog(permissionCatalog.data);
    if (!roleList.ok) setLoadError(describeFailure(roleList, t));
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openRole = useCallback(
    async (role: AdminRoleRow) => {
      setDetailOpen(true);
      setDetailBusy(true);
      setDetailError(null);
      setGranted([]);
      setRevoked([]);
      setReason('');
      setSearch('');
      setDetailRole(role);
      const result = await apiRequest<readonly AdminPermissionRow[]>(`/api/v1/admin/hak-akses/peran/${role.roleId}/izin`);
      // Kegagalan dibaca, bukan dilipat jadi "daftar kosong": peran dengan 120 izin tidak
      // boleh tampil sebagai "Belum ada data" hanya karena satu request gagal.
      if (result.ok) {
        setDetailRole({ ...role, permissions: result.data });
      } else {
        setDetailRole({ ...role, permissions: [] });
        setDetailError(result.message);
      }
      setDetailBusy(false);
    },
    []
  );

  const current = useMemo(() => detailRole?.permissions ?? [], [detailRole]);
  const currentIds = useMemo(() => new Set(current.map((p) => p.permissionId)), [current]);

  /**
   * Izin yang tampil di daftar = sudah ada DAN belum diajukan untuk dicabut, ATAU
   * baru diajukan untuk diberi. Ini proyeksi LOCAL dari permintaan, bukan keadaan DB:
   * server masih menahan jumlah lamanya sampai orang kedua menyetujui.
   */
  const visiblePermissions = useMemo(() => {
    const byId = new Map(catalog.map((p) => [p.permissionId, p]));
    const kept = current.filter((p) => !revoked.includes(p.permissionId));
    const added = granted
      .map((id) => byId.get(id))
      .filter((p): p is AdminPermissionRow => p !== undefined && !currentIds.has(p.permissionId));
    return [...kept, ...added].sort((a, b) => a.code.localeCompare(b.code));
  }, [catalog, current, currentIds, granted, revoked]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((p) => !currentIds.has(p.permissionId) && !granted.includes(p.permissionId))
      .filter((p) => p.code.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
      .slice(0, 40);
  }, [catalog, currentIds, granted, search]);

  async function submitDelta() {
    if (!detailRole) return;
    setIsSubmitting(true);
    const result = await apiRequest<{ requestId: string; status: string }>(
      `/api/v1/admin/hak-akses/peran/${detailRole.roleId}/izin`,
      { method: 'PUT', body: { grant: [...granted], revoke: [...revoked], reason } }
    );
    setIsSubmitting(false);
    if (!result.ok) {
      setDeltaErrors(issuesByField(result.issues));
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setDetailOpen(false);
    setBanner({
      tone: 'info',
      title: t.requestQueued,
      body: `${t.deltaQueuedBody} — ${result.data.status} · ${result.data.requestId.slice(0, 8)}…`,
    });
    void load();
  }

  async function submitRevoke() {
    if (!revokeRow) return;
    setIsRevoking(true);
    const result = await apiRequest<{ requestId: string; status: string }>(
      `/api/v1/admin/hak-akses/penugasan/${revokeRow.assignmentId}`,
      { method: 'DELETE', query: { reason: revokeReason } }
    );
    setIsRevoking(false);
    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setRevokeRow(null);
    setBanner({
      tone: 'info',
      title: t.requestQueued,
      body: `${t.revokeQueuedBody} — ${result.data.status} · ${result.data.requestId.slice(0, 8)}…`,
    });
    void load();
  }

  const roleColumns = useMemo<readonly ColumnDef<AdminRoleRow>[]>(
    () => [
      {
        key: 'code',
        header: t.colRole,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">{row.displayName}</p>
            <p className="truncate text-[11.5px] tabular text-[color:var(--sica-text-muted)]">{row.code}</p>
          </div>
        ),
      },
      { key: 'scopeKind', header: t.colScope, align: 'center' },
      {
        key: 'isSystem',
        header: t.colKind,
        align: 'center',
        render: (row) => (
          <Badge tone={row.isSystem ? 'warning' : 'success'} look="label" size="sm">
            {row.isSystem ? t.systemLocked : t.customRole}
          </Badge>
        ),
      },
      { key: 'holderCount', header: t.colHolders, align: 'right', valueType: 'number' },
      { key: 'permissionCount', header: t.colPermissions, align: 'right', valueType: 'number' },
    ],
    [t]
  );

  const roleActions = useMemo<readonly DataGridRowAction<AdminRoleRow>[]>(
    () => [
      { id: 'perms', label: t.openPermissions, icon: <KeyRound size={16} strokeWidth={2} aria-hidden />, onSelect: (row) => void openRole(row) },
    ],
    [t, openRole]
  );

  const assignmentColumns = useMemo<readonly ColumnDef<AdminAssignmentRow>[]>(
    () => [
      {
        key: 'fullName',
        header: t.colPerson,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">{row.fullName}</p>
            <p className="truncate text-[11.5px] text-[color:var(--sica-text-muted)]">{row.roleCode} · {row.scopeKind}</p>
          </div>
        ),
      },
      {
        key: 'origin',
        header: t.colOrigin,
        align: 'center',
        render: (row) => (
          <Badge tone={row.origin === 'GRANT' ? 'primary' : row.origin === 'SEED' ? 'secondary' : 'info'} look="label" size="sm">
            {row.origin}
          </Badge>
        ),
      },
      {
        key: 'validFrom',
        header: t.colValidFrom,
        render: (row) => <span className="text-[12.5px] tabular">{formatStamp(row.validFrom)}</span>,
      },
      {
        key: 'validTo',
        header: t.colValidTo,
        render: (row) => <span className="text-[12.5px] tabular">{row.validTo ? formatStamp(row.validTo) : t.noEnd}</span>,
      },
      { key: 'active', header: t.colState, align: 'center', render: (row) => <StatusBadge status={row.active ? 'ACTIVE' : 'EXPIRED'} look="label" /> },
    ],
    [t]
  );

  const assignmentActions = useMemo<readonly DataGridRowAction<AdminAssignmentRow>[]>(
    () => [
      {
        id: 'revoke',
        label: t.revoke,
        tone: 'danger',
        icon: <CircleSlash size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => !row.active,
        onSelect: (row) => {
          setRevokeRow(row);
          setRevokeReason('');
        },
      },
    ],
    [t]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.rbacTitle}
        description={t.rbacSubtitle}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbAdmin }, { label: t.crumbRbac }]}
        actions={
          <Button variant="soft" size="sm" onClick={() => void load()}>
            <History size={15} strokeWidth={2} aria-hidden />
            {t.reload}
          </Button>
        }
      />

      {banner ? <Alert tone={banner.tone} title={banner.title}>{banner.body}</Alert> : null}

      <div className="flex gap-2" role="tablist" aria-label={t.rbacTitle}>
        {(
          [
            { id: 'roles' as const, label: t.tabRoles, icon: <ShieldCheck size={15} strokeWidth={2} aria-hidden /> },
            { id: 'assignments' as const, label: t.tabAssignments, icon: <Users2 size={15} strokeWidth={2} aria-hidden /> },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'btn-soft-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold'
                : 'inline-flex items-center gap-2 rounded-lg border border-[color:var(--sica-border-color)] px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50/70'
            }
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'roles' ? (
        <VelzonDataGrid
          columns={roleColumns}
          data={roles}
          keyExtractor={(row) => row.roleId}
          searchKeys={['code', 'displayName', 'scopeKind']}
          searchPlaceholder={t.colRole}
          isLoading={isLoading}
          error={loadError ? { message: loadError, code: 'ADMIN_ROLES', retryLabel: t.reload, onRetry: () => void load() } : null}
          emptyMessage={t.empty}
          rowActions={roleActions}
          ariaLabel={t.tabRoles}
        />
      ) : (
        <VelzonDataGrid
          columns={assignmentColumns}
          data={assignments}
          keyExtractor={(row) => row.assignmentId}
          searchKeys={['fullName', 'roleCode', 'origin']}
          searchPlaceholder={t.colPerson}
          isLoading={isLoading}
          error={loadError ? { message: loadError, code: 'ADMIN_ASSIGNMENTS', retryLabel: t.reload, onRetry: () => void load() } : null}
          emptyMessage={t.empty}
          rowActions={assignmentActions}
          ariaLabel={t.tabAssignments}
        />
      )}

      {/* ── Sub-rinci izin peran (`R-2.2`) ── */}
      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${t.openPermissions} · ${detailRole?.code ?? ''}`}
        description={detailRole?.displayName}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[11.5px] text-[color:var(--sica-text-muted)]">
              {granted.length} + / {revoked.length} −
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>{t.close}</Button>
              <Button
                variant="default"
                size="sm"
                disabled={
                  isSubmitting ||
                  detailRole?.isSystem === true ||
                  (granted.length === 0 && revoked.length === 0) ||
                  reason.trim().length < 10
                }
                onClick={() => void submitDelta()}
              >
                <KeyRound size={15} strokeWidth={2} aria-hidden />
                {isSubmitting ? t.busy : t.submitRequest}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {detailBusy ? <Skeleton className="h-4 w-full rounded" /> : null}
          <MetaRow
            items={[
              { label: t.colScope, value: detailRole?.scopeKind ?? '—' },
              { label: t.colPermissions, value: String(detailRole?.permissionCount ?? 0) },
              { label: t.colHolders, value: String(detailRole?.holderCount ?? 0) },
            ]}
          />
          {detailRole?.isSystem ? (
            <Alert tone="warning" title={t.systemLocked}>{t.systemLockedBody}</Alert>
          ) : null}

          <Field label={t.searchPermission} htmlFor="ap-search" hint={t.searchPermissionHint}>
            <Input id="ap-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="finance.invoice" />
          </Field>
          {searchResults.length > 0 ? (
            <ul className="flex max-h-44 flex-col gap-1 overflow-auto rounded-lg border border-[color:var(--sica-border-color)] p-2">
              {searchResults.map((p) => (
                <li key={p.permissionId}>
                  <button
                    type="button"
                    onClick={() => setGranted((prev) => [...prev, p.permissionId])}
                    className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-slate-50/80"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium tabular">{p.code}</span>
                      <span className="block truncate text-[11.5px] text-[color:var(--sica-text-muted)]">{p.description}</span>
                    </span>
                    <Badge tone="primary" look="label" size="sm">{p.verb}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : search.trim().length >= 2 ? (
            <p className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.noSearchResults}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="section-label">{t.effectivePermissions}</p>
            <p className="text-[12px] text-[color:var(--sica-text-muted)]">{t.previewNote}</p>
            <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
              {visiblePermissions.map((p) => {
                const isNew = granted.includes(p.permissionId);
                const isOut = revoked.includes(p.permissionId);
                return (
                  <li
                    key={p.permissionId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--sica-border-color)] px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium tabular">{p.code}</span>
                      <span className="block truncate text-[11.5px] text-[color:var(--sica-text-muted)]">{p.module} · {p.resource}</span>
                    </span>
                    {isNew ? (
                      <Badge tone="success" look="label" size="sm">{t.pendingAdd}</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isOut || detailRole?.isSystem === true}
                        onClick={() => setRevoked((prev) => [...prev, p.permissionId])}
                      >
                        {isOut ? t.pendingRemove : t.remove}
                      </Button>
                    )}
                  </li>
                );
              })}
              {detailBusy ? (
                <li className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.loadingList}</li>
              ) : detailError ? (
                <li className="text-[12.5px] text-[color:var(--sica-danger-ink)]">
                  {t.loadFailed.replace('{message}', detailError)}
                </li>
              ) : visiblePermissions.length === 0 ? (
                <li className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.empty}</li>
              ) : null}
            </ul>
          </div>

          <Field label={t.fReason} htmlFor="ap-reason" required error={deltaErrors['reason']} hint={t.reasonHint}>
            <Textarea id="ap-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Drawer>

      {/* ── Cabut penugasan → permintaan REVOKE ── */}
      <Drawer
        open={revokeRow !== null}
        onClose={() => setRevokeRow(null)}
        title={t.revoke}
        description={revokeRow ? `${revokeRow.fullName} · ${revokeRow.roleCode}` : undefined}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setRevokeRow(null)}>{t.close}</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isRevoking || revokeReason.trim().length < 10}
              onClick={() => void submitRevoke()}
            >
              {isRevoking ? t.busy : t.submitRequest}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {revokeRow ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">{t.colState}</CardTitle>
              </CardHeader>
              <CardContent>
                <MetaRow
                  items={[
                    { label: t.colOrigin, value: revokeRow.origin },
                    { label: t.colValidTo, value: revokeRow.validTo ? formatStamp(revokeRow.validTo) : t.noEnd },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}
          <Alert tone="info" title={t.requestQueued}>{t.revokeQueuedBody}</Alert>
          <Field label={t.fReason} htmlFor="ar-reason" required hint={t.reasonHint}>
            <Textarea id="ar-reason" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}
