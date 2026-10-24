/**
 * Uji murni MFA + rantai audit (SEC-01, AC-AUD-2). Vektor RFC 6238 SHA1 byte-exact:
 * hasil hotp/verify yang meleset satu bit pun membuat TOTP tidak interoperable
 * dengan authenticator nyata, jadi yang diuji angka resminya, bukan sekadar tipe.
 */
import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  buildOtpauthUri,
  generateTotpSecret,
  hotp,
  verifyTotp,
} from '@/modules/auth/services/totp.service';
import { canonicalJson } from '@/modules/audit/services/audit.service';

const RFC_SECRET_B32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // ASCII '12345678901234567890'

describe('TOTP RFC 6238 (SHA1, vektor resmi)', () => {
  const vectors: ReadonlyArray<readonly [number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ];

  it('menghasilkan kode 8 digit persis seperti lampiran RFC 6238', () => {
    const secretBytes = base32Decode(RFC_SECRET_B32);
    for (const [t, expected] of vectors) {
      expect(hotp(secretBytes, Math.floor(t / 30), 8)).toBe(expected);
    }
  });

  it('menerima kode benar pada langkah kini dan menolak salah ketik', () => {
    expect(verifyTotp(RFC_SECRET_B32, '94287082', { digits: 8, nowMs: 59_000 })).toBe(true);
    expect(verifyTotp(RFC_SECRET_B32, '94287083', { digits: 8, nowMs: 59_000 })).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '1234567a', { digits: 8, nowMs: 59_000 })).toBe(false);
  });

  it('jendela ±window membatasi skew; di luar jendela ditolak', () => {
    expect(verifyTotp(RFC_SECRET_B32, '94287082', { digits: 8, nowMs: 59_000 + 30_000, window: 1 })).toBe(true);
    expect(verifyTotp(RFC_SECRET_B32, '94287082', { digits: 8, nowMs: 59_000 + 90_000, window: 1 })).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '07081804', { digits: 8, nowMs: 1_111_111_109_000 })).toBe(true);
  });

  it('menolak secret bukan base32 dan kode panjang salah', () => {
    expect(verifyTotp('!!!!', '123456', { nowMs: 0 })).toBe(false);
    expect(verifyTotp(RFC_SECRET_B32, '12345', {})).toBe(false);
  });

  it('secret yang dibangkitkan selalu base32 valid 32 karakter (20 byte)', () => {
    for (let i = 0; i < 20; i += 1) {
      const s = generateTotpSecret();
      expect(s).toMatch(/^[A-Z2-7]{32}$/);
      expect(base32Decode(s).length).toBe(20);
    }
  });

  it('otpauth URI memuat label dan parameter yang dibaca authenticator', () => {
    const uri = buildOtpauthUri({ secret: RFC_SECRET_B32, accountName: 'a@b.test', issuer: 'SICA' });
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(uri).toContain('issuer=SICA');
    expect(uri).toContain('period=30');
  });
});

describe('JSON kanonik rantai audit', () => {
  it('menyortir kunci rekursif sehingga byte-identik tanpa urutan properti', () => {
    const a = { b: 1, a: { d: 2, c: 3 } };
    const b = { a: { c: 3, d: 2 }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('menormalkan Date, array, null, dan undefined', () => {
    expect(canonicalJson({ x: new Date('2026-10-23T00:00:00.000Z') })).toBe('{"x":"2026-10-23T00:00:00.000Z"}');
    expect(canonicalJson([2, 1, null])).toBe('[2,1,null]');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});
