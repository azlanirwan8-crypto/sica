// apply-acplt.mjs — menyisipkan blok AC-PLT-1..4 ke PRD §6.1 setelah blok AC-ADM-2 (satu kali, berbasis asersi)
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const P = 'docs/PRD.md';
const L = readFileSync(P, 'utf8').split(NL);
const frag = readFileSync('.tools/frag-acplt.md', 'utf8').replace(/\r\n/g, NL).split(NL);

const iHead = L.findIndex((l) => /^\*\*AC-ADM-2 \(impor massal bersifat all-or-nothing pada temuan BLOCK\)\*\*$/.test(l));
if (iHead < 0) { console.error('ASERSI GAGAL — heading AC-ADM-2 tidak ditemukan.'); process.exit(1); }
if (L.some((l) => /^\*\*AC-PLT-1 /.test(l))) { console.log('AC-PLT sudah ada — tidak ada yang ditulis.'); process.exit(0); }
// blok AC-ADM-2 = 4 baris (heading + Given + When + Then); cari baris Then penutupnya
let iEnd = -1;
for (let i = iHead + 1; i < L.length && i <= iHead + 12; i++) {
  if (/^Then \*\*nol\*\* baris tertulis/.test(L[i])) { iEnd = i; break; }
}
if (iEnd < 0) { console.error('ASERSI GAGAL — baris Then penutup AC-ADM-2 tidak ditemukan.'); process.exit(1); }
const out = [...L.slice(0, iEnd + 1), ...frag, ...L.slice(iEnd + 1)];
writeFileSync(P, out.join(NL), 'utf8');
const cek = out.filter((l) => /^\*\*AC-PLT-[1-4] /.test(l)).length;
if (cek !== 4) { console.error('ASERSI GAGAL — AC-PLT yang tertulis = ' + cek + ', diharapkan 4.'); process.exit(1); }
console.log('AC-PLT-1..4 disisipkan setelah baris ' + (iEnd + 1) + ' · heading terverifikasi = ' + cek);
