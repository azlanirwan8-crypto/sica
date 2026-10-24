/**
 * Mesin empat-mata perubahan hak (M-03, API_SPEC §4.6.9, DATA_MODEL §14.3.3 migrasi `0082`).
 *
 * Norma yang ditegakkan file ini — bukan sekadar dilambangkan:
 *  1. **Satu jalan.** Tidak ada fungsi di bawah yang menulis `user_role_assignments` atau
 *     `role_permissions` sebagai reaksi langsung terhadap permintaan klien. Semua perubahan
 *     hak lahir sebagai baris `access_change_requests` `PENDING` (`202`) dan efeknya baru
 *     ada saat `decideAccessRequest` dipanggil ORANG KEDUA.
 *  2. **L4 nyata.** `holdsScoped(access, PERM.x)` membuktikan izin dipegang, lalu
 *     `coversScope` membuktikan dimensi yang diminta berada di dalam himpunan penugasan
 *     aktor — penyetuju tidak boleh memberi hak lebih luas dari dirinya sendiri
 *     (`403 ADMIN_SCOPE_MISMATCH`, register 16). Menutup `SEC-11` untuk gugus ini.
 *  3. **SoD ditegakkan, bukan diandaikan.** `violatesSoD()` dipanggil saat pengajuan GRANT
 *     dan sekali lagi saat keputusan (keadaan bisa berubah di antaranya): pasangan peran
 *     mutual-eksklusif tidak pernah bisa mendarat di `user_role_assignments`. Ini pemanggil
 *     produksi pertama fungsi tersebut (menutup `SEC-12`).
 *  4. **Atomik.** Efek + baris keputusan + `audit_logs` terjadi dalam SATU transaksi;
 *     galat domain dilempar sebagai kelas agar `withTenantContext` rollback, bukan
 *     `return {ok:false}` yang ikut ter-commit.
 */
import { randomUUID } from 'node:crypto';
import {
  accessChangeRequests,
  and,
  desc,
  eq,
  eqOrIsNull,
  inArray,
  isNull,
  or,
  rolePermissions,
  permissions,
  roles,
  sql,
  tenantMemberships,
  userRoleAssignments,
  withTenantContext,
  type TenantTx,
} from '@sica/database';
import {
  PERM,
  violatesSoD,
  type AccessRequestKind,
  type AccessRequestPayload,
  type AccessRequestView,
  type AssignmentScopeInput,
  type CreateAccessRequest,
  type PermissionCode,
  type RoleCode,
} from '@sica/contracts';
import {
  holdsScoped,
  loadEffectiveAccess,
  type AssignmentScope,
  type EffectiveAccess,
} from '@/modules/authz/rbac-repository';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';

export type AccessRequestError =
  | { readonly kind: 'REQUEST_NOT_FOUND' }
  | { readonly kind: 'ROLE_NOT_FOUND' }
  | { readonly kind: 'TARGET_NOT_MEMBER' }
  | { readonly kind: 'TARGET_NOT_ACTIVE' }
  | { readonly kind: 'ASSIGNMENT_NOT_FOUND' }
  | { readonly kind: 'ASSIGNMENT_ALREADY_ACTIVE' }
  | { readonly kind: 'SYSTEM_ROLE_LOCKED' }
  | { readonly kind: 'SCOPE_CHANGE_BLOCKED' }
  | { readonly kind: 'SCOPE_MISMATCH'; readonly permission: PermissionCode }
  | { readonly kind: 'SoD_VIOLATION'; readonly pair: readonly RoleCode[] }
  | { readonly kind: 'SELF_APPROVAL'; readonly reason: 'APPROVER_IS_REQUESTER' | 'APPROVER_IS_TARGET' }
  | { readonly kind: 'DECISION_ALREADY_MADE'; readonly status: string }
  | { readonly kind: 'DUPLICATE_PENDING_REQUEST' }
  | { readonly kind: 'PERMISSION_NOT_IN_CATALOG'; readonly ids: readonly string[] };

export type AccessRequestResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccessRequestError };

