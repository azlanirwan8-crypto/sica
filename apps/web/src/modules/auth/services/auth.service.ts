/**
 * Auth Service — alur login nyata berbasis database (menutup AUD-03).
 *
 * Alur: resolve tenant (slug/host) → cari user+membership (per-tenant, RLS) →
 * verifikasi hash sandi (PasswordHasher) → cek status & lock → persist `sessions`
 * + `refresh_tokens` (hash) → *sign* akses token RS256 dgn klaim sid. Config DI-inject
 * agar service tak membaca process.env (ENV_CONTRACT §1) & mudah diuji.
 * Rujukan: SECURITY_COMPLIANCE §2.2, DATA_MODEL §7.
 */
import { and, eq, or } from '@sica/database';
import { db, withTenantContext } from '@sica/database';
import {
  tenants,
  users,
  tenantMemberships,
  sessions,
  refreshTokens,
} from '@sica/database';
import { signJwt } from './jwt.service';
import { createPasswordHasher } from './password.service';
import { generateOpaqueToken, issueRefreshToken, newFamilyId, hashToken, parseRefreshTokenTenant } from './token.service';

export interface AuthRuntimeConfig {
  readonly privateKeyPem: string;
  readonly issuer: string;
  readonly audience: string;
  readonly accessTtlSec: number;
  readonly refreshTtlSec: number;
  readonly pepper: string;
}

export interface LoginPrincipal {
  readonly userId: string;
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly role: string;
  readonly fullName: string;
  readonly email: string;
}

export type AuthErrorCode = 'INVALID_TENANT' | 'BAD_CREDENTIALS' | 'LOCKED' | 'DISABLED' | 'CONFIG_MISSING';

export type AuthenticateResult =
  | {
      readonly ok: true;
      readonly requireMfa: false;
      readonly principal: LoginPrincipal;
      readonly sessionId: string;
      readonly accessToken: string;
      readonly refreshToken: string;
      readonly expiresInSeconds: number;
    }
  | { readonly ok: true; readonly requireMfa: true; readonly mfaToken: string }
  | { readonly ok: false; readonly code: AuthErrorCode };

interface MatchedRow {
  userId: string;
  email: string;
  fullName: string;
  userStatus: string;
  passwordHash: string | null;
  mfaRequired: boolean;
  lockedUntil: Date | null;
  role: string;
  membershipStatus: string;
}

function nowPlusSeconds(sec: number): Date {
  return new Date(Date.now() + sec * 1000);
}

/** Cari users+tenant_memberships untuk satu tenant via email ATAU member_code. */
async function findPrincipal(tenantId: string, identifier: string): Promise<MatchedRow | null> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select({
        userId: users.id,
        email: users.email,
        fullName: users.fullName,
        userStatus: users.status,
        passwordHash: users.passwordHash,
        mfaRequired: users.mfaRequired,
        lockedUntil: users.lockedUntil,
        role: tenantMemberships.role,
        membershipStatus: tenantMemberships.status,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          or(eq(users.email, identifier), eq(tenantMemberships.memberCode, identifier))
        )
      )
      .limit(1);
    return (rows[0] as MatchedRow) ?? null;
  });
}

