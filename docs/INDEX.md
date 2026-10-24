# SICA — Indeks Dokumentasi & Peta Penelusuran Silang (Cross-Reference)

Dokumen ini adalah panduan navigasi utama untuk arsitek, developer, product manager, dan auditor sistem **SICA**. Deskripsi menunjuk cakupan spesifikasi, bukan sertifikat bahwa setiap fitur sudah berjalan; status audit terkini dirujuk melalui §8.2.

---

## 1. Peta Dokumen Resmi SICA

| Dokumen | Deskripsi & Fokus Utama | Target Pembaca |
|---|---|---|
| **[PRD.md](file:///c:/SICA/docs/PRD.md)** | Product Requirements Document: Visi produk, Persona, User Journeys J1–J6, Ruang Lingkup MVP (Fase 1) & Phase 2, Katalog Aturan Bisnis (`BR-*`), Acceptance Criteria (`AC-*`), dan Non-Functional Requirements (`NFR-*`). | PM, Tech Lead, QA, Pimpinan PT |
| **[ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md)** | Technical Architecture Document: Architectural Decision Records (`ADR-1`–`ADR-10`), Diagram Arsitektur C4/L2, Tech Stack, Desain Multi-tenancy shared-schema + RLS, Struktur Folder Modular Monolith, dan Pipeline CI/CD. | Software Engineer, Solution Architect, DevOps |
| **[DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md)** | Database Specification & DDL: Skema relasional PostgreSQL 16 lengkap, definisi tipe ENUM, tabel isolasi tenant, penanganan concurrency OW, ledger append-only, graduation records, dan seed minimum. | Backend Engineer, DBA, Data Engineer |
| **[SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md)** | Security & Compliance Architecture: Zero-Trust, autentikasi dan sesi, RBAC+ABAC ber-scope, proyeksi PII, audit hash-chain dan DSAR. Memisahkan implementasi dari target kontrol serta referensi hukum yang belum diverifikasi; bukan sertifikasi OWASP/SOC 2/ISO atau pengesahan regulasi 2026. | Security Engineer, Compliance Officer, Auditor |
| **[GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md)** | Glosarium Istilah: Definisi istilah akademik kampus (OW, KRS, KHS, Yudisium), standar regulasi (SN-Dikti, PDDIKTI, Neo Feeder, PISN, SIVIL), akreditasi OBE (CPL, CPMK), dan konsep teknis. | Semua Anggota Tim & Stakeholder Baru |
| **[UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md)** | UI/UX & Design System: Adopsi Velzon Template (React/Next.js), Design Tokens, Color Palette, Dark/Light Mode, Komponen Baku Web, Pemetaan Material 3 Flutter Mobile (Digital KTM, QR Scanner Overlay, Schedule Cards), serta Grid Breakpoints. | UI/UX Designer, Frontend & Mobile Engineer |
| **[TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md)** | Engineering & Coding Conventions: Struktur folder Next.js App Router & Flutter Feature-First, State Management (TanStack Query + Zustand & Riverpod), Form Handling (RHF + Zod & Freezed), Drift SQLite, dan Aturan Penamaan Strict. | Frontend, Backend, & Mobile Engineers |
| **[API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md)** | REST API Contract: Standard Response Envelope (Success/Error), Definisi Zod Schemas TypeScript, Endpoint MVP Lengkap (Auth, KRS, KHS, Transkrip, dan Dynamic Rotating QR Attendance dengan Haversine Geofencing). | Backend, Frontend, & Mobile Engineers |
| **[TESTING_STRATEGY.md](file:///c:/SICA/docs/TESTING_STRATEGY.md)** | Quality Assurance & Testing: Sasaran cakupan minimal 80%, Vitest + RTL & flutter_test + mocktail, pengujian deterministik kalkulasi IPK/SKS, integration test PostgreSQL RLS, dan security guards (401, 403, 422). | QA Engineer, Backend, & Mobile Engineers |
| **[DEPLOYMENT_DEVOPS.md](file:///c:/SICA/docs/DEPLOYMENT_DEVOPS.md)** | DevOps, CI/CD & Infrastruktur: Spesifikasi `.env.example` terpisah (Web, Mobile, Database), Strategi migrasi zero-downtime Drizzle 3-fase (Expand-and-Contract), dan GitHub Actions CI/CD Pipeline (Lint, Semgrep, Snyk, Vercel, Firebase). | DevOps, SRE, & Release Managers |
| **[ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md)** | Bug Resolution, RCA & Sanitasi Data: SOP Perbaikan Bug AI Agent, format log terstruktur Pino server trace vs Flutter Crashlytics, aturan 5 Whys RCA, serta kebijakan redaksi data sensitif (PII & JWT). | Semua Developer, AI Agents, & Support Ops |
| **[ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md)** | Implementation Task Tracker: Rincian checklist eksekusi proyek berurutan dari Phase 1 (Foundation & Auth), Phase 2 (Core Academic Web), Phase 3 (Mobile MVP & Dynamic QR), hingga Phase 4 (Hardening & Testing). | Tech Lead, Project Manager, & Software Engineers |
| **[PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md)** | Catatan kemajuan dan bukti bertanggal per siklus, dengan ralat klaim lama. Ringkasan terkini di §1, audit Fase 1 diperluas di §5.76; angka tes dan inventaris historis tidak dijadikan hasil pengukuran hari ini. | Stakeholder, Product Owner, & Engineering Team |
| **[RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md)** | **Sumber kebenaran hak akses**: peran ber-scope, enam verba kanonik, katalog bernomor versus izin usulan, menu/tombol/field, SoD dan pemisahan IT dari operasi. Jumlah normatif/terapan dicetak alat RBAC dan generator seed, tidak disalin sebagai konstanta di indeks. | Security Engineer, Backend, QA, DevOps |
| **[BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md)** | Benchmark Kompetitif & Spesifikasi Administrasi: studi dokumentasi Sevima (peran, menu per peran, katalog modul, `Data Pelengkap`/data master, fungsi operasional, tabel 20 pemetaan Feeder, model hak akses 6 aksi, model harga/hosting) + kondisi SICA terverifikasi + peta selisih + urutan pengerjaan Area Admin (ADM-1…ADM-9). | Product Owner, Architect, Backend, UI/UX |
| **[BLUEPRINT_ENTERPRISE.md](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md)** | **Cetak biru hasil dekonstruksi Sevima SIAKAD Enterprise**, 4 deliverable: (1) matriks RBAC 14 kolom peran × 7 gugus modul (A master data … G portal) dengan 10 aksi permintaan dipetakan ke 6 verba kanonik (§0.4); (2) tree menu `/admin/**` per peran + inventaris 21 modal; (3) peta field ±90 entitas untuk skema PostgreSQL; (4) 8 state machine (periode, KRS, tagihan, nilai, status mhs, yudisium, feeder, MBKM) + 10 invariance silang-alur. Termasuk §6.0 verifikasi realita kode dan urutan pengerjaan ADM-0…ADM-12. | Architect, Tech Lead, Backend, PM, QA |
| **[BLUEPRINT_ROLE_BY_ROLE.md](file:///c:/SICA/docs/BLUEPRINT_ROLE_BY_ROLE.md)** | **Blueprint eksekusi per-peran** (6 lapisan `R-1` platform · `R-2` admin IT + penataan RBAC · `R-3` BAAK & BAUK · `R-4` kaprodi/dekan/dosen/wali · `R-5` mahasiswa & ortu · `R-6` feeder & integrasi). Untuk tiap lapisan: pohon menu & sub-menu, **hak tingkat tombol** (10 aksi → 6 verba), **hak tingkat field** (`FIELD_RULES`, `SERVER_ONLY`, masking di proyeksi server), objek DB & endpoint terkait, kebutuhan komponen UI Velzon, edge case, dan Definition of Done. §7 matriks SoD (7 pasangan) + peta risiko IDOR per lapisan + hasil audit RLS; §8 milestone `SEC-0`/`DOC-0`/`R-1`…`R-7`; §9 10 gerbang verifikasi. | Tech Lead, Backend, Frontend, QA, Security |
| **[AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md)** | **Register temuan, bukti dan status penutupan**, termasuk audit lima perspektif internal Fase 1 diperluas (§15.11). Memisahkan perbaikan dokumen, implementasi dan validasi; readiness 48 modul dicetak alat di §20. Angka historis dan label SIAP bukan sertifikat produksi. | Architect, Security, QA, Product Owner, Tech Lead |
| **[SEED_DATA.md](file:///c:/SICA/docs/SEED_DATA.md)** | Fixture & Master Seed Data: Spesifikasi data dummy realistis Universitas Nusantara (2 Fakultas, 4 Prodi, 10 Dosen, 50 Mahasiswa, 20 Mata Kuliah, 10 Jadwal) dan akun pengujian default. | Developer, QA, & Database Administrator |
| **[INTEGRATIONS.md](file:///c:/SICA/docs/INTEGRATIONS.md)** | Enterprise External Integrations: PDDikti Neo Feeder Web Services, Payment Gateway Webhook (Midtrans/Xendit) auto-reconcile ledger, Messaging Queue (BullMQ WhatsApp/Email), & Pre-signed Cloudflare R2/S3. | Integration Architect, Backend, & Finance Engineers |
| **[ENV_CONTRACT.md](file:///c:/SICA/docs/ENV_CONTRACT.md)** | Environment Variables Strict Contract: Skema validasi fail-fast Zod untuk runtime Next.js dan compile-time Flutter, serta penegakan Zero Unvalidated `process.env` Access. | DevOps, SRE, & Platform Engineers |
| **[MIGRATION_SOP.md](file:///c:/SICA/docs/MIGRATION_SOP.md)** | Database Migration SOP: Standar migrasi skema non-destruktif Drizzle ORM, isolasi RLS wajib, isolasi lock timeout, dan larangan perintah destruktif (force-reset). | Database Administrator & Backend Engineers |
| **[GIT_WORKFLOW.md](file:///c:/SICA/docs/GIT_WORKFLOW.md)** | Version Control Standard: Strategi Branching (`main`, `staging`, `feature/*`), Standar Conventional Commits, dan Checklist Pre-commit Hook (Linter, Typecheck, Test) untuk AI. | Seluruh Tim Engineering & AI Agents |

---

## 2. Matriks Penelusuran Aturan Bisnis (`BR-*`)

Katalog aturan bisnis di `PRD.md` dipetakan ke penegakan konkret di `DATA_MODEL.md`, `ARCHITECTURE.md`, dan `SECURITY_COMPLIANCE.md`.

### 2.1 Aturan Regulasi Mengikat (`BR-R*`)
Aturan ini **tidak boleh dijadikan opsi kustomisasi** per tenant karena merupakan norma hukum nasional.

| Kode | Aturan Hukum & Regulasi | Lokasi Penegakan di Sistem |
|---|---|---|
| **BR-R1** | 1 SKS = 45 jam kerja/semester (SN-Dikti 39/2025 Ps 15) | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `courses.sks` |
| **BR-R2** | Plafon SKS: Sem 1–2 ≤20, Sem ≥3 ≤24, Antara ≤9 | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `study_programs.sks_cap_*`, `PRD.md`: `AC-KRS-1` |
| **BR-R3** | Beban minimum lulus: D1 36, D2 72, D3 108, S1 144 | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `study_programs.min_total_sks`, `graduation_records` |
| **BR-R4** | Masa studi maksimal 2× masa tempuh normal (S1 maks 16 sem) | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `study_programs.max_study_semesters` |
| **BR-R5** | Skala nasional A=4 B=3 C=2 D=1 E=0; ambang lulus ditetapkan PT | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `grade_scales`, `grade_scale_bands` |
| **BR-R6** | IPK lulus ≥2,00 (S1/diploma), ≥3,00 (S2/profesi); predikat oleh PT | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `study_programs.graduation_min_ipk`, `graduation_records` |
| **BR-R7** | Prodi wajib terakreditasi aktif untuk meluluskan mahasiswa | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `study_programs.accreditation_*`, [PRD.md](file:///c:/SICA/docs/PRD.md): `NFR-R1` |
| **BR-R8** | Ijazah wajib disertai Transkrip + SKPI & Penomoran Nasional PIN | [PRD.md](file:///c:/SICA/docs/PRD.md): `FR-P2-08`, [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `graduation_records.national_diploma_number` |
| **BR-R9** | Jendela pelaporan PDDIKTI per periode (rencana ≤2 bln, hasil ≤2 bln) | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `academic_calendar_events.kind`, [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md): §4.5 |
| **BR-R10** | Data PDDIKTI tidak ada hard delete; koreksi via validasi | [PRD.md](file:///c:/SICA/docs/PRD.md): `AC-AUD-1`, [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): `pddikti_sync_runs` |
| **BR-R11** | Operator Feeder diangkat rektor; kredensial tersimpan aman | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md): Role `FEEDER_OPERATOR`, [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md): §2.1 |
| **BR-R12** | Arsip rekaman kelulusan (ijazah/transkrip/SKPI) retensi **permanen** | [PRD.md](file:///c:/SICA/docs/PRD.md): `NFR-D1`, [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md): §2 diagram, [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md): §7 |
| **BR-R13** | Penyesuaian SN-Dikti 39/2025 maksimal Sept 2027 | [PRD.md](file:///c:/SICA/docs/PRD.md): §5.5 |
| **BR-R14** | Kepatuhan PP 33/2026 & UU PDP: DPIA, DPO, denda s.d. 2% aset | [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md): §7 |
| **BR-R15** | Dokumen hukum memakai TTE tersertifikasi (PSrE terakreditasi BSSN) | [PRD.md](file:///c:/SICA/docs/PRD.md): `NFR-R5`, `FR-P2-08`, [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md): §7.3 |
| **BR-R16** | Data dosen dikelola pusat/SISTER — PT tidak dapat membuatnya lewat Feeder | [INTEGRATIONS.md](file:///c:/SICA/docs/INTEGRATIONS.md) §1.4, [PRD.md](file:///c:/SICA/docs/PRD.md) §5.5 |
| **BR-R17** | Sebelas penolakan validasi Neo Feeder menahan sinkronisasi, ditegakkan **di titik input** | [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) §14.5 (`pddikti_validation_findings`), `AC-FDR-2` |
| **BR-G6** | **Dua angka IPK disimpan terpisah**: `ipk_kumulatif` (÷ SKS tempuh) dan `ipk_lulus` (÷ SKS lulus); mata kuliah berulang dihitung satu kali; predikat & gerbang yudisium memakai **IPK Lulus** | [PRD.md](file:///c:/SICA/docs/PRD.md) §5.5, `AC-NIL-2`🔒, delta `BENCH-85/86` |

### 2.2 Aturan Parameter Institusi (`BR-A*`, `BR-G*`, `BR-K*`, `BR-S*`, `BR-M*`)
Tersimpan di tabel `academic_rules.params` per prodi dan per periode akademik.

| Kode | Domain | Deskripsi Parameter |
|---|---|---|
| **BR-A1**–**BR-A9** | Administrasi & KRS | Jendela OW, tabel band SKS per IPS, prasyarat mata kuliah, gerbang tagihan, aturan denda, jenis cekal, kuesioner sebelum KHS, proteksi periode `CLOSED`. |
| **BR-G1**–**BR-G5** | Penilaian & KHS | Batas waktu input nilai (H+N), penanganan nilai kosong (`K`), presisi IP 2 desimal half-up, alur koreksi nilai terkunci, dan validasi komposisi nilai 100%. |
| **BR-K1**–**BR-K3** | Keuangan Kampus | Komponen tarif & UKT, dual-approval void invoice, serta pemetaan aksi akademik yang digerbangi tagihan. |
| **BR-S1**–**BR-S5** | Status Mahasiswa | Evaluasi peringatan akademik & DO, syarat cuti, syarat seminar/sidang TA, clearance pra-yudisium, dan syarat kelulusan. |
| **BR-M1**–**BR-M2** | MBKM & Mitra | Plafon konversi SKS MBKM (maks 20 SKS per semester) dan pembimbingan aktivitas luar kampus untuk pemenuhan IKU. |

---

## 3. Matriks Fitur MVP Fase 1 (`FR-*`)

| ID Fitur | Modul | Ringkasan Fungsional | Rujukan Skema / Kode |
|---|---|---|---|
| `FR-ADM-01..06` | Administrasi | Multi-tenant setup, periode akademik, kalender akademik, aturan per prodi, kurikulum & mata kuliah, struktur org & role ber-scope. | `tenants`, `academic_periods`, `study_programs`, `curricula`, `academic_rules` |
| `FR-ADM-07..13` | Administrasi (Area Admin) | Kamus data referensi, skema enrollment, meta-konfigurasi mandiri, panel Kesehatan Data, diagnostics "mengapa terkunci", impact-analysis pra-hapus, impersonation berjustifikasi. | `reference_items`, `enrollment_schemes`, `tenant_settings`, `audit_logs` — lihat [PRD §5.8](file:///c:/SICA/docs/PRD.md) & [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md) |
| `FR-PMB-01..11`, `FR-KUR-03`, `FR-AKA-22..29`, `FR-KEU-11..14`, `FR-DOC-04..05`, `FR-LOG-02..03`, `FR-KBM-03`, `FR-FDR-05..07`, `FR-P2-15` | Gelombang ketiga (validasi silang benchmark) | Alur PMB penuh (gelombang, jalur, berkas, seleksi, registrasi ulang, siklus NIM + daur ulang), sebaran kelas & jadwal ujian & status sesi, komponen nilai & publikasi & pemutihan, VA & alokasi pembayaran & kuitansi & tutup buku, aktivitas/prestasi/SKPI, baris transkrip persist, bridge & pull Feeder. | [PRD §5.8.2](file:///c:/SICA/docs/PRD.md) + delta `BENCH-*` di [AUDIT_READINESS §6](file:///c:/SICA/docs/AUDIT_READINESS.md); objeknya terdaftar di [DATA_MODEL §14.7](file:///c:/SICA/docs/DATA_MODEL.md) |
| `FR-ADM-14..16` | Administrasi (gelombang enterprise) | Transisi periode bertipe + reopen empat-mata, impor massal 3 langkah, skala nilai per prodi. | `period_reopen_requests`, `import_runs`, `grade_scales` — lihat [PRD §5.8.1](file:///c:/SICA/docs/PRD.md) & [BLUEPRINT §5 SM-1](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md) |
| `FR-AKA-19..21` | Akademik (gelombang enterprise) | Dispensasi/override ber-audit, kartu ujian (KPU), banding presensi. | `academic_rules`, `exam_cards`, `attendance_appeals` |
| `FR-KEU-08..10`, `FR-KBM-*`, `FR-MKM-01` | Keuangan & Kemahasiswaan | Cicilan/rencana bayar, rekonsiliasi otomatis + manual, keringanan non-tarif; modul `student_affairs` (aktivitas/poin/sanksi/clearance); kontrak & log MBKM dua-approval. | `payment_plans`, `reconciliation_runs`, `student_activities`, `mbkm_contracts` — celah `G-11`/`G-13` di [RBAC_MATRIX §8.2](file:///c:/SICA/docs/RBAC_MATRIX.md) |
| `FR-LOG-01`, `FR-DOC-03`, `FR-FDR-04`, `FR-IDT-05` | Kelulusan, dokumen & kepatuhan | Rantai yudisium→SK→PISN→Feeder ber-gerbang; SKPI + legalisir massal; antrean koreksi PDM; konsistensi verba `VALIDATE` (`unlock`/`reject`/`dispense`). | [BLUEPRINT §5 SM-6/SM-7](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md), celah `K-1`…`K-5` §6.0 |
| `FR-IDT-01..04` | Identitas | Auth email/NIM + password Argon2id, MFA WebAuthn/TOTP, multi-role selector, session table & revocation list di Redis, **matriks izin 6 aksi ber-scope**. | `users`, `sessions`, `refresh_tokens`, `tenant_memberships`, `permissions`, `user_role_assignments` |
| `FR-AKA-01..12` | Inti Akademik | Penugasan dosen, OW kuota atomik, approval KRS massal, late KRS audit, presensi & rekap, input & kunci nilai, kalkulasi IPK/KHS, status mhs, komposisi nilai 100%, cekal multi-dimensi. | `classes`, `enrollments`, `class_sessions`, `attendances`, `grades`, `grade_components`, `blockades` |
| `FR-AKA-13` | Yudisium | Pendaftaran yudisium, verifikasi otomatis syarat kelulusan & clearance, penerbitan SK Yudisium, predikat, penguncian status `LULUS`. | `graduation_records`, `clearances`, `students` |
| `FR-AKA-14` | Cetak Dokumen | Generator PDF resmi server-side: KRS, KHS, Transkrip Akademik Sementara, dan Kartu Ujian ber-QR Code verifikasi tamper-evident. | Endpoint `/api/v1/documents/print/:type` |
| `FR-AKA-15` | Penjadwalan | Data master ruang kelas & laboratorium, plotting jadwal mingguan, deteksi dan pencegahan bentrok (*conflict detection*) ruang & dosen. | `rooms`, `class_schedules` |
| `FR-KEU-01..07` | Keuangan | Tarif bertingkat, generator tagihan idempotent, webhook VA/QRIS, ledger append-only, reversing entry void, gerbang tagihan, 4-status invoice. | `fee_components`, `invoices`, `invoice_items`, `payments`, `ledger`, `deposits` |
| `FR-FDR-01..03` | PDDIKTI Feeder | Pemetaan entitas lokal ke kamus Neo Feeder, validasi pra-kirim, log sinkronisasi dan retry aman. | `pddikti_mappings`, `pddikti_sync_runs` |
| `FR-NTF-01` | Notifikasi | Dispatcher email & WhatsApp in-app berbasis template event transaksi. | BullMQ `notification_queue` |
| `FR-AUD-01` | Audit Trail | Audit log append-only dengan hash-chain tamper-evident untuk setiap operasi tulis kritis. | `audit_logs`, `audit_chain_head` |
| `FR-RPT-01` | Pelaporan | Dashboard pemantauan: kepatuhan pelaporan feeder, tunggakan UKT, status OW, dan nilai dosen. | Read replica (`sica_readonly`) |
| `FR-PLT-01` | Platform | Provisioning tenant otomatis, feature-flagging dinamis, kuota resource, dan metering usage. | `tenants`, `tenant_quotas`, `tenant_usage` |

---

## 4. Matriks Acceptance Criteria (`AC-*`) & Pengujian

Semua kriteria bertanda 🔒 wajib lolos automated test di pipeline CI sebelum merge.

| Kode AC | Kategori Pengujian | Skenario Pengujian Kunci |
|---|---|---|
| **AC-KRS-1** 🔒 | Automated Unit / DB | Penolakan KRS yang melampaui plafon band SKS institusi & nasional. |
| **AC-KRS-2** | Automated Integration | Penolakan pengambilan mata kuliah yang prasyaratnya belum lulus (nilai E / K). |
| **AC-KRS-3** 🔒 | Concurrency / k6 | 150 request bersamaan pada kelas sisa kuota 1: tepat 1 diterima, 149 menerima `CLASS_FULL`. |
| **AC-KRS-4** | Automated Integration | Penguncian formulir KRS otomatis bagi mahasiswa yang memiliki tagihan belum lunas. |
| **AC-KRS-5** | Automated Integration | Formulir KRS terkunci permanen pasca-submit; perubahan hanya via alur *Sunting KRS* oleh Dosen PA. |
| **AC-NIL-1** | Workflow Integration | Koreksi nilai pasca-`LOCKED` wajib ber-approval Kaprodi, menyertakan alasan tertulis, dan memicu audit trail. |
| **AC-NIL-2** | Property-Based Test | Determinisme perhitungan IPK: pembulatan 2 desimal half-up identik pada 10.000 sampel acak. |
| **AC-NIL-3** | Automated Unit | Konversi skor mentah ke huruf & bobot dinamis berdasarkan `grade_scales` kurikulum terkait. |
| **AC-NIL-4** 🔒 | DB Constraint / Unit | Form input nilai ditolak terbuka bila jumlah bobot komponen nilai tidak sama dengan 100%. |
| **AC-KEU-1** 🔒 | Idempotency / Chaos | 3 callback pembayaran bersamaan dari gateway: tepat 1 payment tercatat di ledger. |
| **AC-KEU-2** | Batch Re-run | Eksekusi ulang engine tagihan menghasilkan invoice & nilai rupiah yang identik (zero duplicate). |
| **AC-KEU-3** | Accounting Ledger | Void invoice menghasilkan status `VOID` dan baris reversing entry di ledger, bukan DELETE. |
| **AC-KEU-4** | Domain Semantics | Invoice bayar sebagian menghasilkan status `PARTIAL` / `BAYAR_SEBELUM_LUNAS` secara konsisten. |
| **AC-FDR-1** | Integration / Staging | Pra-validasi 300 baris riwayat: data invalid ditandai dengan error code spesifik sebelum kirim. |
| **AC-AUD-1** 🔒 | PostgreSQL Privilege | Peran aplikasi `sica_app` ditolak menjalankan `UPDATE` atau `DELETE` pada tabel `audit_logs`. |
| **AC-MIG-1** | Migration Verification | Import data historis 5.000 mahasiswa: rekonsiliasi selisih IP/IPK ≤ 0,00 sebelum go-live. |
| **AC-YUD-1** 🔒 | Business Integrity | Validasi kelulusan otomatis memverifikasi SKS, IPK, clearance cekal, dan keabsahan akreditasi prodi. |
| **AC-JDW-1** | Concurrency / Schedule | Penolakan otomatis plotting jadwal ruang atau dosen yang mengalami irisan waktu (bentrok). |
| **AC-DOC-1** | Security / Tamper | PDF resmi dilengkapi QR code publik yang memverifikasi digest SHA-256 dan ringkasan data otentik. |
| **AC-ADM-1** | Workflow / four-eyes | Reopen periode `CLOSED` ditolak sampai persetujuan kedua tercatat (`period_reopen_requests`). |
| **AC-ADM-2** 🔒 | Batch / atomicity | Impor 10.000 baris dengan 1 temuan `BLOCK` → nol baris tertulis; `validate` dan `commit` adalah dua izin. |
| **AC-AKA-1** | Audit / override | Dispensasi KRS/gerbang selalu `VALIDATE` beralasan + baris audit + notifikasi. |
| **AC-AKA-2** | Kontrak / Zod | Permintaan `reject` tanpa `reason` ditolak skema (`422`); `approve` dan `reject` kode terpisah. |
| **AC-KEU-5** | Domain semantics | Invoice cicilan mewarisi gerbang akademik induk; pelunasan sebagian tidak membuka gerbang. |
| **AC-KBM-1** | Clearance | Sanksi kemahasiswaan aktif menahan yudisium; modul non-aktif tidak memunculkan blockers hantu. |
| **AC-FDR-3** | Kepatuhan | Koreksi pasca-sinkron PDDIKTI wajib lewat antrean `pddikti_correction_requests`, bukan `UPDATE`. |
| **AC-PMB-1** | Integritas identitas | NIM hasil pembatalan hanya boleh didaur ulang bila **belum pernah** terkirim ke PDDikti (BR-R10); bila sudah, NIM menjadi janda dan tidak dilepas. |
| **AC-JDW-2** | Concurrency / DB | Dua admin tidak dapat memasang ruang **atau** dosen yang sama pada rentang waktu beririsan — ditegakkan constraint `EXCLUDE USING gist`, bukan pemeriksaan aplikasi (BENCH-52). |
| **AC-TRN-1** | Arsip | Baris transkrip dipersist (`transcript_versions`/`transcript_lines`) dan dapat direproduksi identik bertahun-tahun kemudian, termasuk nama mata kuliah pada saat itu (BR-R12, BENCH-117). |

> **Keputusan terbuka yang menahan eksekusi** terdaftar di [PRD §8.3](file:///c:/SICA/docs/PRD.md) (`P-1`…`P-10`) — semuanya keputusan produk, bukan teknis, dan masing-masing menyebut milestone yang ditahan. Sumber bukti: [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md) §7.

---

## 5. Keputusan Arsitektur Utama (`ADR-1`–`ADR-17`)

Ringkasan keputusan arsitektur di [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md):

1. **ADR-1 (Modular Monolith)**: Mengutamakan integritas transaksi ACID satu database di tahun-tahun awal daripada kompleksitas microservices.
2. **ADR-2 (Shared-Schema + RLS)**: Multi-tenancy pooled dengan PostgreSQL Row-Level Security dan kolom `tenant_id` wajib di setiap tabel domain.
3. **ADR-3 (Drizzle ORM)**: SQL eksplisit untuk mendukung GUC `app.current_tenant` (satu-satunya nama yang dibaca policy — lihat DATA_MODEL §15 kata pengantar & GLOSSARY "GUC"), partisi, dan advisory lock.
4. **ADR-4 (Zod Contracts)**: Validasi tunggal di `packages/contracts` yang digunakan bersama oleh Frontend Next.js, API NestJS, dan BullMQ worker.
5. **ADR-5 (Mata Uang & Waktu)**: Uang disimpan sebagai `bigint` rupiah utuh; waktu disimpan sebagai `timestamptz` UTC.
6. **ADR-6 (UUIDv7)**: Primary key UUID berurut waktu (time-ordered), ramah index B-tree, dan tidak membocorkan volume data.
7. **ADR-7 (Transactional Outbox)**: Penjaminan keandalan event keluar dalam transaksi database yang sama dengan mutasi domain.
8. **ADR-8 (Auth Mandiri Primitif)**: Menghindari vendor-lockin autentikasi demi fleksibilitas multi-role ber-scope dan federasi IdP kampus (OIDC/SAML).
9. **ADR-9 (Worker Process Terpisah)**: Pemisahan proses background job (BullMQ) dari web API untuk mencegah habisnya request pool saat beban batch tinggi.
10. **ADR-10 (Container & Managed DB)**: Deployment berbasis Docker container (ECS/Fly/K8s) dengan RDS PostgreSQL terkelola + read replica.
11. **ADR-11 (SIAKAD + Virtual LMS satu platform)**: Sinkronisasi KRS → ruang kelas virtual, nilai tugas/kuis mengalir ke KHS; dual mode onsite/online (EdLink-style). *(baru didaftarkan di indeks ini 2026-10-20 — sebelumnya hanya ada di ARCHITECTURE §1)*
12. **ADR-12 (Auto-Class Generation via ambang waitlist)**: Kelas paralel baru terbuka dari ambang antrean (min 15 onsite / 30 online), bukan penolakan `CLASS_FULL` pasif maupun auto-spawn tanpa ambang. *(registrasi menyusul, sama seperti ADR-11)*
13. **ADR-13 (Packaging modular berbasis entitlement data-driven)**: Aktif/tidaknya modul adalah data per-tenant (`modules`/`tenant_modules`/`module_dependencies`/`plan_modules`), bukan fork kode; gating di menu + route + endpoint dari satu resolver. *(registrasi menyusul)*
14. **ADR-14 (Engine algoritma deterministik zero-API-key)**: CPM/DAG, bin-packing, AHP/TOPSIS+Gale-Shapley, RETE, max-flow/min-cut, AST evaluator, dan ekstraksi dokumen berjalan dari logika internal + data tenant; **tanpa API key, tanpa egress PII**. Rincian: [ARCHITECTURE §11](file:///c:/SICA/docs/ARCHITECTURE.md), [SECURITY §10](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md).
15. **ADR-15 (Harness engine satu corak: run → explain → apply)**: `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, budget, dan `explain_payload` wajib; hasil masuk `*_results` dan hanya menjadi record setelah `VALIDATE` manusia. Rincian: [DATA_MODEL §17.2](file:///c:/SICA/docs/DATA_MODEL.md), [API_SPEC §6.2](file:///c:/SICA/docs/API_SPEC.md).
16. **ADR-16 (Ekstraksi dokumen bertingkat, termurah & paling deterministik lebih dulu)**: medan formulir (`AcroForm`/XFA) → layer teks PDF → OCR lokal (Tesseract di worker sendiri) → **tulisan tangan dinyatakan tidak didukung**; hasil selalu menjadi draf berkeyakinan. Rincian: [ARCHITECTURE §11.9](file:///c:/SICA/docs/ARCHITECTURE.md), [API_SPEC §6.8](file:///c:/SICA/docs/API_SPEC.md).
17. **ADR-17 (Parameter engine = konfigurasi berversi dengan empat-mata)**: bobot AHP, aturan RETE, template ekstraksi, dan matriks biaya disimpan sebagai JSONB berversi dengan `requested_by ≠ approved_by` ditegakkan di DB — bukan hardcode dan bukan SQL dinamis. Rincian: [RBAC_MATRIX §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md), [SECURITY §10.5](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md).

---

## 6. Peta gelombang kedua (2026-10-20) — engine, data master, entitas institusi

Tidak ada ADR baru pada siklus ini; **ADR-14 sampai ADR-17** (bagian 5 di atas) diperluas oleh ARCHITECTURE §12 tanpa membalik norma lama.

| Area | Sumber kebenaran | Bagian | Status |
|---|---|---|---|
| 14 engine nol-API-key (ALG-1 sampai ALG-14) | ARCHITECTURE.md | §11 (gelombang 1) & §12 (gelombang 2) | spesifikasi |
| Dua mekanika (KRS lease + fencing token; Delta Sync Feeder) | ARCHITECTURE.md | §10.3 + §12.2.2, §12.10 | spesifikasi |
| Skema engine gelombang 1 | DATA_MODEL.md | §17 (0036_engine_algorithms.sql) | spesifikasi |
| Skema engine gelombang 2 | DATA_MODEL.md | §18 (0037–0043) | spesifikasi |
| Multi-kampus, jenis program, Tugas Akhir 53/2023, matriks tarif UKT | DATA_MODEL.md | §19 (0044–0046) | spesifikasi |
| Mesin data master dinamis + atribut kustom (nol-hardcoding) | DATA_MODEL.md | §20 (0047–0048) | spesifikasi |
| Register objek & nomor migrasi (satu-satunya pemilik) | DATA_MODEL.md | §14.7, §14.8 | terukur |
| Kontrak endpoint engine & master data | API_SPEC.md | §4.14 (lookup & atribut), §4.15, §6.10 (ALG-8–14) | spesifikasi |
| Register kode error | API_SPEC.md | §2.3 — 106 baris terukur | spesifikasi |
| Titik aksi hak akses | RBAC_MATRIX.md | §4.5 — 145 baris (51–126 engine/entitas, 127–145 master data); §4.6 scope SITE + hak tingkat field | usulan |
| Postur keamanan gelombang 2 | SECURITY_COMPLIANCE.md | §3.6.6 (rantai hash & jangkar), §10.8, §11.1–§11.6 | spesifikasi |
| Sisi integrasi auto-fix & delta sync | INTEGRATIONS.md | §1.11–§1.15 | spesifikasi |
| Kebutuhan bisnis (OBE, 53/2023, multi-kampus, tarif, lookup dinamis, engine) | PRD.md | §5.9 & §5.10; §6.1 (AC-MD, AC-ALG); §6.2 (NFR-Z, NFR-MD) | spesifikasi |
| Standar layar engine + Dynamic Form Generator | UI_UX_DESIGN.md | §11.11 (vonis Velzon), §12 (ALG-8–14), §13 (form dinamis) | spesifikasi |
| Urutan pengerjaan | ROADMAP_TASKS.md | §2.5.15 (crosswalk 6 milestone), §2.13 (Master Data Engine di Fase 1B / R-2), §2.14 (ALG-8–14; W-13.8–W-13.16), §2.15 (entitas), §2.16 (register dokumen) | terjadwal |
| Guardrail agen | AGENTS.md | §3.9 (nol-API-key), §3.10 (nol-hardcoding), §3.11 (urutan dokumen-then-kode) | normatif |

## 7. Addendum siklus 2026-10-20 bagian 2 (parameter dinamis & multi-modus)

| Area | Sumber kebenaran | Bagian | Status |
|---|---|---|---|
| Mesin parameter sistem + riwayat + dampak | DATA_MODEL.md | §21.1–§21.3, §21.8 (0049) | spesifikasi |
| Otorisasi mikro menu & parameter | DATA_MODEL.md + RBAC_MATRIX.md | §21.7 (0050) + §4.5 nomor 146–161, §4.7, §6.6 | usulan |
| Kosakata modus pembelajaran & rekonsiliasi dua sumber | DATA_MODEL.md | §21.4–§21.6 | spesifikasi |
| Empat engine baru + peta 16 permintaan | ARCHITECTURE.md | §12.13–§12.20 (ALG-15…ALG-18) | spesifikasi |
| Endpoint parameter, menu, presensi multi-modus | API_SPEC.md | §4.16–§4.18 (angka register §2.3 dihitung di API_SPEC, tidak disalin ke sini) | spesifikasi |
| Postur parameter/webhook/vendor + register kontrol | SECURITY_COMPLIANCE.md | §12 + SC-G3-01…37 | spesifikasi |
| Integrasi LMS/konferensi & pengiriman sesuai modus | INTEGRATIONS.md | §1.16–§1.17, §5 | spesifikasi |
| Kebutuhan bisnis parameter, menu, multi-modus, lifecycle | PRD.md | §5.11, §5.5F, §6.1, §6.2 | spesifikasi |
| Layar Admin parameter, kisi RBAC, layar modus | UI_UX_DESIGN.md | §14, §15, §16 | spesifikasi |
| Urutan eksekusi | ROADMAP_TASKS.md | §2.17 (SPE-1…15), §2.18 (Fase 1A/1B), §2.19 (LFC-1…3) | terjadwal |
| Kontradiksi yang ditutup | AUDIT_READINESS.md | §12.1 (C-1…C-6) | diputus |
| **Registri 47 modul bisnis + SuperApp dan pemetaan entitlement** | PRD.md | §5.12 (48 baris) + §5.12.4 (tabrakan `sister`) + §5.13 (14 vonis) | norma |
| Kebutuhan bisnis modul yang sebelumnya nol | PRD.md | §5.14.1–§5.14.9 (75 FR, 66 kunci parameter, 20 kamus, 21 uji penolakan) | spesifikasi |
| Skema 21 modul baru | DATA_MODEL.md | §22 (119 tabel, `0051`–`0072`, §22.9 register, §22.11 query CI) | spesifikasi |
| Rantai data, peristiwa, dan jalur real-time | ARCHITECTURE.md | §13.1 (42 peristiwa), §13.2 (SSE/WebSocket), §13.4 (5 skenario), §13.5–§13.6 (ALG-19…24, vonis) | spesifikasi |
| Endpoint 47 modul dan kode error baru | API_SPEC.md | §7.1–§7.24 + §7.23 rekap (angka register §2.3 dan baris rute dihitung di sana, tidak disalin ke sini) | spesifikasi |
| Partisi izin dan sub-detail modul baru | RBAC_MATRIX.md | §4.5.1 (baris 162–291), §6.7, §7.6 (17 pasangan) | usulan |
| Dashboard grid per peran + layar modul | UI_UX_DESIGN.md | §17 (73 baris peran-kartu), §18 (12 blok), §17.6 (vonis grafik) | spesifikasi |
| Kepatuhan kelas data khusus | SECURITY_COMPLIANCE.md | §13 (SC-G4-01…36, SEC-26…31, §13.8 penahan) | spesifikasi |
| Adapter sistem nasional | INTEGRATIONS.md | §6.1, §6.5 (kamus), §6.7 register + 32 `[VERIFIKASI-RESMI]` | spesifikasi |
| Urutan eksekusi gelombang ketujuh | ROADMAP_TASKS.md | §2.20 (`M47-0`…`M47-8`), §2.20.3 baris pertama | terjadwal |

## 8. Peta audit dewan 2026-10-21 (kanal vicon, kosakata tunggal, dan cakupan berkas)

| Yang diperiksa silang | Berkas pemilik | Bagian | Vonis |
|---|---|---|---|
| Kebutuhan kanal + ambang hadir daring | PRD.md | §5.15 (FR-VIC-01…07, BR-VIC-01…05, AC-VIC-1…4, lima penolakan) | norma |
| Enum kanal, objek `0073`–`0074`, alias kalah, query CI | DATA_MODEL.md | §21.10 (+ §21.3 baris 26–28, §22.9, §15.2/§15.3) | spesifikasi |
| Siklus hidup dokumen: mendaftar → aktif → yudisium → ijazah/SKPI → legalisir → tracer/alumni → lingkup kampus | DATA_MODEL.md + PRD.md + MIGRATION_SOP.md | `DATA_MODEL §23` (33 tabel untuk `0019`/`0020`/`0021`/`0026`/`0027` + nomor baru `0076` KTM dan `0077` tracer) · `PRD §5.16` (registri T-0…T-8, `FR-LC-01…12`, `AC-LC-1…9`) · `MIGRATION_SOP §5`/`§6.2` | spesifikasi — DDL tertulis, **belum** dieksekusi (`G-02`) |
| Penjaga yang mengukur kelengkapan, bukan mengiklankannya | `.tools/perm-phantom.mjs` · `.tools/ddl-gap.mjs` · `.tools/fk-audit.mjs` · `.tools/bench-tally.mjs` · `.tools/i18n-parity.mjs` | keluaran dicatat di `PROGRESS_REPORT §5.42`/`§5.46`; temuan dijadikan tiket `CRD-5a`/`CRD-5b`/`CRD-6` di `ROADMAP §2.22` | instrumen |
| Rantai tiga keadaan izin (ber-nomor · usulan · hantu) dan satu definisi untuk semuanya | `.tools/lib-perm.mjs` (definisi tunggal) · `.tools/perm-phantom.mjs` (verdict tiga tingkat) · `.tools/perm-normalize.mjs` (kelas) · `.tools/perm-usulan.mjs` (koreksi kutipan + regenerasi `RBAC §4.5.6`, idempoten & anti-umpan-balik) · `.tools/perm-usulan-audit.mjs` (8 butir) · keluaran `.tools/perm-classes.md` | `RBAC §4.5.6` · `API_SPEC §7` (cara membaca kolom "Izin acuan") · `ROADMAP §2.22` `CRD-5a`/`CRD-5b` | instrumen — `HANTU = 0` berarti **nama terdaftar**, bukan izin; verdict sengaja KUNING selama grant peran belum diputus manusia (`RD-98`, `RD-99`) |
| Penjaga ketertelusuran pedoman per modul | `.tools/module-provenance.mjs` · `.tools/pedoman-coverage.mjs` · `.tools/prov-matrix.md` (keluaran, bukan sumber) | keduanya menolak, bukan memuji: jumlah baris = jumlah modul, himpunan kode identik, dan tidak ada angka yang dikutip tanpa alat | instrumen — kolom RUTE-nya menyalin vonis `crud-matrix.mjs` dan tidak menghitung sendiri (`RD-95`) |
| Dashboard analitik lokal (ALG-25 anomaly IF/LOF, penempatan WASM, `TOGGLE_ACTIVE`) | PRD.md + ARCHITECTURE.md + DATA_MODEL.md + API_SPEC.md + UI_UX_DESIGN.md | `PRD §5.18` · `ARCHITECTURE §12.21`–`§12.22` · `DATA_MODEL §25` (`0081`, §21.3 baris 34–36) · `RBAC §4.5.5` (usulan) · `API_SPEC §7.34` · `UI_UX §19.6` · `ROADMAP §2.24` (`AI-1…3`, `TOG-1`) | spesifikasi — design-only sampai dependensi lokal + golden vector nyata |

| Peta sebaran sesi real-time (GIS), jaminan sosial + EWMP, mutu gerak & CLS | PRD.md + DATA_MODEL.md + ARCHITECTURE.md + UI_UX_DESIGN.md | `PRD §5.17` · `DATA_MODEL §24` (`0078`–`0080`) + §21.3 baris 30–33 · `ARCHITECTURE §13.8` · `ENV_CONTRACT §8` · `SECURITY §14.2` · `RBAC §4.5.4` (usulan) · `API_SPEC §7.33` · `UI_UX §19` · `ROADMAP §2.23` | spesifikasi — Redis/GeoIP/EWMP dinyatakan belum nyata |
| Pedoman per modul — ke mana SICA berpatokan (Sevima vs regulasi Indonesia) + matriks ketertelusuran 48 modul | PRD.md + AUDIT_READINESS.md + SEED_DATA.md + ROADMAP_TASKS.md | `PRD §5.19` (per gugus) · `PRD §5.20` (48 baris, penanda `VERIFIKASI-LEGAL`/`VERIFIKASI-VENDOR`) · `AUDIT_READINESS §17` (`L-1`…`L-5`) · `SEED_DATA §8.4` (`S-01`…`S-11`) · `ROADMAP §2.25` (`PRV-1…PRV-4`, `SED-1`) · alat `module-provenance.mjs` + `pedoman-coverage.mjs` | spesifikasi — nomor ber-penanda belum diverifikasi manusia; vonis CRUD dibaca dari `crud-matrix.mjs`, tidak dihitung di kolom ini (`RD-95` sudah dicabut) |
| Kesiapan sisi kode: handler nyata vs baris katalog, helper penegakan, dependensi, seed, mobile | AUDIT_READINESS.md + ROADMAP_TASKS.md + PROGRESS_REPORT.md | `.tools/handler-inventory.mjs` (pemilik angka sisi kode) · `.tools/crud-bill.mjs` (tagihan verba dari keluaran `crud-matrix`) · `AUDIT_READINESS §18` · `ROADMAP §2.26` (`DEV-G1…G6`) · `PROGRESS_REPORT §5.47` | instrumen — satu pertanyaan satu pengukur: `§7` katalog menghitung baris spesifikasi, `handler-inventory` menghitung berkas; keduanya tidak boleh saling menyalin |
| Titik masuk penegakan: satu perintah untuk seluruh penjaga + register 24 gerbang CI berhuruf | AUDIT_READINESS.md + ROADMAP_TASKS.md + PROGRESS_REPORT.md | `.tools/gate-run.mjs` (penjaga wajib + penghitung backlog; `--list` menyimpan perintah tiap angka yang dikutip, dan baris `gate-run:` mencetak jumlah yang sebenarnya) · `.tools/ci-gate-map.mjs` (huruf (a)…(x) dari empat jangkar, menuntut baris register, menolak pemeriksa yang tidak ada, menolak vonis non-bilangan-bulatan) · `AUDIT_READINESS §19` · `ROADMAP §2.26.1` (`DEV-G7`, `CI-G1…CI-G7`) · `heading-dup` kini juga menolak `loncat=` (anak di bawah induk salah, `RD-107`) | instrumen — **bukan** klaim penegakan: hari ini sejumlah huruf punya pemeriksa (semua SEBAGIAN), sisanya BELUM, dan **0** tertanam di pipeline karena `.tools/` di-gitignore; uji negatif wajib (`DDL_GAP_REMOVE`, scanner tanpa argumen → kode 2) |
| Permukaan platform M-01: provisioning/paket/kuota/flag/dukungan terawasi/break-glass | PRD.md + DATA_MODEL.md + RBAC_MATRIX.md + API_SPEC.md + UI_UX_DESIGN.md + ROADMAP_TASKS.md | `PRD §5.1` (`FR-PLT-01`/`FR-PLT-02`) + `§6.1` (`AC-PLT-1…4`) + `§5.11.2` butir 13 (vonis rumah bendera rilis) · `DATA_MODEL §3.1`/`§3.2` (heading berlabel modul + tabel transisi `tenant_status`) + `§6.2` (norma tulis lintas-tenant) + `§12.1` · `RBAC §4.5.3` baris **302–318** + partisi `§4.5.1` (`platform`, `entitlement`) + `§6.1` · `API_SPEC §4.20` (17 rute) + `§2.3` baris 150–154 · `UI_UX §9.9` · `ROADMAP §2.27` (`PLT-1…6`) | spesifikasi — rantai satu modul ditutup sampai langkah (6); vonis kesiapan modulnya dicetak `.tools/module-readiness.mjs --only=M-01` dan dibaca lewat `AUDIT_READINESS §20`, bukan dari baris ini |
| Kesiapan per modul (48 baris) + kolom status + rincian kurang + peta menu/CRUD | AUDIT_READINESS.md | `.tools/module-readiness.mjs` (penggabung: `crud-matrix --json` + `module-provenance` + `handler-inventory --json` + `fr-ac-gap` + `RBAC §4.5.1/§4.5/§4.5.6/§6`) · `.tools/apply-module-readiness.mjs` (penulis `§20` dari keluaran alat, memotong blok §20 saja) · `AUDIT_READINESS §20` · **bentuk kolomnya dinormakan di `AGENTS §6.1`** | instrumen — kolom "STATUS SIAP DEV?" menyatakan kesiapan **spesifikasi**, bukan sistem: `DEV-G2`/`DEV-G3`/`DEV-G7`+`CI-G*` menahan semua modul; vonis diambil dari **tujuh penahan** termasuk yang ketujuh ("FR tidak dikutip satu pun AC", dimiliki `.tools/fr-ac-gap.mjs`); berapa baris katalog izin yang tidak menulis token modul (dipetakan lewat SKU, dan itu CATATAN bukan bukti) dicetak oleh `module-readiness` di kepala `AUDIT_READINESS §20` — angkanya tidak disalin ke berkas ini (`RD-55`) |
| Selisih Area Admin SICA ↔ Sevima dengan kolom Status yang DIHITUNG | BENCHMARK_SEVIMA.md | `.tools/bench-admin-delta.mjs` (periksa `CREATE TABLE` di DATA_MODEL, rute di API_SPEC, alamat layar di UI_UX, baris katalog di RBAC untuk tiap sel "Padanan SICA"; mode `--cek` dipakai `gate-run` supaya penjaga tidak menulis dokumen) · `BENCHMARK_SEVIMA §2.10` | instrumen — sejak kajian pakar M-02 (2026-10-21) kolom ketiga tetap klaim manusia dari siklus sebelumnya (pertanyaan produknya yang berguna, bukan ingatannya) dan kolom keempat adalah ukuran alat; 9 dari 28 barisnya terbukti berbenturan, dan alat tidak menghapus klaim manusia — ia menunjuk kontradiksinya (`RD-112`) |
| Penelusur kebocoran atribusi: baris usulan mana yang membuat resource `X` terpetakan ke modul `Y` | RBAC_MATRIX.md | `.tools/m02-leak-probe.mjs` — satu pertanyaan satu alat (`RD-95`); dipasang untuk membongkar `RD-114`, yaitu token `M-02` yang duduk di dalam catatan PENOLAKAN ruang nama (`platform.import.*`) sehingga lima menu M-01 tercetak sebagai menu M-02 | diagnostik, bukan penjaga — penjaganya known-answer negatif di `.tools/module-readiness.mjs` |
| Penolak ruang nama kolom Entitlement baris usulan + penelusur jalur atribusi | RBAC_MATRIX.md | `.tools/fix-helpdesk-ent.mjs` (GATE `--cek` ke-30; menolak nilai di luar 13 `PERMISSION_MODULES` — `G-29` — dan `--balik` mengembalikan koreksi saya yang salah, `RD-115`) · `.tools/m02-leak-probe.mjs` (diagnostik: baris usulan mana yang memetakan resource/modul, termasuk lewat fallback partisi) | penjaga + diagnostik — sejak 2026-10-21 |
| Rute kanal + 5 kode error baru | API_SPEC.md | §4.19, §2.3 (baris 145–149), §4.18.3 | spesifikasi |
| Titik aksi kanal + sel sub-detail | RBAC_MATRIX.md | §4.5.2 (baris 292–297), §6.7.6 | usulan |
| Kontrak Microsoft Teams (muatan, kegagalan, uji) | INTEGRATIONS.md | §6.8 | spesifikasi dengan `[VERIFIKASI-VENDOR]` terbuka |
| Variabel kredensial kanal | ENV_CONTRACT.md | §7 (dan catatan penomoran §5) | spesifikasi |
| Pola migrasi expand-and-contract kanal | MIGRATION_SOP.md | §6 | prosedur |
| Klasifikasi insiden kanal | ISSUE_RESOLUTION.md | §6 | prosedur |
| Bentuk uji kanal dan kosakata tunggal | TESTING_STRATEGY.md | §6 | terjadwal |
| Egress, rotasi, kapasitas peristiwa | DEPLOYMENT_DEVOPS.md | §5 | prosedur |
| Seed kanal, parameter, kamus | SEED_DATA.md | §8 | kontrak seed (belum runnable) |
| Istilah kanal | GLOSSARY.md | §11 | norma |
| Urutan eksekusi kanal | ROADMAP_TASKS.md | §2.21 (`VCN-1`…`VCN-5`) | terjadwal |

### 8.1 Ralat cakupan: "20 berkas" vs isi repo yang sebenarnya

Permintaan audit menyebut **20 berkas** dan menyebut pilar UI Velzon. Terukur: `/docs` berisi **24** berkas `.md` (+ `AGENTS.md`), dan empat berkas yang tidak termasuk daftar 20 itu **memiliki** norma yang ditagih pilar yang sama:

| Berkas di luar daftar 20 | Yang ia pemilikkan | Kenapa tidak boleh dilewat |
|---|---|---|
| `UI_UX_DESIGN.md` | grid kartu dinamis per peran (§17, 73 baris peran→kartu) dan pola layar 12 blok (§18) | pilar UI Velzon **tidak punya rumah** tanpa berkas ini |
| `TECH_CONVENTIONS.md` | konvensi kode, struktur direktori, dan daftar pustaka yang boleh dipakai (§6) | gerbang "design-only vs nyata" bertumpu pada §6 ini |
| `TESTING_STRATEGY.md` | piramida uji dan gerbang CI | tanpa ini, spesifikasi tidak bisa dibuktikan |
| `BENCHMARK_SEVIMA.md` | bukti pembanding Sevima dan delta `BENCH-*` | klaim "parity 100%" berasal dari berkas ini, bukan dari PRD |

**Vonis.** Inventaris `/docs` berisi **24 berkas Markdown**; `AGENTS.md` adalah router terpisah, bukan dokumen ke-25 dalam folder itu. Cakupan audit dan status setiap temuan tidak sama dengan persentase kesiapan implementasi.

### 8.2 Sinkronisasi Fase 1 administrator dan perluasan domain — 2026-10-23

Nama yang diminta `ARCHITECTURE_OVERVIEW.md` menunjuk **ARCHITECTURE.md**; `DEPLOYMENT_STAGING_GUIDE.md` menunjuk **DEPLOYMENT_DEVOPS.md**. Tidak dibuat salinan dokumen. Tier tata kelola terdiri dari platform dan IT tenant (`R-1/R-2`); kelompok operasional tetap `R-3…R-6`. Perluasan cakupan Fase 1 tidak memberikan hak bisnis kepada admin IT.

| Dokumen kanonik | Fokus sinkronisasi |
|---|---|
| PRD.md | batas admin, target Fase 1, sembilan paket dan acceptance criteria |
| ARCHITECTURE.md | engine lokal, Lua/fencing, sesi persisten, batas klaim HA |
| DATA_MODEL.md | lima alias entitas, pemberian lisensi, FK billing tenant-bound, DSAR |
| SECURITY_COMPLIANCE.md | SoD, PII, audit tamper-evident, operasi admin terkendali |
| API_SPEC.md | DTO lisensi/billing dan register kontrak admin yang belum lengkap |
| TECH_CONVENTIONS.md | dependensi nyata versus design-only dan boundary kontrol |
| UI_UX_DESIGN.md | menu tata kelola versus operasional, keadaan terkunci, aksi per izin |
| INTEGRATIONS.md | konfigurasi konektor versus keputusan bisnis dan bukti kehadiran |
| ENV_CONTRACT.md | secret reference, layanan bersama, batas runtime aktual |
| MIGRATION_SOP.md | expand-contract, bounded locks, backup/restore teruji |
| GIT_WORKFLOW.md | batas dokumen/implementasi/rilis dan bukti persetujuan |
| ROADMAP_TASKS.md | urutan slice dan daftar penahan baru §2.35 |
| SEED_DATA.md | seed dev bukan bukti produksi; pembersihan tidak aman tanpa kepemilikan run |
| GLOSSARY.md | lisensi, release flag, opt-out, Tier, CSP, audit dan ZDD |
| INDEX.md | inventaris kanonik dan navigasi, bukan salinan angka readiness |
| TESTING_STRATEGY.md | negative tests, idempotensi, isolasi, load/HA/ZDD yang belum dibuktikan |
| DEPLOYMENT_DEVOPS.md | staging, drain, failover, rollback dan batas zero-downtime |
| ISSUE_RESOLUTION.md | triase ketidaksesuaian admin/lisensi/audit dan penghentian operasi berbahaya |
| RBAC_MATRIX.md | enam verba, peran IT versus operasional dan izin usulan |
| BENCHMARK_SEVIMA.md | perbandingan dokumentasi bukan audit vendor independen |
| BLUEPRINT_ENTERPRISE.md | batas konfigurasi teknis dan kewenangan data bisnis |
| BLUEPRINT_ROLE_BY_ROLE.md | seluruh menu wajib dan status berjalan/spec-only/izin tertahan |
| AUDIT_READINESS.md | register koreksi dan penahan penguncian §15.11 |
| PROGRESS_REPORT.md | bukti siklus, pencabutan klaim selesai yang terlalu luas |

**Status:** sinkronisasi ini tidak memberikan sertifikat `100% LOCK`. Angka terkini hanya dari `.tools/module-readiness.mjs`, `.tools/rbac-count.mjs`, `.tools/handler-inventory.mjs` dan `.tools/fr-ac-gap.mjs`; snapshot bertanggal di bagian lama bukan keadaan runtime sekarang. Bukti verifikasi hukum/vendor, DTO semua menu, migrasi, implementasi dan pengujian rilis tetap harus ditutup.