/** Aktor + hak efektifnya — dibaca sekali oleh guard, diteruskan tanpa dibaca ulang. */
export interface Actor {
  readonly tenantId: string;
  readonly userId: string;
  readonly access: EffectiveAccess;
}

class DomainFailure extends Error {
  constructor(readonly detail: AccessRequestError) {
    super(detail.kind);
  }
}

const SCOPE_DIMENSIONS = ['orgId', 'programId', 'classId', 'periodId', 'studentId'] as const;

/**
 * Apakah satu penugasan aktor mencakup seluruh dimensi yang diminta.
 * `null` pada sisi aktor = tak terbatas pada dimensi itu; permintaan tanpa batas
 * (`null`/undefined) dari aktor yang TERBATAS = lebih luas dari dirinya → ditolak.
 */
export function coversScope(held: AssignmentScope, wanted: AssignmentScopeInput): boolean {
  return SCOPE_DIMENSIONS.every((dimension) => {
    if (held[dimension] === null) return true;
    return wanted[dimension] != null && wanted[dimension] === held[dimension];
  });
}

/** Izin dipegang DAN lingkup permintaan berada di dalam lingkup pemegangnya (L4). */
export function holdsWithinScope(
  access: EffectiveAccess,
  permission: PermissionCode,
  wanted: AssignmentScopeInput
): boolean {
  if (!holdsScoped(access, permission)) return false;
  return access.grants.some(
    (grant) =>
      grant.grants.some((item) => item.code === permission) && coversScope(grant.scope, wanted)
  );
}

/**
 * Izin yang mengkhususkan tiap jenis permintaan. `SCOPE_CHANGE` **tidak punya** izin
 * kanonik yang dipromosikan (baris 112 masih `usulan`, `G-15`) — rutenya diblokir
 * sesuai API_SPEC §4.6.9, bukan dilayani dengan izin pinjaman.
 */
function permissionForKind(kind: AccessRequestKind): PermissionCode | null {
  switch (kind) {
    case 'GRANT':
      return PERM.identityAssignmentGrant;
    case 'REVOKE':
      return PERM.identityAssignmentRevoke;
    case 'SCOPE_CHANGE':
      return null;
    case 'ROLE_PERMISSION_CHANGE':
      return PERM.identityRoleUpdate;
  }
}

function payloadOf(req: CreateAccessRequest): AccessRequestPayload {
  if (req.requestKind === 'ROLE_PERMISSION_CHANGE') {
    return {
      kind: 'ROLE_PERMISSION',
      grant: req.permissionDelta?.grant ?? [],
      revoke: req.permissionDelta?.revoke ?? [],
    };
  }
  return {
    kind: 'ASSIGNMENT',
    scope: req.scope,
    ...(req.assignmentId ? { assignmentId: req.assignmentId } : {}),
    ...(req.validTo !== undefined && req.validTo !== null ? { validTo: req.validTo } : {}),
  };
}

/**
 * Dimensi yang harus dibuktikan. Untuk `ROLE_PERMISSION_CHANGE` komposisi role adalah
 * fakta tenant-wide → dimensi kosong, sehingga hanya aktor tanpa batas (penugasan
 * `TENANT`) yang memenuhi `coversScope`.
 */
function scopeRequiredFor(req: CreateAccessRequest): AssignmentScopeInput {
  return req.requestKind === 'ROLE_PERMISSION_CHANGE' ? {} : req.scope;
}

