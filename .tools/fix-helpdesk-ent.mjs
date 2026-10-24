/**
 * fix-helpdesk-ent.mjs — ALAT YANG SUDAH DIBALIK (2026-10-21, `RD-115`). Ia pernah memindahkan
 * kolom Entitlement enam belas baris usulan `helpdesk.*` dari `settings` ke `helpdesk`. Itu salah:
 * kolom itu dibatasi ke 13 nilai `PERMISSION_MODULES` (`G-29`), dan `helpdesk` bukan salah satunya,
 * jadi `settings` adalah satu-satunya nilai yang SAH — yang kasar adalah aturan fallback alat,
 * bukan sel dokumennya. Mode `--balik` mengembalikan dokumen ke keadaan benar; mode `--cek`
 * memastikan tidak ada yang mengulangi perubahan itu. Alat ini TIDAK dipasang sebagai gerbang.
 * Penggunaan: node .tools/fix-helpdesk-ent.mjs [--cek|--balik]
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const F = 'C:/SICA/docs/RBAC_MATRIX.md';
const lines = readFileSync(F, 'utf8').split(NL);
const BALIK = process.argv.includes('--balik');
const CEK = process.argv.includes('--cek');
const DARI = BALIK ? '`helpdesk`' : '`settings`';
const KE = BALIK ? '`settings`' : '`helpdesk`';
if (CEK) {
  /* Mode periksa dibaca SEBELUM mutasi apa pun: ia hanya menghitung kolom yang memakai `helpdesk`
     (nilai di luar 13 yang sah, `G-29`). Versi pertama alat ini menjalankan loop penggantian lebih
     dulu lalu menghitung hasil mutasinya sendiri — laporan palsu yang selalu MERAH. */
  const salah = lines.filter((l) => /^\|\s*`helpdesk\./.test(l) && (l.split('|')[4] || '').trim() === '`helpdesk`').length;
  console.log(salah ? 'MERAH — §4.5.6 punya ' + salah + ' kolom Entitlement `helpdesk` di luar 13 nilai yang sah (`G-29`); kembalikan dengan --balik.' : 'helpdesk-ent: HIJAU — kolom Entitlement usulan helpdesk tetap nilai sah `settings`.');
  process.exit(salah ? 1 : 0);
}
let in456 = false, ubah = 0, tersisa = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^#### 4\.5\.6/.test(l)) { in456 = true; continue; }
  if (in456 && /^(###|####|##)\s/.test(l)) in456 = false;
  if (!in456 || !/^\|\s*`helpdesk\./.test(l)) continue;
  const c = l.split('|');
  if (c.length < 6) { console.error('MERAH — baris helpdesk bentuknya tidak seperti dugaan di ' + (i + 1) + '.'); process.exit(1); }
  if (c[4].trim() === DARI) { c[4] = ' ' + KE + ' '; lines[i] = c.join('|'); ubah++; }
  else if (c[4].trim() !== KE) tersisa++;
}
if (tersisa > 0) { console.error('MERAH — ' + tersisa + ' baris helpdesk punya kolom Entitlement di luar 13 nilai `PERMISSION_MODULES` (`G-29`); tidak ada yang ditulis.'); process.exit(1); }
if (ubah === 0) { console.error('MERAH — tidak ada yang berubah; jangkar mungkin sudah bergeser. Tidak ada yang ditulis.'); process.exit(1); }
writeFileSync(F, lines.join(NL));
console.log('§4.5.6: ' + ubah + ' kolom Entitlement `' + DARI + '` → `' + KE + '`' + (BALIK ? ' (ralat RD-115: `helpdesk` bukan nilai `PermissionModule`; kolomnya dibatasi 13 nilai)' : ' (perubahan ini sudah dibalik, lihat RD-115)'));

