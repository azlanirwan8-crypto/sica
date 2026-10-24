/**
 * POST `/api/v1/admin/permintaan-hak/:id/reject` (API_SPEC §4.6.9, `VALIDATE` 352).
 *
 * SATU izin untuk dua hasil (vonis `RBAC §4.5.1`, `G-12`): tidak ada kode `.reject`
 * kedua — yang berbeda hanya jalurnya. Penolakan WAJIB beralasan ≥ 10 karakter
 * (`chk_acr_decision_reason` di DB) karena alasan penolakan adalah bagian dari bukti
 * empat-mata, bukan formalitas UI. Empat-mata & MFA berlaku identik dengan approve.
 */
import type { NextRequest } from 'next/server';
import { PERM, RejectAccessRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { mapAccessRequestError } from '@/lib/admin-errors';
import { decideAccessRequest } from '@/modules/identity/services/access-request.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.identityAccessRequestApprove);
  if (!guard.granted) return guard.response;

  const parsed = RejectAccessRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Penolakan wajib beralasan (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await decideAccessRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    id,
    'REJECTED',
    parsed.data.reason
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse(result.value, ctx);
}
