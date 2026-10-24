/**
 * Layanan inti identitas rute `/api/v1/admin/**` (M-03, API_SPEC §4.6.9).
 *
 * Baca: proyeksi per-tenant atas `users` × `tenant_memberships` × `user_role_assignments`.
 * Peran yang ditampilkan adalah hasil `user_role_assignments` (keadaan nyata), BUKAN
 * label carrier `member_role` (`SEC-10`) — carrier hanya menentukan routeset login.
 *
 * Tulis identitas (buat/ubah/nonaktifkan) TIDAK pernah menyentuh hak akses: itu tugas
 * `access-request.service.ts`. Nonaktif = status + `valid_to` penugasan ditutup +
 * sesi dicabut; baris pengguna tidak pernah di-DELETE (riwayat harus terbaca lagi).
 */
import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  db,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  permissions as permissionsTable,
  rolePermissions,
  roles as rolesTable,
  sessions,
  tenantMemberships,
  userRoleAssignments,
  users,
  withTenantContext,
  type TenantTx,
} from '@sica/database';
import type {
  AdminAssignmentRow,
  AdminPermissionRow,
  AdminRoleRow,
  AdminUserListQuery,
  AdminUserRow,
  CreateAdminUserRequest,
  CreateRoleRequest,
  UpdateAdminUserRequest,
  UpdateRoleRequest,
} from '@sica/contracts';
import { createPasswordHasher } from '@/modules/auth/services/password.service';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';

export type AdminIdentityError =
  | { readonly kind: 'USER_NOT_FOUND' }
  | { readonly kind: 'EMAIL_TAKEN' }
  | { readonly kind: 'MEMBER_CODE_TAKEN' }
  | { readonly kind: 'CANNOT_DEACTIVATE_SELF' }
  | { readonly kind: 'ROLE_NOT_FOUND' }
  | { readonly kind: 'ROLE_CODE_TAKEN' }
  | { readonly kind: 'ROLE_IN_USE' }
  | { readonly kind: 'SYSTEM_ROLE_LOCKED' };

export type AdminIdentityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AdminIdentityError };

export interface ActorRef {
  readonly tenantId: string;
  readonly userId: string;
}

export interface Paged<T> {
  readonly rows: readonly T[];
  readonly total: number;
}

const hasher = () => createPasswordHasher(process.env['PASSWORD_HASH_PEPPER'] ?? '');

/** Baris pengguna + keanggotaan dalam satu proyeksi; `roleCodes` ditambahkan terpisah. */
interface UserProjection {
  userId: string;
  membershipId: string;
  memberCode: string | null;
  email: string;
  fullName: string;
  memberRole: string;
  membershipStatus: string;
  accountStatus: string;
}

const userColumns = {
  userId: users.id,
  membershipId: tenantMemberships.id,
  memberCode: tenantMemberships.memberCode,
  email: users.email,
  fullName: users.fullName,
  memberRole: tenantMemberships.role,
  membershipStatus: tenantMemberships.status,
  accountStatus: users.status,
} as const;

function toRow(p: UserProjection, codes: readonly string[], active: number): AdminUserRow {
  return {
    userId: p.userId,
    membershipId: p.membershipId,
    memberCode: p.memberCode ?? '',
    email: p.email,
    fullName: p.fullName,
    memberRole: p.memberRole as AdminUserRow['memberRole'],
    membershipStatus: p.membershipStatus,
    accountStatus: p.accountStatus,
    roleCodes: [...codes],
    activeAssignments: active,
  };
}

