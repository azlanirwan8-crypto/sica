/**
 * DELETE `/api/v1/admin/hak-akses/penugasan/:id` (API_SPEC §4.6.9).
 *
 * Bukan penghapusan baris: menulis permintaan `REVOKE` (`202`) dan penugasan baru
 * ditutup (`valid_to`) setelah orang kedua menyetujui. `roleId` & lingkup dibaca dari
 * baris penugasan, tidak pernah dipercaya dari klien (anti-IDOR). Alasan wajib ≥ 10
 * karakter dan dibawa sebagai query — `DELETE` dengan body tidak dapat diandalkan
 * lintas klien (fetch, curl, Flutter `http`).
 */
import type { NextRequest } from 'next/server';
import { PERM, ReasonQuerySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { mapAccessRequestError } from '@/lib/admin-errors';
import { submitRevokeRequest } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityAssignmentRevoke);
  if (!guard.granted) return guard.response;

  const parsed = ReasonQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Query `reason` wajib (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await submitRevokeRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    id,
    parsed.data.reason
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse({ requestId: result.value.requestId, status: result.value.status }, ctx, 202);
}
