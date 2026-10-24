/**
 * Layanan rute `/api/v1/platform/**` (M-01, API_SPEC §4.20; DoD `R-1` §1.7).
 *
 * Empat aturan yang membentuk file ini:
 *  1. Target tenant SELALU diselesaikan dari barisnya di dalam transaksi, lalu
 *     `SET LOCAL app.current_tenant` — `x-tenant-id` klien tidak pernah menentukan
 *     (ralat `SEC-07`, norma `DATA_MODEL §6.2` "Tulisan platform lintas tenant").
 *  2. Setiap tulis memancarkan satu baris `audit_logs` ber-rantai (I-1) — termasuk
 *     setiap BACA lintas-tenant (alasan wajib, `SECURITY §13`).
 *  3. Provisioning = SATU transaksi: tidak ada tenant yatim bila admin gagal
 *     (edge case §1.6-1). Kegagalan apa pun → 409 dan nol baris bertahan (`AC-PLT-1`).
 *  4. Peran/izin dibaca dari tabel (`user_role_assignments`), bukan label carrier.
 */
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt, sql } from '@sica/database';
import { SYSTEM_ROLE_GRANTS, SYSTEM_ROLE_SEED } from '@sica/contracts';
import {
  db,
  withTenantContext,
  tenants,
  tenantDomains,
  tenantQuotas,
  subscriptions,
  users,
  tenantMemberships,
  roles,
  rolePermissions,
  permissions,
  userRoleAssignments,
  modules,
  tenantModules,
  idempotencyKeys,
  impersonationGrants,
  auditLogs,
  type TenantTx,
} from '@sica/database';
import { createPasswordHasher } from '@/modules/auth/services/password.service';
import { appendAuditEntry } from '@/modules/audit/services/audit.service';
import type {
  ProvisionTenantRequest,
  UpdateTenantQuotasRequest,
  CreateImpersonationGrantRequest,
  CrossTenantAuditQuery,
  AuditEventView,
} from '@sica/contracts';

export type PlatformServiceError =
  | { readonly kind: 'TENANT_PROVISION_FAILED'; readonly cause: string }
  | { readonly kind: 'TENANT_NOT_FOUND' }
  | { readonly kind: 'TENANT_ARCHIVED' }
  | { readonly kind: 'TRANSITION_INVALID'; readonly from: string; readonly to: string }
  | { readonly kind: 'ADMIN_EMAIL_TAKEN' }
  | { readonly kind: 'SLUG_TAKEN' }
  | { readonly kind: 'NO_ROLE_TEMPLATE' }
  | { readonly kind: 'GRANT_NOT_FOUND' }
  | { readonly kind: 'TARGET_NOT_MEMBER' }
  | { readonly kind: 'MODULE_UNKNOWN'; readonly code: string };

type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: PlatformServiceError };

/**
 * Kegagalan validasi provisioning WAJIB membatalkan transaksi (`AC-PLT-1`: nol baris
 * bertahan). Karena `withTenantContext` hanya rollback saat callback melempar, galat
 * domain dibungkus kelas ini — bukan `return {ok:false}` yang akan ikut ter-commit.
 */
class ProvisionFailure extends Error {
  constructor(readonly detail: PlatformServiceError) {
    super(detail.kind);
  }
}

const hasher = () => createPasswordHasher(process.env['PASSWORD_HASH_PEPPER'] ?? '');

function canonicalFingerprint(body: unknown): Buffer {
  return createHash('sha256').update(JSON.stringify(body)).digest();
}

/** Peran kampus standar yang ditanamkan ke tenant baru (PLATFORM_OPERATOR bukan peran kampus). */
const CAMPUS_ROLE_SEED = SYSTEM_ROLE_SEED.filter((r) => r.code !== 'PLATFORM_OPERATOR');

// ============================================================================
// Provisioning (POST /platform/tenants) — satu transaksi, nol tenant yatim
// ============================================================================
export async function provisionTenant(
  operator: { readonly tenantId: string; readonly userId: string },
  req: ProvisionTenantRequest,
  idempotencyKey: string
): Promise<Result<ProvisionTenantResponse>> {
  const newTenantId = randomUUID();
  const adminUserId = randomUUID();

  try {
    return await withTenantContext(operator.tenantId, async (tx) =>
      runProvision(tx, operator, req, idempotencyKey, newTenantId, adminUserId)
    );
  } catch (error) {
    if (error instanceof ProvisionFailure) return { ok: false, error: error.detail };
    throw error;
  }
}

