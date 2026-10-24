/**
 * POST `/api/v1/admin/system-parameters/register` (`API_SPEC §4.16.4`, M-02).
 *
 * Kunci baru TIDAK lahir dari `POST` bebas yang menerima apa saja: `consumerEvidence`
 * wajib menunjuk call site yang benar-benar ada di branch ini, dan tanpa itu permintaan
 * ditolak sebelum satu baris pun terbentuk. Itulah penangkal "parameter hantu" — layar
 * Admin yang menulis angka yang tidak dibaca siapa pun (`§4.16.7` butir 2, gerbang CI (n)).
 *
 * Kelas `REGULATORY`/`SECURITY` sengaja ditolak dari rute ini: `ck_param_regulatory_approver`
 * menuntut penyetuju berbeda dari pengajukan, dan satu permintaan HTTP tidak pernah boleh
 * mengaku dua orang. Kunci begitu lahir lewat migrasi/seed yang menandatangani dua
 * prinsipal nyata (`DATA_MODEL §21.2.1`).
 */
import type { NextRequest } from 'next/server';
import { PERM, RegisterParameterBodySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminWrite } from '@/lib/admin-guard';
import { parameterWriteMeta } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { registerSystemParameter } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWrite(ctx, PERM.settingsParamRegister);
  if (!guard.granted) return guard.response;

  const parsed = RegisterParameterBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body registrasi kunci tidak sesuai kontrak §4.16.4.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await registerSystemParameter(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    parsed.data,
    parameterWriteMeta(request, ctx.requestId)
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 201);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
