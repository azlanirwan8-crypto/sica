# AGENTS.md — Panduan Utama AI Agent untuk Repositori SICA

| | |
|---|---|
| **Versi** | 1.0 |
| **Cakupan** | Semua AI Agent: Cursor, Windsurf, Claude Code, GitHub Copilot, ChatGPT, dan lainnya |
| **Bahasa Dokumen** | Indonesia (kode & database tetap Inggris) |

---

## 1. Pendahuluan

File ini adalah **master router** dan sumber kebenaran tunggal bagi semua AI Agent yang berinteraksi dengan repositori **SICA** — Sistem Informasi Kampus All-in-One berbasis SaaS multi-tenant.

Setiap agent yang membaca file ini **wajib**:
1. Mengidentifikasi konteks tugas dan merujuk ke dokumen `/docs` yang relevan.
2. Mematuhi seluruh **guardrails wajib** tanpa terkecuali.
3. Menulis dokumen & respons chat dalam **Bahasa Indonesia**, sementara kode sumber & skema database tetap **Bahasa Inggris**.

---

## 2. Peta Rujukan Dokumen `/docs`

Gunakan tabel ini untuk menentukan dokumen mana yang harus dibaca berdasarkan konteks tugas:

### 2.1 Berdasarkan Kategori Tugas

| Konteks Tugas | Dokumen Utama | Dokumen Pendukung |
|---------------|---------------|-------------------|
| **Arsitektur & Desain Sistem** | `ARCHITECTURE.md` | `PRD.md`, `TECH_CONVENTIONS.md`, `INDEX.md` |
| **Basis Data & Skema** | `DATA_MODEL.md` | `MIGRATION_SOP.md`, `SEED_DATA.md`, `GLOSSARY.md` |
| **Keamanan & Kepatuhan** | `SECURITY_COMPLIANCE.md` | `ARCHITECTURE.md`, `ENV_CONTRACT.md` |
| **Endpoint API** | `API_SPEC.md` | `DATA_MODEL.md`, `SECURITY_COMPLIANCE.md` |
| **Antarmuka Pengguna (UI/UX)** | `UI_UX_DESIGN.md` | `TECH_CONVENTIONS.md`, `PRD.md` |
| **Tugas & Roadmap** | `ROADMAP_TASKS.md` | `GIT_WORKFLOW.md`, `INDEX.md` |
| **Integrasi Pihak Ketiga** | `INTEGRATIONS.md` | `API_SPEC.md`, `ENV_CONTRACT.md` |
| **DevOps & Deployment** | `DEPLOYMENT_DEVOPS.md` | `ENV_CONTRACT.md`, `GIT_WORKFLOW.md` |
| **Pengujian** | `TESTING_STRATEGY.md` | `TECH_CONVENTIONS.md`, `DATA_MODEL.md` |
| **Penanganan Insiden** | `ISSUE_RESOLUTION.md` | `DEPLOYMENT_DEVOPS.md`, `SECURITY_COMPLIANCE.md` |
| **Infrastruktur & High-Concurrency / HA** | `ARCHITECTURE.md` (§9–10) | `DEPLOYMENT_DEVOPS.md` (§4), `DATA_MODEL.md` (§13) |
| **Otorisasi, Peran & Hak Akses** | `RBAC_MATRIX.md` | `SECURITY_COMPLIANCE.md` (§3), `DATA_MODEL.md` (§3/§14.4) |
| **Area Admin, Data Master & Benchmark Kompetitor** | `BENCHMARK_SEVIMA.md` | `PRD.md` (§5.8), `DATA_MODEL.md` (§14), `API_SPEC.md` (§4.6), `UI_UX_DESIGN.md` (§9), `ROADMAP_TASKS.md` (§2.5) |

### 2.2 Daftar Lengkap 20 Dokumen