/** Peran efektif dari penugasan — yang `valid_to`-nya masih terbuka dihitung "aktif". */
async function rolesByUser(
  tx: TenantTx,
  tenantId: string,
  userIds: readonly string[]
): Promise<Map<string, { codes: string[]; active: number }>> {
  const map = new Map<string, { codes: string[]; active: number }>();
  if (userIds.length === 0) return map;
  const now = new Date();
  const rows = await tx
    .select({
      userId: userRoleAssignments.userId,
      code: rolesTable.code,
      validTo: userRoleAssignments.validTo,
    })
    .from(userRoleAssignments)
    .innerJoin(rolesTable, eq(userRoleAssignments.roleId, rolesTable.id))
    .where(
      and(eq(userRoleAssignments.tenantId, tenantId), inArray(userRoleAssignments.userId, [...userIds]))
    );
  for (const row of rows) {
    const entry = map.get(row.userId) ?? { codes: [], active: 0 };
    entry.codes.push(row.code);
    if (row.validTo === null || row.validTo > now) entry.active += 1;
    map.set(row.userId, entry);
  }
  return map;
}

// ============================================================================
// Daftar pengguna (GET /admin/pengguna)
// ============================================================================
export async function listAdminUsers(
  tenantId: string,
  q: AdminUserListQuery
): Promise<Paged<AdminUserRow>> {
  return withTenantContext(tenantId, async (tx) => {
    const where = and(
      eq(tenantMemberships.tenantId, tenantId),
      ...(q.q
        ? [
            or(
              ilike(users.fullName, `%${q.q}%`),
              ilike(users.email, `%${q.q}%`),
              ilike(tenantMemberships.memberCode, `%${q.q}%`)
            ),
          ]
        : []),
      ...(q.status && q.status !== 'all' ? [eq(users.status, q.status)] : [])
    );

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(where);

    const rows = await tx
      .select(userColumns)
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(where)
      .orderBy(asc(users.email))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit);

    const byUser = await rolesByUser(
      tx,
      tenantId,
      rows.map((r) => r.userId)
    );

    return {
      total: counted[0]?.count ?? 0,
      rows: rows.map((r) => {
        const entry = byUser.get(r.userId);
        return toRow(r, entry?.codes ?? [], entry?.active ?? 0);
      }),
    };
  });
}

/**
 * Satu akun dapat punya banyak keanggotaan (per unit). Untuk `/admin/pengguna/:id`
 * hanya baris tenant ini yang boleh terlihat — baris institusi lain menjawab 404.
 */
export async function getAdminUser(
  tenantId: string,
  userId: string
): Promise<AdminUserRow | null> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select(userColumns)
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const byUser = await rolesByUser(tx, tenantId, [userId]);
    const entry = byUser.get(userId);
    return toRow(row, entry?.codes ?? [], entry?.active ?? 0);
  });
}

// ============================================================================
// Tulis identitas — tanpa satu pun sentuhan ke hak akses
// ============================================================================
export interface CreatedUser {
  readonly userId: string;
  readonly membershipId: string;
  /** Sandi awal hanya sekali-tampil; tidak pernah masuk log maupun respons kedua. */
  readonly initialPasswordShownOnce: true;
}

export async function createAdminUser(
  actor: ActorRef,
  req: CreateAdminUserRequest
): Promise<AdminIdentityResult<CreatedUser>> {
  const userId = randomUUID();
  const membershipId = randomUUID();
  const passwordHash = await hasher().hash(req.initialPassword);

  return withTenantContext(actor.tenantId, async (tx) => {
    const emailTaken = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, req.email))
      .limit(1);
    if (emailTaken.length > 0) return { ok: false, error: { kind: 'EMAIL_TAKEN' } } as const;

    const codeTaken = await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(eq(tenantMemberships.tenantId, actor.tenantId), eq(tenantMemberships.memberCode, req.memberCode))
      )
      .limit(1);
    if (codeTaken.length > 0) return { ok: false, error: { kind: 'MEMBER_CODE_TAKEN' } } as const;

    await tx.insert(users).values({
      id: userId,
      email: req.email,
      fullName: req.fullName,
      passwordHash,
      passwordUpdatedAt: new Date(),
      status: 'ACTIVE',
    });
    await tx.insert(tenantMemberships).values({
      id: membershipId,
      tenantId: actor.tenantId,
      userId,
      memberCode: req.memberCode,
      role: req.memberRole,
      status: 'ACTIVE',
    });

    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'users',
      targetId: userId,
      action: 'identity.user.create',
      after: { email: req.email, memberCode: req.memberCode, memberRole: req.memberRole },
      reason: req.reason,
    });

    return {
      ok: true,
      value: { userId, membershipId, initialPasswordShownOnce: true } satisfies CreatedUser,
    } as const;
  });
}