// ============================================================================
// Pengajuan — selalu PENDING, tidak pernah langsung berlaku
// ============================================================================
export async function submitAccessRequest(
  actor: Actor,
  req: CreateAccessRequest
): Promise<AccessRequestResult<AccessRequestView>> {
  const permission = permissionForKind(req.requestKind);
  if (!permission) return { ok: false, error: { kind: 'SCOPE_CHANGE_BLOCKED' } };

  // L4: pemohon sendiri wajib berada di dalam lingkup yang dia mintakan — permintaan
  // di luar scope aktor ditolak SEBELUM ada baris, bukan menunggu penyetuju.
  if (!holdsWithinScope(actor.access, permission, scopeRequiredFor(req))) {
    return { ok: false, error: { kind: 'SCOPE_MISMATCH', permission } };
  }

  const payload = payloadOf(req);

  try {
    const view = await withTenantContext(actor.tenantId, async (tx) => {
      const roleRows = await tx
        .select({ id: roles.id, code: roles.code, isSystem: roles.isSystem })
        .from(roles)
        .where(eq(roles.id, req.roleId))
        .limit(1);
      const role = roleRows[0];
      if (!role) throw new DomainFailure({ kind: 'ROLE_NOT_FOUND' });

      if (req.requestKind === 'ROLE_PERMISSION_CHANGE') {
        if (role.isSystem) throw new DomainFailure({ kind: 'SYSTEM_ROLE_LOCKED' });
        if (payload.kind === 'ROLE_PERMISSION') {
          await assertPermissionsExist(tx, [...payload.grant, ...payload.revoke]);
        }
      } else {
        const targetUserId = req.targetUserId;
        if (!targetUserId) throw new DomainFailure({ kind: 'TARGET_NOT_MEMBER' });
        const membership = await tx
          .select({ id: tenantMemberships.id, status: tenantMemberships.status })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, actor.tenantId),
              eq(tenantMemberships.userId, targetUserId)
            )
          )
          .limit(1);
        const member = membership[0];
        if (!member) throw new DomainFailure({ kind: 'TARGET_NOT_MEMBER' });
        if (req.requestKind === 'GRANT' && member.status !== 'ACTIVE') {
          throw new DomainFailure({ kind: 'TARGET_NOT_ACTIVE' });
        }

        if (req.requestKind === 'GRANT') {
          const held = await loadRolesOf(tx, actor.tenantId, targetUserId);
          const pair = violatesSoD([...held, role.code as RoleCode]);
          if (pair) throw new DomainFailure({ kind: 'SoD_VIOLATION', pair });
        } else if (req.assignmentId) {
          // Penunjuk yang salah diketahui saat pengajuan, bukan sesudah orang kedua repot-repot menyetujui.
          const pointed = await tx
            .select({ id: userRoleAssignments.id })
            .from(userRoleAssignments)
            .where(
              and(
                eq(userRoleAssignments.tenantId, actor.tenantId),
                eq(userRoleAssignments.userId, targetUserId),
                eq(userRoleAssignments.id, req.assignmentId)
              )
            )
            .limit(1);
          if (pointed.length === 0) throw new DomainFailure({ kind: 'ASSIGNMENT_NOT_FOUND' });
        }
      }

      const id = randomUUID();
      const requestedAt = new Date();
      await insertRequest(tx, {
        id,
        tenantId: actor.tenantId,
        requesterId: actor.userId,
        targetUserId: req.targetUserId ?? null,
        roleId: req.roleId,
        requestKind: req.requestKind,
        scope: payload,
        reason: req.reason,
      });

      await appendAuditEntry(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        actorRoleCtx: { roles: actor.access.roles },
        targetEntity: 'access_change_requests',
        targetId: id,
        action: 'identity.accessrequest.submit',
        after: { requestKind: req.requestKind, roleId: req.roleId, scope: payload },
        reason: req.reason,
      });

      return toView({
        id,
        requestKind: req.requestKind,
        targetUserId: req.targetUserId ?? null,
        roleId: req.roleId,
        roleCode: role.code,
        scope: payload,
        status: 'PENDING',
        reason: req.reason,
        requesterId: actor.userId,
        approverId: null,
        decisionReason: null,
        requestedAt,
        decidedAt: null,
      });
    });

    return { ok: true, value: view };
  } catch (error) {
    return mapFailure(error);
  }
}