| # | Dokumen | Lokasi | Deskripsi Singkat |
|---|---------|--------|-------------------|
| 1 | `PRD.md` | `/docs/PRD.md` | Spesifikasi produk, kebutuhan bisnis, fitur utama |
| 2 | `ARCHITECTURE.md` | `/docs/ARCHITECTURE.md` | Arsitektur sistem, ADR, diagram komponen |
| 3 | `DATA_MODEL.md` | `/docs/DATA_MODEL.md` | Skema PostgreSQL, ERD, kebijakan RLS |
| 4 | `SECURITY_COMPLIANCE.md` | `/docs/SECURITY_COMPLIANCE.md` | Kebijakan keamanan, audit, SSO, Zero-Trust |
| 5 | `API_SPEC.md` | `/docs/API_SPEC.md` | OpenAPI 3.1, endpoint, contoh payload |
| 6 | `TECH_CONVENTIONS.md` | `/docs/TECH_CONVENTIONS.md` | Konvensi kode, struktur direktori, state management |
| 7 | `UI_UX_DESIGN.md` | `/docs/UI_UX_DESIGN.md` | Design system, token, motion, micro-interactions |
| 8 | `INTEGRATIONS.md` | `/docs/INTEGRATIONS.md` | PDDikti, payment gateway, messaging |
| 9 | `ENV_CONTRACT.md` | `/docs/ENV_CONTRACT.md` | Variabel environment per lingkungan |
| 10 | `MIGRATION_SOP.md` | `/docs/MIGRATION_SOP.md` | SOP migrasi database, rollback |
| 11 | `GIT_WORKFLOW.md` | `/docs/GIT_WORKFLOW.md` | Branching, Conventional Commits, PR review |
| 12 | `ROADMAP_TASKS.md` | `/docs/ROADMAP_TASKS.md` | Daftar task, milestone, prioritas |
| 13 | `SEED_DATA.md` | `/docs/SEED_DATA.md` | Skrip data awal, fixture pengujian |
| 14 | `GLOSSARY.md` | `/docs/GLOSSARY.md` | Definisi istilah bisnis & teknis |
| 15 | `INDEX.md` | `/docs/INDEX.md` | Daftar isi & navigasi seluruh dokumen |
| 16 | `TESTING_STRATEGY.md` | `/docs/TESTING_STRATEGY.md` | Piramida testing, cakupan, strategi mock |
| 17 | `DEPLOYMENT_DEVOPS.md` | `/docs/DEPLOYMENT_DEVOPS.md` | Pipeline CI/CD, infrastruktur, rollout |
| 18 | `ISSUE_RESOLUTION.md` | `/docs/ISSUE_RESOLUTION.md` | SLA insiden, klasifikasi, penanganan |
| 19 | `RBAC_MATRIX.md` | `/docs/RBAC_MATRIX.md` | **Sumber kebenaran hak akses**: 22 peran ber-scope, katalog ~160 permission, matriks Role × Modul × Menu × Aksi, aturan SoD/ABAC/PII, celah G-01…G-08 |
| 20 | `BENCHMARK_SEVIMA.md` | `/docs/BENCHMARK_SEVIMA.md` | Hasil studi dokumentasi Sevima (peran, menu, modul, data master, flow) + kondisi SICA + peta selisih + urutan pengerjaan Area Admin |

---

## 3. Guardrails Wajib (Tidak Boleh Dilanggar)

Setiap AI Agent yang menghasilkan kode atau memodifikasi file di repositori SICA **harus** mematuhi aturan berikut tanpa pengecualian:

### 3.1 Strict TypeScript & Dart
- `tsconfig.json` wajib mengaktifkan `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`.
- `analysis_options.yaml` (Flutter) wajib menggunakan `strict-raw-types: true` dan `strict-casts: true`.
- **Larangan total terhadap `any` type** — lint rule `@typescript-eslint/no-explicit-any` harus di-set ke `error`.
- Pengecualian hanya diperbolehkan pada file definisi tipe khusus yang diberi komentar `// @allow-any` beserta alasan.

### 3.2 PostgreSQL Row-Level Security (RLS) dengan `tenant_id`
- Setiap tabel utama **wajib** memiliki kolom `tenant_id UUID NOT NULL`.
- Setiap tabel yang menyimpan data bisnis institusi **wajib** mengaktifkan RLS:
  ```sql
  ALTER TABLE <nama_tabel> ENABLE ROW LEVEL SECURITY;
  ALTER TABLE <nama_tabel> FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON <nama_tabel>
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
  ```
- Role aplikasi (`sica_app`) wajib menggunakan `NOBYPASSRLS`.
- Middleware server wajib menjalankan `SET LOCAL app.current_tenant = '<uuid>';` pada setiap transaksi.

### 3.3 Validasi Zod
- Semua payload API (`request.body`, `query`, `params`) **harus** divalidasi menggunakan skema **Zod** di layer transport sebelum masuk ke service layer.
- Skema Zod disimpan terpusat di `packages/contracts/` sebagai sumber kebenaran kontrak tipe (*single source of truth*).
- Skema Zod juga di-compile otomatis menjadi OpenAPI 3.1 untuk dokumentasi API.

### 3.4 Dual-Platform Parity (Next.js ↔ Flutter)
- Semua model data (DTO, schema) didefinisikan sekali dalam **OpenAPI / Zod** lalu di-generate untuk TypeScript & Dart.
- Fitur yang tersedia di Web **harus** memiliki padanan fungsional di Mobile (dan sebaliknya), kecuali fitur khusus platform.
- Konsistensi visual: spacing (8pt grid), warna (design token), dan animasi harus simetris di kedua platform.

### 3.5 Internationalization (i18n)
- Semua string UI yang ditampilkan ke pengguna akhir ditempatkan dalam file JSON terpisah: `id.json` (Indonesia) dan `en.json` (Inggris).
- Dilarang keras meng-hardcode teks UI langsung di dalam komponen.
- Aplikasi SaaS ini mendukung **dua bahasa** yang dapat dipilih pengguna.

### 3.6 Konvensi Bahasa
- **Dokumen, komentar penjelasan, dan respons chat**: Bahasa Indonesia.
- **Kode sumber, nama variabel, nama fungsi, nama tabel/kolom database**: Bahasa Inggris.
- Komentar inline dalam kode boleh menggunakan Bahasa Indonesia bila diperlukan untuk klarifikasi.

