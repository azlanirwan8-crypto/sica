import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* 1. katalog peristiwa (metoda terverifikasi) */
const archLines = readFileSync(D + 'ARCHITECTURE.md', 'utf8').split(NL);
const s = archLines.findIndex((l) => /^### 13\.1/.test(l));
const e = archLines.findIndex((l) => /^### 13\.2/.test(l));
const catalog = new Map();
for (const l of archLines.slice(s, e)) {
  const m = l.match(/^\|\s*`([a-z_]+\.[a-z_]+\.[a-z_]+)`\s*\|\s*(M-\d{2}|APP)[^|]*\|/);
  if (m) catalog.set(m[1], m[2]);
}

/* 2. kosakata izin (nyata + usulan) supaya tidak dihitung sebagai peristiwa */
const perms = new Set();
for (const c of readFileSync('C:/SICA/packages/contracts/src/authz.ts', 'utf8').matchAll(/code:\s*'([a-z_][a-z0-9_.]*)'/g)) perms.add(c[1]);
for (const f of ['RBAC_MATRIX.md', 'API_SPEC.md', 'DATA_MODEL.md', 'UI_UX_DESIGN.md']) {
  for (const l of readFileSync(D + f, 'utf8').split(NL)) {
    const m = l.match(/^\|\s*\d+\s*\|\s*`([a-z_]+\.[a-z_0-9.]+)`\s*\|/);
    if (m) perms.add(m[1]);
  }
}

/* 3. rujukan eksplisit: kata "event"/"peristiwa" menempel pada token */
/* 3a. pengecualian: (i) pola meta yang memang ditulis sebagai `modul.entitas.aksi`;
       (ii) nama yang sudah terdaftar di register §13.1.1 (lobang yang punya pemilik,
       bukan rujukan liar) — sama seperti chain-audit, keduanya tidak boleh disamakan. */
const registered1311 = new Set();
{
  const a = readFileSync(D + 'ARCHITECTURE.md', 'utf8').split(NL);
  const s = a.findIndex((l) => /^#### 13\.1\.1/.test(l));
  const e = a.findIndex((l) => /^### 13\.2/.test(l));
  if (s !== -1) for (const l of a.slice(s, e)) {
    const m = l.match(/^\|\s*`([a-z_]+\.[a-z_]+\.[a-z_]+)`\s*\|/);
    if (m) registered1311.add(m[1]);
  }
}
const META = /^(modul|modul_x|nama)\..+\.[a-z_]+$/;
const suspects = new Map();
let countedRegistered = 0;
for (const f of readdirSync(D).filter((x) => x.endsWith('.md'))) {
  const lines = readFileSync(D + f, 'utf8').split(NL);
  lines.forEach((l, i) => {
    const re = /(?:event|peristiwa)\s*[:]?\s*`([a-z_]+\.[a-z_]+\.[a-z_]+)`|`([a-z_]+\.[a-z_]+\.[a-z_]+)`\s*(?:lahir|diterbitkan|memancarkan)/gi;
    for (const m of l.matchAll(re)) {
      const name = m[1] || m[2];
      if (META.test(name)) continue;
      if (catalog.has(name) || perms.has(name)) continue;
      if (registered1311.has(name)) { countedRegistered++; continue; }
      if (!suspects.has(name)) suspects.set(name, []);
      if (suspects.get(name).length < 2) suspects.get(name).push(f + ':' + (i + 1));
    }
  });
}
console.log('rujukan yang ternyata TERDAFTAR di §13.1.1 (lobang berpemilik) = ' + countedRegistered);
console.log('katalog §13.1 = ' + catalog.size + ' peristiwa · penerbit unik = ' + new Set(catalog.values()).size);
console.log('kosakata izin yang dikenali = ' + perms.size);
console.log('rujukan peristiwa yang tidak ada di katalog & bukan izin = ' + suspects.size);
for (const [k, v] of [...suspects.entries()].sort()) console.log('  ' + k.padEnd(38) + v.join(' , '));

/* 4. modul registri yang tidak pernah menerbitkan */
const prdLines = readFileSync(D + 'PRD.md', 'utf8').split(NL);
const rs = prdLines.findIndex((l) => /^#### 5\.12\.1/.test(l));
const re = prdLines.findIndex((l) => /^#### 5\.12\.2/.test(l));
const codes = [];
for (const l of prdLines.slice(rs, re)) { const m = l.match(/^\|\s*(M-\d{2}|APP)\s*\|/); if (m) codes.push(m[1]); }
const pubs = new Set(catalog.values());
const silent = [...new Set(codes)].filter((c) => !pubs.has(c));
console.log('');
console.log('registri §5.12.1 baris=' + codes.length + ' · penerbit dalam katalog=' + pubs.size + ' · modul SENPA penerbit peristiwa=' + silent.length);
console.log('  ' + silent.join(', '));