async function insertRequest(
  tx: TenantTx,
  row: {
    id: string;
    tenantId: string;
    requesterId: string;
    targetUserId: string | null;
    roleId: string;
    requestKind: AccessRequestKind;
    scope: AccessRequestPayload;
    reason: string;
  }
): Promise<void> {
  try {
    await tx.insert(accessChangeRequests).values({ ...row, status: 'PENDING' });
  } catch (error) {
    // `uq_acr_pending_scope` (indeks parsial atas md5(scope::text)): dua pengajuan
    // identik tidak boleh menjadi dua baris yang masing-masing bisa disetujui.
    if (isUniqueViolation(error)) throw new DomainFailure({ kind: 'DUPLICATE_PENDING_REQUEST' });
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | undefined)?.code === '23505';
}

async function assertPermissionsExist(tx: TenantTx, ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const found = await tx
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.id, unique));
  const known = new Set(found.map((r) => r.id));
  const unknown = unique.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new DomainFailure({ kind: 'PERMISSION_NOT_IN_CATALOG', ids: unknown });
}

async function loadRolesOf(tx: TenantTx, tenantId: string, userId: string): Promise<readonly RoleCode[]> {
  const rows = await tx
    .select({ code: roles.code })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(
      and(
        eq(userRoleAssignments.tenantId, tenantId),
        eq(userRoleAssignments.userId, userId),
        liveWindow()
      )
    );
  return rows.map((r) => r.code as RoleCode);
}

/** Penugasan yang masih berlaku pada saat transaksi — `valid_to` NULL berarti terbuka. */
function liveWindow() {
  return or(isNull(userRoleAssignments.validTo), sql`${userRoleAssignments.validTo} > now()`);
}

/**
 * Ajukan pencabutan satu penugasan. `roleId`/`targetUserId`/`scope` TIDAK dipercaya
 * dari klien: semuanya dibaca dari baris penugasan di dalam konteks tenant (anti-IDOR,
 * `SEC-02`) lalu dipakai menyusun permintaan `REVOKE`.
 */
export async function submitRevokeRequest(
  actor: Actor,
  assignmentId: string,
  reason: string
): Promise<AccessRequestResult<AccessRequestView>> {
  const source = await withTenantContext(actor.tenantId, async (tx) => {
    const rows = await tx
      .select({
        userId: userRoleAssignments.userId,
        roleId: userRoleAssignments.roleId,
        validTo: userRoleAssignments.validTo,
        scopeOrgId: userRoleAssignments.scopeOrgId,
        scopeProgramId: userRoleAssignments.scopeProgramId,
        scopeClassId: userRoleAssignments.scopeClassId,
        scopePeriodId: userRoleAssignments.scopePeriodId,
        scopeStudentId: userRoleAssignments.scopeStudentId,
      })
      .from(userRoleAssignments)
      .where(and(eq(userRoleAssignments.tenantId, actor.tenantId), eq(userRoleAssignments.id, assignmentId)))
      .limit(1);
    return rows[0] ?? null;
  });
  if (!source) return { ok: false, error: { kind: 'ASSIGNMENT_NOT_FOUND' } };

  return submitAccessRequest(actor, {
    requestKind: 'REVOKE',
    targetUserId: source.userId,
    roleId: source.roleId,
    scope: {
      orgId: source.scopeOrgId,
      programId: source.scopeProgramId,
      classId: source.scopeClassId,
      periodId: source.scopePeriodId,
      studentId: source.scopeStudentId,
    },
    assignmentId,
    reason,
  });
}

// ============================================================================
// Keputusan — satu-satunya tempat efek perubahan hak dilahirkan
// ============================================================================
export interface DecideOutcome {
  readonly requestId: string;
  readonly status: 'APPROVED' | 'REJECTED';
  readonly decidedAt: string;
  readonly effect: string;
}

