/**
 * GET/PUT `/api/v1/admin/system-parameters/{key}` (`API_SPEC §4.16.1`/`§4.16.2`, M-02).
 *
 * `{key}` adalah kunci alami (`attendance.totp_rotate_seconds`), bukan uuid: ia yang
 * dipanggil kode, jadi identitas barisnya harus diselesaikan dari DB di dalam transaksi
 * ber-RLS sebelum apa pun disentuh (anti-IDOR, `§4.16.6`).
 *
 * PUT **bukan** tempat mengubah struktur kunci: body hanya berisi nilai + alasan +
 * `expectedVersion`, dan `.strict()` membuat kolom `SERVER_ONLY` (mis. `riskClass`,
 * `version`, `isSecret`) menjadi `422`, bukan diabaikan. Kelas `REGULATORY`/`SECURITY`
 * dijawab `409 PARAM_APPROVAL_REQUIRED` (113) dengan `approvalId` — nilai efektif belum
 * bergerak dan respons mengatakannya (`effectiveValue` ≠ `proposedValue`).
 */
import type { NextRequest } from 'next/server';
import { SystemParameterReadQuerySchema, SystemParameterWriteBodySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, successResponse } from '@/lib/api-response';
import { requireAdminReadAny, requireAdminWriteAny } from '@/lib/admin-guard';
import { ALL_PARAM_EDIT_PERMISSIONS, ALL_PARAM_VIEW_PERMISSIONS, parameterWriteMeta } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { getSystemParameter, writeSystemParameter } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ key: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminReadAny(ctx, ALL_PARAM_VIEW_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const query = SystemParameterReadQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter `?at=` wajib tanggal ISO YYYY-MM-DD.', ctx, 422,
      query.error.issues.map((i) => ({ field: i.path.join('.') || 'at', message: i.message })));
  }

  const { key } = await params;
  const result = await getSystemParameter(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    decodeURIComponent(key),
    query.data.at ?? null
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  const response = successResponse(result.value, ctx, 200);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): `422` ber-detail field adalah oracle kecil bagi
  // peran yang memang tidak berhak menulis — persis alasan yang dipakai untuk membalik
  // 403→401 pada sesi MFA di `admin-guard.ts`.
  const guard = await requireAdminWriteAny(ctx, ALL_PARAM_EDIT_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = SystemParameterWriteBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body perubahan nilai parameter tidak sesuai kontrak §4.16.2.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { key } = await params;
  const result = await writeSystemParameter(
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