export interface ProvisionTenantResponse {
  readonly tenantId: string;
  readonly slug: string;
  readonly status: 'ONBOARDING';
  readonly adminUserId: string;
  readonly rolesSeeded: number;
  readonly modulesActivated: number;
}

async function runProvision(
  tx: TenantTx,
  operator: { tenantId: string; userId: string },
  req: ProvisionTenantRequest,
  idempotencyKey: string,
  newTenantId: string,
  adminUserId: string
): Promise<Result<ProvisionTenantResponse>> {
  // ── Idempotensi (0012 `idempotency_keys`; §4.20 "Idempotency-Key wajib") ──
  const fingerprint = canonicalFingerprint(req);
  const existing = await tx
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.tenantId, operator.tenantId), eq(idempotencyKeys.key, idempotencyKey)))
    .limit(1);
  const prior = existing[0];
  if (prior) {
    if (!Buffer.from(prior.requestFingerprint).equals(fingerprint)) {
      throw new ProvisionFailure({ kind: 'TENANT_PROVISION_FAILED', cause: 'Idempotency-Key dipakai dengan isi berbeda.' });
    }
    if (prior.completedAt && prior.responseBody && prior.responseStatus === 201) {
      return { ok: true, value: prior.responseBody as ProvisionTenantResponse };
    }
    throw new ProvisionFailure({ kind: 'TENANT_PROVISION_FAILED', cause: 'Permintaan dengan kunci sama masih berjalan.' });
  }
  await tx.insert(idempotencyKeys).values({
    tenantId: operator.tenantId,
    key: idempotencyKey,
    requestFingerprint: fingerprint,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });

  // ── Cek pra-kondisi ──
  const slugTaken = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, req.slug)).limit(1);
  if (slugTaken.length > 0) throw new ProvisionFailure({ kind: 'SLUG_TAKEN' });
  const emailTaken = await tx.select({ id: users.id }).from(users).where(eq(users.email, req.adminEmail)).limit(1);
  if (emailTaken.length > 0) throw new ProvisionFailure({ kind: 'ADMIN_EMAIL_TAKEN' });

  // Katalog peran & grant dibaca dari KONSTANTA kontrak (bukan baris tenant contoh):
  // RLS melarang membaca peran tenant lain, jadi "template tenant" bukan sumber yang sah.
  const grantCodes = [...new Set(CAMPUS_ROLE_SEED.flatMap((r) => SYSTEM_ROLE_GRANTS[r.code] ?? []))];
  const permissionRows = grantCodes.length
    ? await tx.select({ id: permissions.id, code: permissions.code }).from(permissions)
    : [];
  const permissionByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

  // Modul yang diminta harus ada (P-10: tanpa baris katalog → tolak, jangan aktifkan hantu).
  let moduleRows: Array<{ id: string; code: string }> = [];
  if (req.moduleCodes.length > 0) {
    moduleRows = await tx
      .select({ id: modules.id, code: modules.code })
      .from(modules)
      .where(inArray(modules.code, req.moduleCodes));
    const known = new Set(moduleRows.map((m) => m.code));
    const unknown = req.moduleCodes.find((c) => !known.has(c));
    if (unknown) throw new ProvisionFailure({ kind: 'MODULE_UNKNOWN', code: unknown });
  }

  // ── Tulis: akar global (RLS-free) ──
  await tx.insert(tenants).values({ id: newTenantId, slug: req.slug, legalName: req.legalName, status: 'ONBOARDING' });

  const baseDomain = process.env['PLATFORM_DOMAIN_BASE'] ?? 'platform.local';
  await tx.insert(tenantDomains).values({
    id: randomUUID(),
    tenantId: newTenantId,
    hostname: `${req.slug}.${baseDomain}`,
    isPrimary: true,
    verifiedAt: new Date(),
  });

  const passwordHash = await hasher().hash(req.adminInitialPassword);
  await tx.insert(users).values({
    id: adminUserId,
    email: req.adminEmail,
    fullName: req.adminFullName,
    passwordHash,
    status: 'ACTIVE',
  });

  if (req.planId) {
    await tx.insert(subscriptions).values({
      id: randomUUID(),
      tenantId: newTenantId,
      planId: req.planId,
      status: 'TRIAL',
      seatsStudent: 0,
      billingAnchor: new Date().toISOString().slice(0, 10),
      startsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 30 * 86_400_000),
    });
  }

  // ── Pindah konteks GUC ke tenant BARU: seluruh tabel ber-`tenant_id` di bawahnya ──
  await tx.execute(sql`SELECT set_config('app.current_tenant', ${newTenantId}, true)`);

  await tx.insert(tenantQuotas).values({ tenantId: newTenantId });

  const roleIds = new Map<string, string>();
  for (const r of CAMPUS_ROLE_SEED) {
    const id = randomUUID();
    roleIds.set(r.code, id);
    await tx.insert(roles).values({
      id,
      tenantId: newTenantId,
      code: r.code,
      displayName: r.displayName,
      scopeKind: r.scopeKind,
      isSystem: true,
    });
  }
  for (const r of CAMPUS_ROLE_SEED) {
    const roleId = roleIds.get(r.code);
    if (!roleId) continue;
    for (const code of SYSTEM_ROLE_GRANTS[r.code] ?? []) {
      const permissionId = permissionByCode.get(code);
      if (!permissionId) continue;
      await tx
        .insert(rolePermissions)
        .values({ tenantId: newTenantId, roleId, permissionId })
        .onConflictDoNothing();
    }
  }

  await tx.insert(tenantMemberships).values({
    id: randomUUID(),
    tenantId: newTenantId,
    userId: adminUserId,
    memberCode: req.initialMemberCode ?? 'ADMIN01',
    status: 'ACTIVE',
    role: 'tenant_admin',
  });
  const adminRoleId = roleIds.get('TENANT_ADMIN');
  if (!adminRoleId) throw new ProvisionFailure({ kind: 'NO_ROLE_TEMPLATE' });
  await tx.insert(userRoleAssignments).values({
    id: randomUUID(),
    tenantId: newTenantId,
    userId: adminUserId,
    roleId: adminRoleId,
    origin: 'SEED',
  });

  let activated = 0;
  for (const m of moduleRows) {
    await tx
      .insert(tenantModules)
      .values({ id: randomUUID(), tenantId: newTenantId, moduleId: m.id, status: 'ACTIVE' })
      .onConflictDoNothing();
    activated += 1;
  }

  const value: ProvisionTenantResponse = {
    tenantId: newTenantId,
    slug: req.slug,
    status: 'ONBOARDING',
    adminUserId,
    rolesSeeded: CAMPUS_ROLE_SEED.length,
    modulesActivated: activated,
  };

  await appendAuditEntry(tx, {
    tenantId: newTenantId,
    actorUserId: operator.userId,
    actorRoleCtx: { via: 'platform', operatorTenantId: operator.tenantId },
    targetEntity: 'tenants',
    targetId: newTenantId,
    action: 'platform.tenant.provision',
    after: value,
    reason: req.reason,
  });

  await tx
    .update(idempotencyKeys)
    .set({ responseStatus: 201, responseBody: value, completedAt: new Date() })
    .where(and(eq(idempotencyKeys.tenantId, operator.tenantId), eq(idempotencyKeys.key, idempotencyKey)));

  return { ok: true, value };
}

