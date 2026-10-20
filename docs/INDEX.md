# SICA — Indeks Dokumentasi & Peta Penelusuran Silang (Cross-Reference)

Dokumen ini adalah panduan navigasi utama untuk arsitek, developer, product manager, dan auditor sistem **SICA (Sistem Informasi Campus Akademik)**.

---

## 1. Peta Dokumen Resmi SICA

| Dokumen | Deskripsi & Fokus Utama | Target Pembaca |
|---|---|---|
| **[PRD.md](file:///c:/SICA/docs/PRD.md)** | Product Requirements Document: Visi produk, Persona, User Journeys J1–J6, Ruang Lingkup MVP (Fase 1) & Phase 2, Katalog Aturan Bisnis (`BR-*`), Acceptance Criteria (`AC-*`), dan Non-Functional Requirements (`NFR-*`). | PM, Tech Lead, QA, Pimpinan PT |
| **[ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md)** | Technical Architecture Document: Architectural Decision Records (`ADR-1`–`ADR-10`), Diagram Arsitektur C4/L2, Tech Stack, Desain Multi-tenancy shared-schema + RLS, Struktur Folder Modular Monolith, dan Pipeline CI/CD. | Software Engineer, Solution Architect, DevOps |
| **[DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md)** | Database Specification & DDL: Skema relasional PostgreSQL 16 lengkap, definisi tipe ENUM, tabel isolasi tenant, penanganan concurrency OW, ledger append-only, graduation records, dan seed minimum. | Backend Engineer, DBA, Data Engineer |
| **[SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md)** | Security & Compliance Architecture: Postur Zero-Trust, Autentikasi Argon2id + WebAuthn/TOTP, RBAC+ABAC per-scope, mitigasi teruji OWASP Top 10, audit trail hash-chained, kepatuhan UU PDP No. 27/2022 & PP 33/2026, serta kesiapan SOC 2 & ISO 27001. | Security Engineer, Compliance Officer, Auditor |
| **[GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md)** | Glosarium Istilah: Definisi istilah akademik kampus (OW, KRS, KHS, Yudisium), standar regulasi (SN-Dikti, PDDIKTI, Neo Feeder, PISN, SIVIL), akreditasi OBE (CPL, CPMK), dan konsep teknis. | Semua Anggota Tim & Stakeholder Baru |
| **[UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md)** | UI/UX & Design System: Adopsi Velzon Template (React/Next.js), Design Tokens, Color Palette, Dark/Light Mode, Komponen Baku Web, Pemetaan Material 3 Flutter Mobile (Digital KTM, QR Scanner Overlay, Schedule Cards), serta Grid Breakpoints. | UI/UX Designer, Frontend & Mobile Engineer |
| **[TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md)** | Engineering & Coding Conventions: Struktur folder Next.js App Router & Flutter Feature-First, State Management (TanStack Query + Zustand & Riverpod), Form Handling (RHF + Zod & Freezed), Drift SQLite, dan Aturan Penamaan Strict. | Frontend, Backend, & Mobile Engineers |
| **[API_SPEC.md](file:///c:/SICA/docs/API_SPEC.md)** | REST API Contract: Standard Response Envelope (Success/Error), Definisi Zod Schemas TypeScript, Endpoint MVP Lengkap (Auth, KRS, KHS, Transkrip, dan Dynamic Rotating QR Attendance dengan Haversine Geofencing). | Backend, Frontend, & Mobile Engineers |
| **[TESTING_STRATEGY.md](file:///c:/SICA/docs/TESTING_STRATEGY.md)** | Quality Assurance & Testing: Sasaran cakupan minimal 80%, Vitest + RTL & flutter_test + mocktail, pengujian deterministik kalkulasi IPK/SKS, integration test PostgreSQL RLS, dan security guards (401, 403, 422). | QA Engineer, Backend, & Mobile Engineers |
| **[DEPLOYMENT_DEVOPS.md](file:///c:/SICA/docs/DEPLOYMENT_DEVOPS.md)** | DevOps, CI/CD & Infrastruktur: Spesifikasi `.env.example` terpisah (Web, Mobile, Database), Strategi migrasi zero-downtime Drizzle 3-fase (Expand-and-Contract), dan GitHub Actions CI/CD Pipeline (Lint, Semgrep, Snyk, Vercel, Firebase). | DevOps, SRE, & Release Managers |
| **[ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md)** | Bug Resolution, RCA & Sanitasi Data: SOP Perbaikan Bug AI Agent, format log terstruktur Pino server trace vs Flutter Crashlytics, aturan 5 Whys RCA, serta kebijakan redaksi data sensitif (PII & JWT). | Semua Developer, AI Agents, & Support Ops |
| **[ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md)** | Implementation Task Tracker: Rincian checklist eksekusi proyek berurutan dari Phase 1 (Foundation & Auth), Phase 2 (Core Academic Web), Phase 3 (Mobile MVP & Dynamic QR), hingga Phase 4 (Hardening & Testing). | Tech Lead, Project Manager, & Software Engineers |
| **[PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md)** | Master Progress Report & Architectural Deliverables: Laporan komprehensif pencapaian 100% Phase 1, Phase 2, dan Phase 3, tautan deliverables kode sumber, dan persiapan Phase 4. | Stakeholder, Product Owner, & Engineering Team |
| **[RBAC_MATRIX.md](file:///c:/SICA/docs/RBAC_MATRIX.md)** | **Sumber kebenaran hak akses**: katalog 22 peran ber-scope, ~160 kode permission, matriks Role × Modul × Menu × Aksi, aturan segregation-of-duties/ABAC/PII, 8 celah implementasi (`G-01`–`G-08`) + rencana 6 tahap. | Security Engineer, Backend, QA, DevOps |
| **[BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md)** | Benchmark Kompetitif & Spesifikasi Administrasi: studi dokumentasi Sevima (peran, menu per peran, katalog modul, `Data Pelengkap`/data master, fungsi operasional, tabel 20 pemetaan Feeder, model hak akses 6 aksi, model harga/hosting) + kondisi SICA terverifikasi + peta selisih + urutan pengerjaan Area Admin (ADM-1…ADM-9). | Product Owner, Architect, Backend, UI/UX |
| **[SEED_DATA.md](file:///c:/SICA/docs/SEED_DATA.md)** | Fixture & Master Seed Data: Spesifikasi data dummy realistis Universitas Nusantara (2 Fakultas, 4 Prodi, 10 Dosen, 50 Mahasiswa, 20 Mata Kuliah, 10 Jadwal) dan akun pengujian default. | Developer, QA, & Database Administrator |
| **[INTEGRATIONS.md](file:///c:/SICA/docs/INTEGRATIONS.md)** (alias: `INTEGRATION_SPEC.md`) | Enterprise External Integrations + §5 kebijakan zero paid API key & adapter 47 modul: PDDikti Neo Feeder Web Services, Payment Gateway Webhook (Midtrans/Xendit) auto-reconcile ledger, Messaging Queue (BullMQ WhatsApp/Email), & Pre-signed Cloudflare R2/S3. | Integration Architect, Backend, & Finance Engineers |
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

---

## 5. Keputusan Arsitektur Utama (`ADR-1`–`ADR-10`)

Ringkasan keputusan arsitektur di [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md):

1. **ADR-1 (Modular Monolith)**: Mengutamakan integritas transaksi ACID satu database di tahun-tahun awal daripada kompleksitas microservices.
2. **ADR-2 (Shared-Schema + RLS)**: Multi-tenancy pooled dengan PostgreSQL Row-Level Security dan kolom `tenant_id` wajib di setiap tabel domain.
3. **ADR-3 (Drizzle ORM)**: SQL eksplisit untuk mendukung GUC `SET LOCAL app.tenant_id`, partisi, dan advisory lock.
4. **ADR-4 (Zod Contracts)**: Validasi tunggal di `packages/contracts` yang digunakan bersama oleh Frontend Next.js, API NestJS, dan BullMQ worker.
5. **ADR-5 (Mata Uang & Waktu)**: Uang disimpan sebagai `bigint` rupiah utuh; waktu disimpan sebagai `timestamptz` UTC.
6. **ADR-6 (UUIDv7)**: Primary key UUID berurut waktu (time-ordered), ramah index B-tree, dan tidak membocorkan volume data.
7. **ADR-7 (Transactional Outbox)**: Penjaminan keandalan event keluar dalam transaksi database yang sama dengan mutasi domain.
8. **ADR-8 (Auth Mandiri Primitif)**: Menghindari vendor-lockin autentikasi demi fleksibilitas multi-role ber-scope dan federasi IdP kampus (OIDC/SAML).
9. **ADR-9 (Worker Process Terpisah)**: Pemisahan proses background job (BullMQ) dari web API untuk mencegah habisnya request pool saat beban batch tinggi.
10. **ADR-10 (Container & Managed DB)**: Deployment berbasis Docker container (ECS/Fly/K8s) dengan RDS PostgreSQL terkelola + read replica.

## Cakupan Enterprise 47 Modul + SuperApp (2026-10-20)

Katalog kanonik: PRD §10 · Batas modul, real-time & engine lokal: ARCHITECTURE §11 · Skema & zero-hardcoding: DATA_MODEL §15 · Endpoint & WebSocket: API_SPEC §6 · Dashboard grid per role: UI_UX_DESIGN §10 · 11 aksi & matriks: SECURITY_COMPLIANCE §10, RBAC_MATRIX §12 · Integrasi: INTEGRATIONS §5 · Urutan eksekusi: ROADMAP_TASKS §0.
