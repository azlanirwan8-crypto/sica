import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);
const p = 'C:/SICA/docs/PRD.md';
let s = readFileSync(p, 'utf8');
const rep = [];
const job = (label, a, b) => {
  const i = s.indexOf(a);
  if (i === -1) { rep.push(label + ': MISS'); return; }
  if (s.lastIndexOf(a) !== i) { rep.push(label + ': AMBIG'); return; }
  s = s.slice(0, i) + b + s.slice(i + a.length);
  rep.push(label + ': OK');
};

job('vic01', '| FR-VIC-01 | *tenant binding* Azure AD per penyewa: satu aplikasi terdaftar per kampus, kredensial di vault/ENV, tanpa nilai rahasia di baris parameter | M-02 | `tenant_conference_connections` (`0073`) |',
  '| FR-VIC-01 | *tenant binding* Azure AD per penyewa: satu aplikasi terdaftar per kampus, kredensial di vault/ENV, tanpa nilai rahasia di baris parameter | M-02 | `conference_connections` (`0073`) |');
job('vic03', '| M-16, M-18 | `conference_events` (`0073`) + `0012` idempotensi |',
  '| M-16, M-18 | `conference_channel_events` (`0073`) + `0012` idempotensi |');
job('vic04', '| M-18, M-05 | `attendance_evidence` (`0074`) |',
  '| M-18, M-05 | `attendance_channel_evidence` (`0074`) |');
job('vic06', '| M-15, M-02 | `conference_health` (`0073`) |',
  '| M-15, M-02 | kolom `last_probe_*` pada `conference_connections` (`0073`) |');
job('review-ruling',
  'Vonis: `PENDING_REVIEW` **bukan status kehadiran**, melainkan keadaan banding pada objek terpisah `attendance_reviews` (migrasi `0074`) dengan kolom penanda `attendances.review_state`. Kontrak baca mengembalikan `reviewState`, bukan menyuntik nilai ke `status`.',
  'Vonis: `PENDING_REVIEW` **bukan status kehadiran**. Rumah banding sudah ada dan tidak dibuat kedua kali — `attendance_appeals` (migrasi `0017`, §14 register "D perkuliahan") — dan penanda tayangnya disimpan sebagai kolom `attendances.review_state` (`NULL` · `PENDING` · `GRANTED` · `REJECTED`, kelas A′; ALTER di `0074`). Kontrak baca mengembalikan `reviewState` + `appealId`, bukan menyuntik nilai ke `status`. Ini persis jebakan `RD-63`: satu keadaan dengan dua rumah membuat `INSERT` gagal senyap.');
job('acvic3', 'Then kedua bukti masuk, Then satu vonis per `(sesi, mahasiswa)` dan `attendance_evidence` dua baris;',
  'Then kedua bukti masuk, Then satu vonis per `(sesi, mahasiswa)` dan dua baris `attendance_channel_evidence`;');
job('acvic3b', 'When kedua bukti masuk, Then satu vonis per `(sesi, mahasiswa)` dan `attendance_evidence` dua baris; tidak ada duplikat kehadiran.',
  'When kedua bukti masuk, Then satu vonis per `(sesi, mahasiswa)` dan dua baris `attendance_channel_evidence`; tidak ada duplikat kehadiran.');
job('status515', '`conference_meetings`/`conference_events`/`attendance_reviews` belum punya berkas migrasi (`0073`/`0074` baru dinormakan di bagian ini)',
  '`conference_connections`/`conference_meetings`/`conference_channel_events`/`attendance_channel_evidence` belum punya berkas migrasi (`0073`/`0074` baru dinormakan di bagian ini)');

writeFileSync(p, s, 'utf8');
console.log(rep.join(NL));
