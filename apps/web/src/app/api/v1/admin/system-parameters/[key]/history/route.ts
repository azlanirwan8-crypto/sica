/**
 * GET `/api/v1/admin/system-parameters/{key}/history` (`API_SPEC §4.16.3`, M-02).
 *
 * READ-only mutlak (`AC-AUD-1`): tidak ada satu pun rute tulis/hapus riwayat, dan
 * `0088` menutup UPDATE/DELETE di database dengan REVOKE + pemicu — uji `db:test:rls`
 * menuntut `42501`, bukan "0 rows affected" yang senyap.
 *
 * `ip`, `changed_by`, `approver_id` hanya ikut terproyeksi bagi pemegang
 * `settings.param.history.view` (baris 378). Peran lain tetap dapat melihat diff nilainya:
 * yang dilindungi adalah identitas pelapor, bukan sejarah angkanya.
 */
import type { NextRequest } from 'next/server';
import { ParameterHistoryQuerySchema } from '@sica/contracts';
import { errorResponse, extractRequestContext, paginationFor, successResponse } from '@/lib/api-response';
import { requireAdminReadAny } from '@/lib/admin-guard';
import { ALL_PARAM_VIEW_PERMISSIONS } from '@/lib/parameter-guard';
import { mapParameterError } from '@/lib/parameter-errors';
import { actorOf } from '@/modules/identity/services/access-request.service';
import { listParameterHistory } from '@/modules/settings/services/system-parameters.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  readonly params: Promise<{ key: string }>;
}

export async function GET(request: NextRequest, { params }: Body) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (RD-155): pola yang sama dengan `admin/organisasi`.
  const guard = await requireAdminReadAny(ctx, ALL_PARAM_VIEW_PERMISSIONS);
  if (!guard.granted) return guard.response;

  const parsed = ParameterHistoryQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Filter riwayat tidak sah (wajib ISO-date; to ≥ from).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const { key } = await params;
  const result = await listParameterHistory(
    await actorOf(guard.principal.tenantId, guard.principal.userId),
    decodeURIComponent(key),
    { from: parsed.data.from ?? null, to: parsed.data.to ?? null, page: parsed.data.page, limit: parsed.data.limit }
  );
  if (!result.ok) return mapParameterError(result.error, ctx);

  return successResponse(result.value, ctx, 200, paginationFor(parsed.data.page, parsed.data.limit, result.value.length));
}
