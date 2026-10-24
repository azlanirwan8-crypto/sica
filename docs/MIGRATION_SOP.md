# SICA Database Migration SOP & DDL Safety Standard
**Status:** Mandatory Engineering Standard  
**Role:** Lead Database Administrator & Infrastructure Lead  
**Target Engine:** PostgreSQL 16 dengan Row-Level Security (RLS)  
**ORM Tool:** Drizzle ORM (`drizzle-kit`)  

---

## 1. Aturan Mutlak & Larangan Keras (Strict Prohibitions)

Seluruh developer, DevOps, dan AI Coding Agent **DILARANG KERAS** menjalankan tindakan-tindakan berikut di seluruh environment (Development, Staging, dan Production):

1. **Dilarang menggunakan perintah destruktif:**
   - `drizzle-kit push --force` (dilarang; gunakan migrasi SQL versioned yang direview).
   - `prisma migrate reset --force` / `db:drop` (Dilarang keras karena menghapus seluruh data dan kebijakan keamanan RLS).
   - `DROP DATABASE` atau `DROP SCHEMA public CASCADE`.
2. **Dilarang melakukan modifikasi skema ad-hoc tanpa file `.sql`:**
   - Mengubah tipe kolom atau menambah tabel langsung via GUI (DBeaver, pgAdmin) tanpa file versi migrasi tercatat di git.
3. **Dilarang membuat tabel baru tanpa Row-Level Security (RLS):**
   - Setiap tabel baru yang menyimpan data bisnis institusi wajib mengaktifkan RLS dan memasang kebijakan isolasi tenant.

---

## 2. Alur Kerja Standar Penambahan / Perubahan Skema (SOP)

Setiap perubahan struktur tabel harus mengikuti siklus 4 tahap yang aman (*deterministic and backward-compatible*):

```
[1. Modifikasi TypeScript Schema] ──> [2. Generate File SQL Terpisah] ──> [3. Review RLS & Lock Timeout] ──> [4. Eksekusi Migrasi]
  (packages/database/src/schema)        (packages/database/migrations/*.sql)    (Set lock_timeout = 3000ms)     (pnpm db:migrate)
```

### 2.1 Tahap 1: Modifikasi Skema TypeScript
Lakukan perubahan pada file skema yang relevan di `packages/database/src/schema/*`.
- Gunakan tipe data eksplisit (contoh: `bigint` untuk mata uang rupiah, `timestamp with time zone` untuk waktu).
- Sertakan `tenant_id` pada tabel tenant-domain; pengecualian katalog global hanya menurut registry DATA_MODEL dan diuji privilege/policy-nya.

### 2.2 Tahap 2: Generate File Migrasi `.sql` Terpisah
AI Agent dan developer **wajib mengekstrak perubahan menjadi file `.sql` independen** menggunakan CLI:

```bash
cd packages/database
pnpm drizzle-kit generate
```

