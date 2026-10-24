/**
 * POST `/api/v1/admin/system-parameters/{key}/revert` (`API_SPEC §4.16.3`, M-02).
 *
 * Revert bukan koreksi jejak: ia menulis ENTRI BARU yang menunjuk entri asal
 * (`reason` = "Revert ke versi N …"), dan `app.reject_mutation()` (`0088`) menutup
 * UPDATE/DELETE riwayat di database. Kelas `SECURITY`/`REGULATORY` tetap lewat draf —
 * "kembali" bukan alasan untuk lolos dari persetujuan orang kedua.
 */
import type { NextRequest } from 'next/server';
import { RevertParameterBodySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWriteAny } from '@/lib/admin-guard';
import { ALL_PARAM_EDIT_PERMISSIONS, parameterWriteMeta } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { revertSystemParameter } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  readonly params: Promise<{ key: string }>;
}

export async function POST(request: NextRequest, { params }: Body) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWriteAny(ctx, ALL_PARAM_EDIT_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = RevertParameterBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body revert tidak sesuai kontrak: wajib alasan + expectedVersion + (toVersion ATAU toDefault).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { key } = await params;
  const result = await revertSystemParameter(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    decodeURIComponent(key),
    parsed.data,
    parameterWriteMeta(request, ctx.requestId)
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 200);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
