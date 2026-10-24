/**
 * Gerbang entitlement per rute (SEC-09): satu pabrik `withModule` produksi.
 *
 * Entitlement memotong lebih dulu dari peran (AGENTS §3.8): modul yang bukan
 * `ACTIVE`/`TRIAL` menghasilkan 404 `MODULE_NOT_AVAILABLE` (register API_SPEC §2.3
 * nomor 26) walau izin lewat. Penyaringan menu di UI bukan pengganti gerbang ini.
 */
import { ModuleNotAvailableCode, type ModuleCode } from '@sica/contracts';
import { errorResponse, type RequestContext } from '@/lib/api-response';
import { withModule } from '@/lib/entitlement';
import {
  createDrizzleEntitlementRepository,
  createTenantModuleCheck,
} from '@/modules/entitlement/entitlement.repository';

const tenantModuleCheck = createTenantModuleCheck(createDrizzleEntitlementRepository());

export function requireModule<A extends unknown[]>(
  moduleCode: ModuleCode,
  handler: (ctx: RequestContext, ...args: A) => Promise<Response>
): (ctx: RequestContext, ...args: A) => Promise<Response> {
  return withModule({
    moduleCode,
    check: tenantModuleCheck,
    handler,
    onDenied: (ctx, code) =>
      errorResponse(
        ModuleNotAvailableCode,
        `Modul "${code}" tidak tersedia untuk institusi ini.`,
        ctx,
        404
      ),
  });
}

/** Varian satu-baris untuk rute yang tidak dibungkus penuh: `null` = boleh lanjut. */
export function ensureModuleActive(
  moduleCode: ModuleCode
): (ctx: RequestContext) => Promise<Response | null> {
  const gated = withModule<[], Response | null>({
    moduleCode,
    check: tenantModuleCheck,
    handler: async () => null,
    onDenied: (ctx, code) =>
      errorResponse(
        ModuleNotAvailableCode,
        `Modul "${code}" tidak tersedia untuk institusi ini.`,
        ctx,
        404
      ),
  });
  return (ctx) => gated(ctx);
}
