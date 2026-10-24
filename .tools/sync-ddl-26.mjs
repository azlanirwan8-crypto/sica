import { readFileSync, writeFileSync } from 'node:fs';
const NL = String.fromCharCode(10);

/* Sinkronisasi pasca-§26: register MIGRATION_SOP §5 menunjuk ke tempat DDL ditulis, register alias
   kalah di DATA_MODEL §22.10 menerima empat vonis baru, rujukan lama "masih CRD-6" dicabut, dan
   CRD-6 di ROADMAP dinyatakan tertutup dengan angka alat (bukan angka yang saya salin). */

const fail = [];

// ---------- 1. MIGRATION_SOP §5: baris per nomor ----------
const sopPath = 'docs/MIGRATION_SOP.md';
const NEW = {
  '0013': '| `0013` | `time_slots`, `buildings` + `rooms.building_id`; **`concentrations` dan `laboratories` KALAH** — pemiliknya berturut-turut kamus `reference_items(kind=konsentrasi)` (children sudah menyimpan `concentration_ref`) dan `rooms(room_type=LAB)` + `lab_resource_capabilities` + `lab_allocation_items` | §14.7 gugus A + `DATA_MODEL §26` keputusan 1 | ❌ berkas belum ada (`G-02`) — DDL `time_slots` + `buildings` **ditulis 2026-10-21** di [DATA_MODEL §26.1](file:///c:/SICA/docs/DATA_MODEL.md) |',
  '0014': '| `0014` | OBE: `program_outcomes`, `course_outcomes`, `outcome_matrix`, `course_evaluation_plans`; **`learning_products` KALAH** — luaran milik `course_outcomes`/`program_outcomes` dan bentuk TA non-skripsi milik `final_project_outputs` | §14.7 | ❌ berkas belum ada — DDL `course_evaluation_plans` **ditulis 2026-10-21** di §26.2; tiga objek lain sudah ada sejak §16.2/`0032` |',
  '0015': '| `0015` | `fee_tariff_groups`, `tuition_discounts`, `payment_channels`, `reconciliation_runs`, `billing_gate_rules`, `accounts`, `accounting_periods`; **`payment_plans` KALAH** — termin sudah dimiliki `invoice_installments(invoice_id, seq, due_on, amount_rupiah)` | §14.7 + `BENCH-*` | ❌ berkas belum ada — DDL empat objek baru **ditulis 2026-10-21** di §26.3; `accounts`/`accounting_periods` sudah ditulis `RD-07` |',
  '0016': '| `0016` | `advisement_assignments`, `krs_amendments`, `exam_cards`, `mbkm_*`, `student_transfers`, `study_warnings` | §14.7 | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.4; `mbkm_conversions`/`mbkm_conversion_lines`/`mbkm_grade_mappings` sudah ada sejak `0033` |',
  '0017': '| `0017` | `session_journals`, `attendance_appeals`, `room_reservations` + kolom sesi (`week_pattern`, `status`, `qr_*`) | §14.7 | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.5; bentrok ruang dijaga `EXCLUDE USING gist`, banding dijendela `window_ends_at` |',
  '0018': '| `0018` | `grade_component_scores`, `grade_publish_states`, `grade_blanket_resets`, `semester_results`, `surveys`, **`survey_responses` (baru, `0018a`)** | §14.7 + `BENCH-87/88/98` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.6; `semester_results` turunan insert-only, `weight_used_bp` disalin saat hitung |',
  '0022': '| `0022` | Kanal & bukti keuangan: `virtual_accounts`, `payment_windows`, `payment_allocations`, `receipts` | §14.7 + `BENCH-19/20/21/24/33/34` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.7; `UNIQUE (bank_code, va_number)` tetap **global antar-tenant** |',
  '0023': '| `0023` | Visibilitas KRS: `class_distributions`, `krs_packages`, **`krs_package_lines` (baru, `0023a`)** | §14.7 + `BENCH-35/41/47` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.8; invariance I-12 ditegakkan service + indeks lookup; `krs_baskets` tetap pindah ke `0030` |',
  '0024': '| `0024` | Jadwal ujian: `exam_schedules`, `exam_participants` | §14.7 + `BENCH-60/84` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.9; `EXCLUDE USING gist` untuk ruang, tiga tanggal cetak/H-H pada peserta, dan FK `exam_cards.exam_schedule_id` ditunaikan di sini |',
  '0025': '| `0025` | `lecturer_attendances` | §14.7 + `BENCH-66/74` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.10; `UNIQUE (class_session_id, lecturer_membership_id)` menutup jam ganda di BKD |',
  '0028': '| `0028` | Jembatan Feeder: `feeder_bridges`, `feeder_jobs`, `feeder_identities`, `feeder_credentials`→**Referensi Vault saja**, `feeder_environments`, `reference_dictionary_entries`, `reference_dictionary_versions` | §14.7 + `BENCH-127/128/130/131/135` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.11; dua tabel kamus kelas B sengaja **platform-global** (pengecualian `AGENTS §3.2` dinyatakan beserta alasannya), isi muatan tetap `[VERIFIKASI-VENDOR]` |',
  '0029': '| `0029` | `notification_preferences`, `notification_templates`, `notifications`, `notification_deliveries`, `impersonation_grants`, `student_guardians.consent_*` | §14.7 baris "G portal/silang" (dipindah dari `0012`) | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.12; alamat penerima disimpan sebagai hash, `impersonation_grants.mfa_verified_at NOT NULL` (FR-ADM-13) |',
};
let sop = readFileSync(sopPath, 'utf8').split(NL);
for (const [num, line] of Object.entries(NEW)) {
  const i = sop.findIndex((l) => l.startsWith('| `' + num + '` |'));
  if (i < 0) { fail.push('baris register ' + num + ' tidak ditemukan'); continue; }
  sop[i] = line;
}
writeFileSync(sopPath, sop.join(NL), 'utf8');
console.log('MIGRATION_SOP §5: ' + Object.keys(NEW).length + ' baris diperbarui');

