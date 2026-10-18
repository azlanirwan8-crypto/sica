/**
 * Password Hashing Service — SICA Auth
 *
 * Interface `PasswordHasher` supaya implementasi bisa ditukar tanpa mengubah call-site.
 * - `ScryptPasswordHasher` (aktif sekarang): memakai Node built-in crypto → TERPASANG &
 *   teruji tanpa instalasi dependensi eksternal.
 * - `Argon2idPasswordHasher` (target produksi, SECURITY_COMPLIANCE): butuh paket `argon2`;
 *   diaktifkan setelah `pnpm install` (lihat catatan pada Argon2PasswordHasher).
 * Pepper (PASSWORD_HASH_PEPPER) digabung ke password sebelum KDF → pertahanan berlapis.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export interface PasswordHasher {
  readonly scheme: string;
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
  needsRehash(storedHash: string): boolean;
}

const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p
const SCRYPT_KEYLEN = 32;
const CURRENT_SCRYPT_VERSION = 'scrypt-v1';

function mixPepper(password: string, pepper: string): Buffer {
  // pepper opsional; bila kosong tetap aman (hanya tanpa lapisan ekstra).
  return Buffer.from(`${pepper}\u0000${password}`, 'utf8');
}

export class ScryptPasswordHasher implements PasswordHasher {
  readonly scheme = CURRENT_SCRYPT_VERSION;
  private readonly pepper: string;

  constructor(pepper = '') {
    this.pepper = pepper;
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = scryptSync(mixPepper(password, this.pepper), salt, SCRYPT_KEYLEN, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELISM,
      maxmem: 128 * SCRYPT_COST * SCRYPT_BLOCK_SIZE * 2,
    });
    const saltB64 = salt.toString('base64');
    const hashB64 = derived.toString('base64');
    return [
      CURRENT_SCRYPT_VERSION,
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELISM,
      saltB64,
      hashB64,
    ].join('$');
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const segments = storedHash.split('$');
    if (segments.length !== 6 || segments[0] !== CURRENT_SCRYPT_VERSION) return false;
    const [, nStr, rStr, pStr, saltB64, hashB64] = segments;
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = Buffer.from(saltB64 ?? '', 'base64');
    const expected = Buffer.from(hashB64 ?? '', 'base64');
    const derived = scryptSync(mixPepper(password, this.pepper), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    });
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }

  needsRehash(storedHash: string): boolean {
    return !storedHash.startsWith(`${CURRENT_SCRYPT_VERSION}$`);
  }
}

/**
 * Target produksi: argon2id (RFC 9106). Uncomment & tambahkan dependensi "argon2"
 * setelah `pnpm install` berhasil, lalu aktifkan sebagai default hasher.
 *
 * import argon2 from 'argon2';
 * export class Argon2idPasswordHasher implements PasswordHasher {
 *   readonly scheme = 'argon2id';
 *   constructor(private readonly pepper = '') {}
 *   async hash(pw) {
 *     return argon2.hash(`${this.pepper}\u0000${pw}`, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
 *   }
 *   async verify(pw, stored) { return argon2.verify(stored, `${this.pepper}\u0000${pw}`); }
 *   needsRehash(stored) { return !stored.startsWith('$argon2'); }
 * }
 */

export function createPasswordHasher(pepper = ''): PasswordHasher {
  // Default interim sampai dependensi argon2 terpasang.
  return new ScryptPasswordHasher(pepper);
}
