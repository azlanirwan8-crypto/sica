# SICA Implementation Roadmap & Engineering Task Tracker
**Status:** Active Execution Plan  
**Architecture Reference:** [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md), [PRD.md](file:///c:/SICA/docs/PRD.md), [TECH_CONVENTIONS.md](file:///c:/SICA/docs/TECH_CONVENTIONS.md)  
**Methodology:** Checklist Task Berurutan (Phase 1 s.d. Phase 4)  
**Baseline Kompetitif:** [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) — hasil studi dokumentasi Sevima (peran, menu, modul, data master, flow) + peta selisih SICA

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
- [x] Terapkan CSS Design Tokens Velzon (`#3577f1`, `#0ab39c`, `#f7b84b`, `#f06548`), Tailwind CSS, shadcn/ui primitives, dan font Google **Plus Jakarta Sans** (web; `font-sans` di `tailwind.config.ts`, dimuat via `<link>` di `layout.tsx`). *(Sebelumnya Inter — lihat PROGRESS §5.20→§5.21.)*
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
  - [x] **Login split-screen ala Velzon** (PROGRESS §5.19): panel kiri gelap (brand + ilustrasi produk CSS/SVG + heading + 3 badge trust) / panel kanan form; `LoginForm` + toggle lihat sandi + SSO Google/Microsoft. Perbaikan bug global `h1` color (judul gelap jadi terbaca) & bug layout collapse (ilustrasi terpotong saat zoom 100% → kini flow-normal, terukur aman).
    - [x] **Refactor total CSS/Font/Layout** (PROGRESS §5.21, "Principal Lead UI/UX Engineer"): font web → **Plus Jakarta Sans**; `login-form.tsx` & `page.tsx` ditulis ulang dengan kelas Tailwind eksplisit sesuai kontrak [UI_UX_DESIGN §4.3](file:///c:/SICA/docs/UI_UX_DESIGN.md) (root `h-screen overflow-hidden`, panel `w-1/2`, gradient `slate-950→blue-950`, label `uppercase tracking-wider`, tombol `velzon-primary`). Spec `blue-600` direkonsiliasi ke token Velzon. `tsc` 0, `lint` bersih, terverifikasi browser.
  - [x] **Katalog 19 modul per-peran** di landing (`module-catalog.tsx`) dari seed entitlement nyata + filter peran/kategori; **seksi Benchmark** (`benchmark.tsx`) diferensiator arsitektur + cakupan pasar. Copy i18n id/en.
  - *Target file:* `apps/web/src/app/page.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/modules/auth/components/login-form.tsx`
- [x] Bangun layout dashboard web responsif — **Velzon "layout horizontal"** (baris 1: brand + pencarian + ikon utilitas + kartu profil; baris 2: menu navigasi berikon + dropdown). Sidebar vertikal & `header.tsx` lama **dihapus** sesuai koreksi user.
  - *Target file:* `apps/web/src/app/(dashboard)/layout.tsx`, `apps/web/src/components/layout/top-nav.tsx`
  - Menu hanya menunjuk rute nyata (`/dashboard`, `/academic/krs|khs|advisor`); item tanpa halaman diberi badge "Segera" (tak ada link mati). Responsif: menu→hamburger <1024px, search <1280px, util/profil <768px. Tanpa overflow horizontal (terverifikasi browser @495px).
- [x] **Dashboard DB-backed & role-aware** (§5.18 PROGRESS) — `modules/academic/services/dashboard.service.ts` (`loadDashboard` via `withTenantContext`/RLS + `calculateIpk`); `page.tsx` async RSC baca identitas dari header JWT-middleware. Menutup **AUD-01 jalur baca dashboard**. + `GET /api/v1/auth/me` (`me.service.ts`) untuk profil navigasi.
- [x] **Seed data akademik dev** — `apps/web/src/scripts/dev-seed-academic.ts` (`pnpm --filter @sica/web seed:academic`, idempoten) mengisi periode/prodi/kurikulum/matakuliah/ruang/kelas/sesi/mahasiswa/dosen/enrollment/nilai/presensi tenant `demo` supaya efek tiap role terlihat saat uji lokal.
- [x] **Landing page marketing lengkap + brand** — `app/page.tsx` (Nav sticky scroll-spy, Hero entrance + mockup, Stats CountUp, Modul, Deep-dive, Peran tab, Keamanan, Integrasi, Harga, Testimoni, FAQ, CTA, Footer) dengan copy i18n `id`/`en`; motion `components/landing/motion.tsx` hormat `prefers-reduced-motion`. Logo transparan + emblem (`scripts/make-logo-transparent.mjs`, `scripts/crop-logo-emblem.mjs`), lockup "SICA — System Integration Central Academic".

---

### 1.5 Modular Entitlement & Add-on Gating (Packaging SaaS — ADR-13, DATA_MODEL §12)
> Menjawab kebutuhan "kampus beli sebagian modul" (mis. sudah punya PMB → cukup SIAKAD; atau butuh LMS saja).
- [x] Skema Drizzle entitlement — `modules`, `module_dependencies`, `plan_modules`, `tenant_modules` (+ enum `module_category`/`module_license_metric`/`tenant_module_status`). **Terverifikasi `tsc` package database: 0 error schema.** (*Target file:* `packages/database/src/schema/modules.ts`)
- [x] Kontrak Zod `packages/contracts/src/entitlement.ts` (`ModuleCodeSchema`, `TenantModuleSchema`, `ActivateModuleSchema`, `DeactivateModuleSchema`) — diekspor via `index.ts`; terverifikasi `tsc`.
- [~] Skema SQL migrasi `packages/database/migrations/0004_entitlement_modules.sql` + seed katalog 19 modul + graf dependensi + RLS `tenant_modules` — **ditulis lengkap**, belum dieksekusi (butuh instance PostgreSQL). `tenant_modules` ikut pola RLS §6.2 (`app.tenant_id()`).
- [~] Resolver `apps/web/src/lib/entitlement.ts` + guard HOF `withModule(code, …)` — **logika graf dependensi murni + guard terimplementasi & teruji (vitest)**. **Provider `ModuleCheck` DB — SELESAI:** `apps/web/src/modules/entitlement/entitlement.repository.ts` (`createTenantModuleCheck` + `createDrizzleEntitlementRepository` dengan `withTenantContext`/RLS). **Sisa:** cache Redis 60s + invalidasi.
- [~] Enforcement dependensi di service (`422 MODULE_DEPENDENCY_UNMET`, `409 MODULE_IN_USE`) + endpoint — **SELESAI & teruji** (`entitlement.service.ts`, `tests/unit/entitlement-service.test.ts`). **Sisa:** terapkan `withModule(...)` ke **seluruh** route domain `api/v1/<domain>` (butuh provider aktif + DB) + tulis event audit aktivasi/deaktivasi.
- [x] Endpoint `GET /tenant/modules` & `POST /tenant/modules/:code/activate|deactivate` (API_SPEC §4.5) — route handler dibuat (`apps/web/src/app/api/v1/tenant/modules/**`), validasi Zod (`ModuleCodeSchema`/`Activate`/`Deactivate`), gating peran admin, peta 422/409. Runtime butuh DB (Supabase/§4.5); orkestrasi tervalidasi via unit test.
- [ ] Navigasi Web (`components/layout/top-nav.tsx` — **`sidebar.tsx` sudah dihapus**, diganti layout Velzon horizontal) & Bottom-nav Mobile (`custom_bottom_nav.dart`) disaring dari modul aktif (parity §3.4) + layout/route guard 404. **Dikerjakan di Slice ADM-1** (ROADMAP §2.5.1).
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
  - **Progres lanjutan (sesi field-data, `tsc` 0 error + `vitest` lulus):** `attendances` diperkaya (status `attendance_status`, `source` `attendance_source`, GPS `latitude/longitude`, `distance_meters`, `is_mock_location`, `marked_by`, `notes`, `created_at`); `courses` dipecah SKS (`sks_teori`, `sks_praktik`, `course_type`), indeks analitik `(tenant,student,marked_at)`; enum baru `attendance_source`/`course_type`; **kontrak Zod** `attendance.ts` **dan** `people.ts` (`StudentBiodataSchema`/`StudentGuardianSchema`/`LecturerSchema` + enum) teruji; **migrasi** `0005_field_data_attendance_courses.sql` ditulis (idempoten, expand-only, belum dieksekusi).
  - **Sisa (belum `[x]`):** migrasi SQL + RLS utk tabel `people` (biodata) saat DB ready; kolom kode feeder `tenants`/`organizations`/`study_programs` + `courses.sks_praktik_kerja`/`sks_lab`/`bahasa_pengantar`/`kode_rumpun` + `attendances.meeting_seq`/`device_id`/`accuracy_m`; form UI biodata lengkap; refactor defek AUD-09.

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

### 2.5 Area Administrasi & Data Master (keputusan urutan 2026-10-19)
> **Keputusan pemilik produk:** pengerjaan berikutnya **Admin dulu, mulai dari master data**, bukan loop KRS-read lebih dulu. Dasar: seluruh transaksi (KRS, nilai, presensi, tagihan, feeder) punya FK ke master data; hari ini master data **hanya** bisa diisi skrip seed, sehingga kampus tidak bisa mengelola sendiri — padahal "mandiri kelola tanpa vendor" adalah titik jual terhadap SIAKAD legacy.
> **Rujukan wajib sebelum kode:** [BENCHMARK_SEVIMA.md](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) (§2, §2A, §3–§7), [PRD §5.8](file:///c:/SICA/docs/PRD.md) (FR-ADM-07…13, FR-IDT-04, FR-DOC-02, dll.), [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md), [API_SPEC §4.6](file:///c:/SICA/docs/API_SPEC.md), [UI_UX_DESIGN §9](file:///c:/SICA/docs/UI_UX_DESIGN.md).

#### 2.5.0 Prasyarat dokumen-sudah-selesai (siklus ini)
- [x] Studi dokumentasi Sevima (menu admin, `Data Pelengkap` 6 kategori, `Setting Prodi` 9 tab, 20 pemetaan sumber Feeder, model hak akses 6 aksi, portofolio 20+ modul, model harga & hosting) dituangkan sebagai catatan resmi.
- [x] PRD: 13 FR baru + koreksi out-of-scope persuratan + usulan perluasan katalog modul (`litabmas`, `documents`, `kerjasama`).
- [x] DATA_MODEL §14: matriks status objek admin + DDL baru (`reference_items`/`reference_kinds`, `tenant_settings`, `enrollment_schemes`, `course_equivalencies`, `student_status_history` revisi, `permission_verb`).
- [x] API_SPEC §4.6: pola CRUD seragam, 23 objek, transisi status periode, aksi massal, impor & rekonsiliasi, 12 kode error baru.
- [x] UI_UX_DESIGN §9: IA Area Admin + pola daftar→drawer + kontrak visual 8 gugus + i18n kunci `admin.*`.
- [x] SECURITY_COMPLIANCE §3.3: matriks izin Admin 6 aksi + 4 lapis penegakan `/admin/*` + aturan impersonation & reset kredensial (anti-pattern Sevima).
- [x] TECH_CONVENTIONS §1.1.1: pohon file & aturan penamaan kode Area Admin (disesuaikan realita `(dashboard)/`, bukan pohon target yang masih drift).
- [x] **RBAC_MATRIX.md diadopsi & didaftarkan** sebagai dokumen #19 (sumber kebenaran hak akses, 22 peran + ~160 permission); §11 rekonsiliasi ditambahkan; **G-08 CLOSED** (`.cursor/rules/02-security.mdc` disinkron EdDSA→RS256).
- [ ] **Celah `G-01`–`G-07` + `G-09` (RBAC_MATRIX §8.2) menjadi pekerjaan ADM-1/ADM-8** — terverifikasi di kode: substring `isAdminRole` [guards.ts:6-11](file:///C:/SICA/apps/web/src/modules/entitlement/guards.ts#L6-L11), `TODO` verifikasi role ADVISER [krs/approve/route.ts:31](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts#L31), top-nav statis [top-nav.tsx:89-112](file:///C:/SICA/apps/web/src/components/layout/top-nav.tsx#L89-L112). `G-09` = tambah kolom `permissions.resource` + `permissions.verb` pada migrasi ADM-8. **`G-08` CLOSED.**
- [ ] **AUD-09 (blocking, harus selesai sebelum migrasi ADM):** refactor `graduation_records` yang terdefinisi dua kali di [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) (baris ±811 dan ±872).

#### 2.5.1 Slice ADM-1 — Kerangka Admin (fondasi semua slice)
- [ ] Skema + migrasi `0012_audit_outbox.sql`: `audit_logs` (partisi, hash-chain), `audit_chain_head`, `outbox`, `idempotency_keys`, `login_events`.
- [ ] Guard rute `/admin/*` 4 lapis: JWT → role+scope → `withModule` → `withTenantContext` (helper `requireAdmin(ctx, resource, verb, scope)`).
- [ ] Kontrak Zod `packages/contracts/src/admin-shell.ts` (list query, `IdempotencyKey`, envelope error admin) + `master-data.ts` (kerangka).
- [ ] Layout `/admin` (sub-nav grouped collapsible + context strip Periode/Prodi/Status) Velzon horizontal; filter menu dari entitlement aktif (menutup ROADMAP §1.5 item "sidebar disaring").
- [ ] Komponen `empty-state.tsx` (sebab + tautan perbaikan) & `impact-dialog.tsx` (pratinjau dependensi sebelum hapus).
- [ ] i18n `admin.menu.*`, `admin.errors.*` di `id.json` + `en.json` (bentuk identik).
- [ ] Unit + integration test: tolak akses lintas tenant & lintas scope; `VALIDATE` tidak bisa dipakai `UPDATE`.

#### 2.5.2 Slice ADM-2 — Tahun Akademik · Periode · Kalender
- [ ] Skema Drizzle `academic_calendar_events` + migrasi `0007_admin_calendar_reference.sql` + RLS generator §6.2.
- [ ] Kontrak Zod + OpenAPI untuk `academic-years`, `academic-periods`, `calendar-events` (enum `kind` termasuk `PDDIKTI_*_DUE`).
- [ ] API CRUD seragam §4.6 + `POST /admin/periode/:id/status` dengan matriks transisi (DRAFT/OPEN/CLOSED) + `403 CALENDAR_REGULATORY_EVENT` + `403 REOPEN_REQUIRES_APPROVAL`.
- [ ] Penegakan `423 PERIOD_CLOSED` pada **semua** rute tulis domain (middleware/helper satu titik, bukan cek tersebar).
- [ ] UI: 3 halaman master (daftar→drawer), tab `Band`/`Libur`, kolom Status, nonaktif-soft dulu.
- [ ] Test: buka periode belum siap → `422 PERIOD_NOT_READY` lengkap dengan sebab; tutup lalu tulis → `423`; hapus agenda wajib → `403`.

#### 2.5.3 Slice ADM-3 — Struktur & Kurikulum
- [ ] CRUD `organizations` (hierarki, tolak siklus) & `study_programs` (validasi plafon nasional BR-R2/R3/R4; `422 NATIONAL_CAP_TIGHTEN_ONLY`).
- [ ] CRUD `curricula`, `courses` (SKS pecah), `grade_scales` + `grade_scale_bands` (`422 BAND_OVERLAP`), `grade_components` (`422 WEIGHT_SUM_NOT_100`, AC-NIL-4).
- [ ] Tabel + migrasi `0008_curriculum_prereq_equivalency.sql`: `course_prerequisites` (anti self/siklus) & `course_equivalencies`.
- [ ] Kamus `reference_kinds`/`reference_items` + layar "Data Referensi" bertab (menggantikan ±30 layar master Sevima).
- [ ] UI + test: prodi tanpa fakultas induk; matakuliah duplikat kode per kurikulum; prasyarat melingkar ditolak.

#### 2.5.4 Slice ADM-4 — Ruang
- [ ] CRUD `rooms` (+ `capacity > 0`, `roomType`, fasilitas, nonaktif-soft) + `GET /admin/ruang/:id/utilisasi` pratinjau bentrok.
- [ ] Test: hapus ruang yang dipakai jadwal → `409 REFERENCE_IN_USE`.

#### 2.5.5 Slice ADM-5 — Kelas, Pengampu, Jadwal, Pertemuan
- [ ] `POST /admin/kelas/generate` (idempoten, nama A/B/C, hormati `maxParallelClasses`) + salin kelas antar periode.
- [ ] Penugasan dosen + `422 LECTURER_WORKLOAD_EXCEEDED` (BR-A11, maks 16 SKS) memakai `schedule-conflict-detector` yang sudah teruji.
- [ ] Jadwal mingguan + matriks hari×jam + `POST /admin/jadwal/validate` (AC-JDW-1, hard block).
- [ ] `POST /admin/pertemuan/generate` melewati hari libur dari kalender; `PATCH` sesi tunggal.
- [ ] Integrasi live: generate 12 kelas × 16 pertemuan = 192 sesi, jalankan ulang → `created:0, skipped:192`.

#### 2.5.6 Slice ADM-6 — Pengaturan Akademik (objek paling menentukan di multi-tenant)
- [ ] Tabel `academic_rules` + `blockades` + `enrollment_schemes` + `tenant_settings` (migrasi `0009_…`, `0010_…`).
- [ ] Skema `params` jsonb berversi + validasi Zod (plafon nasional tak terlampaui — NFR-R2 uji properti) + simpan sebagai versi baru (bukan `UPDATE` in-place).
- [ ] Wizard 4 langkah + diff + pratinjau dampak (menggantikan 9 tab switch Sevima).
- [ ] Gerbang ditegakkan di service (bukan UI): jendela KRS, `min_attendance_pct_for_exam` (BR-A15), cekal 4 dimensi (FR-AKA-10/AC-CEK-1), `late_krs_mode`, kuesioner pra-KHS (BR-A8).
- [ ] `tenant_settings.nim_format` untuk pencetakan/pembangkitan NIM; `document_numbering` (dipakai FR-DOC-02 nanti).

#### 2.5.7 Slice ADM-7 — Personel
- [ ] CRUD `students` + biodata feeder + `student_addresses` + `student_guardians` (layar bertab; masking PII per izin).
- [ ] CRUD `lecturers`/`staff` (NIDN/NUPTK unik per tenant; `Dosen Non-NIDN` didukung, padanan Sevima).
- [ ] `student_status_history` + `POST /admin/status-mahasiswa/change|bulk` (alasan wajib + approval + empat-mata).
- [ ] Pasang dosen-wali per angkatan/prodi (syarat loop approval KRS yang kini masih mock).
- [ ] Ekspor/impor tunggal + `Login As` berjustifikasi (FR-ADM-13) **dengan** audit.

#### 2.5.8 Slice ADM-8 — Pengguna & Hak Akses
- [ ] Migrasi `0011_rbac_scoped.sql`: `permissions` (+`resource`, `verb permission_verb`), `roles`, `role_permissions`, `user_role_assignments` (scope prodi/periode/kelas/org), `access_change_requests`.
- [ ] Matriks izin `resource × verb` (6 aksi) + penugasan ber-scope + riwayat izin (FR-IDT-04).
- [ ] Ganti pemindaian enum 5 nilai di `apps/web/src/lib/*` dengan resolver izin (satu titik).
- [ ] Viewer `audit_logs` + filter aktor/entitas/periode (read-only mutlak, AC-AUD-1).

#### 2.5.9 Slice ADM-9 — Impor massal & Kesehatan Data
- [ ] `POST /admin/impor/validate|commit` + `GET /admin/impor/:id` (templat per objek, batch 500 baris/transaksi, tanpa state setengah-jadi — NFR-U1).
- [ ] Panel **Kesehatan Data** (FR-ADM-10): NIM duplikat, dosen tanpa NIDN, prodi tanpa akreditasi/masa akreditasi habis (BR-R7), matakuliah tanpa kurikulum, kelas tanpa jadwal/jam, mahasiswa tanpa dosen-wali, komposisi bobot ≠ 100%.
- [ ] Gerbang status tenant `LIVE` tidak boleh aktif sebelum panel bersih (PRD J1, metrik ≤ 14 hari kerja).

#### 2.5.10 Definition of Done per slice (berulang, wajib)
- [ ] Kontrak Zod di `packages/contracts` + OpenAPI ter-generate (AGENTS §3.3).
- [ ] RLS: `tenant_id` + ENABLE/FORCE + policy + **uji 2-tenant silang ditolak** (NFR-S1).
- [ ] `tsc` 0 error · `lint --max-warnings 0` · `vitest` hijau (unit + integrasi Supabase live, self-cleaning).
- [ ] Audit event tercatat untuk tiap tulis; idempotensi terbukti untuk aksi massal.
- [ ] UI Velzon (UI_UX §2.0 & §9) terverifikasi di browser; i18n `id`+`en` bentuk identik.
- [ ] ROADMAP (file ini) + [PROGRESS_REPORT.md](file:///c:/SICA/docs/PROGRESS_REPORT.md) diperbarui pada commit yang sama.

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
> Status lingkungan dev: **`pnpm install` ✅; `apps/web` `tsc` 0 error; `vitest` 76/76 lulus; Supabase DB hidup — migrasi 0001→0005 diterapkan & RLS terverifikasi.** Keputusan stack dev user: **Supabase (Postgres, `ap-northeast-1`) + Vercel**.
- [x] Pulihkan toolchain build: jalankan `pnpm install` memakai pnpm bundled (`.tools/node`), `.tools/` & `*.tsbuildinfo` di-gitignore.
- [x] **Provision Supabase project** (Postgres). Ref `wngdmslvcmnjroyblolj`, region **`ap-northeast-1` (Tokyo)**. ⚠️ **Gotcha:** host direct `db.<ref>.supabase.co` **IPv6-only** → tak ter-resolve/dituju dari lingkungan IPv4 (dev lokal **dan** Vercel). WAJIB pakai **pooler IPv4**: *session* `aws-0-ap-northeast-1.pooler.supabase.com:5432` (migrasi DDL) & *transaction* `:6543?...&pgbouncer=true&pool_mode=transaction` (runtime serverless). **DB_USER pooler = `postgres.wngdmslvcmnjroyblolj`** (bukan `postgres`).
- [x] **Adaptasi migrasi untuk Supabase (RESOLVED & TERUJI DI DB NYATA):** `CREATE ROLE` non-superuser (Supabase `postgres`) gagal `insufficient_privilege` (42501), bukan `duplicate_object`. Solusi: blok role/grant di `0001` & `0004` kini `EXCEPTION WHEN others` (RAISE NOTICE skip) & policy `TO public` (konsisten dgn generator 0001). Runtime dev memakai role **pemilik tabel** dengan `FORCE ROW LEVEL SECURITY` + `set_config('app.current_tenant', …, true)`. Self-hosted (superuser) tetap membuat & grant `sica_app`. (MIGRATION_SOP §2.5)
- [x] Isi `apps/web/.env`: `DIRECT_DATABASE_URL` (session pooler) + `DATABASE_URL` (transaction pooler) sudah dipointing ke Supabase; `JWT_*` (RS256) + `PASSWORD_HASH_PEPPER` + `ATTENDANCE_HMAC_SECRET` terisi (dev). **Sisa:** `REDIS_URL` (Upstash) & storage/payment creds utk fitur non-core.
- [x] Jalankan migrasi 0001→0005 terhadap Supabase **SESUAI**; verifikasi: `modules`=19, `module_dependencies`=23, `tenant_isolation` policy=32, **`tenant_modules` tanpa `app.current_tenant` → 0 baris (RLS default-deny TERBUKTI)**. Temuan & perbaikan saat eksekusi: (a) `0002` memakai 5 enum yg tak pernah dibuat → ditambahkan bootstrap `CREATE TYPE` idempoten; (b) **`0003_people_biodata.sql` dibuat** (tabel lecturers/staff/addresses/guardians + kolom biodata `students` + RLS) — tadinya hilang (schema/DB drift); (c) **BUG FIX `client.ts`:** `SET LOCAL = $1` invalid (SET tak menerima bind param) → `set_config(..., true)`; `withTenantContext` kini jalan di PgBouncer transaction-mode.
- [ ] **Vercel:** `vercel link`, set Environment Variables (Production/Preview/Development) = env contract; pastikan `DATABASE_URL` pakai transaction pooler (serverless tidak boleh koneksi session langsung). Deploy preview → cek `/api/v1/health`.
- [~] **Login + siklus token DB-backed (AUD-03):** `authenticate` (users/memberships email|NIM → verify hash → persist `sessions`+`refresh_tokens` → JWT RS256), `rotateRefreshToken` (rotasi single-use + **reuse-detection family**), `revokeSession`/`revokeByRefreshToken` (logout) — **teruji e2e live Supabase** (login 12/12, lifecycle 8/8). RBAC per-tenant `tenant_memberships.role` (migrasi `0006`). **Sisa:** `argon2` native belum terpasang → `ScryptPasswordHasher` interim; tukar ke Argon2id + notifikasi user saat reuse-detection.
- [ ] (Opsional) Vercel Cron untuk job BullMQ/feeder, atau worker di luar Vercel (karena long-running) — selaraskan ADR-9/ADR-10.
