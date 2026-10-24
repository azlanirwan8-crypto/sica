import { readFileSync, writeFileSync } from 'node:fs';

const file = 'C:/SICA/docs/DATA_MODEL.md';
let s = readFileSync(file, 'utf8');
const rep = [];

function ins(anchor, replacement, label) {
  const found = s.includes(anchor);
  if (found) s = s.replace(anchor, replacement);
  rep.push(`${label}: ${found ? 'OK' : 'TIDAK KETEMU'}`);
}

// perbaiki ejaan nilai enum site
ins("'MAIN','BRANCH','SATTELIT','ONLINE_ONLY'", "'MAIN','BRANCH','SATELLITE','ONLINE_ONLY'", 'ejaan-satelit');

// 1) Baris register §14.7
const regRows = [
  '| §18.2 ALG-8 timetabling (DDL **ditulis** 2026-10-20) | `timetabling_constraint_defs`, `lecturer_availability`, `timetabling_requests`, `timetabling_assignments` | ARCHITECTURE §12.3, BLUEPRINT §4.6, BENCH-52/53 | **ikat keras**: `EXCLUDE USING gist` per `(run, room, day, slot)` dan `(run, lecturer, day, slot)` membuat draf yang bentrok **mustahil tersimpan** (bukan divalidasi belakangan); kapasitas `participants <= rooms.capacity` lintas tabel → service (L5) + tes CI §18.9(2); `time_slots`/`rooms`/`lab_resource_capabilities` (§17.3)/`room_distance_penalties` (§17.7)/`class_distributions` **dipakai ulang** | `0037_timetabling_csp.sql` | usulan ADM-10 (jalur R-3a) |',
  '| §18.3 ALG-9 penasihat akademik (DDL **ditulis** 2026-10-20) | `advisor_recommendations`, `advisor_notes` | ARCHITECTURE §12.4, ROLE_BY_ROLE §4 (dosen wali) | **ikat keras**: `reasons` dibatasi CHECK (lencana UI = kosakata, bukan karangan); `advisor_notes.visibility = ADVISOR_ONLY` **tidak pernah** diproyeksikan ke peran `STUDENT` (hak tingkat field, §14.9); rekomendasi tidak punya jalur tulis ke `enrollments`; `course_prerequisites` (`0008`) dan `advisement_assignments` (`0016`) prasyarat | `0038_advisor_recommendations.sql` | usulan R-4/R-5 |',
  '| §18.4 ALG-10 EWS/risiko putus studi (DDL **ditulis** 2026-10-20) | `ews_feature_snapshots`, `ml_model_versions`, `risk_scores` + ALTER `study_warnings` (`0016`) | ARCHITECTURE §12.5, PRD FR-AKA-* | **ikat keras**: `status ACTIVE` menolak diri bila `approved_by = trained_by` **atau** `auc < 0.70`/`brier > 0.18` (CHECK di DB, bukan niat baik); artefak model disimpan terbaca-manusia (JSONB) supaya dapat di-*diff* & direproduksi; denylist atribut terlarang diuji CI §18.9(6); skor **tidak pernah** menulis `students.status_akademik` | `0039_ews_risk_models.sql` | usulan R-4 |',
  '| §18.5 ALG-11 pra-validasi & auto-fix Feeder (DDL **ditulis** 2026-10-20) | `feeder_autofix_rules`, `feeder_autofix_suggestions`, `feeder_identity_matches`, `feeder_sync_watermarks` | ARCHITECTURE §12.6 & §12.10, INTEGRATIONS §1.11–§1.12, AC-FDR-2 | **ikat keras**: `SEMANTIC`/`BLOCKING`/`IDENTITY` **dilarang** punya `fix_expr` (CHECK) — mesin tidak bisa membubuhkan makna, hanya format; `feeder_identity_matches` **tidak punya kolom `feeder_id`** (I-14 ditegakkan bentuk skema); usulan idempoten per `(run, staging, kolom, rule)`; airmen hanya maju atas baris `SUCCEEDED`; temuan tetap di `pddikti_validation_findings` (§5), bukan tabel baru | `0040_feeder_autofix.sql` | usulan R-6 (butuh `0028`+`0031`) |',
  '| §18.6 ALG-12 presensi anti-pemalsuan (DDL **ditulis** 2026-10-20) | ALTER `rooms` (geofence) + ALTER `class_sessions` + `attendance_token_uses`, `attendance_network_allowlists`, `attendance_device_bindings`, `attendance_fraud_findings` | ARCHITECTURE §12.7, AUDIT_READINESS `SEC-03`, ROADMAP CE-6.1–6.3 | **ikat keras**: titik acuan & radius **milik server** (`rooms`), bukan badan permintaan; `UNIQUE (tenant, session, counter)` = sekali-pakai di DB (bukan hanya Redis) supaya gagal tertutup; **rahasia sesi tidak disimpan** dan 9 digit upaya gagal tidak disimpan; BSSID disimpan sebagai HMAC; banding menunjuk `attendance_appeals` (`0017`); `attendances.status` memakai enum §15.1 | `0041_attendance_antifraud.sql` | usulan R-5 (menutup SEC-03) |',
  '| §18.7 ALG-13 loop capaian OBE (DDL **ditulis** 2026-10-20) | `assessment_rubric_bands`, `cpl_targets`, `obe_closing_actions` + ALTER `outcome_attainments` (`0032`) | ARCHITECTURE §12.8, FR-P2-13, BAN-P.T. bukti loop | **ikat keras**: band `EXCLUDE numrange` (tumpang tindih mustahil); `coverage` + `n_missing_evidence` kolom terpisah sehingga "belum ada rubrik" tidak dapat dibaca sebagai capaian nol; `rollup_method` eksplisit (SKS vs mahasiswa vs kelas); `obe_closing_actions.next_cycle_attainment_id` = bukti loop tertutup; rantai outcome TIDAK dibuat ulang (milik `0032`) | `0042_obe_attainment_loop.sql` | usulan ADM-11 |',
  '| §18.8 ALG-14 jangkar & verifier rantai audit (DDL **ditulis** 2026-10-20) | `audit_chain_anchors`, `audit_verification_runs` | ARCHITECTURE §12.9, SECURITY §3.6–§3.7, `0034` | **ikat keras**: akar Merkle per 1.000 daun + `prev_anchor_root` (rantai antar-akar); **tidak ada kolom repair** — membenarkan rantai = pemalsuan; jangkar luar = object storage WORM milik sendiri, TSA RFC 3161 **ditolak** (zero-API-key); `grade_change_logs` sudah punya `seq`/`prev_hash`/`hash` (§16.3), tidak di-ALTER ulang | `0043_audit_chain_anchors.sql` | usulan ADM-1 |',
  '| §19.1 multi-kampus (DDL **ditulis** 2026-10-20) | `campus_sites` + ALTER `rooms`/`class_sessions`/`enrollments`/`study_programs` | permintaan pemilik (struktur multi-kampus), PRD §5.8 | **ikat keras**: `feeder_kode_pt` adalah kode PT **per prodi**, bukan per gedung — pemetaan multi-site ke PDDikti **belum punya bentuk resmi** dan dicatat sebagai batas (temuan BENCH baru), bukan fitur yang dijanjikan; scope RBAC `SITE` butuh keputusan RBAC_MATRIX sebelum rute ditulis | `0044_institution_sites.sql` | usulan ADM-10 / R-2 |',
  '| §19.2 jenis program (DDL **ditulis** 2026-10-20) | ALTER `study_programs`/`classes`/`enrollments` (`program_type`, `delivery_mode`) | permintaan pemilik (Reguler/Karyawan/PJJ/Internasional) | **ikat keras**: TIDAK ada tabel `program_types` — kamus nasional satu rumah di `reference_items(kind=\'jenis_program\')` (§14.2, pemenang tercatat di §14.8); nilai **disalin** ke `enrollments` saat daftar dan tidak dihitung ulang di laporan; PJJ ⇒ `delivery_mode=ONLINE` dan geofence **tidak berlaku** (§18.9(2)); tarif per jenis program (lihat `0046`) | `0044_institution_sites.sql` | usulan R-2/R-3a |',
  '| §19.3 Tugas Akhir non-skripsi 53/2023 (DDL **ditulis** 2026-10-20) | `final_project_kinds`, `final_project_outputs` + ALTER `thesis_records` (`0027`) | Permendikbudristek 53/2023, BENCH-102, FR-P2-03 | **ikat keras**: jenis TA adalah **data** (tenant + `feeder_jenis_ta`), bukan cabang kode — `feeder_jenis_ta IS NULL` berarti **tidak dikirim** (I-14), bukan "pakai kode terdekat"; `PASSED` ditolak bila `requires_publication` tanpa output bervalidasi; `validated_by` wajib orang kedua dari pembimbing (SoD nilai); output wajib `attachment_id` (`0020`) | `0045_final_project_kinds.sql` | usulan ADM-12 / R-4 |',
  '| §19.4 matriks tarif UKT (DDL **ditulis** 2026-10-20) | `fee_tariff_groups`, `tuition_tariff_matrix` (DDL untuk objek yang sudah terdaftar `0015` tanpa bentuk) | permintaan pemilik (tarif per jalur masuk & gelombang), BENCH-19..24, FR-KEU-* | **ikat keras**: `UNIQUE` memakai `COALESCE(...)` karena NULL tidak pernah bertabrakan dengan NULL (dua aturan "semua jalur" = generator nondeterministik); uang `bigint` rupiah (ADR-5); `ACTIVE` butuh `approved_by <> requested_by`; kunci `pmb_paths`/`pmb_waves` menunjuk `0021` yang **belum dieksekusi** → gugus ini tertahan di situ, bukan di `0046` | `0046_tuition_tariff_matrix.sql` | usulan ADM-11 / R-3b |',
  '| **RALAT penomoran harness engine** | `engine_runs` + tujuh tabel hasil ALG-1…ALG-7 (§17.2–§17.9) | §17.11 lama menyebut `0013_engine_algorithms.sql` | **tabrakan nomor**: §14.7 sudah mendaftarkan `0013_institution_gaps.sql`. Satu nomor = satu nama berkas. Harness pindah ke `0036_engine_algorithms.sql` (sah, `0013` belum pernah dieksekusi); §17.11 menunjuk nomor baru dan `0036` dijalankan **setelah** `0013` karena `time_slots` dibutuhkan §18.2 | `0036_engine_algorithms.sql` | ALG-0 (W-13.0) |',
  '',
].join('\n');
ins(
  '\n\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  '\n' + regRows + '\n**Catatan penomoran (diralat 2026-10-19 — `RD-20`):**',
  'register-14.7',
);

