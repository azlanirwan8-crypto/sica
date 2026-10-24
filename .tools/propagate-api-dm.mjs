import { readFileSync, writeFileSync } from 'node:fs';
const edits = [
  ['docs/API_SPEC.md',
   ['| POST | `/graduation/convocations/:convocationId/register` | `academic.graduation.insert` | M-23·M-30 | `spec-only` · INSERT · belum pernah diimplementasikan |',
    '| POST | `/graduation/commencements/:batchId/register` | `academic.graduation.insert` | M-23·M-30 | `spec-only` · INSERT · belum pernah diimplementasikan — **nama jalur diralat 2026-10-21**: objeknya `commencement_batches` ([DATA_MODEL §23.4](file:///c:/SICA/docs/DATA_MODEL.md)), bukan "convocation"; pemilik nama objek adalah DATA_MODEL (`AGENTS §3.11`) |']],
  ['docs/API_SPEC.md',
   ['**Mengapa gugus ini ada.** Pemindaian `node .tools/crud-matrix.mjs`',
    '**Cara membaca kolom "Izin acuan" (ralat 2026-10-21, dan ini berlaku untuk seluruh §7).** Pemindai `node .tools/perm-phantom.mjs` membandingkan setiap kode izin yang dikutip API_SPEC dengan (a) baris bernomor katalog `RBAC §4.5` dan (b) nama yang pernah muncul di RBAC/authz.ts. Hasil siklus ini: **364** kandidat kode, **84** sudah punya baris katalog, **25** dikenal tetapi belum ber-nomor, **5** tertulis sebagai bentuk singkat dua segmen, dan **250** **belum pernah dinamai di mana pun**. Yang terakhir itu bukan izin — itu **usulan nama** (tiket `CRD-5`, [ROADMAP §2.22](file:///c:/SICA/docs/ROADMAP_TASKS.md)). Konsekuensinya keras dan tidak bisa dinegosiasi ulang di level rute: tidak satu pun baris di bawah boleh dikode sebelum namanya menjadi baris `§4.5.x` dengan peran sasaran yang diputus manusia, dan **dilarang** menutup angka 250 itu dengan generator — generator yang sama (`crud-completer.mjs`) sudah menghasilkan pasangan izin-objek yang salah dan dibuang pada 2026-10-21 (`RD-83`).\n\n**Mengapa gugus ini ada.** Pemindaian `node .tools/crud-matrix.mjs`']],
  ['docs/API_SPEC.md',
   ['| kode `career.*` **tidak** menuntut nilai baru — kolom `Modul`-nya sudah benar `academic` mengikuti baris 257–260; yang menuntut penjagaan justru kebalikannya: jangan pernah menulis `career` ke kolom `Modul` | 1 penjaga | `.tools/rbac-module-union.mjs` + `authz.ts` (13 nilai) | `CRD-4` |',
    '| kode `career.*` **tidak** menuntut nilai baru — kolom `Modul`-nya sudah benar `academic` mengikuti baris 257–260; yang menuntut penjagaan justru kebalikannya: jangan pernah menulis `career` ke kolom `Modul` | 1 penjaga | `.tools/rbac-module-union.mjs` + `authz.ts` (13 nilai) | `CRD-4` |\n| kode izin dikutip API_SPEC tetapi **tidak pernah** dinamai RBAC/authz (terukur `node .tools/perm-phantom.mjs`) | 250 kode | `RBAC_MATRIX §4.5` adalah pemilik nama & nomor; API_SPEC hanya memakai | `CRD-5` |\n| nama objek jalur wisuda sempat salah (`convocations` vs `commencement_batches`) dan `documents` sempat terdaftar di dua berkas migrasi | 2 ralat | `DATA_MODEL §23` + `MIGRATION_SOP §5/§6` | ditutup 2026-10-21 |']],
  ['docs/DATA_MODEL.md',
   ['| `ip_documents`, `hki_files` | **KALAH** — berkas punya satu pemilik polymorphic | `attachments` (`0020`, `category=\'berkas_hki\'`) |',
    '| `ip_documents`, `hki_files` | **KALAH** — berkas punya satu pemilik polymorphic | `attachments` (`0020`, `category=\'berkas_hki\'`) |\n| `student_activities` (`0026`) | **KALAH** — satu konsep tidak boleh punya dua tabel; `activity_participations` (`0064`, §22.6.1) sudah punya DDL lengkap | `activity_participations` + empat objek sisa §23.5 |\n| `convocations` (pernah dipakai sebagai nama jalur di `API_SPEC §7.27`) | **KALAH sebagai nama objek** — objek milik `0019` | `commencement_batches` (§23.4); jalur sudah diralat |\n| `alumni_profiles` | **DILARANG** — alumni adalah `students` dengan `status_akademik=\'GRADUATED\'` | `students` + `tracer_*` (`0077`, §23.6) |\n| `kps_records` sebagai tabel kedua KHS | **DILARANG** — KPS maba adalah proyeksi `transcript_versions`/`enrollments`, bukan arsip baru | `transcript_versions` (`0027`, §23.3) |']],
];
for (const [file, pair] of edits) {
  const [from, to] = pair;
  let t = readFileSync(file, 'utf8');
  if (!t.includes(from)) { console.error('ANCHOR HILANG di ' + file + ': ' + from.slice(0, 70)); continue; }
  t = t.replace(from, to);
  writeFileSync(file, t, 'utf8');
  console.log('ok: ' + file + ' :: ' + from.slice(0, 45));
}
