/**
 * POST /api/v1/tenant/modules/[code]/deactivate — nonaktifkan modul untuk tenant.
 *
 * Enforcement: 409 MODULE_IN_USE bila modul masih dibutuhkan addon aktif lain
 * (kecuali `force: true` → cascade matikan dependents). Body: DeactivateModuleSchema.
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
  DeactivateModuleSchema,
  ModuleCodeSchema,
  ModuleInUseCode,
} from '@sica/contracts';
import { createDrizzleEntitlementRepository } from '@/modules/entitlement/entitlement.repository';
import { deactivateModule } from '@/modules/entitlement/entitlement.service';
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

  const access = await requireDataPrincipal(ctx, PERM.entitlementModuleDeactivate);
  if (!access.granted) return access.response;
  const { tenantId } = access.principal;

  const { code } = await context.params;
  const codeResult = ModuleCodeSchema.safeParse(code);
  if (!codeResult.success) {
    return validationFailed(ctx, [{ field: 'code', message: 'Kode modul tidak dikenali.' }]);
  }

  // Body opsional: default { force:false }.
  let raw: unknown = {};
  try {
    const text = await request.text();
    if (text) raw = JSON.parse(text);
  } catch {
    return validationFailed(ctx, [{ field: 'body', message: 'Format JSON body tidak valid.' }]);
  }
  const parsed = DeactivateModuleSchema.safeParse(raw);
  if (!parsed.success) {
    return validationFailed(
      ctx,
      parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }

  try {
    const result = await deactivateModule(tenantId, codeResult.data, parsed.data, repo);
    if (!result.ok) {
      return errorResponse(
        ModuleInUseCode,
        'Modul masih digunakan modul lain yang aktif.',
        ctx,
        409,
        result.blockedBy.map((m) => ({ field: m, message: 'masih bergantung pada modul ini' }))
      );
    }
    return successResponse(
      { deactivated: result.deactivated, cascaded: result.cascaded },
      ctx,
      200
    );
  } catch (error) {
    return internalError(ctx, error);
  }
}
