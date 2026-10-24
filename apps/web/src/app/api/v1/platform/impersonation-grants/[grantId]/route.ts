/**
 * DELETE /api/v1/platform/impersonation-grants/:grantId?tenantId=… — tutup grant
 * (§4.20 baris revoke): yang berubah adalah STATE, baris jejak tidak pernah dihapus.
 * `tenantId` dibutuhkan karena RLS melarang pemindaian lintas-tenant; ia BUKAN otoritas —
 * baris tetap harus terbukti berada di tenant itu (tidak cocok → 404 anti-oracle).
 * Boleh dicabut PLATFORM_OPERATOR atau TENANT_ADMIN atas tenantnya sendiri (izin sama).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERM } from '@sica/contracts';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformWrite } from '@/lib/platform-guard';
import { mapTransitionError } from '@/lib/platform-errors';
import { revokeImpersonationGrant } from '@/modules/platform/services/platform.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk — termasuk bentuk parameter path/query (AGENTS §3.8, RD-155).
  // Penjelasan: `tenantId` di sini BUKAN input penjaga — `requirePlatformWrite` membaca
  // penanda operator dari token terverifikasi, dan kepemilikan baris target baru dibuktikan
  // di service lewat RLS. Jadi memindahkan penjaga ke depan tidak memalsukan urutan.
  const guard = await requirePlatformWrite(ctx, PERM.identityImpersonationRevoke);
  if (!guard.granted) return guard.response;

  const { grantId } = await params;
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId') ?? '';
  const reason = url.searchParams.get('reason') ?? 'Penutupan grant oleh operator platform.';

  if (!UUID_RE.test(grantId) || !UUID_RE.test(tenantId)) {
    return errorResponse('VALIDATION_FAILED', 'grantId dan query tenantId wajib UUID.', ctx, 422);
  }

  const result = await revokeImpersonationGrant(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    grantId,
    tenantId,
    reason
  );
  if (!result.ok) return mapTransitionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 200 }
  );
}
