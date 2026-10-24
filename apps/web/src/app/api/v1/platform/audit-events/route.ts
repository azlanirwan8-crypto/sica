/**
 * GET /api/v1/platform/audit-events — jejak audit LINTAS tenant (§4.21 baris platform,
 * pemilik kontrak M-05). `reason` wajib: ini membaca data tetangga PII-adjacent di luar
 * tenant peminta (`SECURITY §13`), dan setiap akses itu sendiri menjadi baris audit baru
 * (`audit.cross_tenant.read`) — bukan hanya dibaca, tapi dicatat.
 * Target wajib diselesaikan ke barisnya (anti-IDOR); tidak ada proyeksi `before`/`after`
 * penuh di daftar (ringkas dulu; detail per-event milik §7.29).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CrossTenantAuditQuerySchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformRead } from '@/lib/platform-guard';
import { mapTransitionError } from '@/lib/platform-errors';
import { readCrossTenantAudit } from '@/modules/platform/services/platform.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-155): query yang cacah dari sesi yang
  // memang tidak boleh membaca jejak tetangga wajib dijawab 403 datar, bukan 422 ber-`details`
  // yang mengungkap kontrak `tenantId`/`reason`.
  const guard = await requirePlatformRead(ctx, PERM.auditLogView);
  if (!guard.granted) return guard.response;

  const q = Object.fromEntries(new URL(request.url).searchParams.entries());

  const parsed = CrossTenantAuditQuerySchema.safeParse(q);
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Query audit lintas-tenant tidak valid (tenantId UUID + reason ≥ 10 wajib).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await readCrossTenantAudit(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    {
      success: true,
      data: result.value.rows,
      meta: {
        timestamp: ctx.timestamp,
        requestId: ctx.requestId,
        pagination: {
          page: parsed.data.page,
          limit: parsed.data.limit,
          totalRecords: result.value.total,
          totalPages: Math.max(1, Math.ceil(result.value.total / parsed.data.limit)),
          hasNextPage: parsed.data.page * parsed.data.limit < result.value.total,
          hasPrevPage: parsed.data.page > 1,
        },
      },
    },
    { status: 200 }
  );
}
