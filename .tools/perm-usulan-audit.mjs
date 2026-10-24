// perm-usulan-audit.mjs — gerbang yang menjaga §4.5.4/4.5.5/4.5.6 tetap jujur.
// Kenapa alat ini ada: register usulan adalah tempat paling mudah untuk menyamar sebagai katalog.
// Enam hal yang diuji, semuanya terukur dan tidak memerlukan keputusan saya:
//  A. setiap baris usulan dibaca oleh >=1 rute API_SPEC (tidak ada izin karangan yang tak dipakai);
//  B. `verb` kolom 3 wajib salah satu dari enam verba kanonik (FR-IDT-04);
//  C. tidak ada kode ber-`.reject` / `.export` (vonis §4.5.1);
//  D. tidak ada baris yang menyamar ber-nomor (kolom 1 harus nama dalam backtick, bukan angka);
//  E. `Modul` kolom 4 wajib anggota 13 PermissionModule atau ditulis BELUM ADA (tidak boleh nama bebas);
//  F. kolom peran wajib berisi BELUM DIPUTUS — alat dilarang memutuskan grant peran.
// Keluaran: MERAH + daftar pelanggar, atau HIJAU dengan jumlah baris per bagian.
import { readFileSync } from 'node:fs';
import { loadRbac, loadCited, actionOf } from './lib-perm.mjs';

const lines = readFileSync('docs/RBAC_MATRIX.md', 'utf8').split('\n');
const cited = loadCited();
const { numbered } = loadRbac();
const CANONIC = new Set(['READ', 'INSERT', 'UPDATE', 'DELETE', 'VALIDATE', 'OTHER']);
const MODULES = new Set(['identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment', 'finance', 'feeder_pddikti', 'audit', 'entitlement', 'platform', 'settings', 'document']);

const A = [], B = [], C = [], D = [], E = [], F = [], G = [], H = [];
const seen = new Map();
let sub = '';
let perSub = new Map();
for (const l of lines) {
  const h = l.match(/^#{4}\s+4\.5\.(\d)/);
  if (h) sub = h[1];
  // Heading lain MENUTUP bagian usulan. Tanpa baris ini, `sub` tetap '6' sampai akhir berkas dan gerbang
  // membaca tabel peran/orang di §4.6 dst. sebagai pelanggaran §4.5.6 (17 tuduhan palsu, RD-99).
  else if (/^#{2,4}\s/.test(l)) sub = '';
  if (!['4', '5', '6'].includes(sub) || !l.startsWith('|')) continue;
  const c = l.split('|').map((s) => s.trim());
  // D: baris BERANGKA di dalam bagian usulan = menyamar jadi katalog. Baris begini tidak cocok pola
  // `kode` di kolom 1, jadi ia harus dihitung sebelum `continue` di bawah — kalau tidak, pelanggarannya hilang.
  if (/^\d+$/.test(c[1] || '') && /`[a-z0-9_.]+`/.test(c[2] || '')) D.push('§4.5.' + sub + ' baris bernomor ' + c[1] + ' di bagian tanpa-nomor');
  const m = (c[1] || '').match(/^`([a-z0-9_.]+)`$/);
  if (!m) continue;
  const code = m[1];
  const tag = '§4.5.' + sub + ' ' + code;
  perSub.set(sub, (perSub.get(sub) || 0) + 1);
  if (!cited.has(code)) A.push(tag);
  if (numbered.has(code)) G.push(tag + ' (sudah punya baris bernomor -> duplikasi register)');
  if (seen.has(code)) H.push(tag + ' (duplikat dengan ' + seen.get(code) + ')');
  seen.set(code, tag);
  const act = actionOf(code);
  if (!act || !CANONIC.has(act.verb)) B.push(tag + ' verb=' + (c[3] || '?') + ' petakan=' + (act ? act.verb : 'TIDAK DIKENAL'));
  if (/\.(reject|export)$/.test(code)) C.push(tag);
  const mod = (c[4] || '').replace(/`/g, '');
  if (mod !== 'BELUM ADA' && !MODULES.has(mod)) E.push(tag + ' modul=' + mod);
  // F hanya untuk §4.5.6: §4.5.4 dan §4.5.5 lebih dulu ditulis tangan dengan peran yang memang sudah
  // diputus manusia, jadi menuntut BELUM DIPUTUS di sana adalah alat yang salah sasaran, bukan temuan.
  if (sub === '6' && !/BELUM DIPUTUS/.test(c[5] || '')) F.push(tag + ' peran tertulis: ' + (c[5] || '').slice(0, 40));
}
console.log('baris usulan per bagian: ' + [...perSub.entries()].map(([k, v]) => '§4.5.' + k + '=' + v).join('  ') + '  total=' + seen.size);
const bad = [['A dikutip rute', A], ['B verb kanonik', B], ['C tanpa .reject/.export', C], ['D tanpa nomor', D], ['E modul 13 nilai', E], ['F peran belum diputus', F], ['G tidak ganda dgn katalog', G], ['H tidak ganda intra-tabel', H]];
let merah = 0;
for (const [name, arr] of bad) {
  console.log((arr.length ? '  ! ' : '  ok ') + name.padEnd(28) + '= ' + arr.length + (arr.length ? '  contoh: ' + arr.slice(0, 4).join(' | ') : ''));
  merah += arr.length;
}
console.log(merah ? 'perm-usulan-audit: MERAH — ' + merah + ' pelanggaran' : 'perm-usulan-audit: HIJAU — setiap baris usulan dikutip rute, ber-verba kanonik, tanpa nomor, dan perannya belum diputus alat');
process.exit(merah ? 1 : 0);
