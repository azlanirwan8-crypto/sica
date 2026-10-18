import { z } from 'zod';

// ==========================================
// Entitlement Modul & Add-on (SaaS packaging) — sumber kebenaran kontrak tipe.
// Rujukan: docs/DATA_MODEL.md §12, docs/API_SPEC.md §4.5, docs/ARCHITECTURE.md §9–10.
// Dipakai bersama Next.js (TS) & Flutter (via OpenAPI codegen) — Guardrail §3.4.
// ==========================================

export const MODULE_CODES = [
  // Core
  'identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment',
  'finance', 'feeder_pddikti', 'audit',
  // Add-on
  'pmb', 'cbt', 'lms', 'mbkm', 'thesis', 'spmi', 'hr_bkd', 'parent_portal',
  'graduation', 'tracer_iku',
] as const;

export const ModuleCodeSchema = z.enum(MODULE_CODES);
export type ModuleCode = z.infer<typeof ModuleCodeSchema>;

export const ModuleCategorySchema = z.enum(['CORE', 'ADDON']);
export type ModuleCategory = z.infer<typeof ModuleCategorySchema>;

export const ModuleLicenseMetricSchema = z.enum(['INCLUDED', 'PER_SEAT', 'FLAT']);
export type ModuleLicenseMetric = z.infer<typeof ModuleLicenseMetricSchema>;

export const TenantModuleStatusSchema = z.enum([
  'ACTIVE', 'TRIAL', 'PENDING_PAYMENT', 'DISABLED', 'EXPIRED',
]);
export type TenantModuleStatus = z.infer<typeof TenantModuleStatusSchema>;

/** Entri katalog modul global (GET /tenant/modules/catalog). */
export const ModuleCatalogEntrySchema = z.object({
  code: ModuleCodeSchema,
  name: z.string(),
  category: ModuleCategorySchema,
  isCore: z.boolean(),
  licenseMetric: ModuleLicenseMetricSchema,
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  dependencies: z.array(ModuleCodeSchema).default([]),
});
export type ModuleCatalogEntry = z.infer<typeof ModuleCatalogEntrySchema>;

/** Status modul untuk tenant tertentu (baris tenant_modules terproyeksi). */
export const TenantModuleSchema = z.object({
  code: ModuleCodeSchema,
  name: z.string(),
  category: ModuleCategorySchema,
  status: TenantModuleStatusSchema,
  seats: z.number().int().nonnegative().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
});
export type TenantModule = z.infer<typeof TenantModuleSchema>;

/** Aktifkan add-on; validasi dependensi terjadi di service (bukan di sini). */
export const ActivateModuleSchema = z.object({
  seats: z.number().int().positive().optional(),
  trial: z.boolean().default(false),
});
export type ActivateModuleRequest = z.infer<typeof ActivateModuleSchema>;

/** Nonaktifkan modul; `force` memicu cascade ke addon yang bergantung. */
export const DeactivateModuleSchema = z.object({
  force: z.boolean().default(false),
});
export type DeactivateModuleRequest = z.infer<typeof DeactivateModuleSchema>;

/** Payload error gating standar (404 saat modul OFF di luar rotasi UI). */
export const ModuleNotAvailableCode = 'MODULE_NOT_AVAILABLE' as const;
export const ModuleDependencyUnmetCode = 'MODULE_DEPENDENCY_UNMET' as const;
export const ModuleInUseCode = 'MODULE_IN_USE' as const;