// 2) perluasan catatan penomoran
ins(
  'Nomor `0036` dan seterusnya **belum** terdaftar; siapa pun yang menambah objek wajib menuliskannya di §14.7 lebih dulu, bukan langsung membuat berkas migrasi.',
  'Nomor `0036` dan seterusnya **belum** terdaftar; siapa pun yang menambah objek wajib menuliskannya di §14.7 lebih dulu, bukan langsung membuat berkas migrasi.\n\n' +
    '**Tambahan penomoran siklus 2026-10-20 (gelombang engine 2 + entitas institusi):** `0036_engine_algorithms.sql` (harness ALG-1…7 — **ralat** dari `0013_engine_algorithms.sql` yang bertabrakan dengan `0013_institution_gaps.sql`), `0037_timetabling_csp.sql`, `0038_advisor_recommendations.sql`, `0039_ews_risk_models.sql`, `0040_feeder_autofix.sql`, `0041_attendance_antifraud.sql`, `0042_obe_attainment_loop.sql`, `0043_audit_chain_anchors.sql`, `0044_institution_sites.sql`, `0045_final_project_kinds.sql`, `0046_tuition_tariff_matrix.sql`. Sebelas nama itu kini **terpakai**. Urutan: `0036` sesudah `0013` (butuh `time_slots`); `0037` sesudah `0023` (butuh `class_distributions`); `0038` sesudah `0008`+`0016`; `0040` sesudah `0028`+`0031`; `0042` sesudah `0032`; `0043` sesudah `0034`; `0046` sesudah `0021`. Nomor `0047` ke atas masih bebas.',
  'catatan-penomoran',
);

