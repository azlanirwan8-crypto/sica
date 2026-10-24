/**
 * RBAC Repository — pembacaan hak akses efektif dari tabel hasil migrasi `0011`
 * (Slice ADM-8, RBAC_MATRIX §3.2 langkah 5–6).
 *
 * Satu titik resolver berbasis data: peran dan izin dibaca dari
 * `user_role_assignments` × `roles` × `role_permissions` × `permissions`, lengkap
 * dengan lingkup dan masa berlaku. Carrier `member_role` tetap menjadi lapis
 * identitas login, tetapi bukan lagi sumber hak akses.
 *
 * Kebijakan perakitannya murni dan teruji terpisah di `rbac-resolver.ts`; berkas
 * ini hanya berbicara dengan PostgreSQL.
 */
import type { NextResponse } from 'next/server';
import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  or,
  withTenantContext,
  permissions as permissionsTable,
  rolePermissions,
  roles as rolesTable,
  userRoleAssignments,
} from '@sica/database';
import {
  isKnownPermission,
  ROLE_CODES,
  type PermissionCode,
  type PermissionVerb,
  type RoleCode,
  type ScopeKind,
} from '@sica/contracts';
import { forbidden, unauthorized, type RequestContext } from '@/lib/api-response';
import {
  computeEffectiveAccess,
  type EffectiveAccess,
  type PermissionGrant,
  type RawAssignment,
} from './rbac-resolver';

const ROLE_CODE_SET: ReadonlySet<string> = new Set<string>(ROLE_CODES);

export {
  computeEffectiveAccess,
  holdsScoped,
  isActiveWindow,
  matchesScope,
  type AssignmentScope,
  type EffectiveAccess,
  type EffectiveGrant,
  type GrantMap,
  type PermissionGrant,
  type RawAssignment,
} from './rbac-resolver';

/** Pembaca akses efektif — disuntik pada uji; default-nya query DB nyata. */
export type AccessReader = (tenantId: string, userId: string) => Promise<EffectiveAccess>;

/**
 * Baca akses efektif satu subjek dalam satu tenant. WAJIB di dalam konteks tenant
 * (tabel ini ber-`FORCE` RLS): tanpa `app.current_tenant`, policy `tenant_isolation`
 * menolak semua baris — gagal tertutup, bukan "dapat semuanya".
 *
 * Dua query, bukan satu join besar, agar jumlah baris = penugasan + grant peran,
 * bukan hasil kali kartesius keduanya.
 */
export const loadEffectiveAccess: AccessReader = async (tenantId, userId) => {
  const now = new Date();

  return withTenantContext(tenantId, async (tx) => {
    const assignmentRows = await tx
      .select({
        id: userRoleAssignments.id,
        roleId: rolesTable.id,
        roleCode: rolesTable.code,
        scopeKind: rolesTable.scopeKind,
        orgId: userRoleAssignments.scopeOrgId,
        programId: userRoleAssignments.scopeProgramId,
        classId: userRoleAssignments.scopeClassId,
        periodId: userRoleAssignments.scopePeriodId,
        studentId: userRoleAssignments.scopeStudentId,
        validFrom: userRoleAssignments.validFrom,
        validTo: userRoleAssignments.validTo,
        origin: userRoleAssignments.origin,
      })
      .from(userRoleAssignments)
      .innerJoin(rolesTable, eq(userRoleAssignments.roleId, rolesTable.id))
      .where(
        and(
          eq(userRoleAssignments.tenantId, tenantId),
          eq(userRoleAssignments.userId, userId),
          or(isNull(userRoleAssignments.validTo), gt(userRoleAssignments.validTo, now))
        )
      );

    const roleIds = [...new Set(assignmentRows.map((row) => row.roleId))];
    const grantRows =
      roleIds.length === 0
        ? []
        : await tx
            .select({
              roleId: rolePermissions.roleId,
              code: permissionsTable.code,
              module: permissionsTable.module,
              resource: permissionsTable.resource,
              verb: permissionsTable.verb,
            })
            .from(rolePermissions)
            .innerJoin(permissionsTable, eq(rolePermissions.permissionId, permissionsTable.id))
            .where(inArray(rolePermissions.roleId, roleIds));

    const byRoleId = new Map<string, PermissionGrant[]>();
    for (const row of grantRows) {
      const list = byRoleId.get(row.roleId) ?? [];
      list.push({
        code: row.code as PermissionCode,
        module: row.module,
        resource: row.resource,
        verb: row.verb as PermissionVerb,
      });
      byRoleId.set(row.roleId, list);
    }

    const grantsByRole = new Map<RoleCode, readonly PermissionGrant[]>();
    for (const row of assignmentRows) {
      if (!ROLE_CODE_SET.has(row.roleCode)) continue;
      grantsByRole.set(row.roleCode as RoleCode, byRoleId.get(row.roleId) ?? []);
    }

    const raw: RawAssignment[] = assignmentRows.map((row) => ({
      id: row.id,
      roleCode: row.roleCode,
      scopeKind: row.scopeKind as ScopeKind,
      scope: {
        orgId: row.orgId,
        programId: row.programId,
        classId: row.classId,
        periodId: row.periodId,
        studentId: row.studentId,
      },
      validFrom: row.validFrom,
      validTo: row.validTo,
      origin: row.origin,
    }));

    return computeEffectiveAccess(raw, grantsByRole, now);
  });
};

/** Subjek yang haknya dibaca dari tabel RBAC (bukan perluasan carrier). */
export interface DataPrincipal {
  readonly userId: string;
  readonly tenantId: string;
  readonly access: EffectiveAccess;
}

export type RequireDataPrincipalResult =
  | { readonly granted: true; readonly principal: DataPrincipal }
  | { readonly granted: false; readonly response: NextResponse };

/**
 * Varian gerbang berbasis tabel — jalan sah untuk rute `/admin/*` dan rute domain
 * SETELAH migrasi `0011` diterapkan dan seed penugasan terisi. Tidak ada jatuh-kembali
 * ke perluasan carrier: tanpa penugasan aktif akses ditolak, sebab pemindaian carrier
 * itulah yang hendak digantikan.
 */
export async function requireDataPrincipal(
  ctx: RequestContext,
  permission: PermissionCode,
  read: AccessReader = loadEffectiveAccess
): Promise<RequireDataPrincipalResult> {
  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return {
      granted: false,
      response: unauthorized(ctx, 'Autentikasi diperlukan untuk aksi ini.'),
    };
  }
  if (!isKnownPermission(permission)) {
    return {
      granted: false,
      response: forbidden(ctx, 'Izin tidak terdaftar pada katalog RBAC.'),
    };
  }

  const access = await read(ctx.tenantId, ctx.userId);
  if (!access.permissions.has(permission)) {
    return {
      granted: false,
      response: forbidden(ctx, 'Aksi ini berada di luar hak akses peran Anda.'),
    };
  }

  return { granted: true, principal: { userId: ctx.userId, tenantId: ctx.tenantId, access } };
}
