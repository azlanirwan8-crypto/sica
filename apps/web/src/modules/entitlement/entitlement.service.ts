/**
 * Entitlement Service — orkestrasi aktivasi/deaktivasi modul per-tenant.
 *
 * Murni terhadap `EntitlementRepository`; keputusan dependensi memakai resolver graf
 * di `@/lib/entitlement`. Menghasilkan unions terdiskriminasi agar route memetakan
 * ke HTTP code baku (422 MODULE_DEPENDENCY_UNMET, 409 MODULE_IN_USE).
 * Rujukan: docs/API_SPEC.md §4.5, docs/DATA_MODEL.md §12.4.
 */
import type { ModuleCode, ActivateModuleRequest, DeactivateModuleRequest } from '@sica/contracts';
import {
  evaluateActivation,
  evaluateDeactivation,
  blockingDependents,
  type ActiveSet,
} from '@/lib/entitlement';
import type { EntitlementRepository } from './entitlement.repository';

export type ActivateResult =
  | { readonly ok: true; readonly activated: ModuleCode }
  | { readonly ok: false; readonly reason: 'DEPENDENCY_UNMET'; readonly missing: ModuleCode[] };

export type DeactivateResult =
  | { readonly ok: true; readonly deactivated: ModuleCode; readonly cascaded: ModuleCode[] }
  | { readonly ok: false; readonly reason: 'IN_USE'; readonly blockedBy: ModuleCode[] };

export async function activateModule(
  tenantId: string,
  actorUserId: string | null,
  code: ModuleCode,
  req: ActivateModuleRequest,
  repo: EntitlementRepository
): Promise<ActivateResult> {
  const [active, edges] = await Promise.all([
    repo.getActiveModuleCodes(tenantId),
    repo.getDependencyEdges(),
  ]);
  const decision = evaluateActivation(code, active as ActiveSet, edges);
  if (!decision.canActivate) {
    return { ok: false, reason: 'DEPENDENCY_UNMET', missing: decision.missing };
  }
  await repo.activate(tenantId, actorUserId, code, { seats: req.seats, trial: req.trial });
  return { ok: true, activated: code };
}

export async function deactivateModule(
  tenantId: string,
  code: ModuleCode,
  req: DeactivateModuleRequest,
  repo: EntitlementRepository
): Promise<DeactivateResult> {
  const [active, edges] = await Promise.all([
    repo.getActiveModuleCodes(tenantId),
    repo.getDependencyEdges(),
  ]);
  const decision = evaluateDeactivation(code, active as ActiveSet, edges);

  if (!decision.canDeactivate && !req.force) {
    return { ok: false, reason: 'IN_USE', blockedBy: decision.blockedBy };
  }

  // `force` → cascade: matikan juga dependents required yang masih aktif (satu level transitif).
  const cascaded = req.force ? dependentsClosure(code, active, edges) : [];
  await repo.deactivate(tenantId, code);
  for (const dependent of cascaded) {
    await repo.deactivate(tenantId, dependent);
  }
  return { ok: true, deactivated: code, cascaded };
}

/** Semua modul aktif yang (transitif) bergantung required pada `code`. */
function dependentsClosure(
  code: ModuleCode,
  active: ActiveSet,
  edges: Parameters<typeof blockingDependents>[2]
): ModuleCode[] {
  const out = new Set<ModuleCode>();
  const queue: ModuleCode[] = [code];
  while (queue.length > 0) {
    const current = queue.shift() as ModuleCode;
    for (const dep of blockingDependents(current, active, edges)) {
      if (!out.has(dep)) {
        out.add(dep);
        queue.push(dep);
      }
    }
  }
  return [...out];
}
