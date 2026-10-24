/**
 * Gerbang rute `/api/v1/platform/**` (API_SPEC §4.20 paragraf penjaga, M-01).
 *
 * Tiga lapis sekaligus ditegakkan di satu titik:
 *  - L2 identitas — subjek hanya dari token terverifikasi (`ctx`); `x-tenant-id` klien
 *    sudah dihapus middleware (`SEC-07`) dan target tenant selalu diselesaikan dari baris.
 *  - L3 berbasis tabel — `requireDataPrincipal` membaca `user_role_assignments`, bukan
 *    perluasan carrier (`SEC-10`); tanpa penugasan `PLATFORM_OPERATOR` → 403.
 *  - MFA sesi — aksi tulis platform WAJIB `amr` memuat `mfa` (DoD `R-1` §1.7, menutup
 *    `G-07` untuk peran ini lebih dulu). Sesi tanpa MFA dijawab 401 `MFA_REQUIRED`
 *    (register §2.3 baris 2), bukan 403: yang kurang adalah langkah autentikasi, bukan hak.
 */
import type { NextResponse } from 'next/server';
import { PERM, type PermissionCode } from '@sica/contracts';
import { errorResponse, forbidden, unauthorized, type RequestContext } from '@/lib/api-response';
import { devMfaBypassHint } from '@/lib/dev-flags';
import { requireDataPrincipal, type DataPrincipal } from '@/modules/authz/rbac-repository';

export type PlatformGuardResult =
  | { readonly granted: true; readonly principal: DataPrincipal }
  | { readonly granted: false; readonly response: NextResponse };

/**
 * Penanda operator. `platform.tenant.view` hanya di-grantkan ke `PLATFORM_OPERATOR`
 * (lihat `PLATFORM_OPERATOR_GRANTS`), sedangkan izin yang dipakai rute `/platform/**`
 * tertentu — `audit.log.view`, `identity.impersonation.grant` — JUGA dipegang
 * `TENANT_ADMIN` untuk tenant-nya sendiri. Tanpa pemeriksaan ini, admin kampus bisa
 * membaca jejak audit tetangga atau menerbitkan grant dukungan lintas tenant:
 * persis titik "izin cukup tapi data orang lain" yang wajib diuji (AGENTS §3.8).
 */
const OPERATOR_MARKER: PermissionCode = PERM.platformTenantView;

async function requireOperator(
  ctx: RequestContext,
  permission: PermissionCode
): Promise<PlatformGuardResult> {
  const guard = await requireDataPrincipal(ctx, OPERATOR_MARKER);
  if (!guard.granted) return guard;
  if (!guard.principal.access.permissions.has(permission)) {
    return { granted: false, response: forbidden(ctx, 'Aksi ini berada di luar hak akses peran Anda.') };
  }
  return guard;
}

/** Baca lintas-tenant: harus operator platform + izin spesifik rute. */
export async function requirePlatformRead(
  ctx: RequestContext,
  permission: PermissionCode
): Promise<PlatformGuardResult> {
  return requireOperator(ctx, permission);
}

/** Tulis lintas-tenant: operator + sesi ber-MFA + izin spesifik rute. */
export async function requirePlatformWrite(
  ctx: RequestContext,
  permission: PermissionCode
): Promise<PlatformGuardResult> {
  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return { granted: false, response: unauthorized(ctx, 'Autentikasi diperlukan untuk aksi ini.') };
  }
  if (!(ctx.amr ?? []).includes('mfa')) {
    // 401 `MFA_REQUIRED` (register §2.3 baris 2): yang kurang adalah langkah autentikasi, bukan hak.
    return {
      granted: false,
      response: errorResponse(
        'MFA_REQUIRED',
        'Akun ini mewajibkan MFA; selesaikan tantangan pada /auth/mfa/verify sebelum aksi tulis platform.' + devMfaBypassHint(),
        ctx,
        401
      ),
    };
  }
  return requireOperator(ctx, permission);
}
