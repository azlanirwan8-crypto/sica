/**
 * RBAC ber-scope (Slice ADM-8) — sumber kebenaran: docs/RBAC_MATRIX.md §2/§3/§4
 * dan docs/DATA_MODEL.md §3 + §9 + §14.4.
 *
 * Dua lapis jangan tertukar:
 *  - `roles.code`   = peran kanonik UPPER_SNAKE (17 nilai `ROLE_CODES` kontrak).
 *  - enum `member_role` pada `tenant_memberships.role` = **carrier** login, bukan peran.
 *
 * Catatan: Drizzle 0.33 belum dapat mengekspresikan FK komposit maupun RLS, jadi
 * `fk_rp_role`/`fk_ura_role`/`fk_acr_role`, `CHECK`, `FORCE ROW LEVEL SECURITY`,
 * policy `tenant_isolation`, dan seluruh seed ditulis di migrasi
 * `0011_rbac_scoped.sql`. Definisi di bawah dijaga tetap cocok dengan DDL itu.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './auth';
import { organizations, academicPeriods, studyPrograms } from './academic-master';
import { classes, students } from './classes';
import {
  permissionVerbEnum,
  roleScopeKindEnum,
  accessRequestStatusEnum,
  accessRequestKindEnum,
} from './enums';

/** Katalog izin GLOBAL — tanpa `tenant_id`, hanya SELECT runtime (migrasi §2 & §9). */
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    module: text('module').notNull(),
    resource: text('resource').notNull(),
    verb: permissionVerbEnum('verb').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    moduleIdx: index('idx_permissions_module').on(table.module),
    resourceVerbIdx: index('idx_permissions_resource_verb').on(table.resource, table.verb),
  })
);

/** Peran per-tenant. Lingkup konkret selalu ada di penugasan, tidak pernah di sini. */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    displayName: text('display_name').notNull(),
    scopeKind: roleScopeKindEnum('scope_kind').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex('uq_roles_tenant_code').on(table.tenantId, table.code),
    // target FK komposit tabel anak: menjamin grant/assignment tak pernah menunjuk
    // role tenant lain
    tenantIdUnique: uniqueIndex('uq_roles_tenant_id').on(table.tenantId, table.id),
    tenantIdx: index('idx_roles_tenant').on(table.tenantId, table.code),
  })
);

/** Grant izin → peran. `tenant_id` didenormalisasi agar RLS menempel langsung. */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
    permissionIdx: index('idx_role_permissions_perm').on(table.permissionId),
    tenantRoleIdx: index('idx_role_permissions_tenant').on(table.tenantId, table.roleId),
  })
);

/**
 * Penugasan peran ber-scope + masa berlaku — penentu hak akses nyata.
 * `origin='SEED'` menandai turunan enum carrier lama (bukan grant manusia),
 * satu-satunya keadaan di mana `assignedBy` boleh kosong.
 */
export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    scopeOrgId: uuid('scope_org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    scopeProgramId: uuid('scope_program_id').references(() => studyPrograms.id, {
      onDelete: 'cascade',
    }),
    scopeClassId: uuid('scope_class_id').references(() => classes.id, { onDelete: 'cascade' }),
    scopePeriodId: uuid('scope_period_id').references(() => academicPeriods.id, {
      onDelete: 'cascade',
    }),
    scopeStudentId: uuid('scope_student_id').references(() => students.id, { onDelete: 'cascade' }),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp('valid_to', { withTimezone: true }),
    origin: text('origin').notNull().default('GRANT'), // SEED | GRANT | IMPORT
    assignedBy: uuid('assigned_by').references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lookupIdx: index('idx_ura_lookup').on(table.tenantId, table.userId, table.roleId),
    roleIdx: index('idx_ura_role').on(table.tenantId, table.roleId),
    // Keunikan (user, role, scope) dijaga `uq_ura_scope` — indeks EKSPRESI dengan
    // COALESCE di migrasi, bentuk yang tidak dapat dinyatakan Drizzle di sini.
  })
);

/**
 * Empat-mata untuk perubahan hak — `chk_acr_no_self_approval`, `chk_acr_approver_not_target`,
 * `chk_acr_target_by_kind`, dan `chk_acr_decision_reason` ditegakkan di DB (`0082`).
 * `targetUserId` boleh kosong **hanya** untuk `ROLE_PERMISSION_CHANGE`: yang disunting
 * adalah komposisi sebuah role, bukan penugasan ke orang.
 */
export const accessChangeRequests = pgTable(
  'access_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id').references(() => users.id),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    requestKind: accessRequestKindEnum('request_kind').notNull().default('GRANT'),
    scope: jsonb('scope').notNull(),
    reason: text('reason').notNull(),
    status: accessRequestStatusEnum('status').notNull().default('PENDING'),
    decisionReason: text('decision_reason'),
    approverId: uuid('approver_id').references(() => users.id),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => ({
    tenantStatusIdx: index('idx_acr_tenant_status').on(
      table.tenantId,
      table.status,
      table.requestedAt
    ),
  })
);

export type PermissionRow = typeof permissions.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;
export type UserRoleAssignmentRow = typeof userRoleAssignments.$inferSelect;
export type AccessChangeRequestRow = typeof accessChangeRequests.$inferSelect;
