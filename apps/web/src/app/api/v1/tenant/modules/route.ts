/**
 * GET /api/v1/tenant/modules — daftar modul + status entitlement tenant aktif.
 * Butuh login (tenantId dari klaim JWT terverifikasi). Runtime nodejs + DB nyata.
 * Rujukan: docs/API_SPEC.md §4.5.
 */
import type { NextRequest } from 'next/server';
import {
  extractRequestContext,
  successResponse,
  unauthorized,
  internalError,
} from '@/lib/api-response';
import { createDrizzleEntitlementRepository } from '@/modules/entitlement/entitlement.repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = createDrizzleEntitlementRepository();

export async function GET(request: NextRequest): Promise<Response> {
  const ctx = extractRequestContext(request);
  if (!ctx.authenticated || !ctx.tenantId) {
    return unauthorized(ctx, 'Autentikasi diperlukan untuk melihat modul tenant.');
  }
  try {
    const data = await repo.listTenantModules(ctx.tenantId);
    return successResponse(data, ctx, 200);
  } catch (error) {
    return internalError(ctx, error);
  }
}
