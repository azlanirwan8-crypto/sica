/**
 * m02-restore-210.mjs — mengembalikan isi §2.10 `BENCHMARK_SEVIMA.md` ke versi HEAD.
 *
 * Kenapa perlu: percobaan pertama `bench-admin-delta.mjs` menulis kolom Status dengan teks ukuran,
 * sehingga klaim manusia yang seharusnya tinggal sebagai pembanding hilang. Yang dipulihkan di sini
 * HANYA blok §2.10 (bukan seluruh berkas) supaya perubahan siklus-siklus lain di berkas itu tidak
 * ikut hilang. Sumbernya `git show HEAD:docs/BENCHMARK_SEVIMA.md` — dibaca, tidak ditulis.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/BENCHMARK_SEVIMA.md';
const head = execFileSync('git', ['show', 'HEAD:' + T], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split(/\r?\n/);
const cur = readFileSync(T, 'utf8').split(NL);
const block = (ls) => {
  const s = ls.findIndex((l) => /^### 2\.10 /.test(l));
  if (s < 0) return null;
  let e = ls.length;
  for (let i = s + 1; i < ls.length; i++) if (/^#{2,3} /.test(ls[i])) { e = i; break; }
  return [s, e];
};
const hb = block(head), cb = block(cur);
if (!hb || !cb) { console.error('MERAH — blok §2.10 tidak ditemukan di salah satu versi.'); process.exit(1); }
const headBlock = head.slice(hb[0], hb[1]).filter((l) => l.trim() !== '');
if (headBlock.length < 30) { console.error('MERAH — blok HEAD hanya ' + headBlock.length + ' baris; terlalu sedikit untuk 28 baris tabel + heading.'); process.exit(1); }
if (!headBlock.some((l) => /❌ belum ada \(skema sebagian ada, UI\/API nol\)/.test(l))) {
  console.error('MERAH — blok HEAD tidak mengandung klaim manusia yang diharapkan; pemulihan dibatalkan.'); process.exit(1);
}
const out = [...cur.slice(0, cb[0]), ...headBlock, '', ...cur.slice(cb[1])];
writeFileSync(T, out.join(NL), 'utf8');
console.log('HIJAU — §2.10 dipulihkan dari HEAD (' + headBlock.length + ' baris); kolom Status kembali klaim manusia.');
