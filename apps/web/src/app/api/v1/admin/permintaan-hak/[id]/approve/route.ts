/**
 * POST `/api/v1/admin/permintaan-hak/:id/approve` (API_SPEC §4.6.9, validasi `VALIDATE` 352).
 *
 * Satu-satunya tempat efek perubahan hak dilahirkan. Gerbang yang ditegakkan sebelum
 * baris apa pun berubah:
 *  - sesi penyetuju ber-MFA (`requireAdminWrite`, 401 `MFA_REQUIRED` — 2);
 *  - penyetuju ≠ pemohon ≠ target (`403 SELF_APPROVAL_FORBIDDEN` — 56, dan `CHECK`
 *    `chk_acr_approver_not_target` di DB sebagai penjaring kedua);
 *  - lingkup permintaan ⊂ lingkup penyetuju (`403 ADMIN_SCOPE_MISMATCH` — 16);
 *  - status masih `PENDING` (`409 DECISION_ALREADY_MADE` — 55) — idempotensi keputusan
 *    diambil dari status baris, bukan dari `UPDATE` buta.
 * Efek (`GRANT`/`REVOKE`/delta izin peran) + baris keputusan + `audit_logs` satu transaksi.
 */
import type { NextRequest } from 'next/server';
import { ApproveAccessRequestSchema, PERM } from '@sica/contracts';
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

  const body = await request.json().catch(() => ({}));
  const parsed = ApproveAccessRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body hanya memuat `reason` opsional (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await decideAccessRequest(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId, access: guard.principal.access },
    id,
    'APPROVED',
    parsed.data.reason ?? null
  );
  if (!result.ok) return mapAccessRequestError(result.error, ctx);

  return successResponse(result.value, ctx);
}
