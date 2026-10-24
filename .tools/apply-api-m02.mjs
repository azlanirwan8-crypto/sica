/**
 * apply-api-m02.mjs — memindahkan atribusi M-02 dari "tebakan alat" ke "kalimat dokumen".
 *
 * Hari ini rute §4.14/§4.16/§4.17 masuk ke M-02 lewat peta wilayah REGION yang saya kurasi sendiri
 * di `.tools/crud-matrix.mjs`, dan catatan keandalan #1 alat itu menuntut angka tersebut BERKURANG
 * tiap siklus. Dua perubahan:
 *   (1) heading §4.14 / §4.16 / §4.17 menuliskan modulnya — bukti yang sama, sekarang dimiliki
 *       dokumen, bukan alat (`ROADMAP §2.25 PRV-3` memang meminta ini);
 *   (2) tabel rute §4.19 (kanal vicon) dapat kolom `Modul` per baris. Sebelum ini, label blok
 *       `(M-02 · M-15 · M-16 · M-18)` diwariskan ke SEMUA barisnya, sehingga M-02 tercatat
 *       memiliki provisioning kanal (`teaching.*`) dan penarikan bukti/rekonsiliasi (`attendance.*`)
 *       yang pemiliknya modul lain — M-02 hanya punya konfigurasi kanal + ambangnya.
 * Jangkar harus persis satu; kalau tidak, berkas tidak ditulis.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const T = 'docs/API_SPEC.md';
let lines = readFileSync(T, 'utf8').split(NL);

const HEAD_LABEL = [
  ['### 4.14 Master data dinamis & atribut kustom (zero-hardcoding) — 2026-10-20',
   '### 4.14 Master data dinamis & atribut kustom (zero-hardcoding) — M-02 — 2026-10-20'],
  ['### 4.16 Mesin parameter sistem dinamis (satu rumah untuk ambang, batas, flag & pola) — 2026-10-20',
   '### 4.16 Mesin parameter sistem dinamis (satu rumah untuk ambang, batas, flag & pola) — M-02 — 2026-10-20'],
  ['### 4.17 Menu dinamis & grant (pohon yang disaring server, bukan kontrol akses) — 2026-10-20',
   '### 4.17 Menu dinamis & grant (pohon yang disaring server, bukan kontrol akses) (M-02 · M-03) — 2026-10-20'],
];
for (const [from, to] of HEAD_LABEL) {
  const i = lines.indexOf(from);
  if (i < 0) { console.error('MERAH — heading tidak ditemukan persis: ' + from.slice(0, 62)); process.exit(1); }
  lines[i] = to;
}

/* (2) kolom Modul untuk sembilan baris §4.19, ditentukan dari kode izin baris itu sendiri */
const MODUL_BY_IZIN = [
  ['`settings.conference.view`', 'M-02'],
  ['`settings.conference.manage`', 'M-02'],
  ['`settings.conference.validate`', 'M-02'],
  ['`settings.param.edit.technical`', 'M-02'],
  ['`teaching.session.manage`', 'M-15 · M-16'],
  ['`teaching.session.view`', 'M-15 · M-16'],
  ['`platform.integration.proof`', 'M-01'],
  ['`attendance.record.mark`', 'M-18'],
  ['`attendance.record.view`', 'M-18'],
];
const iHead = lines.findIndex((l) => l.startsWith('### 4.19 Kanal vicon terkelola'));
if (iHead < 0) { console.error('MERAH — §4.19 tidak ditemukan.'); process.exit(1); }
const iEnd = (() => { for (let i = iHead + 1; i < lines.length; i++) if (/^#{2,4} /.test(lines[i])) return i; return lines.length; })();
let diubah = 0;
for (let i = iHead; i < iEnd; i++) {
  if (lines[i] === '| Metode | Path | Izin (`resource × verb`) | Ringkas dan penjaga |') {
    lines[i] = '| Metode | Path | Izin (`resource × verb`) | Modul | Ringkas dan penjaga |'; diubah++; continue;
  }
  if (lines[i] === '|---|---|---|---|' && diubah === 1) { lines[i] = '|---|---|---|---|---|'; diubah++; continue; }
  if (!lines[i].startsWith('| GET |') && !lines[i].startsWith('| POST |') && !lines[i].startsWith('| PUT |') && !lines[i].startsWith('| DELETE |')) continue;
  const hit = MODUL_BY_IZIN.find(([code]) => lines[i].includes(code));
  if (!hit) { console.error('MERAH — baris §4.19 tanpa kode izin yang dikenal alat: ' + lines[i].slice(0, 80)); process.exit(1); }
  const c = lines[i].split('|');
  c.splice(4, 0, ' ' + hit[1] + ' ');
  lines[i] = c.join('|'); diubah++;
}
if (diubah !== 11) { console.error('MERAH — §4.19 diubah ' + diubah + ' baris; diharapkan 11 (header + pemisah + 9 rute).'); process.exit(1); }

const text = lines.join(NL);
if ((text.match(/^\| (GET|POST|PUT|DELETE) \| `\/api\/v1\/(admin\/conference|conference|webhooks|attendance)/gm) || []).length !== 9) {
  console.error('MERAH — sembilan rute §4.19 tidak semuanya terjaga setelah tulis.'); process.exit(1);
}
writeFileSync(T, text, 'utf8');
console.log('HIJAU — 3 heading menuliskan M-02 · §4.19 kini punya sel Modul per baris (9 rute + header + pemisah).');
