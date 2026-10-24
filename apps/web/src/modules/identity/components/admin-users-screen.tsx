'use client';

/**
 * Layar "Pengguna & Hak" area Admin kampus (API_SPEC §4.6.9, `R-2.1`, pemegang M-03).
 *
 * Tiga hal yang form ini tidak boleh lakukan, dan karena itu tidak dilakukan:
 *  - Menampilkan "simpan peran" yang langsung memberi hak. Tombol ini hanya MENGAYUKAN
 *    permintaan (`202 PENDING`) dan layar memberitahu bahwa hak baru berlaku setelah
 *    orang kedua menyetujui — kalimatnya ada di UI, bukan hanya di dokumen.
 *  - Mengirim kolom `SERVER_ONLY` (`status`, `memberRole` untuk peran efektif, dsb.):
 *    payload divalidasi skema kontrak yang sama dengan server sebelum fetch.
 *  - Menyembunyikan penolakan server: `details[]` dipetakan balik ke error per kolom.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleSlash, History, ShieldCheck, UserPlus, Users } from 'lucide-react';
import {
  CampusMemberRoleSchema,
  CreateAdminUserRequestSchema,
  GrantAssignmentRequestSchema,
  type AdminUserRow,
  type CreateAdminUserRequest,
  type GrantAssignmentRequest,
} from '@sica/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Drawer } from '@/components/ui/drawer';
import { MetaRow, PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { VelzonDataGrid, type ColumnDef, type DataGridRowAction } from '@/components/ui/velzon-data-grid';
import { getDictionary } from '@/lib/i18n';
import { apiRequest, describeFailure, issuesByField } from '@/lib/api-client';

interface RoleOption {
  roleId: string;
  code: string;
  displayName: string;
  scopeKind: string;
  isSystem: boolean;
  holderCount: number;
}

const MEMBER_ROLES = CampusMemberRoleSchema.options;

const EMPTY_USER = { fullName: '', email: '', memberCode: '', memberRole: 'staff', initialPassword: '', reason: '' };
const EMPTY_GRANT = { roleId: '', validTo: '', reason: '' };

export function AdminUsersScreen() {
  const t = getDictionary('id').admin;

  const [rows, setRows] = useState<readonly AdminUserRow[]>([]);
  const [roles, setRoles] = useState<readonly RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_USER);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger' | 'info'; title: string; body: string } | null>(null);

  const [grant, setGrant] = useState<{ row: AdminUserRow } | null>(null);
  const [grantForm, setGrantForm] = useState(EMPTY_GRANT);
  const [grantErrors, setGrantErrors] = useState<Readonly<Record<string, string>>>({});
  const [isGranting, setIsGranting] = useState(false);

  const [deactivate, setDeactivate] = useState<{ row: AdminUserRow } | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const [users, roleList] = await Promise.all([
      apiRequest<readonly AdminUserRow[]>('/api/v1/admin/pengguna', { query: { limit: 100 } }),
      apiRequest<readonly RoleOption[]>('/api/v1/admin/hak-akses/peran'),
    ]);
    if (users.ok) setRows(users.data);
    else setLoadError(describeFailure(users, t));
    if (roleList.ok) setRoles(roleList.data);
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = (key: keyof typeof EMPTY_USER, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submitCreate() {
    setBanner(null);
    const payload: CreateAdminUserRequest = { ...form, memberRole: form.memberRole as CreateAdminUserRequest['memberRole'] };
    const parsed = CreateAdminUserRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      setBanner({ tone: 'danger', title: t.formInvalid, body: parsed.error.issues[0]?.message ?? '' });
      return;
    }
    setFieldErrors({});
    setIsSaving(true);
    const result = await apiRequest<{ userId: string } & Record<string, unknown>>('/api/v1/admin/pengguna', {
      method: 'POST',
      body: payload,
    });
    setIsSaving(false);
    if (!result.ok) {
      setFieldErrors(issuesByField(result.issues));
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setBanner({ tone: 'success', title: t.userCreated, body: `${payload.email} · ${t.userCreatedBody}` });
    setForm(EMPTY_USER);
    setCreateOpen(false);
    void load();
  }

  function openGrant(row: AdminUserRow) {
    setGrant({ row });
    setGrantForm(EMPTY_GRANT);
    setGrantErrors({});
  }

  async function submitGrant() {
    if (!grant) return;
    const payload: GrantAssignmentRequest = {
      userId: grant.row.userId,
      roleId: grantForm.roleId,
      scope: {},
      validTo: grantForm.validTo ? new Date(grantForm.validTo).toISOString() : null,
      reason: grantForm.reason,
    };
    const parsed = GrantAssignmentRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setGrantErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setIsGranting(true);
    const result = await apiRequest<{ requestId: string; status: string }>('/api/v1/admin/hak-akses/penugasan', {
      method: 'POST',
      body: payload,
    });
    setIsGranting(false);
    if (!result.ok) {
      setGrantErrors(issuesByField(result.issues));
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setGrant(null);
    setBanner({
      tone: 'info',
      title: t.requestQueued,
      body: `${t.requestQueuedBody} — ${result.data.status} · ${result.data.requestId.slice(0, 8)}…`,
    });
    void load();
  }

  async function submitDeactivate() {
    if (!deactivate) return;
    setIsDeactivating(true);
    const result = await apiRequest<unknown>(`/api/v1/admin/pengguna/${deactivate.row.userId}/nonaktif`, {
      method: 'POST',
      body: { reason: deactivateReason },
    });
    setIsDeactivating(false);
    if (!result.ok) {
      setBanner({ tone: 'danger', title: result.code, body: describeFailure(result, t) });
      return;
    }
    setBanner({ tone: 'success', title: t.userDeactivated, body: deactivate.row.fullName });
    setDeactivate(null);
    void load();
  }

  const columns = useMemo<readonly ColumnDef<AdminUserRow>[]>(
    () => [
      {
        key: 'fullName',
        header: t.colPerson,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[color:var(--sica-text-heading)]">{row.fullName}</p>
            <p className="truncate text-[11.5px] text-[color:var(--sica-text-muted)]">{row.email}</p>
          </div>
        ),
      },
      {
        key: 'memberCode',
        header: t.colMemberCode,
        render: (row) => <span className="text-[12.5px] tabular">{row.memberCode || '—'}</span>,
      },
      {
        key: 'roleCodes',
        header: t.colEffectiveRoles,
        render: (row) =>
          row.roleCodes.length === 0 ? (
            <Badge tone="secondary" look="label" size="sm">
              {t.noRoles}
            </Badge>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.roleCodes.map((code) => (
                <Badge key={code} tone={code === 'TENANT_ADMIN' ? 'primary' : 'info'} look="label" size="sm">
                  {code}
                </Badge>
              ))}
            </div>
          ),
      },
      { key: 'accountStatus', header: t.colAccountStatus, align: 'center', valueType: 'status' },
      {
        key: 'activeAssignments',
        header: t.colActive,
        align: 'right',
        render: (row) => <span className="text-[12.5px] tabular">{row.activeAssignments}</span>,
      },
    ],
    [t]
  );

  const rowActions = useMemo<readonly DataGridRowAction<AdminUserRow>[]>(
    () => [
      { id: 'grant', label: t.askRole, icon: <ShieldCheck size={16} strokeWidth={2} aria-hidden />, onSelect: (row) => openGrant(row) },
      {
        id: 'deactivate',
        label: t.deactivate,
        tone: 'danger',
        icon: <CircleSlash size={16} strokeWidth={2} aria-hidden />,
        isDisabled: (row) => row.accountStatus === 'DISABLED',
        onSelect: (row) => {
          setDeactivate({ row });
          setDeactivateReason('');
        },
      },
    ],
    [t]
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.usersTitle}
        description={t.usersSubtitle}
        crumbs={[{ label: t.crumbDashboard, href: '/dashboard' }, { label: t.crumbAdmin }, { label: t.crumbUsers }]}
        actions={
          <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus size={15} strokeWidth={2} aria-hidden />
            {t.newUser}
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
        keyExtractor={(row) => row.userId}
        searchKeys={['fullName', 'email', 'memberCode']}
        searchPlaceholder={t.colPerson}
        filter={{
          label: t.colAccountStatus,
          accessor: (row) => row.accountStatus,
          options: [
            { value: 'ACTIVE', label: 'ACTIVE' },
            { value: 'LOCKED', label: 'LOCKED' },
            { value: 'DISABLED', label: 'DISABLED' },
          ],
        }}
        actions={
          <Button variant="soft" size="sm" onClick={() => void load()}>
            <History size={15} strokeWidth={2} aria-hidden />
            {t.reload}
          </Button>
        }
        isLoading={isLoading}
        error={loadError ? { message: loadError, code: 'ADMIN_USERS', retryLabel: t.reload, onRetry: () => void load() } : null}
        emptyMessage={t.empty}
        rowActions={rowActions}
        ariaLabel={t.usersTitle}
      />

      {/* ── Buat akun (identitas saja, tanpa hak) ── */}
      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t.newUser}
        description={t.createHint}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>{t.close}</Button>
            <Button variant="default" size="sm" disabled={isSaving} onClick={() => void submitCreate()}>
              <Users size={15} strokeWidth={2} aria-hidden />
              {isSaving ? t.busy : t.save}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fFullName} htmlFor="au-name" required error={fieldErrors['fullName']}>
            <Input id="au-name" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} />
          </Field>
          <Field label={t.fEmail} htmlFor="au-email" required error={fieldErrors['email']}>
            <Input id="au-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </Field>
          <Field label={t.fMemberCode} htmlFor="au-code" required error={fieldErrors['memberCode']} hint={t.memberCodeHint}>
            <Input id="au-code" value={form.memberCode} onChange={(e) => setField('memberCode', e.target.value)} />
          </Field>
          <Field label={t.fCarrier} htmlFor="au-role" required error={fieldErrors['memberRole']} hint={t.carrierHint}>
            <select
              id="au-role"
              className="form-select"
              value={form.memberRole}
              onChange={(e) => setField('memberRole', e.target.value)}
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label={t.fInitialPassword} htmlFor="au-pass" required error={fieldErrors['initialPassword']} hint={t.passwordHint}>
            <Input id="au-pass" type="password" value={form.initialPassword} onChange={(e) => setField('initialPassword', e.target.value)} />
          </Field>
          <Field label={t.fReason} htmlFor="au-reason" required error={fieldErrors['reason']} hint={t.reasonHint}>
            <Textarea id="au-reason" value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
          </Field>
        </div>
      </Drawer>

      {/* ── Ajukan peran → PENDING, bukan berlaku ── */}
      <Drawer
        open={grant !== null}
        onClose={() => setGrant(null)}
        title={t.askRole}
        description={grant ? `${grant.row.fullName} · ${grant.row.email}` : undefined}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setGrant(null)}>{t.close}</Button>
            <Button
              variant="default"
              size="sm"
              disabled={isGranting || !grantForm.roleId || grantForm.reason.trim().length < 10}
              onClick={() => void submitGrant()}
            >
              <ShieldCheck size={15} strokeWidth={2} aria-hidden />
              {isGranting ? t.busy : t.submitRequest}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <MetaRow
            items={[
              { label: t.colEffectiveRoles, value: grant?.row.roleCodes.join(', ') || t.noRoles },
              { label: t.colActive, value: String(grant?.row.activeAssignments ?? 0) },
            ]}
          />
          <Field label={t.fRole} htmlFor="ag-role" required error={grantErrors['roleId']} hint={t.roleHint}>
            <select
              id="ag-role"
              className="form-select"
              value={grantForm.roleId}
              onChange={(e) => setGrantForm((p) => ({ ...p, roleId: e.target.value }))}
            >
              <option value="">—</option>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.code} · {r.scopeKind} · {r.holderCount} {t.holders}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.fValidTo} htmlFor="ag-validto" error={grantErrors['validTo']} hint={t.validToHint}>
            <Input id="ag-validto" type="date" value={grantForm.validTo} onChange={(e) => setGrantForm((p) => ({ ...p, validTo: e.target.value }))} />
          </Field>
          <Field label={t.fReason} htmlFor="ag-reason" required error={grantErrors['reason']} hint={t.reasonHint}>
            <Textarea id="ag-reason" value={grantForm.reason} onChange={(e) => setGrantForm((p) => ({ ...p, reason: e.target.value }))} />
          </Field>
          <p className="text-[12.5px] text-[color:var(--sica-text-muted)]">{t.grantPendingNote}</p>
        </div>
      </Drawer>

      {/* ── Nonaktif ── */}
      <Drawer
        open={deactivate !== null}
        onClose={() => setDeactivate(null)}
        title={t.deactivate}
        description={deactivate ? deactivate.row.fullName : undefined}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeactivate(null)}>{t.close}</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeactivating || deactivateReason.trim().length < 10}
              onClick={() => void submitDeactivate()}
            >
              {isDeactivating ? t.busy : t.save}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {deactivate ? (
            <>
              <MetaRow
                items={[
                  { label: t.colAccountStatus, value: deactivate.row.accountStatus },
                  { label: t.colEffectiveRoles, value: deactivate.row.roleCodes.join(', ') || t.noRoles },
                ]}
              />
              <StatusBadge status={deactivate.row.accountStatus} look="label" />
            </>
          ) : null}
          <Alert tone="warning" title={t.deactivateTitle}>{t.deactivateBody}</Alert>
          <Field label={t.fReason} htmlFor="ad-reason" required hint={t.reasonHint}>
            <Textarea id="ad-reason" value={deactivateReason} onChange={(e) => setDeactivateReason(e.target.value)} />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}
