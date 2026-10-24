import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { bytea } from './pg-types';
import { memberStatusEnum, memberRoleEnum } from './enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash'),
  passwordUpdatedAt: timestamp('password_updated_at', { withTimezone: true }),
  mfaRequired: boolean('mfa_required').notNull().default(false),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE | LOCKED | DISABLED
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordHistory = pgTable(
  'password_history',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_pw_hist').on(table.userId, table.createdAt),
  })
);

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberCode: text('member_code'), // NIM / NIP / NIDN
    role: memberRoleEnum('role').notNull().default('mahasiswa'), // RBAC per-tenant
    status: memberStatusEnum('status').notNull().default('PENDING'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex('uq_memberships_tenant_user').on(table.tenantId, table.userId),
    tenantMemberCodeUnique: uniqueIndex('uq_memberships_tenant_code').on(
      table.tenantId,
      table.memberCode
    ),
    userIdx: index('idx_memberships_user').on(table.userId),
    tenantIdx: index('idx_memberships_tenant').on(table.tenantId),
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleCtx: jsonb('role_ctx').notNull().default({}),
    authMethod: text('auth_method').notNull(), // password | password+totp | oidc | passkey
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
  },
  (table) => ({
    tenantUserActiveIdx: index('idx_sessions_tenant_user_active').on(table.tenantId, table.userId),
    expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
  })
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id').notNull(),
    rotatedFrom: uuid('rotated_from'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    familyIdx: index('idx_refresh_family').on(table.familyId),
    tenantIdx: index('idx_refresh_tenant').on(table.tenantId),
  })
);

// Cermin 0084_mfa_hardening.sql — bentuk kanonik DATA_MODEL §3 (penutup SEC-14).
// `credentialEncrypted` hari ini menyimpan secret base32 MENTAH: pembungkusan AES-GCM
// menunggu KMS/0035. Jangan menyebutnya terenkripsi di proyeksi mana pun.
export const mfaFactors = pgTable(
  'mfa_factors',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().$type<'totp' | 'webauthn' | 'sms'>(),
    label: text('label'),
    credentialEncrypted: bytea('credential_encrypted').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    userIdx: index('idx_mfa_factors_user').on(table.userId),
  })
);

// Tantangan MFA SEKALI PAKAI (API_SPEC §2.3 baris 144 syarat ke-4; DATA_MODEL §3).
// Token `<tenant>.<random>` tidak pernah disimpan — hanya SHA-256 random-nya.
export const mfaChallenges = pgTable(
  'mfa_challenges',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    challengeHash: text('challenge_hash').notNull().unique(),
    factorId: uuid('factor_id').references(() => mfaFactors.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    outcome: text('outcome')
      .notNull()
      .default('PENDING')
      .$type<'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'>(),
  },
  (table) => ({
    userIdx: index('idx_mfa_challenges_user').on(table.userId, table.createdAt),
  })
);

// Cermin migrasi 0083_impersonation_grants.sql (DATA_MODEL §26.12, FR-ADM-13, DoD R-1 §1.7).
// Satu tabel untuk dua mekanisme (vonis RD-32): `grant_kind` membedakan grant platform
// (dukungan terawasi) dari impersonation tenant. TTL maksimum 30 menit ditegakkan CHECK di DB.
export const impersonationGrants = pgTable(
  'impersonation_grants',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    grantKind: text('grant_kind')
      .notNull()
      .default('TENANT_IMPERSONATION')
      .$type<'PLATFORM_SUPPORT' | 'TENANT_IMPERSONATION'>(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason').notNull(),
    ticketId: uuid('ticket_id'),
    scope: text('scope').notNull().default('READ_ONLY').$type<'READ_ONLY' | 'HELPDESK_REPAIR'>(),
    mfaVerifiedAt: timestamp('mfa_verified_at', { withTimezone: true }).notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endReason: text('end_reason'),
    state: text('state')
      .notNull()
      .default('REQUESTED')
      .$type<'REQUESTED' | 'GRANTED' | 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'REVOKED'>(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => ({
    activeIdx: index('idx_imperson_active').on(table.tenantId, table.state, table.expiresAt),
  })
);