export async function decideAccessRequest(
  approver: Actor,
  requestId: string,
  outcome: 'APPROVED' | 'REJECTED',
  decisionReason: string | null
): Promise<AccessRequestResult<DecideOutcome>> {
  try {
    const value = await withTenantContext(approver.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(accessChangeRequests)
        .where(eq(accessChangeRequests.id, requestId))
        .limit(1)
        .for('update');
      const row = rows[0];
      if (!row) throw new DomainFailure({ kind: 'REQUEST_NOT_FOUND' });
      if (row.status !== 'PENDING') {
        throw new DomainFailure({ kind: 'DECISION_ALREADY_MADE', status: row.status });
      }
      if (row.requesterId === approver.userId) {
        throw new DomainFailure({ kind: 'SELF_APPROVAL', reason: 'APPROVER_IS_REQUESTER' });
      }
      if (row.targetUserId === approver.userId) {
        // Empat-mata terhadap diri sendiri: menyetujui grant untuk diri sendiri adalah
        // jalur eskalasi yang sama, walaupun pemohonnya orang lain.
        throw new DomainFailure({ kind: 'SELF_APPROVAL', reason: 'APPROVER_IS_TARGET' });
      }

      const payload = row.scope as AccessRequestPayload;
      const wanted = payload.kind === 'ASSIGNMENT' ? payload.scope : {};
      if (!holdsWithinScope(approver.access, PERM.identityAccessRequestApprove, wanted)) {
        throw new DomainFailure({ kind: 'SCOPE_MISMATCH', permission: PERM.identityAccessRequestApprove });
      }

      const decidedAt = new Date();

      if (outcome === 'REJECTED') {
        await tx
          .update(accessChangeRequests)
          .set({ status: 'REJECTED', approverId: approver.userId, decidedAt, decisionReason })
          .where(eq(accessChangeRequests.id, requestId));
        await appendAuditEntry(tx, {
          tenantId: approver.tenantId,
          actorUserId: approver.userId,
          actorRoleCtx: { roles: approver.access.roles },
          targetEntity: 'access_change_requests',
          targetId: requestId,
          action: 'identity.accessrequest.reject',
          before: { status: 'PENDING' },
          after: { status: 'REJECTED' },
          reason: decisionReason,
        });
        return { requestId, status: 'REJECTED' as const, decidedAt: decidedAt.toISOString(), effect: 'NONE' };
      }

      const effect = await applyEffect(tx, approver, row, payload);

      await tx
        .update(accessChangeRequests)
        .set({ status: 'APPROVED', approverId: approver.userId, decidedAt })
        .where(eq(accessChangeRequests.id, requestId));
      await appendAuditEntry(tx, {
        tenantId: approver.tenantId,
        actorUserId: approver.userId,
        actorRoleCtx: { roles: approver.access.roles },
        targetEntity: 'access_change_requests',
        targetId: requestId,
        action: 'identity.accessrequest.approve',
        before: { status: 'PENDING' },
        after: { status: 'APPROVED', effect },
        reason: row.reason,
      });

      return { requestId, status: 'APPROVED' as const, decidedAt: decidedAt.toISOString(), effect };
    });

    return { ok: true, value };
  } catch (error) {
    return mapFailure(error);
  }
}

type RequestRow = typeof accessChangeRequests.$inferSelect;

/**
 * Terjemahkan `PENDING` menjadi keadaan nyata. Semua prasyarat diperiksa ulang:
 * §4.6.9 melarang permintaan menggantung bila target/role sudah tidak sah saat
 * keputusan tiba — lebih baik gagal sekarang dengan 404/409 daripada menunda.
 */