// ---------- 2. DATA_MODEL: empat vonis kalah + satu rujukan CRD-6 dicabut ----------
const dmPath = 'docs/DATA_MODEL.md';
let dm = readFileSync(dmPath, 'utf8');

const aliasAnchor = '| `payslips`, `payroll_details`, `salary_lines` |';
const ai = dm.split(NL).findIndex((l) => l.startsWith(aliasAnchor));
if (ai < 0) fail.push('anchor §22.10 tidak ditemukan');
else {
  const lines = dm.split(NL);
  const add = [
    '| `concentrations` sebagai tabel induk peminatan (`0013`) | **KALAH** — nama peminatan adalah milik kampus dan sudah jadi kamus; membuat tabel induk kedua memberi dua tempat untuk satu nama | `reference_items(kind = konsentrasi)` + `concentration_preferences`/`concentration_placements` yang menyimpan `concentration_ref` (`§26` keputusan 1) |',
    '| `laboratories` sebagai tabel ruang praktik (`0013`) | **KALAH** — ruang praktik adalah `rooms` dengan `room_type = LAB`; kapasitas dan alat sudah punya rumah | `rooms` + `lab_resource_capabilities` + `lab_allocation_items` (`§26` keputusan 1) |',
    '| `learning_products` (`0014`) | **KALAH** — "luaran" sudah dua kali dipegang dokumen ini: luaran pembelajaran oleh OBE, luaran karya oleh bentuk TA | `course_outcomes`/`program_outcomes` (`0032`) dan `final_project_outputs` (`§22`) |',
    '| `payment_plans` (`0015`) | **KALAH** — termin + jatuh tempo + jumlah per termin sudah dimiliki tabel yang berjalan | `invoice_installments(invoice_id, seq, due_on, amount_rupiah)`; aturan "jumlah termin = nilai induk" dijaga pemicu (`§26.3`) |',
  ];
  if (!lines[ai + 1].includes('concentrations sebagai tabel induk')) lines.splice(ai + 1, 0, ...add);
  dm = lines.join(NL);
  console.log('DATA_MODEL §22.10: 4 vonis kalah ditambahkan');
}

const stale = '`reference_dictionary_entries` (`0028`, masih `CRD-6`) saat DDL-nya terbit';
if (dm.includes(stale)) {
  dm = dm.replace(stale, '`reference_dictionary_entries` (`0028`, DDL ditulis §26.11 — berkasnya belum ada)');
  console.log('DATA_MODEL: rujukan CRD-6 yang lama dicabut');
}
writeFileSync(dmPath, dm, 'utf8');

// ---------- 3. ROADMAP: CRD-6 ditutup dengan alat ----------
const rmPath = 'docs/ROADMAP_TASKS.md';
let rm = readFileSync(rmPath, 'utf8');
const crd6 = rm.split(NL).findIndex((l) => l.includes('**`CRD-6`'));
if (crd6 < 0) fail.push('baris CRD-6 tidak ditemukan');
else {
  const lines = rm.split(NL);
  lines[crd6] = '- [x] **`CRD-6` — nama objek ber-nomor migrasi yang masih tanpa DDL.** *Isi:* menulis DDL `0013`–`0018`, `0022`–`0025`, `0028`, `0029`. **Ditutup 2026-10-21:** `DATA_MODEL §26` (sub-bagian §26.1–§26.12) menulis DDL untuk 43 objek yang masih berlubang di awal siklus ini, dan `node .tools/ddl-gap.mjs` mencetak `TANPA DDL = 0` atas 111 nama ter-registrasi; empat nama dinyatakan **KALAH** dengan alasan yang dibaca di `§22.10`, bukan dihapus diam-diam. `node .tools/fk-audit.mjs` tetap `0` rujukan menggantung. *Yang TIDAK berubah:* berkas `.sql` di disk tetap 7 (`G-02`) — yang tertutup adalah spesifikasi, bukan eksekusi.';
  rm = lines.join(NL);
  console.log('ROADMAP: CRD-6 ditandai selesai dengan bukti alat');
  writeFileSync(rmPath, rm, 'utf8');
}

if (fail.length) { console.error('MERAH — ' + fail.join(' | ')); process.exit(1); }
