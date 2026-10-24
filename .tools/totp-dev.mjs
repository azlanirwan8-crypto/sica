// totp-dev.mjs — mencetak kode TOTP 6 digit untuk secret DEV yang dibakukan di
// apps/web/src/scripts/dev-seed.ts (vektor RFC 6238, HANYA untuk login lokal).
// Dipakai audit UI lewat browser, tempat kode harus dihitung tepat sebelum diketik.
import { createHmac } from 'node:crypto';

const B32 = process.env.SICA_DEV_TOTP ?? 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function b32decode(s) {
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) throw new Error(`base32 tidak sah: ${ch}`);
    bits += i.toString(2).padStart(5, '0');
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

const counter = Math.floor(Date.now() / 1000 / 30);
const buf = Buffer.alloc(8);
buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
buf.writeUInt32BE(counter >>> 0, 4);
const h = createHmac('sha1', b32decode(B32)).update(buf).digest();
const off = h[h.length - 1] & 0x0f;
const bin = ((h[off] & 0x7f) << 24 | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) >>> 0;
console.log((bin % 10 ** 6).toString().padStart(6, '0'));