async function applyEffect(
  tx: TenantTx,
  approver: Actor,
  row: RequestRow,
  payload: AccessRequestPayload
): Promise<string> {
  if (row.requestKind === 'ROLE_PERMISSION_CHANGE') {
    if (payload.kind !== 'ROLE_PERMISSION') return 'MALFORMED_PAYLOAD';
    const grant = [...new Set(payload.grant)];
    const revoke = [...new Set(payload.revoke)];
    await assertPermissionsExist(tx, [...grant, ...revoke]);

    for (const permissionId of revoke) {
      await tx
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, row.roleId), eq(rolePermissions.permissionId, permissionId)));
    }
    for (const permissionId of grant) {
      await tx
        .insert(rolePermissions)
        .values({ tenantId: approver.tenantId, roleId: row.roleId, permissionId, grantedBy: approver.userId })
        .onConflictDoNothing();
    }
    return `ROLE_PERMISSIONS +${grant.length} -${revoke.length}`;
  }

  if (payload.kind !== 'ASSIGNMENT') return 'MALFORMED_PAYLOAD';
  const targetUserId = row.targetUserId;
  if (!targetUserId) return 'TARGET_MISSING';

  const membership = await tx
    .select({ id: tenantMemberships.id, status: tenantMemberships.status })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, approver.tenantId),
        eq(tenantMemberships.userId, targetUserId)
      )
    )
    .limit(1);
  if (membership.length === 0) throw new DomainFailure({ kind: 'TARGET_NOT_MEMBER' });
  if (membership[0]?.status !== 'ACTIVE') throw new DomainFailure({ kind: 'TARGET_NOT_ACTIVE' });

  const roleRows = await tx
    .select({ code: roles.code })
    .from(roles)
    .where(eq(roles.id, row.roleId))
    .limit(1);
  const roleCode = roleRows[0]?.code;
  if (!roleCode) throw new DomainFailure({ kind: 'ROLE_NOT_FOUND' });

  if (row.requestKind === 'GRANT') {
    // SoD diperiksa ulang: pasangan eksklusif bisa saja sudah dipegang sejak pengajuan.
    const held = await loadRolesOf(tx, approver.tenantId, targetUserId);
    const pair = violatesSoD([...held, roleCode as RoleCode]);
    if (pair) throw new DomainFailure({ kind: 'SoD_VIOLATION', pair });

    const scope = payload.scope;
    const duplicate = await tx
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(
        and(
          eq(userRoleAssignments.tenantId, approver.tenantId),
          eq(userRoleAssignments.userId, targetUserId),
          eq(userRoleAssignments.roleId, row.roleId),
          eqOrIsNull(userRoleAssignments.scopeOrgId, scope.orgId),
          eqOrIsNull(userRoleAssignments.scopeProgramId, scope.programId),
          eqOrIsNull(userRoleAssignments.scopeClassId, scope.classId),
          eqOrIsNull(userRoleAssignments.scopePeriodId, scope.periodId),
          eqOrIsNull(userRoleAssignments.scopeStudentId, scope.studentId),
          liveWindow()
        )
      )
      .limit(1);
    if (duplicate.length > 0) throw new DomainFailure({ kind: 'ASSIGNMENT_ALREADY_ACTIVE' });

    await tx.insert(userRoleAssignments).values({
      id: randomUUID(),
      tenantId: approver.tenantId,
      userId: targetUserId,
      roleId: row.roleId,
      scopeOrgId: scope.orgId ?? null,
      scopeProgramId: scope.programId ?? null,
      scopeClassId: scope.classId ?? null,
      scopePeriodId: scope.periodId ?? null,
      scopeStudentId: scope.studentId ?? null,
      validTo: payload.validTo ? new Date(payload.validTo) : null,
      origin: 'GRANT',
      assignedBy: approver.userId,
      reason: row.reason,
    });
    return `ASSIGNMENT_GRANTED ${roleCode}`;
  }

  if (row.requestKind !== 'REVOKE') return `KIND_NOT_ENFORCEABLE ${row.requestKind}`;

  const assignmentId = payload.assignmentId;
  if (!assignmentId) return 'ASSIGNMENT_POINTER_MISSING';
  const existing = await tx
    .select({ id: userRoleAssignments.id })
    .from(userRoleAssignments)
    .where(
      and(eq(userRoleAssignments.tenantId, approver.tenantId), eq(userRoleAssignments.id, assignmentId))
    )
    .limit(1);
  if (existing.length === 0) throw new DomainFailure({ kind: 'ASSIGNMENT_NOT_FOUND' });

  // Pencabutan TIDAK menghapus baris: `valid_to` ditutup, riwayat tetap terbaca (§14.3.3 butir c).
  await tx
    .update(userRoleAssignments)
    .set({ validTo: new Date(), reason: row.reason })
    .where(eq(userRoleAssignments.id, assignmentId));
  return `ASSIGNMENT_REVOKED ${assignmentId}`;
}