export async function authenticate(
  tenantIdentifier: string,
  username: string,
  password: string,
  config: AuthRuntimeConfig
): Promise<AuthenticateResult> {
  if (!config.privateKeyPem || !config.pepper) {
    return { ok: false, code: 'CONFIG_MISSING' };
  }

  // 1. Resolve tenant (slug; subdomain dinormalisasi huruf kecil). Bukan tabel RLS.
  const tenantRows = await db
    .select({ id: tenants.id, slug: tenants.slug, status: tenants.status })
    .from(tenants)
    .where(eq(tenants.slug, tenantIdentifier.toLowerCase()))
    .limit(1);
  const tenant = tenantRows[0] as
    | { id: string; slug: string; status: string }
    | undefined;
  if (!tenant) return { ok: false, code: 'INVALID_TENANT' };
  if (tenant.status !== 'ACTIVE') return { ok: false, code: 'DISABLED' };

  // 2. Cari principal (user + membership) dlm konteks tenant (RLS).
  const match = await findPrincipal(tenant.id, username);
  const hasher = createPasswordHasher(config.pepper);

  // Samakan biaya waktu utk user tak dikenal (anti user-enumeration timing).
  if (!match || !match.passwordHash) {
    await hasher.verify(password, 'scrypt-v1$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    return { ok: false, code: 'BAD_CREDENTIALS' };
  }

  // 3. Verifikasi sandi.
  const passwordOk = await hasher.verify(password, match.passwordHash);
  if (!passwordOk) return { ok: false, code: 'BAD_CREDENTIALS' };

  // 4. Status & lock gate.
  if (match.userStatus !== 'ACTIVE' || match.membershipStatus !== 'ACTIVE') {
    return { ok: false, code: 'DISABLED' };
  }
  if (match.lockedUntil && match.lockedUntil.getTime() > Date.now()) {
    return { ok: false, code: 'LOCKED' };
  }

  // 5. MFA wajib → keluarkan challenge, sesi penuh belum dibuat.
  if (match.mfaRequired) {
    return { ok: true, requireMfa: true, mfaToken: generateOpaqueToken() };
  }

  // 6. Buat sesi + refresh token + akses token JWT (dalam konteks tenant utk INSERT RLS).
  const sessionId = crypto.randomUUID();
  const familyId = newFamilyId();
  const rawRefresh = issueRefreshToken(tenant.id);
  const refreshHash = hashToken(rawRefresh);
  const sessionExpiry = nowPlusSeconds(config.refreshTtlSec);

  const accessToken = signJwt(
    { sub: match.userId, tid: tenant.id, sid: sessionId, role: match.role },
    {
      privateKeyPem: config.privateKeyPem,
      issuer: config.issuer,
      audience: config.audience,
      ttlSeconds: config.accessTtlSec,
    }
  );

  await withTenantContext(tenant.id, async (tx) => {
    await tx.insert(sessions).values({
      id: sessionId,
      tenantId: tenant.id,
      userId: match.userId,
      roleCtx: { role: match.role },
      authMethod: 'password',
      expiresAt: sessionExpiry,
    });
    await tx.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      userId: match.userId,
      sessionId,
      tokenHash: refreshHash,
      familyId,
      expiresAt: sessionExpiry,
    });
    await tx
      .update(users)
      .set({ lastLoginAt: new Date(), failedAttempts: 0 })
      .where(eq(users.id, match.userId));
  });

  return {
    ok: true,
    requireMfa: false,
    principal: {
      userId: match.userId,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: match.role,
      fullName: match.fullName,
      email: match.email,
    },
    sessionId,
    accessToken,
    refreshToken: rawRefresh,
    expiresInSeconds: config.accessTtlSec,
  };
}

// =============================================================================
// Refresh (rotasi + reuse-detection family) & Logout (revokasi sesi)
// Rujukan: SECURITY_COMPLIANCE §2.2 (NIST 800-63B reuse detection).
// =============================================================================

export type RefreshErrorCode =
  | 'INVALID_TOKEN'
  | 'REUSE_DETECTED'
  | 'EXPIRED'
  | 'SESSION_REVOKED'
  | 'DISABLED'
  | 'CONFIG_MISSING';

export type RefreshResult =
  | {
      readonly ok: true;
      readonly accessToken: string;
      readonly refreshToken: string;
      readonly expiresInSeconds: number;
    }
  | { readonly ok: false; readonly code: RefreshErrorCode };

