// Perbaikan bentuk tabel `AUDIT_READINESS` tempat registri `RD-*` hidup: header empat kolom
// (ID | Temuan | Pemilik | Status), tetapi enam baris menyimpang — tiga karena saya menulis lima sel
// (RD-97/98/99) dan tiga karena baris siklus lalu hanya punya tiga sel (RD-93/94/95). Ini bukan
// melonggarkan alat: kolom tambahan/drop-out adalah bug bentuk yang membuat barisnya tidak terbaca
// sebagai register (kelas RD-80). Isi kalimat tidak diubah kecuali tanda batas sel.
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const path = 'docs/AUDIT_READINESS.md';
let lines = readFileSync(path, 'utf8').split(NL);
const report = [];

// RD-97/98/99: gabungkan sel Temuan dengan sel penanganan -> tetap satu sel Temuan.
const MERGE = [
  ['| `RD-97` |', ' | Ditutup di level spesifikasi:', '. Ditutup di level spesifikasi:'],
  ['| `RD-98` |', ' | `expandTokens` kini', '. `expandTokens` kini'],
  ['| `RD-99` |', ' | (1) **API_SPEC dikoreksi', ': (1) **API_SPEC dikoreksi'],
];
for (const [start, needle, repl] of MERGE) {
  const i = lines.findIndex((l) => l.startsWith(start));
  if (i < 0) { report.push('TIDAK DITEMUKAN ' + start); continue; }
  if (!lines[i].includes(needle)) { report.push('BATAS SEL ' + start + ' tidak cocok'); continue; }
  lines[i] = lines[i].replace(needle, repl);
  report.push(start.trim() + ' -> ' + (lines[i].split('|').length - 2) + ' kolom');
}

// RD-93/94/95: sisipkan sel "Pemilik" (berkas/alat yang menjadi lokus) sebelum sel terakhir.
const LOKUS = {
  '| `RD-93` |': '`.tools/module-provenance.mjs`, `.tools/prov-matrix.md`',
  '| `RD-94` |': '`PRD §5.19`/`§5.20`, `SEED_DATA §8.4`, `AUDIT_READINESS §17`, `.tools/pedoman-coverage.mjs`',
  '| `RD-95` |': '`ROADMAP §2.25 PRV-3`, `AUDIT_READINESS §17`, `PROGRESS_REPORT §5.45`',
};
for (const [start, lokus] of Object.entries(LOKUS)) {
  const i = lines.findIndex((l) => l.startsWith(start));
  if (i < 0) { report.push('TIDAK DITEMUKAN ' + start); continue; }
  const cells = lines[i].split('|').map((s) => s.trim());
  if (cells.length - 2 !== 3) { report.push(start.trim() + ' sudah ' + (cells.length - 2) + ' kolom, tidak disentuh'); continue; }
  lines[i] = '| ' + cells[1] + ' | ' + cells[2] + ' | ' + lokus + ' | ' + cells[3] + ' |';
  report.push(start.trim() + ' -> ' + (lines[i].split('|').length - 2) + ' kolom');
}
writeFileSync(path, lines.join(NL), 'utf8');
for (const r of report) console.log(r);
