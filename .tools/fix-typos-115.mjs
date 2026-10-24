/**
 * fix-typos-115.mjs — dua salah ketik di catatan `RD-115`/versi 1.19: "Attribut" dan jumlah baris
 * usulan helpdesk yang saya tulis "enam belas" padahal terukur lima belas (baris 1047–1061).
 * Penggunaan: node .tools/fix-typos-115.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const F = 'C:/SICA/docs/AUDIT_READINESS.md';
let s = readFileSync(F, 'utf8');
const rubah = (dari, ke, jumlahSah) => {
  const n = s.split(dari).length - 1;
  if (n !== jumlahSah) { console.error('MERAH — "' + dari + '" muncul ' + n + ' kali, diharapkan ' + jumlahSah + '. Tidak ada yang ditulis.'); process.exit(1); }
  s = s.split(dari).join(ke);
};
rubah('Attribut usulan kini', 'Atribusi usulan kini', 1);
rubah('enam belas baris usulan `helpdesk.*`', 'lima belas baris usulan `helpdesk.*`', 1);
writeFileSync(F, s);
const rb = readFileSync('C:/SICA/docs/RBAC_MATRIX.md', 'utf8').split(NL);
const n = rb.filter((l) => /^\|\s*`helpdesk\./.test(l)).length;
if (n !== 15) { console.error('MERAH — jumlah baris usulan helpdesk terukur ' + n + ', bukan 15; angka di catatan harus disesuaikan.'); process.exit(1); }
console.log('AUDIT_READINESS: 2 salah ketik dibetulkan · jumlah baris usulan helpdesk terukur = ' + n);
