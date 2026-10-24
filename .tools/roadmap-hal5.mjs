import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/ROADMAP_TASKS.md';
let s = readFileSync(p, 'utf8');
const anchor = NL + NL + '### 2.17 Dynamic Parameter Engine';
const text = NL + NL + [
  '**Hal kelima (ralat silang, 2026-10-20).** Register ini punya **penahan yang tidak boleh dipakai sebagai bahan yakin**: delapan tempat di `API_SPEC.md` dan empat di file ini mengutip "register §4.5 berhenti di 145", dan empat menyebut `UI_UX_DESIGN §14` sebagai rujukan hantu. Keduanya **sudah basi di dalam siklus yang sama** — baris 146–161 terbit dan §14/§15/§16 tertulis pada jam yang sama. Seluruhnya diralat siklus ini (lihat [PROGRESS_REPORT §5.38](file:///c:/SICA/docs/PROGRESS_REPORT.md)), termasuk angka katalog yang naik 24 → **25** karena vonis TTL menambah satu kunci (`krs.war_lease_ttl_s`). **Norma yang diambil:** dokumen lain **merujuk** nomor, tidak menyalin angkanya; kalau angka harus disebut, sebut bersama tanggal dan alat ukurnya. Tanpa aturan ini, "tulis banyak dokumen dalam satu hari" akan terus menghasilkan register yang benar tetapi terbaca salah.',
].join(NL);
const i = s.indexOf(anchor);
if (i === -1 || s.lastIndexOf(anchor) !== i) { console.log('anchor MISS/AMBIG'); process.exit(1); }
s = s.slice(0, i) + text + s.slice(i + anchor.length);
writeFileSync(p, s, 'utf8');
console.log('roadmap-hal-kelima: OK');