// 3) baris alias §14.8
ins(
  '\n\n### 14.9 Aturan field-level access',
  '\n| `grade_audit_logs` | permintaan siklus ini ("tabel INSERT-ONLY perubahan nilai") | **KALAH** — yang kanonik `grade_change_logs` (§16.3, `0034`) yang **sudah** punya `seq`, `prev_hash`, `hash`, before/after letter+point+status, `approved_by <> actor_user_id`; membuat tabel kedua untuk fakta sama adalah pola `RD-32` | §14.7 & §18.8 |\n' +
    '| `program_types` | permintaan siklus ini (Reguler/Karyawan/PJJ/Internasional) | **KALAH sebagai tabel**, **MENANG sebagai kamus** `reference_items(kind=\'jenis_program\')` + kolom `classes.program_type`/`enrollments.program_type`/`study_programs.default_program_type` — kamus nasional tidak boleh punya dua rumah (§14.2) | §14.7 & §19.2 |\n' +
    '| `pddikti_staging_tables` | permintaan siklus ini | **sudah ada** sebagai tujuh `pddikti_staging_*` (§16.4, `0031`) — bukan nama baru; yang belum ada hanyalah delta sync (jadi `feeder_sync_watermarks`, `0040`) | §14.7 & §18.5 |\n\n### 14.9 Aturan field-level access',
  'alias-14.8',
);

