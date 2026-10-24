// TOTP RFC 6238 untuk harness e2e dev — SATU salinan untuk semua suite yang menembang
// MFA (e2e-fase-1a…1d, e2e-guard-order). Sebelumnya keempat suite menyimpan salinan
// identik di dalam dirinya sendiri; duplikasi itulah pola `RD-32` yang dokumen ini perangi.
//
// Secret yang dipakai harness adalah secret DEV dari `dev-seed` dan dicetak `seed:dev`
// sebagai otpauth URI — bukan kredensial nyata.
import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648, tanpa padding) → Buffer. Karakter di luar alfabet dibuang. */
export function b32decode(secret) {
  let bits = '';
  for (const c of secret.replace(/[^A-Z2-7]/gi, '').toUpperCase()) {
    bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0');
  }
  const out = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

/** Kode TOTP pada window berjalan — 30 detik / 6 digit, sama dengan kontrak `attendance.totp_*`. */
export function totp(secretB32, step = 30, digits = 6) {
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const h = createHmac('sha1', b32decode(secretB32)).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) >>> 0;
  return (bin % 10 ** digits).toString().padStart(digits, '0');
}
