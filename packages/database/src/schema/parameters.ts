/**
 * Mesin Parameter Sistem Dinamis — `DATA_MODEL §21.2` + `§21.2.1`, migrasi
 * `0049_system_parameters.sql` + `0086_parameter_value_check_fix.sql` +
 * `0088_parameter_approvals.sql`.
 *
 * Mirror ini dijaga tetap cocok dengan DDL; `CHECK`, RLS `ENABLE`+`FORCE`, policy
 * `tenant_isolation`, pemicu hanya-tambah, dan indeks parsial TIDAK dapat diekspresikan
 * Drizzle 0.33 dan karena itu hidup di migrasi. Catatan yang mudah salah baca:
 *  - `value_num`/`value_bool`/`value_json` adalah kolom *generated STORED* — penulisannya
 *    lewat Drizzle akan gagal; baca saja, dan tulisan selalu lewat `parameter_value`.
 *  - `master_system_parameter_history` hanya-tambah BOTH oleh hak (REVOKE) dan pemicu
 *    `app.reject_mutation()` (`0088`); tidak ada satu pun jalur tulis di aplikasi untuknya.
 *  - `source_of_truth <> 'PARAM'` menandai **baris penemuan**: nilainya tidak pernah dibaca
 *    dari baris itu (`§21.2`), karena itu `parameter_value` baris penemuan adalah string
 *    kosong, bukan salinan dari rumah aslinya.
 *  - `id` TIDAK punya `DEFAULT` di DDL (`0049`/`0050`/`0088` menulis `id uuid PRIMARY KEY`),
 *    jadi `.defaultRandom()` di sini akan menjadi klaim palsu: penulis wajib membawa uuid-nya
 *    sendiri. Ini sebabnya seluruh INSERT di lapisan service memanggil `randomUUID()`.
 */
import { pgTable, uuid, text, boolean, jsonb, timestamp, date, integer, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { users } from './auth';

const NUMERIC_TYPES = "('INT','DECIMAL','PCT','SECONDS','METERS','BP')";

export const masterSystemParameters = pgTable(
  'master_system_parameters',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Kosakata tertutup `ck_param_module_code` (0088) — kelas A, bukan data tenant.
    moduleCode: text('module_code').notNull(),
    parameterKey: text('parameter_key').notNull(),
    parameterValue: text('parameter_value').notNull(),
    valueNum: numeric('value_num').generatedAlwaysAs(
      sql`CASE WHEN data_type IN ${sql.raw(NUMERIC_TYPES)} THEN parameter_value::numeric END`
    ),
    valueBool: boolean('value_bool').generatedAlwaysAs(sql`CASE WHEN data_type = 'BOOL' THEN parameter_value::boolean END`),
    valueJson: jsonb('value_json').generatedAlwaysAs(sql`CASE WHEN data_type = 'JSON' THEN parameter_value::jsonb END`),
    dataType: text('data_type').notNull(),
    unit: text('unit'),
    defaultValue: text('default_value').notNull(),
    minValue: text('min_value'),
    maxValue: text('max_value'),
    enumKind: text('enum_kind').references(() => referenceKinds.kind),
    description: text('description').notNull(),
    riskClass: text('risk_class').notNull(),
    appliesTo: jsonb('applies_to').notNull().default(sql`'{}'::jsonb`),
    isEditable: boolean('is_editable').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    isSecret: boolean('is_secret').notNull().default(false),
    requiresRestart: boolean('requires_restart').notNull().default(false),
    sourceOfTruth: text('source_of_truth').notNull().default('PARAM'),
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    version: integer('version').notNull().default(1),
    requestedBy: uuid('requested_by').references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => ({
    keyUniq: uniqueIndex('master_system_parameters_tenant_id_module_code_parameter_key_key').on(
      table.tenantId,
      table.moduleCode,
      table.parameterKey
    ),
    lookupIdx: index('idx_sysparam_lookup').on(table.tenantId, table.moduleCode, table.isActive, table.parameterKey),
  })
);

/** Insert-only: `0088` memasang `trg_sysparam_hist_immutable` + REVOKE UPDATE/DELETE. */
export const masterSystemParameterHistory = pgTable(
  'master_system_parameter_history',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parameterKey: text('parameter_key').notNull(),
    moduleCode: text('module_code').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value').notNull(),
    oldVersion: integer('old_version'),
    newVersion: integer('new_version').notNull(),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    reason: text('reason').notNull(),
    /** `inet` — Drizzle memetakannya sebagai text; bentuk kanonik dijaga DB. */
    ip: text('ip').notNull(),
    requestId: text('request_id'),
    source: text('source').notNull(),
    approverId: uuid('approver_id').references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    histIdx: index('idx_sysparam_hist').on(table.tenantId, table.parameterKey, table.occurredAt),
  })
);