// ============================================================================
// Transisi status (suspend / reinstate) — §4.20, status SERVER_ONLY
// ============================================================================
export async function transitionTenantStatus(
  operator: { readonly tenantId: string; readonly userId: string },
  targetTenantId: string,
  to: 'SUSPENDED' | 'ACTIVE',
  reason: string
): Promise<Result<{ tenantId: string; status: string }>> {
  const rows = await db.select({ id: tenants.id, status: tenants.status }).from(tenants).where(eq(tenants.id, targetTenantId)).limit(1);
  const target = rows[0];
  if (!target) return { ok: false, error: { kind: 'TENANT_NOT_FOUND' } };
  if (target.status === 'ARCHIVED') return { ok: false, error: { kind: 'TENANT_ARCHIVED' } };
  const allowed = (to === 'SUSPENDED' && target.status === 'ACTIVE') || (to === 'ACTIVE' && target.status === 'SUSPENDED');
  if (!allowed) return { ok: false, error: { kind: 'TRANSITION_INVALID', from: target.status, to } };

  await withTenantContext(targetTenantId, async (tx) => {
    await tx.update(tenants).set({ status: to, updatedAt: new Date() }).where(eq(tenants.id, targetTenantId));
    await appendAuditEntry(tx, {
      tenantId: targetTenantId,
      actorUserId: operator.userId,
      actorRoleCtx: { via: 'platform', operatorTenantId: operator.tenantId },
      targetEntity: 'tenants',
      targetId: targetTenantId,
      action: to === 'SUSPENDED' ? 'platform.tenant.suspend' : 'platform.tenant.reinstate',
      before: { status: target.status },
      after: { status: to },
      reason,
    });
  });

  return { ok: true, value: { tenantId: targetTenantId, status: to } };
}

