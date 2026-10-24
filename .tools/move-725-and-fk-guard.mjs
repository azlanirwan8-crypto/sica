import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';

/* ── (1) PINDAHKAN blok §7.25–§7.32 ke SETELAH §7.24 ──
   Ia tadinya saya sisip sebelum §7.23 supaya "di dalam §7", tetapi akibatnya urutan
   sub-heading menjadi 7.25…7.32 → 7.23 → 7.24 dan `heading-dup` (yang baru saya perluas
   ke sub-heading) menemukannya. Gerbang itu bekerja: yang salah adalah letak blok saya. */
const AP = D + 'API_SPEC.md';
let spec = readFileSync(AP, 'utf8');
const a0 = spec.indexOf('### 7.25–7.31 Penutup celah CRUD');
const a1 = spec.indexOf('### 7.23 Rekap dan status jujur');
const a2 = spec.indexOf(NL + '## 8', a1);
if (a0 < 0 || a1 < 0 || a2 < a1) { console.log('anchor API_SPEC tidak cocok — tidak dipindah'); }
else {
  const block = spec.slice(a0, a1);
  const rest = spec.slice(0, a0) + spec.slice(a1);
  const shift = rest.indexOf(NL + '## 8', a0);
  spec = rest.slice(0, shift) + NL + block + rest.slice(shift);
  writeFileSync(AP, spec, 'utf8');
  console.log('blok §7.25–§7.32 dipindah ke akhir §7 (sebelum §8)');
}

/* ── (2) PENJAGA RAJAKAN LUAR (FK) ──
   `ddl-owner` menjaga satu nama satu `CREATE TABLE`, tetapi tidak ada yang memeriksa
   bahwa `REFERENCES <tabel>` menunjuk tabel yang benar-benar dibuat. Temuan pertama:
   `thesis_artifacts` merujuk `thesis_records` yang tidak pernah ada di dokumen mana pun. */
const GUARD = 'C:/SICA/.tools/fk-audit.mjs';
writeFileSync(GUARD, [
  "import { readFileSync } from 'node:fs';",
  'const NL = String.fromCharCode(10);',
  "const dm = readFileSync('C:/SICA/docs/DATA_MODEL.md', 'utf8');",
  "const created = new Set([...dm.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/gi)].map((m) => m[1]));",
  "const views = new Set([...dm.matchAll(/CREATE (?:OR REPLACE )?VIEW (?:IF NOT EXISTS )?([a-z_]+)/gi)].map((m) => m[1]));",
  '/* view dengan security_invoker adalah rumah baca yang sah (AGENTS §3.10), jadi ikut diakui */',
  "const refs = new Map();",
  'for (const m of dm.matchAll(/REFERENCES\\s+([a-z_]+)\\s*\\(/gi)) {',
  '  const t = m[1];',
  '  if (created.has(t) || views.has(t)) continue;',
  '  if (!refs.has(t)) refs.set(t, 0);',
  '  refs.set(t, refs.get(t) + 1);',
  '}',
  '/* nama yang muncul di sisi kanan ALTER/CREATE INDEX dsb. dikecualikan bila memang kolom */',
  "const ignorable = new Set(['id', 'tenant_id']);",
  "const daftar = [...refs.entries()].filter(([t]) => !ignorable.has(t)).sort((a, b) => b[1] - a[1]);",
  "console.log('CREATE TABLE/VIEW terukur = ' + (created.size + views.size) + ' (' + created.size + ' tabel + ' + views.size + ' view)');",
  "console.log('target REFERENCES yang TIDAK dibuat di dokumen = ' + daftar.length);",
  "daftar.forEach(([t, n]) => console.log('  ! ' + t + '  dirujuk ' + n + 'x'));",
  "console.log('fk-audit: ' + (daftar.length === 0 ? 'HIJAU — setiap rujakan menunjuk objek yang dibuat' : 'MERAH — ' + daftar.length + ' objek dirujuk tanpa pernah dibuat'));",
  '',
].join(NL), 'utf8');
console.log('fk-audit.mjs dibuat');
