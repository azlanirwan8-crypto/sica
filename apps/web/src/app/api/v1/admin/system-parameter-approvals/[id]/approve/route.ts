/**
 * POST `/api/v1/admin/system-parameter-approvals/{id}/approve` (`API_SPEC §4.16.3`, M-02).
 *
 * Satu-satunya tempat nilai `REGULATORY`/`SECURITY` menjadi efektif. Empat syarat,
 * semuanya gagal-closed dan semuanya punya uji:
 *  - sesi ber-MFA (`requireAdminWriteAny` → `2` `MFA_REQUIRED`);
 *  - pemegang `settings.param.approve.<kelas>` (375/376) — bukan izin edit;
 *  - `approverId ≠ requestedBy` (`56`, diperkuat `ck_param_approval_foureyes`);
 *  - keadaan masih `PENDING` (`55`) dan versi baris belum bergerak (`12`) — draf tidak
 *    pernah boleh diterapkan di atas keadaan yang sudah berubah.
 *
 * Nilai diuji ulang terhadap batas HARI ITU sebelum ditulis: rentang/enum bisa bergerak
 * antara pengajuan dan keputusan.
 */
import type { NextRequest } from 'next/server';
import { ApproveParameterSchema } from '@sica/contracts';
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

  const parsed = ApproveParameterSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body persetujuan tidak sesuai kontrak.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { id } = await params;
  const result = await decideParameterApproval(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    id,
    'APPROVED',
    parsed.data.reason ?? null,
    parameterWriteMeta(request, ctx.requestId)
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 200);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
