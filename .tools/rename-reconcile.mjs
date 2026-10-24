import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const D = 'C:/SICA/docs/';

/* RD-73: ejaan kalah `attendance.reconcile.*` diganti bentuk kanonik satu keluarga
   (`reconciliation`), kecuali RBAC_MATRIX.md yang justru mencatat ejaan kalahnya. */
const MAP = [
  ['attendance.reconcile.view', 'attendance.reconciliation.view'],
  ['attendance.reconcile.decide', 'attendance.reconciliation.decide'],
];
const skip = new Set(['RBAC_MATRIX.md']);
const rep = [];
for (const f of readdirSync(D).filter((n) => n.endsWith('.md'))) {
  if (skip.has(f)) continue;
  const p = D + f;
  let s = readFileSync(p, 'utf8');
  const orig = s;
  const counts = [];
  for (const [a, b] of MAP) {
    const n = s.split(a).length - 1;
    if (!n) continue;
    s = s.split(a).join(b);
    counts.push(a + '→' + b + '=' + n);
  }
  if (s !== orig) { writeFileSync(p, s, 'utf8'); rep.push(f + ': ' + counts.join(' ')); }
}
console.log(rep.length ? rep.join(String.fromCharCode(10)) : 'tidak ada ganti');
const left = [];
for (const f of readdirSync(D).filter((n) => n.endsWith('.md'))) {
  const s = readFileSync(D + f, 'utf8');
  for (const [a] of MAP) if (s.includes(a)) left.push(f + ' masih memuat ' + a + (f === 'RBAC_MATRIX.md' ? ' (register alias kalah, memang dicatat di sini)' : ' <-- PERLU DICEK'));
}
console.log(left.join(String.fromCharCode(10)) || 'nol sisa ejaan kalah di luar register');
