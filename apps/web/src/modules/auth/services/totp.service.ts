/**
 * TOTP RFC 6238 server-side (syarat pencabutan `501 MFA_NOT_IMPLEMENTED`, SEC-01;
 * API_SPEC §2.3 baris 144). Nol dependensi, nol egress — HMAC-SHA1 di `node:crypto`.
 * Perbandingan selalu waktu-konstan; jendela langkah datang dari pemanggil
 * (parameter operasional, bukan konstanta tersembunyi).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

export function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Secret TOTP bukan base32.');
    bits += idx.toString(2).padStart(5, '0');
  }
  const out = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

/** HOTP RFC 4226 (TRUNCATE dinamis), digit `digits`, counter = langkah epoch. */
export function hotp(secretBytes: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secretBytes).update(buf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const b0 = (hmac[offset] ?? 0) & 0x7f;
  const bin = (b0 << 24) | ((hmac[offset + 1] ?? 0) << 16) | ((hmac[offset + 2] ?? 0) << 8) | (hmac[offset + 3] ?? 0);
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}

export interface TotpVerifyOptions {
  readonly stepSeconds?: number;
  readonly digits?: number;
  readonly window?: number;
  readonly nowMs?: number;
}

/**
 * Verifikasi kode TOTP. `window` = jumlah langkah yang diizinkan maju/mundur dari
 * langkah kini (skew jam); perbandingan `timingSafeEqual` pada buffer sama panjang.
 */
export function verifyTotp(secretBase32: string, code: string, opts: TotpVerifyOptions = {}): boolean {
  if (!/^\d+$/.test(code)) return false;
  const step = opts.stepSeconds ?? 30;
  const digits = opts.digits ?? 6;
  const window = Math.min(Math.max(opts.window ?? 1, 0), 3);
  if (code.length !== digits) return false;

  let secretBytes: Buffer;
  try {
    secretBytes = base32Decode(secretBase32);
  } catch {
    return false;
  }
  if (secretBytes.length === 0) return false;

  const counter = Math.floor((opts.nowMs ?? Date.now()) / 1000 / step);
  const expected = Buffer.from(code, 'utf8');
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = Buffer.from(hotp(secretBytes, counter + drift, digits), 'utf8');
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

export function buildOtpauthUri(input: {
  readonly secret: string;
  readonly accountName: string;
  readonly issuer: string;
  readonly stepSeconds?: number;
  readonly digits?: number;
}): string {
  const period = input.stepSeconds ?? 30;
  const digits = input.digits ?? 6;
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
