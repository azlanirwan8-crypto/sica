/**
 * POST /api/v1/platform/tenants — wizard provisioning (§4.20 baris 3; `AC-PLT-1`).
 *
 * Menuntut `Idempotency-Key` (0012 `idempotency_keys`): replay kunci sama + isi sama
 * mengembalikan respons tersimpan, isi beda → 409 `TENANT_PROVISION_FAILED` dan nol
 * baris bertahan (satu transaksi). Tulis wajib MFA (`requirePlatformWrite`).
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ProvisionTenantRequestSchema, PERM } from '@sica/contracts';
import { db, desc, tenants } from '@sica/database';
import { errorResponse, extractRequestContext } from '@/lib/api-response';
import { requirePlatformRead, requirePlatformWrite } from '@/lib/platform-guard';
import { provisionTenant } from '@/modules/platform/services/platform.service';
import { mapProvisionError } from '@/lib/platform-errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/platform/tenants — daftar agregat tanpa PII per-record (`AC-PLT-3`).
 * Paket & utilisasi sengaja TIDAK difan-out di sini: tabelnya ber-RLS per tenant, jadi
 * pembacaan lintas-tenant hanya lewat rute detail (§4.20 baris 2) dengan konteks target.
 */
export async function GET(request: NextRequest) {
  const ctx = extractRequestContext(request);
  const guard = await requirePlatformRead(ctx, PERM.platformTenantView);
  if (!guard.granted) return guard.response;

  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit') ?? 50) || 50, 200);
  const rows = await db
    .select({
      tenantId: tenants.id,
      slug: tenants.slug,
      legalName: tenants.legalName,
      status: tenants.status,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .limit(limit);

  return NextResponse.json(
    {
      success: true,
      data: rows.map((r) => ({ ...r, status: r.status as string, createdAt: r.createdAt.toISOString() })),
      meta: { timestamp: ctx.timestamp, requestId: ctx.requestId },
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const ctx = extractRequestContext(request);

  // Izin lebih dulu, baru bentuk (AGENTS §3.8, `AUDIT_READINESS` RD-155): `422` ber-detail
  // field adalah oracle kecil bagi peran yang tidak berhak menulis — ia mengajari penyerang
  // bentuk payload provisioning yang harus disiapkan.
  const guard = await requirePlatformWrite(ctx, PERM.platformTenantProvision);
  if (!guard.granted) return guard.response;

  const parsed = ProvisionTenantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse('VALIDATION_FAILED', 'Payload provisioning tidak valid.', ctx, 422,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey || idempotencyKey.length < 8) {
    return errorResponse('VALIDATION_FAILED', 'Header Idempotency-Key wajib (minimal 8 karakter).', ctx, 422,
      [{ field: 'Idempotency-Key', message: 'Hilang atau terlalu pendek.' }]);
  }

  const result = await provisionTenant(
    { tenantId: guard.principal.tenantId, userId: guard.principal.userId },
    parsed.data,
    idempotencyKey
  );
  if (!result.ok) return mapProvisionError(result.error, ctx);

  return NextResponse.json(
    { success: true, data: result.value, meta: { timestamp: ctx.timestamp, requestId: ctx.requestId } },
    { status: 201 }
  );
}
