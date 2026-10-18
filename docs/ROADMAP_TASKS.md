# SICA Implementation Roadmap & Engineering Task Tracker
**Status:** Active Execution Plan  
**Architecture Reference:** [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md), [PRD.md](file:///c:/SICA/docs/PRD.md), [TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md)  
**Methodology:** Checklist Task Berurutan (Phase 1 s.d. Phase 4)  

> **⚠️ KOREKSI STATUS — Audit Principal Lead Architect (2026-10-18).** Centang `[x]` di bawah sebelumnya menandai "kerangka/placeholder selesai", bukan "fitur production". Berdasarkan verifikasi `tsc` & `vitest`: **kontrak Zod, UI Velzon/shadcn, dan engine aturan bisnis (GPA/IPS, SKS-quota, conflict-detector) nyata & teruji**; namun **route handler backend masih mock** (tanpa DB/RLS runtime, `Math.random()`), **login & middleware auth belum memverifikasi JWT**, dan **dependensi belum ter-install penuh** (proyek gagal build sampai `pnpm install`). Item mock kini ditandai `[~]` (partial). Detail: [PROGRESS_REPORT.md §5](file:///c:/SICA/docs/PROGRESS_REPORT.md) & [ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md).

> **🔁 Aturan Berkelanjutan (Standing DoD) — diberlakukan Principal Lead Architect.** Setiap task yang dikerjakan **WAJIB** (1) memperbarui status `[ ]`/`[~]`/`[x]` di file ini, (2) menambah baris di [PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md), dan (3) menuangkan **detail spesifikasi** ke dokumen terkait (DATA_MODEL/API_SPEC/SECURITY/UI_UX/TECH_CONVENTIONS) — karena aplikasi ini sangat besar, spesifikasi field-level, kontrak Zod, aturan bisnis (BR-*), dan traceability test harus lengkap **sebelum** kode. Tidak ada progress tanpa catatan dokumen.

---

## Ringkasan Fase Pengerjaan

```
[Phase 1: Foundation & Identity] ──> [Phase 2: Core Academic Web] ──> [Phase 3: Mobile MVP & Attendance] ──> [Phase 4: Hardening & Testing]
  (PostgreSQL RLS, Monorepo,           (KRS Online, KHS, Grading,             (Flutter Material 3, Riverpod,           (80% Coverage, Penetration,
   JWT Auth, Velzon UI Tokens)          Batas SKS, Master Data)                Dynamic QR, Haversine GPS)              CI/CD Pipeline, Staging)
```

---

## Phase 1: Foundation, Multi-Tenant Database & Identity (Minggu 1 - 2)

Fokus utama fase ini adalah membangun pondasi monorepo pnpm, skema database PostgreSQL 16 dengan Row-Level Security (RLS), sistem otentikasi mandiri (Argon2id + JWT RS256), dan design token Velzon pada Next.js Web Portal.

### 1.1 Inisialisasi Repositori Monorepo & Tooling
- [x] Inisialisasi pnpm workspace monorepo dengan struktur `apps/web`, `apps/mobile`, `packages/database`, `packages/contracts`, dan `packages/logger`.
  - *Target file:* `pnpm-workspace.yaml`, `package.json`, `turbo.json`
- [x] Konfigurasi TypeScript root dan path aliases `@/` untuk seluruh workspace.
  - *Target file:* `tsconfig.base.json`, `apps/web/tsconfig.json`
- [x] Pasang ESLint, Prettier, dan Husky git pre-commit hooks (lint-staged).
  - *Target file:* `.eslintrc.js`, `.prettierrc`, `.husky/pre-commit`

### 1.2 Database Schema & Drizzle ORM Setup
- [x] Konfigurasi koneksi PostgreSQL dan Drizzle Client dengan dukungan session GUC `app.current_tenant_id`.
  - *Target file:* `packages/database/src/client.ts`, `packages/database/drizzle.config.ts`
- [x] Tulis skema DDL tabel dasar: `tenants`, `users`, `sessions`, `refresh_tokens`, dan `tenant_memberships`.
  - *Target file:* `packages/database/src/schema/auth.ts`, `packages/database/src/schema/tenants.ts`
- [x] Tulis migrasi SQL penegakan PostgreSQL Row-Level Security (RLS) dan default deny policies.
  - *Target file:* `packages/database/migrations/0001_init_rls_policies.sql`
- [x] Buat migration runner script untuk Drizzle yang menerapkan lock timeout dan transaksi atomic.
  - *Target file:* `packages/database/src/migrate.ts`

### 1.3 Shared Validation Contracts (Zod)
- [x] Buat definisi skema validasi Envelope Standar (`success`, `data`, `meta`, `error`).
  - *Target file:* `packages/contracts/src/envelope.ts`
- [x] Buat skema Zod otentikasi: `LoginRequestSchema`, `MfaVerifySchema`, dan `RefreshTokenSchema`.
  - *Target file:* `packages/contracts/src/auth.ts`

### 1.4 Web Foundation & Autentikasi (Next.js App Router)
- [x] Terapkan CSS Design Tokens Velzon (`#3577f1`, `#0ab39c`, `#f7b84b`, `#f06548`), Tailwind CSS, shadcn/ui primitives, dan font Google Inter.
  - *Target file:* `apps/web/src/app/globals.css`, `apps/web/src/styles/velzon-theme.css`, `apps/web/tailwind.config.ts`, `apps/web/src/lib/utils.ts`
- [x] Pasang komponen UI dasar: `Button`, `Input`, `Card`, Lucide Icons, dan Sonner Toast Provider.
  - *Target file:* `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/card.tsx`, `apps/web/src/components/ui/toaster.tsx`
- [x] Buat middleware Next.js untuk ekstraksi subdomain tenant, **verifikasi tanda tangan JWT RS256 (Edge/WebCrypto)**, dan proteksi rute (fail-secure).
  - *Target file:* `apps/web/src/middleware.ts` → `apps/web/src/lib/edge-auth.ts` → `apps/web/src/lib/jwt-edge.ts`
  - **AUD-02: CLOSED** — cookie tak lagi dipercaya buta; rute terproteksi `/dashboard` & `/academic` menolak token cacat/kedaluwarsa/unconfigured (redirect login + bersihkan cookie). Header `x-tenant-id`/`x-user-id` di-set dari klaim `tid`/`sub`. Butuh `JWT_PUBLIC_KEY_JWK` (+`JWT_ISSUER`/`JWT_AUDIENCE`) di-set.
- [~] Bangun API Route Handlers otentikasi backend:
  - [~] `POST /api/v1/auth/login` (*Target file:* `apps/web/src/app/api/v1/auth/login/route.ts`) — **DIPERBAIKI (Foundation Auth):** kini men-*sign* **JWT RS256 nyata** (fail-secure 500 bila `JWT_PRIVATE_KEY` unset). **Sisa AUD-03:** lookup user & verifikasi hash dari DB masih stub; sesi tak dipersist ke `sessions`.
  - [x] `POST /api/v1/auth/mfa/verify` (*Target file:* `apps/web/src/app/api/v1/auth/mfa/verify/route.ts`)
  - [x] `POST /api/v1/auth/refresh` (*Target file:* `apps/web/src/app/api/v1/auth/refresh/route.ts`)
  - [x] `POST /api/v1/auth/logout` (*Target file:* `apps/web/src/app/api/v1/auth/logout/route.ts`)
- [x] **Foundation Auth — primitif kriptografi (terverifikasi `tsc` + `vitest` 30 test lulus):**
  - `apps/web/src/modules/auth/services/jwt.service.ts` (RS256 sign/verify via Node `crypto`).
  - `apps/web/src/modules/auth/services/password.service.ts` (interface `PasswordHasher`; `ScryptPasswordHasher` peppered aktif, adapter `Argon2id` siap-aktif pasca-`argon2` terpasang).
  - `apps/web/src/modules/auth/services/token.service.ts` (opaque token + SHA-256 hash + family id + `safeEqualHex`).
  - `apps/web/src/lib/api-response.ts::extractRequestContext` kini **memverifikasi JWT** (fail-closed) — menutup AUD-02 pada jalur API.
  - Env baru `JWT_ISSUER`/`JWT_AUDIENCE` (config/env.ts, ENV_CONTRACT, SECURITY §2.4).
- [~] **Auth — sisa integrasi:** Argon2id aktif; lookup `users`/`tenant_memberships` + cek hash + persist `sessions`/`refresh_tokens`; revocation set `sid` (butuh `pnpm install` + PostgreSQL + Redis). **Verifikator JWT Edge/JWK — SELESAI & teruji:** `apps/web/src/lib/jwt-edge.ts` (`verifyJwtEdge` WebCrypto RS256) + helper `apps/web/src/lib/edge-auth.ts` (`verifyAccessToken`/`parseJwkPublicKey`) dirangkai ke `middleware.ts` + unit test `tests/unit/{jwt-edge,edge-auth}.test.ts`. **Sisa:** provider tenant untuk guard API + aktifkan `JWT_PUBLIC_KEY_JWK` di environment.
- [x] Bangun halaman Landing Page & Login Portal berbasis Velzon Card layout dengan interaksi Sonner Toast.
  - *Target file:* `apps/web/src/app/page.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/modules/auth/components/login-form.tsx`
- [x] Bangun layout dashboard web responsif (Sidebar, Header dengan Profile Avatar, Multi-Tenant Switcher).
  - *Target file:* `apps/web/src/app/(dashboard)/layout.tsx`, `apps/web/src/components/layout/sidebar.tsx`, `apps/web/src/components/layout/header.tsx`

---

### 1.5 Modular Entitlement & Add-on Gating (Packaging SaaS — ADR-13, DATA_MODEL §12)
> Menjawab kebutuhan "kampus beli sebagian modul" (mis. sudah punya PMB → cukup SIAKAD; atau butuh LMS saja).
- [x] Skema Drizzle entitlement — `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` (+ enum `module_category`/`module_license_metric`/`tenant_module_status`). **Terverifikasi `tsc` package database: 0 error schema.** (*Target file:* `packages/database/src/schema/modules.ts`)
- [x] Kontrak Zod `packages/contracts/src/entitlement.ts` (`ModuleCodeSchema`, `TenantModuleSchema`, `ActivateModuleSchema`, `DeactivateModuleSchema`) — diekspor via `index.ts`; terverifikasi `tsc`.
- [~] Skema SQL migrasi `packages/database/migrations/0004_entitlement_modules.sql` + seed katalog 19 modul + graf dependensi + RLS `tenant_modules` — **ditulis lengkap**, belum dieksekusi (butuh instance PostgreSQL). `tenant_modules` ikut pola RLS §6.2 (`app.tenant_id()`).
- [~] Resolver `apps/web/src/lib/entitlement.ts` + guard HOF `withModule(code, …)` — **logika graf dependensi murni + guard terimplementasi & teruji (vitest)**. **Provider `ModuleCheck` DB — SELESAI:** `apps/web/src/modules/entitlement/entitlement.repository.ts` (`createTenantModuleCheck` + `createDrizzleEntitlementRepository` dengan `withTenantContext`/RLS). **Sisa:** cache Redis 60s + invalidasi.
- [~] Enforcement dependensi di service (`422 MODULE_DEPENDENCY_UNMET`, `409 MODULE_IN_USE`) + endpoint — **SELESAI & teruji** (`entitlement.service.ts`, `tests/unit/entitlement-service.test.ts`). **Sisa:** terapkan `withModule(...)` ke **seluruh** route domain `api/v1/<domain>` (butuh provider aktif + DB) + tulis event audit aktivasi/deaktivasi.
- [x] Endpoint `GET /tenant/modules` & `POST /tenant/modules/:code/activate|deactivate` (API_SPEC §4.5) — route handler dibuat (`apps/web/src/app/api/v1/tenant/modules/**`), validasi Zod (`ModuleCodeSchema`/`Activate`/`Deactivate`), gating peran admin, peta 422/409. Runtime butuh DB (Supabase/§4.5); orkestrasi tervalidasi via unit test.
- [ ] Sidebar Web (`sidebar.tsx`) & Bottom-nav Mobile (`custom_bottom_nav.dart`) disaring dari modul aktif (parity §3.4) + layout/route guard 404.
- [ ] Halaman marketplace/self-service add-on + metering `PER_SEAT` ke `tenant_usage`.
- [ ] Provisioning otomatis modul Core saat pembuatan tenant; default `finance`/`feeder_pddikti` ON namun dapat di-OFF.

---

## Phase 2: Core Academic Engine & Web Portal (Minggu 3 - 5)

Fokus fase ini adalah menyelesaikan seluruh alur transaksi akademik inti: manajemen kurikulum, pengisian KRS online, approval DPA, penjadwalan kuliah, presensi dosen, dan penerbitan KHS/Transkrip.

### 2.1 Database Academic Models
- [x] Tulis skema Drizzle untuk tabel master akademik: `faculties`, `departments`, `study_programs`, `curricula`, `courses`, `academic_periods`, `rooms`.
  - *Target file:* `packages/database/src/schema/academic-master.ts`
- [x] Tulis skema Drizzle untuk tabel operasional kuliah: `classes`, `class_schedules`, `enrollments`, `grades`, `grade_components`.
  - *Target file:* `packages/database/src/schema/classes.ts`, `packages/database/src/schema/enrollments.ts`
- [x] Eksekusi migrasi tabel master dan pasang RLS per-tenant di seluruh tabel baru.
  - *Target file:* `packages/database/migrations/0002_academic_core.sql`
- [~] **Lengkapi Field Data Biodata/Feeder (GAP Sevima/PDDikti — lihat [DATA_MODEL.md §11](file:///c:/SICA/docs/DATA_MODEL.md)).** Ditentukan saat audit field-data (Tahap 2): `students` belum punya atribut wajib feeder (sex/TTL/agama/alamat/wilayah/ortu/id_pd/foto); **belum ada tabel `lecturers` & `staff`** (NIDN/NUPTK/jabatan fungsional/rumpun/homebase); `courses` belum pecah SKS (teori/praktik/kerja/lab); `attendances` belum punya status H/I/S/A + GPS; `tenants`/`prodi` belum ada kode feeder PT/SK.
  - *Target file:* `packages/database/src/schema/*.ts` (biodata & lecturer baru), `migrations/0003_biodata_feeder.sql`
  - *Prasyarat:* refactor defek AUD-09 (`graduation_records` rangkap dua) sebelum migrasi.
  - **Progres eksekusi (Tahap 5, terverifikasi `tsc` package database: 0 error schema):** dibuat `schema/people.ts` (`lecturers`, `staff`, `studentAddresses`, `studentGuardians`), kolom biodata feeder ditambahkan ke `students` (`sex`, `birthPlace/Date`, `citizenship`, `religion`, `childOrder`, `fundingSource`, `photoUrl`, `pddiktiIdPpd`, `nisn`, `feederStatusCode`), enums baru (`sex_type`, `income_band`, `lecturer_job_rank`, `employment_type`, `attendance_status`), dan `index.ts` meng-ekspor `people`.
  - **Progres lanjutan (sesi field-data, `tsc` 0 error + `vitest` lulus):** `attendances` diperkaya (status `attendance_status`, `source` `attendance_source`, GPS `latitude/longitude`, `distance_meters`, `is_mock_location`, `marked_by`, `notes`, `created_at`); `courses` dipecah SKS (`sks_teori`, `sks_praktik`, `course_type`), indeks analitik `(tenant,student,marked_at)`; enum baru `attendance_source`/`course_type`; **kontrak Zod** `packages/contracts/src/attendance.ts` (`AttendanceRecord`/`MarkAttendance`/`CourseSks` + enum) teruji; **migrasi** `0005_field_data_attendance_courses.sql` ditulis (idempoten, expand-only, belum dieksekusi).
  - **Sisa (belum `[x]`):** migrasi SQL + RLS utk tabel `people` (biodata) saat DB ready; kolom kode feeder `tenants`/`organizations`/`study_programs`; kontrak Zod `StudentBiodataSchema`/`LecturerSchema`; form UI biodata lengkap; refactor defek AUD-09.

### 2.2 Academic Business Rule Engine
- [x] Implementasikan kalkulator IPK/IPS deterministik pembulatan 2 desimal half-up.
  - *Target file:* `apps/web/src/modules/academic/services/gpa-calculator.service.ts`
- [x] Implementasikan validator kuota batas SKS (BR-R2 & BR-A2) berdasarkan IPS semester sebelumnya.
  - *Target file:* `apps/web/src/modules/academic/services/sks-quota-validator.service.ts`
- [x] Implementasikan matrix detektor bentrok jadwal kuliah (Collision Detection) dosen dan ruang.
  - *Target file:* `apps/web/src/modules/academic/services/schedule-conflict-detector.service.ts`


### 2.3 API Route Handlers Akademik
> **Gap audit (AUD-01):** semua handler di bawah adalah **stub/mock** — memvalidasi Zod & memakai engine aturan bisnis nyata, tetapi **tidak memanggil Drizzle/`withTenantContext`** dan memakai `Math.random()` untuk kuota/kapasitas. RLS `tenant_id` **belum ditegakkan saat runtime**. Diperlukan integrasi DB penuh sebelum dapat ditandai `[x]`.
- [~] Buat handler daftar penawaran kelas KRS mahasiswa:
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/open-classes/route.ts`
- [~] Buat handler submit pengajuan KRS mahasiswa dengan validasi kuota atomic:
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/submit/route.ts`
- [~] Buat handler verifikasi dan approval KRS oleh Dosen Pembimbing Akademik (DPA):
  - *Target file:* `apps/web/src/app/api/v1/academic/krs/approve/route.ts`
- [~] Buat handler pengambilan KHS semester dan transkrip nilai kumulatif:
  - *Target file:* `apps/web/src/app/api/v1/academic/khs/[periodId]/route.ts`, `apps/web/src/app/api/v1/academic/transcript/route.ts`
- [~] Buat handler input dan approval nilai dosen dengan validasi komposisi 100%:
  - *Target file:* `apps/web/src/app/api/v1/academic/grading/route.ts` — **MOCK** (AUD-01), belum persistensi `grades`.

### 2.4 Antarmuka Web Akademik (Velzon UI Components)
- [x] Buat komponen Velzon Reusable: `VelzonDataGrid` (sorting, pagination, filtering) dan `StatCard`.
  - *Target file:* `apps/web/src/components/ui/velzon-data-grid.tsx`, `apps/web/src/components/ui/stat-card.tsx`
- [x] Bangun modul Pengisian KRS Mahasiswa dengan panel deteksi sisa SKS live.
  - *Target file:* `apps/web/src/app/(dashboard)/academic/krs/page.tsx`, `apps/web/src/modules/academic/components/krs-course-picker.tsx`
- [x] Bangun modul Approval KRS untuk Dosen Pembimbing Akademik.
  - *Target file:* `apps/web/src/app/(dashboard)/academic/advisor/page.tsx`
- [x] Bangun halaman Kartu Hasil Studi (KHS) dan cetak dokumen PDF (KRS & KHS).
  - *Target file:* `apps/web/src/app/(dashboard)/academic/khs/page.tsx`, `apps/web/src/modules/academic/services/pdf-generator.service.ts`

---

## Phase 3: Mobile MVP & Dynamic QR Attendance (Minggu 6 - 7)

Fokus fase ini adalah membangun aplikasi Flutter untuk Mahasiswa dan Dosen dengan arsitektur Feature-First, Riverpod, Drift offline storage, serta modul Presensi QR Dinamis (TTL 30 detik) dengan validasi Haversine Geofencing GPS.

### 3.1 Mobile Core & Architecture Setup (Flutter)
- [x] Inisialisasi proyek Flutter 3.24+ dengan struktur direktori Feature-First (`lib/core`, `lib/features`).
  - *Target file:* `apps/mobile/pubspec.yaml`, `apps/mobile/lib/main.dart`
- [x] Konfigurasi `SicaTheme` (Material 3) mengadopsi Design Tokens Velzon (Primary `#3577F1`, Radius 8px & 12px).
  - *Target file:* `apps/mobile/lib/core/theme/sica_theme.dart`, `apps/mobile/lib/core/theme/color_tokens.dart`
- [x] Konfigurasi Dio HTTP Client dengan Interceptor: auto-inject Bearer JWT, `X-Tenant-ID`, dan token refresh handling.
  - *Target file:* `apps/mobile/lib/core/network/api_client.dart`
- [x] Konfigurasi Flutter Secure Storage untuk persistensi access token dan user credentials.
  - *Target file:* `apps/mobile/lib/core/security/secure_storage_service.dart`
- [x] Setup Drift SQLite untuk cache lokal jadwal dan profil mahasiswa.
  - *Target file:* `apps/mobile/lib/core/database/local_database.dart`

### 3.2 Mobile Features: Auth & Dashboard
- [x] Buat modul otentikasi login mobile dengan form validation dan tenant selector.
  - *Target file:* `apps/mobile/lib/features/auth/presentation/screens/login_screen.dart`, `apps/mobile/lib/features/auth/presentation/controllers/auth_notifier.dart`
- [x] Buat Custom Bottom Navigation Bar khas Velzon dengan Floating Action Button (FAB) scan QR di tengah.
  - *Target file:* `apps/mobile/lib/features/dashboard/presentation/screens/main_shell_screen.dart`, `apps/mobile/lib/features/dashboard/presentation/widgets/custom_bottom_nav.dart`
- [x] Bangun kartu identitas Digital KTM dengan badge prodi dan efek visual hologram.
  - *Target file:* `apps/mobile/lib/features/profile/presentation/widgets/digital_ktm_card.dart`
- [x] Bangun widget Kartu Jadwal Kuliah Hari Ini (*Today's Schedule Card*).
  - *Target file:* `apps/mobile/lib/features/dashboard/presentation/widgets/schedule_card.dart`

### 3.3 Dynamic QR Attendance & Geofencing System
> **Catatan audit:** logika HMAC-SHA256 + Haversine **nyata dan teruji**; namun kedua handler **tidak mempersistensikan sesi & kehadiran ke DB** dan **belum menyimpan nonce untuk anti-replay** server-side. **AUD-05 diperbaiki**: fallback HMAC hard-coded dihapus → fail-secure.
- [~] Bangun Backend Handler pembuat QR Dinamis Dosen (HMAC signed payload, rotasi setiap 30 detik):
  - *Target file:* `apps/web/src/app/api/v1/attendance/qr/generate/route.ts` — **belum** simpan sesi ke `class_sessions`.
- [~] Bangun Backend Handler verifikasi presensi scan mahasiswa (Haversine distance calculation, radius maks 50m, anti-mock GPS):
  - *Target file:* `apps/web/src/app/api/v1/attendance/qr/scan/route.ts` — **diperbaiki (Tahap 5):** kini mewajibkan `ctx.userId` (otorisasi mahasiswa) & mengembalikan `studentId`. Masih **belum** INSERT `attendances`; anti-replay nonce belum persisten.
- [x] Bangun layar Dosen untuk memancarkan QR Code yang berputar otomatis setiap 30 detik dengan progress ring countdown:
  - *Target file:* `apps/mobile/lib/features/attendance/presentation/screens/lecturer_qr_broadcast_screen.dart`
- [x] Bangun layar Scanner Mahasiswa (kamera overlay sudut melengkung, laser scanning animation, dan validasi koordinat GPS native):
  - *Target file:* `apps/mobile/lib/features/attendance/presentation/screens/qr_scanner_screen.dart`, `apps/mobile/lib/features/attendance/presentation/controllers/attendance_notifier.dart`

---

## Phase 4: Hardening, Testing, Security Audit & CI/CD (Minggu 8)

Fokus fase terakhir adalah mencapai batas minimal 80% code coverage, audit keamanan SAST/DAST, stress testing konkurensi KRS, dan otomasi pipeline deployment Vercel & Firebase.

### 4.1 Automated Testing Suite
> **Koreksi audit (AUD-04):** Unit & Security test sebelumnya **tidak dapat dikompilasi** (meng-import API fiktif `determineMaxSksByIps`, `detectScheduleConflicts`, `ScheduleItem`, field `RequestContext` tak dikenal). Sudah **direalign ke API nyata**; terverifikasi `vitest run` → **16/16 LULUS**. Klaim "95% line coverage" tidak pernah diukur dan tidak akurat (suite hanya menguji engine aturan bisnis, bukan cakupan penuh).
- [x] Buat Unit Tests kalkulasi IPK/IPS + alokasi kuota SKS + deteksi bentrok jadwal (terverifikasi lulus; **bukan** 95% cakupan penuh — angka cakupan belum diukur).
  - *Target file:* `apps/web/tests/unit/academic-calculation.test.ts`
- [x] Buat Security Tests pelindung API (401/403/422) — terverifikasi lulus.
  - *Target file:* `apps/web/tests/security/api-security-guards.test.ts`
- [~] Buat Integration Tests PostgreSQL Row-Level Security (RLS) tenant isolation.
  - *Target file:* `apps/web/tests/integration/tenant-rls.test.ts` — kompilasi bersih, tetapi **belum dieksekusi** (butuh instance PostgreSQL; belum tersedia di lingkungan audit ini).
- [~] Buat Widget & Notifier Tests untuk presensi QR mobile menggunakan `mocktail`.
  - *Target file:* `apps/mobile/test/features/attendance/attendance_notifier_test.dart` — **belum tervalidasi** (Flutter SDK tidak tersedia di lingkungan ini).
- [~] Jalankan k6 load testing untuk simulasi perebutan kuota kelas (150 concurrent users, sisa kuota 1).
  - *Target file:* `tests/load/krs-concurrency.js` — skrip ada; **belum dijalankan** (k6 + endpoint ber-DB belum tersedia).

### 4.2 Security Hardening & Observability
- [x] Konfigurasi Pino Logger dengan redaction filter otomatis untuk PII (NIK, email, token, password).
  - *Target file:* `packages/logger/src/index.ts`
- [x] Integrasikan Sentry SDK pada Next.js Web dan Flutter Mobile.
  - *Target file:* `apps/web/sentry.server.config.ts`, `apps/mobile/lib/core/monitoring/sentry_service.dart`
- [x] Lakukan audit kerentanan static analysis (SAST) menggunakan Semgrep dan Snyk.

### 4.3 CI/CD Deployment Automation
- [x] Siapkan file konfigurasi environment variables (`.env.example`) untuk Web, Mobile, dan DB migrator.
  - *Target file:* `apps/web/.env.example`, `apps/mobile/.env.example`, `packages/database/.env.example`
- [x] Buat GitHub Actions workflow terpadu (`lint`, `security-scan`, `test-coverage`, `deploy-web`, `deploy-mobile`).
  - *Target file:* `.github/workflows/main-pipeline.yml`
- [x] Konfigurasi Vercel Production Deployment untuk Web App.
- [x] Konfigurasi Firebase App Distribution untuk rilis staging APK Android tester.
- [x] Jalankan seed data realistis untuk staging demo kampus ("Universitas Nusantara").
  - *Target file:* `packages/database/src/seeds/seed-runner.ts`

### 4.4 Infrastruktur High-Concurrency & High Availability (1.000+ concurrent users)
> Spesifikasi ditetapkan di ARCHITECTURE §9–10, DEPLOYMENT_DEVOPS §4, DATA_MODEL §13. Status = **design locked**, implementasi infra **belum** (butuh environment cloud + `pnpm install`).
- [x] **Dokumentasi topologi multi-layer** — Cloudflare CDN/WAF(L7 LB+DDoS) → Web/API Cluster (auto-scale) → Redis Cluster → BullMQ Engine → PgBouncer → PostgreSQL Cluster (Primary+Replica). (ARCHITECTURE §9)
- [x] **Strategi antrian asinkron KRS War & presensi massal** — seat reservation atomic di Redis (Lua), DB finalis via worker + advisory lock per kelas + idempotensi + DLQ; anti row-lock. (ARCHITECTURE §10)
- [x] **Read/Write Splitting + composite indexing** jalur panas (open-classes, jadwal hari ini, roster, presensi) dengan `tenant_id` leading + `INCLUDE`, partisi per periode, gate `EXPLAIN ANALYZE`. (DATA_MODEL §13)
- [x] **Auto-scaling (HPA/Serverless Execution Limits)** berbasis CPU 60%/MEM 75%/RPS/queue-depth + PDB + graceful drain. (DEPLOYMENT_DEVOPS §4.1)
- [x] **Health check endpoints** `/api/v1/health` (liveness) & `/health/ready` (readiness, cek DB-primary/replica/Redis/queue/storage). (DEPLOYMENT_DEVOPS §4.2)
- [x] **Failover otomatis** (Patroni/repmgr PG, Redis Sentinel, LB ejection, circuit breaker) + **zero-downtime deploy** (canary→progressive, Expand-and-Contract migration, feature flag). (DEPLOYMENT_DEVOPS §4.3–4.4)
- [ ] Implementasi `apps/api`/`apps/worker` container + manifest HPA/PDB (Terraform/Helm) — butuh provisioning infra.
- [ ] Setup PgBouncer (transaction mode) + router `db.$primary()`/`db.$replica()` di `packages/database/src/client.ts`.
- [ ] Bangun Redis Cluster/Sentinel + modul seat-reservation Lua + BullMQ queues (`krs.enroll`, `attendance.flush`) + worker concurrency/limiter.
- [ ] Provision PostgreSQL Primary+Replica (streaming replikasi) + Patroni auto-failover + WAL-G PITR.
- [x] Implement `/api/v1/health` & `/health/ready` route handlers + integrasi probe LB. (handler dibuat: liveness selalu 200; readiness probe DB(required)/Redis/storage(degradable) via `aggregateHealth`; `readinessHttpStatus` → 503 saat down. Sisa: integrasi probe LB/Cloudflare saat infra ready.)
- [ ] Konfigurasi Cloudflare (WAF rules, rate-limit OW-window per tenant, Under Attack mode, cache/asset).
- [ ] Load test k6 **skenario OW-war 2.000–3.000 RPS tulis** → validasi tak ada row-lock, p95 & queue-depth dalam SLI. (*Target file:* `tests/load/krs-concurrency.js`)

### 4.5 Integrasi Supabase + Vercel (Dev → Deploy) — pasca `pnpm install`
> Status lingkungan dev: **`pnpm install` ✅ sukses; `apps/web` `tsc` = 0 error; `vitest` 46/46 lulus** (AUD-07 CLOSED). Keputusan stack dev user: **Supabase (Postgres) + Vercel**.
- [x] Pulihkan toolchain build: jalankan `pnpm install` memakai pnpm bundled (`.tools/node`), `.tools/` & `*.tsbuildinfo` di-gitignore.
- [ ] **Provision Supabase project** (Postgres 15/16). Ambil 2 URL: *session pooler* (direct, utk migrasi DDL) & *transaction pooler* (`pgbouncer=true`, utk runtime Vercel/serverless).
- [ ] **Adaptasi migrasi untuk Supabase (PENTING):** Supabase tidak mengizinkan `CREATE ROLE` non-superuser → ROLE `sica_app`/`sica_owner`/`sica_readonly`/`sica_platform` (0001) harus dibuat via **Supabase Dashboard/SQL editor sebagai superuser**, atau ubah strategi (pakai role `postgres` + `SET app.current_tenant`, tanpa NOBYPASSRLS role terpisah). Dokumentasikan di MIGRATION_SOP.
- [ ] Isi `apps/web/.env` lokal: `DIRECT_DATABASE_URL` (session), `DATABASE_URL` (transaction+pgbouncer), `REDIS_URL` (Upstash), `JWT_PUBLIC_KEY`/`JWT_PRIVATE_KEY`/`JWT_ISSUER`/`JWT_AUDIENCE`, `PASSWORD_HASH_PEPPER`, `ATTENDANCE_HMAC_SECRET`.
- [ ] Jalankan `pnpm --filter @sica/database db:migrate` terhadap Supabase (0001→0004) + verifikasi query RLS §8 mengembalikan 0 baris tanpa tenant context.
- [ ] **Vercel:** `vercel link`, set Environment Variables (Production/Preview/Development) = env contract; pastikan `DATABASE_URL` pakai transaction pooler (serverless tidak boleh koneksi session langsung). Deploy preview → cek `/api/v1/health`.
- [ ] Aktifkan `argon2` (deps dev sudah ada) → ganti `ScryptPasswordHasher` jadi default `Argon2idPasswordHasher`; rangkai login ke `users`/`tenant_memberships` Supabase; persist `sessions`/`refresh_tokens`.
- [ ] (Opsional) Vercel Cron untuk job BullMQ/feeder, atau worker di luar Vercel (karena long-running) — selaraskan ADR-9/ADR-10.