function mapFailure<T>(error: unknown): AccessRequestResult<T> {
  if (error instanceof DomainFailure) return { ok: false, error: error.detail };
  if (isUniqueViolation(error)) return { ok: false, error: { kind: 'DUPLICATE_PENDING_REQUEST' } };
  throw error;
}

// ============================================================================
// Baca
// ============================================================================
type RequestViewRow = {
  id: string;
  requestKind: string;
  targetUserId: string | null;
  roleId: string;
  roleCode: string;
  scope: unknown;
  status: string;
  reason: string;
  requesterId: string;
  approverId: string | null;
  decisionReason: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
};

function toView(row: RequestViewRow): AccessRequestView {
  return {
    requestId: row.id,
    requestKind: row.requestKind,
    targetUserId: row.targetUserId,
    roleId: row.roleId,
    roleCode: row.roleCode,
    scope: (row.scope ?? {}) as Record<string, unknown>,
    status: row.status,
    reason: row.reason,
    requesterId: row.requesterId,
    approverId: row.approverId,
    decisionReason: row.decisionReason,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
  };
}

const requestColumns = {
  id: accessChangeRequests.id,
  requestKind: accessChangeRequests.requestKind,
  targetUserId: accessChangeRequests.targetUserId,
  roleId: accessChangeRequests.roleId,
  roleCode: roles.code,
  scope: accessChangeRequests.scope,
  status: accessChangeRequests.status,
  reason: accessChangeRequests.reason,
  requesterId: accessChangeRequests.requesterId,
  approverId: accessChangeRequests.approverId,
  decisionReason: accessChangeRequests.decisionReason,
  requestedAt: accessChangeRequests.requestedAt,
  decidedAt: accessChangeRequests.decidedAt,
};

export interface ListRequestsQuery {
  readonly status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'all';
  readonly requestKind?: AccessRequestKind;
  readonly perspective?: 'MINE' | 'TENANT';
  readonly requestId?: string;
  readonly page: number;
  readonly limit: number;
}

export interface ListRequestsResult {
  readonly rows: readonly AccessRequestView[];
  readonly total: number;
}

/**
 * `MINE` selalu tersedia (pemohon melihat miliknya); pandangan tenant menuntut izin
 * `identity.accessrequest.view` — tanpa itu daftar menyempit ke milik sendiri, bukan
 * menolak dengan 403 yang membocorkan bahwa daftar itu ada.
 */
export async function listAccessRequests(
  actor: Actor,
  q: ListRequestsQuery
): Promise<ListRequestsResult> {
  const tenantWide =
    q.perspective !== 'MINE' && actor.access.permissions.has(PERM.identityAccessRequestView);

  return withTenantContext(actor.tenantId, async (tx) => {
    const where = and(
      eq(accessChangeRequests.tenantId, actor.tenantId),
      ...(tenantWide ? [] : [eq(accessChangeRequests.requesterId, actor.userId)]),
      ...(q.status && q.status !== 'all' ? [eq(accessChangeRequests.status, q.status)] : []),
      ...(q.requestKind ? [eq(accessChangeRequests.requestKind, q.requestKind)] : []),
      ...(q.requestId ? [eq(accessChangeRequests.id, q.requestId)] : [])
    );

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accessChangeRequests)
      .where(where);
    const rows = await tx
      .select(requestColumns)
      .from(accessChangeRequests)
      .innerJoin(roles, eq(accessChangeRequests.roleId, roles.id))
      .where(where)
      .orderBy(desc(accessChangeRequests.requestedAt))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    return { rows: rows.map(toView), total: counted[0]?.count ?? 0 };
  });
}

/** Akses efektif dibaca ulang setiap permintaan — pencabutan berlaku pada permintaan berikutnya. */
export async function actorOf(tenantId: string, userId: string): Promise<Actor> {
  const access = await loadEffectiveAccess(tenantId, userId);
  return { tenantId, userId, access };
}
