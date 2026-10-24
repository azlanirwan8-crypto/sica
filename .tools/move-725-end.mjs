import { readFileSync, writeFileSync } from 'node:fs';

const file = 'docs/API_SPEC.md';
const lines = readFileSync(file, 'utf8').split('\n');

const startNeedle = '### 7.25–7.31 Penutup celah CRUD wajib per modul';
const endNeedle = '### 7.23 Rekap dan status jujur';

const start = lines.findIndex((l) => l.startsWith(startNeedle));
const end = lines.findIndex((l) => l.startsWith(endNeedle));
if (start < 0 || end < 0 || end <= start) {
  console.error(`anchor tidak cocok: start=${start} end=${end}`);
  process.exit(1);
}

const block = lines.slice(start, end);
const rest = [...lines.slice(0, start), ...lines.slice(end)];
while (rest.length && rest[rest.length - 1].trim() === '') rest.pop();
const trimmed = block.slice();
while (trimmed.length && trimmed[trimmed.length - 1].trim() === '') trimmed.pop();

writeFileSync(file, [...rest, '', ...trimmed, ''].join('\n'), 'utf8');
console.log(`dipindah ${trimmed.length} baris dari indeks ${start} ke ujung berkas`);
