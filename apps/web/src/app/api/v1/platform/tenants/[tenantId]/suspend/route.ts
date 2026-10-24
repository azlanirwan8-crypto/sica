/**
 * POST /api/v1/platform/tenants/:tenantId/suspend — transisi `ACTIVE → SUSPENDED` (§4.20).
 * `status` tidak pernah diterima dari body (SERVER_ONLY); badan hanya `reason` (10–500).
 * Aksi ini `VALIDATE`-kelas: wajib MFA + alasan + baris audit. Sesudahnya tulis tenant-level
 * answered 403 `TENANT_SUSPENDED` (151) — penegakan itu ada di gerbang rute tenant (lihat catatan).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERM, TenantStatusTransitionRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformWrite } from '@/lib/platform-guard';
import { mapTransitionError } from '@/lib/platform-errors';
import { transitionTenantStatus } from '@/modules/platform/services/platform.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-155): peran tanpa `platform.tenant.suspend`
  // wajib menerima 403 datar, bukan 422 ber-detail yang mengungkap kontrak body.
  const guard = await requirePlatformWrite(ctx, PERM.platformTenantSuspend);
  if (!guard.granted) return guard.response;

  const { tenantId } = await params;

  const parsed = TenantStatusTransitionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Body hanya memuat `reason` (10–500 karakter).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await transitionTenantStatus(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    tenantId,
    'SUSPENDED',
    parsed.data.reason
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 200 }
  );
}
