/**
 * Resolver murni (Slice ADM-8): merakit penugasan + grant peran menjadi hak efektif.
 *
 * Tidak menyentuh DB maupun HTTP supaya kebijakan dapat diuji berdiri sendiri;
 * pembacaan barisnya ada di `rbac-repository.ts`.
 *
 * Norma: docs/RBAC_MATRIX.md §3.2 langkah 5–6 (izin lalu lingkup & masa berlaku)
 * dan FR-IDT-04 (matriks `resource × verb`, 6 aksi).
 */
import {
  ROLE_CODES,
  type PermissionCode,
  type PermissionVerb,
  type RoleCode,
  type ScopeKind,
} from '@sica/contracts';

/** Lingkup konkret sebuah penugasan; kolom yang terisi mengikuti `scopeKind` peran. */
export interface AssignmentScope {
  readonly orgId: string | null;
  readonly programId: string | null;
  readonly classId: string | null;
  readonly periodId: string | null;
  readonly studentId: string | null;
}

/** Butiran izin untuk matriks `resource × verb` (FR-IDT-04). */
export interface PermissionGrant {
  readonly code: PermissionCode;
  readonly module: string;
  readonly resource: string;
  readonly verb: PermissionVerb;
}

/** Satu penugasan aktif milik satu subjek, beserta izin peran itu. */
export interface EffectiveGrant {
  readonly assignmentId: string;
  readonly roleCode: RoleCode;
  readonly scopeKind: ScopeKind;
  readonly scope: AssignmentScope;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly origin: string;
  readonly grants: readonly PermissionGrant[];
}

export interface EffectiveAccess {
  readonly grants: readonly EffectiveGrant[];
  readonly roles: readonly RoleCode[];
  readonly permissions: ReadonlySet<PermissionCode>;
}

/** Baris penugasan mentah yang dibutuhkan resolver (kolom `roleCode` masih `string`). */
export interface RawAssignment {
  readonly id: string;
  readonly roleCode: string;
  readonly scopeKind: ScopeKind;
  readonly scope: AssignmentScope;
  readonly validFrom: Date;
  readonly validTo: Date | null;
  readonly origin: string;
}

export type GrantMap = ReadonlyMap<RoleCode, readonly PermissionGrant[]>;

const ROLE_CODE_SET: ReadonlySet<string> = new Set<string>(ROLE_CODES);

export function isActiveWindow(validFrom: Date, validTo: Date | null, now: Date): boolean {
  if (validFrom > now) return false;
  return validTo === null || validTo > now;
}

/** Semua kolom lingkup yang disebut harus sama persis (null pun dihitung nilai). */
export function matchesScope(actual: AssignmentScope, wanted: Partial<AssignmentScope>): boolean {
  for (const [key, value] of Object.entries(wanted)) {
    if (value === undefined) continue;
    if (actual[key as keyof AssignmentScope] !== value) return false;
  }
  return true;
}

/**
 * Buang penugasan di luar masa berlaku dan peran yang kodenya tidak ada di katalog
 * (`ROLE_CODES`) — fail-closed, lalu gabungkan izin unik dari seluruh penugasan.
 */
export function computeEffectiveAccess(
  assignments: readonly RawAssignment[],
  grantsByRole: GrantMap,
  now: Date = new Date()
): EffectiveAccess {
  const grants: EffectiveGrant[] = [];
  const roles = new Set<RoleCode>();
  const codes = new Set<PermissionCode>();

  for (const row of assignments) {
    if (!ROLE_CODE_SET.has(row.roleCode)) continue;
    if (!isActiveWindow(row.validFrom, row.validTo, now)) continue;

    const roleCode = row.roleCode as RoleCode;
    const permissionGrants = grantsByRole.get(roleCode) ?? [];
    grants.push({
      assignmentId: row.id,
      roleCode,
      scopeKind: row.scopeKind,
      scope: row.scope,
      validFrom: row.validFrom,
      validTo: row.validTo,
      origin: row.origin,
      grants: permissionGrants,
    });
    roles.add(roleCode);
    for (const grant of permissionGrants) codes.add(grant.code);
  }

  return { grants, roles: [...roles], permissions: codes };
}

/**
 * Apakah subjek memegang izin pada lingkup yang diminta. Tanpa `scope`, cukup
 * pegang izinnya; dengan `scope`, penugasan harus cocok kolom per kolom.
 */
export function holdsScoped(
  access: EffectiveAccess,
  permission: PermissionCode,
  scope?: Partial<AssignmentScope>
): boolean {
  for (const grant of access.grants) {
    if (!grant.grants.some((item) => item.code === permission)) continue;
    if (scope === undefined || matchesScope(grant.scope, scope)) return true;
  }
  return false;
}