/**
 * Draf nilai + jejak empat-mata (`§21.2.1`, `0088`). Nilai efektif TIDAK pernah dibaca dari
 * sini — hanya dari `master_system_parameters`, dan `appliedHistoryId` menandai bahwa efek
 * benar-benar sudah mendarat.
 */
export const masterSystemParameterApprovals = pgTable(
  'master_system_parameter_approvals',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parameterId: uuid('parameter_id')
      .notNull()
      .references(() => masterSystemParameters.id, { onDelete: 'cascade' }),
    parameterKey: text('parameter_key').notNull(),
    moduleCode: text('module_code').notNull(),
    state: text('state').notNull().default('PENDING'),
    proposedValue: text('proposed_value').notNull(),
    previousValue: text('previous_value').notNull(),
    proposedAppliesTo: jsonb('proposed_applies_to').notNull().default(sql`'{}'::jsonb`),
    previousVersion: integer('previous_version').notNull(),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    reason: text('reason').notNull(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    approverId: uuid('approver_id').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    ip: text('ip').notNull(),
    source: text('source').notNull().default('UI'),
    appliedHistoryId: uuid('applied_history_id'),
  },
  (table) => ({
    lookupIdx: index('idx_param_approval_lookup').on(table.tenantId, table.state, table.requestedAt),
    keyIdx: index('idx_param_approval_key').on(table.tenantId, table.parameterKey, table.requestedAt),
  })
);

/**
 * Kamus referensi global (`0007`) — dibutuhkan mirror ini karena `enum_kind` adalah FK ke
 * `reference_kinds.kind`, dan seed parameter wajib mendaftarkan kind-nya lebih dulu.
 * Definisi lengkapnya tetap milik `MDE-*`; yang di sini hanya kolom yang disentuh mesin
 * parameter (kind + label + domain + is_system).
 */
export const referenceKinds = pgTable(
  'reference_kinds',
  {
    kind: text('kind').primaryKey(),
    label: text('label').notNull(),
    /** enum `reference_domain` (0007) — dideklarasikan sebagai text agar tidak menambah enum yang belum diregistrasi di `enums.ts`. */
    domain: text('domain').notNull(),
    isSystem: boolean('is_system').notNull().default(true),
    feederCode: text('feeder_code'),
    hasExternalDictionary: boolean('has_external_dictionary').notNull().default(false),
  }
);

/**
 * Pola grant parameter (`0050`, `DATA_MODEL §21.7`) — memetakan kunci ke kode izin yang
 * sudah ada. Ditulis hanya oleh `SPE-7`; dibaca mesin untuk proyeksi dampak (`§4.16.3`).
 * `ck_paramperm_foureyes` melarang `approved_by = requested_by`, sehingga pola yang
 * ditulis satu orang tetap `approved_by IS NULL` = **belum berlaku** sampai orang kedua
 * menandatangani — dan itu alasan `SPE-7` belum dirutenkan (lihat API_SPEC §4.16.4).
 */
export const parameterPermissions = pgTable(
  'parameter_permissions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parameterPattern: text('parameter_pattern').notNull(),
    permissionCode: text('permission_code').notNull(),
    effect: text('effect').notNull().default('ALLOW'),
    minScope: text('min_scope').notNull().default('TENANT'),
    requiresMfa: boolean('requires_mfa').notNull().default(false),
    requiresSecondApprover: boolean('requires_second_approver').notNull().default(false),
    validFrom: date('valid_from').notNull().default(sql`CURRENT_DATE`),
    validTo: date('valid_to'),
    note: text('note').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    approvedBy: uuid('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => ({
    lookupIdx: index('idx_paramperm_lookup').on(table.tenantId, table.effect, table.parameterPattern),
  })
);
