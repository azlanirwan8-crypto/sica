/**
 * POST /api/v1/platform/impersonation-grants — buka dukungan terawasi (§4.20 baris grant).
 * TTL ditetapkan SERVER (≤ 30 menit), `grant_kind='PLATFORM_SUPPORT'`, alasan wajib,
 * MFA pada sesi (guard), target user harus anggota tenant target (anti-IDOR: baris dibaca
 * dalam konteks RLS tenant target sebelum tulis).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CreateImpersonationGrantRequestSchema, PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformWrite } from '@/lib/platform-guard';
import { mapTransitionError } from '@/lib/platform-errors';
import { createImpersonationGrant } from '@/modules/platform/services/platform.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, RD-155): gerbang operator + MFA dievaluasi
  // dari token terverifikasi, jadi ia tidak memerlukan isi body sama sekali.
  const guard = await requirePlatformWrite(ctx, PERM.identityImpersonationGrant);
  if (!guard.granted) return guard.response;

  const parsed = CreateImpersonationGrantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Permintaan grant tidak valid (reason ≥ 15, target wajib, TTL 1–30 menit).', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const result = await createImpersonationGrant(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 201 }
  );
}