export async function updateAdminUser(
  actor: ActorRef,
  userId: string,
  req: UpdateAdminUserRequest
): Promise<AdminIdentityResult<AdminUserRow>> {
  return withTenantContext(actor.tenantId, async (tx) => {
    const before = await tx
      .select(userColumns)
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(and(eq(tenantMemberships.tenantId, actor.tenantId), eq(tenantMemberships.userId, userId)))
      .limit(1);
    const row = before[0];
    if (!row) return { ok: false, error: { kind: 'USER_NOT_FOUND' } } as const;

    if (req.email && req.email !== row.email) {
      const dup = await tx.select({ id: users.id }).from(users).where(eq(users.email, req.email)).limit(1);
      if (dup.length > 0) return { ok: false, error: { kind: 'EMAIL_TAKEN' } } as const;
    }

    await tx
      .update(users)
      .set({
        ...(req.email ? { email: req.email } : {}),
        ...(req.fullName ? { fullName: req.fullName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await tx
      .update(tenantMemberships)
      .set({
        ...(req.memberCode ? { memberCode: req.memberCode } : {}),
        ...(req.memberRole ? { role: req.memberRole } : {}),
      })
      .where(and(eq(tenantMemberships.tenantId, actor.tenantId), eq(tenantMemberships.userId, userId)));

    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'users',
      targetId: userId,
      action: 'identity.user.update',
      before: { email: row.email, fullName: row.fullName, memberCode: row.memberCode, memberRole: row.memberRole },
      after: {
        email: req.email ?? row.email,
        fullName: req.fullName ?? row.fullName,
        memberCode: req.memberCode ?? row.memberCode,
        memberRole: req.memberRole ?? row.memberRole,
      },
      reason: req.reason,
    });

    const byUser = await rolesByUser(tx, actor.tenantId, [userId]);
    const entry = byUser.get(userId);
    const updated: UserProjection = {
      ...row,
      email: req.email ?? row.email,
      fullName: req.fullName ?? row.fullName,
      memberCode: req.memberCode ?? row.memberCode,
      memberRole: req.memberRole ?? row.memberRole,
    };
    return { ok: true, value: toRow(updated, entry?.codes ?? [], entry?.active ?? 0) } as const;
  });
}

/**
 * Nonaktif = `users.status DISABLED` + keanggotaan `LEFT` + SELURUH penugasan ditutup
 * (`valid_to = now()`) + sesi aktif dicabut. Tidak ada `DELETE` baris pengguna:
 * riwayat akademik & audit harus tetap dapat direkonstruksi (BR-R12).
 */
export async function deactivateAdminUser(
  actor: ActorRef,
  userId: string,
  reason: string
): Promise<AdminIdentityResult<{ closedAssignments: number; revokedSessions: number }>> {
  if (userId === actor.userId) return { ok: false, error: { kind: 'CANNOT_DEACTIVATE_SELF' } };

  const now = new Date();
  return withTenantContext(actor.tenantId, async (tx) => {
    const membership = await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, actor.tenantId), eq(tenantMemberships.userId, userId)))
      .limit(1);
    if (membership.length === 0) return { ok: false, error: { kind: 'USER_NOT_FOUND' } } as const;

    const closed = await tx
      .update(userRoleAssignments)
      .set({ validTo: now })
      .where(
        and(
          eq(userRoleAssignments.tenantId, actor.tenantId),
          eq(userRoleAssignments.userId, userId),
          or(isNull(userRoleAssignments.validTo), gt(userRoleAssignments.validTo, now))
        )
      )
      .returning({ id: userRoleAssignments.id });

    await tx.update(users).set({ status: 'DISABLED', updatedAt: now }).where(eq(users.id, userId));
    await tx
      .update(tenantMemberships)
      .set({ status: 'LEFT', leftAt: now })
      .where(and(eq(tenantMemberships.tenantId, actor.tenantId), eq(tenantMemberships.userId, userId)));

    const revoked = await tx
      .update(sessions)
      .set({ revokedAt: now, revokedReason: 'identity.user.deactivate' })
      .where(
        and(
          eq(sessions.tenantId, actor.tenantId),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now)
        )
      )
      .returning({ id: sessions.id });

    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'users',
      targetId: userId,
      action: 'identity.user.deactivate',
      before: { status: 'ACTIVE' },
      after: {
        status: 'DISABLED',
        closedAssignments: closed.length,
        revokedSessions: revoked.length,
      },
      reason,
    });

    return { ok: true, value: { closedAssignments: closed.length, revokedSessions: revoked.length } } as const;
  });
}

