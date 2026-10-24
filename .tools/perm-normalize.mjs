// perm-normalize.mjs — mengklasifikasi SEMUA kode izin yang dikutip API_SPEC tetapi belum ber-nomor.
// Kenapa perlu: "348 izin hantu" bukan satu pekerjaan, melainkan EMPAT pekerjaan berbeda, dan mengobati
// yang terbanyak dengan cara yang salah = katalog berisi izin yang tidak pernah dibutuhkan layar mana pun
// (persis kegagalan generator yang dibuang pada RD-83). Alat ini TIDAK menulis dokumen apa pun.
//
// Revisi 2026-10-21 (`RD-99`): kelas dibaca juga untuk kode yang SUDAH terdaftar sebagai usulan.
// Alasannya: pendaftaran tidak menyucikan pelanggaran. Kalau `finance.waiver.reject` didaftarkan ke §4.5.6,
// gate lama akan diam; sekarang ia tetap MERAH karena vonis §4.5.1 melarangnya ada.
import { loadRbac, loadCited, actionOf } from './lib-perm.mjs';
import { writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

const { numbered, named, usulan, prefixes, pairVerbs } = loadRbac();
const cited = loadCited();

const CLASSES = ['security', 'technical', 'ops', 'academic', 'financial', 'regulatory'];
const bucket = { FORBIDDEN: [], PREFIKS_ASAM: [], VERBA_TIDAK_DIKENAL: [], TOKEN_BARU: [], RESOURCE_BARU: [] };
const stateOf = (code) => (numbered.has(code) ? 'BERNOMOR' : usulan.has(code) ? 'USULAN' : named.has(code) ? 'DIKENAL-TANPA-BARIS' : 'HANTU');

let total = 0;
for (const [code, info] of cited) {
  const parts = code.split('.');
  if (parts.length < 3) continue;
  total++;
  if (numbered.has(code)) continue;
  const act = actionOf(code);
  const p = parts[0];
  const res = parts.length >= 4 && act && CLASSES.includes(parts[parts.length - 1]) ? parts.slice(1, parts.length - 2).join('.') : parts[1];
  const st = stateOf(code);
  const row = [code, info, act ? act.verb : '?', st];
  if (act && String(act.verb).startsWith('FORBIDDEN')) {
    bucket.FORBIDDEN.push(row.concat(act.verb === 'FORBIDDEN_REJECT'
      ? 'vonis §4.5.1: penolakan bukan izin tersendiri — transisi VALIDATE beralasan dengan hasil negatif'
      : 'vonis §4.5.1: gugus baru tidak menambah izin ekspor (read-model mengikuti izin READ sumbernya)'));
    continue;
  }
  if (!act) { bucket.VERBA_TIDAK_DIKENAL.push(row.concat('token aksi tidak terdaftar pada peta 10 aksi -> 6 verba')); continue; }
  if (!prefixes.has(p)) { bucket.PREFIKS_ASAM.push(row.concat('prefiks "' + p + '" tidak pernah muncul sebagai baris katalog bernomor')); continue; }
  const known = pairVerbs.get(p + '.' + res);
  if (known) { bucket.TOKEN_BARU.push(row.concat('sumber daya ' + p + '.' + res + ' sudah punya baris dengan aksi: ' + [...known.keys()].join(', '))); continue; }
  bucket.RESOURCE_BARU.push(row.concat('prefiks ' + p + ' sah, sumber daya "' + res + '" belum pernah jadi titik aksi'));
}

const order = ['FORBIDDEN', 'PREFIKS_ASAM', 'VERBA_TIDAK_DIKENAL', 'TOKEN_BARU', 'RESOURCE_BARU'];
const ghosts = [...cited.keys()].filter((c) => c.split('.').length >= 3 && stateOf(c) === 'HANTU');
console.log('Kutipan rute ber-segmen >= 3 = ' + total + ' · yang sudah BERNOMOR = ' + [...cited.keys()].filter((c) => numbered.has(c)).length);
for (const k of order) console.log('  ' + k.padEnd(22) + '= ' + bucket[k].length);

const lines = ['# Klasifikasi kutipan izin yang belum ber-nomor (keluaran `node .tools/perm-normalize.mjs`)', ''];
for (const k of order) {
  lines.push('## ' + k + ' = ' + bucket[k].length, '');
  lines.push('| kode | § | verba | status register | catatan |');
  lines.push('|---|---|---|---|---|');
  for (const [code, info, verb, st, why] of bucket[k]) lines.push('| `' + code + '` | ' + info.section + ' | ' + verb + ' | ' + st + ' | ' + why + ' |');
  lines.push('');
}
writeFileSync('.tools/perm-classes.md', lines.join(NL), 'utf8');
console.log('rincian per kelas -> .tools/perm-classes.md');

const keras = bucket.FORBIDDEN.length + bucket.PREFIKS_ASAM.length + bucket.VERBA_TIDAK_DIKENAL.length + ghosts.length;
if (keras) console.log('perm-normalize: MERAH — ' + keras + ' kutipan tidak boleh disahkan oleh pendaftaran (hantu ' + ghosts.length + ', terlarang ' + bucket.FORBIDDEN.length + ', namespace ' + bucket.PREFIKS_ASAM.length + ', verba ' + bucket.VERBA_TIDAK_DIKENAL.length + ')');
else console.log('perm-normalize:bersih — tidak ada hantu, tidak ada verba/namespace terlarang; ' + (bucket.TOKEN_BARU.length + bucket.RESOURCE_BARU.length) + ' titik aksi menunggu keputusan peran manusia');
