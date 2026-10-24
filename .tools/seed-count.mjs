import { readFileSync, readdirSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'C:/SICA/docs/';
const MIG = 'C:/SICA/packages/database/migrations/';

/* Pemisah dua angka yang selama ini tertukar di dokumen:
   (A) berapa yang DISSPSIFIKASI di dokumen pemilik, (B) berapa yang benar-benar ada
   di berkas migrasi/seed. `SEED_DATA §8.3` menuntut angka (B); versi pertama alat ini
   hanya membaca dokumen dan melaporkan (A) seolah-olah (B) — itulah pola yang dilarang
   `AGENTS §3.9` ("design-only tidak boleh diklaim berjalan"). */

const dm = readFileSync(D + 'DATA_MODEL.md', 'utf8');
const seed = readFileSync(D + 'SEED_DATA.md', 'utf8');

/* spesifikasi: baris katalog parameter §21.3 — dihitung sebagai baris data di dalam
   wilayah heading, bukan lewat pola kolom (barisnya punya jumlah kolom yang berbeda-beda) */
const dmLines = dm.split(NL);
const sliceRegion = (startRe, stopRe) => {
  const a = dmLines.findIndex((l) => startRe.test(l));
  if (a === -1) return [];
  const b = dmLines.findIndex((l, i) => i > a && stopRe.test(l));
  return dmLines.slice(a, b === -1 ? undefined : b);
};
const isData = (l) => /^\|\s*[^|:\-\s]/.test(l) && !/^\|\s*(?:#|Objek|Master|Parameter|Nama|Kolom|Entitas|Field|Nomor|Kontrol|Izin|Permission)\b/.test(l);
const paramAny = sliceRegion(/^### 21\.3/, /^(?:## |### 21\.4)/).filter(isData).length;
const paramRows = sliceRegion(/^### 21\.3/, /^(?:## |### 21\.4)/).filter((l) => isData(l) && /master_system_parameters/.test(l)).length;

/* spesifikasi: anggota enum kanal §21.10.1 — penulisannya dua baris dan kurung buka
   berada di baris kedua, jadi `ENUM \(` (satu spasi) tidak cukup */
const provEnum = ((dm.match(/CREATE TYPE conference_provider AS ENUM\s*\(([\s\S]*?)\)/) || [, ''])[1])
  .match(/'([A-Z_]+)'/g) || [];

/* spesifikasi: baris katalog kamus §20.4 — berhenti di gugus berikutnya (`### 20.5`),
   bukan di `## 21`, supaya §20.5…§20.9 tidak ikut terhitung */
const dictRegion = (() => {
  const a = dmLines.findIndex((l) => /^### 20\.4/.test(l));
  if (a === -1) return [];
  const b = dmLines.findIndex((l, i) => i > a && /^(?:## |### 20\.[5-9])/.test(l));
  return dmLines.slice(a, b === -1 ? undefined : b);
})();
const dictRows = dictRegion.filter(isData).length;

/* nyata: berkas migrasi + INSERT ke tabel target */
const files = readdirSync(MIG).filter((f) => f.endsWith('.sql'));
const sql = files.map((f) => readFileSync(MIG + f, 'utf8')).join(NL);
const ins = (t) => (sql.match(new RegExp('INSERT INTO ' + t, 'gi')) || []).length;

const cek = [
  ['parameter (`master_system_parameters`)', 'spesifikasi dokumen §21.3 = ' + paramAny + ' baris katalog (' + paramRows + ' di antaranya ber-rumah `master_system_parameters`)', 'berkas seed/migrasi = ' + ins('master_system_parameters') + ' INSERT (0049 belum berberkas)'],
  ['kamus (`reference_kinds` / `reference_items`)', 'register §20.4 = ' + dictRows + ' kind terdaftar di dokumen', 'berkas seed = ' + ins('reference_kinds') + ' + ' + ins('reference_items') + ' INSERT (0047 belum berberkas)'],
  ['kanal (`conference_connections`)', 'enum §21.10.1 = ' + provEnum.length + ' provider (' + provEnum.map((x) => x.replace(/'/g, '')).join(', ') + ')', 'berkas seed = ' + ins('conference_connections') + ' INSERT (0073 belum berberkas)'],
];
console.log('| Objek | Yang dispesifikasi (terukur dari dokumen) | Yang nyata di berkas (terukur dari `packages/database/migrations/`) |');
console.log('|---|---|---|');
for (const [o, a, b] of cek) console.log('| ' + o + ' | ' + a + ' | ' + b + ' |');
console.log('berkas migrasi = ' + files.length + ' (' + files.map((f) => f.split('_')[0]).join(',') + ')');
console.log('referensi silang: ' + (seed.includes('.tools/seed-count.mjs') ? 'SEED_DATA §8.3 menunjuk alat ini — ada' : 'SEED_DATA tidak menunjuk alat ini'));

/* ambang yang ditagih `SEED_DATA §8.3` — dibandingkan ke sisi SPESIFIKASI (yang bisa
   diukur hari ini) dan ke sisi BERKAS (yang baru bisa lulus setelah `0047`/`0049`/`0073`) */
const nyataParam = ins('master_system_parameters');
const nyataKamus = ins('reference_kinds') + ins('reference_items');
const nyataKanal = ins('conference_connections');
const tag = (label, spec, target, nyata) =>
  '  ' + label + ': target spesifikasi ≥ ' + target + ' · terukur ' + spec + ' → ' + (spec >= target ? 'CUKUP' : 'KURANG') +
  ' | nyata di berkas = ' + nyata + (nyata >= target ? ' (lulus)' : ' (belum bisa dieksekusi — objek belum berberkas)');
console.log('ambang SEED_DATA §8.3:');
console.log(tag('parameter', paramAny, 28, nyataParam));
console.log(tag('kamus', dictRows, 62, nyataKamus));
console.log(tag('kanal', provEnum.length, 6, nyataKanal));

console.log('seed-count: spesifikasi lengkap, nyata = 0 → status dokumen = `spec-only`; dilarang menyebut seed apa pun sudah berjalan.');
