# SICA — Technical Architecture

| | |
|---|---|
| Versi | 0.1 |
| Pola | **Modular monolith** multi-tenant, shared-schema dengan **PostgreSQL Row-Level Security** |
| Bahasa | TypeScript end-to-end (strict), Zod sebagai satu-satunya sumber kontrak |
| Dokumen terkait | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [PRD.md](file:///c:/SICA/docs/PRD.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) · [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md) |

---

## 1. Keputusan Arsitektur Utama (ADR ringkas)

| # | Keputusan | Alasan | Alternatif yang ditolak |
| # | Keputusan | Alasan Arsitektur | Alternatif yang Dipertimbangkan & Ditolak |
|---|---|---|---|
| ADR-1 | **Modular Monolith**, bukan microservices | Integritas transaksi akademik dan keuangan memerlukan jaminan konsistensi ACID dalam satu basis data. Pendekatan modular monolith menghindari kompleksitas komputasi terdistribusi pada fase awal operasional produk. | Microservices per modul (overhead operasional tinggi); Serverless murni (kurang efisien untuk transaksi multi-statement dan batch job panjang). |
| ADR-2 | Isolasi Tenant = **Shared Schema + RLS**, dengan kolom `tenant_id` di setiap tabel domain | Biaya komputasi per tenant rendah, proses onboarding tenant instan, pipeline migrasi satu jalur. Database bertindak sebagai penegak isolasi mutlak di lapisan kernel. | Database-per-tenant (biaya lisensi dan resource tidak efisien); Schema-per-tenant (kompleksitas manajemen migrasi ratusan skema). |
| ADR-3 | **Drizzle ORM**, bukan ORM dengan abstraksi opaque | Penegakan RLS, `SET LOCAL`, partisi relasional, dan PostgreSQL advisory lock memerlukan SQL yang transparan dan eksplisit tanpa tertutup oleh abstraksi ORM yang berat. | Prisma (keterbatasan kontrol transaksi tingkat rendah & connection pool opaque); TypeORM (kebocoran abstraksi dan overhead memori). |
| ADR-4 | **Zod di `packages/contracts`** sebagai sumber kebenaran kontrak tipe | Satu definisi skema tunggal digunakan bersama oleh Frontend Next.js, API NestJS, BullMQ Worker, dan automated test suites; skema ter-compile otomatis menjadi OpenAPI 3.1. | Duplikasi interface manual; generator tipe backend satu arah. |
| ADR-5 | Format Mata Uang = `bigint` (Rupiah utuh); Waktu = `timestamptz` UTC | Mata uang Rupiah (IDR) tidak memiliki sub-unit desimal yang relevan; penggunaan float berisiko menimbulkan selisih pembulatan rekonsiliasi. | `numeric(12,2)` untuk saldo; `timestamp` tanpa timezone. |
| ADR-6 | Identitas Primer = **UUIDv7** dibangkitkan aplikasi | Kunci primer berurut waktu (*time-ordered*), ramah indexing B-tree, aman terhadap kebocoran estimasi volume transaksi, dan mencegah konflik lintas tenant. | Bigserial (rentan *enumeration attack*); UUIDv4 random (fragmentasi index B-tree). |
| ADR-7 | Komunikasi Event = **Transactional Outbox Pattern** di database | Menjamin tidak ada event akademik atau finansial yang hilang saat broker terputus. Sinkronisasi audit, notifikasi, dan feeder bergantung pada keandalan pola ini. | Publish-after-commit langsung ke broker (berisiko hilangnya event bila commit berhasil namun jaringan broker gagal). |
| ADR-8 | Autentikasi Mandiri (*Self-hosted Primitives*), tanpa vendor lock-in | Mengakomodasi kebutuhan otorisasi multi-role ber-scope konteks, MFA per level peran, pencabutan sesi server-side, serta federasi OIDC/SAML institusi per tenant. | Solusi auth SaaS all-in-one pihak ketiga yang membatasi fleksibilitas multi-role dan struktur scoping. |
| ADR-9 | Worker Process Terpisah dari Web API dengan Basis Data Bersama | Beban batch (generasi 5.000 tagihan massal, sinkronisasi Neo Feeder) tidak menghabiskan thread pool request HTTP saat lonjakan trafik Open Wiring. | In-process background task (berisiko starvation thread web server). |
| ADR-10 | Orkestrasi Kontainer: Docker pada **AWS ECS Fargate**, Managed PostgreSQL (RDS) + Read Replica | Menyediakan skalabilitas horizontal otomatis, keandalan PITR, dan efisiensi operasional tanpa beban pengelolaan kluster Kubernetes mandiri di fase awal. | Self-hosted Kubernetes (beban operasional berlebih); VPS tunggal (tidak memenuhi SLA ketersediaan tinggi). |
| ADR-11 | **SICA All-in-One Platform: SIAKAD Core + Virtual LMS (EdLink Style)** | Mengintegrasikan fungsi administrasi akademik dan perkuliahan daring dalam satu platform terpadu. Sinkronisasi mahasiswa KRS ke ruang kelas virtual berjalan instan (*zero-setup*), nilai tugas/kuis langsung mengalir ke KHS, dan mendukung dual mode (Onsite vs Online PJJ). | Memisahkan SIAKAD dan LMS menjadi sistem terpisah (overhead integrasi, duplikasi akun, dan input nilai manual). |
| ADR-12 | **Dynamic Auto-Class Generation via Waitlist Threshold** | Mengotomatisasi pembukaan kelas paralel baru berbasis ambang batas antrean (min 15 mhs Onsite / 30 mhs Online). Menghilangkan friksi penolakan kelas penuh sekaligus melindungi kampus dari pemborosan biaya operasional kelas sedikit peminat. | Fixed quota pasif (menolak mahasiswa dengan `CLASS_FULL`); Instant auto-spawn tanpa threshold (risiko kelas hanya 2-3 orang). |
| ADR-13 | **Packaging Modular Berbasis Entitlement Data-Driven** (tabel `modules`/`tenant_modules`/`module_dependencies`/`plan_modules` + resolver gerbang) | Kampus dapat membeli sebagian modul ("SIAKAD saja", "SIAKAD + LMS"). Aktif/tidaknya modul adalah **data per-tenant**, bukan fork kode atau build terpisah → satu deployment melayani semua kombinasi paket. Gating dieksekusi di 3 titik (menu, route, endpoint) dari satu resolver ber-cache. | Build/branch kode per kombinasi modul (ledakan varian & beban CI); flag boolean hardcoded di kode (tak terukur, tak self-service); microservice terpisah per modul (melanggar ADR-1). |

---

## 2. Diagram Arsitektur

```
                                   ┌──────────────────────────────────────────────┐
                                   │                  CLIENTS                     │
                                   │  Browser (mahasiswa/dosen/admin) · Mobile PWA │
                                   │  Campus IdP (OIDC/SAML, Phase 2) · Webhook    │
                                   └───────────────┬──────────────────────────────┘
                                                   │  HTTPS/TLS1.3 (HSTS preload, CSP nonce)
                                    ┌──────────────▼──────────────┐
                                    │   CDN + Edge WAF + Rate     │  ── DDoS L7, bot, geo allow,
                                    │   Shield (tenant-aware)     │     OW-window policy per tenant
                                    └──────────────┬──────────────┘
                                                   │
        ┌──────────────────────────────────────────┼───────────────────────────────────────┐
        │                                          │                                       │
┌───────▼────────┐                     ┌───────────▼────────────┐              ┌───────────▼──────────┐
│  apps/web      │  typed contracts    │  apps/api (NestJS)     │              │  apps/worker (BullMQ)  │
│  Next.js 15    │◀───────────────────▶│  Modular monolith      │              │  batch · scheduled     │
│  RSC + islands │  packages/contracts │  Guards → Zod → Service│              │  tagihan · feeder ·    │
│  TanStack Query│   (Zod schemas)     │  → Domain → Repository │              │  recalc IP · notif ·   │
│  RHF + Zod     │                     │  REST + OpenAPI 3.1    │              │  reconcile · DR jobs   │
└────────────────┘                     └───────────┬────────────┘              └───────────┬──────────┘
                                                   │                                       │
              ┌────────────────────────────────────┼───────────────────────────────────────┤
              │                                    │                                       │
   ┌──────────▼───────────┐          ┌─────────────▼──────────────┐          ┌─────────────▼──────────┐
   │ PostgreSQL 16        │          │ Redis 7                    │          │ Object Storage (S3/R2) │
   │ ────────────────────  │          │ ─ session & revocation list│          │ ─ berkas mhs, KHS PDF  │
   │ · RLS FORCE per tabel │          │ ─ OW token bucket (Lua)    │          │ · versi & checksum     │
   │ · tenant_id ∀ tabel   │          │ ─ kuota kelas atomic       │          │ · presigned (short TTL)│
   │ · audit_logs append   │          │ ─ queue + rate limiter     │          │ · malware scan         │
   │ · partisi per periode │          │ ─ cache permission (TTL)   │          └────────────────────────┘
   │ ─ write path: TX      │          └────────────────────────────┘
   │ ─ advisory lock kelas │
   └──────────┬────────────┘
              │ logical replication / PITR (WAL)                 ┌──────────────────────────┐
   ┌──────────▼─────────────┐      ┌────────────────────────┐    │ Integrasi eksternal      │
   │ Read replica (report/  │      │ Outbox table ──▶ relay │───▶│ Payment VA/QRIS · email  │
   │ dashboard, no writes)  │      └────────────────────────┘    │ · WA gateway · e-sign ·  │
   └────────────────────────┘                                    │ PDDIKTI Feeder API · ERP │
                                                                 └──────────────────────────┘
   Cross-cutting: OpenTelemetry (trace+metric+log) → Grafana LGTM · Sentry (errors) ·
   KMS/Vault (keys & secret) · GitHub Actions (build, test, migration gate, deploy) ·
   Terraform (env) · S3 lifecycle (retensi rekaman akademik permanen per BR-R12, audit ≥5 th)
```

**Siklus permintaan (write path akademik):**

```
Request → edge → Guard (autentikasi: verifikasi JWT, tarik session dari Redis/DB,
                    cek status user & tenant aktif, cek window periode)
        → Zod parse (contracts) → Service (aturan domain, BR-* dari DB, bukan kode)
        → BEGIN TX  +  SET LOCAL app.tenant_id / app.user_id
        → Repository (SQL Drizzle; RLS mengeksekusi policy di DB)
        → audit_events + outbox ditulis DI TRANSAKSI YANG SAMA
        → COMMIT → relay publish outbox → worker kirim notifikasi/sync
        → respons + correlation-id
```
Kalau `COMMIT` gagal, tidak ada audit yang tertinggal sendirian dan tidak ada notifikasi palsu. Ini alasan outbox ada di DB yang sama.

---

## 3. Tech Stack (rekomendasi)

| Layer | Pilihan | Versi | Alasan kunci |
|---|---|---|---|
| Runtime | Node.js LTS | 22.x | ekosistem matang, `--env-file`, test runner stabil |
| Bahasa | TypeScript `strict: true` | 5.x | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `no any` di CI |
| API framework | NestJS + adapter Fastify | 11.x | DI + Guard/Interceptor untuk RBAC & tenancy lintas modul; Fastify untuk throughput |
| Validasi | Zod (via contracts) | 4.x | satu skema untuk FE/API/worker/test; generate OpenAPI |
| Frontend | Next.js App Router + React | 15 / 19 | RSC memangkas JS untuk peran read-heavy (mahasiswa); streaming dashboard |
| Data fetching FE | TanStack Query + RHF | v5 / v7 | cache invalidation eksplisit; form panjang (KRS, nilai) butuh state jelas |
| Styling | Tailwind + shadcn/ui | v4 | konsistensi desain tanpa vendor lock; tema per tenant |
| ORM | Drizzle ORM + drizzle-kit | latest | SQL eksplisit (RLS/partisi/advisory lock), type-safe, migration readable |
| Database | PostgreSQL | 16 | RLS + FORCE RLS, partisi deklaratif, advisory lock, GUC |
| Cache/queue | Redis + BullMQ | 7 / 5.x | token bucket Lua atomic, delay job, retry/backoff |
| Storage | S3-compatible (R2/MinIO) | — | presigned PUT/GET, versioning, lifecycle |
| Search | Postgres FTS → OpenSearch | — | mulai dari yang cukup; `pg_trgm` untuk cari nama/NIM |
| Auth primitives | `argon2` (Argon2id) + `jose` (JWT RS256 — ARC-01) + TOTP/WebAuthn | — | hashing & token standar, tanpa vendor lock |
| Observability | OpenTelemetry + Grafana LGTM + Sentry + Pino | — | trace per request/tenant; error dengan konteks |
| Testing | Vitest · Testcontainers · Playwright · k6 · fast-check | — | DB asli, bukan mock; uji properti untuk perhitungan IP |
| CI/CD | GitHub Actions + Docker + Terraform | — | gate migration & RLS-policy test sebelum deploy |
| IaC | Terraform | — | lingkungan reproducible, bukti kepatuhan (SOC2 CC) |

**Stack yang disepakati belum final untuk 1 hal:** pilihan hosting region/availability zone (dipengaruhi kebutuhan TKDN/lokasi data pendidikan & biaya latensi ke kampus).lihat `SECURITY_COMPLIANCE.md` §7.

---

## 4. Multi-Tenancy & Strategi Isolasi Data

### 4.1 Model
- **Tenant = perguruan tinggi.** Satu instance SICA melayani banyak tenant (pooled).
- Setiap tabel domain & identitas carrying `tenant_id uuid NOT NULL REFERENCES tenants(id)` — **tanpa kecuali**, termasuk tabel join dan tabel log. Ini membuat satu `JOIN` yang lupa filter tetap tidak bisa lolos (RLS menolaknya di DB).
- Resolusi tenant: **selalu dari klaim sesi/server-side**, tidak pernah dari header/param klien. Urutan: `session → tenant_id claim → verifikasi membership user di tenant itu → verifikasi tenant status = ACTIVE`.
- Domain/branding per tenant: `tenant_domains` → tema, logo, URL, kebijakan MFA & SSO sendiri, zona waktu akademik.

### 4.2 Enforcement berlapis (defense in depth)
| Lapis | Kontrol | Bila lapis lain gagal |
|---|---|---|
| Type | `TenantContext` wajib sebagai argumen di setiap method repository | TS compile error kalau lupa — tapi ini bukan keamanan, hanya sinyal dini |
| App | Guard + policy check per aksi (role **dan** scope) | bisa di-bypass oleh bug kode baru |
| Query | filter eksplisit `tenant_id` di setiap query | bisa lupa |
| **DB (otoritatif)** | **RLS `USING` + `WITH CHECK` pada semua tabel, `FORCE ROW LEVEL SECURITY`** | inilah jaring pengaman; `sica_app` tidak punya `BYPASSRLS` |
| Infra | kredensial DB berbeda per proses, secret di vault, network policy | membatasi blast radius |

### 4.3 Mekanisme `SET LOCAL` (titik paling sering salah)
```sql
-- satu transaksi, satu tenant. Tidak pernah SET di level session untuk pooled connections.
BEGIN;
SET LOCAL app.tenant_id = '<uuid>';
SET LOCAL app.user_id   = '<uuid>';
-- ... semua statement di transaksi ini melihat hanya data tenant tersebut
COMMIT;
```
- `SET LOCAL` (bukan `SET`): nilai mati bersama transaksi → koneksi yang kembali ke pool tidak membawa sisa tenant. Ini penyebab kebocoran cross-tenant nomor satu di aplikasi pooled.
- Helper `app.current_tenant()` membaca dengan `missing_ok` dan **gagal tertutup**: bila GUC tidak diset → `NULL` → perbandingan `tenant_id = NULL` → `NULL` → policy **tidak** terpenuhi → akses ditolak. Tidak ada default "super".
- Setiap `BEGIN` di repository selalu dipasangkan dengan `SET LOCAL`; diuji dengan test yang sengaja tidak menyetel GUC dan mengharapkan 0 baris.

### 4.4 Peran database (pemisahan wewenang)
| Peran | Hak | Dipakai oleh |
|---|---|---|
| `sica_app` | DML, **NOBYPASSRLS**, tanpa DDL, tanpa akses `audit_logs` UPDATE/DELETE | API & worker |
| `sica_owner` | DDL + `BYPASSRLS`, tidak dipakai runtime | migrasi CI saja, kredensial terpisah |
| `sica_readonly` | SELECT via replica, RLS aktif dengan tenant context | reporting/dashboard/analytics |
| `sica_platform` | akses lintas tenant terbatas view agregat + break-glass | Operator platform, dengan MFA + justifikasi + audit |
| `sica_backup` | hanya untuk restore | DR |

### 4.5 Jalur Khusus & Pertimbangan Kritis Arsitektur
- **Beban Puncak Open Wiring (KRS)**: Token bucket Redis (per kombinasi `tenant_id` + `user_id`) membatasi laju submit request. Pengurangan kuota kelas dilindungi oleh **PostgreSQL advisory lock per `class_id`** di dalam transaksi enrollment atomik, menjamin kuota tidak pernah over-subscribed meskipun menerima 150 request simultan ([AC-KRS-3](file:///c:/SICA/docs/PRD.md#L276)).
- **Eksekusi Job Lintas Tenant**: Background worker memproses antrean per-tenant dengan menyetel `SET LOCAL app.tenant_id` tersendiri. Setiap job berada dalam satu cakupan transaksi mandiri sehingga kegagalan pemrosesan pada satu tenant tidak mengganggu antrean tenant lain.
- **Strategi Partisi & Retensi Basis Data**: Tabel transaksional bervolume tinggi dipartisi secara relasional per periode akademik (`PARTITION BY RANGE (period_id)`), menjaga performa kueri harian dan mempermudah pengarsipan data semester.
- **Konfigurasi Fitur Dinamis (*Feature Flag*)**: Status aktivasi fitur per tenant disimpan pada basis data (bukan environment variable global), memungkinkan peluncuran fitur bertahap (*canary rollout*) per institusi kampus.
- **Objek Konfigurasi Akademik Tingkat Pertama**: Pengaturan spesifik program studi per periode disimpan sebagai objek terstruktur versi (`academic_rules.params`), mencakup aturan kurikulum, validasi KRS, pengisian nilai, ambang batas kehadiran, dan prasyarat kuesioner tanpa menimbulkan percabangan logika (*if-else*) di kode aplikasi.
- **Idempotensi Pemrosesan Batch**: Seluruh generator batch (penerbitan tagihan massal, penjadwalan sesi perkuliahan, registrasi mahasiswa baru) dirancang idempotent dan mendukung mode simulasi (*dry-run*) sebelum mutasi data definitif.
- **Otomasi Pemantauan Kepatuhan Regulasi**: Background worker secara berkala mengevaluasi tenggat pelaporan Neo Feeder (rencana studi ≤2 bulan, hasil studi ≤2 bulan), masa berlaku akreditasi program studi sebelum pembukaan yudisium, ambang batas masa studi mahasiswa untuk peringatan dini DO, dan kedaluwarsa sesi pengguna.
- **Penegakan Immutability di Lapisan Database**: Tabel rekaman definitif (`grades` final, `ledger`, `graduation_records`, `audit_logs`) dilindungi dengan pencabutan izin `UPDATE` dan `DELETE` bagi peran runtime `sica_app`. Setiap koreksi wajib dicatat sebagai baris versi baru yang ter-audit.
- **Isolasi Biaya & Kuota Sumber Daya**: Metrik konsumsi sumber daya (kapasitas penyimpanan berkas, volume baris data akademik, jumlah eksekusi background job) dimonitor per tenant untuk mendukung penegakan kuota dan akuntabilitas biaya operasional.
- **Standar Larangan (*Anti-Patterns*)**:
  - Dilarang menggunakan interpolasi string pada kueri SQL mentah.
  - Dilarang menjalankan kueri analitik ad-hoc menggunakan peran `sica_app`.
  - Dilarang menempatkan klaim otorisasi atau peran hanya di sisi klien (*client-side token trust*).
  - Dilarang menyimpan cache global tanpa menyertakan `tenant_id` sebagai bagian dari cache key.

---

## 5. Struktur Direktori Proyek (*Modular Monolith*)

```
sica/
├─ apps/
│  ├─ web/                       # Aplikasi Web Portal (Next.js 15 App Router + React 19)
│  │  ├─ app/
│  │  │  ├─ (auth)/login|forgot|reset|mfa
│  │  │  ├─ (portal)/[tenant]/dashboard|krs|khs|tagihan|bayar|jadwal
│  │  │  ├─ (dosen)/[tenant]/kelas|presensi|nilai|koreksi|bimbingan
│  │  │  ├─ (prodi)/[tenant]/kurikulum|kelas|approval-krs|yudisium|skala-nilai
│  │  │  ├─ (admin)/[tenant]/akademik|keuangan|tarif|status-mhs|feeder|calendar
│  │  │  ├─ (pimpinan)/[tenant]/dashboard|laporan|approval
│  │  │  └─ (platform)/admin-portal          # Portal Operator Platform SICA (Terisolasi & Ter-audit)
│  │  ├─ components/ features/ lib/ styles/
│  │  └─ middleware.ts           # Resolusi tenant dari host header (klaim sesi, bukan otorisasi)
│  │
│  ├─ api/                       # REST API Backend (NestJS 11 + Fastify Adapter)
│  │  ├─ src/
│  │  │  ├─ core/                # Tenant/RLS Context, Guards, RBAC/ABAC, Zod Validation Pipe,
│  │  │  │                       #   Audit Interceptor, Outbox Relay, Tracing OpenTelemetry
│  │  │  ├─ modules/
│  │  │  │  ├─ identity/         # Autentikasi, Sesi, MFA, Role Assignment, Impersonasi
│  │  │  │  ├─ administration/   # Tenant, Struktur Organisasi, Periode, Kalender, Aturan Akademik
│  │  │  │  ├─ curriculum/       # Kurikulum, Mata Kuliah, Prasyarat, Skala Nilai
│  │  │  │  ├─ enrollment/       # Kelas, Penugasan Dosen, Ruang, Jadwal, OW/KRS, Kuota Atomik
│  │  │  │  ├─ attendance/       # Sesi Pertemuan Kuliah, Presensi, Rekapitulasi Presensi
│  │  │  │  ├─ grading/          # Input Nilai, Kunci Nilai, Alur Koreksi Nilai, IP/IPK/KHS/Transkrip
│  │  │  │  ├─ student-status/   # Status Mahasiswa, Cuti Akademik, Peringatan DO, Clearance
│  │  │  │  ├─ finance/          # Tarif, Generator Tagihan, Pembayaran VA/QRIS, Ledger, Rekonsiliasi
│  │  │  │  ├─ feeder/           # Pemetaan PDDIKTI Neo Feeder, Validasi Pra-kirim, Sync Log
│  │  │  │  ├─ notification/     # Template Notifikasi, Dispatcher Email/WA, Delivery Tracking
│  │  │  │  ├─ reporting/        # Kueri Agregasi Laporan, Ekspor Dokumen, Dashboard Eksekutif
│  │  │  │  └─ platform/         # Tenant Provisioning, Feature Flags, Resource Quota Management
│  │  │  └─ main.ts
│  │
│  ├─ worker/                    # Background Worker (BullMQ): Tagihan, Feeder Sync, Notifikasi
│  └─ admin-cli/                 # Utilitas Operasional: Migrasi Data Legacy, Backfill, Ekspor Tenant
│
├─ packages/
│  ├─ contracts/                 # ⚑ Kontrak Tipe Tunggal: Skema Zod, TypeScript Types, Fragmen OpenAPI
│  ├─ domain/                    # Pure Domain Logic: Formulasi IPK, Batas SKS, Konversi Nilai, Denda
│  ├─ db/                        # Skema Drizzle ORM, File Migrasi SQL, Kebijakan RLS, Seed Data
│  ├─ ui/                        # Design System Bersama (shadcn/ui) + Dukungan Multi-Tema Tenant
│  ├─ config/                    # Konfigurasi Standar: ESLint, TSConfig, Prettier, Tailwind Preset
│  └─ testing/                   # Fixtures Multi-Tenant, Testcontainers Helpers, Skenario Beban k6
│
├─ infra/                        # Modul Terraform, Konfigurasi Docker, Dashboard Grafana, Aturan Sentry
├─ e2e/                          # Uji End-to-End Playwright: Alur J1–J6 dan Uji Penetrasi Antar-Tenant
├─ load/                         # Skrip Uji Beban k6: Skenario 100 TPS Open Wiring & Validasi Kuota
├─ docs/                         # PRD, ARCHITECTURE, SECURITY_COMPLIANCE, DATA_MODEL, INDEX, GLOSSARY
└─ .github/workflows/            # ci.yml, deploy.yml, security.yml, migration-gate.yml
```

**Aturan Ketergantungan Antar-Modul (Ditegakkan oleh ESLint):**
```
contracts ←── domain ←── modules/*  ←── apps
```
- Modul domain tidak saling mengimpor secara langsung; komunikasi antar-modul dilakukan melalui event asinkron via Outbox Pattern atau interface publik yang diekspos di level aplikasi.
- Setiap modul backend hanya mengakses tabel data yang menjadi domain kepemilikannya.

---

## 6. Model Kapasitas & Paket Layanan Perguruan Tinggi

Berdasarkan analisis pasar EdTech perguruan tinggi di Indonesia, segmentasi lisensi SaaS umumnya distrukturkan berdasarkan **skala populasi mahasiswa aktif**, bukan penjualan modul terpisah:

| Tier Layanan | Kapasitas Mahasiswa Aktif | Profil Target Institusi | Fitur & Batasan Sumber Daya |
|---|---|---|---|
| **Starter / Lite** | < 500 Mahasiswa | Sekolah Tinggi / Akademi / Institut Baru | Modul Inti Akademik, Keuangan, Feeder PDDIKTI, Database Shared. |
| **Growth** | 500 – 2.000 Mahasiswa | Institut / Universitas Swasta Menengah | Fitur Starter + Portal Dosen/Mahasiswa PWA, Integrasi VA/QRIS Otomatis. |
| **Professional** | 2.000 – 7.000 Mahasiswa | Universitas Berkembang | Fitur Growth + Penjadwalan Ruang Otomatis, Clearance Cekal, Cetak Dokumen Ber-QR. |
| **Enterprise** | > 7.000 Mahasiswa | Universitas Besar / PTN-BH / Multi-Kampus | Fitur Penuh + Multi-Kampus, SLA Ketersediaan 99,5%, Dedicated Read Replica, Federasi SSO (OIDC/SAML). |

### Implikasi Desain Terhadap Arsitektur:
1. **Pencatatan Utilisasi (*Usage Metering*)**: Pencatatan metrik konsumsi per tenant diimplementasikan sejak awal (`tenant_usage`: kapasitas storage berkas, jumlah user aktif, volume baris akademik) untuk menegakkan kepatuhan tier lisensi.
2. **Batas Kuota (*Resource Quotas*)**: Pembatasan konkurensi request Open Wiring, kapasitas penyimpanan dokumen, dan limit frekuensi API (`tenant_quotas`) diterapkan untuk mencegah dampak *noisy neighbor* antar-kampus.
3. **Aktivasi Modul via Feature Flag**: Seluruh tier menggunakan basis data dan skema yang seragam; diferensiasi paket dikendalikan melalui sistem feature flag dinamis per tenant.

---

## 7. Lingkungan Deployment, Pipeline CI/CD, dan Kendali Mutu

### 7.1 Segmentasi Lingkungan (*Environments*)

| Lingkungan | Karakteristik Basis Data | Peran & Tujuan Pengujian |
|---|---|---|
| **Development (`dev`)** | Docker Compose lokal, data sintetis 2-tenant | Pengembangan fitur harian, verifikasi unit test, dan uji isolasi RLS lokal. |
| **Staging (`staging`)** | Replikasi arsitektur produksi, data tersintesis & ter-anonimkan | Uji migrasi skema (*dry-run*), simulasi beban konkurensi k6, pengujian regresi keamanan lintas-tenant, dan UAT institusi. |
| **Production (`prod`)** | Basis data AWS RDS PostgreSQL Multi-AZ + Replikasi Baca | Lingkungan operasional riil dengan penyebaran bertahap (*canary rollout*) per tenant. |

### 7.2 Standar Pipeline Integrasi Berkelanjutan (*CI Blocking Gates*)
Setiap pull request wajib memenuhi gerbang verifikasi otomatis sebelum dapat digabungkan:
1. **Verifikasi Statis**: Typecheck TypeScript tanpa toleransi kesalahan (`strict: true`) dan linting kepatuhan dependensi arsitektur.
2. **Automated Testing Suite**:
   - Unit test pada pure logic bisnis di `packages/domain`.
   - Integration test multi-tenant via Testcontainers PostgreSQL (memvalidasi kepatuhan RLS dan matriks izin peran).
   - End-to-end user journeys test via Playwright.
3. **Migration & Drift Gate**: Eksekusi uji coba migrasi dan rollback skema database di lingkungan terisolasi untuk mendeteksi potensi *schema drift*.
4. **Security & Vulnerability Scans**: Pemindaian SAST, pemeriksaan kerentanan paket dependensi, secret scanning, dan uji beban ringan (*smoke load test*).

### 7.3 Buku Panduan Operasional (*Operational Runbooks*)
Dokumentasi prosedur penanganan insiden operasional disediakan pada direktori `docs/runbook/`, mencakup:
- **Runbook Open Wiring (OW)**: Prosedur mitigasi lonjakan konkurensi dan aktivasi mode degradasi anggun (*read-only fallback*).
- **Runbook Kegagalan Webhook Pembayaran**: Prosedur rekonsiliasi manual dan pencocokan mutasi bank saat terjadi kegagalan jaringan callback.
- **Runbook Pelaporan Neo Feeder**: Prosedur penanganan error sinkronisasi dan pembukaan periode pelaporan lampau.
- **Runbook Pemulihan Bencana (*Disaster Recovery*)**: Prosedur failover replika baca dan pemulihan Point-in-Time Recovery (PITR).
- **Runbook Akses Darurat (*Break-Glass*)**: Prosedur pemberian hak akses teknis sementara ber-justifikasi dengan pencatatan audit ganda.

---

## 8. Arsitektur Dual Mode (Onsite vs Online) & Virtual Campus (EdLink-Style LMS Engine)

Untuk melayani spektrum institusi pendidikan tinggi (kampus fisik konvensional, kampus online/PJJ, dan model hybrid), SICA mengimplementasikan **Tenant Policy Engine** terintegrasi:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SICA UNIFIED PLATFORM                                 │
├──────────────────────────────────────┬──────────────────────────────────────┤
│          ACADEMIC CORE ENGINE        │       VIRTUAL LEARNING & LMS         │
│  (SIAKAD: KRS, Kurikulum, Keuangan)  │  (Video Modul, Forum, CBT, Zoom API) │
├──────────────────────────────────────┴──────────────────────────────────────┤
│                         TENANT POLICY ENGINE                                │
│       Mode ONSITE (Fisik)     │     Mode ONLINE (Siber / PJJ)               │
│ • Kapasitas kelas: 35-45 mhs  │ • Kapasitas kelas: 100-250 mhs              │
│ • Validasi Ruang Gedung       │ • Virtual Room (Auto-Provision Zoom/Meet)   │
│ • Collision Engine: Ruang+Dosen│ • Collision Engine: Dosen Sinkronus Saja    │
│ • Presensi: Dynamic QR GPS    │ • Presensi: Watch-time Modul / Zoom Log     │
│ • Penugasan: Dosen Baru       │ • Penugasan: Dosen Utama + Tutor Asisten    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Alur Kerja Dynamic Auto-Class Splitting
1. Saat kelas utama penuh, request mahasiswa tidak di-reject seketika melainkan dimasukkan ke tabel `class_waitlists` dengan penahanan kuota SKS sementara.
2. Ketika jumlah pendaftar di daftar tunggu mencapai ambang batas (*Waitlist Threshold*, default: 15 mahasiswa Onsite / 30 mahasiswa Online), transaksi atomik PostgreSQL memicu pembentukan kelas paralel baru (`Kelas B`).
3. Sistem secara otomatis mengalokasikan ruang (fisik untuk Onsite, virtual link Zoom/Meet untuk Online) dan mempromosikan seluruh mahasiswa daftar tunggu ke status `ENROLLED`.
4. Workload Guardrail memverifikasi batas maksimal 16 SKS per dosen (BKD Dikti); bila dosen utama overload, sistem mengalihkan kelas ke dosen pengganti atau menugaskan Tutor/Teaching Assistant.

### 8.2 Integrasi Otomatis SIAKAD <-> LMS (Zero-Setup Class Sync)
- **Roster Auto-Provisioning:** Persetujuan KRS oleh Dosen PA secara otomatis menyinkronkan data mahasiswa dan dosen ke sesi kelas virtual LMS (`lms_sessions` 1 s.d. 16).
- **Asesmen & Buku Nilai Terpadu:** Nilai kuis online dan tugas digital di modul LMS langsung mengalir mengisi komponen nilai (`grade_components`) di KHS SIAKAD tanpa entri manual ganda.
- **Rekapitulasi Presensi Daring:** Kehadiran pada webinar live atau penyelesaian modul video (≥80% watch time) secara otomatis terekap ke persentase kehadiran mahasiswa sebagai syarat mengikuti ujian akhir.
- **Runbook Penanganan Insiden Data Pribadi**: Prosedur eskalasi dan notifikasi insiden kebocoran data sesuai mandat UU PDP (≤ 3×24 jam).

---

## 9. Topologi Infrastruktur High-Concurrency (Target 1.000+ Concurrent Users)

Skenario puncak: **Open Wiring / KRS War** — ribuan mahasiswa menekan "Ambil Kelas" dalam jendela beberapa menit, dan **presensi massal** saat banyak kelas dibuka serentak. Arsitektur harus menahan lonjakan ini **tanpa row-locking DB**. Topologi multi-layer (stateless scale-out di depan, stateful dengan pooling & replikasi di belakang):

```
[CLIENT] ──TLS1.3──▶ (1) Cloudflare CDN + WAF + Load Balancer (L7)
                         │  · DDoS L3/L4/L7, bot mgmt, rate-limit edge
                         │  · cache aset statis + SRI; geo routing
                         │  · sticky=NO (stateless), health-checked origins
                         ▼
                    (2) Web/API Cluster — Auto-Scaling
                         │  · apps/web (Next.js) & apps/api (NestJS) replikasi N→M
                         │  · HPA/SLE berdasarkan CPU≥60% | RAM≥75% | RPS | p95 latency
                         │  · tiap instance: connection-scaping, graceful drain
                         ▼
              ┌──────────┴───────────┐                ┌────────────────────────┐
              ▼                       ▼                ▼                        ▼
      (3) Redis Cache Cluster   (4) BullMQ Queue   (5) PgBouncer           Object Storage
        · mode cluster / sentinel  Engine (workers)   Connection Pooler       (S3/R2)
        · session/revocation,      · queue per-       · transaction mode       · presigned
        · kuota atomic (Lua),       domain (krs,       (session-mode utk
        · rate-limit token bucket   attendance,        DDL migrasi)
        · cache permission/kelas     feeder, notify)   · pool_size dituning
      └──────────────────────────┘  · concurrency      ▼
        (cache TTL + invalidasi)     per-worker      (6) PostgreSQL 16 Cluster
                                                       · Primary (WRITE/mutasi)
                                                       · N× Replica (READ-only: jadwal/KRS/report)
                                                       · streaming replikasi + logical rep
                                                       · PgBaseBackup/WAL-G PITR, auto-failover
                                                       · advisory lock per kelas utk anti oversell
```

### 9.1 Per-layer: peran, tuning, dan justifikasi
| Layer | Teknologi | Konfigurasi HA | Rasional concurrency |
|---|---|---|---|
| 1 Edge | Cloudflare CDN+WAF+LB | Anycast multi-region, Under Attack mode, rate-limit `OW-window` per tenant | Meredam DDoS & lonjakan sebelum menyentuh origin; cache mengurangi hit origin |
| 2 App | Next.js + NestJS cluster | **HPA** min 3 → max 24 pod; target CPU 60%/p95 250ms; **PDB** (minAvailable 2) agar rollout tak Habiskan kapasitas | Scale-out stateless; 1.000 CU ≈ ratusan RPS, ditopang replikasi horizontal |
| 3 Cache | Redis 7 Cluster/Sentinel | 3 master + 3 replica, `maxmemory` LRU utk cache, AOF utk data kritis (session/kuota) | Dekrement kuota **atomic di Redis (Lua)** → DB tak di-lock saat perang KRS |
| 4 Queue | BullMQ + Worker pool | 1 queue/domain, `concurrency` per worker (mis. krs=10), retry + backoff + DLQ, `limiter` global | Meratakan puncak: request enqueue cepat, commit bertahap dikendalikan worker |
| 5 Pool | PgBouncer (transaction) | 2 instance LB, `pool_mode=transaction`, `default_pool_size≈(DB_max_conns×0.8)/app_pods`, `max_client_conn` besar | Ratusan app-conn → puluhan DB-conn; hindari exhaustion `max_connections` |
| 6 DB | PostgreSQL 16 | 1 Primary + ≥2 Replica (streaming), Patroni/repmgr auto-failover, PgBouncer di depan, WAL-G PITR | Write terpisah; read jadwal/KRS ke replica → primary lega untuk mutasi |

### 9.2 Anggaran kapasitas (rule of thumb)
- Target: **1.000 concurrent users**, puncak KRS-war **~2.000–3.000 RPS** tulis selama 60–120 detik.
- Per-pod NestJS ≈ 400–600 RPS tulis (I/O-bound, non-blocking) → 24 pod cukup; namun **bottleneck nyata = DB write**. Karena itu jalur KRS **tidak** menulis langsung saat lonjakan; ia **enqueue** (Redis) lalu di-*drain* worker dengan laju ≤ kapasitas commit Primary (mis. 300 txn/s) — puncak diserap antrian, bukan bikin DB antre lock.
- PgBouncer pool & `max_connections` Primary harus ≥ total worker concurrency + background jobs + margin.

---

## 10. Strategi Antrian Asinkron (BullMQ): KRS War & Presensi Massal

**Masalah naif:** `UPDATE classes SET enrolled_count=enrolled_count+1 WHERE id=? AND enrolled_count<capacity` oleh ribuan transaksi → **row lock** pada satu kelas favorit = antran & timeout. Solusi: geser "pintu masuk" ke **Redis atomic**, jadikan DB hanya **finalis** yang berjalan terkontrol lewat worker.

### 10.1 Alur KRS "War" (seat reservation → async commit)
```
1) API terima "Ambil Kelas" (validasi JWT+kuota SKS+window, Zod).
2) Redis Lua (atomic, single-thread → tanpa race):
     - cek & decremen `class:{id}:seats` (seed dari DB sebelum OW)
     - cek `student:{id}:sks` ≤ kuota (BR-A2)
     - cek tidak dobel (Set `class:{id}:students`)
     → hasil: RESERVED (dapat kursi) / QUEUED (waitlist) / REJECTED (kuota habis/limite)
3) Enqueue job BullMQ `krs.enroll` {tenantId,studentId,classId,semesterId,opId} — payload ringan.
4) Respons CEPAT ke klien: "Diproses" + `opId`; UI polling/WebSocket status akhir.
5) Worker `krs.enroll` (concurrency dibatasi, mis. 10–20):
     BEGIN TX + SET LOCAL tenant
     → advisory lock per kelas (pg_advisory_xact_lock(classId))  ← serialize HANYA utk kelas itu
     → INSERT enrollments(status=EFFECTIVE) + UPDATE enrolled_count
     → INSERT audit + outbox (TX sama)  → COMMIT
     → idempoten via opId (idempotency_keys) → gagal? requeue/retry/backoff → DLQ + notifikasi + RELEASE seat Redis rollback.
6) Pada kegagalan final: kembalikan seat di Redis + beri tahu mahasiswa.
```
**Kunci anti-row-lock:** seats dipegang Redis (decrement O(1) tanpa lock baris), DB hanya menulis **hasil akhir** satu per satu lewat worker dengan **advisory lock per kelas** (bukan `SELECT ... FOR UPDATE` lintas-antrian) dan **idempotensi** agar retry aman.

### 10.2 Presensi massal (banyak kelas dibuka serentak)
- Token sesi presensi + hitungan **ditahan di Redis** (TTL window); scan mahasiswa memvalidasi geofencing/TTL di edge/cache.
- Penulisan `attendances` **di-batch** oleh worker (`attendance.flush` tiap N detik atau tiap M baris) → INSERT multi-row sekali jalan, bukan 1 transaksi/scan.
- Rate-limit per kelas di Redis mencegah spam scan; idempoten per (studentId,sessionId) agar scan ganda tak membuat baris ganda.

### 10.3 Konfigurasi queue (BullMQ) — ringkas
```ts
// queue: krs.enroll  — prioritas tinggi saat OW
queue.add('enroll', data, {
  jobId: opId,                 // idempotensi
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 500 },
  removeOnComplete: 10_000,
  removeOnFail: false,         // simpan utk retriase + DLQ
});
worker = new Worker('krs.enroll', processor, {
  connection: redis,
  concurrency: 15,             // ≤ kapasitas commit Primary utk kelas-hot
  limiter: { max: 300, duration: 1000 }, // global rate (txn/s)
});
```
- **DLQ + alert**: job gagal → Sentry + notifikasi operator; **reconcile job** periodik memastikan `enrolled_count` DB == jumlah enrollment `EFFECTIVE` (proyeksi konsisten, PRD §2 "kelas hantu").
- **Graceful drain**: saat scale-down, worker selesai-kan job aktif sebelum mati (SIGTERM → `worker.close()`).
- Observability: metrik `queue.wait_time`, `queue.depth`, `seat_contention`, `db_txn_p95` di Grafana; ambang → trigger HPA worker.

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 11. Arsitektur Enterprise 47 Modul: Single Source of Truth & Real-Time (dikunci 2026-10-20)

### 11.1 Prinsip Mengikat

1. **Single Source of Truth (SSOT).** Setiap entitas punya **satu modul pemilik** (tabel §11.3). Modul lain hanya membaca (query read-only/read-model) atau bereaksi terhadap event; **dilarang** menulis langsung ke tabel modul lain dan **dilarang** menyalin data master sebagai input manual (zero re-entry).
2. **Event-driven.** Setiap perubahan state bisnis yang relevan lintas modul ditulis bersama baris `outbox` dalam **transaksi yang sama** (ADR-7). Tidak ada "dual write" ke queue.
3. **Parameterisasi penuh.** Aturan operasional dibaca dari `system_parameters`/`lookup_values` (DATA_MODEL §15.1–15.2) melalui *Rule Parameter Resolver* (cache Redis, invalidasi via event `parameter.versioned`).
4. **Engine lokal.** Seluruh algoritma/AI berjalan di proses `api`/`worker`/WASM klien (§11.4). Tidak ada dependensi API AI/cloud berbayar. Integrasi eksternal non-AI (PDDikti, SISTER, payment VA, pesan, TTE) tetap memakai kredensial resmi tenant ([INTEGRATIONS.md §5](file:///c:/SICA/docs/INTEGRATIONS.md)).
5. **Modular monolith tetap (ADR-1).** 47 modul = 47 folder modul di `apps/web/src/modules/<entitlement>/<modul>` + konsumen di `apps/worker`; batas ditegakkan lint import (`no-restricted-imports` lintas modul kecuali `contracts`).

### 11.2 Topologi Real-Time

```
[UI Web/Mobile] --REST--> [api (Next.js route handlers)] --tx--> PostgreSQL (data + outbox)
                                                                    |
                                       [outbox-relay (worker, LISTEN/NOTIFY + polling 1s)]
                                                                    |
                                     Redis Streams `sica:events:<tenant>` (consumer group per modul)
                                     |                       |                          |
                         [konsumen modul (BullMQ)]  [read-model IKU/LKPS/Feeder]  [realtime-gateway (Node ws, stateful)]
                                                                                        |
                                                              WebSocket `wss://<host>/realtime` → UI (invalidate & refetch)
```

| Aspek | Keputusan |
|---|---|
| Transport UI | WebSocket di layanan **`apps/realtime`** (Node, `ws`) karena route handler serverless/Vercel tidak memegang koneksi panjang; fallback SSE `/api/v1/realtime/sse` |
| Autentikasi WS | JWT RS256 akses (sama dengan REST) di pesan pertama `auth`; re-auth saat token dirotasi; koneksi ditutup saat sesi dicabut (Redis revocation) |
| Topik | `tenant:{tid}:{entitlement}` (modul), `tenant:{tid}:user:{uid}` (personal), `tenant:{tid}:class:{classId}` (kelas), `tenant:{tid}:session:{attendanceSessionId}` (QR proyektor) |
| Otorisasi topik | gateway memeriksa izin READ efektif + scope saat `subscribe`; event difilter ulang per penerima (tidak mengirim PII) |
| Payload | **invalidation-only**: `{eventId, type, version, tenantId, aggregate, aggregateId, aggregateSeq, occurredAt, changed:[field]}` — klien me-refetch lewat REST (izin & masking tetap ditegakkan REST) |
| Urutan | per agregat via `aggregateSeq` monoton; klien mengabaikan seq ≤ terakhir |
| Dedupe | konsumen menyimpan `processed_events(consumer, event_id)` (UNIQUE) — at-least-once + idempoten |
| Retry & DLQ | backoff eksponensial (maks parameter `events.retry_max`, default 10) → `dead_letter_events`; dasbor M-05/M-04 menampilkan DLQ; replay manual ber-audit |
| Replay | konsumen baru/pulih membaca ulang dari `outbox` berdasarkan cursor; read-model dapat dibangun ulang penuh (rekalkulasi harian M-32/M-31) |
| Rekonsiliasi | job harian membandingkan read-model vs sumber (hash agregat); selisih → alert + rebuild |
| Kapasitas | gateway horizontal (sticky tidak wajib; fan-out via Redis pub/sub); target 1.000+ koneksi/instans (§9) |
| QR presensi 5 s | token TOTP dihitung **di klien proyektor** dari secret sesi yang diambil sekali via REST; WS hanya untuk status sesi & daftar hadir live — tidak ada push tiap 5 s dari server |

Contoh propagasi: Dosen membuka presensi (M-18) → `attendance.session.opened` → topik `class:{id}` → kartu Presensi di dashboard mahasiswa kelas itu berubah menjadi "Check-in tersedia" tanpa reload; Pustakawan memberi bebas pustaka (M-39) → `library.clearance.granted` → DFA M-30 bertransisi → BAAK melihat mahasiswa pindah ke "Layak Yudisium" & mahasiswa menerima notifikasi.


### 11.3 Batas Modul (Bounded Context), Kepemilikan Data & Event

| Kode | Modul | Entitlement | Tabel milik modul (hanya modul ini yang menulis) | Event dipublikasikan | Event dikonsumsi |
|---|---|---|---|---|---|
| M-01 | SaaS Foundation | `platform_saas` | `tenants`, `tenant_subscriptions`, `sla_policies`, `sla_measurements`, `tenant_shard_map` | `tenant.provisioned`, `tenant.suspended`, `sla.breached` | `*.audit.appended` |
| M-02 | Master Parameter | `identity` | `lookup_categories`, `lookup_values`, `system_parameters`, `parameter_definitions`, `eav_attributes`, `eav_values`, `nim_sequences` | `parameter.versioned`, `lookup.changed`, `nim.generated`, `academic.student.activated`, `academic.student.status_changed` | `pmb.registration.completed`, `finance.invoice.paid` |
| M-03 | Hak Akses & RBAC | `identity` | `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `parameter_restrictions`, `rls_policy_map`, `access_change_requests` | `rbac.assignment.changed`, `rbac.role.changed` | `hr.employee.terminated`, `academic.student.status_changed` |
| M-04 | IT Helpdesk | `helpdesk` | `helpdesk_tickets`, `helpdesk_ticket_events`, `helpdesk_sla_rules` | `helpdesk.ticket.created`, `helpdesk.ticket.escalated`, `helpdesk.sla.breached` | `sla.breached`, `security.violation.detected` |
| M-05 | Keamanan & Audit | `audit` | `audit_logs`, `audit_anchors`, `pii_masking_rules`, `security_violations`, `data_subject_requests` | `security.violation.detected`, `audit.chain.broken`, `pdp.dsr.due` | `*.* (semua event domain via outbox)` |
| M-06 | HRIS & Payroll | `hr_bkd` | `employees`, `leave_requests`, `employee_attendance`, `kpi_scorecards`, `payroll_runs`, `payroll_lines`, `tax_brackets`, `ptkp_rates` | `hr.employee.hired`, `hr.employee.terminated`, `hr.payroll.locked`, `hr.leave.approved` | `bkd.report.approved`, `attendance.lecturer.session_closed` |
| M-07 | BKD Dosen | `hr_bkd` | `bkd_periods`, `bkd_activities`, `bkd_assessments`, `ewmp_rubrics` | `bkd.activity.recorded`, `bkd.report.approved` | `attendance.lecturer.session_closed`, `lppm.output.validated`, `journal.article.published`, `ipr.granted`, `thesis.supervision.logged` |
| M-08 | SISTER Sync | `hr_bkd` | `sister_mappings`, `sister_sync_items`, `sister_sync_runs` | `sister.item.pushed`, `sister.item.failed` | `bkd.report.approved`, `lppm.output.validated`, `hr.employee.hired` |
| M-09 | PMB & OCR | `pmb` | `pmb_periods`, `pmb_tracks`, `form_schemas`, `pmb_applicants`, `pmb_documents`, `cbt_question_banks`, `cbt_questions`, `cbt_sessions`, `pmb_selection_results` | `pmb.applicant.submitted`, `pmb.selection.decided`, `pmb.registration.completed` | `crm.lead.converted`, `finance.invoice.paid` |
| M-10 | Keuangan & Billing | `finance` | `fee_components`, `tariff_rules`, `invoices`, `invoice_lines`, `payments`, `finance_journals`, `finance_journal_lines`, `budget_lines`, `financial_holds` | `finance.invoice.issued`, `finance.invoice.paid`, `finance.hold.changed`, `finance.journal.posted`, `finance.budget.committed` | `pmb.selection.decided`, `enrollment.krs.approved`, `scholarship.award.approved`, `procurement.po.approved`, `lppm.disbursement.approved`, `hr.payroll.locked`, `endowment.yield.posted` |
| M-11 | KIP-K & Beasiswa | `scholarship` | `scholarship_programs`, `scholarship_applications`, `scholarship_awards`, `scholarship_monitoring`, `allowance_disbursements` | `scholarship.award.approved`, `scholarship.award.frozen` | `grading.khs.published`, `endowment.allocation.approved` |
| M-12 | Kurikulum OBE | `academic` | `curricula`, `graduate_profiles`, `plos`, `courses`, `course_prerequisites`, `clos`, `clo_plo_maps`, `rps_documents`, `obe_rubrics`, `plo_attainments`, `rpl_conversions` | `curriculum.locked`, `rps.approved`, `obe.plo.computed`, `rpl.conversion.approved` | `grading.khs.published` |
| M-13 | KRS Online & Perwalian | `enrollment` | `advising_sessions`, `advising_logs`, `krs_headers`, `krs_items`, `krs_war_windows`, `sks_limit_rules` | `enrollment.seat.reserved`, `enrollment.krs.submitted`, `enrollment.krs.approved`, `enrollment.krs.rejected` | `finance.hold.changed`, `academic.student.activated`, `schedule.published` |
| M-14 | Jadwal & Ruang | `scheduling` | `rooms`, `time_slots`, `schedule_constraints`, `schedule_runs`, `class_meetings`, `room_bookings` | `schedule.published`, `schedule.meeting.changed` | `enrollment.krs.approved`, `emergency.room.locked_out` |
| M-15 | Moda Perkuliahan | `teaching` | `learning_modes`, `lecture_sessions`, `online_meetings`, `shift_allocations`, `reconciliation_rules` | `teaching.session.mode_changed`, `teaching.session.closed` | `schedule.published` |
| M-16 | LMS Digital | `lms` | `lms_courses`, `lms_materials`, `lms_progress`, `xapi_statements`, `lms_assignments`, `lms_submissions`, `lms_quizzes`, `lms_discussions`, `search_index_terms` | `lms.progress.updated`, `lms.submission.graded`, `lms.quiz.completed` | `enrollment.krs.approved`, `teaching.session.closed` |
| M-17 | Ujian & Proctoring | `cbt` | `exams`, `exam_attempts`, `proctoring_profiles`, `proctoring_flags`, `biometric_consents` | `cbt.attempt.flagged`, `cbt.attempt.submitted` | `finance.hold.changed` |
| M-18 | Presensi Smart | `attendance` | `geofences`, `attendance_sessions`, `attendance_records`, `attendance_corrections`, `lecturer_attendance` | `attendance.session.opened`, `attendance.recorded`, `attendance.lecturer.session_closed` | `teaching.session.mode_changed`, `teaching.session.closed` |
| M-19 | Nilai & KHS | `assessment` | `grade_scales`, `grade_scale_items`, `grade_components`, `grade_formulas`, `grade_values`, `final_grades`, `khs`, `grade_change_requests` | `grading.final.locked`, `grading.khs.published`, `grading.transcript.updated` | `lms.submission.graded`, `lms.quiz.completed`, `attendance.recorded`, `fieldwork.score.submitted`, `mbkm.conversion.approved`, `rpl.conversion.approved` |
| M-20 | Tugas Akhir & RAMA | `thesis` | `theses`, `thesis_supervisors`, `thesis_logbooks`, `thesis_defenses`, `thesis_examiners`, `thesis_scores`, `repository_items` | `thesis.supervision.logged`, `thesis.defense.scored`, `thesis.repository.published` | `grading.khs.published` |
| M-21 | Jurnal & OJS | `journal` | `journals`, `journal_articles`, `article_authors`, `apc_invoices` | `journal.article.published` | `finance.invoice.paid` |
| M-22 | Inkubator & HAKI | `ipr_incubator` | `ipr_filings`, `ipr_inventors`, `startups`, `startup_milestones`, `seed_fundings` | `ipr.granted`, `incubator.milestone.achieved` | `lppm.output.validated` |
| M-23 | Wisuda & Toga | `graduation` | `convocations`, `convocation_registrants`, `convocation_seats`, `gown_inventory`, `stage_call_logs` | `graduation.registered`, `graduation.stage_called` | `yudisium.batch.approved`, `pin.reserved` |
| M-24 | Kemahasiswaan & SKKM | `student_affairs` | `skkm_rules`, `skkm_claims`, `achievements`, `student_organizations` | `skkm.claim.approved`, `achievement.recorded` | — |
| M-25 | KKN, PKL & Magang | `fieldwork` | `fieldwork_programs`, `fieldwork_sites`, `fieldwork_groups`, `fieldwork_members`, `fieldwork_logbooks`, `fieldwork_scores`, `partners` | `fieldwork.logbook.verified`, `fieldwork.score.submitted` | `enrollment.krs.approved` |
| M-26 | Simulasi Lulus | `academic` | `graduation_simulations` | — | `grading.khs.published`, `curriculum.locked` |
| M-27 | Tracer Study | `tracer_iku` | `tracer_surveys`, `tracer_responses`, `alumni_profiles`, `blast_jobs` | `tracer.response.submitted` | `yudisium.batch.approved`, `pin.reserved` |
| M-28 | Career Center | `career` | `employers`, `job_vacancies`, `job_applications`, `career_fairs` | `career.hired` | `tracer.response.submitted` |
| M-29 | KUI & Mobilitas | `international` | `mobility_programs`, `mobility_participants`, `immigration_documents`, `credit_conversion_factors`, `credit_conversions` | `intl.conversion.approved`, `intl.visa.expiring` | — |
| M-30 | Yudisium & SKPI | `graduation` | `clearance_rules`, `clearance_states`, `yudisium_batches`, `yudisium_members`, `skpi_documents` | `yudisium.clearance.changed`, `yudisium.batch.approved` | `finance.hold.changed`, `library.clearance.granted`, `skkm.claim.approved`, `thesis.repository.published`, `grading.transcript.updated` |
| M-31 | Akreditasi LKPS | `accreditation` | `lkps_templates`, `lkps_snapshots`, `led_documents`, `ratio_checks` | `accreditation.snapshot.frozen` | `*.read_model.refreshed` |
| M-32 | Dashboard IKU | `tracer_iku` | `iku_definitions`, `iku_counters`, `iku_targets`, `iku_alerts` | `iku.threshold.breached` | `tracer.response.submitted`, `career.hired`, `mbkm.conversion.approved`, `lppm.output.validated`, `ipr.granted`, `intl.conversion.approved`, `achievement.recorded`, `hr.employee.hired` |
| M-33 | Jadwal Darurat | `scheduling` | `incidents`, `room_lockouts`, `reroute_plans` | `emergency.room.locked_out`, `emergency.reroute.applied` | — |
| M-34 | Feeder PDDikti | `feeder_pddikti` | `feeder_staging`, `feeder_rules`, `feeder_sync_jobs`, `feeder_corrections` | `feeder.item.synced`, `feeder.item.failed` | `academic.student.activated`, `enrollment.krs.approved`, `grading.khs.published`, `attendance.lecturer.session_closed`, `yudisium.batch.approved`, `teaching.session.mode_changed` |
| M-35 | PIN & SIVIL | `graduation` | `pin_quotas`, `pin_reservations`, `diplomas`, `signing_keys` | `pin.reserved`, `diploma.issued`, `diploma.revoked` | `yudisium.batch.approved` |
| M-36 | Portal PPKS | `ppks` | `ppks_reports`, `ppks_cases`, `ppks_case_events`, `ppks_ministry_reports` | `ppks.case.opened` | — |
| M-37 | SPMI & Quality | `spmi` | `quality_standards`, `ami_cycles`, `ami_assignments`, `ami_checklists`, `ami_findings`, `ami_corrective_actions` | `spmi.finding.opened`, `spmi.finding.closed` | — |
| M-38 | Kampus Merdeka / MBKM | `mbkm` | `mbkm_programs`, `mbkm_participants`, `mbkm_logbooks`, `mbkm_conversions` | `mbkm.conversion.approved` | `fieldwork.score.submitted` |
| M-39 | e-Library | `library` | `library_items`, `library_copies`, `library_loans`, `library_fines`, `library_clearances` | `library.clearance.granted`, `library.loan.overdue` | `thesis.repository.published` |
| M-40 | Aset & Inventaris | `assets` | `asset_categories`, `assets`, `asset_depreciations`, `asset_movements` | `asset.registered`, `asset.depreciated` | `procurement.goods.received` |
| M-41 | Klinik Kampus | `clinic` | `clinic_patients`, `medical_records`, `clinic_queue`, `counseling_bookings` | `clinic.queue.called` | — |
| M-42 | Asrama & Kantin | `dormitory` | `dorm_rooms`, `dorm_allocations`, `shuttle_routes`, `wallet_accounts`, `wallet_ledger` | `dorm.allocated`, `wallet.reconciled` | `finance.invoice.paid` |
| M-43 | Humas & Event | `events` | `events`, `event_registrations`, `event_checkins`, `signage_schedules` | `event.checked_in` | `emergency.room.locked_out` |
| M-44 | SIM-LPPM / LITABMAS | `litabmas` | `grant_schemes`, `grant_proposals`, `grant_proposal_members`, `grant_reviews`, `grant_contracts`, `grant_disbursements`, `research_outputs` | `lppm.proposal.funded`, `lppm.disbursement.approved`, `lppm.disbursement.paid`, `lppm.output.validated` | `endowment.allocation.approved`, `ipr.granted`, `journal.article.published` |
| M-45 | CRM PMB & Marketing | `crm_marketing` | `crm_leads`, `crm_lead_activities`, `crm_funnel_rules`, `crm_campaigns`, `crm_events`, `crm_agents`, `crm_commission_rules`, `crm_commissions` | `crm.lead.created`, `crm.lead.converted`, `crm.commission.approved` | `pmb.registration.completed`, `finance.invoice.paid` |
| M-46 | E-Procurement PBJ | `procurement` | `procurement_requests`, `procurement_items`, `vendors`, `rfq_bids`, `procurement_approvals`, `procurement_contracts`, `goods_receipts` | `procurement.request.submitted`, `procurement.po.approved`, `procurement.goods.received` | `finance.budget.committed` |
| M-47 | Endowment Fund | `endowment` | `donors`, `donor_campaigns`, `donations`, `fund_instruments`, `fund_yields`, `fund_allocation_rules`, `fund_allocations` | `endowment.yield.posted`, `endowment.allocation.approved` | — |
| APP | SuperApp Mobile | `mobile_superapp` | `devices`, `sync_cursors`, `push_tokens` | `mobile.device.bound` | `attendance.session.opened`, `enrollment.krs.approved`, `grading.khs.published`, `finance.invoice.issued`, `thesis.supervision.logged` |

### 11.4 Registri Engine Algoritma Lokal (Zero Paid API Key)

| Kode | Engine | Kompleksitas | Perilaku & jaminan determinisme |
|---|---|---|---|
| M-01 | Consistent Hashing (ring 256 virtual node) untuk penempatan tenant ke shard/pool koneksi + Redis keyspace | O(log N) lookup | Hash SHA-256 tenant_id -> posisi ring; penambahan node hanya memindahkan ±1/N tenant. |
| M-02 | Rule Parameter Resolver (hierarki TENANT→ORG→PROGRAM→PERIOD, effective-dated) + NIM Pattern Compiler (tokenizer {kodeFak}{tahun}{seq}) | O(depth) resolve, O(1) cache hit | Nilai paling spesifik & berlaku menang; sequence NIM via advisory lock per (tenant, pola, tahun). |
| M-03 | Bitwise Permission Masking (10-bit action mask per resource; 64-bit word per 6 resource) | O(1) cek izin | mask = OR(role_permissions); izin = (mask >> bit) & 1; disimpan sebagai bigint + di-cache Redis. |
| M-04 | Priority Queue (binary heap) dengan skor = bobot_prioritas × sisa_SLA + Escalation Timer (timing wheel) | O(log N) enqueue/dequeue | Tiket melewati ambang SLA otomatis naik tier 1→2→3. |
| M-05 | Merkle Tree SHA-256 + Hash Chaining (hash_n = SHA256(hash_{n-1} \|\| canonical_json(row))) | O(1) append, O(log N) inclusion proof | Root Merkle harian di-anchor ke tabel audit_anchors (dan opsional publikasi ber-tanda tangan). |
| M-06 | PPh 21 Dynamic Bracket Calculator: TER bulanan (kategori A/B/C dari PTKP) + tarif progresif Ps.17 untuk masa Desember | O(k) per pegawai, k = jumlah bracket | Seluruh bracket, PTKP, dan kategori TER adalah data berversi (effective_from) — bukan konstanta. |
| M-07 | Interval Tree Overlap Detection pada (start_at, end_at) seluruh kegiatan tridharma + jadwal mengajar | O(log N + k) query, O(N log N) build | Menolak klaim ganda waktu yang sama lintas pendidikan/penelitian/abdimas; rentang SKS wajib & maksimal dari parameter. |
| M-08 | Delta Hash Sync: hash SHA-256 per record kanonik vs last_pushed_hash; hanya delta yang di-push | O(N) scan, O(Δ) push | Idempoten via external_ref; konflik → antrean review. |
| M-09 | Local Tesseract OCR (tesseract.js WASM / tesseract-ocr worker, traineddata ind+eng dibundel) + Levenshtein Fuzzy Matching terhadap data isian | O(m·n) per pasangan string | Field hasil OCR dibandingkan dengan isian; similarity < ambang → verifikasi manual. Tanpa layanan cloud. |
| M-10 | Multi-Variable Billing Matrix: tarif = f(prodi, angkatan, jalur, kelompok UKT, semester, status RPL, beasiswa) via lookup tensor berversi + diskon berlapis | O(d) dimensi | Setiap baris tagihan menyimpan rule_version & jejak kalkulasi; ledger append-only, koreksi via reversal. |
| M-11 | Weighted Sum + AHP Economic Scorer: bobot kriteria (penghasilan, tanggungan, DTKS, aset, jarak) dari matriks perbandingan berpasangan; consistency ratio < 0.1 wajib | O(n³) eigen kecil, O(n) skor | Matriks AHP disimpan per periode; skor dapat dijelaskan per kriteria. |
| M-12 | DAG Topological Sort (Kahn) atas prasyarat mata kuliah + CPL Attainment Matrix (CPMK→CPL berbobot) | O(V+E) | Siklus prasyarat ditolak saat simpan; capaian CPL = Σ(nilai CPMK × bobot) per mahasiswa/angkatan. |
| M-13 | Redis Redlock + Lua atomic seat decrement (DECR jika >0) dengan token antrean FIFO | O(1) per reservasi | Kursi dipesan di Redis lalu dikonfirmasi ke PostgreSQL (advisory lock per class); rekonsiliasi terjadwal Redis↔DB. |
| M-14 | CSP Solver: AC-3 arc consistency + backtracking MRV/LCV + local search (min-conflicts) untuk constraint lunak | AC-3 O(e·d³) | Constraint keras: dosen/ruang/kelas tidak bentrok, kapasitas, jenis ruang; lunak: preferensi dosen, jeda. |
| M-15 | Hybrid Reconciliation Matrix: tabel keputusan (mode × bukti luring × bukti daring) → status hadir + feeder tag F/O/M | O(1) per mahasiswa-sesi | Aturan matriks adalah data (lookup + rule rows), bukan if-else. |
| M-16 | TF-IDF Local Vector Search (indeks invers + cosine) atas materi/diskusi; xAPI LRS lokal | O(q·postings) | Indeks dibangun worker; tidak ada embedding cloud. |
| M-17 | Local OpenCV / MediaPipe Face Mesh WASM di perangkat: deteksi wajah hadir, multi-wajah, arah pandang; hanya metadata flag yang dikirim (tanpa unggah video default) | O(frame) | Template wajah tidak disimpan di server; alternatif non-biometrik (pengawas manusia) wajib tersedia bila tidak memberi persetujuan. |
| M-18 | HMAC-SHA256 TOTP (step 5 s, toleransi ±1 step) + Haversine distance ≤ radius geofence (default 30 m) + cek akurasi GPS | O(1) | Token = HMAC(secret_sesi, floor(t/step)); replay dicegah via (session, student) unik + nonce. |
| M-19 | AST Math Evaluator: formula nilai akhir di-parse ke AST whitelist (+ − × ÷, min, max, round, if) — tanpa eval() | O(n) node | Formula & bobot berversi per kelas; hasil menyimpan formula_version dan jejak. |
| M-20 | Winnowing fingerprint (k-gram, window w) + Jaccard similarity terhadap korpus lokal tenant; OAI-PMH 2.0 XML serializer (oai_dc) | O(n) fingerprint, O(F) pembandingan via indeks hash | Ambang similarity berparameter; laporan menunjukkan segmen cocok. |
| M-21 | OAI-PMH Harvester inkremental (resumptionToken, from/until) dari OJS self-hosted + dedupe DOI | O(n) | Status SINTA/ARJUNA diperbarui via impor berkas/adapter, bukan scraping. |
| M-22 | State machine pendaftaran HAKI + agregator IKU 5 (dedupe per luaran-dosen) | O(1) transisi | Integrasi DJKI berupa pencatatan nomor permohonan/sertifikat (unggah bukti), tanpa API berbayar. |
| M-23 | Hungarian Algorithm (Kuhn-Munkres) untuk penugasan kursi berdasarkan biaya (urutan prodi, prestasi, aksesibilitas) | O(n³) | Untuk n besar dipecah per blok fakultas; urutan panggil panggung = urutan kursi. |
| M-24 | SKKM Rule Scorer: poin = bobot(jenis) × bobot(tingkat) × bobot(peran) dari tabel aturan berversi; dedupe sertifikat via SHA-256 berkas | O(1) per klaim | Prestasi terverifikasi otomatis masuk draf SKPI (M-30). |
| M-25 | K-Means spatial clustering (koordinat domisili/lokasi, k = jumlah lokasi) + balancing kapasitas + aturan heterogenitas prodi | O(n·k·i) | Logbook harian divalidasi Haversine terhadap geofence lokasi. |
| M-26 | Critical Path Method di atas DAG prasyarat × ketersediaan penawaran semester (ganjil/genap) | O(V+E) | Hasil: semester lulus tercepat, mata kuliah kritis, sisa SKS; read-only (tidak mengubah KRS). |
| M-27 | Survey longitudinal (gelombang 1/3/5 tahun) + alignment chart bidang kerja vs prodi (cosine similarity kode KBLI/KBJI) | O(n) | Blaster memakai gateway pesan tenant (INTEGRATIONS) dengan throttle; bukan AI. |
| M-28 | Bipartite graph matching (Hopcroft-Karp) kandidat↔lowongan dengan bobot skor skill (Jaccard tag kompetensi) | O(E√V) | Rekomendasi, bukan keputusan; kandidat mengontrol visibilitas profil. |
| M-29 | ECTS Conversion Matrix: SKS = kredit_asal × faktor(sistem asal) dari tabel faktor berversi (default 1 ECTS ≈ 25–30 jam; 1 SKS ≈ 45 jam/170 menit/minggu) + alert kedaluwarsa visa | O(1) | Faktor diatur admin; tidak hardcoded. |
| M-30 | DFA Clearance Engine: state = himpunan syarat terpenuhi; transisi dipicu event (finance.hold.changed, library.clearance.granted, skkm…, thesis.repository.published); accept state = LAYAK_YUDISIUM | O(1) per event | Definisi state/transisi adalah data (clearance_rules); setiap transisi dicatat. |
| M-31 | 9-Criteria LKPS Extractor: query terdefinisi (data, bukan kode) per tabel LKPS dari read-model; ratio checker (dosen:mahasiswa, dsb) dengan ambang berparameter | O(rows) | Snapshot beku per pengajuan akreditasi untuk jejak audit. |
| M-32 | Incremental IKU Calculator: setiap event domain memperbarui counter numerator/denominator (CQRS read-model) → nilai real-time; rekalkulasi penuh harian untuk rekonsiliasi | O(1) per event | Definisi IKU (filter, numerator, denominator) = data. |
| M-33 | Edmonds-Karp max-flow: source→kelas terdampak→ruang pengganti (kapasitas, jenis, jarak ≤ ambang)→sink | O(V·E²) | Jika flow < kebutuhan → sisa kelas dialihkan daring (M-15) otomatis dengan persetujuan. |
| M-34 | Local Fuzzy String Matcher (Jaro-Winkler + normalisasi) untuk koreksi referensi (wilayah, sekolah, nama ibu) + pre-sync rule engine | O(m·n) | Koreksi otomatis hanya bila skor ≥ ambang & unik; selain itu antre review. |
| M-35 | RSA-PSS / Ed25519 digital signature atas payload e-ijazah + HMAC token QR verifikasi publik (rotasi kunci berversi) | O(1) | Verifikasi publik hanya menampilkan field minimal (nama, prodi, tanggal lulus, status keaslian). |
| M-36 | AES-256-GCM zero-knowledge vault: laporan dienkripsi di klien dengan kunci turunan (X25519 ke kunci publik Satgas + passphrase pelapor); server hanya menyimpan ciphertext | O(n) | Pelapor anonim memantau via kode kasus + passphrase; akses Satgas dicatat audit. |
| M-37 | PPEPP Audit State Machine (Penetapan→Pelaksanaan→Evaluasi→Pengendalian→Peningkatan) dengan guard transisi berbasis bukti | O(1) | Temuan tanpa RTL tidak dapat ditutup; auditor tidak boleh mengaudit unitnya sendiri. |
| M-38 | DAG Credit Conversion: bipartite kegiatan→mata kuliah dengan validasi prasyarat DAG kurikulum & batas SKS | O(V+E) | Adapter MSIB/PMM berupa impor berkas/endpoint resmi bila tersedia; tanpa API AI. |
| M-39 | BM25 local ranker (k1, b berparameter) atas indeks invers katalog MARC21/Dublin Core | O(q·postings) | Adapter SLiMS/KOHA via OAI-PMH/SIP2 self-hosted. |
| M-40 | Straight-Line Depreciation: beban/bulan = (nilai_perolehan − nilai_residu) / (masa_manfaat_bulan); masa manfaat per kategori dari tabel berversi | O(asset) | Posting jurnal bulanan idempoten per (asset, bulan). |
| M-41 | AES-256-GCM envelope encryption per rekam medis (DEK per record, KEK di KMS) + virtual queue (priority queue triase) | O(log N) | Admin IT tidak dapat membaca isi; akses break-glass tercatat. |
| M-42 | 3D Bin Packing (First-Fit Decreasing multi-dimensi: kapasitas, gender, kebutuhan aksesibilitas, preferensi) untuk alokasi kamar + rekonsiliasi saldo e-wallet (ledger ganda) | O(n log n) | E-wallet closed-loop: saldo = Σ ledger; tidak ada saldo mutable. |
| M-43 | Event Registration Scorer (prioritas berbobot: kuota per segmen, waitlist FIFO) + QR HMAC tiket sekali pakai + interval scheduler signage | O(log N) | QR gate offline-capable (verifikasi tanda tangan di perangkat scanner). |
| M-44 | Naive Bayes Proposal Scorer (multinomial, dilatih lokal dari proposal historis tenant) sebagai skor pendamping — keputusan tetap oleh reviewer buta | O(V) per proposal | Fitur TF dari judul/abstrak/RAB; model & versi disimpan, prediksi dapat diaudit; Laplace smoothing. |
| M-45 | Probabilistic Lead Funnel Scorer: logistic regression lokal atas fitur (sumber, sekolah, interaksi, jarak) + transisi Markov antartahap funnel | O(F) per lead | Bobot dilatih ulang terjadwal dari konversi historis tenant; versi model tersimpan; tanpa API eksternal. |
| M-46 | AHP Vendor Evaluator (harga, kualitas, waktu, rekam jejak, TKDN) + validasi HPS (penawaran ≤ HPS, deteksi harga tidak wajar < 80% HPS) | O(n³) kriteria, O(v) vendor | Bobot dari matriks berpasangan berversi; hasil dapat diaudit. |
| M-47 | Compound Investment Yield Engine: A = P(1 + r/n)^{nt}, yield realisasi per instrumen, alokasi hasil via aturan persentase berversi (pokok tidak boleh dibelanjakan) | O(instrumen) | Hanya imbal hasil terealisasi yang dialokasikan ke M-11/M-44. |
| APP | SQLite (Drift) Differential Sync: change-log per tabel dengan cursor (server_seq) + vector clock per record; konflik → server-wins untuk data berwenang, client-wins hanya draf; Local TOTP hardware binding (kunci di Android Keystore/iOS Secure Enclave) | O(Δ) | Check-in presensi offline disimpan bertanda tangan perangkat & dikirim saat online, divalidasi ulang server (TOTP step historis + jendela toleransi). |

### 11.5 Katalog Event Domain (kontrak outbox → queue → WebSocket)

| Event (`<domain>.<entitas>.<kejadian>`, versi `v1`) | Produsen | Konsumen |
|---|---|---|
| `academic.student.activated` | M-02 | M-13, M-34 |
| `academic.student.status_changed` | M-02 | M-03 |
| `accreditation.snapshot.frozen` | M-31 | read-model IKU/LKPS/Feeder + audit |
| `achievement.recorded` | M-24 | M-32 |
| `asset.depreciated` | M-40 | read-model IKU/LKPS/Feeder + audit |
| `asset.registered` | M-40 | read-model IKU/LKPS/Feeder + audit |
| `attendance.lecturer.session_closed` | M-18 | M-06, M-07, M-34 |
| `attendance.recorded` | M-18 | M-19 |
| `attendance.session.opened` | M-18 | APP |
| `audit.chain.broken` | M-05 | read-model IKU/LKPS/Feeder + audit |
| `bkd.activity.recorded` | M-07 | read-model IKU/LKPS/Feeder + audit |
| `bkd.report.approved` | M-07 | M-06, M-08 |
| `career.hired` | M-28 | M-32 |
| `cbt.attempt.flagged` | M-17 | read-model IKU/LKPS/Feeder + audit |
| `cbt.attempt.submitted` | M-17 | read-model IKU/LKPS/Feeder + audit |
| `clinic.queue.called` | M-41 | read-model IKU/LKPS/Feeder + audit |
| `crm.commission.approved` | M-45 | read-model IKU/LKPS/Feeder + audit |
| `crm.lead.converted` | M-45 | M-09 |
| `crm.lead.created` | M-45 | read-model IKU/LKPS/Feeder + audit |
| `curriculum.locked` | M-12 | M-26 |
| `diploma.issued` | M-35 | read-model IKU/LKPS/Feeder + audit |
| `diploma.revoked` | M-35 | read-model IKU/LKPS/Feeder + audit |
| `dorm.allocated` | M-42 | read-model IKU/LKPS/Feeder + audit |
| `emergency.reroute.applied` | M-33 | read-model IKU/LKPS/Feeder + audit |
| `emergency.room.locked_out` | M-33 | M-14, M-43 |
| `endowment.allocation.approved` | M-47 | M-11, M-44 |
| `endowment.yield.posted` | M-47 | M-10 |
| `enrollment.krs.approved` | M-13 | M-10, M-14, M-16, M-25, M-34, APP |
| `enrollment.krs.rejected` | M-13 | read-model IKU/LKPS/Feeder + audit |
| `enrollment.krs.submitted` | M-13 | read-model IKU/LKPS/Feeder + audit |
| `enrollment.seat.reserved` | M-13 | read-model IKU/LKPS/Feeder + audit |
| `event.checked_in` | M-43 | read-model IKU/LKPS/Feeder + audit |
| `feeder.item.failed` | M-34 | read-model IKU/LKPS/Feeder + audit |
| `feeder.item.synced` | M-34 | read-model IKU/LKPS/Feeder + audit |
| `fieldwork.logbook.verified` | M-25 | read-model IKU/LKPS/Feeder + audit |
| `fieldwork.score.submitted` | M-25 | M-19, M-38 |
| `finance.budget.committed` | M-10 | M-46 |
| `finance.hold.changed` | M-10 | M-13, M-17, M-30 |
| `finance.invoice.issued` | M-10 | APP |
| `finance.invoice.paid` | M-10 | M-02, M-09, M-21, M-42, M-45 |
| `finance.journal.posted` | M-10 | read-model IKU/LKPS/Feeder + audit |
| `grading.final.locked` | M-19 | read-model IKU/LKPS/Feeder + audit |
| `grading.khs.published` | M-19 | M-11, M-12, M-20, M-26, M-34, APP |
| `grading.transcript.updated` | M-19 | M-30 |
| `graduation.registered` | M-23 | read-model IKU/LKPS/Feeder + audit |
| `graduation.stage_called` | M-23 | read-model IKU/LKPS/Feeder + audit |
| `helpdesk.sla.breached` | M-04 | read-model IKU/LKPS/Feeder + audit |
| `helpdesk.ticket.created` | M-04 | read-model IKU/LKPS/Feeder + audit |
| `helpdesk.ticket.escalated` | M-04 | read-model IKU/LKPS/Feeder + audit |
| `hr.employee.hired` | M-06 | M-08, M-32 |
| `hr.employee.terminated` | M-06 | M-03 |
| `hr.leave.approved` | M-06 | read-model IKU/LKPS/Feeder + audit |
| `hr.payroll.locked` | M-06 | M-10 |
| `iku.threshold.breached` | M-32 | read-model IKU/LKPS/Feeder + audit |
| `incubator.milestone.achieved` | M-22 | read-model IKU/LKPS/Feeder + audit |
| `intl.conversion.approved` | M-29 | M-32 |
| `intl.visa.expiring` | M-29 | read-model IKU/LKPS/Feeder + audit |
| `ipr.granted` | M-22 | M-07, M-32, M-44 |
| `journal.article.published` | M-21 | M-07, M-44 |
| `library.clearance.granted` | M-39 | M-30 |
| `library.loan.overdue` | M-39 | read-model IKU/LKPS/Feeder + audit |
| `lms.progress.updated` | M-16 | read-model IKU/LKPS/Feeder + audit |
| `lms.quiz.completed` | M-16 | M-19 |
| `lms.submission.graded` | M-16 | M-19 |
| `lookup.changed` | M-02 | read-model IKU/LKPS/Feeder + audit |
| `lppm.disbursement.approved` | M-44 | M-10 |
| `lppm.disbursement.paid` | M-44 | read-model IKU/LKPS/Feeder + audit |
| `lppm.output.validated` | M-44 | M-07, M-08, M-22, M-32 |
| `lppm.proposal.funded` | M-44 | read-model IKU/LKPS/Feeder + audit |
| `mbkm.conversion.approved` | M-38 | M-19, M-32 |
| `mobile.device.bound` | APP | read-model IKU/LKPS/Feeder + audit |
| `nim.generated` | M-02 | read-model IKU/LKPS/Feeder + audit |
| `obe.plo.computed` | M-12 | read-model IKU/LKPS/Feeder + audit |
| `parameter.versioned` | M-02 | read-model IKU/LKPS/Feeder + audit |
| `pdp.dsr.due` | M-05 | read-model IKU/LKPS/Feeder + audit |
| `pin.reserved` | M-35 | M-23, M-27 |
| `pmb.applicant.submitted` | M-09 | read-model IKU/LKPS/Feeder + audit |
| `pmb.registration.completed` | M-09 | M-02, M-45 |
| `pmb.selection.decided` | M-09 | M-10 |
| `ppks.case.opened` | M-36 | read-model IKU/LKPS/Feeder + audit |
| `procurement.goods.received` | M-46 | M-40 |
| `procurement.po.approved` | M-46 | M-10 |
| `procurement.request.submitted` | M-46 | read-model IKU/LKPS/Feeder + audit |
| `rbac.assignment.changed` | M-03 | read-model IKU/LKPS/Feeder + audit |
| `rbac.role.changed` | M-03 | read-model IKU/LKPS/Feeder + audit |
| `rpl.conversion.approved` | M-12 | M-19 |
| `rps.approved` | M-12 | read-model IKU/LKPS/Feeder + audit |
| `schedule.meeting.changed` | M-14 | read-model IKU/LKPS/Feeder + audit |
| `schedule.published` | M-14 | M-13, M-15 |
| `scholarship.award.approved` | M-11 | M-10 |
| `scholarship.award.frozen` | M-11 | read-model IKU/LKPS/Feeder + audit |
| `security.violation.detected` | M-05 | M-04 |
| `sister.item.failed` | M-08 | read-model IKU/LKPS/Feeder + audit |
| `sister.item.pushed` | M-08 | read-model IKU/LKPS/Feeder + audit |
| `skkm.claim.approved` | M-24 | M-30 |
| `sla.breached` | M-01 | M-04 |
| `spmi.finding.closed` | M-37 | read-model IKU/LKPS/Feeder + audit |
| `spmi.finding.opened` | M-37 | read-model IKU/LKPS/Feeder + audit |
| `teaching.session.closed` | M-15 | M-16, M-18 |
| `teaching.session.mode_changed` | M-15 | M-18, M-34 |
| `tenant.provisioned` | M-01 | read-model IKU/LKPS/Feeder + audit |
| `tenant.suspended` | M-01 | read-model IKU/LKPS/Feeder + audit |
| `thesis.defense.scored` | M-20 | read-model IKU/LKPS/Feeder + audit |
| `thesis.repository.published` | M-20 | M-30, M-39 |
| `thesis.supervision.logged` | M-20 | M-07, APP |
| `tracer.response.submitted` | M-27 | M-28, M-32 |
| `wallet.reconciled` | M-42 | read-model IKU/LKPS/Feeder + audit |
| `yudisium.batch.approved` | M-30 | M-23, M-27, M-34, M-35 |
| `yudisium.clearance.changed` | M-30 | read-model IKU/LKPS/Feeder + audit |

### 11.6 Temuan Audit Arsitektur & Resolusinya (2026-10-20)

| ID | Temuan | Resolusi (mengikat) |
|---|---|---|
| ARC-01 | §3 Tech Stack menyebut JWT **EdDSA**, sementara SECURITY_COMPLIANCE, RBAC_MATRIX, dan implementasi memakai **RS256** | Kanonik **RS256** (G-08 ditutup); baris §3 diralat |
| ARC-02 | GUC tenant disebut `app.tenant_id` (ADR-3) vs `app.current_tenant` (AGENTS.md, migrasi) | Kanonik `app.current_tenant`; ADR-3 dibaca sebagai alias (DATA_MODEL §15.4) |
| ARC-03 | §5 menggambarkan `apps/api` NestJS, implementasi memakai route handler Next.js `apps/web/src/app/api/v1` | Kanonik: route handler Next.js + `apps/worker` + `apps/realtime`; NestJS bukan target |
| ARC-04 | Tidak ada topologi WebSocket/kontrak event lintas modul | §11.2 & §11.5 |
| ARC-05 | Katalog modul hanya 19 entitlement | Diperluas ke 47 + APP (§11.3, DATA_MODEL §15.5) |
| ARC-06 | Aturan ENUM/CHECK statis bertentangan dengan kebijakan zero-hardcoding | DATA_MODEL §15.1 menggantikan aturan ENUM §1 |
| ARC-07 | `scripts/validate-roadmap.js` dirujuk `package.json` tetapi berkasnya tidak ada | dicatat sebagai tugas R1.0 (ROADMAP) |

<!-- SICA-47:END enterprise-47 -->
