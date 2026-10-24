/**
 * MFA server-side (SEC-01; syarat pencabutan `501` API_SPEC §2.3 baris 144).
 *
 * Tantangan: token `<tenantId>.<random32hex>` — yang tersimpan hanya SHA-256 random,
 * sekali pakai (`consumed_at`), TTL ≤ 10 menit, tebak-kode dibatasi `attempts ≤ 5`
 * (CHECK di `0084`). Verifikasi TOTP memakai `totp.service` (RFC 6238, waktu-konstan).
 * Semua baca/tulis lewat `withTenantContext` → RLS `mfa_factors`/`mfa_challenges` (SEC-14).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, mfaChallenges, mfaFactors, sql, withTenantContext } from '@sica/database';
import { dbNowMs } from '@/lib/db-clock';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from './totp.service';


const MAX_ATTEMPTS = 5;

export type MfaChallengeOutcome =
  | { readonly ok: true; readonly userId: string; readonly factorId: string }
  | { readonly ok: false; readonly reason: 'CHALLENGE_INVALID' | 'CHALLENGE_EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'BAD_CODE' | 'NO_FACTOR' };

function hashChallenge(randomHex: string): string {
  return createHash('sha256').update(randomHex).digest('hex');
}

/**
 * Buat tantangan MFA untuk sesi login yang mewajibkannya.
 * Dipanggil HANYA setelah sandi benar (auth.service) — tantangan tanpa kredensial
 * akan menjadi kanal enumerasi akun.
 */
export async function createMfaChallenge(tenantId: string, userId: string): Promise<string> {
  const random = randomBytes(32).toString('hex');
  const id = randomUUID();
  await withTenantContext(tenantId, async (tx) => {
    // expires_at dihitung DI DATABASE (`now() + interval`) agar CHECK `0084`
    // tetap sah walau jam proses Node dan jam server tidak serumah.
    await tx.insert(mfaChallenges).values({
      id,
      tenantId,
      userId,
      challengeHash: hashChallenge(random),
      expiresAt: sql`now() + interval '5 minutes'`,
    });
  });
  return `${tenantId}.${random}`;
}

/** Verifikasi tantangan + kode; sukses = tantangan tersandang (sekali pakai). */
export async function verifyMfaChallenge(
  tenantId: string,
  mfaToken: string,
  totpCode: string
): Promise<MfaChallengeOutcome> {
  const [tokenTenant, random] = mfaToken.split('.');
  if (!tokenTenant || !random || tokenTenant !== tenantId || !/^[0-9a-f]{64}$/.test(random)) {
    return { ok: false, reason: 'CHALLENGE_INVALID' };
  }

  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(mfaChallenges)
      .where(and(eq(mfaChallenges.challengeHash, hashChallenge(random)), isNull(mfaChallenges.consumedAt)))
      .limit(1)
      .for('update');

    const challenge = rows[0];
    if (!challenge) return { ok: false, reason: 'CHALLENGE_INVALID' };
    if (challenge.expiresAt.getTime() < (await dbNowMs())) {
      await tx
        .update(mfaChallenges)
        .set({ outcome: 'EXPIRED', consumedAt: new Date() })
        .where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, reason: 'CHALLENGE_EXPIRED' };
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };
    }

    const factors = await tx
      .select()
      .from(mfaFactors)
      .where(
        and(
          eq(mfaFactors.userId, challenge.userId),
          eq(mfaFactors.kind, 'totp'),
          isNull(mfaFactors.revokedAt),
          gt(mfaFactors.verifiedAt, new Date(0))
        )
      )
      .limit(1);
    const factor = factors[0];
    if (!factor) return { ok: false, reason: 'NO_FACTOR' };

    const secret = Buffer.from(factor.credentialEncrypted).toString('utf8');
    const codeOk = verifyTotp(secret, totpCode);
    if (!codeOk) {
      await tx
        .update(mfaChallenges)
        .set({ attempts: challenge.attempts + 1, outcome: 'FAILED' })
        .where(eq(mfaChallenges.id, challenge.id));
      return { ok: false, reason: 'BAD_CODE' };
    }

    await tx
      .update(mfaChallenges)
      .set({ outcome: 'SUCCESS', consumedAt: new Date(), factorId: factor.id })
      .where(eq(mfaChallenges.id, challenge.id));
    await tx
      .update(mfaFactors)
      .set({ lastUsedAt: new Date() })
      .where(eq(mfaFactors.id, factor.id));

    return { ok: true, userId: challenge.userId, factorId: factor.id };
  });
}

export interface TotpEnrollment {
  readonly secret: string;
  readonly otpauthUri: string;
  readonly factorId: string;
}

/**
 * Daftar faktor TOTP baru (secret belum terbukti → `verified_at` kosong, belum wajib).
 * Secret hanya boleh keluar pada respons ini; setelah konfirmasi tidak ada jalur baca.
 */
export async function enrollTotpFactor(
  tenantId: string,
  userId: string,
  issuer: string,
  accountName: string
): Promise<TotpEnrollment> {
  const secret = generateTotpSecret();
  const factorId = randomUUID();
  await withTenantContext(tenantId, async (tx) => {
    await tx.insert(mfaFactors).values({
      id: factorId,
      tenantId,
      userId,
      kind: 'totp',
      label: 'Authenticator',
      credentialEncrypted: Buffer.from(secret, 'utf8'),
    });
  });
  return { secret, factorId, otpauthUri: buildOtpauthUri({ secret, accountName, issuer }) };
}

/** Konfirmasi kode pertama: faktor menjadi terbukti. Wajib sebelum `users.mfa_required` dipasang. */
export async function confirmTotpFactor(tenantId: string, userId: string, code: string): Promise<boolean> {
  return withTenantContext(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(mfaFactors)
      .where(
        and(
          eq(mfaFactors.userId, userId),
          eq(mfaFactors.kind, 'totp'),
          isNull(mfaFactors.revokedAt),
          isNull(mfaFactors.verifiedAt)
        )
      )
      .limit(1);
    const factor = rows[0];
    if (!factor) return false;
    const secret = Buffer.from(factor.credentialEncrypted).toString('utf8');
    if (!verifyTotp(secret, code)) return false;
    await tx
      .update(mfaFactors)
      .set({ verifiedAt: new Date(), lastUsedAt: new Date() })
      .where(eq(mfaFactors.id, factor.id));
    return true;
  });
}
