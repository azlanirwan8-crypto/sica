/**
 * GET `/api/v1/admin/system-parameter-approvals` (`API_SPEC §4.16.2`/`§4.16.3`, M-02).
 *
 * Rute ini ditambahkan 2026-10-23 karena `SPE-5` menuntut layar "Antrean persetujuan"
 * sedangkan kontraknya hanya punya `approve`/`reject`: penyetuju kedua tidak dapat
 * menyetujui id yang tidak pernah dapat ia temukan. Read-only, list kanonik §2.4, dan
 * hanya berisi baris tenant peminta (RLS `FORCE`).
 *
 * Gerbangnya gabungan: pemegang VALIDATE kelas (melihat antrean yang akan diputuskannya)
 * ATAU pemegang izin baca/edit kelas (mengawasi drafnya sendiri menunggu orang kedua).
 * Yang terakhir ini penting — tanpa dia, "nilai saya tertahan" hanya terlihat sebagai
 * angka lama tanpa penjelasan.
 */
import type { NextRequest } from 'next/server';
import { PERM, ParameterApprovalListQuerySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminReadAny } from '@/lib/admin-guard';
import { ALL_PARAM_EDIT_PERMISSIONS, ALL_PARAM_VIEW_PERMISSIONS } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { listParameterApprovals } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminReadAny(ctx, [
    PERM.settingsParamApproveRegulatory,
    PERM.settingsParamApproveSecurity,
    ...ALL_PARAM_EDIT_PERMISSIONS,
    ...ALL_PARAM_VIEW_PERMISSIONS,
  ]);
  if (!guard.granted) return guard.response;

  const parsed = ParameterApprovalListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter antrean persetujuan tidak sah.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await listParameterApprovals(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    parsed.data
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  return successResponse(result.value.rows, ctx, 200, paginationFor(parsed.data.page, parsed.data.limit, result.value.total));
}
