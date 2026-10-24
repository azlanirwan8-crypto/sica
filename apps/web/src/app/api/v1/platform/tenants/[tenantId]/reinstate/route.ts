/**
 * POST /api/v1/platform/tenants/:tenantId/reinstate — arah balik SUSPENDED → ACTIVE.
 * Sengaja memakai KODE IZIN YANG SAMA dengan suspend (§4.20: satu gerbang transisi),
 * bukan izin kedua (RBAC §4.5.3 catatan baris 304).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERM, TenantStatusTransitionRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformWrite } from '@/lib/platform-guard';
import { transitionTenantStatus } from '@/modules/platform/services/platform.service';
import { mapTransitionError } from '@/lib/platform-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-155): gerbang transisi yang sama dengan
  // suspend, dan peran tanpa hak selalu menerima 403 datar tanpa `details`.
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
    'ACTIVE',
    parsed.data.reason
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 200 }
  );
}
