/**
 * GET /api/v1/platform/tenants/:tenantId — keadaan satu tenant (§4.20 baris 2).
 * Target diselesaikan ke barisnya; tenant tidak ada = 404, BUKAN 403 (anti-oracle).
 * Baca agregat milik tenant target dilakukan dalam konteks tenant itu (RLS), tanpa PII.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { PERM } from '@sica/contracts';
import { db, eq, roles, subscriptions, tenants, tenantModules, withTenantContext } from '@sica/database';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformRead } from '@/lib/platform-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const ctx = extractRequestContext(_request);

  // Izin lebih dulu, baru bentuk — termasuk bentuk parameter path (AGENTS §3.8, RD-155).
  // `404` untuk UUID cacah hanya boleh dilihat pemegang `platform.tenant.view`; bagi peran
  // lain jawabannya selalu 403 datar.
  const guard = await requirePlatformRead(ctx, PERM.platformTenantView);
  if (!guard.granted) return guard.response;

  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) {
    return errorResponse('NOT_FOUND', 'Tenant tidak ditemukan.', ctx, 404);
  }

  const root = await db.select({ id: tenants.id, slug: tenants.slug, legalName: tenants.legalName, status: tenants.status, createdAt: tenants.createdAt }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = root[0];
  if (!tenant) return errorResponse('NOT_FOUND', 'Tenant tidak ditemukan.', ctx, 404);

  const detail = await withTenantContext(tenant.id, async (tx) => {
    const [moduleRows, roleRows, subRows] = await Promise.all([
      tx.select({ code: tenantModules.status, id: tenantModules.id }).from(tenantModules),
      tx.select({ code: roles.code }).from(roles),
      tx.select({ status: subscriptions.status, planId: subscriptions.planId, trialEndsAt: subscriptions.trialEndsAt }).from(subscriptions),
    ]);
    return {
      modulesActive: moduleRows.filter((m) => m.code === 'ACTIVE').length,
      modulesTotal: moduleRows.length,
      rolesSeeded: roleRows.length,
      subscription: subRows[0]
        ? { status: String(subRows[0].status), planId: subRows[0].planId, trialEndsAt: subRows[0].trialEndsAt?.toISOString() ?? null }
        : null,
    };
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        tenantId: tenant.id,
        slug: tenant.slug,
        legalName: tenant.legalName,
        status: String(tenant.status),
        createdAt: tenant.createdAt.toISOString(),
        ...detail,
      },
      meta: { timestamp: ctx.timestamp, requestId: ctx.requestId },
    },
    { status: 200 }
  );
}
