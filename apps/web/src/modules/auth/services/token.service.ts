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
