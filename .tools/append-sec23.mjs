import { readFileSync, writeFileSync } from 'node:fs';
const target = 'docs/DATA_MODEL.md';
const parts = ['.tools/frag-sec23a.md', '.tools/frag-sec23b.md'];
let body = readFileSync(target, 'utf8');
if (body.includes('## 23. DDL gugus siklus hidup')) { console.log('sudah ada — tidak ditambahkan'); process.exit(0); }
body = body.replace(/\s+$/, '\n\n');
for (const p of parts) body += readFileSync(p, 'utf8').trimStart().replace(/\s+$/, '\n');
writeFileSync(target, body, 'utf8');
console.log('§23 ditambahkan; panjang berkas =', body.split('\n').length, 'baris');
