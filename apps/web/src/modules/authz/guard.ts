/**
 * Authorization Guard — penegakan hak akses terpusat (RBAC_MATRIX §3.2, AGENTS §3.8).
 *
 * Menutup celah G-01: peran TIDAK lagi dicocokkan sebagai substring. Peran dibaca
 * dari klaim JWT carrier (`member_role`) lalu diperluas lewat `CARRIER_TO_ROLES`;
 * nilai tak dikenal menghasilkan NOL izin (fail-closed), bukan "admin-ish".
 *
 * Guard ini hanya menjawab "boleh aksi ini?". Otoritas data (kelas ampuan, periode
 * terbuka, status LOCKED, gerbang tagihan) tetap ditegakkan di service layer.
 */
import type { NextResponse } from 'next/server';
import {
  isKnownPermission,
  permissionModule,
  rolesForCarrier,
  permissionsForRole,
  SYSTEM_ROLE_GRANTS,
  type PermissionCode,
  type PermissionModule,
  type RoleCode,
} from '@sica/contracts';
import { forbidden, unauthorized, type RequestContext } from '@/lib/api-response';

/**
 * Bagian konteks yang dibutuhkan guard. `RequestContext` memenuhi bentuk ini,
 * dan pemanggil di luar HTTP (mis. renderer menu) tidak perlu membuat konteks penuh.
 */
export interface Principal {
  readonly tenantId?: string | null;
  readonly userId?: string | null;
  readonly role?: string | null;
  readonly authenticated?: boolean;
}

/** Hasil evaluasi satu izin terhadap satu subjek. */
export type AccessDecision =
  | { readonly granted: true; readonly roles: readonly RoleCode[] }
  | {
      readonly granted: false;
      readonly roles: readonly RoleCode[];
      readonly reason: 'UNAUTHENTICATED' | 'UNKNOWN_ROLE' | 'PERMISSION_DENIED';
      readonly message: string;
    };

/** Peran hasil perluasan carrier — dipakai juga oleh renderer menu. */
export function rolesOf(principal: Principal): readonly RoleCode[] {
  return rolesForCarrier(principal.role);
}

/** Cek murni: apakah sekumpulan peran memegang satu izin. */
export function holdsPermission(roles: readonly RoleCode[], permission: PermissionCode): boolean {
  return roles.some((role) => SYSTEM_ROLE_GRANTS[role].includes(permission));
}

/** Daftar izin yang dipegang gabungan peran (untuk filter menu & diagnostik). */
export function permissionsOf(roles: readonly RoleCode[]): readonly PermissionCode[] {
  const seen = new Set<PermissionCode>();
  for (const role of roles) {
    for (const code of permissionsForRole(role)) seen.add(code);
  }
  return [...seen];
}

/**
 * Evaluasi akses terhadap satu izin. Selalu fail-closed: tanpa sesi, peran tak
 * dikenal, dan izin tak terdaftar di katalog → ditolak.
 */
export function evaluateAccess(
  principal: Principal,
  permission: PermissionCode
): AccessDecision {
  const roles = rolesOf(principal);

  if (!principal.authenticated || !principal.tenantId || !principal.userId) {
    return {
      granted: false,
      roles,
      reason: 'UNAUTHENTICATED',
      message: 'Autentikasi diperlukan untuk aksi ini.',
    };
  }

  if (!isKnownPermission(permission)) {
    return {
      granted: false,
      roles,
      reason: 'PERMISSION_DENIED',
      message: 'Izin tidak terdaftar pada katalog RBAC.',
    };
  }

  if (roles.length === 0) {
    return {
      granted: false,
      roles,
      reason: 'UNKNOWN_ROLE',
      message: 'Peran akun tidak dikenali. Hubungi administrator institusi.',
    };
  }

  if (!holdsPermission(roles, permission)) {
    return {
      granted: false,
      roles,
      reason: 'PERMISSION_DENIED',
      message: 'Aksi ini berada di luar hak akses peran Anda.',
    };
  }

  return { granted: true, roles };
}

/**
 * Gerbang rute API: kembalikan response penolakan, atau `null` bila boleh lanjut.
 * 401 untuk sesi hilang, 403 untuk hak tidak cukup.
 */
export function requirePermission(
  ctx: RequestContext,
  permission: PermissionCode
): NextResponse | null {
  const decision = evaluateAccess(ctx, permission);
  if (decision.granted) return null;

  return decision.reason === 'UNAUTHENTICATED'
    ? unauthorized(ctx, decision.message)
    : forbidden(ctx, decision.message);
}

/** Gerbang peran untuk layar/menu — tidak memuat cek sesi. */
export function canSee(principal: Principal, permission: PermissionCode): boolean {
  return holdsPermission(rolesOf(principal), permission);
}

/** Subjek terotentikasi dengan id bertipe non-null — hasil yang aman diteruskan ke service. */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly tenantId: string;
  readonly roles: readonly RoleCode[];
}

export type RequirePrincipalResult =
  | { readonly granted: true; readonly principal: AuthenticatedPrincipal }
  | { readonly granted: false; readonly response: NextResponse };

/**
 * Varian gerbang untuk rute yang perlu meneruskan `userId`/`tenantId` ke service
 * layer tanpa nullable cast.
 */
export function requirePrincipal(
  ctx: RequestContext,
  permission: PermissionCode
): RequirePrincipalResult {
  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return { granted: false, response: unauthorized(ctx, 'Autentikasi diperlukan untuk aksi ini.') };
  }

  const decision = evaluateAccess(ctx, permission);
  if (decision.granted) {
    return {
      granted: true,
      principal: { userId: ctx.userId, tenantId: ctx.tenantId, roles: decision.roles },
    };
  }
  return { granted: false, response: forbidden(ctx, decision.message) };
}

/** Modul tempat izin berada — dipakai sebagai kunci filter entitlement. */
export function moduleOf(permission: PermissionCode): PermissionModule {
  return permissionModule(permission);
}
