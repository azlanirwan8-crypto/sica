import {
  pgTable,
  uuid,
  text,
  jsonb,
  date,
  integer,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { bytea } from './pg-types';

// Cermin migrasi 0012_audit_outbox.sql (DATA_MODEL §3/§4). Append-only: jangan pernah
// memetakan UPDATE/DELETE di sini — service hanya menyisipkan baris baru.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorRoleCtx: jsonb('actor_role_ctx'),
    targetEntity: text('target_entity').notNull(),
    targetId: uuid('target_id'),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    requestId: uuid('request_id'),
    ipHash: bytea('ip_hash'),
    userAgentHash: bytea('user_agent_hash'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    prevHash: bytea('prev_hash'),
    hash: bytea('hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.occurredAt] }),
    tenantTimeIdx: index('idx_audit_tenant_time').on(table.tenantId, table.occurredAt),
    targetIdx: index('idx_audit_target').on(table.tenantId, table.targetEntity, table.targetId),
  })
);

export const auditChainHead = pgTable(
  'audit_chain_head',
  {
    tenantId: uuid('tenant_id').notNull(),
    partitionStart: date('partition_start').notNull(),
    lastHash: bytea('last_hash').notNull(),
    lastAuditId: uuid('last_audit_id').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tenantId, table.partitionStart] }) })
);

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    aggregate: text('aggregate').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (table) => ({
    unpublishedIdx: index('idx_outbox_unpublished').on(table.occurredAt),
  })
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    tenantId: uuid('tenant_id').notNull(),
    key: text('key').notNull(),
    requestFingerprint: bytea('request_fingerprint').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({ pk: primaryKey({ columns: [table.tenantId, table.key] }) })
);

export const loginEvents = pgTable(
  'login_events',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id'),
    userId: uuid('user_id'),
    emailAttempted: text('email_attempted'),
    outcome: text('outcome').notNull(),
    ipHash: bytea('ip_hash'),
    userAgentHash: bytea('user_agent_hash'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ timeIdx: index('idx_login_events_time').on(table.occurredAt) })
);
