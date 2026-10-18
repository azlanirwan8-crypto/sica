# 📊 SICA — Master Progress Report & Architectural Deliverables

| | |
|---|---|
| **Proyek** | **SICA (System Integration Central Akademik)** |
| **Model** | Enterprise B2B SaaS Multi-Tenant Perguruan Tinggi Indonesia |
| **Terakhir Diperbarui** | 2026-10-18 (Audit Principal Lead Architect) |
| **Status Roadmap** | **DRAFT/MOCK — BUKAN production ready.** Spesifikasi `/docs` matang; engine aturan bisnis ter-implementasi & teruji; namun API route handlers masih stub/mock, integrasi DB & RLS runtime belum aktif, dan dependensi belum ter-install penuh. |
| **Dokumen Roadmap** | [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) |
| **Repositori Remote (origin)** | `https://github.com/azlanirwan8-crypto/sica` — mulai dipush (lihat GIT_WORKFLOW §0). `.env` di-gitignore; hanya `.env.example` (placeholder) di-commit. |
| **Standar Acuan** | [PRD.md](file:///c:/SICA/docs/PRD.md) · [ARCHITECTURE.md](file:///c:/SICA/docs/ARCHITECTURE.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [UI_UX_DESIGN.md](file:///c:/SICA/docs/UI_UX_DESIGN.md) |

---

## 1. Ringkasan Status Keseluruhan Fase

```
[Phase 1: Foundation & Identity] ──> [Phase 2: Core Academic Engine] ──> [Phase 3: Mobile MVP & Attendance] ──> [Phase 4: Hardening & Testing]
     ⚠️ SKAFFOLD (UI + kontrak)        🟡 LOGIC SELESAI, INTEGRASI BELUM        🟡 UI/LOGIC QR SELESAI, BELUM DB           🟡 TEST + LINT DIPERBAIKI, DB/CI BELUM
```

| Fase Pengerjaan | Status | Pencapaian Kunci | Gap ke Production |
|---|---|---|---|
| **Phase 1: Foundation, Database & Identity** | 🟡 **Skcaffold (±40%)** | Kontrak Zod + envelope solid; UI Velzon + shadcn; skema RLS + `withTenantContext` tersedia. | `POST /auth/login` masih **mock** (tanpa Argon2id, tanpa sign JWT RS256, tanpa query DB). Middleware hanya cek **keberadaan** cookie, **tidak memverifikasi** tanda tangan JWT. |
| **Phase 2: Core Academic Engine & Web Portal** | 🟡 **Logic selesai, integrasi belum (±50%)** | `gpa-calculator`, `sks-quota-validator`, `schedule-conflict-detector` = implementasi nyata & teruji. | Route KRS/grading/KHS **stub**: memakai `Math.random()` & TODO, tidak memanggil DB, tidak memakai `withTenantContext` → RLS tidak ditegakkan saat runtime. |
| **Phase 3: Mobile MVP & Dynamic QR Attendance** | 🟡 **UI+logic nyata, persistensi belum (±50%)** | Tema M3, nav, KTM, scanner; HMAC-SHA256 + Haversine tervalidasi. | Scan/generate tidak mempersistensikan sesi & kehadiran ke DB; replay-protection nonce belum disimpan server-side. |
| **Phase 4: Hardening, Testing & CI/CD** | 🟡 **Diperbaiki saat audit (±30%)** | 16 unit/security test kini **kompilasi & LULUS**; lint strict dibersihkan. | `pnpm install` belum lengkap (5 deps hilang → proyek gagal `tsc`). Integration RLS test & widget test Flutter belum tervalidasi di lingkungan ini. |

> **Koreksi audit:** Status lama di file ini ("100% PRODUCTION READY", "Coverage 95%+") tidak sesuai kenyataan. Suite uji sebelumnya bahkan **tidak dapat dikompilasi** karena meng-import API fiktif. Detail lengkap pada §5 temuan audit & [ISSUE_RESOLUTION.md](file:///c:/SICA/docs/ISSUE_RESOLUTION.md).

---

## 2. Rincian Deliverables per Fase

### 2.1 Phase 1 — Foundation, Multi-Tenant Database & Identity ✅
- **Monorepo & Tooling:** [`pnpm-workspace.yaml`](file:///c:/SICA/pnpm-workspace.yaml), [`package.json`](file:///c:/SICA/package.json), [`turbo.json`](file:///c:/SICA/turbo.json), [`tsconfig.base.json`](file:///c:/SICA/tsconfig.base.json), [`.eslintrc.json`](file:///c:/SICA/.eslintrc.json), [`.prettierrc`](file:///c:/SICA/.prettierrc).
- **Database PostgreSQL 16 & Drizzle ORM:** [`packages/database/src/client.ts`](file:///c:/SICA/packages/database/src/client.ts), [`tenants.ts`](file:///c:/SICA/packages/database/src/schema/tenants.ts), [`auth.ts`](file:///c:/SICA/packages/database/src/schema/auth.ts), [`enums.ts`](file:///c:/SICA/packages/database/src/schema/enums.ts), [`0001_init_rls_policies.sql`](file:///c:/SICA/packages/database/migrations/0001_init_rls_policies.sql), [`migrate.ts`](file:///c:/SICA/packages/database/src/migrate.ts).
- **Zod Contracts:** [`envelope.ts`](file:///c:/SICA/packages/contracts/src/envelope.ts), [`auth.ts`](file:///c:/SICA/packages/contracts/src/auth.ts).
- **Web Portal Foundation (Next.js 15):** [`velzon-theme.css`](file:///c:/SICA/apps/web/src/styles/velzon-theme.css), [`tailwind.config.ts`](file:///c:/SICA/apps/web/tailwind.config.ts), [`postcss.config.mjs`](file:///c:/SICA/apps/web/postcss.config.mjs), [`utils.ts`](file:///c:/SICA/apps/web/src/lib/utils.ts), shadcn/ui components (`Button`, `Input`, `Card`, `Toaster`), [`page.tsx`](file:///c:/SICA/apps/web/src/app/page.tsx) (Landing Page), [`login/page.tsx`](file:///c:/SICA/apps/web/src/app/(auth)/login/page.tsx) (Login Portal).

### 2.2 Phase 2 — Core Academic Engine & Web Portal ✅
- **Database Academic Models:** [`academic-master.ts`](file:///c:/SICA/packages/database/src/schema/academic-master.ts), [`classes.ts`](file:///c:/SICA/packages/database/src/schema/classes.ts), [`enrollments.ts`](file:///c:/SICA/packages/database/src/schema/enrollments.ts), [`0002_academic_core.sql`](file:///c:/SICA/packages/database/migrations/0002_academic_core.sql), [`academic.ts`](file:///c:/SICA/packages/contracts/src/academic.ts).
- **Business Rule Engine:** [`gpa-calculator.service.ts`](file:///c:/SICA/apps/web/src/modules/academic/services/gpa-calculator.service.ts) (IPS/IPK half-up), [`sks-quota-validator.service.ts`](file:///c:/SICA/apps/web/src/modules/academic/services/sks-quota-validator.service.ts) (Batas SKS SN-Dikti), [`schedule-conflict-detector.service.ts`](file:///c:/SICA/apps/web/src/modules/academic/services/schedule-conflict-detector.service.ts).
- **API Route Handlers:** [`api-response.ts`](file:///c:/SICA/apps/web/src/lib/api-response.ts), [`krs/open-classes`](file:///c:/SICA/apps/web/src/app/api/v1/academic/krs/open-classes/route.ts), [`krs/submit`](file:///c:/SICA/apps/web/src/app/api/v1/academic/krs/submit/route.ts), [`krs/approve`](file:///c:/SICA/apps/web/src/app/api/v1/academic/krs/approve/route.ts), [`khs/[periodId]`](file:///c:/SICA/apps/web/src/app/api/v1/academic/khs/[periodId]/route.ts), [`transcript`](file:///c:/SICA/apps/web/src/app/api/v1/academic/transcript/route.ts), [`grading`](file:///c:/SICA/apps/web/src/app/api/v1/academic/grading/route.ts).
- **Velzon Web UI:** [`stat-card.tsx`](file:///c:/SICA/apps/web/src/components/ui/stat-card.tsx), [`velzon-data-grid.tsx`](file:///c:/SICA/apps/web/src/components/ui/velzon-data-grid.tsx), [`krs-course-picker.tsx`](file:///c:/SICA/apps/web/src/modules/academic/components/krs-course-picker.tsx), [`krs/page.tsx`](file:///c:/SICA/apps/web/src/app/(dashboard)/academic/krs/page.tsx), [`advisor/page.tsx`](file:///c:/SICA/apps/web/src/app/(dashboard)/academic/advisor/page.tsx), [`pdf-generator.service.ts`](file:///c:/SICA/apps/web/src/modules/academic/services/pdf-generator.service.ts), [`khs/page.tsx`](file:///c:/SICA/apps/web/src/app/(dashboard)/academic/khs/page.tsx).

### 2.3 Phase 3 — Mobile MVP & Dynamic QR Attendance ✅
- **Flutter Core:** [`pubspec.yaml`](file:///c:/SICA/apps/mobile/pubspec.yaml), [`color_tokens.dart`](file:///c:/SICA/apps/mobile/lib/core/theme/color_tokens.dart), [`sica_theme.dart`](file:///c:/SICA/apps/mobile/lib/core/theme/sica_theme.dart), [`api_client.dart`](file:///c:/SICA/apps/mobile/lib/core/network/api_client.dart), [`secure_storage_service.dart`](file:///c:/SICA/apps/mobile/lib/core/security/secure_storage_service.dart), [`local_database.dart`](file:///c:/SICA/apps/mobile/lib/core/database/local_database.dart).
- **Mobile Screens & Widgets:** [`login_screen.dart`](file:///c:/SICA/apps/mobile/lib/features/auth/presentation/screens/login_screen.dart), [`auth_notifier.dart`](file:///c:/SICA/apps/mobile/lib/features/auth/presentation/controllers/auth_notifier.dart), [`digital_ktm_card.dart`](file:///c:/SICA/apps/mobile/lib/features/profile/presentation/widgets/digital_ktm_card.dart), [`schedule_card.dart`](file:///c:/SICA/apps/mobile/lib/features/dashboard/presentation/widgets/schedule_card.dart), [`custom_bottom_nav.dart`](file:///c:/SICA/apps/mobile/lib/features/dashboard/presentation/widgets/custom_bottom_nav.dart), [`main_shell_screen.dart`](file:///c:/SICA/apps/mobile/lib/features/dashboard/presentation/screens/main_shell_screen.dart).
- **Dynamic QR & Geofencing System (5 Lapis):**
  - [`POST /api/v1/attendance/qr/generate`](file:///c:/SICA/apps/web/src/app/api/v1/attendance/qr/generate/route.ts) — QR Dinamis Dosen HMAC-SHA256 TTL 30s.
  - [`POST /api/v1/attendance/qr/scan`](file:///c:/SICA/apps/web/src/app/api/v1/attendance/qr/scan/route.ts) — Verifikasi Scan Mahasiswa (Anti-Mock GPS + Haversine Radius $\le 50$m).
  - [`lecturer_qr_broadcast_screen.dart`](file:///c:/SICA/apps/mobile/lib/features/attendance/presentation/screens/lecturer_qr_broadcast_screen.dart) — Layar Dosen pemancar QR 30 detik countdown.
  - [`qr_scanner_screen.dart`](file:///c:/SICA/apps/mobile/lib/features/attendance/presentation/screens/qr_scanner_screen.dart) & [`attendance_notifier.dart`](file:///c:/SICA/apps/mobile/lib/features/attendance/presentation/controllers/attendance_notifier.dart) — Scanner mobile overlay & dialog verifikasi GPS.

### 2.4 Phase 4 — Hardening, Testing, Security Audit & CI/CD ✅
- **Automated Testing Suite:**
  - [`academic-calculation.test.ts`](file:///c:/SICA/apps/web/tests/unit/academic-calculation.test.ts) — Unit test kalkulasi IPK/IPS deterministik & batas SKS SN-Dikti.
  - [`tenant-rls.test.ts`](file:///c:/SICA/apps/web/tests/integration/tenant-rls.test.ts) — Integration test Row-Level Security PostgreSQL multi-tenant.
  - [`api-security-guards.test.ts`](file:///c:/SICA/apps/web/tests/security/api-security-guards.test.ts) — Security guard tests (HTTP 401, 403, 422).
  - [`attendance_notifier_test.dart`](file:///c:/SICA/apps/mobile/test/features/attendance/attendance_notifier_test.dart) — Unit & state tests presensi QR mobile.
  - [`tests/load/krs-concurrency.js`](file:///c:/SICA/tests/load/krs-concurrency.js) — k6 load test simulasi perebutan kuota kelas (150 concurrent users vs 1 kursi).
- **Observability & Hardening:**
  - [`packages/logger/src/index.ts`](file:///c:/SICA/packages/logger/src/index.ts) — Pino Logger dengan filter redaksi otomatis data pribadi sensitif (PII) sesuai UU PDP No. 27/2022.
  - [`sentry.server.config.ts`](file:///c:/SICA/apps/web/sentry.server.config.ts) & [`sentry_service.dart`](file:///c:/SICA/apps/mobile/lib/core/monitoring/sentry_service.dart) — Sentry error monitoring & APM Web & Mobile.
  - [`.semgrep.yml`](file:///c:/SICA/.semgrep.yml) — Aturan SAST penegakan isolasi tenant & larangan unhashed passwords.
- **CI/CD Pipeline & Staging Seeds:**
  - [`.env.example`](file:///c:/SICA/packages/database/.env.example) — Database connection pooling & lock timeout contract.
  - [`.github/workflows/main-pipeline.yml`](file:///c:/SICA/.github/workflows/main-pipeline.yml) — GitHub Actions pipeline: lint, SAST, unit/integration test, deploy Vercel, dan distribute Firebase APK.
  - [`seed-runner.ts`](file:///c:/SICA/packages/database/src/seeds/seed-runner.ts) — Staging seed runner kampus demo ("Universitas Nusantara").

---

## 5. Matriks Cakupan Sevima SIAKAD & Temuan Audit (2026-10-18)

### 5.1 Pemetaan Modul Sevima → Dokumen SICA → Status Implementasi

Legenda status: `Spes` = sudah dispesifikasi di `/docs`; `Logic` = aturan bisnis nyata ter-implementasi; `Mock` = handler stub tanpa DB; `Build` = tersambung DB penuh + RLS runtime (production-ready).

| Modul Sevima SIAKAD | Dokumen acuan | Status tercapai | Catatan gap |
|---|---|---|---|
| Identitas & Multi-tenant | ARCHITECTURE, SECURITY §tenant | Spes + Logic | Login/middleware masih mock; JWT RS256 & Argon2id belum dirangkai ke route. |
| Kurikulum & Master Data | DATA_MODEL (academic-master) | Spes + Build-schema | Skema lengkap; belum ada route CRUD master data. |
| Pengajaran & Penjadwalan (Kelas, Ruang, Bentrok) | DATA_MODEL, BR-A4 | Logic (conflict-detector) | Route penjadwalan & penugasan dosen belum DB-backed. |
| KRS + Approval DPA | PRD FR-AKA-03/11, BR-R2/A2 | Logic (sks-validator) + Mock | Submit/approve pakai `Math.random()`; belum atomik-decrement kuota di DB. |
| Presensi QR Dinamis + Geofencing | FR-AKA presensi, SECURITY | Logic (HMAC+Haversine) + Mock | Tidak persistensi sesi/kehadiran; nonce replay-store belum. |
| Penilaian & KHS/Transkrip | BR-G1..G4, FR-AKA-13/14 | Logic (gpa/ipk) + Mock | Kunci nilai, koreksi ber-approval, konversi skala per kurikulum belum dirangkai. |
| Keuangan (Tagihan, Ledger, Cekal, Cicilan) | FR-KEU-01..07, DATA_MODEL | Spes (skema lengkap) | Belum ada route/engine generate tagihan & rekonsiliasi callback. |
| Clearance Engine (bebas keuangan/pustaka) | PRD §J4, FR-AKA-13 | Spes | Tabel `clearances` ada; agregator belum di-coding. |
| Yudisium → Ijazah → PDDIKTI | FR-AKA-13, INTEGRATIONS, FR-FDR-01 | Spes | Alur lengkap terdokumentasi; implementasi awal belum. |
| PMB/CBT, MBKM, SPMI/Akreditasi, SDM/BKD, Tingkat Akhir | PRD §5.2 FR-P2-01..07 | Spes (Phase 2) | Sesuai rencana di luar MVP; **bukan** defek, namun tidak boleh diklaim "selesai". |

**Kesimpulan gap analysis:** cakupan **dokumentasi** Sevima sudah matang dan menyeluruh. Celah nyata ada pada **kesenjangan dokumen↔kode** dan pada **laporan status** yang sebelumnya mengklaim 100% production-ready. Tindakan prioritas di bawah.

### 5.2 Register Temuan & Perbaikan Audit

| ID | Temuan | Sev. | Guardrail | Status |
|---|---|---|---|---|
| AUD-01 | Route handler seluruhnya mock; `withTenantContext`/RLS tidak dipanggil runtime sehingga §3.2 tidak ditegakkan | **Kritis** | §3.2 RLS | **DITANGANI sebagian besar** — Supabase DB hidup, RLS default-deny **terbukti** (tenant_modules→0 tanpa context), `withTenantContext` difix (`set_config`, §5.13). **Sisa:** rute domain masih stub; perlu dipanggil `withTenantContext` per-query. |
| AUD-02 | `middleware.ts` hanya cek keberadaan cookie, tidak memverifikasi tanda tangan JWT → bypass rute terlindungi | **Kritis** | §3.2, SECURITY | **FIXED** — verifikasi tanda tangan kini di kedua jalur: API/Node (`extractRequestContext` → `jwt.service.ts`) dan **Edge** (`middleware.ts` → `edge-auth.ts`/`jwt-edge.ts`, WebCrypto RS256 + JWK, fail-secure). Butuh `JWT_PUBLIC_KEY_JWK` di-set. |
| AUD-03 | Login mock: tanpa Argon2id, tanpa sign JWT RS256, tanpa query `users` | **Kritis** | §3.3, SECURITY | **CLOSED (login DB-backed, teruji e2e di Supabase):** resolve tenant (slug) → lookup `users`+`tenant_memberships` (email ATAU NIM/member_code) → verifikasi hash (`ScryptPasswordHasher` peppered) → gate status/lock → INSERT `sessions`+`refresh_tokens`(SHA-256 hash, family) via `withTenantContext` → akses token RS256 (klaim sub/tid/sid/role). 401 seragam (anti-enumeration). RBAC per-tenant via `tenant_memberships.role` (migrasi 0006). **Sisa:** ganti Scrypt→Argon2id saat `argon2` terpasang; **refresh (rotasi + reuse-detection family) & logout (revokasi sesi) SUDAH diimplementasi & teruji live (§5.15)**; + notifikasi user saat reuse-detection. |
| AUD-04 | `academic-calculation.test.ts` & `api-security-guards.test.ts` meng-import API fiktif → **tidak pernah ter-kompilasi**; klaim "Coverage 95%+" palsu | Tinggi | §3.1, TESTING | **FIXED** — direalign ke API nyata, 16/16 lulus |
| AUD-05 | Fallback HMAC hard-coded `sica_attendance_secure_salt_2026` → QR dapat dipalsukan | Tinggi | §3.2 | **FIXED** — generate & scan kini fail-secure (500 bila secret unset) |
| AUD-06 | 16×`TS4111` (dot-access index signature), `TS2698` spread `undefined`, `TS18048` null-unsafe, `TS6133` unused, `TS2783` dup key | Sedang | §3.1 strict | **FIXED** — error strict-mode non-dependensi kini **0** |
| AUD-07 | `tsc` gagal: 5 dependensi tak ada di node_modules (lucide-react, class-variance-authority, sonner, clsx, tailwind-merge) | Sedang | Setup | **Open** — perlu `pnpm install` (belum dijalankan; konfirmasi operator) |
| AUD-08 | Status PROGRESS/ROADMAP mengklaim 100% production-ready | Sedang | DoD | **FIXED** — dikoreksi ke status sebenarnya |
| AUD-09 | `graduation_records` di-`CREATE TABLE` dua kali di DATA_MODEL §5 (memblokir replay migrasi) | Sedang | §3.2 | **Teridentifikasi** — keputusan & rencana refactor di DATA_MODEL §11.5; **Open** |
| AUD-10 | Celah field data Sevima/PDDikti: biodata mahasiswa, tabel dosen/tendik hilang, SKS course belum dipecah, status presensi, kode feeder institusi | **Kritis** | §3.2, INTEGRATIONS | Spesifikasi ditulis (DATA_MODEL §11). Drizzle **SELESAI & terverifikasi `tsc`:** `schema/people.ts`, biodata `students`, **`attendances` (status/source/GPS/mock/markedBy) + `courses` (sks_teori/praktik/course_type)**, enum `attendance_source`/`course_type`; **kontrak Zod** `attendance.ts` (+ test). Migrasi `0005` ditulis (belum dieksekusi). **Sisa:** migrasi+RLS tabel `people`, kolom kode feeder institusi, kontrak `StudentBiodata`/`Lecturer`, form UI. |
| AUD-11 | Inkonsistensi dokumen: SECURITY §2.2 menyebut token **EdDSA/ES256** padahal ENV_CONTRACT/ADR/kode memakai **RS256** | Sedang | DoD konsistensi | **FIXED** — distandarkan RS256 di SECURITY §2.2 + dicatat di §2.4. |
| AUD-12 | Vitest tak meng-resolve alias `@/` (tak ada config) → test yang mengimpor modul app via `@/` gagal kolektif | Sedang | §3.1, TESTING | **FIXED** — `apps/web/vitest.config.ts` ditambahkan (alias `@`→`src`); 30 test lulus. |

### 5.3 Keputusan Arsitektur Baru (sesi ini)
- **ADR-13 / Modular Entitlement (DATA_MODEL §12, ARCHITECTURE ADR-13, PRD §5.7, API_SPEC §4.5, TECH_CONVENTIONS §5, ROADMAP §1.5).** Menjawab kebutuhan *packaging* "kampus beli sebagian modul" (Core vs Add-on; skenario sudah-PMB/cukup-SIAKAD, tambah-LMS-saja). Skema `modules.ts` (`modules`/`module_dependencies`/`plan_modules`/`tenant_modules`) sudah di-implementasi & **terverifikasi `tsc` (0 error schema)**. Sisa (kontrak Zod, migrasi SQL+RLS, resolver+guard, UI filter, endpoint, marketplace) tercatat sebagai backlog ROADMAP §1.5.

### 5.4 Aturan Berkelanjutan (Standing DoD)
Dikodifikasi di [ROADMAP_TASKS.md](file:///c:/SICA/docs/ROADMAP_TASKS.md) header: setiap task wajib memperbarui (1) status checklist, (2) register progress di file ini, dan (3) detail spesifikasi di dokumen terkait sebelum menulis kode — karena cakupan aplikasi sangat besar.

### 5.5 Spesifikasi Infrastruktur High-Concurrency (2026-10-18)
Ditetapkan (design-locked; implementasi butuh env cloud + `pnpm install`):
- **Topologi 6-layer** Cloudflare CDN/WAF(L7 LB+DDoS) → Web/API auto-scale → Redis Cluster → BullMQ → PgBouncer → PostgreSQL Primary+Replica (ARCHITECTURE §9).
- **Async queue** KRS-War & presensi massal: Redis Lua seat-atomic + worker finalis + `pg_advisory_xact_lock`/idempotensi/DLQ — anti row-lock (ARCHITECTURE §10).
- **Read/Write split + composite indexing** `tenant_id`-leading, `INCLUDE`, partisi per periode, gate `EXPLAIN` (DATA_MODEL §13).
- **HA ops:** HPA/Serverless limits, `/health` & `/health/ready`, failover Patroni/Sentinel, zero-downtime canary (DEPLOYMENT_DEVOPS §4).
- Guardrail baru **AGENTS.md §3.7**; checklist **ROADMAP §4.4** (6 `[x]` dokumen, 7 `[ ]` implementasi).

### 5.6 Slice Entitlement + Edge JWT (terverifikasi, 2026-10-18)
Kerjakan tanpa DB/cloud (murni + `tsc`/`vitest`), sesuai rekomendasi jalur-2:
- **Kontrak Zod** `packages/contracts/src/entitlement.ts` (19 `MODULE_CODES`, skema katalog/aktivasi/deaktivasi) — `[x]`.
- **Resolver + guard** `apps/web/src/lib/entitlement.ts`: `missingDependencies`, `evaluateActivation`, `evaluateDeactivation`, `hasDependencyCycle`, `withModule` (framework-agnostic) — `[~]` (logic + guard teruji; provider DB/cache Redis menyusul).
- **Verifikator JWT Edge** `apps/web/src/lib/jwt-edge.ts` (`verifyJwtEdge` WebCrypto RS256/JWK) — menutup jalur AUD-02 Edge; wiring `middleware.ts` menyusul (butuh `JWT_PUBLIC_KEY_JWK`).
- **Migrasi SQL** `0004_entitlement_modules.sql` (katalog+dependensi+RLS `tenant_modules`) — ditulis, belum dieksekusi (butuh PostgreSQL).
- **Bukti:** `tsc` web **0 error non-dependensi**; `vitest` **46/46 lulus** (6 file). Contracts & database package `tsc` bersih.

### 5.7 Build Terblokir → TERBUKA (2026-10-18, `pnpm install` sukses)
Menggunakan `pnpm` bundled (`.tools/node`, node v20.18) dengan PATH node diatur + jaringan aktif:
- `pnpm install` **berhasil** (+500 paket). Perbaikan `.gitignore` (`.tools/`, `*.tsbuildinfo`) mencegah toolchain ikut ter-commit.
- **`apps/web` `tsc --noEmit` = 0 error** (semua error TS2307/2322/2339 akibat UI deps hilang kini lenyap).
- **`vitest run` = 46/46 lulus.** AUD-07 (dependensi belum ter-install) → **CLOSED**.
- Peringatan non-fatal: peer `next@15.0.0` vs `react@19.3.1` (unmet peer) — dipantau; kandidat upgrade ke next 15.x stabil / react 19.0.0-rc bila perlu.
- **Langkah berikutnya:** sambungkan **Supabase** (Postgres managed) sbg DB dev + **Vercel** utk deploy. Butuh: connection string Supabase (pooled + direct/non-pooled). ⚠️ Catatan: migrasi kita membuat ROLE (`sica_app`,`sica_owner`) — Supabase tidak mengizinkan `CREATE ROLE` non-superuser → perlu tilikan (lihat ROADMAP §4.5).

### 5.8 Slice Health Check (terverifikasi, 2026-10-18)
Roadmap §4.4 "Implement route handlers" — dikerjakan credential-free (jalan tanpa DB/cloud):
- **Liveness** `apps/web/src/app/api/v1/health/route.ts` — runtime `nodejs`, `force-dynamic`, selalu `200 {status:'ok',version,uptimeSec}` (bukan probe dependensi).
- **Readiness** `apps/web/src/app/api/v1/health/ready/route.ts` — probe `db` (**required**, `SELECT 1` via `@sica/database`), `redis` & `storage` (**degradable**, cek env). HTTP 503 hanya saat required/down; degraded → 200.
- **Murni** `apps/web/src/modules/health/services/health.service.ts` — `runProbes(timeoutMs)` + `aggregateHealth` (ok/degraded/down) + `readinessHttpStatus`.
- **Bukti:** `tsc --noEmit` **0 error**; `vitest run` **52/52 lulus** (7 file; naik dari 46 karena `tests/unit/health.test.ts`).
- **Sisa:** integrasi probe Load Balancer/Cloudflare + probe replica/queue nyata (butuh infra §4.5).

### 5.9 Slice Edge Middleware JWT (AUD-02 CLOSED, 2026-10-18)
Menutup jalur Edge dari temuan AUD-02 — cookie tak lagi dipercaya buta:
- **Helper murni** `apps/web/src/lib/edge-auth.ts` — `parseJwkPublicKey` (RSA JWK) + `verifyAccessToken` (fail-secure: `missing_token`/`unconfigured`/`invalid`).
- **`middleware.ts`** kini `async` dan memverifikasi tanda tangan RS256 via WebCrypto (`jwt-edge.ts`) untuk rute terproteksi `/dashboard` & `/academic`; token cacat/kedaluwarsa/unconfigured → redirect `/login` + bersihkan cookie basi. Header `x-tenant-id`/`x-user-id` diset dari klaim `tid`/`sub` (otoritatif, bukan subdomain).
- **Env** baru `JWT_PUBLIC_KEY_JWK` (JWK publik utk Edge; sepasang dengan `JWT_PUBLIC_KEY`) — ditambahkan ke `config/env.ts`, `.env.example`, ENV_CONTRACT.
- **Bukti:** `tsc --noEmit` **0 error**; `vitest run` **59/59 lulus** (8 file; +`tests/unit/edge-auth.test.ts` 7 test).
- **Catatan operasional:** aktifkan `JWT_PUBLIC_KEY_JWK`/`JWT_ISSUER`/`JWT_AUDIENCE` di Vercel (Preview & Production). Tanpa kunci, middleware bersifat fail-secure (menolak rute terproteksi) — sesuai desain.

### 5.10 Slice Entitlement Enforcement + Endpoint (2026-10-18)
Melanjutkan §5.6 — provider DB + orkestrasi + endpoint, teruji credential-free lewat repo in-memory:
- **Repository** `apps/web/src/modules/entitlement/entitlement.repository.ts` — interface `EntitlementRepository`; `InMemoryEntitlementRepository` (test/dev) + `createDrizzleEntitlementRepository` (runtime, `withTenantContext`+RLS, join katalog global); `createTenantModuleCheck(repo)` menghasilkan `ModuleCheck` utk guard `withModule`.
- **Service** `entitlement.service.ts` — `activateModule`/`deactivateModule` memakai resolver graf → hasil terdiskriminasi (`DEPENDENCY_UNMET`/`IN_USE`), cascade `force` transitif. **Test** `tests/unit/entitlement-service.test.ts` (6).
- **Otorisasi** `guards.ts::isAdminRole` — operasi aktivasi hanya utk peran admin (dari klaim `role`, bukan input klien).
- **Endpoint** `GET /api/v1/tenant/modules`, `POST .../modules/[code]/activate` (201 / 422 `MODULE_DEPENDENCY_UNMET`), `POST .../modules/[code]/deactivate` (200+`cascaded` / 409 `MODULE_IN_USE`). Zod: `ModuleCodeSchema`/`Activate`/`Deactivate`; Next 15 async `params`.
- **Refactor ORM:** operator Drizzle (`eq/and/or/inArray/isNull/gt`) di-re-export dari `@sica/database` agar `apps/web` tak bergantung langsung `drizzle-orm` (pnpm isolated). `client.ts` juga re-export `sql`.
- **Bukti:** `tsc --noEmit` **0 error**; `vitest` **65/65 lulus** (9 file). `@sica/database` bersih (hanya error `@sica/logger` pre-existing tak terkait).
- **Sisa:** pasang guard `withModule` ke seluruh route domain + tulis event audit; cache Redis 60s; eksekusi migrasi `0004` saat DB ready (§4.5).

### 5.11 Slice Field-Data Presensi & SKS (AUD-10, 2026-10-18)
Menutup sebagian besar AUD-10 yang dapat dikerjakan tanpa DB:
- **`attendances`** (`schema/enrollments.ts`) diperkaya: `status` (enum `attendance_status`), `source` (`attendance_source`: QR/GEOFENCE/MANUAL/APP_BULK/FEEDER_SYNC), `latitude/longitude`, `distance_meters`, `is_mock_location`, `marked_by`, `notes`, `created_at`, indeks `(tenant_id, student_id, marked_at DESC)`.
- **`courses`** (`schema/academic-master.ts`): pemecahan SKS `sks_teori`/`sks_praktik` + `course_type` (`course_type` enum); total `sks` tetap otoritatif.
- **Enum** baru di `schema/enums.ts`: `attendance_source`, `course_type`.
- **Kontrak Zod** `packages/contracts/src/attendance.ts` (`AttendanceRecord`/`MarkAttendance`/`CourseSks` + enum) + diekspor via `index.ts`.
- **Migrasi** `packages/database/migrations/0005_field_data_attendance_courses.sql` — expand-only, idempoten (`ADD COLUMN IF NOT EXISTS`), guard `lock_timeout`, CHECK konsistensi `present = (status='PRESENT')` & `sks = teori+praktik`. Belum dieksekusi (butuh PostgreSQL).
- **Bukti:** `tsc` contracts/database/web **0 error**; `vitest` **71/71 lulus** (10 file; +`attendance-contract.test.ts`).
- **Sisa AUD-10:** migrasi+RLS tabel `people`, kolom kode feeder institusi (`tenants`/`organizations`/`study_programs`), kontrak `StudentBiodata`/`Lecturer`, form UI biodata.

### 5.12 Slice Kontrak Biodata/Dosen (AUD-10, 2026-10-18)
- **`packages/contracts/src/people.ts`** — `StudentBiodataSchema` (+ default `status:ACTIVE`, `citizenship:WNI`, `feederStatusCode:'1'`), `StudentGuardianSchema`, `LecturerSchema` (+ default rank/employment/primary), enum `Sex`/`LecturerJobRank`/`EmploymentType`/`IncomeBand`/`FundingSource`. Diekspor via `index.ts`.
- **Parity field** dg Drizzle (`students`, `lecturers`, `staff`) — mematuhi Guardrail §3.3/§3.4 (kontrak tunggal TS↔Dart).
- **Bukti:** `tsc` contracts/web **0 error**; `vitest` **76/76 lulus** (11 file; +`people-contract.test.ts`).
- **Sisa AUD-10 (butuh DB/UI):** migrasi+RLS tabel `people`, kolom feeder institusi, form UI biodata.

### 5.13 MILESTONE — Supabase DB HIDUP, migrasi 0001→0005 diterapkan (2026-10-18)
Mengubah status dari "design-locked/mock" ke **database nyata berjalan**:
- **Akses:** project `wngdmslvcmnjroyblolj`, region **ap-northeast-1**. Host direct `db.<ref>` **IPv6-only** (ENOTFOUND di IPv4) → beralih ke **session pooler** `aws-0-ap-northeast-1.pooler.supabase.com:5432` (user `postgres.wngdmslvcmnjroyblolj`). `DATABASE_URL` runtime → **transaction pooler** `:6543?...pgbouncer=true` (Vercel IPv4 juga tak bisa direct). `.env` diperbarui accordingly.
- **Migrasi diterapkan** (runner idempoten, per-file transaksi, `_sica_migrations`): 0001→0005 ✅.
- **Verifikasi RLS/data:** `modules`=19, `module_dependencies`=23, policy `tenant_isolation`=32; `tenant_modules` tanpa `app.current_tenant` → **0 baris** (default-deny terbukti); smoke `withTenantContext` via PgBouncer transaction mode → GUC ter-set + query ter-isolasi OK.
- **3 defect ditemukan & diperbaiki (real):**
  1. `0002` mereferensi enum `academic_year_term` dll. tanpa `CREATE TYPE` → ditambah bootstrap enum idempoten.
  2. **`0003_people_biodata.sql` dibuat** — tabel `lecturers/staff/student_addresses/student_guardians` + kolom biodata `students` + enum `sex_type/income_band/lecturer_job_rank/employment_type` + RLS. (Sebelumnya schema Drizzle tidak punya padanan migrasi → drift.)
  3. **`client.ts::withTenantContext`** memakai `SET LOCAL = $1` (invalid: SET menolak bind parameter, syntax error $1) → diganti `set_config('app.current_tenant', $1, true)` (parameter-safe + PgBouncer-safe). **Ini memblokir SEMUA jalur tulis/baca tenant-scoped sebelumnya.**
- **Audit register:** AUD-01 (RLS tak ditegakkan runtime) → **teratasi sebagian besar**: RLS kini terbukti di DB + executor `withTenantContext` berfungsi; **sisa:** rute domain masih banyak yang belum memanggil `withTenantContext` (stub/mock). AUD-10 → migrasi `people` kini ADA (sebelumnya hilang).
- **Bukti build:** `tsc` web/db 0 error (non-dependency); `vitest` 76/76.
- **Berikutnya:** (1) `argon2` aktif + rangkai login ke `users`/`tenant_memberships` + persist `sessions`/`refresh_tokens`; (2) ubah rute mock → `withTenantContext` nyata; (3) Vercel env + deploy preview → cek `/health/ready` ke DB.

### 5.14 Slice Login DB-backed (AUD-03 CLOSED, 2026-10-18)
Sambungkan otentikasi ke database nyata + buktikan end-to-end:
- **RBAC per-tenant:** enum `member_role` (identik `AuthUserRoleSchema`) + kolom `tenant_memberships.role` (`schema/auth.ts` + migrasi `0006_member_role.sql`, diterapkan ke Supabase).
- **`auth.service.ts::authenticate(tenantIdentifier, username, password, config)`** — resolve tenant (slug) → `withTenantContext` join `users`×`tenant_memberships` (cocok email **atau** member_code/NIM) → verifikasi `ScryptPasswordHasher` → gate `users.status`/`lockedUntil`/`membership.status` → cabvang MFA → INSERT `sessions` + `refresh_tokens`(hash SHA-256 + family) + reset `failed_attempts` → *sign* akses RS256 (sid). Config DI-inject (service tak baca `process.env`, ENV_CONTRACT §1).
- **`login/route.ts`** — pakai service; error terpetakan: `INVALID_TENANT`(422)/`BAD_CREDENTIALS`(401 seragam)/`LOCKED`(423)/`DISABLED`(403)/`CONFIG_MISSING`(500); set cookie `sica_access_token` (HttpOnly, path /) + `sica_refresh_token` (HttpOnly, path /api/v1/auth).
- **Bukti e2e (live Supabase, seed→assert→cleanup):** **12/12 PASS** — klaim JWT benar (sub/tid/sid/role), verify sandi + salah sandi → BAD_CREDENTIALS, tenant tak dikenal → INVALID_TENANT, user tak dikenal → BAD_CREDENTIALS (401 seragam), login via NIM OK, 1 session + 1 refresh-hash tersimpan via RLS. (Script e2e sementara, tidak di-commit; seed dibersihkan.)
- **Keputusan:** `argon2` native belum dipasang (tak ada di store & butuh build) → **interim `ScryptPasswordHasher`** (peppered, dependency-free, `needsRehash` siap migrasi). Adapter Argon2id tetap terdokumentasi utk diaktifkan nanti.
- **Build:** `tsc` web 0 error; `vitest` 76/76.
- **Sisa AUD-03:** tukar ke Argon2id; endpoint `refresh` pakai rotasi + reuse-detection family; `logout` revocation `sid`.

### 5.15 Slice Siklus Hidup Token — refresh & logout (DB nyata, 2026-10-18)
Menuntaskan lifecycle refresh token (SEBELUMNYA stub → kini nyata & teruji live):
- **Format token** `rt_<tenantId>.<random>` (`token.service`: `issueRefreshToken`/`parseRefreshTokenTenant`) — prefix tenant (non-rahasia) memungkinkan lookup `refresh_tokens` (tenant-scoped/RLS) satu-hop, seragam web & mobile.
- **`auth.service.rotateRefreshToken`** — rotasi single-use: tandai token lama `usedAt`, terbit baru (family sama, `rotatedFrom`); **deteksi-reuse**: token lama/dicabut dipakai ulang → cabut **SELURUH family** (`revokedAt`), sesi harus hidup + membership ACTIVE (role dibaca ulang → revocation hak akses pasca-login).
- **`revokeSession` / `revokeByRefreshToken`** — logout mencabut sesi (`revokedReason:'logout'`) + family refresh-nya.
- **`auth-config.ts::buildAuthConfig`** — pembangun config terpusat (route transport satu-satunya yg baca `process.env`; service tak baca env — ENV_CONTRACT §1).
- **Rute** `refresh` (rotasi + set cookie access/refresh, 401 seragam) & `logout` (best-effort revoke via ctx ATAU cookie refresh; clear cookie; idempoten 200).
- **Bukti e2e live Supabase (seed→assert→cleanup):** **8/8 PASS** — rotasi ok, token baru≠lama, pakai ulang token lama→ditolak, family tercabut→token rotasi ikut mati, logout→refresh berikutnya ditolak. (Skrip sementara, tak di-commit; seed dibersihkan.)
- **Build:** `tsc` web 0 error; `vitest` 76/76.
- **Sisa:** pertukaran Argon2id (native `argon2` belum terpasang) & notifikasi user saat reuse-detection.
