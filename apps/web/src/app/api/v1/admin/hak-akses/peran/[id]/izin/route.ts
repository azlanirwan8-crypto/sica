/**
 * GET/PUT `/api/v1/admin/hak-akses/peran/:id/izin` (API_SPEC §4.6.9).
 *
 * GET → daftar izin efektif peran; baris yang sedang `PENDING` terlihat terpisah lewat
 *       daftar permintaan, karena delta ini BELUM berlaku.
 * PUT → **tidak menulis `role_permissions`**. Ia membuat `access_change_requests`
 *       ber-`request_kind = ROLE_PERMISSION_CHANGE` (`202`) dan komposisi peran baru
 *       berubah saat penyetuju — orang kedua, sesi ber-MFA, scope mencakup TENANT.
 *       Peran sistem (`is_system`) ditolak: `409 CONFLICT` (12).
 */
import type { NextRequest } from 'next/server';
import { PERM, RolePermissionDeltaRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAccessRequestError } from '@/lib/admin-errors';
import { listRolePermissions } from '@/modules/identity/services/admin-identity.service';
import { submitAccessRequest } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  const guard = await requireAdminRead(ctx, PERM.identityRoleView);
  if (!guard.granted) return guard.response;

  const rows = await listRolePermissions(guard.principal.tenantId, id);
  return successResponse(rows, ctx);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityRoleUpdate);
  if (!guard.granted) return guard.response;

  const parsed = RolePermissionDeltaRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body harus `{grant, revoke, reason}` berisi id katalog.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await submitAccessRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    {
      requestKind: 'ROLE_PERMISSION_CHANGE',
      targetUserId: null,
      roleId: id,
      scope: {},
      permissionDelta: { grant: parsed.data.grant, revoke: parsed.data.revoke },
      reason: parsed.data.reason,
    }
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse({ requestId: result.value.requestId, status: result.value.status }, ctx, 202);
}
