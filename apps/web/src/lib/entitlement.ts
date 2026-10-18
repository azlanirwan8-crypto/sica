/**
 * Entitlement Resolver & Guard — gerbang modul per-tenant (SaaS add-on).
 *
 * Bagian "pure" (penyelesaian graf dependensi) tidak bergantung DB/Next → mudah diuji.
 * Akses runtime nyata ke `tenant_modules` di-inject via `ModuleCheck`/provider (adapter DB belakangan).
 * Rujukan: docs/DATA_MODEL.md §12.3–12.4, docs/TECH_CONVENTIONS.md §5, docs/ARCHITECTURE.md §9–10.
 */
import type { ModuleCode } from '@sica/contracts';
import type { RequestContext } from '@/lib/api-response';

export interface ModuleEdge {
  readonly module: ModuleCode;
  readonly dependsOn: ModuleCode;
  readonly required: boolean;
}

export type ActiveSet = ReadonlySet<ModuleCode>;

/** Semua dependensi REQUIRED dari sebuah modul (satu level). */
export function requiredDependenciesOf(
  moduleCode: ModuleCode,
  edges: readonly ModuleEdge[]
): ModuleCode[] {
  return edges
    .filter((e) => e.module === moduleCode && e.required)
    .map((e) => e.dependsOn);
}

/** Dependensi required yang BELUM aktif — penghambat aktivasi. */
export function missingDependencies(
  moduleCode: ModuleCode,
  active: ActiveSet,
  edges: readonly ModuleEdge[]
): ModuleCode[] {
  return requiredDependenciesOf(moduleCode, edges).filter((dep) => !active.has(dep));
}

/** Modul aktif lain yang bergantung (required) pada `moduleCode` — penghambat deaktivasi. */
export function blockingDependents(
  moduleCode: ModuleCode,
  active: ActiveSet,
  edges: readonly ModuleEdge[]
): ModuleCode[] {
  return edges
    .filter((e) => e.dependsOn === moduleCode && e.required && active.has(e.module))
    .map((e) => e.module);
}

export interface ActivationDecision {
  readonly canActivate: boolean;
  readonly missing: ModuleCode[];
}

export function evaluateActivation(
  moduleCode: ModuleCode,
  active: ActiveSet,
  edges: readonly ModuleEdge[]
): ActivationDecision {
  const missing = missingDependencies(moduleCode, active, edges);
  return { canActivate: missing.length === 0, missing };
}

export interface DeactivationDecision {
  readonly canDeactivate: boolean;
  readonly blockedBy: ModuleCode[];
}

export function evaluateDeactivation(
  moduleCode: ModuleCode,
  active: ActiveSet,
  edges: readonly ModuleEdge[]
): DeactivationDecision {
  const blockedBy = blockingDependents(moduleCode, active, edges);
  return { canDeactivate: blockedBy.length === 0, blockedBy };
}

/**
 * Tutup transitive dependensi required dari satu modul (untuk validasi katalog / anti-siklus).
 * Mengembalikan dependensi tidak langsung; berhenti saat bertemu sikulus (diamankan `visited`).
 */
export function transitiveRequiredDependencies(
  moduleCode: ModuleCode,
  edges: readonly ModuleEdge[],
  visited: Set<ModuleCode> = new Set()
): Set<ModuleCode> {
  const out = new Set<ModuleCode>();
  for (const dep of requiredDependenciesOf(moduleCode, edges)) {
    if (visited.has(dep)) continue;
    visited.add(dep);
    out.add(dep);
    for (const nested of transitiveRequiredDependencies(dep, edges, visited)) {
      out.add(nested);
    }
  }
  return out;
}

/** Deteksi siklus pada graf dependensi required. */
export function hasDependencyCycle(edges: readonly ModuleEdge[]): boolean {
  const modules = new Set<ModuleCode>();
  for (const e of edges) {
    modules.add(e.module);
    modules.add(e.dependsOn);
  }
  for (const m of modules) {
    if (transitiveRequiredDependencies(m, edges).has(m)) return true;
  }
  return false;
}

// =============================================================================
// Guard withModule (framework-agnostic, diuji dengan check injeksi)
// =============================================================================

export type ModuleCheck = (tenantId: string | null, moduleCode: ModuleCode) => Promise<boolean>;

export interface WithModuleOptions<A extends unknown[], R> {
  readonly moduleCode: ModuleCode;
  readonly check: ModuleCheck;
  readonly handler: (ctx: RequestContext, ...args: A) => Promise<R>;
  readonly onDenied: (ctx: RequestContext, moduleCode: ModuleCode) => R;
}

/** Bungkus handler: tolak (via onDenied) bila modul tidak aktif utk tenant; selain itu jalankan handler. */
export function withModule<A extends unknown[], R>(
  opts: WithModuleOptions<A, R>
): (ctx: RequestContext, ...args: A) => Promise<R> {
  return async (ctx: RequestContext, ...args: A): Promise<R> => {
    const entitled = await opts.check(ctx.tenantId, opts.moduleCode);
    if (!entitled) {
      return opts.onDenied(ctx, opts.moduleCode);
    }
    return opts.handler(ctx, ...args);
  };
}
