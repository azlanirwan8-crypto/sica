import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  bigint,
  integer,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantStatusEnum, subscriptionStatusEnum } from './enums';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  legalName: text('legal_name').notNull(),
  status: tenantStatusEnum('status').notNull().default('ONBOARDING'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  taxonomy: text('taxonomy'),
  settings: jsonb('settings').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull().unique(),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('idx_tenant_domains_tenant').on(table.tenantId),
  })
);

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  displayName: text('display_name').notNull(),
  maxActiveStudents: integer('max_active_students'),
  entitlements: jsonb('entitlements').notNull().default({}),
  priceRupiahMonth: bigint('price_rupiah_month', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum('status').notNull().default('TRIAL'),
    seatsStudent: integer('seats_student').notNull().default(0),
    billingAnchor: date('billing_anchor').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('idx_subscriptions_tenant').on(table.tenantId),
  })
);

export const tenantQuotas = pgTable('tenant_quotas', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  maxConcurrentOwRequests: integer('max_concurrent_ow_requests').notNull().default(300),
  maxApiRps: integer('max_api_rps').notNull().default(50),
  maxStorageMb: bigint('max_storage_mb', { mode: 'number' }).notNull().default(204800),
  maxExportRows: integer('max_export_rows').notNull().default(100000),
  maxBatchInvoiceRows: integer('max_batch_invoice_rows').notNull().default(20000),
});

export const tenantUsage = pgTable(
  'tenant_usage',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    bucketMonth: date('bucket_month').notNull(),
    activeStudents: integer('active_students').notNull().default(0),
    apiCalls: bigint('api_calls', { mode: 'number' }).notNull().default(0),
    storageBytes: bigint('storage_bytes', { mode: 'number' }).notNull().default(0),
    jobsRun: bigint('jobs_run', { mode: 'number' }).notNull().default(0),
  },
  (table) => ({
    pk: uniqueIndex('pk_tenant_usage').on(table.tenantId, table.bucketMonth),
  })
);
