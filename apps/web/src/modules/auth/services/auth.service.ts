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
import { generateOpaqueToken, newFamilyId, hashToken } from './token.service';

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
  const rawRefresh = generateOpaqueToken();
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
