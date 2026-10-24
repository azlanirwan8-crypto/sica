/**
 * GET `/api/v1/admin/system-parameters` (`API_SPEC §4.16.1`, M-02).
 *
 * Daftar ini adalah proyeksi server, bukan daftar yang dapat disaring CSS: baris kelas
 * risiko yang tidak memegang izin baca (`settings.param.view.<kelas>`) TIDAK dikirim,
 * dan `total` dihitung setelah penyempitan yang sama. `?at=` merekonstruksi keadaan
 * tanggal itu dari riwayat (BR-R12) dan karenanya boleh ke Replica — tapi hari ini satu
 * jalur koneksi saja, dan itu dinyatakan, bukan diklaim.
 */
import type { NextRequest } from 'next/server';
import { SystemParameterListQuerySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminReadAny } from '@/lib/admin-guard';
import { ALL_PARAM_VIEW_PERMISSIONS } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { listSystemParameters } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminReadAny(ctx, ALL_PARAM_VIEW_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = SystemParameterListQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter katalog parameter tidak sah.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await listSystemParameters(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    parsed.data
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  return successResponse(result.value.rows, ctx, 200, {
    ...paginationFor(parsed.data.page, parsed.data.limit, result.value.total),
  });
}
