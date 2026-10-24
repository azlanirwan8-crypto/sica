// Sekali-jalan: RD-100 dan RD-101 lahir dengan lima sel, tabelnya berpemilik empat kolom (ID | Temuan | Pemilik | Status).
// Narasi perbaikan digabung ke Temuan; sel alat/dokumen menjadi Pemilik. Tidak ada isi yang dibuang.
import { readFileSync, writeFileSync } from 'node:fs';

const F = 'docs/AUDIT_READINESS.md';
const lines = readFileSync(F, 'utf8').split('\n');
const want = ['RD-100', 'RD-101'];
let touched = 0;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (!l.startsWith('|')) continue;
  const cells = l.split('|').slice(1, -1).map((c) => c.trim());
  if (!/^`RD-\d+`$/.test(cells[0] || '')) continue;
  if (!want.includes(cells[0].replace(/`/g, ''))) continue;
  if (cells.length !== 5) { console.error('LEWAT (bukan 5 sel): baris ' + (i + 1) + ' punya ' + cells.length); continue; }
  const merged = [cells[0], cells[1] + ' ' + cells[2], cells[3], cells[4]];
  for (const c of merged) if (c.includes('|')) { console.error('ASERSI GAGAL: pipa literal di baris ' + (i + 1)); process.exit(1); }
  lines[i] = '| ' + merged.join(' | ') + ' |';
  touched++;
}

if (touched !== want.length) { console.error('ASERSI GAGAL:Expected ' + want.length + ' baris dinormalisasi, dapat ' + touched); process.exit(1); }
writeFileSync(F, lines.join('\n'), 'utf8');

const chk = readFileSync(F, 'utf8').split('\n').filter((l) => l.startsWith('|') && /RD-10[01]/.test(l))
  .map((l) => l.split('|').length - 2);
console.log('NORMALISASI ' + touched + ' baris · jumlah sel hasil: ' + chk.join(', ') + ' (tabel induk = 4)');
