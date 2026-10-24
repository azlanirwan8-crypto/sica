import { readFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const dm = readFileSync('C:/SICA/docs/DATA_MODEL.md', 'utf8');
const created = new Set([...dm.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)/gi)].map((m) => m[1]));
const views = new Set([...dm.matchAll(/CREATE (?:OR REPLACE )?VIEW (?:IF NOT EXISTS )?([a-z_]+)/gi)].map((m) => m[1]));
/* view dengan security_invoker adalah rumah baca yang sah (AGENTS §3.10), jadi ikut diakui */
/* Hanya isi pagar ``` yang dihitung: `REFERENCES x(id)` yang muncul di paragraf prosa (§16 catatan FK)
   adalah contoh bentuk, bukan rujukan objek — memasukkannya menghasilkan temuan palsu. */
const fenced = dm.split('```').filter((_, i) => i % 2 === 1).join(NL);
const refs = new Map();
for (const m of fenced.matchAll(/REFERENCES\s+([a-z_]+)\s*\(/gi)) {
  const t = m[1];
  if (created.has(t) || views.has(t)) continue;
  if (!refs.has(t)) refs.set(t, 0);
  refs.set(t, refs.get(t) + 1);
}
/* nama yang muncul di sisi kanan ALTER/CREATE INDEX dsb. dikecualikan bila memang kolom */
const ignorable = new Set(['id', 'tenant_id']);
const daftar = [...refs.entries()].filter(([t]) => !ignorable.has(t)).sort((a, b) => b[1] - a[1]);
console.log('CREATE TABLE/VIEW terukur = ' + (created.size + views.size) + ' (' + created.size + ' tabel + ' + views.size + ' view)');
console.log('target REFERENCES yang TIDAK dibuat di dokumen = ' + daftar.length);
daftar.forEach(([t, n]) => console.log('  ! ' + t + '  dirujuk ' + n + 'x'));
console.log('fk-audit: ' + (daftar.length === 0 ? 'HIJAU — setiap rujukan menunjuk objek yang dibuat' : 'MERAH — ' + daftar.length + ' objek dirujuk tanpa pernah dibuat'));
