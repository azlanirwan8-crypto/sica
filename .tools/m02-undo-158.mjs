/**
 * m02-undo-158.mjs — mencabut token `M-02` dari baris katalog 158–161 (`platform.menu.*`).
 *
 * Kenapa dicabut: `module-readiness` memetakan menu lewat SUKU PERTAMA kode izin. Begitu 158–161
 * menulis `M-02`, seluruh baris §6 yang menyebut kode berprefix `platform.` (Paket & Modul,
 * Provisioning Tenant, Kuota & Flag, Statistik Agregat, Break-Glass — semua milik M-01) ikut
 * terattribusi ke M-02. Itu kelas cacat yang sama dengan `RD-104`: pelabelan yang terlalu luas
 * menghasilkan tuduhan terbalik. Kepemilikan M-02 atas mesin menu tetap dinyatakan, tetapi di dua
 * tempat yang tidak bocor: paragraf §4.5.7 dan baris matriks §6.2 "Pengaturan → Menu & Grant".
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/RBAC_MATRIX.md';
let lines = readFileSync(T, 'utf8').split(NL);
let cabut = 0;
lines = lines.map((l) => {
  if (!/^\|\s*(15[89]|16[01])\s*\|\s*`platform\.menu\./.test(l)) return l;
  const c = l.split('|');
  c[c.length - 2] = c[c.length - 2].replace(/\s*· pemilik fungsional: \*\*M-02\*\*.*$/, '');
  cabut++;
  return c.join('|');
});
if (cabut !== 4) { console.error('MERAH — baris 158–161 yang ditemukan = ' + cabut + ' (dijadwalkan 4). Tidak ditulis.'); process.exit(1); }
if (lines.some((l) => /^\|\s*(15[89]|16[01])\s*\|\s*`platform\.menu\./.test(l) && /M-02/.test(l))) {
  console.error('MERAH — masih ada token M-02 pada baris 158–161.'); process.exit(1);
}
const i = lines.findIndex((l) => l.startsWith('**Vonis kosakata yang dibuka di sini'));
if (i < 0) { console.error('MERAH — paragraf vonis kosakata §4.5.7 tidak ditemukan.'); process.exit(1); }
lines[i] += ' Untuk baris 158–161 (`platform.menu.*`) kepemilikannya sengaja TIDAK ditulis sebagai token `M-02` di dalam barisnya: `module-readiness` memetakan menu dari suku pertama kode, sehingga satu token di sana menyeret seluruh menu M-01 (Paket & Modul, Provisioning, Kuota & Flag, Statistik, Break-Glass) ke M-02 — kelas cacat `RD-104`. Pernyataan pemiliknya ada di dua tempat yang tidak bocor: paragraf ini dan baris matriks §6.2 `Pengaturan → Menu & Grant` (FR-ADM-26).';
writeFileSync(T, lines.join(NL), 'utf8');
console.log('HIJAU — token M-02 dicabut dari 158–161; kepemilikan mesin menu dinyatakan di paragraf + §6.2.');
