/**
 * Entitlement Repository — akses status modul & graf dependensi per-tenant.
 *
 * Dua implementasi:
 *  - `InMemoryEntitlementRepository` : untuk unit test & bootstrap dev tanpa DB.
 *  - `createDrizzleEntitlementRepository` : runtime nyata (PostgreSQL + RLS via withTenantContext).
 *
 * Kontrak `ModuleCheck` untuk guard `withModule` dibuat lewat `createTenantModuleCheck(repo)`.
 * Rujukan: docs/DATA_MODEL.md §12, docs/TECH_CONVENTIONS.md §5.
 */
import type { ModuleCode, TenantModule } from '@sica/contracts';
import {
  db,
  withTenantContext,
  modules,
  moduleDependencies,
  tenantModules,
  and,
  eq,
  inArray,
  isNull,
  or,
  gt,
} from '@sica/database';
import type { ModuleEdge } from '@/lib/entitlement';

/** Status yang dihitung "dapat diakses" untuk gating runtime. */
const ACCESSIBLE_STATUSES = ['ACTIVE', 'TRIAL'] as const;

export interface EntitlementRepository {
  /** Kode modul yang aktif/trial (belum kedaluwarsa) untuk satu tenant. */
  getActiveModuleCodes(tenantId: string): Promise<Set<ModuleCode>>;
  /** Semua sisi dependensi REQUIRED (katalog global). */
  getDependencyEdges(): Promise<ModuleEdge[]>;
  /** Proyeksi tenant_modules untuk satu tenant ( utk GET /tenant/modules). */
  listTenantModules(tenantId: string): Promise<TenantModule[]>;
  /** Tandai modul aktif utk tenant. `trial` → status TRIAL, selain itu ACTIVE. */
  activate(
    tenantId: string,
    actorUserId: string | null,
    code: ModuleCode,
    opts: { seats?: number; trial: boolean }
  ): Promise<void>;
  /** Tandai modul nonaktif (status DISABLED) utk tenant. */
  deactivate(tenantId: string, code: ModuleCode): Promise<void>;
}

// =============================================================================
// In-memory (test & dev-bootstrap)
// =============================================================================

export class InMemoryEntitlementRepository implements EntitlementRepository {
  private readonly perTenant = new Map<string, Set<ModuleCode>>();
  private readonly edges: ModuleEdge[];

  constructor(edges: readonly ModuleEdge[] = []) {
    this.edges = edges.map((e) => ({ ...e }));
  }

  seed(tenantId: string, codes: readonly ModuleCode[]): void {
    this.perTenant.set(tenantId, new Set(codes));
  }

  async getActiveModuleCodes(tenantId: string): Promise<Set<ModuleCode>> {
    return new Set(this.perTenant.get(tenantId) ?? []);
  }
  async getDependencyEdges(): Promise<ModuleEdge[]> {
    return this.edges.map((e) => ({ ...e }));
  }
  async listTenantModules(tenantId: string): Promise<TenantModule[]> {
    const active = await this.getActiveModuleCodes(tenantId);
    return [...active].map((code) => ({
      code,
      name: code,
      category: 'CORE',
      status: 'ACTIVE',
    }));
  }
  async activate(
    tenantId: string,
    _actor: string | null,
    code: ModuleCode
  ): Promise<void> {
    const set = this.perTenant.get(tenantId) ?? new Set<ModuleCode>();
    set.add(code);
    this.perTenant.set(tenantId, set);
  }
  async deactivate(tenantId: string, code: ModuleCode): Promise<void> {
    this.perTenant.get(tenantId)?.delete(code);
  }
}

// =============================================================================
// Drizzle (runtime nyata)
// =============================================================================

