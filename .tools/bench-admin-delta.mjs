/**
 * bench-admin-delta.mjs — pemilik kolom "Ukuran alat" pada tabel selisih SICA ↔ Sevima (§2.10).
 *
 * Kenapa alat ini lahir: kolom Status di tabel itu dirawat dengan tangan sejak siklus pertama, dan
 * kajian pakar M-02 (2026-10-21) menangkapnya bohong dua arah. Terukur: baris `Wilayah` masih
 * menulis "kamus wilayah belum ada" padahal `reference_dictionary_versions`/`_entries` sudah
 * ber-`CREATE TABLE`; baris `Setting Aplikasi` menulis "`tenant_settings` belum dispesifikasi"
 * padahal tabelnya ada dan `PRD §5.11.2` butir 13 sudah memvonis rumah bendera rilis; baris
 * `Kalender Akademik` menulis "tabel belum dibuat" padahal `academic_calendar_events` ada. Sebuah
 * tabel kerja yang boleh salah, sementara dokumen lain dijaga alat, adalah sumber kebenaran kedua
 * yang tidak dijaga (`RD-55` kelas yang sama).
 *
 * Yang dilakukan: klaim manusia TIDAK dibuang (ia carrying pertanyaan produknya), tetapi disanding
 * kolom keempat yang DIHITUNG — untuk setiap nama objek (`snake_case` dengan minimal satu garis
 * bawah), alamat `/…`, dan kode izin yang disebut sel "Padanan SICA": ada `CREATE TABLE`-nya di
 * `DATA_MODEL`? ada rutenya di `API_SPEC`? ada layarnya di `UI_UX`? ada baris katalognya di
 * `RBAC_MATRIX`? Kontradiksi jadi terlihat, bukan jadi rumor. Alat tidak mengarang vonis: kalau
 * sel tidak menyebut objek yang dikenali, kolomnya dicetak "tidak terpetakan alat".
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const D = 'docs/';
const T = D + 'BENCHMARK_SEVIMA.md';
const dm = readFileSync(D + 'DATA_MODEL.md', 'utf8');
const api = readFileSync(D + 'API_SPEC.md', 'utf8');
const ux = readFileSync(D + 'UI_UX_DESIGN.md', 'utf8');
const rb = readFileSync(D + 'RBAC_MATRIX.md', 'utf8');

const hasDdl = (o) => new RegExp('CREATE TABLE (IF NOT EXISTS )?[\\w.]*\\b' + o + '\\b', 'i').test(dm);
const OBJ = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g;
const PATH = /\/[a-z][a-z0-9_\/-]*\*?\//g;
const CODE = /\b[a-z_]+\.[a-z0-9_.]+\b/g;

const lines = readFileSync(T, 'utf8').split(NL);
const iStart = lines.findIndex((l) => /^### 2\.10 /.test(l));
if (iStart < 0) { console.error('MERAH — §2.10 tidak ditemukan.'); process.exit(1); }
/* Baris header dan baris pemisah dicari dengan pemindaian, bukan dengan offset tetap. Versi pertama
   alat ini mengasumsikan tabel duduk tepat dua baris di bawah heading — asumsi yang langsung jatuh
   begitu sebuah paragraf penyisip ditempel di antaranya, dan yang gagal kemudian adalah penjaga
   (`gate-run` mencetak MERAH karena alatnya sendiri yang tidak tahan pada bentuk dokumennya). */
let iHead = -1, iSep = -1;
for (let i = iStart + 1; i < lines.length; i++) {
  if (/^\| Objek\/layanan Sevima/.test(lines[i])) { iHead = i; iSep = i + 1; break; }
}
if (iHead < 0 || !/^\|[-| ]+\|?\s*$/.test(lines[iSep] || '')) {
  console.error('MERAH — header/pemisah tabel §2.10 tidak ditemukan (head=' + iHead + ').'); process.exit(1);
}

/* kolom Status lama (hasil jalan pertama alat, yang TIDAK boleh dipakai sebagai ukuran) dibuang
   dan tabel dinaikkan ke empat kolom: klaim manusia + ukuran alat. */
lines[iHead] = '| Objek/layanan Sevima | Padanan SICA | Status SICA (klaim manusia, siklus sebelumnya) | Ukuran alat 2026-10-21: `objek ber-DDL` · `rute` · `layar` · `izin ber-nomor` |';
lines[iSep] = '|---|---|---|---|';