### 3.7 Penegakan High-Concurrency & High Availability (1.000+ concurrent users)
Rujukan: `ARCHITECTURE.md` §9–10, `DEPLOYMENT_DEVOPS.md` §4, `DATA_MODEL.md` §13. Setiap agen **wajib**:
- **Read/Write Split.** Semua MUTASI hanya ke **Primary**; query read-only non-transaksional boleh ke **Replica**. Query **read-your-writes** (cek kuota sebelum submit, hasil pasca-tulis, `tenant_modules` pasca-aktivasi) **WAJIB ke Primary**. Jangan pernah baca-replica untuk data yang baru ditulis.
- **Anti Row-Lock pada jalur panas.** Kapasitas kursi/kuota SKS saat Open Wiring **TIDAK** di-decrement via `UPDATE ... FOR UPDATE` per-request; gunakan **Redis Lua atomic** + **BullMQ** (worker finalis + `pg_advisory_xact_lock` per kelas + **idempotensi** + DLQ). Presensi massal di-**batch flush**.
- **Indexing.** Indeks domain selalu **`tenant_id` sebagai kolom pertama**; pakai `CREATE INDEX CONCURRENTLY` (non-blocking) + `INCLUDE` utk proyeksi; hindari over-index tabel write-heavy; `EXPLAIN (ANALYZE, BUFFERS)` jadi gate CI.
- **Koneksi.** Aplikasi lewat **PgBouncer (transaction mode)**; `prepare=false`; pool_size dituning vs `max_connections` Primary.
- **Ketersediaan.** Sediakan `/api/v1/health` (liveness) & `/api/v1/health/ready` (readiness cek DB primary/replica/Redis/queue/storage); **failover otomatis** (Patroni/repmgr, Redis Sentinel); **zero-downtime deploy** (canary→progressive, `maxUnavailable:0`, migrasi Expand-and-Contract, pisahkan deploy vs release via feature flag/`tenant_modules`).
- **Larangan:** `LOCK TABLE` eksklusif di runtime; write ke replica; decrement kuota di DB per-request; indeks blocking saat produksi.

---

## 4. Aturan Cursor Rules (`.cursor/rules/`)

AI Agent yang kompatibel dengan Cursor harus membaca file aturan tambahan berikut:

| File | Globs | Deskripsi |
|------|-------|-----------|
| `01-architecture.mdc` | `apps/web/**/*`, `apps/mobile/**/*` | Penegakan Clean Architecture, App Router, Feature-First Flutter |
| `02-security.mdc` | `**/api/**/*`, `**/db/**/*`, `**/services/**/*` | RLS, Zod sanitasi, SSO OAuth2/PKCE, isolasi tenant |
| `03-ui-conventions.mdc` | `apps/web/**/*`, `apps/mobile/**/*` | Visual hierarchy, spacing 8pt, animasi, aksesibilitas |
| `04-workflow.mdc` | `**/*` | SOP roadmap, migrasi DB, env contract, Conventional Commits |

---

## 5. Adaptor untuk Agent Lain

### 5.1 Windsurf (`.windsurfrules`)
Agent Windsurf membaca file `.windsurfrules` di root repositori yang memuat ringkasan guardrails dari dokumen ini.

### 5.2 Claude Code (`CLAUDE.md`)
File `CLAUDE.md` di root repositori memuat instruksi khusus untuk Claude Code, termasuk referensi ke guardrails dan peta dokumen.

### 5.3 GitHub Copilot (`.github/copilot-instructions.md`)
Instruksi inline untuk Copilot disimpan di `.github/copilot-instructions.md`.

---

## 6. Prosedur Standar Interaksi Agent

Setiap AI Agent yang menerima instruksi terkait SICA **harus** mengikuti alur berikut:

```
1️⃣  Baca AGENTS.md (file ini) → pahami konteks & guardrails
2️⃣  Identifikasi kategori tugas → rujuk dokumen /docs yang relevan (lihat §2)
3️⃣  Baca Cursor Rules yang sesuai dengan globs file yang akan dimodifikasi
4️⃣  Tulis kode / dokumen dengan mematuhi semua guardrails (§3)
5️⃣  Validasi: pastikan RLS, Zod, strict TS/Dart, dan i18n terpenuhi
6️⃣  Commit menggunakan format Conventional Commits (lihat GIT_WORKFLOW.md)
```

---

## 7. Contoh Penggunaan

**Skenario**: Agent diminta membuat endpoint API baru untuk modul presensi.

```
1. Baca: API_SPEC.md, SECURITY_COMPLIANCE.md, DATA_MODEL.md
2. Baca: .cursor/rules/02-security.mdc (karena file di **/api/**)
3. Buat skema Zod di packages/contracts/attendance.ts
4. Buat route handler di apps/web/app/api/v1/attendance/route.ts
5. Pastikan: tenant_id RLS ✓, Zod validasi ✓, strict TS ✓, no any ✓
6. Commit: feat(attendance): tambahkan endpoint scan presensi qr
```

---

*File ini adalah sumber kebenaran utama. Setiap perubahan arsitektur atau kebijakan harus diperbarui di sini terlebih dahulu.*
