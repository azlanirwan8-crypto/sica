/**
 * PATCH `/api/v1/admin/system-parameters/{key}/toggle-active` (`API_SPEC §4.16.3`, M-02).
 *
 * Menonaktifkan kunci yang masih dibaca konsumen dan tidak punya fallback sah ditolak
 * (`113` + `details[].fallback = DEFAULT_VALUE_MISSING`): gerbang kehilangan ambangnya,
 * bukan kehilangan preferensi. Bila `default_value` sah, yang berlaku adalah DEFAULT —
 * dan itu dilaporkan apa adanya, bukan sebagai "nilai kosong".
 */
import type { NextRequest } from 'next/server';
import { ToggleActiveBodySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWriteAny } from '@/lib/admin-guard';
import { ALL_PARAM_EDIT_PERMISSIONS, parameterWriteMeta } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { toggleSystemParameterActive } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  readonly params: Promise<{ key: string }>;
}

export async function PATCH(request: NextRequest, { params }: Body) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWriteAny(ctx, ALL_PARAM_EDIT_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = ToggleActiveBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body toggle wajib isActive + alasan (10–500) + expectedVersion.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { key } = await params;
  const result = await toggleSystemParameterActive(
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