// 4) enum §15.2
ins(
  '| `bulk_export_state` | REQUESTED · APPROVED · REJECTED · RUNNING · DELIVERED · EXPIRED · FAILED | `bulk_export_requests.state` (§16.3.5) | `0035` |',
  '| `bulk_export_state` | REQUESTED · APPROVED · REJECTED · RUNNING · DELIVERED · EXPIRED · FAILED | `bulk_export_requests.state` (§16.3.5) | `0035` |\n' +
    '| `timetabling_constraint_kind` | HARD · SOFT | `timetabling_constraint_defs.kind` (§18.2); kendala keras **tidak** punya bobot — CHECK menolaknya | `0037` |\n' +
    '| `feeder_autofix_kind` | FORMAT · ENRICH · IDENTITY · SEMANTIC · BLOCKING | `feeder_autofix_rules.kind` (§18.5); hanya FORMAT/ENRICH yang boleh membawa `fix_expr` | `0040` |\n' +
    '| `pddikti_autofix_verdict` | AUTO · REVIEW · NO_MATCH · REJECT | `feeder_autofix_suggestions.verdict` (§18.5); ambang AUTO butuh `margin`, bukan skor mentah | `0040` |\n' +
    '| `risk_band` | LOW · MEDIUM · HIGH · CRITICAL | `risk_scores.band` (§18.4); ambang pemetaan skor→band adalah `academic_rules` berversi, bukan konstanta kode | `0039` |',
  'enum-15.2',
);

// 5) text+CHECK §15.3 — anchor heading §15.4
ins(
  '\n\n### 15.4 Peta alias (ejaan lama → kanonik). Kolom kiri dilarang muncul di kode baru.',
  '\n| `attendance_token_uses.result` | ACCEPTED · REJECTED_REPLAY · OUT_OF_FENCE · GPS_LOW_ACCURACY · NO_LOCATION · REJECTED_FRAUD_SUSPECT · CHALLENGED_FAILED | vonis presensi boleh bertambah tanpa `ALTER TYPE` di tabel berpartition besar; yang **tidak** boleh berubah adalah `UNIQUE (session, counter)` (§18.6) |\n' +
    '| `classes.program_type` | REGULER · KARYAWAN · PJJ · INTERNASIONAL | tenant boleh menambah nama lokal (mis. "Kerja Sama"); makna Feeder tetap lewat `reference_items`, kolom ini salinan historis (§19.2) |\n' +
    '| `campus_sites.kind` | MAIN · BRANCH · SATELLITE · ONLINE_ONLY | jumlah site milik tenant tumbuh; tidak ada kamus nasional untuk "cabang" (§19.1) |\n' +
    '| `fee_tariff_groups.component` | UKT · SPP_TEORI · SPP_PRAKTIKUM · TPP · SKS_MARQUE · UJIAN · WISUDA · KTM · ASRAMA · LAIN | komponen biaya berbeda antar PT; yang diikat adalah **satu** `payable_to` per komponen, bukan namanya (§19.4) |\n\n### 15.4 Peta alias (ejaan lama → kanonik). Kolom kiri dilarang muncul di kode baru.',
  'text-check-15.3',
);

writeFileSync(file, s, 'utf8');
console.log(rep.join('\n'));

const lines = s.split('\n');
let bad = 0;
lines.forEach((line, i) => {
  for (let c = 0; c < line.length; c += 1) {
    const code = line.codePointAt(c);
    const hit = (code >= 0x3040 && code <= 0x30ff) || (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xac00 && code <= 0xd7af) || (code >= 0x0e00 && code <= 0x0e7f) || (code >= 0x0400 && code <= 0x04ff);
    if (hit) { bad += 1; console.log(`${i + 1} U+${code.toString(16).toUpperCase()} :: ${line.slice(Math.max(0, c - 40), c + 40)}`); break; }
  }
});
console.log('non-Latin:', bad);