// ============================================================================
// Kuota (PUT /platform/tenants/:id/quotas) — read-your-writes ke Primary
// ============================================================================
export async function updateTenantQuotas(
  operator: { readonly tenantId: string; readonly userId: string },
  targetTenantId: string,
  req: UpdateTenantQuotasRequest
): Promise<Result<unknown>> {
  const exists = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, targetTenantId)).limit(1);
  if (exists.length === 0) return { ok: false, error: { kind: 'TENANT_NOT_FOUND' } };

  const patch = req.quotas as Record<string, number | undefined>;
  await withTenantContext(targetTenantId, async (tx) => {
    const before = await tx.select().from(tenantQuotas).where(eq(tenantQuotas.tenantId, targetTenantId)).limit(1);
    await tx
      .insert(tenantQuotas)
      .values({ tenantId: targetTenantId, ...patch })
      .onConflictDoUpdate({ target: tenantQuotas.tenantId, set: patch });
    await appendAuditEntry(tx, {
      tenantId: targetTenantId,
      actorUserId: operator.userId,
      actorRoleCtx: { via: 'platform', operatorTenantId: operator.tenantId },
      targetEntity: 'tenant_quotas',
      targetId: targetTenantId,
      action: 'platform.quota.update',
      before: before[0] ?? null,
      after: patch,
      reason: req.reason,
    });
  });

  const after = await withTenantContext(targetTenantId, async (tx) =>
    tx.select().from(tenantQuotas).where(eq(tenantQuotas.tenantId, targetTenantId)).limit(1)
  );
  return { ok: true, value: after[0] ?? null };
}

// ============================================================================
// Grant dukungan terawasi (0083) — §4.20 baris impersonation-grants
// ============================================================================
export async function createImpersonationGrant(
  operator: { readonly tenantId: string; readonly userId: string },
  req: CreateImpersonationGrantRequest
): Promise<Result<unknown>> {
  // Target diselesaikan dari baris — slug ATAU id, keduanya dibuktikan sebelum tulis.
  const targetRows = req.targetTenantId
    ? await db.select({ id: tenants.id, status: tenants.status }).from(tenants).where(eq(tenants.id, req.targetTenantId)).limit(1)
    : await db.select({ id: tenants.id, status: tenants.status }).from(tenants).where(eq(tenants.slug, req.targetTenantSlug ?? '')).limit(1);
  const target = targetRows[0];
  if (!target) return { ok: false, error: { kind: 'TENANT_NOT_FOUND' } };
  if (target.status === 'SUSPENDED' || target.status === 'ARCHIVED') {
    return { ok: false, error: { kind: 'TRANSITION_INVALID', from: target.status, to: 'GRANT' } };
  }

  const grantId = randomUUID();
  const ttlMinutes = Math.min(req.ttlMinutes, 30);

  const created = await withTenantContext(target.id, async (tx) => {
    const member = await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, target.id), eq(tenantMemberships.userId, req.targetUserId)))
      .limit(1);
    if (member.length === 0) return null;

    const values = {
      id: grantId,
      tenantId: target.id,
      grantKind: 'PLATFORM_SUPPORT' as const,
      actorUserId: operator.userId,
      targetUserId: req.targetUserId,
      reason: req.reason,
      ticketId: req.ticketId ?? null,
      scope: req.scope,
      // Semua ambang waktu dihitung DI DB (`now() + …`) — CHECK `0083` membandingkan
      // kolom-kolom ini satu sama lain; jam proses Node tidak boleh jadi acuan (db-clock).
      mfaVerifiedAt: sql`now()`,
      requestedAt: sql`now()`,
      grantedBy: operator.userId,
      grantedAt: sql`now()`,
      startsAt: sql`now()`,
      expiresAt: sql`now() + (${ttlMinutes}::int * interval '1 minute')`,
      state: 'ACTIVE' as const,
    };
    await tx.insert(impersonationGrants).values(values as never);
    await appendAuditEntry(tx, {
      tenantId: target.id,
      actorUserId: operator.userId,
      actorRoleCtx: { via: 'platform', operatorTenantId: operator.tenantId, grantKind: 'PLATFORM_SUPPORT' },
      targetEntity: 'impersonation_grants',
      targetId: grantId,
      action: 'identity.impersonation.grant',
      after: { scope: req.scope, ttlMinutes, targetUserId: req.targetUserId },
      reason: req.reason,
    });
    return { grantId, tenantId: target.id, grantKind: 'PLATFORM_SUPPORT', scope: req.scope, state: 'ACTIVE', reason: req.reason, expiresAt: new Date(Date.now() + ttlMinutes * 60_000).toISOString() };
  });

  if (!created) return { ok: false, error: { kind: 'TARGET_NOT_MEMBER' } };
  return { ok: true, value: created };
}

