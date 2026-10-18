/**
 * Foundation Auth unit tests — JWT RS256, Password Hasher, Token hashing.
 * Memverifikasi primitives keamanan tanpa dependensi eksternal (Node crypto).
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { signJwt, verifyJwt, JwtError, type JwtClaims } from '../../src/modules/auth/services/jwt.service';
import { createPasswordHasher, ScryptPasswordHasher } from '../../src/modules/auth/services/password.service';
import {
  generateOpaqueToken,
  hashToken,
  safeEqualHex,
  newFamilyId,
} from '../../src/modules/auth/services/token.service';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const ISS = 'sica';
const AUD = 'sica-web';
const claimsBase = { sub: 'user-1', tid: 'tenant-1', sid: 'session-1', role: 'STUDENT' };

function claimsOf(token: string): JwtClaims {
  return verifyJwt(token, { publicKeyPem: publicKey, issuer: ISS, audience: AUD });
}

describe('JWT RS256 (jwt.service)', () => {
  it('menandatangani & memverifikasi token dengan klaim utuh', () => {
    const token = signJwt(claimsBase, {
      privateKeyPem: privateKey,
      issuer: ISS,
      audience: AUD,
      ttlSeconds: 900,
    });
    expect(token.split('.')).toHaveLength(3);
    const claims = claimsOf(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.tid).toBe('tenant-1');
    expect(claims.role).toBe('STUDENT');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('menolak token dengan tanda tangan dirusak', () => {
    const token = signJwt(claimsBase, { privateKeyPem: privateKey, issuer: ISS, audience: AUD, ttlSeconds: 900 });
    const [h, p, s] = token.split('.');
    const tampered = `${h}.${p}.${(s ?? '').slice(0, -2)}AA`;
    expect(() => claimsOf(tampered)).toThrowError(JwtError);
  });

  it('menolak token kedaluwarsa', () => {
    const token = signJwt(claimsBase, { privateKeyPem: privateKey, issuer: ISS, audience: AUD, ttlSeconds: -10 });
    expect(() => claimsOf(token)).toThrowError(/kedaluwarsa/);
  });

  it('menolak issuer/audiens tidak cocok', () => {
    const token = signJwt(claimsBase, { privateKeyPem: privateKey, issuer: ISS, audience: AUD, ttlSeconds: 900 });
    expect(() =>
      verifyJwt(token, { publicKeyPem: publicKey, issuer: 'other', audience: AUD })
    ).toThrowError(JwtError);
  });

  it('menolak format malform', () => {
    expect(() => claimsOf('not.a.jwt.extra')).toThrowError(/segmen/i);
  });
});

describe('Password Hasher (password.service)', () => {
  it('verifikasi benar untuk kata sandi tepat, salah untuk keliru', async () => {
    const hasher = createPasswordHasher('pepper-secret');
    const stored = await hasher.hash('RahasiaKuat#2026');
    expect(stored.startsWith('scrypt-v1$')).toBe(true);
    expect(await hasher.verify('RahasiaKuat#2026', stored)).toBe(true);
    expect(await hasher.verify('salah', stored)).toBe(false);
  });

  it('pepper berbeda → hash tak dapat diverifikasi', async () => {
    const h1 = new ScryptPasswordHasher('pepper-A');
    const h2 = new ScryptPasswordHasher('pepper-B');
    const stored = await h1.hash('pass');
    expect(await h2.verify('pass', stored)).toBe(false);
  });

  it('needsRehash untuk skema lama/false', async () => {
    const hasher = createPasswordHasher('p');
    const stored = await hasher.hash('pass');
    expect(hasher.needsRehash(stored)).toBe(false);
    expect(hasher.needsRehash('$2b$10$legacybcrypt')).toBe(true);
  });
});

describe('Token hashing (token.service)', () => {
  it('token opaque unik & hash deterministik + safeEqual', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(safeEqualHex(hashToken(a), hashToken(b))).toBe(false);
    expect(safeEqualHex(hashToken(a), hashToken(a))).toBe(true);
  });

  it('family id berupa UUID berbeda', () => {
    expect(newFamilyId()).not.toBe(newFamilyId());
  });
});
