// crud-bill.mjs — menagih hasil `.tools/crud-matrix.mjs` menjadi DAFTAR PEKERJAAN, bukan vonis baru.
// Kenapa alat ini ada: `crud-matrix` adalah pemilik vonis CRUD (RD-95 — satu pertanyaan satu pengukur).
// Ia mencetak 48 baris yang harus dibaca manusia satu-satu untuk tahu "verb mana yang kurang di modul mana".
// Tagihan ini hanya MEMINDAHKAN kolom vonis milik alat itu ke bentuk yang bisa didelegasikan: gugus + verb
// + jumlah rute. Tidak ada satu pun vonis yang dihitung ulang di sini; kalau baris modul tidak muncul di
// keluaran crud-matrix, alat ini berhenti dengan MERAH (bukan diam-diam menganggapnya lengkap).
import { execFileSync } from 'node:child_process';
const NL = String.fromCharCode(10);
const out = execFileSync(process.execPath, ['.tools/crud-matrix.mjs'], { encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, maxBuffer: 32 * 1024 * 1024 });
const rows = out.split(NL).filter((l) => /^\|\s*(M-\d\d|APP)\s*\|/.test(l));
if (rows.length !== 48) { console.error('MERAH — crud-matrix mencetak ' + rows.length + ' baris, diharapkan 48 (47 modul + APP). Tagihan ditolak.'); process.exit(1); }

// Modul yang vonisnya read-model: tidak menulis C/D di sini karena datanya diproyeksikan dari pemilik objek.
// Daftar ini BUKAN karangan: diambil dari catatan `AGENTS`/`PRD §5.13` yang dikutip crud-matrix sendiri.
const READ_MODEL = new Set(['M-26', 'M-31', 'M-32', 'M-33', 'M-34']);
const byVerb = new Map();
const detail = [];
let lengkap = 0, exempt = 0;
for (const l of rows) {
  const c = l.split('|').map((s) => s.trim());
  const id = c[1], name = c[2], counts = { C: +c[4], R: +c[5], U: +c[6], D: +c[7], V: +c[8] }, total = +c[9], verdict = c[10];
  if (/^lengkap/.test(verdict)) { lengkap++; continue; }
  const miss = (verdict.replace(/^KURANG:\s*/, '') || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!miss.length) { detail.push(id + ' | ' + name + ' | vonis tidak terbaca: ' + verdict); continue; }
  const tag = READ_MODEL.has(id) ? ' (read-model — vonis tidak menulis C/D di sini)' : '';
  detail.push(id + ' | ' + name + ' | kurang: ' + miss.join('/') + ' | rute=' + total + tag);
  for (const m of miss) byVerb.set(m, (byVerb.get(m) || 0) + 1);
  if (READ_MODEL.has(id)) exempt++;
}
console.log('modul lengkap = ' + lengkap + ' · belum lengkap = ' + (48 - lengkap) + ' · di antaranya read-model = ' + exempt + ' · yang benar-benar butuh rute tulis = ' + (48 - lengkap - exempt));
console.log(NL + 'kekurangan per verba (jumlah modul):');
for (const [v, n] of [...byVerb.entries()].sort((a, b) => b[1] - a[1])) console.log('  ' + v.padEnd(9) + '= ' + n);
console.log(NL + 'tagihan per modul:');
for (const d of detail) console.log('  ' + d);
