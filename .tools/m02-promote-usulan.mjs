/**
 * m02-promote-usulan.mjs — menghapus entri USULAN `RBAC §4.5.6` yang sudah dipromosikan menjadi
 * baris katalog ber-nomor (319–328) pada siklus ini, lalu memberi rujukan vonis pada dua nama
 * `platform.import.*` yang sengaja TIDAK dipakai.
 *
 * Kenapa wajib: `perm-usulan-audit` butir G menolak satu nama hidup di dua register. Setelah §4.5.7
 * menulis nomor, salinan usulannya bukan lagi usulan — ia duplikasi register, dan duplikasi register
 * adalah pola `RD-32` yang paling kita perangi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/RBAC_MATRIX.md';
const lines = readFileSync(T, 'utf8').split(NL);
const s = lines.findIndex((l) => /^#### 4\.5\.6/.test(l));
if (s < 0) { console.error('MERAH — §4.5.6 tidak ditemukan.'); process.exit(1); }
let e = lines.length;
for (let i = s + 1; i < lines.length; i++) if (/^#{2,4} /.test(lines[i])) { e = i; break; }

const PROMOTED = new Set(['settings.param.approve.regulatory', 'settings.param.approve.security', 'settings.param.history.view',
  'settings.param.impact.view', 'settings.param.register', 'settings.param.pattern.manage']);
const kept = [];
let buang = 0, rujuk = 0;
for (let i = s; i < e; i++) {
  const l = lines[i];
  const m = l.match(/^\|\s*`([a-z_][a-z0-9_.]*)`\s*\|/);
  if (m && PROMOTED.has(m[1])) { buang++; continue; }
  if (m && (m[1] === 'platform.import.validate' || m[1] === 'platform.import.commit')) {
    const nama = m[1] === 'platform.import.validate' ? 'master.import.validate (319)' : 'master.import.commit (320)';
    const baru = l.replace('BELUM DIPUTUS — tidak ada saudara se-sumber daya',
      'BELUM DIPUTUS — dan ruang namanya DITOLAK: impor data master adalah pekerjaan M-02, sudah dipromosikan sebagai `' + nama + '` (§4.5.7)');
    if (baru === l) { console.error('MERAH — teks sel usulan `platform.import` tidak seperti yang dijanjikan; jumlah sel tidak boleh diubah.'); process.exit(1); }
    kept.push(baru); rujuk++;
    continue;
  }
  kept.push(l);
}
if (buang !== 6) { console.error('MERAH — entri usulan yang dihapus = ' + buang + ' (dijadwalkan 6). Berkas tidak ditulis.'); process.exit(1); }
if (rujuk !== 2) { console.error('MERAH — rujukan vonis `platform.import.*` = ' + rujuk + ' (dijadwalkan 2).'); process.exit(1); }
const out = [...lines.slice(0, s), ...kept, ...lines.slice(e)];
writeFileSync(T, out.join(NL), 'utf8');
console.log('HIJAU — 6 usulan yang sudah ber-nomor dihapus dari §4.5.6 · 2 nama `platform.import.*` diberi rujukan vonis.');