export async function revokeImpersonationGrant(
  operator: { readonly tenantId: string; readonly userId: string },
  grantId: string,
  targetTenantId: string,
  reason: string
): Promise<Result<unknown>> {
  const ended = await withTenantContext(targetTenantId, async (tx) => {
    const rows = await tx.select().from(impersonationGrants).where(eq(impersonationGrants.id, grantId)).limit(1);
    const grant = rows[0];
    if (!grant) return null;
    await tx
      .update(impersonationGrants)
      .set({ state: 'REVOKED', endedAt: new Date(), endReason: reason })
      .where(eq(impersonationGrants.id, grantId));
    await appendAuditEntry(tx, {
      tenantId: targetTenantId,
      actorUserId: operator.userId,
      targetEntity: 'impersonation_grants',
      targetId: grantId,
      action: 'identity.impersonation.revoke',
      before: { state: grant.state },
      after: { state: 'REVOKED' },
      reason,
    });
    return { grantId, state: 'REVOKED' };
  });
  if (!ended) return { ok: false, error: { kind: 'GRANT_NOT_FOUND' } };
  return { ok: true, value: ended };
}

// ============================================================================
// Baca jejak audit lintas-tenant (§4.21 baris platform) — setiap baca diaudit
// ============================================================================
export async function readCrossTenantAudit(
  operator: { readonly tenantId: string; readonly userId: string },
  q: CrossTenantAuditQuery
): Promise<Result<{ rows: readonly AuditEventView[]; total: number }>> {
  const target = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, q.tenantId)).limit(1);
  if (target.length === 0) return { ok: false, error: { kind: 'TENANT_NOT_FOUND' } };

  const from = q.from ? new Date(q.from) : new Date(Date.UTC(2020, 0, 1));
  const to = q.to ? new Date(q.to) : new Date(Date.now() + 86_400_000);
  const offset = (q.page - 1) * q.limit;

  const result = await withTenantContext(q.tenantId, async (tx) => {
    const filters = [
      eq(auditLogs.tenantId, q.tenantId),
      gte(auditLogs.occurredAt, from),
      lt(auditLogs.occurredAt, to),
      ...(q.action ? [eq(auditLogs.action, q.action)] : []),
      ...(q.targetEntity ? [eq(auditLogs.targetEntity, q.targetEntity)] : []),
    ];
    const where = and(...filters);

    const rows = await tx
      .select({
        id: auditLogs.id,
        tenantId: auditLogs.tenantId,
        actorUserId: auditLogs.actorUserId,
        targetEntity: auditLogs.targetEntity,
        targetId: auditLogs.targetId,
        action: auditLogs.action,
        reason: auditLogs.reason,
        occurredAt: auditLogs.occurredAt,
        hash: auditLogs.hash,
        prevHash: auditLogs.prevHash,
      })
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.occurredAt), asc(auditLogs.id))
      .limit(q.limit)
      .offset(offset);

    const counted = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where);

    await appendAuditEntry(tx, {
      tenantId: q.tenantId,
      actorUserId: operator.userId,
      actorRoleCtx: { via: 'platform', operatorTenantId: operator.tenantId },
      targetEntity: 'audit_logs',
      action: 'audit.cross_tenant.read',
      after: { page: q.page, limit: q.limit, filters: { action: q.action ?? null, targetEntity: q.targetEntity ?? null } },
      reason: q.reason,
    });

    return { rows, total: Number(counted[0]?.n ?? 0) };
  });

  return {
    ok: true,
    value: {
      total: result.total,
      rows: result.rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        actorUserId: r.actorUserId ?? null,
        targetEntity: r.targetEntity,
        targetId: r.targetId ?? null,
        action: r.action,
        reason: r.reason ?? null,
        occurredAt: r.occurredAt.toISOString(),
        hash: Buffer.from(r.hash).toString('hex'),
        prevHash: r.prevHash ? Buffer.from(r.prevHash).toString('hex') : null,
      })),
    },
  };
}
