/**
 * GET/POST `/api/v1/admin/hak-akses/penugasan` (API_SPEC §4.6.9).
 *
 * GET  → daftar penugasan beserta masa berlaku, termasuk yang sudah kedaluwarsa
 *        (`includeExpired=true`) — riwayat harus dapat direkonstruksi (BR-R12).
 * POST → **tidak pernah** menulis `user_role_assignments`. Ia mengajukan `GRANT`
 *        (`202 { requestId, status }`) dan efeknya lahir saat orang kedua menyetujui.
 *        Lingkup yang diminta wajib himpunan bagian lingkup pemohon
 *        (`403 ADMIN_SCOPE_MISMATCH`, 16) — ditegakkan `holdsWithinScope`.
 */
import type { NextRequest } from 'next/server';
import { GrantAssignmentRequestSchema, AdminAssignmentListQuerySchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminRead, requireAdminWrite } from '@/lib/admin-guard';
import { mapAccessRequestError } from '@/lib/admin-errors';
import { listAssignments } from '@/modules/identity/services/admin-identity.service';
import { submitAccessRequest } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toIssues(error: { issues: readonly { path: readonly (string | number)[]; message: string }[] }) {
  return error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
}

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminRead(ctx, PERM.identityAssignmentView);
  if (!guard.granted) return guard.response;

  const parsed = AdminAssignmentListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter penugasan tidak sah.', ctx, 422, toIssues(parsed.error));
  }

  const { rows, total } = await listAssignments(guard.principal.tenantId, {
    ...parsed.data,
    includeExpired: parsed.data.includeExpired === 'true',
  });
  return successResponse(rows, ctx, 200, paginationFor(parsed.data.page, parsed.data.limit, total));
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityAssignmentGrant);
  if (!guard.granted) return guard.response;

  const parsed = GrantAssignmentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body pengajuan grant tidak sesuai kontrak.', ctx, 422, toIssues(parsed.error));
  }

  const result = await submitAccessRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    {
      requestKind: 'GRANT',
      targetUserId: parsed.data.userId,
      roleId: parsed.data.roleId,
      scope: parsed.data.scope,
      validTo: parsed.data.validTo ?? null,
      reason: parsed.data.reason,
    }
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse({ requestId: result.value.requestId, status: result.value.status }, ctx, 202);
}
