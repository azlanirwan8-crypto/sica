/**
 * POST `/api/v1/admin/system-parameter-approvals/{id}/reject` (`API_SPEC §4.16.3`, M-02).
 *
 * `reason` wajib ≥ 10 karakter dan ditulis ke `decision_reason` — bukan kolom yang boleh
 * kosong, karena "mengapa tidak" adalah separuh dari nilai jejak audit. Menolak juga aksi
 * orang kedua: pemohon tidak boleh menutup drafnya sendiri lewat rute ini (itu `CANCELLED`,
 * dan rutenya belum ada — dinyatakan, bukan diloloskan diam-diam).
 */
import type { NextRequest } from 'next/server';
import { RejectParameterSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWriteAny } from '@/lib/admin-guard';
import { ALL_PARAM_APPROVE_PERMISSIONS, parameterWriteMeta } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { decideParameterApproval } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Body) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWriteAny(ctx, ALL_PARAM_APPROVE_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = RejectParameterSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Penolakan wajib disertai alasan 10–500 karakter.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { id } = await params;
  const result = await decideParameterApproval(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    id,
    'REJECTED',
    parsed.data.reason,
    parameterWriteMeta(request, ctx.requestId)
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 200);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
