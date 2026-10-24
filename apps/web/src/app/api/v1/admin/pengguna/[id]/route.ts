/**
 * GET/PATCH `/api/v1/admin/pengguna/:id` (API_SPEC §4.6.9).
 *
 * `:id` adalah **userId** dan selalu diselesaikan ke barisnya di dalam transaksi dengan
 * `tenant_id` dari token (anti-IDOR, `SEC-02`): lintas institusi → `404`, bukan `403`,
 * agar keberadaan baris tidak bocor. `PATCH` tidak pernah menerima kolom `SERVER_ONLY`
 * (`status`, `mfa_required`, `password_hash`): skema `.strict()` menjadikannya `422`.
 */
import type { NextRequest } from 'next/server';
import { PERM, UpdateAdminUserRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAdminIdentityError } from '@/lib/admin-errors';
import { getAdminUser, updateAdminUser } from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  const guard = await requireAdminRead(ctx, PERM.identityUserView);
  if (!guard.granted) return guard.response;

  const row = await getAdminUser(guard.principal.tenantId, id);
  if (!row) return errorResponse('NOT_FOUND', 'Pengguna tidak ditemukan dalam institusi ini.', ctx, 404);

  return successResponse(row, ctx);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityUserUpdate);
  if (!guard.granted) return guard.response;

  const parsed = UpdateAdminUserRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Hanya nama/email/kode anggota/carrier yang dapat disunting.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await updateAdminUser(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return successResponse(result.value, ctx);
}