export function createDrizzleEntitlementRepository(): EntitlementRepository {
  return {
    async getActiveModuleCodes(tenantId): Promise<Set<ModuleCode>> {
      return withTenantContext(tenantId, async (tx) => {
        const rows = await tx
          .select({ code: modules.code })
          .from(tenantModules)
          .innerJoin(modules, eq(tenantModules.moduleId, modules.id))
          .where(
            and(
              eq(tenantModules.tenantId, tenantId),
              inArray(tenantModules.status, [...ACCESSIBLE_STATUSES]),
              or(isNull(tenantModules.validTo), gt(tenantModules.validTo, new Date()))
            )
          );
        return new Set(rows.map((r) => r.code as ModuleCode));
      });
    },

    async getDependencyEdges(): Promise<ModuleEdge[]> {
      // Katalog global (RLS off). Resolusi code via peta id→code agar tidak perlu alias tabel.
      const moduleRows = await db
        .select({ id: modules.id, code: modules.code })
        .from(modules);
      const codeById = new Map<string, ModuleCode>(
        moduleRows.map((m) => [m.id, m.code as ModuleCode])
      );
      const depRows = await db
        .select({
          moduleId: moduleDependencies.moduleId,
          dependsOnModuleId: moduleDependencies.dependsOnModuleId,
          required: moduleDependencies.isRequired,
        })
        .from(moduleDependencies)
        .where(eq(moduleDependencies.isRequired, true));
      const edges: ModuleEdge[] = [];
      for (const d of depRows) {
        const module = codeById.get(d.moduleId);
        const dependsOn = codeById.get(d.dependsOnModuleId);
        if (module && dependsOn) edges.push({ module, dependsOn, required: d.required });
      }
      return edges;
    },

    async listTenantModules(tenantId): Promise<TenantModule[]> {
      return withTenantContext(tenantId, async (tx) => {
        const rows = await tx
          .select({
            code: modules.code,
            name: modules.name,
            category: modules.category,
            status: tenantModules.status,
            seats: tenantModules.seats,
            validTo: tenantModules.validTo,
          })
          .from(tenantModules)
          .innerJoin(modules, eq(modules.id, tenantModules.moduleId))
          .where(eq(tenantModules.tenantId, tenantId));
        return rows.map((r) => ({
          code: r.code as ModuleCode,
          name: r.name,
          category: r.category as TenantModule['category'],
          status: r.status as TenantModule['status'],
          seats: r.seats ?? undefined,
          validTo: r.validTo ? r.validTo.toISOString() : null,
        }));
      });
    },

    async activate(tenantId, actorUserId, code, opts): Promise<void> {
      await withTenantContext(tenantId, async (tx) => {
        const [mod] = await tx
          .select({ id: modules.id })
          .from(modules)
          .where(eq(modules.code, code))
          .limit(1);
        if (!mod) throw new Error(`Modul tidak dikenal di katalog: ${code}`);
        const status = opts.trial ? 'TRIAL' : 'ACTIVE';
        await tx
          .insert(tenantModules)
          .values({
            id: crypto.randomUUID(),
            tenantId,
            moduleId: mod.id,
            status,
            seats: opts.seats ?? null,
            activatedBy: actorUserId,
          })
          .onConflictDoUpdate({
            target: [tenantModules.tenantId, tenantModules.moduleId],
            set: { status, seats: opts.seats ?? null, updatedAt: new Date() },
          });
      });
    },

    async deactivate(tenantId, code): Promise<void> {
      await withTenantContext(tenantId, async (tx) => {
        const [mod] = await tx
          .select({ id: modules.id })
          .from(modules)
          .where(eq(modules.code, code))
          .limit(1);
        if (!mod) return;
        await tx
          .update(tenantModules)
          .set({ status: 'DISABLED', updatedAt: new Date() })
          .where(
            and(
              eq(tenantModules.tenantId, tenantId),
              eq(tenantModules.moduleId, mod.id)
            )
          );
      });
    },
  };
}

// =============================================================================
// Factory ModuleCheck untuk guard withModule
// =============================================================================

/** Provider `ModuleCheck` dari repository — dipakai guard rute domain (`withModule`). */
export function createTenantModuleCheck(
  repo: EntitlementRepository
): (tenantId: string | null, code: ModuleCode) => Promise<boolean> {
  return async (tenantId, code) => {
    if (!tenantId) return false; // fail-secure: tanpa tenant → tak berhak
    const active = await repo.getActiveModuleCodes(tenantId);
    return active.has(code);
  };
}