// ============================================================================
// Peran (tulis) — pembuatan & penamaan adalah operasi langsung; KOMPOSISI IZIN tidak
// ============================================================================
/**
 * Membuat peran KOSTUM (`is_system = false`). Ini bukan perubahan hak: peran baru yang
 * belum punya grant tidak memberi apa pun kepada siapa pun. Komposisi izinnya nanti
 * hanya berubah lewat permintaan `ROLE_PERMISSION_CHANGE` yang disetujui orang kedua.
 */
export async function createTenantRole(
  actor: ActorRef,
  req: CreateRoleRequest
): Promise<AdminIdentityResult<AdminRoleRow>> {
  const id = randomUUID();
  return withTenantContext(actor.tenantId, async (tx) => {
    const clash = await tx
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(and(eq(rolesTable.tenantId, actor.tenantId), eq(rolesTable.code, req.code)))
      .limit(1);
    if (clash.length > 0) return { ok: false, error: { kind: 'ROLE_CODE_TAKEN' } } as const;

    await tx.insert(rolesTable).values({
      id,
      tenantId: actor.tenantId,
      code: req.code,
      displayName: req.displayName,
      scopeKind: req.scopeKind,
      isSystem: false,
    });
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'roles',
      targetId: id,
      action: 'identity.role.create',
      after: { code: req.code, displayName: req.displayName, scopeKind: req.scopeKind, isSystem: false },
      reason: req.reason,
    });
    return {
      ok: true,
      value: { roleId: id, code: req.code, displayName: req.displayName, scopeKind: req.scopeKind, isSystem: false, holderCount: 0, permissionCount: 0 },
    } as const;
  });
}

/** `PATCH` hanya menyentuh `display_name` — kode & `scope_kind` adalah identitas peran. */
export async function renameTenantRole(
  actor: ActorRef,
  roleId: string,
  req: UpdateRoleRequest
): Promise<AdminIdentityResult<AdminRoleRow>> {
  return withTenantContext(actor.tenantId, async (tx) => {
    const found = await tx
      .select({ id: rolesTable.id, code: rolesTable.code, displayName: rolesTable.displayName, scopeKind: rolesTable.scopeKind, isSystem: rolesTable.isSystem })
      .from(rolesTable)
      .where(and(eq(rolesTable.tenantId, actor.tenantId), eq(rolesTable.id, roleId)))
      .limit(1);
    const role = found[0];
    if (!role) return { ok: false, error: { kind: 'ROLE_NOT_FOUND' } } as const;
    // Peran sistem terkunci TOTAL — termasuk namanya (§4.6.9 butir c: `is_system` → 409).
    if (role.isSystem) return { ok: false, error: { kind: 'SYSTEM_ROLE_LOCKED' } } as const;

    await tx
      .update(rolesTable)
      .set({ displayName: req.displayName, updatedAt: new Date() })
      .where(eq(rolesTable.id, roleId));
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'roles',
      targetId: roleId,
      action: 'identity.role.update',
      before: { displayName: role.displayName },
      after: { displayName: req.displayName },
      reason: req.reason,
    });

    const after = await tx
      .select(roleProjection)
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .limit(1);
    return { ok: true, value: after[0]! } as const;
  });
}