interface RefreshRow {
  id: string;
  sessionId: string;
  userId: string;
  familyId: string;
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

/**
 * Tukar refresh token (single-use) dengan pasangan baru pada family yang sama.
 * Deteksi-reuse: token lama yang dipakai ulang → cabut SELURUH family.
 */
export async function rotateRefreshToken(
  rawRefresh: string,
  config: AuthRuntimeConfig
): Promise<RefreshResult> {
  if (!config.privateKeyPem) return { ok: false, code: 'CONFIG_MISSING' };
  const tenantId = parseRefreshTokenTenant(rawRefresh);
  if (!tenantId) return { ok: false, code: 'INVALID_TOKEN' };
  const tokenHash = hashToken(rawRefresh);

  return withTenantContext(tenantId, async (tx): Promise<RefreshResult> => {
    const rows = await tx
      .select({
        id: refreshTokens.id,
        sessionId: refreshTokens.sessionId,
        userId: refreshTokens.userId,
        familyId: refreshTokens.familyId,
        usedAt: refreshTokens.usedAt,
        revokedAt: refreshTokens.revokedAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    const row = rows[0] as RefreshRow | undefined;
    if (!row) return { ok: false, code: 'INVALID_TOKEN' };

    // Reuse: token sudah pernah dipakai / sudah dicabut → cabut seluruh family.
    if (row.usedAt || row.revokedAt) {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.familyId, row.familyId));
      return { ok: false, code: 'REUSE_DETECTED' };
    }
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, code: 'EXPIRED' };

    // Sesi harus masih hidup.
    const sess = await tx
      .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, row.sessionId))
      .limit(1);
    const s = sess[0] as { revokedAt: Date | null; expiresAt: Date } | undefined;
    if (!s || s.revokedAt || s.expiresAt.getTime() < Date.now()) {
      return { ok: false, code: 'SESSION_REVOKED' };
    }

    // Role & status keanggotaan dibaca ulang (revocation hak akses pasca-login).
    const mem = await tx
      .select({ role: tenantMemberships.role, status: tenantMemberships.status })
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, row.userId)))
      .limit(1);
    const m = mem[0] as { role: string; status: string } | undefined;
    if (!m || m.status !== 'ACTIVE') return { ok: false, code: 'DISABLED' };

    // Konsumsi token lama (single-use) + terbitkan yang baru pada family sama.
    await tx.update(refreshTokens).set({ usedAt: new Date() }).where(eq(refreshTokens.id, row.id));
    const newRaw = issueRefreshToken(tenantId);
    await tx.insert(refreshTokens).values({
      id: crypto.randomUUID(),
      tenantId,
      userId: row.userId,
      sessionId: row.sessionId,
      tokenHash: hashToken(newRaw),
      familyId: row.familyId,
      rotatedFrom: row.id,
      expiresAt: nowPlusSeconds(config.refreshTtlSec),
    });

    const accessToken = signJwt(
      { sub: row.userId, tid: tenantId, sid: row.sessionId, role: m.role },
      {
        privateKeyPem: config.privateKeyPem,
        issuer: config.issuer,
        audience: config.audience,
        ttlSeconds: config.accessTtlSec,
      }
    );
    return { ok: true, accessToken, refreshToken: newRaw, expiresInSeconds: config.accessTtlSec };
  });
}

/** Cabut sesi + seluruh refresh token milik sesi tsb (logout). */
export async function revokeSession(tenantId: string, sessionId: string): Promise<void> {
  await withTenantContext(tenantId, async (tx) => {
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: 'logout' })
      .where(eq(sessions.id, sessionId));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.sessionId, sessionId));
  });
}

/** Logout via refresh token: resolve sesi & cabut family-nya. */
export async function revokeByRefreshToken(rawRefresh: string): Promise<boolean> {
  const tenantId = parseRefreshTokenTenant(rawRefresh);
  if (!tenantId) return false;
  const tokenHash = hashToken(rawRefresh);
  return withTenantContext(tenantId, async (tx): Promise<boolean> => {
    const rows = await tx
      .select({ sessionId: refreshTokens.sessionId, familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    const r = rows[0] as { sessionId: string; familyId: string } | undefined;
    if (!r) return false;
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: 'logout' })
      .where(eq(sessions.id, r.sessionId));
    await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.familyId, r.familyId));
    return true;
  });
}