Perintah di atas akan menghasilkan file baru di direktori `packages/database/migrations/`. **Aturan nama yang berlaku (diralat 2026-10-19 — `RD-20`): `NNNN_nama_perubahan.sql` dengan nomor urut empat digit**, karena executor membaca daftar nama berkas ([packages/database/src/migrate.ts:38-45](file:///c:/SICA/packages/database/src/migrate.ts#L38-L45)) dan seluruh riwayat repo memakai pola ini (`0001`…`0011`). Format `YYYYMMDDHHMMSS_…` yang dulu ditulis di sini **tidak** dipakai dan tidak boleh dicampurkan; lihat registry resmi di §5.

### 2.3 Tahap 3: Review Checklist File SQL
Buka seluruh SQL dan identifikasi mode transaksi, lock implisit/eksplisit, rewrite, ukuran tabel, dependency dan versi pembaca lama/baru. **Zero service downtime adalah target teruji; zero table locks tidak mungkin dijanjikan.**

- Anggaran awal DDL pendek: `lock_timeout = '3000ms'`, `statement_timeout = '15000ms'`. Angka ini budget review, bukan benchmark; indeks besar/backfill boleh budget lebih panjang yang bounded, disetujui DBA dan diuji. Dilarang timeout unlimited atau retry storm.
- Indeks tabel panas: `CREATE INDEX CONCURRENTLY` di luar transaction block; tetap ada lock/I/O dan kemungkinan invalid index. Verifikasi definisi, validitas dan dependency sebelum retry. Indeks tenant-domain **wajib menempatkan `tenant_id` sebagai kolom pertama**. Tabel baru kosong boleh indeks transaksional setelah review.
- Tabel tenant: RLS `ENABLE` + `FORCE`, `USING` + `WITH CHECK`, privilege minimum dan tes tenant A/B/missing context. Policy restrictive saja tanpa permissive policy tidak memberikan akses; jangan menyalin template yang selalu default-deny sebagai bukti layanan berfungsi.
- Backfill ber-batch, checkpoint, idempoten; ukur lag/WAL/lock/pool dan hentikan saat budget terlampaui. Snapshot parameter/mapping harus berversi.

### 2.4 Tahap 4: Eksekusi Migrasi Terkendali
Perintah proyek `pnpm db:migrate` menggunakan `packages/database/src/migrate.ts`. **Perilaku nyata:** koneksi `DIRECT_DATABASE_URL ?? DATABASE_URL`, setiap SQL file dalam `sql.begin`, `SET LOCAL lock_timeout = '5s'`, ledger `_sica_migrations` berdasarkan nama. Runner belum menyediakan statement_timeout terpusat, checksum, serialisasi beberapa migrator, atau jalur non-transaksional.

Akibatnya **CREATE INDEX CONCURRENTLY tidak dapat dijalankan melalui runner sekarang**. Kebutuhan online-index merupakan gate implementasi runner/prosedur versioned non-transaksional terpisah, bukan izin SQL ad-hoc atau perubahan runner dalam tugas dokumentasi. Pastikan timeout efektif (file dapat mengubah setting), satu migrator aktif, checksum release manifest, serta koneksi direct/session migrator terpisah sebelum eksekusi. Transaction pooling tidak cocok untuk state session DDL; nomor port saja tidak membuktikan mode koneksi.

### 2.5 Database Terkelola (Supabase / Neon) — Peran & Privilege
Kemampuan role bergantung provider/proyek. Catatan historis blok `EXCEPTION WHEN others THEN RAISE NOTICE` pada migrasi lama **bukan** standar membiarkan privilege gagal; notice juga dapat disembunyikan runner. Gate harus gagal jika role/grant/RLS yang diwajibkan tidak terbentuk.

Runtime wajib role DML **NOBYPASSRLS**, tanpa DDL dan tanpa UPDATE/DELETE audit. `FORCE ROW LEVEL SECURITY` membatasi owner biasa, **tidak** superuser/BYPASSRLS; dev memakai role postgres tidak otomatis setara keamanan produksi. Uji dengan role runtime sebenarnya, bukan hanya tes owner. Role migrasi dan backup dipisah, hak lintas tenant hanya workflow berotorisasi. Credential hanya ENV terinjeksi dari secret manager/reference, tidak log atau ditulis ke dokumen.

---

## 3. Strategi Perubahan Kolom Non-Destruktif (Expand & Contract)

Jika Anda perlu mengubah tipe kolom yang sudah memiliki jutaan data produksi (misalnya mengubah `varchar` ke `enum` atau memisahkan nama kolom):

### Fase 1: Expand (Rilis V1.1)
1. Tambahkan kolom nullable/struktur baru berdampingan; reader dan writer N-1 tetap bekerja.
2. Pilih **satu pemilik** dual-write (service atau trigger), aturan konflik serta verifikasi hasil. Tidak semua migrasi perlu trigger.
3. Backfill bounded per batch dengan checkpoint, snapshot mapping, idempotensi, throttling dan budget WAL/lag/lock. Jangan menahan satu transaksi untuk seluruh tabel besar.

### Fase 2: Switch (Rilis V1.2)
1. Uji aplikasi N/N-1, mobile lama, worker dan payload/event/job versi lama-baru terhadap skema expand; readiness harus memeriksa kompatibilitas sebelum traffic switching.
2. Verifikasi backfill dan invariants; switch baca bertahap dengan rollback aplikasi masih mungkin. Drain request, SSE dan worker secara graceful, bukan membunuh transaksi agar rollout tampak cepat.

### Fase 3: Contract (Rilis V1.3)
1. Buktikan tidak ada reader/writer/job lama dan jendela rollback telah berakhir; minta approval DBA/pemilik layanan.
2. Validasi constraint secara bertahap bila didukung; pemasangan NOT NULL tetap dianalisis lock-nya. Hentikan dual-write hanya setelah konsistensi terverifikasi.
3. Destructive DDL dijalankan sebagai perubahan terpisah. **Tidak ada deployment aplikasi saat DROP/rename destruktif berlangsung.** Jika anggaran online gagal, gunakan maintenance window eksplisit; jangan menyebutnya zero downtime.

---

## 4. Prosedur Darurat & Rollback Migrasi

1. Header migrasi/release manifest memuat verifikasi, checksum, dependency, budget lock/statement, pemilik, dan strategi rollback aplikasi atau roll-forward data. Pernyataan “sudah diterapkan” harus ditopang ledger DB lingkungan tersebut; SQL ada di repo bukan bukti dijalankan.
2. Saat gate gagal, hentikan migrator/promosi, kembalikan trafik hanya ke artefak kompatibel skema expand, drain dan rekonsiliasi accepted jobs/lease/outbox. Jangan DROP kolom baru atau menghapus audit untuk menyamakan versi lama.
3. Uji restore dan RPO/RTO sebelum perubahan berisiko; jumlah 100.000 baris bukan satu-satunya pemicu. PITR cluster hanya untuk bencana platform berotorisasi, bukan rollback otomatis atau restore tenant tunggal.
4. **Tenant-authorized export/logical restore:** izin scoped, MFA/approval dan tujuan; snapshot konsisten, manifest tersamarkan + checksum/version, enkripsi dengan secret reference. Restore dulu ke staging terisolasi tanpa egress, verifikasi tenant boundary, FK/unique, totals integer, audit chain/chain head dan outbox/idempotensi; jangan replay pembayaran/email/Feeder historis.
5. Logical import produksi hanya sesudah dry-run/diff dan persetujuan tenant/DBA, freeze mutasi scoped bila perlu, checkpoint serta provenance audit. Tenant lain tidak boleh berubah. Detil acceptance smoke/failure/rollback dan pengukuran recovery di `DEPLOYMENT_DEVOPS §6.2–§6.3`; bukan restore seluruh cluster atas permintaan satu tenant.

---

## 5. Registry migrasi terukur (ditambah 2026-10-19)

Dasar temuan: [AUDIT_READINESS.md `RD-20`](file:///c:/SICA/docs/AUDIT_READINESS.md). Dua masalah sekaligus: (a) §2 di atas mewajibkan nama `YYYYMMDDHHMMSS_nama.sql`, sedangkan repo dan seluruh dokumen memakai prefix numerik berurut yang **diterapkan per daftar nama** oleh [packages/database/src/migrate.ts:38-45](file:///c:/SICA/packages/database/src/migrate.ts#L38-L45); (b) nomor **melompati 0007–0010** sementara `DATA_MODEL §14.1` merujuk berkas-berkas itu. Putusan: **nomor urut numerik menang**, aturan penamaan §2 diralat ke `NNNN_nama.sql`, dan lobang nomor diisi dengan pendaftaran resmi di bawah — bukan dengan membuat berkas hantu.

### 5.1 Snapshot historis 2026-10-19 (7 berkas saat itu, bukan inventaris kini)

Tabel ini riwayat. Status file terkini di §5.2.1; label penerapan lama tidak membuktikan DB staging/production. Kolom reversibel berarti kemungkinan struktural, **bukan izin DROP data/audit saat rollback aplikasi**.



| Nomor | Berkas | Isi | Expand-only | Reversibel |
|---|---|---|---|---|
| 0001 | `0001_init_rls_policies.sql` | fungsi `app.tenant_id()`/GUC `app.current_tenant`, tabel identitas & langganan, RLS+policy, role & grant (dengan `EXCEPTION` penelan — temuan `SEC-13`) | ya | parsial (DROP balik harus manual) |
| 0002 | `0002_academic_core.sql` | inti akademik: periode, prodi, kurikulum, matakuliah, kelas, jadwal, sesi, enrollment, nilai + RLS 20 tabel | ya | parsial |
| 0003 | `0003_people_biodata.sql` | dosen, tendik, alamat, wali (+ RLS) | ya | parsial |
| 0004 | `0004_entitlement_modules.sql` | katalog `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` (+ RLS; `REVOKE` katalog terbungkus `EXCEPTION`) | ya | parsial |
| 0005 | `0005_field_data_attendance_courses.sql` | perluasan field data Feeder: presensi & pecahan SKS | ya | ya (DROP COLUMN) |
| 0006 | `0006_member_role.sql` | enum `member_role` (carrier login) | ya | tidak (enum in use) |
| 0011 | `0011_rbac_scoped.sql` | enum `permission_verb`/`role_scope_kind`/`access_request_status`; 5 tabel RBAC; seed 222 izin + 15 role + **607** pasangan grant; RLS+FORCE 4 tabel ber-tenant | ya | **belum diterapkan** ke DB |

### 5.2 Yang direncanakan (nomor resmi, mengikat untuk dokumen lain):



| Nomor | Isi | Sumber spesifikasi | Status |
|---|---|---|---|
| `0007` | kamus `reference_kinds` + `reference_items` (enum `reference_domain`, dua indeks domain, RLS+FORCE pada `reference_items`; **kalender akademik BELUM** — `academic_calendars` tidak dibutuhkan slice yang sudah dibuka, jadi tidak dibuat diam-diam) | `DATA_MODEL §14.2` | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`; berkas bernama `0007_reference_dictionary.sql`) |
| `0008` | `course_prerequisites` + `course_equivalencies` | §14.1/§14.3 | ❌ |
| `0009` | `academic_rules` + `blockades` + `student_status_history` | §14.1 | ❌ |
| `0010` | `tenant_settings` (satu baris per tenant, RLS+FORCE; **`enrollment_schemes` BELUM** — pemilik layarnya R-3a BAAK, membuatnya sekarang = tabel tanpa pemanggil) | §14.3.1 | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`; berkas `0010_tenant_settings.sql`) |
| `0012` | `audit_logs` (+`audit_chain_head`), `outbox`, `idempotency_keys`, `login_events` | §14.7 gugus G | ✅ **berkas ditulis + diterapkan 2026-10-23** (Fase 1A `R-1`; pooler PG 17.11, bukti `PROGRESS_REPORT §5.68`) — `impersonation_grants` TIDAK ikut di sini (dipindah ke `0029` 2026-10-19, lalu ke `0083` 2026-10-23) |
| `0013` | `time_slots`, `buildings` + `rooms.building_id`; **`concentrations` dan `laboratories` KALAH** — pemiliknya berturut-turut kamus `reference_items(kind=konsentrasi)` (children sudah menyimpan `concentration_ref`) dan `rooms(room_type=LAB)` + `lab_resource_capabilities` + `lab_allocation_items` | §14.7 gugus A + `DATA_MODEL §26` keputusan 1 | ❌ berkas belum ada (`G-02`) — DDL `time_slots` + `buildings` **ditulis 2026-10-21** di [DATA_MODEL §26.1](file:///c:/SICA/docs/DATA_MODEL.md) |
| `0014` | OBE: `program_outcomes`, `course_outcomes`, `outcome_matrix`, `course_evaluation_plans`; **`learning_products` KALAH** — luaran milik `course_outcomes`/`program_outcomes` dan bentuk TA non-skripsi milik `final_project_outputs` | §14.7 | ❌ berkas belum ada — DDL `course_evaluation_plans` **ditulis 2026-10-21** di §26.2; tiga objek lain sudah ada sejak §16.2/`0032` |
| `0015` | `fee_tariff_groups`, `tuition_discounts`, `payment_channels`, `reconciliation_runs`, `billing_gate_rules`, `accounts`, `accounting_periods`; **`payment_plans` KALAH** — termin sudah dimiliki `invoice_installments(invoice_id, seq, due_on, amount_rupiah)` | §14.7 + `BENCH-*` | ❌ berkas belum ada — DDL empat objek baru **ditulis 2026-10-21** di §26.3; `accounts`/`accounting_periods` sudah ditulis `RD-07` |
| `0016` | `advisement_assignments`, `krs_amendments`, `exam_cards`, `mbkm_*`, `student_transfers`, `study_warnings` | §14.7 | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.4; `mbkm_conversions`/`mbkm_conversion_lines`/`mbkm_grade_mappings` sudah ada sejak `0033` |
| `0017` | `session_journals`, `attendance_appeals`, `room_reservations` + kolom sesi (`week_pattern`, `status`, `qr_*`) | §14.7 | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.5; bentrok ruang dijaga `EXCLUDE USING gist`, banding dijendela `window_ends_at` |
| `0018` | `grade_component_scores`, `grade_publish_states`, `grade_blanket_resets`, `semester_results`, `surveys`, **`survey_responses` (baru, `0018a`)** | §14.7 + `BENCH-87/88/98` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.6; `semester_results` turunan insert-only, `weight_used_bp` disalin saat hitung |
| `0019` | `graduation_applications`, `legalisation_requests`, `commencement_batches` — **`documents` DIHAPUS dari baris ini** (ralat 2026-10-21: nama yang sama terdaftar di `0019` dan `0020`; pemiliknya `0020`, aturan §1 `RD-06`) | [DATA_MODEL §23.4](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis**, AUD-09 selesai | ❌ belum dieksekusi (`G-02`) |
| `0020` | `attachments`, `import_runs`, `documents`, `document_number_sequences` | [DATA_MODEL §23.1](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 baris "G platform/lampiran" + `RD-27`) | ❌ — **paling awal di antara gelombang baru**: `virtual_accounts`, `pmb_documents`, `receipts`, `student_activities`, `pddikti_correction_requests` menunjuk `attachments` |
| `0021` | PMB: `pmb_waves`, `pmb_paths`, `pmb_program_quotas`, `pmb_applications`, `pmb_documents`, `pmb_selection_results`, `pmb_reregistrations`, `pmb_school_origins`, `pmb_appeals`, `nim_assignments` | [DATA_MODEL §23.2](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 dua baris PMB + `BENCH-01…18`) | ❌ — belum terjadwal (usulan slice ADM-13); `pmb` sudah di-seed di `0004:83` **tanpa satu pun tabel** (`P-10`) |
| `0022` | Kanal & bukti keuangan: `virtual_accounts`, `payment_windows`, `payment_allocations`, `receipts` | §14.7 + `BENCH-19/20/21/24/33/34` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.7; `UNIQUE (bank_code, va_number)` tetap **global antar-tenant** |
| `0023` | Visibilitas KRS: `class_distributions`, `krs_packages`, **`krs_package_lines` (baru, `0023a`)** | §14.7 + `BENCH-35/41/47` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.8; invariance I-12 ditegakkan service + indeks lookup; `krs_baskets` tetap pindah ke `0030` |
| `0024` | Jadwal ujian: `exam_schedules`, `exam_participants` | §14.7 + `BENCH-60/84` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.9; `EXCLUDE USING gist` untuk ruang, tiga tanggal cetak/H-H pada peserta, dan FK `exam_cards.exam_schedule_id` ditunaikan di sini |
| `0025` | `lecturer_attendances` | §14.7 + `BENCH-66/74` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.10; `UNIQUE (class_session_id, lecturer_membership_id)` menutup jam ganda di BKD |
| `0026` | Kemahasiswaan & SKPI: `activity_kinds`, `achievement_levels`, `certification_records`, `publication_records`; **`student_activities` KALAH** kepada `activity_participations` (`0064`) — ralat 2026-10-21 | [DATA_MODEL §23.5](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** (§14.7 + `BENCH-112/113/114/131`) | ❌ — menunggu `G-11` (modul `student_affairs`) |
| `0027` | Kelulusan lanjutan: `yudisium_batches`, `thesis_records`, `thesis_supervisors`, `thesis_examiners`, `transcript_versions`, `transcript_lines` | [DATA_MODEL §23.3](file:///c:/SICA/docs/DATA_MODEL.md) — DDL **sudah ditulis** 2026-10-21 (§14.7 + `BENCH-100/101/102/111/117`) | ❌ — nama matakuliah **pada saat terbit** dipersist (kewajiban arsip BR-R12) |
| `0028` | Jembatan Feeder: `feeder_bridges`, `feeder_jobs`, `feeder_identities`, `feeder_credentials`→**Referensi Vault saja**, `feeder_environments`, `reference_dictionary_entries`, `reference_dictionary_versions` | §14.7 + `BENCH-127/128/130/131/135` | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.11; dua tabel kamus kelas B sengaja **platform-global** (pengecualian `AGENTS §3.2` dinyatakan beserta alasannya), isi muatan tetap `[VERIFIKASI-VENDOR]` |
| `0029` | `notification_preferences`, `notification_templates`, `notifications`, `notification_deliveries`, `student_guardians.consent_*` | §14.7 baris "G portal/silang" (dipindah dari `0012`) | ❌ berkas belum ada — DDL **ditulis 2026-10-21** di §26.12; alamat penerima disimpan sebagai hash. **`impersonation_grants` DIKeluarkan dari baris ini (2026-10-23)** → `0083`; FR-ADM-13 tidak boleh menunggu 17 nomor di bawahnya |
| `0083` | `impersonation_grants` (satu tabel dengan `platform_support_grants` — vonis RD-32; `grant_kind` membedakan) + enum `imperson_state` + `idx_imperson_active` | §26.12 + FR-ADM-13 + `BLUEPRINT_ROLE_BY_ROLE` §1.7 (DoD `R-1`) | Berkas ada; laporan penerapan dev 2026-10-23 di §5.2.1 adalah riwayat, bukan verifikasi lingkungan kini. **Penomoran ulang sah**: `RD-20` mengizinkan selama nomor lama belum dieksekusi; preseden yang sama — `0011` dieksekusi mendahului `0007`–`0010` (§5.2.1). FK `ticket_id`→`helpdesk_tickets` DITANGGUH sampai `0051` mendarat (expand-and-contract, §26.12) |
| `0084` | `mfa_factors` diselaraskan ke kanonik §3 (rename `factor_type`→`kind`, `secret text`→`credential_encrypted bytea`, +`tenant_id`, +`label`/`last_used_at`/`revoked_at`, DROP `is_primary`, RLS `ENABLE`+`FORCE`) + tabel baru `mfa_challenges` sekali-pakai (TTL ≤10 menit, `attempts ≤ 5`) | §3 (amandemen 2026-10-23) + API_SPEC §2.3 baris 144 syarat ke-1/2/4 + `SEC-14` | Berkas ada; penerapan dev 2026-10-23 dilaporkan historis §5.2.1, belum diverifikasi ulang (prasyarat MFA tulis-platform). **Secret belum terbungkus KMS** — `bytea` menyimpan base32 mentah sampai `0035`/`TENANT_ENCRYPTION_MASTER_KEY` ada; dilarang menyebutnya terenkripsi |
| `0030` | Lease & perebutan kursi KRS: `krs_baskets` (lease TTL + riwayat state di barisnya), `krs_offering_seats`, `queue_operations` | §16.1.2/§16.1.3/§16.1.4 + `BENCH-41`, I-2, `AC-KRS-3`, keputusan `P-1`/`P-6` | ❌ — **harus pertama** di antara `0030`–`0035`: `0031` bagian A, `0033`, dan `0034` menunjuk `queue_operations`. `UNIQUE (tenant_id, kind, idempotency_key)`; baris terminal tidak pernah di-UPDATE |
| `0031` | Staging PDDikti: tujuh `pddikti_staging_*`, `pddikti_payload_snapshots`, `pddikti_reconciliation_diffs` (bagian **A**); view `pddikti_validation_runs` + `pddikti_staging_status` (bagian **B**) + ALTER `pddikti_sync_runs`/`pddikti_validation_findings` | §16.4 + INTEGRATIONS §1.4–§1.9, `BENCH-127…135` | ⚠ — bagian A boleh lebih dulu; **bagian B menunggu `0028`** (DDL `feeder_jobs`/`feeder_identities`). Staging **append-only** (`REVOKE UPDATE, DELETE`) dan **tanpa kolom `feeder_id`** (I-14 ditegakkan bentuk skema) |
| `0032` | Rantai outcome OBE: `graduation_profiles`, `assessment_indicators` (+ FK berantai ke `program_outcomes`/`course_outcomes`/`outcome_sub_components` dari `0014`) | §16.2.1/§16.2.4 + FR-P2-13 | ❌ — Item Penilaian **adalah** `grade_components`; `assessment_items`/`outcome_items` kalah (§14.8). Bobot "100 per CPL per kurikulum" dijaga service + pemicu deferrable |
| `0033` | Konversi MBKM: `mbkm_conversion_lines`, `mbkm_grade_mappings` (+ `mbkm_conversions` dari `0016`) | §16.2.2 + `BENCH-86`, BR-A2/BR-G6/BR-R2 | ❌ — tiga orang berbeda pada satu konversi (SoD); huruf hasil wajib ada di `grade_scale_bands`; peta nilai `EXCLUDE numrange` (tidak ber-irisan); plafon `sks_recognized` dibatasi **di DB**. Bergantung `0016` + `0030` |
| `0034` | Jejak insert-only: `grade_change_logs`, `system_audit_trails` + fungsi `app.reject_mutation()` | §16.3.1–§16.3.3 + SECURITY §3.6, `SEC-19`, `RD-21` | ❌ — `PARTITION BY RANGE (occurred_at)`, `PRIMARY KEY (id, occurred_at)`, **tanpa `updated_at`**; rantai `audit_chain_head` berkunci `(tenant_id, partition_start, stream)`. **Urutan lapis mengikat:** `REVOKE` → policy `INSERT/SELECT` → pemicu → kelas retensi. Bergantung `0012` + `0030` |
| `0035` | Amplop PII: `tenant_encryption_keys`, `encryption_key_events`, `student_bank_accounts`, `bulk_export_requests`, fungsi `app.enc_key_version()` + kolom `*_encrypted`/`*_bidx` (termasuk `students.mother_name_*`) | §16.3.4–§16.3.7 + SECURITY §3.7, `RD-25` | ❌ — **BLOKIR di level lingkungan**: `TENANT_ENCRYPTION_MASTER_KEY` belum ada di `src/config/env.ts` dan `@aws-sdk/client-kms` belum terpasang (`RD-11`); jangan menulis gugus ini sebagai "siap" |
| `0047` | Master Data Engine: 14 kolom mesin pada `reference_kinds` (`api_group_code`, `input_kind` + CHECK tertutup, `min/max_selections`, `validation_regex`, `feeder_dict_path`, `entity_type`, jendela aktif, `version`, empat-mata `approved_*`) + 9 kolom pada `reference_items` (`feeder_code`, `is_system`, `merged_into_id` anti-diri, `points numeric(6,2)`, jendela) + `reference_kind_usage` (global; UNIQUE lewat indeks ekspresi `COALESCE`) + view `master_lookup_groups`/`master_lookup_items` **`security_invoker = true`** | §20.3 | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`) |
| `0048` | Atribut kustom: `tenant_custom_attributes` (RLS+FORCE; CHECK `options_kind` wajib-hanya-untuk-pilihan, PII `SPECIFIC` menolak isi-mandiri, empat-mata saat `ACTIVE`) + `custom_attribute_history` insert-only + `attributes jsonb` + GIN pada tabel induk yang **sudah ada** — `invoices` belum dimigrasikan sehingga dilewati dan **dicetak lewat `RAISE NOTICE`**, bukan didiamkan | §20.5 | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`) |
| `0049` | `master_system_parameters` (tiga kolom *generated* bertipe, `risk_class`, `CHECK (is_secret = false)`, `CHECK (source_of_truth <> 'ENV')`, penyetuju kedua REGULATORY/SECURITY) + `master_system_parameter_history` (ber-alasan, ber-IP, ber-penyetuju) | §21.2 | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`) — **RALAT**: `data_type` harus didahulukan dari kolom generated, dan CHECK `parameter_value` versi dokumen tidak dikompilasi PostgreSQL → diperbaiki `0086` |
| `0050` | Tata kelola menu: `menu_items` (`route_key`, `requires_mfa`, anti-siklus langsung) + `menu_permissions` (allowlist, FK **ke katalog `permissions`** sehingga tidak bisa menciptakan kosakata izin, `scope_kind` memakai `''` bukan NULL) + `parameter_permissions` (pola tervalidasi regex, `note` wajib, empat-mata) | §21.7 | ✅ **ditulis + diterapkan 2026-10-23** (`R-2`) |
| `0085` | Perluasan katalog RBAC untuk basis data yang sudah menjalankan `0011`: 257 izin + grant baris 127–161 — **DITULIS GENERATOR** (`gen-rbac-seed.mjs --expand=…`); blok di `0011` tetap diregenerasi agar replay dari nol identik | `RBAC_MATRIX §4.5` 127–161 | ✅ **diterapkan 2026-10-23**; 12 asersi grant terverifikasi per-tenant, termasuk empat vonis NEGATIF (`HEAD_OF_PROGRAM`/`TREASURER`/`PLATFORM_OPERATOR` tidak memegang `settings.param.edit.*`) |
| `0086` | Perbaikan CHECK `parameter_value`: versi dokumen `~ '^[^[:cntrl:]]{0,4000}$'` gagal dikompilasi (batas pengulangan regex PostgreSQL = 255 → SQLSTATE 2201B) sehingga **menolak setiap insert**; diganti `!~ '[[:cntrl:]]' AND length(...) <= 4000` | §21.2 (Ralat 2026-10-23) | ✅ **diterapkan 2026-10-23** — `0049` TIDAK disunting karena sudah tercatat berjalan |
| `0087` | Policy `global_read` (`FOR SELECT USING (true)`) untuk katalog global `permissions`, `modules`, `reference_kinds`, `reference_kind_usage` + `GRANT SELECT`/`REVOKE INSERT..` untuk `sica_app`. Akar: pooler hosted memasang `relrowsecurity = true` pada SETIAP tabel baru, dan tabel ber-RLS tanpa policy itu default-deny sementara `sica_app` `NOBYPASSRLS` | §6.2 | ✅ **diterapkan 2026-10-23** — dibuktikan `db:test:rls`: baca diizinkan, tulis → 42501 |

### 5.2.1 Status eksekusi registry (diukur ulang 2026-10-23).

**Riwayat 2026-10-23:** laporan saat itu mencatat 19 berkas diterapkan ke dev (`PROGRESS_REPORT §5.66/§5.68`). Itu bukan pemeriksaan DB pada sinkronisasi ini. Status “diterapkan” bertanggal di §5.2 adalah riwayat lingkungan tersebut, bukan jaminan staging/production.

**Inventaris filesystem yang diperiksa sekarang: 23 berkas**: `0001`–`0007`, `0010`–`0012`, `0047`–`0050`, `0082`–`0090`. Tambahan yang belum tercakup tabel historis: `0082_access_request_kind.sql`, `0088_parameter_approvals.sql`, `0089_rbac_expand_param_governance.sql`, `0090_parameter_pointer_home.sql`. Ada berkas tidak berarti telah diterapkan; verifikasi `_sica_migrations`, checksum dan definisi objek pada lingkungan tujuan tetap diperlukan tanpa membuka secret.

Rentang `0008`–`0009`, `0013`–`0046`, `0051`–`0081` masih tidak memiliki file pada pemeriksaan ini. Khusus **0030** adalah gate KRS lease/queue, bukan alasan menjalankan basket Redis-only. Jangan menebak nomor baru dari maksimum snapshot lama; registry DATA_MODEL dan filesystem harus dibandingkan. Migrasi yang sudah diterapkan tidak boleh disunting untuk menutupi drift.

### 5.3 Yang masih tanpa nomor — daftarkan sebelum menulis:

`retention_rules` kelas `pmb_applicant`, `deposit` lifecycle, dan kolom perluasan yang tercatat di [AUDIT_READINESS §4](file:///c:/SICA/docs/AUDIT_READINESS.md) tetapi belum naik ke §14.7. Nomor final ditetapkan oleh [DATA_MODEL §14.7](file:///c:/SICA/docs/DATA_MODEL.md), bukan oleh penulis migrasi, dan **satu nomor = satu nama berkas** — `0020_finance_channels_receipts` yang sempat tertulis di §5 adalah salah tik dari `0022` dan sudah diralat 2026-10-19.

### 5.4 Aturan executable (pengganti "buat berkas rollback" yang hari ini nol pelaksanaannya).


1. Satu migrasi = satu gugus domain; **tidak boleh** mencampur objek silang (mis. menggabung gugus G ke `0012` sekaligus menolak larangan sendiri — `RD-20`).
2. Expand-only: tambah tabel/kolom/indeks konstan; contracting (DROP) hanya di rilis berikutnya, minimal satu siklus setelah rilis stabil.
3. Replay harus diuji dari kosong dan dari versi sebelumnya. `IF NOT EXISTS` hanya memeriksa nama, bukan kesamaan definisi; jangan menutupi drift atau drop/recreate policy tanpa review. Migrasi yang sudah diterapkan tidak diubah; perbaikan masuk migrasi baru, checksum/definisi diverifikasi.
4. Setiap migrasi wajib membawa **pernyataan verifikasi** (query `SELECT count(...)`/`EXPLAIN` target) yang ditulis di header berkas, sehingga "sudah diterapkan" dapat dibuktikan, bukan dipercaya.
5. Tidak ada migrasi domain yang berjalan sebelum tabel induknya ada di registry — urutan `0007 → 0008 → … → 0035` mengikat; `0011`, `0012`, dan `0020` adalah gerbang (RBAC, audit/outbox, dan `attachments` yang ditunjuk enam gugus). Untuk gelombang enterprise: **`0030` lebih dulu** dari `0031` bagian A, `0033`, dan `0034`, dan `0031` bagian B tidak boleh mendahului `0028`.
6. Generator RLS §6.2 `DATA_MODEL` harus sudah diperbaiki (`RD-02`: `c.column_name`, daftar pengecualian) **sebelum** migrasi berikutnya memakai pola itu.

## 6. Enam puluh lima nomor ke depan dan lima migrasi kanal + siklus hidup (audit dewan 2026-10-21)

**Rencana historis 2026-10-21, bukan inventaris hari ini.** Angka tujuh file/70 nomor tertunda pada audit lama telah kedaluwarsa; file yang diperiksa sekarang dicatat §5.2.1. Daftar berikut tetap rencana sampai file/dependency serta ledger lingkungan dibuktikan. DDL dalam DATA_MODEL bukan migrasi yang telah dijalankan, dan urutan penulisan tidak boleh dianggap urutan deploy produksi.

### 6.1 Tiga migrasi kanal vicon (`0073`–`0075`)

| Nomor | Isi | Pola | Alasan pilihan itu |
|---|---|---|---|
| `0073_conference_channels.sql` | enum `conference_provider` + `conference_connections` + `conference_meetings` + `conference_channel_events` + ALTER `classes.virtual_meeting_provider` (ADD COLUMN baru) + 3 baris parameter | **Expand** | kolom lama tidak dihapus; sistem masih bisa berjalan sebelum kontrakt jelas |
| `0074_attendance_channel_evidence.sql` | `attendance_channel_evidence` + `ALTER attendances ADD COLUMN review_state DEFAULT 'NONE'` | **Expand** | ADD COLUMN default konstan/non-volatile dapat menghindari rewrite pada versi PG yang mendukung, tetapi tetap mengambil lock metadata. Verifikasi plan/versi dan budget timeout; bila tidak aman, expand nullable + backfill + validasi constraint terpisah |
| `0075_modality_vocabulary_fix.sql` | rename `classes.delivery_mode` → `learning_modality` + pemetaan alias `HYBRID`→`BLENDED`, `OFFLINE`→`ONSITE`, `TEAMS`→`MICROSOFT_TEAMS`, `BUILTIN`→`BUILTIN_LMS`, `MEET`→`OFFLINE_MEET` pada CHECK | **Expand-and-Contract** dalam dua rilis | Release A: tambah kolom/nilai baru + backfill + views kompatibilitas; Release B (setelah nol pembaca kolom lama terverifikasi): `DROP` kolom lama. Tidak ada rename satu langkah di tabel yang dibaca Feeder/LKPS |

### 6.2a Tiga migrasi geografi sesi & jaminan sosial (`0078`–`0080`) — lahir di [DATA_MODEL §24](file:///c:/SICA/docs/DATA_MODEL.md)

| Berkas | Isi | Tipe | Catatan penegakan |
|---|---|---|---|
| `0078_session_geography.sql` | enum `geo_source` + `geo_surface` + `session_geo_facts` (insert-only) + view `session_geo_live_buckets` + 2 indeks | **Expand** | `REVOKE UPDATE, DELETE` + `app.reject_mutation()` sebelum policy; view WAJIB `security_invoker = true` (dibuktikan query CI §24.4 butir 6, bukan dipercaya); tidak ada kolom IP mentah di mana pun; peta tidak boleh dibuka sebelum `GEOIP_DB_PATH` sah dan `analytics.map.enabled` boleh bernilai `false` dengan layar degradasi |
| `0079_social_insurance.sql` | enum `remittance_state` + `social_insurance_participations` + `social_insurance_contributions` + 3 indeks | **Expand** | tarif disimpan sebagai **basis poin + masa berlaku**, bukan angka yang ditetapkan dokumen ini dan bukan CHECK daftar string; nomor peserta = PII spesifik (blind index + terenkripsi, `SECURITY §7`); ketergantungan ke `reference_dictionary_entries` (`0028`) dinyatakan sebagai penahan `CRD-6`, bukan disembunyikan |
| `0080_ewmp_sync.sql` | enum `ewmp_sync_state` + `ewmp_sync_batches` + 2 indeks | **Expand** | muatan ditandai `[VERIFIKASI-VENDOR]`: hanya digest, state, empat-mata, dan idempotensi yang dibuat; field EWMP naik sebagai migrasi Expand tersendiri (`0081`) setelah spesifikasi SISTER terverifikasi — bukan `ALTER` diam-diam |

Ketiganya bersifat expand. Rollback aplikasi tidak mengharuskan DROP; objek berisi data/audit tidak boleh dihapus. Penghapusan hanya lewat contract berotorisasi sesudah verifikasi tidak ada data/dependency dan jendela rollback berakhir. Urutan: `0020` (lampiran) → `0054` (gaji) → `0079` → `0078` → `0080`; `0079` mendahului `0078` hanya bila peta dipakai di layar payroll, yang hari ini tidak demikian.

### 6.2 Dua migrasi siklus hidup (`0076`–`0077`) — lahir di [DATA_MODEL §23.6](file:///c:/SICA/docs/DATA_MODEL.md)

| Berkas | Isi | Tipe | Catatan penegakan |
|---|---|---|---|
| `0076_student_cards.sql` | enum `student_card_state` + `student_cards` + `student_card_events` (insert-only) + 2 indeks | **Expand** | `photo_attachment_id` menunjuk `attachments` (`0020`) sehingga KTM tidak punya jalur unggah kedua; `REVOKE UPDATE, DELETE` pada `student_card_events` + pemicu `app.reject_mutation()` (pola §16.3.3); RLS `ENABLE`+`FORCE`+`tenant_isolation` |
| `0077_tracer_study.sql` | enum `tracer_wave_state` + `tracer_survey_waves` + `tracer_questions` + `tracer_responses` + `tracer_employment_records` + 3 indeks | **Expand** | modul `tracer_iku` sudah ter-seed di `0004:83` tanpa model data (`P-10`): nomor ini adalah harga yang harus dibayar sebelum modul itu boleh dijual; `consent_given = false` tidak boleh terbaca lewat proyeksi M-28 (uji penolakan `403`, bukan uji filter); `external_organization_id` wajib menunjuk `0053`, tidak ada nama perusahaan yang diketik bebas |

Kedua berkas **tidak** menyentuh kosakata modus/kanal, jadi ia tidak bergantung pada `0075` Release A/B. Urutan eksekusi: `0020` → `0021` → `0027` → `0019` → `0076` → `0077`, karena `student_cards.series` dan `pmb_applications.application_number` memakai `document_number_sequences` dan `nim_assignments` memakai sequence per prefix (§23.2).

### 6.2b Satu migrasi analitik lokal (`0081`) — lahir di [DATA_MODEL §25](file:///c:/SICA/docs/DATA_MODEL.md)

| Berkas | Isi | Tipe | Catatan penegakan |
|---|---|---|---|
| `0081_anomaly_detection.sql` | enum `anomaly_domain` + `anomaly_agreement` + `anomaly_verdict` + `anomaly_findings` + `anomaly_feedback_labels` (insert-only) + `anomaly_domain_settings` + 3 indeks + 3 baris parameter `ai.anomaly.*` | **Expand** | dua tabel pertama di-`REVOKE UPDATE, DELETE` + pemicu `app.reject_mutation()` sebelum policy; `is_active` **baku false** dan menyala butuh `approved_by <> requested_by` yang ditegakkan `CHECK` DB; tidak ada kolom yang menerima skor dari perangkat (`SERVER_ONLY`) |

Urutan: `0036` (`engine_runs` pemilik harness) → `0049` (parameter) → `0081`. Tanpa `0036`/`0049` diterapkan, `0081` gagal dibuat — dan itu sebabnya tiket `AI-1` di `ROADMAP §2.24` berstatus tertahan `G-02` meskipun DDL-nya sudah lengkap.

### 6.3 Empat penjaga yang berlaku untuk kelima nomor

1. **Nomor diukur sebelum ditulis.** Bandingkan registry DATA_MODEL, filesystem dan ledger lingkungan. Maksimum 0081 pada 2026-10-21 adalah historis; 0082 sudah ada, begitu pula hingga 0090 (§5.2.1). Nomor baru memerlukan registrasi pemilik, bukan tebakan generator.
2. **Enum staged:** nilai hasil `ALTER TYPE … ADD VALUE` tidak boleh digunakan sebelum transaksi penambahannya commit. Pisahkan penambahan dan pemakaian dalam migrasi/transaksi kompatibel; jangan rename/drop kosakata yang masih dibaca N-1/job lama. Katalog provider tetap milik DATA_MODEL.
3. **Rollback teruji:** 0073/0074 tidak di-DROP sebagai rollback aplikasi jika sudah memuat data. Setelah contract 0075 Release B, artefak yang membaca kolom lama tidak boleh dipulihkan langsung. Utamakan roll-forward; kebutuhan restore melalui approval dan isolated restore + logical reconciliation §4, **bukan PITR seluruh tenant otomatis**.
4. **Gerbang data:** verifikasi query DATA_MODEL §21.10.5, referensi kolom lama, serta semua worker/job/client yang masih hidup sebelum contract. CI dan hasil rehearsal harus tersedia; kalimat SOP bukan bukti gate telah terpasang.
