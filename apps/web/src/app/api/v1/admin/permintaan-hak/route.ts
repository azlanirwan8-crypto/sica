/**
 * GET/POST `/api/v1/admin/permintaan-hak` (API_SPEC §4.6.9).
 *
 * GET  → pemohon selalu melihat barisnya sendiri; pandangan seluruh tenant menuntut
 *        `identity.accessrequest.view` (351). Alasan tersimpan utuh — tidak diringkas
 *        menjadi boolean, sebab jejak inilah bukti empat-mata (FR-IDT-05).
 * POST → **satu jalan untuk satu perubahan hak**. `POST …/penugasan` dan
 *        `PUT …/peran/:id/izin` adalah permukaan ramah-UI yang memetakan ke jalur yang
 *        sama; rute ini memilih jenisnya eksplisit sehingga `SCOPE_CHANGE` ditolak
 *        dengan alasan yang TERLIHAT (izin kanonik 112 belum dipromosikan, `G-15`),
 *        bukan dilayani diam-diam dengan izin pinjaman. Selalu `202 { requestId }`.
 */
import type { NextRequest } from 'next/server';
import {
  AccessRequestListQuerySchema,
  CreateAccessRequestSchema,
  PERM,
  type AccessRequestKind,
  type PermissionCode,
} from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminReadAny, requireAdminWrite } from '@/lib/admin-guard';
import { mapAccessRequestError } from '@/lib/admin-errors';
import { listAccessRequests, submitAccessRequest } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Izin tulis yang mengkhususkan tiap jenis permintaan (nomor §4.5.8). */
const WRITE_PERMISSION: Record<AccessRequestKind, PermissionCode> = {
  GRANT: PERM.identityAssignmentGrant,
  REVOKE: PERM.identityAssignmentRevoke,
  ROLE_PERMISSION_CHANGE: PERM.identityRoleUpdate,
  // `identity.assignment.scope` (112) belum ada di katalog → rute ini tidak bisa
  // memberinya izin, dan service menolak dengan alasan yang sama.
  SCOPE_CHANGE: PERM.identityAssignmentGrant,
};

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Rute ini terbaca bagi penyetuju (view, 351) MAUPUN pemohon yang ingin status
  // pengajuannya sendiri; `listAccessRequests` menyempit ke baris milik aktor bila
  // izin view tidak dipegang.
  //
  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminReadAny(ctx, [
    PERM.identityAccessRequestView,
    PERM.identityAssignmentGrant,
    PERM.identityAssignmentRevoke,
    PERM.identityRoleUpdate,
  ]);
  if (!guard.granted) return guard.response;

  const parsed = AccessRequestListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter permintaan hak tidak sah.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { rows, total } = await listAccessRequests(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    parsed.data
  );
  return successResponse(rows, ctx, 200, paginationFor(parsed.data.page, parsed.data.limit, total));
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-165). Rute ini tidak bisa memakai satu
  // `requireAdminWrite` di depan karena izin presisi dipilih dari `requestKind` di body, jadi
  // gerbang pertama adalah kelas kasar: "pegang SALAH SATU dari tiga izin tulis permintaan-hak".
  // Sengaja `requireAdminReadAny`, bukan `requireAdminWriteAny`: yang terakhir menuntut MFA
  // setelah izin kasar lolos, sehingga pemegang GRANT yang mengirim REVOKE tanpa MFA berubah
  // dari 403 hari ini menjadi 401 MFA_REQUIRED — oracle "kalau kamu ber-MFA, kamu bisa" yang
  // justru ditolak `admin-guard.ts:76-80`. Urutan akhir tetap: sesi → kelas izin → bentuk →
  // izin presisi (+MFA) → service.
  const coarse = await requireAdminReadAny(ctx, Object.values(WRITE_PERMISSION));
  if (!coarse.granted) return coarse.response;

  const parsed = CreateAccessRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body permintaan perubahan hak tidak sesuai kontrak.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const guard = await requireAdminWrite(ctx, WRITE_PERMISSION[parsed.data.requestKind]);
  if (!guard.granted) return guard.response;

  const result = await submitAccessRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    parsed.data
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse({ requestId: result.value.requestId, status: result.value.status }, ctx, 202);
}
