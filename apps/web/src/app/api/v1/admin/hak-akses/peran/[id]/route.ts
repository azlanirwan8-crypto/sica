/**
 * GET/PATCH/DELETE `/api/v1/admin/hak-akses/peran/:id` (API_SPEC §4.6.9).
 *
 * GET    → detail peran + jumlah pemegang/izin.
 * PATCH  → HANYA `displayName`. Izin tidak pernah berubah lewat PATCH (itu `PUT …/izin`
 *          yang menghasilkan permintaan empat-mata); `code`/`scope_kind` bersifat identitas.
 * DELETE → peran sistem → `409 CONFLICT` (12); peran masih memegang penugasan →
 *          `409` dengan sebab `REFERENCE_IN_USE` (19) — tidak ada hapus paksa.
 */
import type { NextRequest } from 'next/server';
import { PERM, ReasonQuerySchema, UpdateRoleRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAdminIdentityError } from '@/lib/admin-errors';
import {
  deleteTenantRole,
  getTenantRole,
  listRolePermissions,
  renameTenantRole,
} from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  const guard = await requireAdminRead(ctx, PERM.identityRoleView);
  if (!guard.granted) return guard.response;

  const role = await getTenantRole(guard.principal.tenantId, id);
  if (!role) return errorResponse('NOT_FOUND', 'Peran tidak ditemukan dalam institusi ini.', ctx, 404);

  const permissions = await listRolePermissions(guard.principal.tenantId, id);
  return successResponse({ ...role, permissions }, ctx);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityRoleUpdate);
  if (!guard.granted) return guard.response;

  const parsed = UpdateRoleRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'PATCH peran hanya menerima `displayName` dan `reason`.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await renameTenantRole(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return successResponse(result.value, ctx);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): query `reason` yang cacah tidak boleh dijawab
  // `422` ber-detail kepada peran yang memang tidak berhak menghapus.
  const guard = await requireAdminWrite(ctx, PERM.identityRoleDelete);
  if (!guard.granted) return guard.response;

  const parsed = ReasonQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Query `reason` wajib (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await deleteTenantRole(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data.reason
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return successResponse(result.value, ctx);
}
