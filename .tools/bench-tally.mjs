import { readFileSync } from 'node:fs';
/* Delta benchmark (BENCH-*) diukur terhadap DDL yang NYATA, bukan terhadap kata status.
   Tabel BENCH di AUDIT_READINESS tidak punya kolom status (empat kolom: id | temuan | solusi | rumah),
   jadi satu-satunya cara jujur untuk bertanya "sudah tertutup belum" adalah membaca nama objek yang
   dituntut baris itu lalu mencocokkannya dengan CREATE TABLE di DATA_MODEL. */
const dm = readFileSync('docs/DATA_MODEL.md', 'utf8');
const created = new Set([...dm.matchAll(/CREATE (?:OR REPLACE )?(?:TABLE|VIEW)(?: IF NOT EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g)].map((m) => m[1]));
const types = new Set([...dm.matchAll(/CREATE TYPE ([a-z_]+)/g)].map((m) => m[1]));
// KOLOM vs OBJEK: baris BENCH sering menyebut `va_number`/`bank_code`/`last_seen`, yaitu kolom, bukan tabel.
// Tanpa pembeda ini, "belum tertutup" akan mencakup nama yang memang tidak pernah dimaksudkan sebagai objek.
const asColumn = new Set([...dm.matchAll(/^\s+([a-z_][a-z0-9_]+)\s+(?:text|bigint|int4|int2|numeric|boolean|date|timestamptz|uuid|jsonb|char\(64\)|bytea|smallint|int)\b/gm)].map((m) => m[1]));

const lines = readFileSync('docs/AUDIT_READINESS.md', 'utf8').split(String.fromCharCode(10));
const rows = [];
for (const l of lines) {
  const m = l.match(/^\|\s*`?(BENCH-\d+)`?\s*\|(.*)$/);
  if (!m) continue;
  const cells = m[2].split('|').map((s) => s.trim());
  const demanded = new Set();
  const columns = new Set();
  for (const c of cells.slice(0, 2)) {
    for (const tok of c.matchAll(/`([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)?)`/g)) {
      const base = tok[1].split('.')[0];
      if (base.length <= 2 || ['id', 'text', 'int', 'uuid', 'jsonb', 'boolean', 'numeric', 'bigint'].includes(base)) continue;
      if (!created.has(base) && !types.has(base) && asColumn.has(base)) { columns.add(base); continue; }
      demanded.add(base);
    }
  }
  if (!demanded.size) { if (columns.size) rows.push({ id: m[1], need: 0, have: 0, missing: [], colOnly: true }); continue; }
  const have = [...demanded].filter((n) => created.has(n) || types.has(n));
  rows.push({ id: m[1], need: demanded.size, have: have.length, missing: [...demanded].filter((n) => !created.has(n) && !types.has(n)) });
}
const obj = rows.filter((r) => !r.colOnly);
const colOnly = rows.length - obj.length;
const full = obj.filter((r) => r.have === r.need).length;
const part = obj.filter((r) => r.have > 0 && r.have < r.need).length;
const none = obj.filter((r) => r.have === 0).length;
const needTot = obj.reduce((x, r) => x + r.need, 0), haveTot = obj.reduce((x, r) => x + r.have, 0);
console.log(`baris BENCH yang menuntut nama OBJEK = ${obj.length} · yang hanya menyebut kolom = ${colOnly} · total baris BENCH = ${lines.filter((l) => /^\|\s*`?BENCH-\d+/.test(l)).length}`);
console.log(`nama objek dituntut = ${needTot} · sudah punya DDL/type = ${haveTot} (${((haveTot / needTot) * 100).toFixed(1)}%)`);
console.log(`baris TERKEKAP penuh = ${full} · sebagian = ${part} · nol = ${none}`);
const worst = [...obj].sort((a, b) => (b.need - b.have) - (a.need - a.have)).slice(0, 8);
for (const r of worst) console.log(`  ! ${r.id}: ${r.have}/${r.need} — sisa ${r.missing.slice(0, 5).join(', ')}`);
console.log(none === 0 && part === 0 ? 'bench-tally: HIJAU — seluruh tuntutan objek BENCH punya DDL' : 'bench-tally: PERLU DILIHAT — angka di atas adalah sisa pekerjaan, bukan klaim');
