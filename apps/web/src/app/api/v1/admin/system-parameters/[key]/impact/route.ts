/**
 * GET `/api/v1/admin/system-parameters/{key}/impact` (`API_SPEC §4.16.3`, M-02).
 *
 * Jawabannya: "kalau angka ini turun, apa yang berubah?" Tiga sumber digabung deterministik
 * ke satu daftar tanpa duplikat — registri konsumen statis (`packages/contracts/src/parameter-keys.ts`),
 * pola `parameter_permissions` (hanya berlaku bila bersaksi dua orang), dan pemakaian kamus
 * lewat `reference_kind_usage` bila `enum_kind` terisi.
 *
 * Kunci tanpa baris registri masuk `orphanKeys[]`: itu **tunggakan CI gerbang (n)**, bukan
 * fitur — dan dibedakan dari "dampak nol" justru supaya layar tidak memuji angka kosong.
 */
import type { NextRequest } from 'next/server';
import { extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminReadAny } from '@/lib/admin-guard';
import { ALL_PARAM_VIEW_PERMISSIONS } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { readParameterImpact } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  readonly params: Promise<{ key: string }>;
}

export async function GET(request: NextRequest, { params }: Body) {
  const ctx = extractRequestContext(request);
  const guard = await requireAdminReadAny(ctx, ALL_PARAM_VIEW_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const { key } = await params;
  const result = await readParameterImpact(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    decodeURIComponent(key)
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 200);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
