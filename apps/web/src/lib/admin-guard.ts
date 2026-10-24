/**
 * Gerbang rute `/api/v1/admin/**` (API_SPEC §4.6.9, pemegang M-03).
 *
 * Bedanya dengan `platform-guard.ts`: ruang lingkupnya **satu tenant**. Actor hanya
 * menyentuh baris institusinya sendiri — `tenant_id` selalu dari token, dan RLS `FORCE`
 * menutup jalan pintas. Lapis yang ditegakkan di titik ini:
 *  - L2 identitas hanya dari token terverifikasi (`SEC-07`);
 *  - L3 permission berbasis tabel lewat `requireDataPrincipal` (`SEC-10`) — hak dibaca
 *    dari `user_role_assignments` + `valid_to`, bukan perluasan carrier `member_role`;
 *  - MFA sesi untuk setiap aksi tulis (verba `INSERT`/`UPDATE`/`DELETE`/`VALIDATE`),
 *    dijawab 401 `MFA_REQUIRED` (register §2.3 baris 2), bukan 403 — tetapi SELALU setelah
 *    izin diperiksa, supaya peran tanpa hak tidak pernah disuruh "selesaikan MFA".
 * Tidak ada "penanda peran" seperti di gugus platform: di dalam satu tenant, izin rute
 * itu sendiri yang menjadi gerbang, dan `requireDataPrincipal` sudah fail-closed bila
 * actor tidak punya penugasan aktif apa pun.
 *
 * L4 (lingkup konkret) sengaja TIDAK di sini: ia butuh objek target yang baru terbaca
 * di service, sehingga ditegakkan oleh `holdsScoped` + `coversScope` di
 * `access-request.service.ts`.
 */
import type { NextResponse } from 'next/server';
import type { PermissionCode } from '@sica/contracts';
import { errorResponse, forbidden, unauthorized, type RequestContext } from '@/lib/api-response';
import { devMfaBypassHint } from '@/lib/dev-flags';
import { requireDataPrincipal, type DataPrincipal } from '@/modules/authz/rbac-repository';

export type AdminGuardResult =
  | { readonly granted: true; readonly principal: DataPrincipal }
  | { readonly granted: false; readonly response: NextResponse };

async function requireAdmin(ctx: RequestContext, permission: PermissionCode): Promise<AdminGuardResult> {
  return requireDataPrincipal(ctx, permission);
}

export async function requireAdminRead(
  ctx: RequestContext,
  permission: PermissionCode
): Promise<AdminGuardResult> {
  return requireAdmin(ctx, permission);
}

/**
 * Rute yang sah bagi beberapa peran berbeda. Contoh: daftar permintaan hak boleh dibaca
 * penyetuju (`identity.accessrequest.view`) DAN pemohon yang ingin status pengajuannya
 * (`identity.assignment.grant`). Penyempitan baris terjadi di service, bukan di sini.
 */
export async function requireAdminReadAny(
  ctx: RequestContext,
  permissions: readonly PermissionCode[]
): Promise<AdminGuardResult> {
  for (const permission of permissions) {
    const guard = await requireDataPrincipal(ctx, permission);
    if (guard.granted) return guard;
    // 401 tidak boleh berubah jadi 403 hanya karena izin berikutnya juga gagal:
    // klien memakai 401 untuk memicu masuk ulang, dan sesi yang hilang bukan
    // "hak akses tidak cukup". Terukur: `GET /admin/permintaan-hak` tanpa cookie
    // menjawab 403 sebelum penjaga ini ada.
    if (guard.response.status === 401) return guard;
  }
  return { granted: false, response: forbidden(ctx, 'Aksi ini berada di luar hak akses peran Anda.') };
}

export async function requireAdminWrite(
  ctx: RequestContext,
  permission: PermissionCode
): Promise<AdminGuardResult> {
  const authz = await requireAdmin(ctx, permission);
  if (!authz.granted) return authz;
  return await requireMfaSession(ctx) ?? authz;
}

/**
 * Aksi tulis yang izinnya ditentukan oleh KELAS objek target (mesin parameter:
 * `settings.param.edit.<kelas>` dipilih dari baris `risk_class` di DB, bukan dari body).
 * Penyaringan kelas terjadi di service agar pesan galatnya menyebut kelas yang benar.
 *
 * Urutannya disengaja dan diralat 2026-10-23 setelah terbukti di uji end-to-end:
 * **izin lebih dulu, MFA kedua.** Menjawab `401 MFA_REQUIRED` kepada peran yang memang tidak
 * punya hak menulis memberi tahu mereka bahwa "kalau kamu ber-MFA, kamu bisa mengubah ini" —
 * itu oracle kecil, dan bagi mahasiswa artinya petunjuk yang menyesatkan. Peran yang berhak
 * tetapi sesi-nya belum `amr ⊇ mfa` tetap menerima 401 (norma §4.6.9 tidak berubah).
 */
export async function requireAdminWriteAny(
  ctx: RequestContext,
  permissions: readonly PermissionCode[]
): Promise<AdminGuardResult> {
  const authz = await requireAdminReadAny(ctx, permissions);
  if (!authz.granted) return authz;
  return await requireMfaSession(ctx) ?? authz;
}

async function requireMfaSession(ctx: RequestContext): Promise<AdminGuardResult | null> {
  if (!ctx.authenticated || !ctx.userId || !ctx.tenantId) {
    return { granted: false, response: unauthorized(ctx, 'Autentikasi diperlukan untuk aksi ini.') };
  }
  if (!(ctx.amr ?? []).includes('mfa')) {
    return {
      granted: false,
      response: errorResponse(
        'MFA_REQUIRED',
        'Aksi perubahan hak dan konfigurasi mewajibkan sesi ber-MFA; selesaikan tantangan pada /auth/mfa/verify.' + devMfaBypassHint(),
        ctx,
        401
      ),
    };
  }
  return null;
}
