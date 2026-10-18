/**
 * Token Service — opaque refresh token & hashing (Node built-in crypto)
 *
 * Refresh token disimpan sebagai SHA-256 hash (refresh_tokens.token_hash bytea),
 * nilai mentah hanya sekali ke klien. Reuse detection memakai family_id.
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

const REFRESH_TOKEN_BYTES = 32;

/** Token opaque (base64url) yang dikirim ke klien; tidak pernah disimpan mentah. */
export function generateOpaqueToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/**
 * Refresh token berformat `rt_<tenantId>.<random>`. Payload acak tetap opaque;
 * prefix tenant (bukan rahasia) memungkinkan server menyetel konteks RLS untuk
 * lookup `refresh_tokens` (yang tenant-scoped) dalam satu hop — web & mobile seragam.
 */
export function issueRefreshToken(tenantId: string): string {
  return `rt_${tenantId}.${generateOpaqueToken()}`;
}

/** Ekstrak tenantId dari refresh token berformat `rt_<uuid>.<random>`; null bila tak cocok. */
export function parseRefreshTokenTenant(token: string): string | null {
  if (!token.startsWith('rt_')) return null;
  const rest = token.slice(3);
  const dot = rest.indexOf('.');
  if (dot <= 0) return null;
  const uuid = rest.slice(0, dot);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
    ? uuid
    : null;
}

export function newFamilyId(): string {
  return randomUUID();
}

/** Hash SHA-256 (hex) untuk penyimpanan di DB. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Perbandingan konstan-time; aman untuk verifikasi hash/token. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
