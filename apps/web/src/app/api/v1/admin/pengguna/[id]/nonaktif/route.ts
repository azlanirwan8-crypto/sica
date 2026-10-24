/**
 * POST `/api/v1/admin/pengguna/:id/nonaktif` (API_SPEC §4.6.9).
 *
 * Nonaktif ≠ hapus. Dalam SATU transaksi: status akun `DISABLED`, keanggotaan `LEFT`,
 * seluruh penugasan aktif ditutup (`valid_to = now()`) dan sesi hidup dicabut. Karena
 * hak dibaca dari tabel pada setiap permintaan, pencabutan berlaku pada permintaan
 * berikutnya — bukan pada token yang sudah beredar (`SEC-10`).
 * Menonaktifkan diri sendiri → `403 SELF_APPROVAL_FORBIDDEN` (56).
 */
import type { NextRequest } from 'next/server';
import { DeactivateAdminUserRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { mapAdminIdentityError } from '@/lib/admin-errors';
import { deactivateAdminUser } from '@/modules/identity/services/admin-identity.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = extractRequestContext(request);
  const { id } = await params;

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminWrite(ctx, PERM.identityUserDeactivate);
  if (!guard.granted) return guard.response;

  const parsed = DeactivateAdminUserRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body hanya memuat `reason` (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await deactivateAdminUser(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    id,
    parsed.data.reason
  );
  if (!result.ok) return mapAdminIdentityError(result.error, ctx);

  return successResponse({ userId: id, ...result.value }, ctx);
}
