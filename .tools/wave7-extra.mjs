import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const rd = (p) => readFileSync(p, 'utf8').split(NL);

{
  const b = rd('C:/SICA/docs/INTEGRATIONS.md');
  const s = b.findIndex((l) => /^### 6\.4/.test(l));
  const e = b.findIndex((l) => /^### 6\.5/.test(l));
  const rows = b.slice(s + 1, e).filter((l) => l.startsWith('|') && !/^\|-+/.test(l) && !/^\|\s*-+/.test(l));
  console.log('6.4 rows=' + rows.length + ' (header incluso)');
  console.log(rows.map((l) => (l.split('|')[1] || '').trim().slice(0, 40)).join(' || '));
}

{
  const b = rd('C:/SICA/docs/PRD.md');
  const s = b.findIndex((l) => /^#{2,4} 5\.12/.test(l));
  let e = b.length;
  for (let i = s + 1; i < b.length; i++) if (/^#{2,4} 5\.13/.test(b[i])) { e = i; break; }
  const cells = [];
  for (const l of b.slice(s, e)) {
    if (!/^\|\s*(M-\d{2}|APP)\s*\|/.test(l)) continue;
    cells.push((l.split('|').slice(1, -1).map((x) => x.trim())[2]) || '');
  }
  console.log('--- contoh sel entitlement (6 pertama):');
  console.log(cells.slice(0, 6).map((c) => JSON.stringify(c)).join(NL));
  const usul = new Set(); const nyata = new Set();
  for (const c of cells) {
    const after = c.split(/usulan/i).slice(1).join(' ');
    const before = c.split(/usulan/i)[0];
    for (const m of before.matchAll(/`([a-z_]+)`/g)) nyata.add(m[1]);
    for (const m of after.matchAll(/`([a-z_]+)`/g)) usul.add(m[1]);
  }
  console.log('nyata=' + nyata.size + ' [' + [...nyata].sort().join(',') + ']');
  console.log('usulan=' + usul.size + ' [' + [...usul].sort().join(',') + ']');
}
