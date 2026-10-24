/**
 * PUT /api/v1/platform/tenants/:tenantId/quotas — seluruh `tenant_quotas` lewat satu rute
 * (§4.20 baris kuota). Kunci di luar §3.1 ditolak skema (422), nilai dipatok batas CHECK §15.
 * Read-after-write ke Primary (`AGENTS §3.7`) — hasil dikembalikan dari konteks target.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERM, UpdateTenantQuotasRequestSchema } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformWrite } from '@/lib/platform-guard';
import { mapTransitionError } from '@/lib/platform-errors';
import { updateTenantQuotas } from '@/modules/platform/services/platform.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-155): daftar kunci kuota yang sah hanya
  // boleh terungkap lewat 422 ber-detail kepada pemegang `platform.quota.manage`.
  const guard = await requirePlatformWrite(ctx, PERM.platformQuotaManage);
  if (!guard.granted) return guard.response;

  const { tenantId } = await params;

  const parsed = UpdateTenantQuotasRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Kunci kuota harus anggota kolom tenant_quotas; nilai dalam rentang CHECK.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await updateTenantQuotas(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    tenantId,
    parsed.data
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 200 }
  );
}