/**
 * Peran sistem → `SYSTEM_ROLE_LOCKED`; peran yang masih dipakai → `ROLE_IN_USE`.
 * Tidak ada penghapusan paksa: pencabutan penugasan adalah jalur resmi (`REVOKE`
 * empat-mata), dan `role_permissions` ikut hilang hanya bila perannya benar-benar mati.
 */
export async function deleteTenantRole(
  actor: ActorRef,
  roleId: string,
  reason: string
): Promise<AdminIdentityResult<{ roleId: string }>> {
  return withTenantContext(actor.tenantId, async (tx) => {
    const found = await tx
      .select({ id: rolesTable.id, code: rolesTable.code, isSystem: rolesTable.isSystem })
      .from(rolesTable)
      .where(and(eq(rolesTable.tenantId, actor.tenantId), eq(rolesTable.id, roleId)))
      .limit(1);
    const role = found[0];
    if (!role) return { ok: false, error: { kind: 'ROLE_NOT_FOUND' } } as const;
    if (role.isSystem) return { ok: false, error: { kind: 'SYSTEM_ROLE_LOCKED' } } as const;

    const holders = await tx
      .select({ id: userRoleAssignments.id })
      .from(userRoleAssignments)
      .where(and(eq(userRoleAssignments.tenantId, actor.tenantId), eq(userRoleAssignments.roleId, roleId)))
      .limit(1);
    if (holders.length > 0) return { ok: false, error: { kind: 'ROLE_IN_USE' } } as const;

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await tx.delete(rolesTable).where(eq(rolesTable.id, roleId));
    await appendAuditEntry(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      targetEntity: 'roles',
      targetId: roleId,
      action: 'identity.role.delete',
      before: { code: role.code },
      reason,
    });
    return { ok: true, value: { roleId } } as const;
  });
}

// ============================================================================
// Peran & katalog izin (baca)
// ============================================================================
/**
 * Hitungan pemegang & izin. Kolom luar WAJIB ditulis berkualifikasi (`"roles"."id"`):
 * Drizzle merender `${roles.id}` di dalam subquery sebagai `"id"` POLOS, dan PostgreSQL
 * lalu mengikatnya ke tabel subquery itu sendiri (`ur.id`) — hasilnya `0` yang terlihat
 * sah, bukan error. `role_permissions` kebetulan tidak punya kolom `id`, jadi hanya
 * subquery pertama yang kena jebakan ini.
 */
const roleProjection = {
  roleId: rolesTable.id,
  code: rolesTable.code,
  displayName: rolesTable.displayName,
  scopeKind: rolesTable.scopeKind,
  isSystem: rolesTable.isSystem,
  holderCount: sql<number>`(
    select count(*) from public.user_role_assignments ur
    where ur.role_id = "roles"."id" and (ur.valid_to is null or ur.valid_to > now())
  )::int`,
  permissionCount: sql<number>`(
    select count(*) from public.role_permissions rp where rp.role_id = "roles"."id"
  )::int`,
} as const;

export async function listTenantRoles(tenantId: string): Promise<readonly AdminRoleRow[]> {
  return withTenantContext(tenantId, async (tx) =>
    tx
      .select(roleProjection)
      .from(rolesTable)
      .where(eq(rolesTable.tenantId, tenantId))
      .orderBy(asc(rolesTable.code))
  );
}

/** Detail satu peran — `null` bila id milik institusi lain (rute menjawab 404, bukan 403). */
export async function getTenantRole(tenantId: string, roleId: string): Promise<AdminRoleRow | null> {
  const rows = await withTenantContext(tenantId, async (tx) =>
    tx.select(roleProjection).from(rolesTable).where(and(eq(rolesTable.tenantId, tenantId), eq(rolesTable.id, roleId))).limit(1)
  );
  return rows[0] ?? null;
}

