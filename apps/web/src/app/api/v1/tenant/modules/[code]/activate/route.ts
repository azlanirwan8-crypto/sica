/**
 * POST /api/v1/tenant/modules/[code]/activate — aktifkan add-on untuk tenant.
 *
 * Validasi dependensi terjadi di service; kegagalan dipetakan ke HTTP baku:
 *   - 422 MODULE_DEPENDENCY_UNMET (prasyarat belum aktif)
 * Body: ActivateModuleSchema { seats?, trial }. Hanya peran admin tenant.
 * Rujukan: docs/API_SPEC.md §4.5, docs/DATA_MODEL.md §12.4.
 */
import type { NextRequest } from 'next/server';
import {
  extractRequestContext,
  successResponse,
  errorResponse,
  validationFailed,
  internalError,
} from '@/lib/api-response';
import {
  ActivateModuleSchema,
  ModuleCodeSchema,
  ModuleDependencyUnmetCode,
} from '@sica/contracts';
import { createDrizzleEntitlementRepository } from '@/modules/entitlement/entitlement.repository';
import { activateModule } from '@/modules/entitlement/entitlement.service';
import { requireDataPrincipal } from '@/modules/authz/rbac-repository';

import { PERM } from '@sica/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = createDrizzleEntitlementRepository();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
): Promise<Response> {
  const ctx = extractRequestContext(request);

  const access = await requireDataPrincipal(ctx, PERM.entitlementModuleActivate);
  if (!access.granted) return access.response;
  const { tenantId, userId } = access.principal;

  const { code } = await context.params;
  const codeResult = ModuleCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return validationFailed(ctx, [{ field: 'code', message: 'Kode modul tidak dikenali.' }]);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationFailed(ctx, [{ field: 'body', message: 'Format JSON body tidak valid.' }]);
  }
  const parsed = ActivateModuleSchema.safeParse(body);
  if (!parsed.success) {
    return validationFailed(
      ctx,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }

  try {
    const result = await activateModule(tenantId, userId, codeResult.data, parsed.data, repo);
    if (!result.ok) {
      return errorResponse(
        ModuleDependencyUnmetCode,
        'Modul prasyarat belum diaktifkan.',
        ctx,
        422,
        result.missing.map((m) => ({ field: m, message: 'Dependensi required belum aktif.' }))
      );
    }
    return successResponse({ activated: result.activated, status: parsed.data.trial ? 'TRIAL' : 'ACTIVE' }, ctx, 201);
  } catch (error) {
    return internalError(ctx, error);
  }
}