let i = iSep + 1, ukur = 0, kontradiksi = 0;
for (; i < lines.length; i++) {
  if (!lines[i].startsWith('| ')) break;
  const c = lines[i].split('|');
  if (c.length < 5) break;
  /* Baris yang tidak ditutup pipa terakhir adalah cacat versi pertama alat ini: sel keempat ditulis
     tetapi `| ` penutup hilang, sehingga header 4 kolom dan baris 5 pipa → `validate-md` COL.
     Sekarang baris selalu dirakit ulang dari sel yang dipotong tepi, jadi pipa penutup dijamin. */
  const sel = c.slice(1, c.length - 1);
  if (sel.length < 3) break;
  const padanan = sel[1];
  const klaim = sel[2];
  const objs = [...new Set(padanan.match(OBJ) || [])].filter((o) => !/^(x|id)$/.test(o));
  const paths = [...new Set((padanan.match(/`(\/[^`\s]*)`/g) || []).map((x) => x.replace(/`/g, '').replace(/\*\*?$/, '')))];
  const codes = [...new Set(padanan.match(CODE) || [])].filter((x) => !objs.includes(x.split('.')[0]));
  const ddl = objs.filter(hasDdl), tanpa = objs.filter((o) => !hasDdl(o));
  const rute = paths.filter((p) => api.includes(p.replace(/^\/+/, '').replace(/\*\*?$/, '')));
  const layar = paths.filter((p) => ux.includes(p.replace(/\*\*?$/, '')));
  const izin = codes.filter((x) => rb.includes('`' + x + '`'));
  let v;
  if (!objs.length && !paths.length && !codes.length) v = 'tidak terpetakan alat (sel tidak menyebut objek/alamat/kode yang dikenali)';
  else v = 'DDL ' + ddl.length + '/' + objs.length + (tanpa.length ? ' (tanpa DDL: ' + tanpa.slice(0, 3).join(', ') + ')' : '')
    + ' · rute ' + rute.length + '/' + paths.length + ' · layar ' + layar.length + '/' + paths.length
    + (codes.length ? ' · izin ' + izin.length + '/' + codes.length : '');
  /* kontradiksi = alat membuktikan objeknya ADA sementara klaim manusia berkata tidak ada */
  if (ddl.length && /belum ada|belum dibuat|belum dispesifikasi|❌/.test(klaim) && !/tapi|namun|◐/.test(klaim)) { v += ' ⟶ KONTRADIKSI: objek terukur ada, klaim manusia berkata belum'; kontradiksi++; }
  sel[3] = ' `' + v + '` ';
  lines[i] = '| ' + sel.join(' | ') + ' |';
  ukur++;
}
let text = lines.join(NL);
const CEK = process.argv.includes('--cek');
if (CEK) {
  /* Mode periksa (dipakai `gate-run`): bandingkan kolom keempat yang ada di berkas dengan hasil
     hitung ulang. Berkas TIDAK ditulis — penjaga tidak boleh mengubah dokumen, ia hanya bilang
     kalau dokumen sudah menyimpang dari alatnya. */
  const asal = readFileSync(T, 'utf8').split(NL);
  let beda = 0;
  for (let k = 0; k < ukur; k++) {
    const a = (asal[iSep + 1 + k] || '').split('|');
    const selA = a.slice(1, a.length - 1);
    const selBaru = lines[iSep + 1 + k].split('|').slice(1, -1);
    if (String(selA[3] || '').trim() !== String(selBaru[3] || '').trim()) beda++;
  }
  console.log('bench-admin-delta: ' + ukur + ' baris terukur · ' + kontradiksi + ' kontradiksi dengan klaim manusia · baris yang menyimpang dari alat = ' + beda
    + (beda ? ' — jalankan `node .tools/bench-admin-delta.mjs` untuk menulis ulang' : ' — sinkron'));
  process.exit(beda ? 1 : 0);
}
text = text.replace(/^### 2\.10 Selisih SICA ↔ Sevima pada area Admin \(tabel kerja[^)]*\)$/m,
  '### 2.10 Selisih SICA ↔ Sevima pada area Admin (tabel kerja — kolom keempat dihitung alat)');
if (!/^\*\*Kolom keempat bukan tulisan tangan/m.test(text)) {
  const at = text.indexOf('### 2.10');
  const eol = text.indexOf(NL, at);
  text = text.slice(0, eol + 1) + NL
    + '**Kolom keempat bukan tulisan tangan (2026-10-21).** Ia diregenerasi oleh `node .tools/bench-admin-delta.mjs` dari empat pemeriksaan: `CREATE TABLE` di `DATA_MODEL`, rute di `API_SPEC`, alamat layar di `UI_UX`, baris katalog di `RBAC_MATRIX`, semuanya dibaca dari sel "Padanan SICA". Kolom ketiga tetap klaim manusia dari siklus-siklus sebelumnya dan sengaja tidak dihapus — pertanyaan produknya yang berguna, bukan ingatannya. Di mana keduanya bertentangan, kolom alat yang menang dan tandanya ditulis `KONTRADIKSI`.' + NL
    + text.slice(eol + 1);
}
if (ukur < 25) { console.error('MERAH — hanya ' + ukur + ' baris terukur; diharapkan ≥25.'); process.exit(1); }
writeFileSync(T, text, 'utf8');
console.log('HIJAU — ' + ukur + ' baris §2.10 diukur; ' + kontradiksi + ' di antaranya berbenturan dengan klaim manusia.');
