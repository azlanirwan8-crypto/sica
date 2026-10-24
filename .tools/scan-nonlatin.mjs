/**
 * scan-nonlatin.mjs — PEMILIK pertanyaan "adakah karakter non-Latin di permukaan normatif".
 * Tingkat pohon (root sebagai argumen), sadar-penanda `nonlatin-sampled` untuk kutipan yang sah
 * (konvensi yang sama dipakai `.tools/cjk-check.mjs`; yang itu pengecekan cepat per berkas untuk
 * agen sebelum menjalankan skrip, bukan gerbang CI — lihat RD-59 dan `AUDIT_READINESS §19` butir (f)).
 */
import fs from 'node:fs';
import path from 'node:path';

const bad = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0400-\u04FF\u3400-\u4DBF\uFF01-\uFF60\u0E00-\u0E7F\u10A0-\u10FF\u0600-\u06FF]/;
const roots = process.argv.slice(2);
if (!roots.length) {
  console.log('MERAH — tanpa akar, pemindaian berjalan atas KOSONG dan tidak berhak mencetak nonLatinHits=0.');
  console.log('Pemakaian: node .tools/scan-nonlatin.mjs docs AGENTS.md .tools apps packages');
  process.exit(2);
}
const exts = new Set(['.md', '.ts', '.tsx', '.mjs', '.css', '.json', '.sql', '.dart', '.yaml', '.yml']);
let hits = 0;
let scanned = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git' || entry.name === 'node' || entry.name === 'vendor') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) continue;
    scanned++;
    const lines = fs.readFileSync(full, 'utf8').split('\n');
    lines.forEach((l, i) => {
      if (l.includes('nonlatin-sampled')) return;
      const m = l.match(bad);
      if (m) {
        hits++;
        console.log(full + ':' + (i + 1) + ' U+' + m[0].codePointAt(0).toString(16) + ' :: ' + l.trim().slice(0, 100));
      }
    });
  }
}

for (const r of roots) {
  if (fs.statSync(r).isFile()) {
    const lines = fs.readFileSync(r, 'utf8').split('\n');
    scanned++;
    lines.forEach((l, i) => {
      if (l.includes('nonlatin-sampled')) return;
      const m = l.match(bad);
      if (m) {
        hits++;
        console.log(r + ':' + (i + 1) + ' U+' + m[0].codePointAt(0).toString(16) + ' :: ' + l.trim().slice(0, 100));
      }
    });
    continue;
  }
  walk(r);
}
console.log('scanned=' + scanned + ' nonLatinHits=' + hits);
console.log(hits
  ? 'nonlatin: MERAH — ' + hits + ' baris memuat karakter di luar daftar Latin yang sah (penanda kutipan yang diizinkan = `nonlatin-sampled` pada baris itu)'
  : 'nonlatin: HIJAU — ' + scanned + ' berkas bersih dari karakter non-Latin; kutipan yang sah ditandai `nonlatin-sampled`');
process.exit(hits ? 1 : 0);
