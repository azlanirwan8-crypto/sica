/**
 * Peta menu → izin (`DATA_MODEL §21.7`, migrasi `0050_menu_parameter_permissions.sql`)
 * dan konsumsi pohonnya di `API_SPEC §4.17`.
 *
 * Mirror ini dijaga tetap cocok dengan DDL; `CHECK (layer IN …)`, `CHECK (effect IN …)`,
 * `CHECK (scope_kind IN …)`, `CHECK (parent_id <> id)`, `CHECK (effective_to > effective_from)`,
 * RLS `ENABLE`+`FORCE` dengan policy `tenant_isolation`, serta `UNIQUE (tenant_id, layer, code)`
 * tidak dapat diekspresikan Drizzle 0.33 dan karena itu tetap milik migrasi. Dua hal yang
 * paling mudah salah baca:
 *  - `id` TIDAK punya `DEFAULT` di DDL, jadi penulis wajib membawa uuid-nya sendiri
 *    (sama seperti `master_system_parameters`).
 *  - `permission_code` adalah FK ke katalog `permissions` (`0011`/`0085`): tabel ini adalah
 *    **peta**, bukan kosakata izin. Menu yang belum tercantum di `menu_permissions` = tidak
 *    terlihat, dan itu BUKAN kontrol akses — L1–L6 tetap wajib di setiap rute tulis.
 */
import { pgTable, uuid, text, boolean, timestamp, date, integer, index, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { permissions } from './rbac';

/** `menu_items.layer` — kosakata tertutup (`CHECK 0050`), kelas A. */
export const MENU_LAYERS = ['WEB', 'MOBILE', 'BOTH'] as const;
export type MenuLayer = (typeof MENU_LAYERS)[number];

/** `menu_permissions.effect` — DENY menang atas ALLOW (`API_SPEC §4.17` norma 3). */
export const MENU_EFFECTS = ['ALLOW', 'DENY'] as const;
export type MenuEffect = (typeof MENU_EFFECTS)[number];

/** `menu_permissions.scope_kind`; `''` = warisi penugasan peran (NULL tidak bertabrakan di UNIQUE). */
export const MENU_SCOPE_KINDS = ['', 'TENANT', 'ORG', 'SITE', 'PROGRAM', 'CLASS'] as const;
export type MenuScopeKind = (typeof MENU_SCOPE_KINDS)[number];

export const menuItems = pgTable(
  'menu_items',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Titik memisah hierarki (`admin.identity.accounts`); stabil meski label diganti kampus. */
    code: text('code').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => menuItems.id),
    label: text('label').notNull(),
    labelEn: text('label_en'),
    /** Kunci registri rute statis — bukan path mentah; `null` sah untuk header/pemisah non-klik. */
    routeKey: text('route_key'),
    layer: text('layer').notNull().default('WEB'),
    /** Gerbang entitlement (ADR-13); `null` = modul yang digambar peran, bukan dilangganan. */
    moduleCode: text('module_code'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(100),
    isVisible: boolean('is_visible').notNull().default(true),
    requiresMfa: boolean('requires_mfa').notNull().default(false),
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1),
  },
  (table) => ({
    codeUniq: uniqueIndex('menu_items_tenant_id_layer_code_key').on(table.tenantId, table.layer, table.code),
    treeIdx: index('idx_menu_tree').on(table.tenantId, table.layer, table.parentId, table.sortOrder),
  })
);

export const menuPermissions = pgTable(
  'menu_permissions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    menuId: uuid('menu_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permissions.code),
    effect: text('effect').notNull().default('ALLOW'),
    scopeKind: text('scope_kind').notNull().default(''),
    note: text('note'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    grantUniq: uniqueIndex('menu_permissions_menu_id_permission_code_scope_kind_key').on(
      table.menuId,
      table.permissionCode,
      table.scopeKind
    ),
    menuIdx: index('idx_menuperm_menu').on(table.tenantId, table.menuId),
  })
);
