import { readFileSync, writeFileSync } from 'node:fs';

const edit = (file, pairs) => {
  let t = readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!t.includes(from)) { console.error(`ANCHOR HILANG di ${file}: ${from.slice(0, 70)}`); continue; }
    const before = t.length;
    t = t.replace(from, to);
    if (t.length === before && from !== to) console.error(`  (tidak berubah) ${file}: ${from.slice(0, 50)}`);
  }
  writeFileSync(file, t, 'utf8');
  console.log(`ditulis ${file}`);
};

// ---- MIGRATION_SOP: satu nomor satu pemilik nama + dua nomor baru ----
edit('docs/MIGRATION_SOP.md', [
  ['| `0019` | `graduation_applications`, `documents`, `legalisation_requests`, `commencement_batches` | §14.7 — AUD-09 **sudah selesai** (2026-10-19), jadi nomor ini boleh ditulis | ❌ |',
   '| `0019` | `graduation_applications`, `legalisation_requests`, `commencement_batches` — **`documents` DIHAPUS dari baris ini** (ralat 2026-10-21: nama yang sama terdaftar di `0019` dan `0020`; pemiliknya `0020`, aturan §1 `RD-06`) | [DATA_MODEL §23.4](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis**, AUD-09 selesai | ❌ belum dieksekusi (`G-02`) |'],
  ['| `0020` | `attachments`, `import_runs`, `documents`, `document_number_sequences` | §14.7 baris "G platform/lampiran" + `RD-27` |',
   '| `0020` | `attachments`, `import_runs`, `documents`, `document_number_sequences` | [DATA_MODEL §23.1](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 baris "G platform/lampiran" + `RD-27`) |'],
  ['| `0021` | PMB: `pmb_waves`, `pmb_paths`, `pmb_program_quotas`, `pmb_applications`, `pmb_documents`, `pmb_selection_results`, `pmb_reregistrations`, `pmb_school_origins`, `pmb_appeals`, `nim_assignments` | §14.7 dua baris PMB + `BENCH-01…18` |',
   '| `0021` | PMB: `pmb_waves`, `pmb_paths`, `pmb_program_quotas`, `pmb_applications`, `pmb_documents`, `pmb_selection_results`, `pmb_reregistrations`, `pmb_school_origins`, `pmb_appeals`, `nim_assignments` | [DATA_MODEL §23.2](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 dua baris PMB + `BENCH-01…18`) |'],
  ['| `0026` | Kemahasiswaan & SKPI: `student_activities`, `activity_kinds`, `achievement_levels`, `certification_records`, `publication_records` | §14.7 + `BENCH-112/113/114/131` |',
   '| `0026` | Kemahasiswaan & SKPI: `activity_kinds`, `achievement_levels`, `certification_records`, `publication_records`; **`student_activities` KALAH** kepada `activity_participations` (`0064`) — ralat 2026-10-21 | [DATA_MODEL §23.5](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** (§14.7 + `BENCH-112/113/114/131`) |'],
  ['| `0027` | Kelulusan lanjutan: `yudisium_batches`, `thesis_records`, `thesis_supervisors`, `thesis_examiners`, `transcript_versions`, `transcript_lines` | §14.7 + `BENCH-100/101/102/111/117` |',
   '| `0027` | Kelulusan lanjutan: `yudisium_batches`, `thesis_records`, `thesis_supervisors`, `thesis_examiners`, `transcript_versions`, `transcript_lines` | [DATA_MODEL §23.3](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 + `BENCH-100/101/102/111/117`) |'],
  ['1. **Nomor diukur sebelum ditulis.** Cara ukur: ambil maksimum dari `DATA_MODEL §14.7` + `§22.9` (hari ini `0075`), jangan dari tebakan; `0076` berikutnya harus lewat §22.9 lebih dulu (`AGENTS §3.11`).',
   '1. **Nomor diukur sebelum ditulis.** Cara ukur: `node .tools/ddl-gap.mjs` (ia membaca register §5 dan membandingkan dengan `CREATE TABLE` nyata di `DATA_MODEL`), lalu ambil maksimum dari `DATA_MODEL §14.7` + `§22.9`. Per 2026-10-21 maksimum adalah **`0077`**: `0076` (`student_cards`, `student_card_events`) dan `0077` (`tracer_survey_waves`, `tracer_questions`, `tracer_responses`, `tracer_employment_records`) lahir di [DATA_MODEL §23.6](file:///c:/SICA/docs/DATA_MODEL.md) dan barisnya ada di tabel register di bawah. Nomor berikutnya (`0078`) wajib lewat §23.7/§22.9 lebih dulu (`AGENTS §3.11`) — bukan lewat tebakan generator.'],
]);