/** Katalog izin GLOBAL — terbaca, tidak pernah tertulis dari rute tenant (`0087`). */
export async function listPermissionCatalog(): Promise<readonly AdminPermissionRow[]> {
  return db
    .select({
      permissionId: permissionsTable.id,
      code: permissionsTable.code,
      module: permissionsTable.module,
      resource: permissionsTable.resource,
      verb: permissionsTable.verb,
      description: permissionsTable.description,
    })
    .from(permissionsTable)
    .orderBy(asc(permissionsTable.code));
}

export async function listRolePermissions(
  tenantId: string,
  roleId: string
): Promise<readonly AdminPermissionRow[]> {
  return withTenantContext(tenantId, async (tx) =>
    tx
      .select({
        permissionId: permissionsTable.id,
        code: permissionsTable.code,
        module: permissionsTable.module,
        resource: permissionsTable.resource,
        verb: permissionsTable.verb,
        description: permissionsTable.description,
      })
      .from(rolePermissions)
      .innerJoin(permissionsTable, eq(rolePermissions.permissionId, permissionsTable.id))
      .where(and(eq(rolePermissions.tenantId, tenantId), eq(rolePermissions.roleId, roleId)))
      .orderBy(asc(permissionsTable.code))
  );
}

// ============================================================================
// Penugasan (baca)
// ============================================================================
export interface AssignmentFilter {
  readonly userId?: string;
  readonly roleId?: string;
  readonly includeExpired?: boolean;
  readonly page: number;
  readonly limit: number;
}

export async function listAssignments(
  tenantId: string,
  filter: AssignmentFilter
): Promise<Paged<AdminAssignmentRow>> {
  return withTenantContext(tenantId, async (tx) => {
    const where = and(
      eq(userRoleAssignments.tenantId, tenantId),
      ...(filter.userId ? [eq(userRoleAssignments.userId, filter.userId)] : []),
      ...(filter.roleId ? [eq(userRoleAssignments.roleId, filter.roleId)] : []),
      ...(filter.includeExpired
        ? []
        : [or(isNull(userRoleAssignments.validTo), gt(userRoleAssignments.validTo, new Date()))])
    );

    const counted = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userRoleAssignments)
      .where(where);

    const rows = await tx
      .select({
        assignmentId: userRoleAssignments.id,
        userId: userRoleAssignments.userId,
        fullName: users.fullName,
        roleId: rolesTable.id,
        roleCode: rolesTable.code,
        scopeKind: rolesTable.scopeKind,
        origin: userRoleAssignments.origin,
        validFrom: userRoleAssignments.validFrom,
        validTo: userRoleAssignments.validTo,
        scopeOrgId: userRoleAssignments.scopeOrgId,
        scopeProgramId: userRoleAssignments.scopeProgramId,
        scopeClassId: userRoleAssignments.scopeClassId,
        scopePeriodId: userRoleAssignments.scopePeriodId,
        scopeStudentId: userRoleAssignments.scopeStudentId,
      })
      .from(userRoleAssignments)
      .innerJoin(rolesTable, eq(userRoleAssignments.roleId, rolesTable.id))
      .innerJoin(users, eq(userRoleAssignments.userId, users.id))
      .where(where)
      .orderBy(desc(userRoleAssignments.createdAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    const now = new Date();
    return {
      total: counted[0]?.count ?? 0,
      rows: rows.map((r) => ({
        assignmentId: r.assignmentId,
        userId: r.userId,
        fullName: r.fullName,
        roleId: r.roleId,
        roleCode: r.roleCode,
        scopeKind: r.scopeKind,
        scope: {
          orgId: r.scopeOrgId,
          programId: r.scopeProgramId,
          classId: r.scopeClassId,
          periodId: r.scopePeriodId,
          studentId: r.scopeStudentId,
        },
        origin: r.origin,
        validFrom: r.validFrom.toISOString(),
        validTo: r.validTo ? r.validTo.toISOString() : null,
        active: r.validTo === null || r.validTo > now,
      })),
    };
  });
}
