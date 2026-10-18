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
| Auth primitives | `argon2` (Argon2id) + `jose` (JWT EdDSA) + TOTP/WebAuthn | — | hashing & token standar, tanpa vendor lock |
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
