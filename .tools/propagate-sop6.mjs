import { readFileSync, writeFileSync } from 'node:fs';
const f = 'docs/MIGRATION_SOP.md';
let t = readFileSync(f, 'utf8');
const pairs = [
  ['## 6. Enam puluh lima nomor ke depan dan tiga migrasi kanal (audit dewan 2026-10-21)',
   '## 6. Enam puluh lima nomor ke depan dan lima migrasi kanal + siklus hidup (audit dewan 2026-10-21)'],
  ['Terukur hari ini: `ls packages/database/migrations/*.sql` = **7 berkas** (`0001`–`0006`, `0011`), sementara dokumen menuntut sampai **`0075`** — artinya **68 nomor** masih berupa spesifikasi.',
   'Terukur hari ini: `ls packages/database/migrations/*.sql` = **7 berkas** (`0001`–`0006`, `0011`), sementara dokumen menuntut sampai **`0077`** — artinya **70 nomor** masih berupa spesifikasi, dan selisihnya turun 5 pada 2026-10-21 karena `0019`, `0020`, `0021`, `0026`, `0027` kini punya DDL ([DATA_MODEL §23](file:///c:/SICA/docs/DATA_MODEL.md)), sementara `0076`/`0077` baru saja naik ke register. Angka ini dihitung `node .tools/ddl-gap.mjs`, tidak dikutip dari paragraf.'],
  ['### 6.2 Empat penjaga yang berlaku untuk ketiganya',
   '### 6.2 Dua migrasi siklus hidup (`0076`–`0077`) — lahir di [DATA_MODEL §23.6](file:///c:/SICA/docs/DATA_MODEL.md)\n\n| Berkas | Isi | Tipe | Catatan penegakan |\n|---|---|---|---|\n| `0076_student_cards.sql` | enum `student_card_state` + `student_cards` + `student_card_events` (insert-only) + 2 indeks | **Expand** | `photo_attachment_id` menunjuk `attachments` (`0020`) sehingga KTM tidak punya jalur unggah kedua; `REVOKE UPDATE, DELETE` pada `student_card_events` + pemicu `app.reject_mutation()` (pola §16.3.3); RLS `ENABLE`+`FORCE`+`tenant_isolation` |\n| `0077_tracer_study.sql` | enum `tracer_wave_state` + `tracer_survey_waves` + `tracer_questions` + `tracer_responses` + `tracer_employment_records` + 3 indeks | **Expand** | modul `tracer_iku` sudah ter-seed di `0004:83` tanpa model data (`P-10`): nomor ini adalah harga yang harus dibayar sebelum modul itu boleh dijual; `consent_given = false` tidak boleh terbaca lewat proyeksi M-28 (uji penolakan `403`, bukan uji filter); `external_organization_id` wajib menunjuk `0053`, tidak ada nama perusahaan yang diketik bebas |\n\nKedua berkas **tidak** menyentuh kosakata modus/kanal, jadi ia tidak bergantung pada `0075` Release A/B. Urutan eksekusi: `0020` → `0021` → `0027` → `0019` → `0076` → `0077`, karena `student_cards.series` dan `pmb_applications.application_number` memakai `document_number_sequences` dan `nim_assignments` memakai sequence per prefix (§23.2).\n\n### 6.3 Empat penjaga yang berlaku untuk kelima nomor'],
];
for (const [a, b] of pairs) {
  if (!t.includes(a)) { console.error('ANCHOR HILANG: ' + a.slice(0, 60)); continue; }
  t = t.replace(a, b);
}
writeFileSync(f, t, 'utf8');
console.log('ditulis ' + f);
