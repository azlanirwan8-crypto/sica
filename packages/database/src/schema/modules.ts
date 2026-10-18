/**
 * Entitlement Modul & Gerbang Add-on (Multi-tenant SaaS)
 *
 * Memungkinkan per-tenant mengaktifkan modul secara terpisah: kampus bisa
 * "SIAKAD saja" (addon PMB/LMS OFF) atau "SIAKAD + LMS" (aktifkan LMS saja),
 * dsb. Modul Core wajib; Addon opt-in dengan dependensi eksplisit.
 *
 * Kontrak sumber kebenaran: docs/DATA_MODEL.md §12.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants, plans } from './tenants';
import {
  moduleCategoryEnum,
  moduleLicenseMetricEnum,
  tenantModuleStatusEnum,
} from './enums';

/** Katalog modul GLOBAL (seperti plans/permissions) — tidak punya tenant_id → RLS OFF. */
export const modules = pgTable(
  'modules',
  {
    id: uuid('id').primaryKey(),
    code: text('code').notNull().unique(), // 'enrollment','lms','pmb','feeder_pddikti', …
    name: text('name').notNull(),
    category: moduleCategoryEnum('category').notNull(), // CORE | ADDON
    isCore: boolean('is_core').notNull().default(false),
    licenseMetric: moduleLicenseMetricEnum('license_metric').notNull().default('INCLUDED'),
    description: text('description'),
    icon: text('icon'), // nama ikon lucide untuk nav
    sortOrder: integer('sort_order').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index('idx_modules_category').on(table.category, table.isActive),
  })
);

/** Graf dependensi antar modul. Addon tidak dapat aktif bila prasyarat belum aktif. */
export const moduleDependencies = pgTable(
  'module_dependencies',
  {
    id: uuid('id').primaryKey(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    dependsOnModuleId: uuid('depends_on_module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    isRequired: boolean('is_required').notNull().default(true),
  },
  (table) => ({
    pairUnique: uniqueIndex('uq_module_dependency').on(table.moduleId, table.dependsOnModuleId),
    moduleIdx: index('idx_module_dep_module').on(table.moduleId),
  })
);

/** Pemetaan paket (plan) → modul yang termasuk, agar packaging dapat di-query. */
export const planModules = pgTable(
  'plan_modules',
  {
    id: uuid('id').primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    included: boolean('included').notNull().default(true),
    seatLimit: integer('seat_limit'), // NULL = mengikuti kuota paket
    priceRupiahMonth: bigint('price_rupiah_month', { mode: 'number' }), // add-on berbayar
  },
  (table) => ({
    planModuleUnique: uniqueIndex('uq_plan_module').on(table.planId, table.moduleId),
  })
);

/** Activation per-tenant (satu baris = satu modul yang dihidupkan untuk kampus itu). TENANT-SCOPED → RLS. */
export const tenantModules = pgTable(
  'tenant_modules',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'restrict' }),
    status: tenantModuleStatusEnum('status').notNull().default('ACTIVE'),
    seats: integer('seats'), // metering utk license_metric PER_SEAT
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }), // NULL = selama subscription aktif
    activatedBy: uuid('activated_by'), // user global yang menyetujui (audit)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantModuleUnique: uniqueIndex('uq_tenant_module').on(table.tenantId, table.moduleId),
    tenantStatusIdx: index('idx_tenant_modules_active').on(table.tenantId, table.status),
  })
);

export type ModuleRow = typeof modules.$inferSelect;
export type TenantModuleRow = typeof tenantModules.$inferSelect;
