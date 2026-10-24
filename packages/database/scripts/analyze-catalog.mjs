// Analisis katalog izin (sumber: packages/contracts/src/authz.ts):
// jumlah izin, duplikasi pasangan (resource, verb), dan total pasangan grant peran.
// Jalankan: node packages/database/scripts/analyze-catalog.mjs
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const authzTs = join(repoRoot, 'packages', 'contracts', 'src', 'authz.ts');
const authzCjs = join(repoRoot, 'packages', 'contracts', '.tmp-authz-analyze.cjs');

const source = readFileSync(authzTs, 'utf-8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
writeFileSync(authzCjs, js);

const require = createRequire(authzCjs);
const authz = require(authzCjs);
rmSync(authzCjs, { force: true });

const specs = authz.PERMISSION_SPECS;
const grants = authz.SYSTEM_ROLE_GRANTS;

const pairCount = new Map();
for (const s of specs) {
  const k = `${s.resource} | ${s.verb}`;
  pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
}
const dupes = [...pairCount.entries()].filter(([, n]) => n > 1);
const codes = new Set(specs.map((s) => s.code));
const byModule = new Map();
for (const s of specs) byModule.set(s.module, (byModule.get(s.module) ?? 0) + 1);

let pairs = 0;
const unknownCodes = new Set();
for (const [role, list] of Object.entries(grants)) {
  pairs += list.length;
  for (const c of list) if (!codes.has(c)) unknownCodes.add(`${role} -> ${c}`);
}

console.log(`izin              : ${specs.length} (kode unik ${codes.size})`);
console.log(`pasangan res|verb : ${pairCount.size} -> duplikat ${dupes.length}`);
console.log(`peran bergrant    : ${Object.keys(grants).length}`);
console.log(`pasangan grant    : ${pairs}`);
console.log(`izin tak terdaftar di katalog: ${unknownCodes.size ? [...unknownCodes].join(', ') : '0'}`);
console.log('per modul         :', JSON.stringify(Object.fromEntries(byModule)));
console.log('\nDuplikat (resource, verb) terbanyak:');
for (const [k, n] of dupes.sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${n}x  ${k}`);
