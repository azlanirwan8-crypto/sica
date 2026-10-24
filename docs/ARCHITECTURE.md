# SICA — Technical Architecture

| | |
|---|---|
| Versi | 0.1 |
| Pola | **Modular monolith** multi-tenant, shared-schema dengan **PostgreSQL Row-Level Security** |
| Bahasa | TypeScript end-to-end (strict), Zod sebagai satu-satunya sumber kontrak |
| Dokumen terkait | [INDEX.md](file:///c:/SICA/docs/INDEX.md) · [PRD.md](file:///c:/SICA/docs/PRD.md) · [DATA_MODEL.md](file:///c:/SICA/docs/DATA_MODEL.md) · [SECURITY_COMPLIANCE.md](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) · [GLOSSARY.md](file:///c:/SICA/docs/GLOSSARY.md) |

**Batas bukti:** ADR, diagram, sizing, engine, dan gerbang di dokumen ini adalah **target desain**, kecuali diberi bukti source spesifik; bukan inventaris deployment atau hasil benchmark. API saat ini berada di Next.js `apps/web/src/app/api/v1`, KRS masih sinkron advisory-lock (`RD-11`/`P-6`), dan `bullmq`/`ioredis`/Tesseract tidak ada di manifest/lockfile. Pembacaan lengkap dokumen tidak membuktikan kesiapan 100% atau kapasitas produksi.

**Sumber kanonik:** arsitektur tetap `ARCHITECTURE.md`, staging/ZDD tetap `DEPLOYMENT_DEVOPS.md`; bukan dokumen baru `ARCHITECTURE_OVERVIEW.md`/`DEPLOYMENT_STAGING_GUIDE.md`. Peta perluasan Phase 1 di §13.9 menunjuk registry PRD, tidak menggandakan katalog FR/RBAC/API.

---

## 1. Keputusan Arsitektur Utama (ADR ringkas)

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
| ADR-14 | **Engine algoritma deterministik zero-API-key** — CPM/DAG, bin-packing, AHP/TOPSIS+Gale-Shapley, RETE, max-flow/min-cut, AST evaluator, ekstraksi dokumen OCR-free-first | Keputusan akademik (kelulusan, alokasi, predikat, nilai, re-jadwal darurat) harus dapat **dijelaskan, direproduksi, dan diaudit** di hadapan auditor/BAN-P.T./Kemendiktisantek. Layanan berbayar berbasis API key menambahkan: nondeterminisme, egress PII ke pihak ketiga (melanggar UU PDP §7 & PP 33/2026), biaya per-panggilan yang tidak terukur saat puncak, dan kegagalan vendor. Seluruh engine di bawah **dirancang** berjalan dari logika internal + data tenant sendiri, bukan diklaim sudah diimplementasikan; pustaka open-source lokal diizinkan selama tidak butuh kredensial dan tidak mengirim data keluar. | Layanan OCR/optimization/completion API (egress + kunci + nondeterminisme); solver komersial berlisensi (lock-in, tak dapat dibundle ke worker); LLM untuk "menebak" field akademik (halusinasi masuk ke record resmi); hardcode aturan per kampus di SQL service (tak terukur, 1 perubahan = 1 release). |
| ADR-15 | **Engine harness tunggal** (`run` → `explain` → `apply`) dengan snapshot, versi, dan idempotensi | Setiap engine menerima: `input_snapshot_hash`, `engine_version`, `parameter_version` (dari `academic_rules`/`tenant_settings`), `Idempotency-Key`, dan budget (`maxNodes`, `maxSeconds`). Keluarannya masuk tabel `*_results` **milik engine sendiri** dan hanya menjadi data resmi setelah aksi `VALIDATE` manusia. Akibatnya: satu run dapat di replay identik, dua klik tidak menghasilkan dua alokasi, dan `denialreason` (FR-ADM-11) punya sumber yang sama dengan keputusan. | Engine menulis langsung ke `enrollments`/`grades`/`classes` (keputusan mesin menjadi record resmi tanpa jejak persetujuan); hasil disimpan sebagai string laporan saja (tak dapat diaudit, tak dapat di-diff); pemanggilan sinkron di request HTTP (timeout saat beban 1.000+ concurrent dan tabrakan dengan ADR-9). |
| ADR-16 | **Ekstraksi dokumen bertingkat, termurah & paling deterministik lebih dulu** (form field → text-layer → OCR lokal → *bukan* tulisan tangan), hasil menjadi **draft** ber-keyakinan, bukan tulisan langsung ke tabel | PDF isian (`AcroForm`/`XFA`) dan PDF ber-layer teks diprioritaskan tanpa OCR, tetapi tetap perlu fixture/validasi format dan biaya komputasi; tidak ada jaminan presisi 100%. OCR hanya dipanggil bila dokumen hasil render citra (gambar). Semua field menempel `method`/`score`/`sourceSpan` dan menunggu konfirmasi manusia; teks hasil baca adalah **data**, tidak pernah perlakuan. | Semua dokumen dilewatkan OCR (lambat, mahal, merusak akurasi field digital); auto-commit hasil ke `enrollments`/transkrip (kesalahan mesin menjadi record resmi); OCR cloud ber-API key (egress NIK/NIM/transkrip); tulisan tangan "dijanjikan" padahal akurasinya di bawah ambang layak. |
| ADR-17 | **Aturan engine disimpan sebagai konfigurasi berversi (JSONB) dengan empat-mata, bukan sebagai kode atau SQL dinamis** | Bobot AHP, aturan RETE, template ekstraksi, tarif biaya re-routing, dan bobot komponen nilai adalah **keputusan kampus per fakultas/angkatan**. Ia harus dapat: diuji unit, di-diff, dipin per angkatan (`effective_from`), di-rollback, dan diaudit siapa menyetujui — seperti pola `academic_rules` yang sudah dipakai. | Hardcode `if (gpa >= 3.5)` di service (1 kampus 1 release); SQL dirakit dari kondisi pengguna (risiko injeksi + tak dapat diuji); aturan tanpa versi (replay historis mustahil dibuktikan). |

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
   │ ────────────────────  │          │ ─ cache/revocation index   │          │ ─ berkas mhs, KHS PDF  │
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
Request → edge → Guard (verifikasi JWT + sesi durable PostgreSQL; Redis hanya cache target,
                    cek status user & tenant aktif, cek window periode)
        → Zod parse (contracts) → Service (aturan domain, BR-* dari DB, bukan kode)
        → BEGIN TX  +  SELECT set_config('app.current_tenant', $1, true)   (satu-satunya GUC; lihat client.ts:46)
        → Repository (SQL Drizzle; RLS mengeksekusi policy di DB)
        → audit_logs + outbox ditulis DI TRANSAKSI YANG SAMA
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
SELECT set_config('app.current_tenant', '<uuid>', true);  -- SET LOCAL ... = $1 tidak valid (SET tak menerima bind parameter)
SET LOCAL app.user_id   = '<uuid>';
-- ... semua statement di transaksi ini melihat hanya data tenant tersebut
COMMIT;
```
- `SET LOCAL` (bukan `SET`): nilai mati bersama transaksi → koneksi yang kembali ke pool tidak membawa sisa tenant. Ini penyebab kebocoran cross-tenant nomor satu di aplikasi pooled.
- Helper `app.tenant_id()` membaca GUC `app.current_tenant` dengan `missing_ok` dan **gagal tertutup**: bila GUC tidak diset → `NULL` → perbandingan `tenant_id = NULL` → `NULL` → policy **tidak** terpenuhi → akses ditolak. Tidak ada default "super".
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
- **Beban Puncak Open Wiring (KRS)**: kode saat ini sinkron advisory-lock per kelas (`krs.service.ts:371`), pengecualian sementara **RD-11/P-6**. Redis token bucket/reservation + worker finalizer adalah target §10, belum terpasang; 150 request kursi terakhir adalah acceptance target, bukan benchmark yang sudah lulus.
- **Eksekusi Job Lintas Tenant**: Background worker memproses antrean per-tenant dengan menyetel `set_config('app.current_tenant', …)` tersendiri. Setiap job berada dalam satu cakupan transaksi mandiri sehingga kegagalan pemrosesan pada satu tenant tidak mengganggu antrean tenant lain.
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
   - Unit test pada pure logic bisnis di `packages/contracts` (skema & turunan) dan `apps/web/src/modules/**/services` (perhitungan, penjaga state) — **`packages/domain` tidak pernah ada di repo ini** (`RD-05`); logika bisnis hari ini hidup di service feature, bukan paket domain terpisah.
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

### 8.1 Alur Kerja Dynamic Auto-Class Splitting (target)
1. Kelas penuh menawarkan waitlist; waitlist bukan kursi fisik tertahan. Penahanan SKS mengikuti parameter/state resmi, bukan penambahan kuota kelas.
2. Threshold berasal dari konfigurasi kampus berversi. Angka lama 15 onsite/30 online hanya ilustrasi, bukan konstanta implementasi. Engine mengusulkan kelas paralel, ruang, dosen/tutor serta budget; **manusia berwenang menyetujui** sebelum apply.
3. Promotion revalidasi kapasitas, SKS, jadwal, entitlement dan fencing secara idempoten. Gunakan status kanonik DATA_MODEL, bukan enum `ENROLLED` baru.
4. Beban dosen/BKD dan kapasitas diagram adalah parameter tervalidasi dengan masa berlaku, bukan batas universal 16 SKS yang di-hardcode atau keputusan penugasan otomatis tanpa approval.

### 8.2 Integrasi Otomatis SIAKAD <-> LMS (target)
- **Roster:** approval KRS memicu outbox untuk provisioning idempoten; jumlah sesi mengikuti kalender/parameter, bukan selalu 16.
- **Nilai:** M-16 mengirim bukti/komponen, M-19 tetap pemilik nilai resmi, validasi dan lock; tidak auto-publish KHS dari sinyal LMS.
- **Presensi Teams/LMS:** M-16 memasok join/leave atau progres ke M-18. Default target join kumulatif **≥75%** memakai `attendance.online_min_join_ratio = 0.75` berversi; bukan ≥80% watch-time, bukan ambang hukum universal dan bukan penyamaan otomatis video completion dengan hadir. Denominator, dedup, degraded evidence dan review mengikuti PRD §5.15. M-18 pemilik vonis presensi; M-15 pemilik moda.
- **Insiden data pribadi:** eskalasi/notifikasi mengikuti SECURITY_COMPLIANCE; bukti vendor dan audit tidak boleh memuat credential.

---

## 9. Topologi Infrastruktur High-Concurrency (Target 1.000+ Concurrent Users)

Skenario target: Open Wiring/KRS dan presensi massal. Redis admission mengurangi kontensi request, **bukan menghapus row/table lock DB**; finalizer tetap serialized. Diagram berikut adalah target, bukan inventaris runtime. App stateless tidak berarti sesi/refresh/audit 100% Redis: sumber durable tetap PostgreSQL.

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
        · topologi belum dipilih    Engine (workers)   Connection Pooler       (S3/R2)
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
| Layer | Teknologi target | Keputusan/budget yang harus dibuktikan | Batas |
|---|---|---|---|
| 1 Edge | CDN/WAF/LB | Allowlist, rate-limit OW, trusted proxy dan readiness | Provider belum bukti deployment |
| 2 App | Next.js; API terpisah opsional | Instance min/max, CPU/RAM, p95/p99 dan headroom dari staging | Stateless tidak berarti sesi durable dipindah ke Redis |
| 3 Redis | Sentinel **atau** Cluster (belum final) | HA terpisah dari sharding; slot Lua §10.3; queue/reservasi noeviction terpisah cache disposable | Atomic command bukan keselamatan failover/DB; tidak ada jaminan tanpa lock DB |
| 4 Queue | BullMQ + worker | Concurrency/rate, backlog age, bounded retry, DLQ, fencing dan recovery | Paket belum terpasang; finalizer at-least-once |
| 5 Pool | PgBouncer atau pooler provider | Pool global dan per-proses sesuai budget Primary, job dan headroom | `max: 20` client bukan ukuran pool server yang sudah terbukti |
| 6 DB | PostgreSQL Primary + replica target | Failover/PITR mengikuti provider, RPO/RTO harus diukur | Mutasi dan read-your-writes hanya Primary; replica untuk baca stale-tolerant |

### 9.2 Anggaran kapasitas (hipotesis yang harus diuji)
- Target 1.000+ concurrent users tidak dapat dikonversi langsung menjadi RPS. NFR-P1 tetap acuan §10.8; klaim lama 2.000–3.000 RPS, 400–600 RPS/pod, atau “24 pod cukup” **bukan hasil ukur dan tidak digunakan sebagai jaminan kapasitas**.
- Tetapkan arrival/burst profile, distribusi kelas/tenant, ukuran basket, p95/p99, accepted/completed rate, umur antrean, recovery dan biaya CPU/RAM/DB/Redis. Lua O(1) untuk operasi terbatas bukan jaminan 10k–100k kapasitas produksi; kerja multi-key/basket juga bertambah sesuai input.
- Admission Redis mengurangi kontensi jalur panas, tetapi receipt durable dan finalisasi tetap membutuhkan DB. Limiter worker, pool global/per-proses, `max_connections`, backfill dan headroom tenant lain harus dituning bersama.
- Redis **Sentinel** adalah HA primary-replica tanpa sharding; **Cluster** membagi hash slot dan melakukan failover per shard. Pilihan masih gerbang desain `P-6`, bukan dua mode aktif sekaligus. Pisahkan cache disposable dari queue/reservasi `noeviction`; AOF/replica tidak menjamin write yang diakui selalu selamat dari failover. Slot Lua, fencing durable dan rekonsiliasi §10 wajib dibuktikan sebelum admission dibuka.

---

## 10. Strategi Antrian Asinkron (BullMQ): KRS War & Presensi Massal

> **STATUS TARGET — RD-11/P-6 tetap terbuka.** Kode `krs.service.ts:371` masih memakai `pg_advisory_xact_lock` sinkron; respons submit saat ini **201 final**, bukan 202. `bullmq`/`ioredis` belum ada di manifest/lockfile. Ambang beban tidak memasang dependensi secara otomatis.
>
> §10 menetapkan arah desain, **belum decision-complete**: pilihan Redis HA/sharding, mekanisme issuance epoch durable, anggaran recovery, serta SLO finalisasi masih perlu keputusan dan bukti implementasi. §10.2 merujuk kode; lease/queue/SSE/batching dan angka anggarannya adalah target, bukan benchmark.

### 10.1 Matriks keputusan penguncian kuota (tiga opsi, dinilai jujur)

Kontensi kelas hanyalah satu masalah; validasi SKS lintas kelas, duplikasi, failover dan commit-unknown juga menentukan correctness.

| Aspek | A — DB sinkron interim | B — Redis sebagai kebenaran | C — Redis reservation + finalis DB (dipilih sebagai target) |
|---|---|---|---|
| Serialisasi | Advisory lock kelas selama transaksi request | Lua pada primary/slot terkait | Lua admission singkat; finalizer terkontrol, serialisasi DB untuk kelas dan batas mahasiswa |
| Correctness | Bergantung transaksi, conditional update, unique/check dan seluruh writer patuh | Ditolak tanpa otoritas/reconciliation DB; atomic command bukan transaksi lintas sistem | Lease + fencing durable, idempotent BullMQ finalizer, DLQ, constraints dan rekonsiliasi DB wajib bersama |
| Kapasitas | Harus diukur terhadap kontensi/pool | O(1) tidak menyatakan throughput jaringan/produksi | Batasi arrival, queue depth/age, worker concurrency, retry, DB pool dan biaya; tidak ada jaminan 10k–100k |
| Redis/DB gagal | DB failure menutup write | Kehilangan state membuat hasil tidak dapat dipercaya | Tutup admission ketika state tidak pasti; accepted op tetap durable; recovery tidak sekadar menunggu TTL |
| Sumber kebenaran | PostgreSQL | Tidak diterima | PostgreSQL; Redis proyeksi dan penahanan sementara |
| Bukti saat ini | Service sinkron ada; bukan bukti lulus beban produksi | Tidak diimplementasikan | Paket/worker/lease belum terpasang (`RD-11`/`P-6`) |

**Putusan:** pertahankan Redis Lua atomic reservations + lease/fencing + idempotent BullMQ finalizer + DLQ + constraints DB. Redlock bukan pengganti transaksi/fencing dan tidak dipilih sebagai penjamin kursi. Lua atomic berarti satu skrip berjalan tanpa interleaving pada server/slot yang sama; tidak berarti distributed linearizability setelah failover, exactly-once delivery, atau atomic commit Redis+DB.

Admission Lua tidak menahan transaksi DB panjang, tetapi **202 hanya setelah receipt operasi/basket/outbox durable commit** (§10.3.5). DB finalizer menegakkan batas kursi dan SKS pada state terbaru. Counter `CHECK` saja tidak membuktikan jumlah baris enrollment cocok: uji count reconciliation, duplikasi dan seluruh writer juga wajib. Target oversell 0 adalah invariant yang diuji, bukan jaminan tanpa syarat. False reject/underbooking mungkin terjadi saat recovery dan harus terlihat, bukan dipoles sebagai sukses.

### 10.2 Opsi A bukan sekadar "pilihan buruk" — dan jebakan PgBouncer di dalamnya

**Kontensi DB:** update baris kelas yang sama terserialisasi sampai transaksi selesai; durasi kritis, jumlah statement, I/O, pool dan workload menentukan tail latency. Angka lama 2–4 ms/250–500 transaksi per detik/6–12 detik antrean bukan benchmark dan tidak dijadikan batas fisik produksi. Finalizer terkontrol mengurangi tekanan arrival, tetapi tetap memerlukan serialisasi dan constraints untuk correctness.

**Bukti source dan batas interpretasinya:** tabel berikut merujuk konfigurasi client/helper, bukan pengukuran pooler hidup. `max: 20` adalah pool client **per proses**, bukan bukti PgBouncer server pool berukuran 20.

| Fakta repo | Lokasi | Konsekuensi untuk `FOR UPDATE` dan `SET LOCAL` |
|---|---|---|
| Client ditujukan untuk transaction pooling, `prepare: false`, `max: 20` | [client.ts](file:///C:/SICA/packages/database/src/client.ts) | Konfigurasi ini tidak membuktikan ukuran/mode pooler hidup. Transaksi panjang menahan koneksi dan lock; larang menunggu user/provider di dalam transaksi |
| GUC di-set lewat `set_config('app.current_tenant', tenantId, true)` **di dalam** `db.transaction` | [client.ts:43-48](file:///C:/SICA/packages/database/src/client.ts#L43) | `is_local = true` berarti nilainya **mati bersama transaksi**. Bila statement berikutnya dikirim pada transaksi yang berbeda (karena pool melepas koneksi, atau karena callback keluar dari `withTenantContext`), GUC-nya hilang |
| Helper RLS membaca GUC dengan `missing_ok` lalu `NULLIF` | [0001_init_rls_policies.sql:13-15](file:///C:/SICA/packages/database/migrations/0001_init_rls_policies.sql#L13) | GUC hilang menghasilkan `NULL`, perbandingan `tenant_id = NULL` bernilai `NULL`, policy tidak terpenuhi, query mengembalikan **0 baris** — gagal tertutup. Ini perilaku yang diinginkan, tetapi gejalanya menipu: pekerja lihat "kelas tidak ditemukan", bukan "GUC tidak ter-set" |
| `SET LOCAL ... = $1` tidak valid ( `SET` tidak menerima bind parameter ) | catatan di [client.ts:44-45](file:///C:/SICA/packages/database/src/client.ts#L44) | Karena itu `set_config()` yang bisa diparameterkan adalah satu-satunya bentuk yang aman di pooled connection; menulis `SET LOCAL` mentah di worker adalah bug, bukan gaya |
| `prepare: false` | [client.ts:18](file:///C:/SICA/packages/database/src/client.ts#L18) | Prepared statement lintas-transaksi tidak dapat diandalkan di transaction mode; setiap statement di-parse ulang. Beban tambahan kecil, tetapi menghilangkan asumsi "koneksi saya mempertahankan state" |

**Aturan turunan (normatif).** (1) Jangan pernah membuka transaksi lalu memanggil I/O eksternal di dalamnya — termasuk publish Redis, kirim notifikasi, atau panggilan PDDikti. (2) Setiap worker job **membuka transaksi baru sendiri** dan memanggil `withTenantContext` dari awal; tidak ada transaksi yang diwariskan antar job. (3) Setelah `COMMIT`, jangan pernah mengulang query dengan asumsi GUC masih ada. (4) Semua jalur tulis wajib menguji "0 baris karena GUC hilang" sebagai kegagalan yang bisa dibedakan dari "0 baris karena data tenant lain" — tes CI-nya sudah dinormakan di `AGENTS §3.8` dan `§4.3` dokumen ini.

**Catatan namespaces advisory lock.** Kode memakai `pg_advisory_xact_lock(hashtext(classId))` ([krs.service.ts:371](file:///C:/SICA/apps/web/src/modules/academic/services/krs.service.ts#L371)). `hashtext()` mengembalikan `int`, jadi ruang kuncinya 2^32; pada 100.000 kelas serentak, taksiran pasangan kelas yang **bertabrakan kunci** sekitar 1 ( collision hanya menambah serialisasi, tidak salah data, karena penjaga sebenarnya adalah `CHECK` dan `WHERE enrolled_count < capacity` ). Nilai `hashtext` **tidak dijamin stabil antar versi mayor PostgreSQL** `[TIDAK-TERVERIFIKASI]` — saat finalis ditulis ulang, pindahkan ke `hashtextextended(classId, 0)` yang ber-ruang 2^64 dan kunci **satu namespace advisory khusus KRS** agar tidak bertabrakan dengan lock fitur lain.

### 10.3 Model lease — spesifikasi kunci Redis dan invariance

**Prinsip:** lease bukan enrollment. State durable juga mencatat queued/processing/terminal dan commit-unknown untuk recovery; hilangnya key tidak membuktikan transaksi DB gagal.

#### 10.3.1 Tata ruang kunci

Target namespace `krs:{<tenantId>:<periodId>}:<kind>:<id>`: kurung kurawal adalah **literal Redis hash tag**, teks dalam `<…>` adalah placeholder. Semua key yang dibaca/ditulis **satu Lua**, termasuk basket banyak kelas, SKS mahasiswa, idempotensi dan jendela OW, harus berada di hash slot sama jika memakai Redis Cluster. Contoh kelas dan SKS untuk tenant/periode sama memakai tag identik, bukan tag per kelas. Client harus menyerahkan key eksplisit; jangan membuat key cross-slot tersembunyi di skrip.

| Suffix setelah hash tag | Tipe / isi target | Retensi / otoritas |
|---|---|---|
| `seats:<classId>` / `held:<classId>` | Integer proyeksi kursi tersedia / lease belum dikonsumsi | Dari epoch yang direkonsiliasi; bukan sumber kebenaran |
| `lease:<classId>:<studentId>` | Hash owner, basketId, opId, epoch, sksHeld, expiresAt, status | TTL usulan 90 s dari parameter berversi; durasi bukan bukti recovery |
| `students:<classId>` / `sks:<studentId>` | Set pemegang / integer SKS tertahan | Sweeper wajib membersihkan; TTL lease tidak menghapus anggota set/counter otomatis |
| `op:<opId>` / `idem:<keyDigest>` | Cache status / opId dan fingerprint scoped | Cache status 15 menit, dedup cache 24 jam; state/receipt/idempotensi durable di DB |
| `owwindow` | opensAt, closesAt, mode, epoch/version | Snapshot parameter; fail-closed bila stale/tidak tersedia |

Tenant/periode yang ramai dapat menjadi **hot slot**. Sharding per kelas saja tidak mempertahankan atomic budget SKS lintas kelas; jika satu tenant terlalu besar, perlu desain partisi/koordinasi baru yang diuji, bukan janji Cluster otomatis menyelesaikan masalah. Namespace BullMQ juga harus mengikuti batas multi-key client terpilih. Hash tag bukan batas izin: semua akses tetap scoped tenant dari sesi.

#### 10.3.2 Aturan klaim (satu skrip Lua, satu putaran)

1. Sebelum mutasi, validasi seluruh key/type, readiness/epoch, jendela OW, owner dari konteks tepercaya, idempotency fingerprint, duplikasi, kursi, SKS dan budget ukuran basket. Tolak tanpa efek bila gagal.
2. Bila valid, satu Lua melakukan decrement/increment, keanggotaan dan **HSET + PEXPIRE** lease hash secara atomik. Jangan membuat lease dengan `SET` string lalu membacanya dengan `HGET`.
3. Lua mencegah interleaving tetapi **runtime error tidak me-rollback write yang sudah terjadi**. Validasi-before-write, batas resource, pengujian fault dan rekonsiliasi diperlukan; jangan mengandalkan “rollback otomatis Lua”. Hasil internal mengikuti kontrak di `API_SPEC`/`packages/contracts`, bukan enum API kedua di sini.
4. Renewal/release memeriksa tenant/student terautentikasi, basket/op, epoch, status dan deadline; nilai owner dari klien saja tidak cukup. Usulan renewal 30 s untuk lease 90 s harus berasal dari satu parameter snapshot, tidak melewati closesAt.
5. Expiry/refund dilakukan idempoten hanya untuk lease dan epoch yang sesuai setelah state DB diketahui. Keyspace notification bersifat best-effort; sweeper/durable ledger harus memulihkan notifikasi yang hilang.

#### 10.3.3 Status keranjang (basket) dan transisinya

`krs_baskets`, `krs_offering_seats`, `queue_operations` sudah memiliki pemilik spesifikasi `DATA_MODEL §16.1`/migrasi rencana **0030**, tetapi berkas migrasinya belum ada. **Target tidak boleh diaktifkan dengan keranjang hanya di Redis.** Registrasi dan retensi state mengikuti DATA_MODEL, bukan TTL cache.

`HELD → CONSUMED / EXPIRED / ABANDONED` adalah lifecycle basket, bukan tambahan enum `enrollments`. Finalisasi `SUBMITTED`, transisi basket dan terminal operation harus commit bersama; persetujuan DPA/EFFECTIVE tetap alur terpisah. Expiry/cancel tidak membuang riwayat durable setelah 15 menit dan tidak boleh mengembalikan kursi yang ternyata sudah commit.

#### 10.3.4 Invariance (wajib diuji, bukan diasumsikan)

| # | Invariant target | Penegak dan bukti |
|---|---|---|
| I-1 | `held + enrolled <= capacity` pada epoch/proyeksi yang sudah direkonsiliasi | Waitlist **bukan** kursi tertahan dan tidak masuk penjumlahan. Redis/DB update tidak atomic lintas sistem; tutup admission saat state tidak pasti, jangan menduplikasi lease consumed |
| I-2 | Jumlah enrollment aktif cocok dengan `enrolled_count`, dan tidak melampaui capacity | Transaksi/serialisasi finalizer, conditional update, DB CHECK, dan rekonsiliasi jumlah baris; CHECK counter saja tidak cukup |
| I-3 | Satu enrollment per tenant/student/class dan satu efek per operasi | `uq_enrollments_student_class`, durable idempotency, epoch/status guard. Conflict insert hanya replay sukses bila identitas/hasil cocok; **tidak** menambah counter lagi |
| I-4 | Budget SKS mahasiswa tetap sah lintas kelas | Snapshot parameter, admission Lua, dan revalidasi/serialisasi student-period di DB; lock kelas saja tidak melindungi dua submit mahasiswa ke kelas berbeda |
| I-5 | Worker lama tidak dapat commit setelah epoch/cancel/expiry berubah | Issuance/high-water epoch durable dan conditional transition dalam transaksi yang menserialisasi row terkait; membandingkan token Redis sekali sebelum transaksi tidak cukup |

Epoch tidak boleh di-reset ketika Redis restart/failover. Desain penerbitan serta high-water mark di DB, urutan lock konsisten, dan handling race expiry-vs-commit harus dipastikan dalam implementasi/DDL 0030; **gate belum ditutup**. False reject saat rekonsiliasi boleh dilaporkan sebagai kegagalan bisnis, bukan accepted enrollment palsu.

#### 10.3.5 Alur penuh satu pengajuan (target)

1. Verifikasi sesi dan tenant → entitlement/release/dependency gate → izin scoped → validasi Zod body/param dan idempotency fingerprint. Entitlement mendahului permission bisnis; permission mendahului parse. Tenant bukan dari header tak tepercaya.
2. Jalankan Lua reservation bounded dengan epoch yang diterbitkan secara durable. Tidak ada transaksi DB terbuka sambil memanggil Redis/provider.
3. Commit receipt `queue_operations` + basket/snapshot/fence + idempotensi + outbox dalam transaksi Primary sebelum **202 Accepted**. Bila commit gagal/unknown, jangan menjawab sukses atau refund buta: lookup receipt dan rekonsiliasi fenced lease. Tidak ada klaim queue-only durable.
4. Relay outbox mengirim job ringan berisi scoped IDs, epoch dan versi payload; gunakan jobId deterministik. Jika enqueue gagal setelah commit, relay/sweeper bounded mengirim ulang. At-least-once enqueue aman karena dedup DB, bukan karena dual-write Redis/DB dianggap atomic.
5. Finalizer membuka transaksi tenant baru, mengambil lock terurut kelas **dan** budget student-period, memeriksa durable epoch/status/expiry, versi, izin/aturan yang masih berlaku, dan kapasitas. Insert enrollment `SUBMITTED`; tambah counter **hanya jika insert baru berhasil**, bukan setiap `ON CONFLICT DO NOTHING`.
6. Commit enrollment/counter, terminal operation, basket consumed, audit_logs dan outbox **bersama**. Sesudah commit, ack/proyeksi Redis idempoten. Worker crash sebelum ack dapat mengulang; hasil durable menentukan jawaban.
7. Business reject/expiry/cancel dicatat durable; kompensasi Lua hanya cocok epoch/op dan dilakukan sekali. Commit-unknown direkonsiliasi terlebih dahulu. Waitlist yang sah dipertahankan, notifikasi melalui outbox.
8. Retry bounded/backoff; bila habis, operasi dan DLQ tetap terlacak dengan alasan tersamarkan, alarm dan replay berizin (§10.4). Tidak ada accepted op hilang saat publish DLQ gagal.

### 10.4 Topologi BullMQ (target)

**Realita yang harus ditulis terang sebelum daftar apa pun:** `bullmq` dan `ioredis` **belum menjadi dependensi repo ini** — diukur dari `package.json` (`apps/web` 17 dependency, `packages/database` hanya `drizzle-orm` + `postgres`), dan dikonfirmasi `TECH_CONVENTIONS §6` baris 1 dengan status "belum boleh dipakai kecuali bersama keputusan `P-6`". `REDIS_URL` memang sudah ada di kontrak environment (`ENV_CONTRACT` baris 184 dan 214) dengan catatan "variabel ada, pemakai belum", dan probe readiness hari ini **hanya mengecek kehadiran variabel itu**, tidak melakukan `PING` ([health/ready/route.ts:28-37](file:///C:/SICA/apps/web/src/app/api/v1/health/ready/route.ts#L28)). Tidak ada satu pun queue yang berjalan. Menginstal paket ini wajib menjadi commit `package.json` + lockfile terpisah (`TECH_CONVENTIONS §6` aturan 1).

#### 10.4.1 Katalog queue

| Queue | Isi job | `concurrency` worker | `limiter` global | `attempts` | backoff | Status akhir bila kalah |
|---|---|---|---|---|---|---|
| `krs.submit` | finalisasi satu pengajuan KRS per kelas terpilih | 15 (naikkan hanya bersama `max_connections` primary) | 300 job / 1000 ms per queue | 3 | eksponensial 500 ms, `jitter: true` | `DEAD` dengan alasan `FINALIZE_EXHAUSTED` |
| `attendance.bulk` | flush sekelompok presensi ke `attendances` | 8 | 60 batch / 1000 ms | 5 | eksponensial 1.000 ms, jitter | `DEAD` dengan alasan `ATTENDANCE_FLUSH_EXHAUSTED` |
| `feeder.push` | kirim satu rekaman ke PDDikti Neo Feeder | 4 | 20 req / 1000 ms (hormati batas vendor) | 4 | eksponensial 5.000 ms, jitter, ceiling 5 menit | `DEAD` + antrean temuan `BLOCK` (NFR-R4) |
| `notify` | kirim satu kanal notifikasi (email atau WA) | 20 | 100 / 1000 ms | 6 | eksponensial 2.000 ms, jitter | `DEAD` + `delivery_status` gagal di tabel pengiriman |
| `krs.reconcile` | berkala: cocokkan `enrolled_count` terhadap jumlah enrollment, re-seed Redis | 1 (singleton per siklus) | tidak perlu | 2 | 10.000 ms | `DEAD` + alarm operator (ini jalur keselamatan terakhir) |

Tabel di atas adalah **anggaran awal**, bukan throughput terukur atau konfigurasi API BullMQ yang siap disalin. Feeder harus mengikuti batas vendor/tenant di INTEGRATIONS (bukan mengandalkan angka 20 req/s ilustratif). Job memakai payload version, deadline dan epoch; deadline diperiksa finalizer terhadap DB, **bukan opsi `token` BullMQ**. Pilih versi paket lalu uji opsi backoff/jitter/retention yang benar-benar didukung.

BullMQ bersifat **at-least-once**: stalled job, lease loss atau worker crash dapat membuat job dieksekusi ulang bahkan tumpang tindih. Lock job/jobId tidak memberikan exactly-once execution. Efek bisnis satu kali harus ditegakkan oleh fencing dan idempotensi transaksi DB, termasuk recovery sesudah commit tetapi sebelum ack.

#### 10.4.2 Idempotensi (tiga lapis, semuanya wajib)

| Lapis | Mekanisme | Status di repo |
|---|---|---|
| Transport | header `Idempotency-Key` + cache Redis `krs:{<tenantId>:<periodId>}:idem:<keyDigest>` sesuai hash tag §10.3.1; `keyDigest` = SHA-256 atas serialisasi kanonik tenant, periode, actor terverifikasi, jenis operasi dan key. Fingerprint request diperiksa terpisah agar key sama dengan body berbeda ditolak; cache jawaban cepat bukan pengganti receipt/idempotensi durable DB | belum ada |
| Persisten | tabel `idempotency_keys` dengan `PRIMARY KEY (tenant_id, key)` dan `request_fingerprint bytea` (SHA-256 atas method + path + body, sehingga replay dengan isi berbeda **ditolak**), kolom `response_status`, `response_body`, `expires_at`, `completed_at` — **dispesifikasi di DATA_MODEL §4** (blok Audit/Outbox/Idempotency, baris 452-460) | spesifikasi ada, **DDL belum di-migrate** (`DATA_MODEL §14.1` mencatatnya sebagai belum ada) |
| Data | `jobId = opId`, `onConflictDoNothing()` pada `enrollments` yang bertumpu pada `uq_enrollments_student_class`, dan guard `enrolled_count < capacity` | `onConflictDoNothing` **sudah berjalan** ([krs.service.ts:384](file:///C:/SICA/apps/web/src/modules/academic/services/krs.service.ts#L384)) |

**Aturan replay.** Job yang dieksekusi ulang karena retry, worker mati, atau klien menekan tombol dua kali **harus** menghasilkan hasil yang identik dan **tidak** menambah `enrolled_count` dua kali. Cara membuktikannya bukan keyakinan: assertion A-4 di §10.8.

#### 10.4.3 DLQ

DLQ adalah pola aplikasi, bukan jaminan BullMQ otomatis memindahkan job. Attempts habis → catat status/reason durable dan outbox untuk `<queue>-dlq`; kegagalan publish harus dapat diulang tanpa kehilangan accepted operation. Metadata queue/job/op/tenant/reason/attempts tersamarkan, bukan payload akademik/credential atau stack trace mentah.

Dashboard **read-only default**; retry/cancel melalui aksi server allowlist, RBAC scoped, MFA/approval sesuai risiko, alasan dan audit. Sebelum replay periksa terminal state, epoch, expiry, entitlement, idempotency fingerprint dan budget retry/batch. Jangan retry-all tanpa dry-run/batas; tidak ada shell/SQL console atau DELETE Redis. Operasi cache hanya namespace tenant, tidak `FLUSHALL`/`FLUSHDB`, dan tidak menghapus lease/queue/sesi sebagai cache biasa (`DEPLOYMENT_DEVOPS §6.1`).

#### 10.4.4 Koneksi database milik worker

- **Mutasi hanya ke Primary.** Worker finalis memakai `withTenantContext` yang membuka `db.transaction` pada pool utama ([client.ts:33-49](file:///C:/SICA/packages/database/src/client.ts#L33)). Worker **tidak boleh** punya jalur tulis ke replica dalam bentuk apa pun.
- **Read-your-writes ke Primary.** Cek kuota SKS sebelum submit, hasil KRS sesaat setelah submit, dan `tenant_modules` pasca-aktivasi wajib ke Primary; staleness budget replica `< 100 ms` normal dan `< 500 ms` saat OW-war (`DATA_MODEL §13.2`). Router `db.$primary()` / `db.$replica()` **belum ada di kode** — `client.ts` hari ini hanya mengekspos satu `sqlClient`.
- **Satu transaksi per job**, GUC di-set di dalamnya, tidak ada transaksi lintas job, tidak ada I/O eksternal di dalam transaksi (§10.2).
- **Advisory lock hanya di finalis:** `pg_advisory_xact_lock` per kelas, bukan `SELECT ... FOR UPDATE` lintas-antrian; ia memisah kelas yang satu dari kelas yang lain sehingga kelas favorit tidak menyeret seluruh tenant.
- **Pool sizing.** Total concurrency seluruh worker + margin harus di bawah `default_pool_size` PgBouncer dan `max_connections` primary. Saat ini `max: 20` per proses aplikasi ([client.ts:15](file:///C:/SICA/packages/database/src/client.ts#L15)) — menambah worker tanpa menaikkan batas itu adalah cara tercepat menyebabkan deadlock pool.

#### 10.4.5 Rekonsiliasi dan drain

- Reconciler membandingkan counter dengan enrollment `SUBMITTED + APPROVED + EFFECTIVE` di **Primary**, bukan hanya EFFECTIVE; submit sekarang sudah menahan kursi sebelum persetujuan. Interval awal satu menit adalah budget target, bukan recovery otomatis yang terbukti.
- Saat selisih/failover terdeteksi, freeze admission domain terkait; fence worker lama dengan high-water epoch durable. Rekonsiliasi receipt/outbox, basket, committed enrollment, active lease dan job in-flight/commit-unknown. Baru bangun proyeksi konsisten pada epoch baru dan buka admission setelah invariant lolos. **Tidak boleh re-seed dari DB sambil mengabaikan lease lama yang masih dapat commit.**
- Sweeper memulihkan expiry, enqueue yang tertunda, kompensasi dan transfer DLQ yang gagal secara idempoten, dengan checkpoint/batch limit. Catat unresolved ops, umur backlog, RPO/RTO terukur, dan batas waktu eskalasi operator; jangan membiarkan retry/recovery tak terbatas.
- `SIGTERM`: readiness off, berhenti mengambil job/request baru, drain bounded sesuai budget job. Worker yang masih sah menjaga lease sampai selesai; saat batas habis, biarkan recovery durable menentukan hasil, **bukan refund buta karena TTL**. SSE reconnect/resync membaca status durable. Prosedur ZDD dan rollback: `DEPLOYMENT_DEVOPS §4.4`.
- Autoscaling mengikuti depth **dan** umur antrean/kapasitas DB/biaya, bukan angka 200 atau 30 detik yang dianggap universal. Failover drill dan accepted-to-terminal accounting wajib lulus sebelum rilis.

### 10.5 Ambang pemicu dan syarat perpindahan jalur

**Norma hari ini (kecualian tercatat, bukan arsitektur final).** Jalur KRS **sinkron** dengan `pg_advisory_xact_lock` per kelas dan respons `201` final ([krs.service.ts:371](file:///C:/SICA/apps/web/src/modules/academic/services/krs.service.ts#L371), [krs/submit/route.ts:90](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/submit/route.ts#L90)). Ini sah sampai salah satu ambang di bawah menembak, dan tidak boleh disebut sebagai arsitektur final (`AGENTS §3.8`, `AUDIT_READINESS RD-10`, keputusan `P-6`).

| # | Ambang pemicu (salah satu cukup) | Cara mengukur | Aksi saat tembus |
|---|---|---|---|
| T-1 | satu `classId` menerima lebih dari **300 request submit per menit** selama jendela OW | counter `sica_krs_submit_requests_total` per kelas | aktifkan lease §10.3 + worker finalis untuk tenant itu |
| T-2 | tenant dengan lebih dari **5.000 mahasiswa aktif** ikut jendela OW serentak | `students` per tenant, dihitung sebelum OW dimulai | panaskan worker dan pool lebih dulu (pre-warm), jadwalkan OW bergelombang per prodi |
| T-3 | hasil uji beban NFR-P1 melewati **error rate 0,1 %** atau **p95 di atas 800 ms** | k6 §10.8 di staging | perpindahan jalur wajib; angka NFR-P1 tidak boleh diturunkan |
| T-4 | p95 **waktu tunggu koneksi PgBouncer** di atas 100 ms selama OW | metrik pooler | indikasi pool habis; sama seriusnya dengan T-1 |
| T-5 | `lock_timeout` atau deadlock tercatat pada baris `classes` lebih dari 10 kali per menit | `pg_stat_database` + log | jalur klien tidak boleh menyentuh baris `classes` lagi |

**Prasyarat sebelum ambang boleh memindahkan jalur (semuanya wajib, berurut):**
1. `bullmq` + `ioredis` masuk sebagai commit `package.json` dan lockfile terpisah.
2. Idempotensi tiga lapis §10.4.2 berjalan, termasuk migrasi `idempotency_keys` (nomor ditetapkan oleh DATA_MODEL §14.7).
3. DLQ keempat queue + prosedur replay operator tertulis di `docs/runbook/`.
4. Tes konkurensi §10.8 hijau di staging, **termasuk** skenario Redis mati.
5. Kontrak klien §10.6 (202 + `ops` + SSE) masuk ke `packages/contracts` dan OpenAPI, **lalu** UI Web dan Flutter mengikuti.
6. Fitur flag §10.7 tersedia supaya perpindahan bisa dilepas-pasang tanpa deploy ulang.

**Yang dilarang.** Membalik `POST /krs/submit` dari `201` final menjadi `202 + opId` **sebelum** butiran 1 sampai 5 selesai. Itu merusak UI Web, aplikasi Flutter, generator OpenAPI, dan seluruh tes yang sudah ada — dan merupakan pelanggaran `AGENTS §3.7`, bukan optimasi.

### 10.6 Kontrak sisi klien: `202 Accepted`, polling, dan SSE

Berlaku hanya pada jalur target §10.5. Bentuk respons **wajib** dibungkus amplop standar `API_SPEC §2` dan memakai status kode yang terdaftar di `API_SPEC §2.3`.

#### 10.6.1 `POST /api/v1/academic/krs/submit` → `202 Accepted`

```jsonc
// 202 Accepted — amplop Standard Success seperti `successResponse()` di
// apps/web/src/lib/api-response.ts:102-113 (success, data, meta.timestamp, meta.requestId).
// Hanya pada jalur target; hari ini rute yang sama menjawab 201 final.
{
  "success": true,
  "data": {
    "opId": "0195e2f1-7c2a-7xxx-9xxx-xxxxxxxxxxxx",
    "statusUrl": "/api/v1/ops/0195e2f1-7c2a-7xxx-9xxx-xxxxxxxxxxxx",
    "streamUrl": "/api/v1/academic/krs/stream?opId=0195e2f1-7c2a-7xxx-9xxx-xxxxxxxxxxxx",
    "positionUrl": "/api/v1/academic/krs/waitlist?periodId=...&courseId=...",
    "basketStatus": "HELD",
    "expiresAt": "2026-10-19T03:00:00Z"
  },
  "meta": { "timestamp": "2026-10-19T02:58:30Z", "requestId": "..." }
}
```

Header wajib pada `202`: `Retry-After: 2`, `Location: {statusUrl}`, `X-Op-Id: {opId}`. `opId` juga dipakai sebagai `jobId` antrean, sehingga satu pengajuan = satu pekerjaan. Catatan: `successResponse()` hari ini **tidak** menerima header kustom — menambah `202` berarti memperluas helper amplop, bukan memanggilnya apa adanya.

#### 10.6.2 Sumber daya status operasi

`GET /api/v1/ops/{opId}` — **endpoint ini belum ada di repo** (nol rute di bawah `app/api/v1/ops`). Sumber kebenaran target adalah state durable `queue_operations` di DB (`DATA_MODEL §16.1.4`), bukan Redis. Key `krs:{<tenantId>:<periodId>}:op:<opId>` (§10.3.1) hanya cache status dengan TTL **15 menit**. Cache miss/expiry **tidak berarti `404 NOT_FOUND`**: handler membaca DB Primary dalam transaksi ber-RLS dengan scope tenant dan owner (`actor_user_id`) dari sesi terverifikasi, bukan identitas kiriman klien. Retensi durable mengikuti DATA_MODEL; respons not-found mengikuti hasil lookup otoritatif scoped dan kontrak API, bukan habisnya TTL cache.

| `status` | Arti | Klien boleh mengulang? |
|---|---|---|
| `QUEUED` | job terdaftar, belum diambil worker | ya — lanjut polling atau SSE |
| `PROCESSING` | worker memegang job, transaksi belum commit | ya |
| `SUCCEEDED` | enrollment definitif tertulis di Primary; klien lalu memuat ulang proyeksi `enrollments` dari Primary | tidak — tutup siklus |
| `FAILED` | finalisasi ditolak dengan alasan bisnis (kursi habis, state berubah, gerbang) | kondisional — baca ulang lalu ikut waitlist |
| `EXPIRED` | lease lewat TTL sebelum sempat difinalisasi | ya — mulai pengajuan baru |

Badan respons memuat `opId`, `status`, `queuePosition` ( integer, dari `krs:held` dan `class_waitlists.queue_number` ), `estimatedSeconds` ( rata-rata `submit-to-final` 60 detik terakhir dikali `queuePosition` dibagi laju drain; **bukan** angka tetap ), `basketStatus`, `errorCode` (salah satu `reason` §10.4.3), `finishedAt`.

#### 10.6.3 SSE untuk pembaruan dorong

`GET /api/v1/academic/krs/stream?opId=...` — **belum ada**: tidak ada satu pun handler `text/event-stream` di `apps/web/src` (diukur dengan grep atas seluruh sumber, 0 hasil).

Aturan yang mengikat:
- `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`, koneksi **tidak** di-*buffer* oleh proxy.
- **`Last-Event-ID`**: setiap event diberi `id:` berupa angka monoton per `opId`. Saat klien putus dan menyambung, server mengirim ulang dari event berikutnya **dalam jendela 15 menit**; di luar itu, event khusus `event: resync` yang memerintahkan klien melakukan polling penuh.
- **Heartbeat** `: ping` tiap **15 detik**; tanpa heartbeat, L7 proxy menutup koneksi diam-diam sekitar 60 detik dan UI terlihat menggantung.
- **Batas koneksi**: 2 stream per user, dan **agregat 2.000 stream per tenant** sebagai plafon awal ( `[TIDAK-TERVERIFIKASI]` — taksiran rancangan, wajib diukur ulang; ini batas sumber daya, bukan klaim kemampuan). Melebihi batas → `429 RATE_LIMIT_EXCEEDED` dengan `Retry-After`, dan klien jatuh ke polling.
- **Degradasi wajib ke polling** bila: koneksi SSE terputus 3 kali berturut-turut, proxy menolak `text/event-stream`, atau halaman sudah pindah ke latar belakang (mobile). Worker SSE dianggap **opsional**, polling `statusUrl` adalah jalur kebenaran. Tidak boleh ada satu pun keputusan bisnis yang hanya bisa dicapai lewat SSE.
- **Stream adalah sinyal, bukan otoritas.** Isi event tidak pernah dipercaya sebagai bukti enrollment; setiap `SUCCEEDED` wajib diikuti satu `GET` read-your-writes ke Primary.

#### 10.6.4 Paritas Flutter (`AGENTS §3.4`)

- Paket HTTP yang ada adalah `dio ^5.5.0+1` ([pubspec.yaml:24](file:///C:/SICA/apps/mobile/pubspec.yaml#L24)); **`connectivity_plus` belum ada di `pubspec.yaml`** (diukur: nol kemunculan). Penambahannya wajib menjadi perubahan paket terpisah, bukan selipan di PR fitur (`TECH_CONVENTIONS §6` aturan 1).
- Fungsionalitas harus setara Web: status `QUEUED` dan `PROCESSING` **tidak boleh** dirender sebagai skeleton tanpa keterangan. Yang dirender: posisi antrean, perkiraan detik, dan tombol "batalkan".
- `connectivity_plus`: saat jaringan putus, **jangan** membuat pengajuan baru; pertahankan `opId` di storage lokal dan lanjutkan polling setelah sambung. Jangan pernah mengandalkan koneksi SSE yang hilang saat aplikasi masuk latar.
- Hormati `Retry-After` pada `429` dan `503`; backoff klien maksimal 3 percobaan, dan `Idempotency-Key` **tidak boleh** dibuat ulang saat mengulang request yang sama.

#### 10.6.5 Anggaran waktu (target, bukan hasil ukur)

| Objek | Budget usulan | Batas |
|---|---|---|
| Cache status operasi | 15 menit | Expiry cache tidak menghapus `queue_operations`; polling kembali ke DB |
| Lease kursi | 90 s, renewal 30 s dari parameter berversi | Tidak melewati OW; expiry/refund membutuhkan fencing + sweeper, bukan TTL saja |
| Acknowledgment | Ukur p95 acknowledgment terpisah dari waktu-ke-`SUCCEEDED` | NFR-P1 dan gerbang S-2 **tetap p95 waktu-ke-`SUCCEEDED` ≤800 ms**, bukan hanya sampai `202`; pemisahan SLO acknowledgment/finalisasi async wajib diputuskan sebelum rilis, bukan perubahan gerbang tersirat |
| Finalisasi worker | Usulan alarm operasional p95 >8 s selama 5 menit (§10.9); deadline tetap bounded | **Bukan gerbang S-2 atau pengganti NFR-P1**; SLO async belum disetujui. Finalizer memeriksa durable expiry, bukan token BullMQ |
| Dedup cache | 24 jam | Retensi durable mengikuti DATA_MODEL; replay lama tidak boleh menambah enrollment/counter |
| Recovery/drain | Tetapkan sebelum uji dengan pemilik dan plafon biaya | Ukur deteksi, freeze, fencing, reconciliation dan backlog drain; tanpa budget disetujui rilis blocked |

Business failure hanya melepas lease epoch yang sesuai setelah state DB diketahui, menjaga waitlist yang sah, dan mengirim notifikasi lewat outbox. Commit-unknown tidak boleh diperlakukan sebagai gagal lalu langsung refund.

### 10.7 Jalur degradasi — fail-closed, bukan fail-open

| Kondisi | Perilaku target | Syarat pemulihan |
|---|---|---|
| Redis down/partition/failover | Tutup admission async dengan 503/Retry-After sesuai API_SPEC; jangan otomatis fallback ke decrement sinkron | Topologi terpilih pulih, worker lama fenced, receipt/lease/DB direkonsiliasi §10.4.5; tidak ada jaminan maksimal 30 s |
| DB down/commit-unknown | Tidak menjawab 202 tanpa receipt durable; batasi retry/backlog | Lookup op/idempotensi Primary setelah pulih, lalu tentukan commit atau kompensasi |
| Backlog/pool saturated | Rate-limit dan tutup admission sebelum melewati TTL/budget; scale dalam batas DB/biaya | Umur/depth di bawah budget; seluruh accepted op tetap terlacak |
| Worker crash/stalled | At-least-once recovery; periksa epoch/idempotensi sebelum side effect | Hasil terminal DB menang atas ack/cache; attempts habis → DLQ durable/terlacak |
| Replica lag | Read-your-writes selalu Primary; laporan dapat stale/degraded | Lag pulih di bawah budget, misalnya <100 ms normal; jangan mengubah write routing |
| OW tutup/lease expire/cancel | Tolak renewal/finalisasi stale melalui transisi serialized | Rekonsiliasi commit-unknown sebelum refund; riwayat tidak dihapus |
| Counter Redis berbeda dari DB | Freeze admission scoped dan alarm, bukan reseed bebas | Rekonsiliasi active/consumed lease + durable operation pada epoch baru |

Release flag, purchased entitlement dan tenant opt-out adalah **tiga kendali berbeda**. Hanya platform memberi lisensi; tenant opt-in/off tidak menciptakan akses. Flag hanya dapat merilis handler/migrasi/worker yang **sudah dideploy**. Perpindahan sync↔async membutuhkan quiesce, drain, reconciliation dan kontrak klien kompatibel; dilarang dua writer atau fallback sync otomatis saat Redis gagal.

Readiness saat ini benar-benar menguji DB, tetapi Redis/storage hanya konfigurasi degradable; belum memeriksa antrean, epoch maupun compatibility schema/job. Target Redis menjadi dependensi wajib untuk kapabilitas admission async. Nama galat/path tetap dimiliki `API_SPEC`/contracts; angka katalog galat historis bukan bukti runtime. Acceptance fault/deploy/rollback dan pemilik recovery: `DEPLOYMENT_DEVOPS §6.3`.

### 10.8 Rencana uji beban dan gerbang penerimaan

**Angka yang mengikat adalah NFR-P1** ([PRD §6.2 baris 619](file:///C:/SICA/docs/PRD.md#L619)): **3.000 mahasiswa login dan submit KRS dalam 20 menit ( ≈100 TPS burst ), error rate `> 0,1 %` tidak boleh, p95 `> 800 ms` tidak boleh, tanpa enrollment ganda dan tanpa lebih kuota.**

Angka **2.000–3.000 RPS tulis** dan margin `20×` NFR-P1 hanyalah **usulan kapasitas yang belum terbukti**, bukan hasil tuning/benchmark, jaminan headroom, atau persyaratan penerimaan tambahan (§9.2). Kapasitas harus dibuktikan dengan profil beban, topologi, biaya dan artefak ukur; angka usulan tersebut tidak boleh melonggarkan **NFR-P1 maupun gerbang S-2: p95 waktu-ke-`SUCCEEDED` ≤800 ms**.

| # | Skenario k6 | Bentuk | Gerbang yang harus lolos |
|---|---|---|---|
| S-1 | **Rendezvous kursi terakhir** | 150 VU, 1 iterasi, semua membidik **1 kursi tersisa** pada satu `classId` yang sama | tepat 1 `SUCCEEDED`; 149 sisanya `QUEUED` atau penolakan kapasitas; **0** over-enrollment; tidak ada `500`; p95 `> 500 ms` tidak boleh |
| S-2 | **NFR-P1 penuh** | 3.000 VU login lalu submit selama 20 menit, tersebar di banyak kelas dan prodi ( ≈100 TPS ) | error rate `> 0,1 %` tidak boleh; p95 waktu-ke-`SUCCEEDED` `> 800 ms` tidak boleh; tidak ada enrollment ganda; `held + enrolled <= capacity` di semua kelas pada epoch/proyeksi yang sudah direkonsiliasi (§10.3.4); waitlist **bukan kursi** dan tidak masuk penjumlahan |
| S-3 | **Redis dibunuh di tengah run** | jalankan S-2, `SIGKILL` node Redis pada menit ke-8, hidupkan lagi pada menit ke-12 | selama mati: semua klaim baru `503` **bukan** `500` dan bukan penolakan palsu; **0** enrollment ganda; setelah hidup: re-seed benar dan sistem kembali melayani; `DLQ` tidak bertambah |
| S-4 | **Replay `Idempotency-Key`** | kirim body yang sama 5 kali beruntun dengan kunci yang sama, lalu 1 kali dengan kunci sama tetapi **isi berbeda** | 5 pertama: satu `opId` dan satu enrollment. Isi berbeda dengan kunci sama: **ditolak** (`409`), bukan dieksekusi |
| S-5 | **Regresi rencana query** | `EXPLAIN (ANALYZE, BUFFERS)` atas jalur tulis dan jalur daftar kelas | plan tidak berubah terhadap baseline yang diarsipkan; **gate CI: perbedaan plan menolak PR** (`AGENTS §3.7`) |

**Assertion basis data** (dijalankan terhadap DB nyata lewat Testcontainers, bukan array in-memory):

| # | Assertion | Cara periksa |
|---|---|---|
| A-1 | `enrolled_count` tidak pernah melampaui `capacity` | `SELECT count(*) FROM classes WHERE enrolled_count > capacity` wajib 0 |
| A-2 | tidak ada enrollment ganda | `SELECT count(*) FROM (SELECT tenant_id, student_id, class_id FROM enrollments GROUP BY 1,2,3 HAVING count(*) > 1) d` wajib 0 |
| A-3 | `enrolled_count` = jumlah enrollment aktif | `SELECT count(*) FROM (SELECT c.id FROM classes c JOIN enrollments e ON e.class_id = c.id AND e.status IN ('SUBMITTED','APPROVED','EFFECTIVE') GROUP BY c.id, c.enrolled_count HAVING c.enrolled_count <> count(e.id)) x` wajib 0 |
| A-4 | retry tidak menghasilkan baris ganda | jalankan job yang sama dua kali dengan `opId` sama; selisih `enrolled_count` wajib 1, bukan 2 |
| A-5 | tidak ada penulisan lintas tenant | jalankan beban 2 tenant bergantian; setiap baris `enrollments` harus cocok dengan tenant milik sesi yang membuatnya |
| A-6 | audit dan outbox tidak pernah berdiri sendiri | jumlah `audit_logs` per transaksi tulis sama dengan jumlah commit; tidak ada baris audit tanpa commit |

**Artefak yang sudah ada dan celahnya (terukur hari ini).** Satu-satunya skrip beban di repo adalah [tests/load/krs-concurrency.js](file:///C:/SICA/tests/load/krs-concurrency.js): 150 VU, 1 iterasi, ambang `successful_enrollments count == 1`, `rejected_due_to_capacity count == 149`, `http_req_duration p(95)<500` — bentuknya sudah benar untuk S-1, **tetapi tiga hal membuatnya belum bisa dipakai sebagai gerbang**:
1. Autentikasinya palsu: `Authorization: Bearer mock_jwt_token_user_${__VU}` dan `X-Tenant-ID: demo`. Ia tidak melalui guard nyata, dan `AGENTS §3.8` L2 justru melarang server mempercayai `x-tenant-id` kiriman klien. Skrip harus memakai login nyata per VU.
2. Ia mengharapkan `422` atau `409` untuk kursi habis, sedangkan rute hari ini mengirim `CONFLICT` `409` ([krs/submit/route.ts:74-78](file:///C:/SICA/apps/web/src/app/api/v1/academic/krs/submit/route.ts#L74)). Selaras dengan API_SPEC baris 36 yang menuntut `CLASS_FULL` dinaikkan menjadi kode sendiri.
3. S-2 sampai S-5 belum ada sama sekali (`find tests -type f` hanya mengembalikan satu berkas), dan **`k6` tidak terpasang di paket mana pun**.

**Penyimpangan struktur yang perlu dicatat:** peta direktori §5 di dokumen ini mencantumkan direktori akar `load/`, padahal isi nyata repo berada di `tests/load/`. §5 tidak diubah pada siklus ini (di luar cakupan), tetapi rujukan jalur yang benar untuk artefak beban adalah `tests/load/`.

**Gerbang rilis (semua wajib hijau sebelum §10.5 mengesahkan jalur async):** S-1 sampai S-5 di staging, `EXPLAIN` gate, tes RLS pada DB nyata, `tsc --noEmit` bersih, dan **nol** enrollment ganda pada laporan assertion.

### 10.9 Observability minimal sebelum rilis

Tanpa tujuh metrik berikut, jalur async **tidak boleh** dirilis. Penamaan mengikuti konvensi `sica_<domain>_<nama>` dan memakai OpenTelemetry → Grafana LGTM yang sudah dinormakan di §3 dan §2; `bull_queue_waiting` dipertahankan namanya karena sudah menjadi dasar HPA di `DEPLOYMENT_DEVOPS §4.1`.

| Metrik | Tipe | Sumber | Ambang alarm | Tempat lapor |
|---|---|---|---|---|
| `sica_queue_depth{queue}` | gauge | `Queue.countWaiting()` BullMQ | `> 200` selama 2 menit; `> 1.000` = darurat | dashboard OW Grafana + alarm halaman |
| `sica_queue_oldest_job_age_seconds{queue}` | gauge | usia job tertua di antrian | `> 30 dtk` pada `krs.submit` | dashboard OW + Sentry breadcrumb |
| `sica_krs_lease_expiry_rate` | counter percounter | transisi `HELD` ke `EXPIRED` dibagi klaim | `> 5 %` berarti TTL terlalu pendek atau klien terlalu lambat | dashboard OW |
| `sica_krs_seat_conflicts_total` | counter | Lua mengembalikan `REJECTED_SEAT` padahal ada lease | `> 1 %` dari klaim berarti re-seed meleset | dashboard OW + laporan pasca-insiden |
| `sica_krs_seat_invariant_violations_total` | counter | job rekonsiliasi menemukan `held + enrolled > capacity` pada epoch/proyeksi yang sudah direkonsiliasi (§10.3.4); waitlist **bukan kursi** dan tidak dihitung | `> 0` (harus nol mutlak) | alarm darurat ke on-call |
| `sica_krs_submit_to_final_p95_seconds` | histogram | waktu dari `RESERVED` sampai `SUCCEEDED` | **Usulan alarm operasional**, p95 `> 8 dtk` selama 5 menit | dashboard OW; **bukan gerbang S-2** (tetap p95 waktu-ke-`SUCCEEDED` ≤800 ms); pemisahan SLO acknowledgment/finalisasi async wajib diputuskan sebelum rilis (§10.6.5) |
| `sica_dlq_size{queue}` | gauge | jumlah job dengan `status = DEAD` | `> 0` selama OW | Sentry + notifikasi operator |
| `bull_queue_waiting` | gauge | metrik bawaan yang sudah dirujuk HPA | `> 200` memicu scale-out worker | CloudWatch atau Prometheus sesuai §4.1 |

Ikut diperlukan sebagai pendukung: rasio koneksi PgBouncer yang meng-antri, lag replikasi (gerbang §10.7 baris 5), laju `503 ENROLLMENT_ENGINE_UNAVAILABLE` per tenant, dan **setiap transaksi tulis wajib dapat ditelusuri** dari `requestId` amplop (`api-response.ts:108`) dan `correlation-id` respons (`§2` dokumen ini) sampai ke baris `enrollments` lewat satu `opId`. Seluruh nama metrik di atas **belum ada di kode** — tidak ada satu pun pengumpul metrik queue di `apps/web` hari ini (yang terukur lewat grep atas `apps/web/src`: nol pemancar metrik queue, karena queue-nya sendiri belum ada). Klaim bahwa OpenTelemetry tersedia juga **belum terverifikasi** sebagai kode, hanya sebagai pilihan stack di §3.

### 10.10 Presensi massal (banyak kelas dibuka serentak)

- Token sesi presensi + hitungan **ditahan di Redis** (TTL window); scan mahasiswa memvalidasi geofencing dan TTL di edge/cache.
- Penulisan `attendances` **di-batch** oleh worker `attendance.bulk` (flush tiap N detik atau tiap M baris) → `INSERT` multi-baris sekali jalan, bukan 1 transaksi per scan. Ini jalur yang menjawab larangan `AGENTS §3.7` ("presensi massal di-batch flush").
- Rate-limit per kelas di Redis mencegah spam scan; idempoten per `(studentId, sessionId)` agar scan ganda tidak membuat baris ganda — **periksa** `attendances` punya kunci unik yang setara sebelum mengandalkan klaim ini ( `uq_enrollments_student_class` ada untuk enrollment; padanan presensi belum dibuktikan di dokumen ini ).
- Batch flush **tidak** boleh menyertakan `UPDATE` kuota kelas; presensi tidak menyentuh `classes.enrolled_count`, sehingga jalur ini tidak pernah bersaing dengan `krs.submit` untuk baris yang sama.
- Realita kode: rute presensi hari ini ada ([attendance/qr/scan](file:///C:/SICA/apps/web/src/app/api/v1/attendance/qr/scan/route.ts)) tetapi berjalan transaksi-per-scan; **belum ada** batching dan **belum ada** queue. Ini bagian target.

---

## 11. Engine Algoritma Deterministik (Zero-API-Key) — 2026-10-20

Norma: ADR-14…ADR-17 di §1. Skema & indeks: [DATA_MODEL §17](file:///c:/SICA/docs/DATA_MODEL.md). Kontrak endpoint: [API_SPEC §6](file:///c:/SICA/docs/API_SPEC.md). Postur keamanan: [SECURITY_COMPLIANCE §10](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md). Titik aksi hak akses: [RBAC_MATRIX §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md). Pengerjaan: [ROADMAP §2.11](file:///c:/SICA/docs/ROADMAP_TASKS.md) (grup `ALG-1`…`ALG-7`, WBS `W-13`). **Lanjutan:** permintaan gelombang kedua (timetabling CSP/GA, early-warning, auto-fix Feeder, verifier audit, analitik OBE) ada di §12 sebagai `ALG-8`…`ALG-14` dan **memakai harness yang sama** — bab itu melanjutkan, tidak menggantikan §11.

### 11.1 Yang diizinkan dan yang dilarang (garis tegas)

| Diizinkan | Dilarang |
|---|---|
| Algoritma internal di `apps/web/src/modules/**` dan worker (TypeScript murni; inti logika tanpa I/O). | Panggilan apa pun yang memerlukan **API key / lisensi vendor** (OCR cloud, solver berbayar, LLM API, routing API). |
| Pustaka open-source **lokal** yang terpasang tanpa kredensial — termasuk biner OCR (Tesseract v5) di **container worker milik sendiri**. | Mengirim isi dokumen, nilai, atau PII keluar infrastruktur SICA (egress melanggar UU PDP; lihat SECURITY §7 & §10). |
| Data tenant sendiri sebagai bahan hitung (`grades`, `enrollments`, `classes`, `rooms`, `course_prerequisites`, `academic_rules`). | Model yang bobotnya tidak dapat dikeluarkan untuk audit, atau hasil yang tidak dapat direproduksi dari snapshot. |
| Aritmetika **integer/numeric** (basis poin, `numeric(6,3)`) sebagai bentuk kanonik. | `float`/`double` untuk pembobotan & agregasi nilai lintas platform (melanggar parity AGENTS §3.4 Next.js ↔ Flutter). |

Kepatuhan dibuktikan secara mekanis, bukan diklaim: CI memindai `fetch(` / `axios` / `https.request` di dalam direktori engine dan menolaknya; tiap engine punya *golden test vector* (masukan fixtured → keluaran byte-identik) sehingga angka yang sama dapat direproduksi enam bulan kemudian.

### 11.2 Harness bersama — satu corak untuk tujuh engine

```
snapshot input ──▶ engine (pure) ──▶ hasil + explain ──▶ tabel *_results ──▶ manusia VALIDATE ──▶ service domain (guard + RLS + audit)
      ▲                                     ▲
 parameter berversi (academic_rules / tenant_settings / *_rule_definitions)
```

Setiap run membawa:

| Field | Isi | Kenapa wajib |
|---|---|---|
| `engine_code` | `graduation-path`, `lab-allocator`, `concentration`, `cumlaude-rete`, `room-rerouter`, `grade-ast`, `doc-extract` | satu titik penegakan, bukan cek tersebar di rute |
| `engine_version` + `parameter_version` | versi kode dan versi konfigurasi | replay historis harus menghasilkan angka yang sama |
| `input_snapshot_hash` | SHA-256 atas himpunan input terurut | membuktikan hasil tidak berubah karena data berubah di tengah jalan |
| `idempotency_key` | dari header `Idempotency-Key` | dua klik ≠ dua alokasi (AGENTS §3.7) |
| `budget` | `max_nodes`, `max_seconds`, `max_backtrack` | engine NP-hard wajib punya batas; tanpa ini satu run dapat mengunci worker |
| `explain` | jalur kritis / pasangan penghalang / aturan yang menyala / field berkeyakinan rendah | menjawab "mengapa" (FR-ADM-11) dengan angka yang sama dengan keputusan |
| `proposal_only = true` | keluaran **tidak pernah** menulis tabel bisnis | pemisahan tugas: mesin mengusulkan, manusia menyetujui (RBAC §7, aksi `VALIDATE`) |

Eksekusi: rute API **tidak** menghitung (ADR-9 + ADR-15) — ia mencatat job dan mengembalikan `202 { runId }`; worker yang mengeksekusi. Realita sekarang: `bullmq`/`ioredis` belum menjadi dependensi nyata (`RD-11`, keputusan `P-6`), alternatif antrean DB (`engine_runs` + `FOR UPDATE SKIP LOCKED` + claim/retry/dead-letter) juga **desain, belum runtime**, dan bukan pengganti terselubung target KRS §10. Kesetaraan kontrak perlu tes kompatibilitas; KRS saat ini tetap sync advisory-lock. Larangan lama tetap berlaku: engine tidak membaca replica untuk data yang baru ditulis.

### 11.3 ALG-1 · Dynamic Critical Path Graduation Simulator

**Fungsi** Estimasi semester lulus terdekat seorang mahasiswa, jalur kritis, dan penyebab mepet.

**Algoritma** CPM di atas DAG (topological sort Kahn) + forward/backward pass + pemrograman dinamis untuk ketersediaan term.
- Simpul = (matakuliah, slot-term); simpul awal = matakuliah tanpa prasyarat yang belum terpenuhi.
- Forward: `EF(v) = max(EF(u) + 1)` atas `u ∈ prereq(v)`; bila matakuliah hanya dibuka pada term tertentu (pola ganjil/genap/antara), `EF(v)` dinaikkan ke term terbuka pertama sesudahnya — bagian DP-nya adalah `nextOpenTerm(after, parity)` dengan tabel hasil prahitung, `O(1)` per query.
- Backward dari term target lulus: `LS(v)`, lalu `slack(v) = LS(v) − ES(v)`; `slack = 0` → jalur kritis.
- Skenario apa-yang-jika (ambil X di term T / gagal di term T) dihitung sebagai **delta** atas tabel DP, bukan simulasi ulang penuh.

**Kompleksitas** `O(V + E)` untuk sort + dua pass; dengan `T` term yang direncanakan menjadi `O(T·(V+E))`, ruang `O(V + E + T)`. Skala riil satu prodi-satu angkatan: `V ≤ 60`, `E ≤ 200`, `T ≤ 12` → satu simulasi di bawah 5 ms. Versi lintas cohort (10.000 mahasiswa) tetap `O(n·(V+E))` dan **wajib** berjalan di worker (batch), bukan di rute HTTP.

**Sumber data** `courses.sks*`, `curricula`, `course_prerequisites` (belum ada — migrasi `0008`, ADM-3), `enrollments`/`grades` status `EFFECTIVE`, `academic_periods` (`academic_year_term` GANJIL/GENAP/ANTAR), `students.status_akademik`, serta `academic_rules` untuk batas SKS per term dan aturan mengulang.

**Invariance** (a) graf harus asiklik — bila siklus terdeteksi, keluarannya **bukan** angka palsu melainkan `422 PREREQ_CYCLE` berisi simpul yang terlibat; (b) status "lulus" tidak dapat dikeluarkan bila `deficit_sks > 0`; (c) batas bawah yang sah = `maks(kedalaman_prasyarat, sisa_sks / maks_sks_per_term)` — dipakai untuk membuktikan angka mesin tidak optimistis palsu.

**Kejujuran soal prasyarat data** Engine ini tidak dapat menghasilkan angka akurat sebelum `course_prerequisites` dan pola ketersediaan matakuliah per term terisi. Selama keduanya kosong, keluaran wajib membawa flag `degraded: "NO_PREREQ_DATA"` dan layar menampilkannya apa adanya — bukan angka yang tampak meyakinkan.

### 11.4 ALG-2 · Multi-Resource Lab & Facility Allocator

**Fungsi** Menata kelompok praktikum ke shift × ruang × alat × lisensi perangkat lunak tanpa bentrok.

**Algoritma** dua tahap, dan urutan ini disengaja karena bin-packing multi-dimensi tidak punya jaminan rasio konstan:
1. **FFD (First-Fit-Decreasing) multi-dimensi** atas vektor kebutuhan `(peserta, unit_alat, lisensi_concurrent, bahan_habis_pakai)`, diurut menurun pada dimensi pembatas dominan. Kompleksitas `O(N log N)` sort + `O(N·B)` pencocokan dengan `B` = jumlah bins aktif (target `O(N log N)` terpenuhi di tahap ini). Ditolak sebagai hasil akhir: FFD multi-dimensi dapat menyimpang dari optimum.
2. **Perbaikan backtracking terbatas** (branch-and-bound dengan urutan tetap, `max_backtrack` dari budget, pemangkasan oleh batas bawah `maks_d Σreq_d / Σcap_d`) untuk `N ≤ 40` butir per sesi. Bila budget habis, hasil FFD **tetap dikembalikan** bersama selisihnya terhadap batas bawah — bukan gagal diam-diam.

**Objektif leksikografis** (urutan tidak boleh dibalik): layak (tanpa pelanggaran keras) → minim jumlah shift → minim pemborosan kapasitas → minim perpindahan ruang/gedung → preferensi jam. Bobot tiap tingkat tersimpan di `academic_rules` (`parameter_version`) sehingga kampus dapat mengubahnya tanpa rilis kode.

**Sumber data** `rooms` (`capacity`, `room_type`, `building`, `floor`, `facilities jsonb`), `lab_resource_capabilities` (BARU, §17.2), `class_sessions`/`class_schedules`, `enrollments`, `lecturers`/`class_assignments` untuk ketersediaan pengampu. Bentrok waktu memakai **`int4range` + indeks GiST** (§17.2), bukan `BETWEEN` per baris.

**Kompleksitas & target ukur** FFD `O(N log N)`; perbaikan `O(b^d)` terpangkas budget. Acuan: 40 sesi praktikum × 8 shift × 12 ruang selesai di bawah 2 detik pada satu core worker; 5× lipat masih di dalam budget karena pemangkasan batas bawah.

**Ketika tidak layak** Engine mengembalikan **inti konflik** — himpunan batas minimal yang membuat mustahil (mis. "Lab Komputer II: kapasitas alat 24 unit, kebutuhan 36") melalui `explain`, bukan pesan "tidak ada slot". Ini padanan `denialreason` (FR-ADM-11) untuk kasus alokasi.

### 11.5 ALG-3 · Automatic Concentration & Track Allocation Engine

**Fungsi** Memeringkat peminatan/konsentrasi, lalu mengalokasikan mahasiswa ke kuota konsentrasi/dosen pembimbing secara adil dan stabil.

**Algoritma** tiga lapis:
1. **AHP** untuk bobot kriteria dari matriks perbandingan berpasangan (JSONB). Vektor prioritas dihitung dengan *power iteration* (deterministik, `O(k²·iter)`, `tol = 1e-9`, `iter ≤ 200`, `k ≤ 15`) atau rata-rata geometrik (RGMM) bila kampus memilih. **Rasio konsistensi wajib dihitung**: `CI = (λmaks − k)/(k − 1)`, `CR = CI / RI[k]` (tabel RI Saaty); `CR > 0.10` → `422 AHP_INCONSISTENT_MATRIX` disertai pasangan baris-kolom paling menyimpang. Ini bukan formalitas: matriks tidak konsisten menghasilkan ranking yang tidak bisa dipertanggungjawabkan di sidang prodi.
2. **TOPSIS** atas matriks keputusan `(mahasiswa × kriteria)` yang dinormalisasi vektor dan diberi bobot AHP; `Cᶦ⁺ = d⁻ / (d⁺ + d⁻) ∈ [0,1]`. Kompleksitas `O(n·m)`. Kriteria kualitatif (wawancara, portofolio) masuk lewat kamus berperingkat (`reference_items` → skala ordinal), **tidak ada angka bebas per petugas** — kalau tidak, ranking menjadi suka-suka petugas.
3. **Stable Marriage berkuota (Hospital/Residents, Gale–Shapley, sisi mahasiswa mengusulkan)**: urutan usulan mahasiswa = `Cᶦ⁺` terurut; penerimaan mengikuti skor + kuota. Deferred acceptance `O(n·Σpref)`, terburuk `O(n²)`. **Yang boleh diklaim**: tidak ada *blocking pair* terhadap preferensi ketat, dan sertifikat stabilitas dapat diverifikasi ulang `O(n²)` setelah alokasi. **Yang tidak boleh diklaim**: dengan nilai seri (ties), stabilitas-kardinal-maksimum adalah RSMTI (NP-hard). SICA tidak berpura-pura: ties dipecah deterministik (`Cᶦ⁺` → `nim` → `id`) sehingga preferensi menjadi ketat dan sertifikat berlaku.
   Sifat strategi: sisi pengusulan (mahasiswa) *strategyproof* — melaporkan preferensi palsu tidak menguntungkan; sisi penerima tidak, karena itu preferensi konsentrasi dibuat **parameter berversi + empat-mata**, bukan diubah setelah pengumuman.

**Sumber data** `study_programs`, konsentrasi sebagai `reference_items(kind='konsentrasi')` + `concentration_criteria_weights` (BARU), `students`, `lecturers` + kuota bimbingan, `grades`/IPK.
**Etika & kepatuhan** Engine ini menentukan masa depan akademik mahasiswa; karena itu: (a) setiap kriteria dan nilainya terbuka bagi yang bersangkutan (hak atas alasan, UU PDP), (b) tidak ada kriteria tersembunyi, (c) hasil engine = draf, pengumuman = aksi `VALIDATE` Kaprodi, (d) seluruh input + parameter di-hash dan masuk jejak audit.

### 11.6 ALG-4 · RETE Engine for Honor & Cum Laude Graduation Clearance

**Fungsi** Menilai predikat kelulusan dan syarat kelulusan (cum laude, sangat memuaskan, syarat khusus per fakultas/angkatan) dari **aturan dinamis**, tanpa SQL yang di-hardcode per kampus.

**Kenapa RETE, bukan if/else atau SQL** Aturan predikat adalah konjungsi atas fakta yang sama (IPK, masa studi, SKS, nilai C ke bawah, jumlah mengulang, sertifikat bahasa, poin kegiatan, cekal) yang diuji ke ribuan mahasiswa. RETE membagikan uji parsial: simpul alpha (satu uji satu field, mis. `ipk >= 3.50`) dievaluasi **sekali per fakta**, dan token hanya melewati simpul yang cocok; simpul beta mengerjakan penggabungan konjungsi. Untuk 5.000 mahasiswa × 200 aturan, pendekatan naif = 1.000.000 eksekusi uji per perubahan aturan; RETE ≈ `O(Σ|uji_alpha| + |token melaju|)` → target ukur **≤ 2 detik** untuk re-evaluate satu angkatan penuh dan **< 50 ms** untuk evaluasi inkremental ketika satu fakta berubah.

**Bentuk aturan** `rete_rule_definitions` (BARU): `when` = pohon kondisi JSONB `{all:[{fact,op,value}|{any:[…]}]}` dengan `op ∈ {==, !=, >=, <=, in, not_in, between, exists, matches}`, `then` = setelan/temuan (`predicate=CUM_LAUDE`, `block=…`), `salience`, `scope` (fakultas/prodi/angkatan), `effective_from`/`effective_to`, `version`. Fakta yang boleh direferensikan **harus terdaftar** di `rete_fact_types` (§17.4): aturan yang menunjuk field tak dikenal gagal saat **kompilasi**, bukan saat eksekusi produksi.

**Kompilasi & determinisme** Satu set aturan dikompilasi menjadi jaringan alpha/beta **per `rule_version`** dan di-cache (invalidasi saat versi berubah). Resolusi konflik deterministik: `salience DESC, rule_code ASC`. **Stratifikasi wajib**: graf dependensi fakta turunan diperiksa; siklus → `422 RETE_RULE_CYCLE`, kedalaman rantai dibatasi `max_rule_depth`. Tidak ada *forward chaining* bebas: aturan hanya boleh menulis ke fakta turunan berlabel (mis. `predikat_hitung`), tidak pernah ke kolom bisnis.

**Pemisahan tugas** Predikat hasil inferensi bukan kebenaran langsung: `grades`/`graduation_profiles` hanya berubah lewat transisi yang disetujui manusia (`VALIDATE`), dan aturan itu sendiri disahkan lewat **empat-mata** (pola `access_change_requests`, SECURITY §3.3) — mengubah aturan sama artinya dengan mengubah hak atas gelar.

**Jejak penjelasan** Per mahasiswa disimpan `fired_rule_ids`, `matched_conditions`, dan snapshot fakta. Pertanyaan "kenapa saya tidak cum laude" dijawab dengan nomor aturan + fakta penyebab, bukan kalimat umum.

### 11.7 ALG-5 · Max-Flow Min-Cut Room Emergency Re-Router

**Fungsi** Re-alokasi darurat sesi kuliah ketika ruang/gedung tidak dapat dipakai (banjir, listrik, renovasi, insiden) dengan total jarak tempuh minimum.

**Model jaringan** `source → sesi tergusur (permintaan = blok jam × kelompok) → simpul (ruang, slot) kapasitas 1 → sink`. Sisi hanya dibuat bila **semua** kendala keras lolos: `room_type`, kapasitas ≥ peserta, `lab_resource_capabilities` (alat/lisensi), ketersediaan pengampu (`class_assignments` + `class_schedules`), dan **tidak bentrok** dengan jadwal berjalan (uji `int4range &&`). Biaya sisi memakai matriks jarak (antar-gedung + lantai) yang dapat dikonfigurasi, dengan penalti khusus untuk perpindahan lintas gedung.

**Algoritma** dua tahap, dan urutan tidak boleh dibalik:
1. **Kelayakan: Max-Flow.** `Edmonds–Karp O(V·E²)` **ditolak** untuk ukuran riil (V ≈ 120 sesi + 300 ruang-slot; sisi pasca-pruning 10³–10⁴, tetapi `V·E²` tetap di luar budget). Yang dipakai **Dinic** — worst case `O(V²·E)`, praktis mendekati `O(E·√V)` pada jaringan kapasitas satuan — sehingga 10⁴ sisi selesai dalam orde milidetik hingga ratusan milidetik.
2. **Biaya: min-cost flow pada himpunan yang layak** (Successive Shortest Path dengan potensial, atau penugasan greedy terurut biaya di graf sisa). Tidak ada klaim optimum global bila budget memotong iterasi: laporan memuat `flow_total` (jumlah sesi terselamatkan) **dan** `cost_vs_lower_bound`.

**Min-cut sebagai jawaban** Setelah max-flow, himpunan simpul yang terjangkau `source` pada graf sisa = **min-cut**. Ia memisahkan "sesi yang dapat ditampung" dari "yang tidak", dan sisi-sisi jenuh pada cut itulah kekurangan yang dapat dibaca manusia ("kurang 2 ruang Lab di Gedung C, Senin 13:00–15:00"). Dari sini engine mengeluarkan **urutan relaksasi termurah**: tambah slot paralel → gabung kelompok → izinkan lintas gedung (penalti jarak) → `SYNC_LIVE`/`ASYNC_MODULE`. Setiap relaksasi punya kode dan penaltinya sendiri — bukan "coba sendiri".

**Ketentuan** Hasil re-route bersifat **draf**: tidak ada sesi atau peserta yang pindah sebelum `VALIDATE` BAAK/Kaprodi, tidak ada perpindahan lintas gedung yang diam-diam (notifikasi + `audit_logs` + `Idempotency-Key`), dan penulisan jadwal tetap lewat service domain dengan lock per kelas — engine tidak pernah menyentuh `class_schedules` langsung.

### 11.8 ALG-6 · Deterministic Grade Tree & Assessment Normalizer

**Fungsi** Memvalidasi dan menormalkan hierarki bobot nilai RPS vs KHS sebelum penguncian nilai final.

**Algoritma** pohon ekspresi (AST) + evaluator simbolik numerik:
1. **Tokenisasi + Pratt/shunting-yard** atas formula komponen (`0.20*TUGAS + 0.30*PRAKTIKUM + 0.50*UAS`, fungsi `min()`, `max()`, `clamp()`, `drop_lowest(n)`), menghasilkan `grade_ast_nodes` (BARU; simpul disimpan sebagai **token/parameter kanonik**, bukan string mentah) + `formula_hash` hasil normalisasi (casefold, spasi, urutan komutatif) untuk mendeteksi duplikat.
2. **Pemeriksaan tipe & semantik**: referensi komponen harus ada di `grade_components` kelas itu; `Σ bobot = 10000 bp` (basis poin, bukan float) — kalau tidak, `422 WEIGHT_SUM_NOT_100` (kode lama, **tidak** dibuat kode baru); kedalaman ≤ 12; variabel tak dikenal ditolak.
3. **Evaluator** berjalan di atas AST dengan aritmetika integer/basis-poin dan `numeric(6,3)`, pembulatan eksplisit per langkah (half-up), **tanpa `eval()` maupun `new Function()`** (SECURITY §10.3). Formula di-precompile menjadi closure per `(formula_version, class_id)` → evaluasi `O(|simpul|)` per baris nilai.
4. **Normalisasi RPS ↔ KHS**: diff struktural (komponen hilang, bobot beda, skala beda) + pemetaan ulang melalui `grade_scale_bands` (band `int4range` dengan constraint `NOT OVERLAPS` agar tumpang tindih band mustahil tersimpan). Konversi huruf↔angka memakai jalur yang sama dengan `grading.service.ts` hari ini — engine **tidak** membuat hukum penilaian kedua.

**Kompleksitas** parse `O(n)`; evaluasi `O(|AST|)` per enrollment. 1 kelas × 40 mahasiswa × 8 komponen = 320 evaluasi per run (trivial). Yang mahal adalah **verifikasi massal** sebelum penguncian (ribuan kelas) → job worker + laporan diff, bukan pemanggilan sinkron di rute.

**Kenapa ini penting, bukan kosmetik** Bobot yang berbeda antara RPS (dokumen) dan KHS (record) adalah temuan audit mutu (SPMI) dan sumber keberatan mahasiswa. Engine menjadikannya **cacat yang tertangkap sebelum penguncian**, dengan bukti berversi, bukan perdebatan setelah wisuda. Perubahan formula pasca-kunci hanya lewat workflow koreksi (`grading.unlock`, khusus `HEAD_OF_PROGRAM`, SoD BR-G4) — engine tidak pernah memegang hak itu.

### 11.9 ALG-7 · Ekstraksi Dokumen (PDF/gambar) → draf isian + pemeriksaan teks

Permintaan eksplisit pemilik: unggah PDF (transkrip hasil konversi MBKM/RPL, surat tugas, berkas PMB, UTS/UAS) lalu data terisi sendiri, dengan analisa cek teks. Ini **satu-satunya engine yang menerima input tak-tepercaya dari luar**, jadi urutannya tegas: integritas → ekstraksi bertingkat → pemetaan terkendali → validasi aturan → **konfirmasi manusia**.

**Lapis 0 — intake & integritas.** `magic bytes` (bukan ekstensi), batas ukuran, jumlah halaman, tolak PDF terenkripsi / mengandung `JavaScript` / `OpenAction`, batas rasio dekompresi (anti *zip-bomb*), `SHA-256` berkas, penyimpanan objek per-tenant, enkripsi salinan yang memuat PII (`NIK`, data kesehatan), dan retensi singkat untuk berkas mentah (SECURITY §10.4).

**Lapis 1 — baca yang pasti-pasti lebih dulu (tanpa OCR).**
- **Medan formulir (`AcroForm`/XFA)**: target membaca nilai langsung tanpa OCR; kompatibilitas format, kelengkapan dan akurasi tetap diuji. Tidak ada jaminan 100% atau biaya nol.
- **Layer teks PDF** (operator `Tj`/`TJ` + koordinat): deterministik, ~milidetik per halaman, dan inilah jalur utama transkrip/kartu hasil studi yang dicetak digital — termasuk berkas konversi MBKM.

**Lapis 2 — OCR lokal, hanya bila perlu.** Dokumen yang ternyata citra (hasil pindai/foto) dirender lalu masuk **container worker sendiri** dengan Tesseract v5 (model `eng+ind`), `PSM` dipilih menurut struktur tabel, dengan kuota CPU per tenant. Tanpa API key, tanpa egress. **Tulisan tangan dinyatakan tidak didukung**: akurasinya jauh di bawah ambang yang layak untuk record akademik; jalurnya entri manual berbantuan (panduan + validasi), bukan janji palsu.

**Lapis 3 — pemulihan tata letak & tabel.** Blok teks + koordinat → *recursive X-Y cut* untuk kolom; profil proyeksi (horizontal/vertikal) untuk garis tabel; pada PDF, rekonstruksi kisi dari operator garis/isian. Hasilnya sel `(baris, kolom, teks, bbox)`. Tanpa tahap ini, transkrip multi-kolom terbaca sebagai satu kalimat panjang — inilah penyebab umum "OCR salah baris".

**Lapis 4 — *field grounding* berbasis template berversi.** Bukan "ambil kata di dekat kata lain". Setiap bentuk punya **template** (`document_templates` + `document_template_anchors`, §17.7) berisi jangkar: label regex, posisi relatif, tipe, dan kamus tujuan. Deteksi template lewat *fingerprint* (judul, nomor formulir, string khas). Template tak dikenal → mode keyakinan rendah; field **tidak** ditebak-tebak.

**Lapis 5 — pencocokan nilai ke data kampus (inti "konversi").** Ruang kandidat dibatasi **kamus milik tenant sendiri** (`courses`/`curricula` untuk judul & SKS, prodi, periode, dosen), sehingga yang terjadi adalah *grounding*, bukan pembentukkan teks:
- Normalisasi: NFD + casefold, hapus tanda baca, kanalisasi karakter mirip (`I`→`1`, `O`→`0` pada NIM), rapikan spasi.
- Pindai multi-pola serentak: **Aho–Corasick** `O(n + z)` atas seluruh dokumen untuk menemukan semua penyebutan yang cocok dengan kamus — jauh lebih tepat daripada satu regex per istilah.
- Kemiripan judul matakuliah: **Dice/Jaccard atas 3-gram** + **Levenshtein ≤ 2** untuk string pendek + TF-IDF/cosine untuk judul panjang; yang menjadi syarat adalah **selisih peringkat** (`margin`), bukan skor mentah.
- Penugasan satu-ke-satu baris transkrip → kandidat: greedy terurut skor, atau Hungarian `O(n³)` bila `n ≤ 60`, agar satu matakuliah tidak dipakai dua baris.
- Pemetaan nilai: huruf/angka → skala SICA lewat `grade_scale_bands` + `course_equivalencies` (migrasi `0008`, ADM-3). Tanpa kedua objek itu, konversi hanya menghasilkan draf kosong — dan itu dilaporkan apa adanya.

**Lapis 6 — validasi deterministik (yang sesungguhnya dimaksud "cek teks").** Bagian paling bernilai dan tidak memerlukan AI: struktur & checksum (`NIK` 16 digit + kode wilayah), pola NIM dari `tenant_settings.format_nim`, jumlah SKS per jenis (`≤ 9` dan `≠ 0`, DATA_MODEL §14.5), IPK/IPS **dihitung ulang** dari angka yang terbaca (tidak dipercaya begitu saja), konsistensi total (Σ baris vs tertulis), rentang tahun/semester, aturan PDDikti di **titik input** (`AC-FDR-2`; 11 penolakan Checkpoint 1/2), dan deteksi duplikat baris.

**Lapis 7 — ambang keyakinan & manusia.** Setiap field membawa `{method, score, source_span, candidate_id}`. Kebijakan baku: `score ≥ 0.92` **dan** `margin ≥ 0.15` → terisi otomatis (tetap ditandai sebagai hasil ekstrak, bukan entri pengguna); `0.75–0.92` → terisi tetapi **wajib** direview (lencana kuning); `< 0.75` → kosong + tautan bukti. Keluaran engine adalah **draf** di `document_extractions` + `document_extraction_fields`; tombol "Terapkan ke isian" memanggil service yang sudah ada (KRS / konversi MBKM) dengan seluruh gerbangnya (Zod, izin, `enrollment.krs.submit`, lock kuota, audit). Engine tidak punya jalur tulis langsung — dan itu disengaja.

**Kenapa bukan LLM/visi API.** (a) zero-API-key (ADR-14); (b) nondeterminisme pada record akademik tidak dapat diterima untuk audit; (c) egress transkrip/NIK melanggar UU PDP; (d) halusinasi ("menebak" SKS 3 padahal 2) merusak data yang dilaporkan ke PDDikti; (e) pipeline di atas deterministik, dapat diuji dengan fixtured PDF, dan dapat dijelaskan ke auditor. Penambahan yang boleh menyusul: klasifikasi dokumen di perangkat sendiri dengan bobot yang dapat dikeluarkan — sebagai pra-penyaring template, bukan pengganti *grounding*.

### 11.10 Penempatan, budget, dan mode turun

| Engine | Penempatan | Budget baku | Skala target | Mode turun saat data prasyarat belum ada |
|---|---|---|---|---|
| ALG-1 | worker `engine.graduation` | 10 s / 200k simpul | 10.000 mahasiswa per prodi (batch) | `degraded: NO_PREREQ_DATA` |
| ALG-2 | worker `engine.allocator` | 20 s / 50k backtrack | 40 sesi × 12 ruang | hasil FFD + selisih batas bawah, tanpa klaim optimum |
| ALG-3 | worker `engine.concentration` | 30 s / 200 iterasi AHP | 3.000 mahasiswa × 6 konsentrasi | `422 AHP_INCONSISTENT_MATRIX` (menolak jalan) |
| ALG-4 | cache in-process + worker penuh | 2 s penuh / 50 ms inkremental | 5.000 mahasiswa × 200 aturan | pakai versi aturan berjalan + lencana `RULE_STALE` |
| ALG-5 | worker `engine.reroute` | 15 s | 120 sesi × 300 ruang-slot | draf parsial + penjelasan min-cut |
| ALG-6 | in-process (verifikasi) + worker (massal) | 5 s per kelas | 1.000 kelas (batch) | diff menjadi temuan, bukan auto-betul |
| ALG-7 | worker `engine.extract` (OCR di container terpisah) | 60 s per dokumen + kuota CPU/tenant | 500 dokumen per hari | hanya Lapis 1; OCR gagal → draf kosong + bukti |

Semua engine tunduk pada AGENTS §3.7: mutasi hanya ke Primary, baca-setelah-tulis dari Primary, tanpa `LOCK TABLE`, indeks domain dengan `tenant_id` sebagai kolom pertama, dan hasil panjang tidak pernah dikirim melalui HTTP (yang dikembalikan adalah tautan ke tabel `*_results`).

---

## 12. Engine Algoritma Deterministik Gelombang 2 (ALG-8…ALG-14) — 2026-10-20

Bab ini melanjutkan §11, bukan menggantikannya. Yang **tidak diulang** di sini karena sudah mengikat: garis tegas boleh/dilarang (§11.1), harness `run → explain → apply` dengan `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain`, `proposal_only` (§11.2), penolakan hitung di rute HTTP + `202 { runId }` (§10.6, ADR-9/ADR-15), dan aturan "mesin mengusulkan, manusia menyetujui" (ADR-15 + RBAC §7).

Pemilik rujukan, supaya tidak ada dua kebenaran: skema & nomor migrasi = **DATA_MODEL §18 / §14.7**; endpoint & kode error = **API_SPEC §2.3 + §6**; kode izin = **RBAC_MATRIX §4.5**; mekanika Feeder = **INTEGRATIONS §1.5–§1.10**; pola layar = **UI_UX_DESIGN §12**. Pengerjaan = **ROADMAP §2.11 gelombang 2**.

### 12.1 Peta permintaan pemilik → engine (ketertelusuran)

| # | Permintaan | Keadaan sebelum bab ini | Tempat sekarang |
|---|---|---|---|
| 1 | Smart Timetabling (CSP / GA / OR-Tools / backtracking) | belum ada; ALG-2 hanya praktikum, ALG-5 hanya insiden darurat | **ALG-8** §12.3 |
| 2 | KRS War (kontra atomik Redis, lock terdistribusi, pesimistis, BullMQ, SSE) | **sudah diputuskan** di §10 (opsi C) | tetap §10; direkonsiliasi §12.2.1–§12.2.2 (fencing epoch baru di sini) |
| 3 | Penasihat akademik & graf prasyarat (DAG, topologi, skor heuristik) | ALG-1 mensimulasikan jalur lulus; **rekomendasi isian KRS per mahasiswa** belum ada | **ALG-9** §12.4 |
| 4 | Early Warning / prediksi putus studi (ML lokal) | belum ada sama sekali | **ALG-10** §12.5 |
| 5 | Auto-fix & validasi Feeder (rule engine, regex, kemiripan teks) | kamus & aturan validasi ada di INTEGRATIONS §1.5; **mesin auto-fix lokal** belum dispesifikasi | **ALG-11** §12.6 + INTEGRATIONS §1.11 |
| 6 | Anti-pemalsuan geofence & QR dinamis (TOTP HMAC, haversine, IP/BSSID) | arah sudah ada (ROADMAP CE-6.1–6.3) tetapi **parameter kripto & ambang** belum | **ALG-12** §12.7 |
| 7 | Analitik capaian OBE/CPL kontinu (matriks berbobot, agregasi linear) | rantai objeknya sudah ada (`0032`); **algoritma hitung & rollupnya** belum | **ALG-13** §12.8 |
| 8 |_parser_ dokumen lokal (Tesseract/PaddleOCR/PDF.js) | **sudah ada** sebagai ALG-7 §11.9 | tidak diduplikasi |
| 9 | Jejak audit nilai tak-ubah dengan rantai hash SHA-256 | tabelnya sudah ada (`0034`, nama kanonik `grade_change_logs`); **algoritma rantai + verifier** belum | **ALG-14** §12.9 |
| — | Delta Sync Feeder + auto-retry *backoff* | retry & *backoff* ada di §10.4.1; **deteksi selisih (delta)** belum | §12.10 + INTEGRATIONS §1.12 |

### 12.2 Rekonsiliasi dengan norma yang sudah terkunci

Lima butir di bawah adalah permintaan yang **bertabrakan** dengan keputusan yang sudah diambil dan terbukti di kode. Tidak satu pun ditulis sebagai "alternatif"; masing-masing punya vonis.

#### 12.2.1 `SELECT … FOR UPDATE` pada jalur KRS War — diterima sebagian

Permintaan: klaim kuota dengan penguncian pesimistis di basis data. Norma: AGENTS §3.7 **melarang** decrement kuota di DB per-request; §10.1 memutuskan **opsi C** (lease Redis TTL 90 detik) dengan finalisasi `pg_advisory_xact_lock` per kelas di worker, dan §10.2 membuktikan alasan fisiknya (satu baris hanya bisa di-`UPDATE` serial; pada PgBouncer *transaction mode* dengan `max: 20`, `FOR UPDATE` menahan baris **sekaligus koneksi**).

**Vonis.** Mekanisme pesimistis **dipertahankan tetapi dipindah**: ia ada di jalur finalis worker (di mana lajunya dibatasi *limiter*, bukan oleh laju klik klien), tidak pernah di jalur klien. `SELECT … FOR UPDATE SKIP LOCKED` juga tetap dipakai, untuk tujuan yang sama sekali berbeda — **klaim antrean job engine** (§11.2) — dan tidak boleh disebut sebagai penguncian kuota. Satu-satunya tempat `FOR UPDATE` pada baris `classes` yang sah adalah transaksi finalisasi §10.3.5 langkah 6; selebihnya temuan.

#### 12.2.2 Redlock — **DITOLAK sebagai penjamin kursi**; target lease + fencing durable

Redlock tidak dipilih untuk M-13: distributed lock tidak menggantikan transaksi DB, constraints, idempotensi atau penolakan worker stale. Ini bukan klaim bahwa setiap penggunaan Redlock selalu fail-open atau bahwa single-primary otomatis linearizable setelah failover. Lua/SET atomic pada satu server tidak menjamin write bertahan saat primary berganti; hilangnya lease **tidak otomatis fail-closed atau refund kursi**.

| Butir target | Kontrak keselamatan |
|---|---|
| Epoch | Monoton dengan issuance/high-water durable di DB; tidak reset bersama Redis. Domain konflik lease, student-period dan kelas harus disepakati pada DDL/implementasi 0030 |
| Salinan | Redis lease dan payload job membawa epoch yang sama dengan durable receipt; keduanya bukan sumber otoritatif epoch |
| Finalizer | Dalam transaksi yang menserialisasi baris terkait, cek epoch, owner, status, expiry dan conditional transition; SELECT equality tanpa serialisasi tidak menutup race cancel/expiry-vs-commit |
| Efek sekali | Unique enrollment + durable idempotensi + counter hanya untuk insert baru; basket/op/audit/outbox commit bersama |
| Recovery | Freeze admission, fence worker lama, rekonsiliasi committed/held/in-flight sebelum membuka epoch baru. TTL/keyspace notification bukan recovery ledger |

Mekanisme penerbitan epoch, topologi Sentinel **versus** Cluster, budget dan bukti fault-injection masih gate `RD-11`/`P-6`; tabel ini **bukan implementasi yang terpasang**. Rincian atomic hash-slot dan receipt-before-202 di §10.3.

#### 12.2.3 OR-Tools / solver luar — memenuhi zero-API-key, tetapi bukan jalur utama

OR-Tools (Apache-2.0) tidak memerlukan API key dan tidak mengirim data keluar, jadi ia **tidak** dilarang ADR-14. Yang benar: ia **bukan dependensi repo ini**, tidak dapat dibundle ke proses Node Next.js, dan akan menjadi biner asing yang hasilnya tidak dapat direproduksi oleh golden vector CI. Karena itu:

- jalur **utama** ALG-8 = backtracking + *constraint propagation* TypeScript murni (inti logika tanpa I/O, sesuai §11.1);
- OR-Tools CP-SAT hanya **akselerator** di container worker milik sendiri (`or-tools` di image terpisah, tanpa kredensial), dengan kontrak keluaran identik dan gerbang penerimaan: pada *instance* fixtured yang sama hasilnya harus **tidak lebih buruk** daripada jalur TS (biaya lunak) dan **tidak boleh** meloloskan pelanggaran kendala keras;
- status **design-only** — ditulis dengan pola yang sama seperti baris `bullmq`/`ioredis` di TECH_CONVENTIONS §6, tidak boleh diklaim siap.

#### 12.2.4 Model ML luar-runtime (ONNX Runtime / *worker* Python) — dua tahap, keputusan terbuka

Inference lokal memenuhi zero-API-key, tetapi runtime Python/ONNX berarti **container tambahan** di jalur ADR-10 (Fargate) dan jalur rilis model terpisah. Tahapan yang mengikat:

- **v1 (wajib lebih dulu):** model diekspor menjadi **koefisien regresi logistik** atau **daftar pohon dangkal** dalam JSONB berversi, diskor oleh evaluator deterministik di *worker* SICA dengan aritmetika `numeric` → paritas Next.js ↔ Flutter (AGENTS §3.4) tetap terjaga dan tidak ada runtime baru.
- **v2 (terbuka, belum diputus):** ONNX Runtime atau *worker* Python bila dan hanya bila v1 tidak mencapai ambang metrik §12.5.5. Ini menjadi **keputusan produk `P-11`** dan **tidak boleh** disebut di dokumen mana pun sebagai kemampuan yang sudah ada.

#### 12.2.5 Nama objek & nama berkas yang diminta — memakai yang menang, bukan membuat kembaran

| Nama diminta | Vonis | Dasar |
|---|---|---|
| `grade_audit_logs` | **kalah** — nama kanonik `grade_change_logs` | DATA_MODEL §14.8 (arbitrase nama) + `0034_audit_immutability.sql`; membuat tabel kedua untuk fakta sama adalah pola `RD-32` yang sedang diberangi |
| `pddikti_staging_tables` | **sudah ada**, tujuh tabel per domain | DATA_MODEL §16.4 / `0031_pddikti_staging.sql` — yang kurang hanya algoritma delta (§12.10) |
| `docs/INTEGRATION_SPEC.md` | **tidak dibuat** | berkas itu tidak pernah ada; specs Feeder yang riil = `INTEGRATIONS.md` (ralat yang sama sudah tercatat di PROGRESS_REPORT & ROADMAP §2.6) |
| ApexCharts + `focus:border-blue-600 focus:ring-blue-500` | **ditolak** | grafik = primitif SVG nol-dependensi (`velzon-chart.tsx`) dan primary = hijau Velzon `#0ab39c` sebagai satu-satunya token; normanya ditulis di UI_UX_DESIGN §11.11 |

### 12.3 ALG-8 · Smart Timetabling Engine (CSP + propagasi + perbaikan)

**Fungsi** Menyusun jadwal perkuliahan satu periode: penugasan setiap **permintaan sesi** (matakuliah × kelompok × pengampu × jumlah peserta) ke `(hari, slot jam, ruang)` — atau memperbaiki jadwal yang sudah ada — tanpa bentrok dan dengan kualitas terbaik yang tercapai dalam *budget*.

**Kendala keras** (harus nol pelanggaran; bukan *soft cost* besar):
| # | Kendala | Sumber data |
|---|---|---|
| H-1 | satu mahasiswa/kelompok tidak punya dua sesi pada irisan jam | `enrollments` + `class_distributions` + `int4range &&` |
| H-2 | satu **ruang** tidak dipakai dua sesi beririsan | `rooms` + `class_schedules` |
| H-3 | satu **pengampu** tidak mengajar dua kelas beririsan; tidak di luar hari diizinkan | `class_assignments` + `lecturer_availability` (BARU) |
| H-4 | kapasitas ruang ≥ peserta; tipe & fasilitas ruang memenuhi kebutuhan matakuliah | `rooms.capacity`, `room_type`, `facilities jsonb` |
| H-5 | alat/lisensi memadai (praktikum) | `lab_resource_capabilities` (§17.3, milik ALG-2 — **dipakai ulang, tidak dibuat kembaran**) |
| H-6 | jam harian/mingguan pengampu tidak melewati ambang (beban BKD) | `academic_rules` (parameter berversi) |
| H-7 | tidak ada dua sesi paralel identik untuk kelompok yang sama; sesi tidak melewati jam operasional kampus | `time_slots` |
| H-8 | **waktu pindah antar-gedung**: sesi berikutnya hanya bila jarak-tempoh cukup | `room_distance_penalties` (§17.7, dipakai ulang) |

**Kendala lunak** (diperbaiki, boleh dikorbankan, bobot dari `academic_rules`): sebaran hari yang merata, jam favorit pagi, hindari sesi tunggal 3 SKS di sore Jumat, stabilitas terhadap semester sebelumnya (jumlah perpindahan minimum), preferensi pengampu, utilisasi ruang.

**Algoritma — tiga tahap, urutannya tidak boleh dibalik:**
1. **Penyaringan domain (propagasi awal).** Untuk setiap permintaan, domain awal `hari × slot × ruang` dipangkas oleh semua kendala **unari** (H-4, H-6, H-7, ketersediaan pengampu per hari). Permintaan yang domainnya menjadi kosong → temuan `UNFEASIBLE_REQUEST` dengan alasan unary-nya; ini bukan kegagalanengine, ini jawaban.
2. **Pencarian.** Backtracking **DFS + *forward checking* + AC-3** pada kendala biner (H-1, H-2, H-3, H-8) dengan: urutan variabel = *demand* terbesar lalu derajat tertinggi (*largest-demand, most-constrained-first*); urutan nilai = biaya lunak terendah lebih dulu; **conflict-directed backjumping** (kembali ke variabel yang benar-benar terlibat konflik, bukan satu level); `max_backtrack` & `max_seconds` dari `budget`. Kompleksitas: AC-3 `O(e · d³)` untuk propagasi awal; DFS terburuk eksponensial **tetapi terpangkas** — dan ini yang diukur, bukan diklaim.
3. **Perbaikan lokal (anytime).** Bila solusi layak tercapai, jalankan **min-conflicts / *late-acceptance*** dengan PRNG ter-*seed* (`xorshift128+`, seed disimpan di `engine_runs`) untuk menurunkan biaya lunak; **algoritma genetika diterima sebagai opsi** dengan syarat ketat: populasi dimulai dari solusi layak hasil tahap 2 (GA yang memulai dari solusi tidak layak akan "menghitung" pelanggaran sebagai biaya), elitisme 1, *seed* tersimpan, dan **tidak pernah** menjadi satu-satunya jalur — GA tidak memberi jaminan kelayakan, sedangkan jadwal adalah kendala keras.

**Keluaran dan kejujuran.** `timetabling_runs` + `timetabling_assignments` (status `DRAFT`). engine mengembalikan: (a) solusi layak + biaya lunak + **batas bawah** biaya (Σ paket kendala lunak terendah yang mungkin), (b) bila tidak layak: **inti konflik** — himpunan permintaan & kendala minimal yang membuat mustahil, seperti `explain` ALG-2/ALG-5, (c) parsial bila *budget* habis, dengan keterangan jujur `PARTIAL_BUDGET_EXHAUSTED`. **Dilarang** menampilkan jadwal parsial sebagai "selesai".

**Penulisan.** Hasil tidak pernah menyentuh `class_schedules` langsung. Penerapan = aksi `VALIDATE` Admin Akademik yang memanggil service domain yang sudah ada (guard L1–L6, `pg_advisory_xact_lock` per kelas, audit + outbox) — corak yang sama dengan §11.7.

**Kompleksitas target ukur** `[TIDAK-TERVERIFIKASI — belum diukur di repo ini]`: 1 prodi × 120 permintaan × 5 hari × 8 slot × 12 ruang ≈ domain 48.000 tuple per permintaan sebelum propagasi; tahap 1 memangkas 1–2 orde; target `budget` 30 detik di *worker*. Skala satu fakultas (1.200 permintaan) **wajib** dipecah per prodi menjadi beberapa *run* — satu *run* tidak boleh menahan *worker* lebih dari *budget*.

**Mode turun** tanpa `lecturer_availability`: H-3 dibatasi hanya pada bentrok antar-sesi (bukan hari yang diizinkan), hasil membawa `degraded: "NO_LECTURER_AVAILABILITY"`. Tanpa `rooms.fasilitas` terisi: H-4/H-5 dilewati dan **dilaporkan sebagai kendala yang tidak ditegakkan**, bukan diasumsikan lolos.

### 12.4 ALG-9 · Academic Advisor & Prerequisite Graph Scorer

**Fungsi** Untuk satu mahasiswa pada periode `OPEN`: daftar matakuliah **yang sah diambil** beserta peringkat dan alasannya — bahan diskusi dosen wali dan bahan isian KRS mahasiswa. Ini jawaban atas "ambil apa semester depan", yang **bukan** bagian ALG-1 (ALG-1 mensimulasikan jalur, bukan menyarankan isian).

**Tahap 1 — kelayakan keras (saring, bukan skor).** Prasyarat terpenuhi (`course_prerequisites`, ADM-3) · tidak bentrok jadwal dengan rencana yang sudah dipegang · kuota kursi (`krs_offering_seats`, §16.1) · plafon SKS BR-A2 dan plafon nasional NFR-R2 · status mengulang diizinkan `academic_rules.late_krs_mode` · entitlement modul aktif. Yang gugur di sini **tidak muncul** dengan skor rendah — ia tidak ditawarkan, dan alasannya dikembalikan (`denialreason`, FR-ADM-11).

**Tahap 2 — skor heuristik (basis poin integer, bukan float).** Komponen, masing-masing terdefinisi dari data tenant sendiri:

| simbol | isi | cara hitung |
|---|---|---|
| `crit(mk)` | **mengunci berapa SKS berikutnya** | Σ SKS seluruh *descendant* `mk` pada DAG prasyarat — DP *reverse topological* `O(V+E)`; dinormalkan ke `0..10000` |
| `termfit(mk)` | hanya dibuka pada term ini? | `nextOpenTerm` (tabel prahitung ALG-1) — matakuliah yang terbuka 1×/2 tahun naik pangkat |
| `pathdelta(mk)` | percepatan lulus | selisih estimasi term lulus antara skenario "tanpa `mk`" dan "dengan `mk`" — **delta** di atas tabel DP ALG-1, bukan simulasi ulang |
| `hist(mk, mhs)` | kecocokan rekam jejak | rata-rata nilai mahasiswa pada matakuliah sejenis + selisih IPK; **pembilang dan penyebut ditampilkan** |
| `passrate(mk)` | tingkat kelulusan matakuliah | agregat `grades` historis; **kunci kejujuran:** bila `n < 30`, pakai rata-rata prodi dan tandai `LOW_SAMPLE` — angka matakuliah yang baru diajarkan 2 kali tidak boleh tampak meyakinkan |
| `workload(mk)` | tafsir beban | `sks_total` + rasio praktik/teori dari `courses.sks*` |

`score(mk) = Σ (bobot_bp_komponen × nilai_ternormalk) / 10000`, bobot per komponen tersimpan di `academic_rules` dengan `parameter_version` (ADR-17) sehingga prodi dapat mengubah filosofi tanpa rilis kode. Peringkat `O(n log n)`.

**Tahap 3 — bundel rencana.** Rekomendasi yang baik adalah **set** yang saling layak (tidak bentrok, total SKS ≤ plafon), bukan daftar per matakuliah. Dicari dengan *greedy* terurut skor + perbaikan *swap* terbatas (budget sama seperti §11.2). Sifat yang **boleh** diklaim: himpunan hasil selalu lolos kendala keras. Yang **tidak boleh**: klaim optimalitas subset (it knapsack + bentrok; NP-hard). Yang dikembalikan: `best_set`, `best_known_alternative`, `gap_vs_greedy_first`.

**Pemasangan ke alur nyata.** Skor dihitung untuk mahasiswa **oleh** *worker* (batch per angkatan) dan dibaca **oleh** dua pihak: dosen wali (`/dosen/wali/mahasiswa/:id`) dan mahasiswa (`/krs/rekomendasi`) — dengan proyeksi server yang sama, tidak boleh mahasiswa melihat catatan internal wali (`FIELD_RULES`, `SERVER_ONLY`). Penempatan/penggantian dosen wali memakai `advisement_assignments` (`0016`) dan **memakai ulang** Gale-Shapley ALG-3, tidak membuat mesin penugasan kedua.

**Invariance.** (a) Tidak ada rekomendasi yang prasyaratnya belum terpenuhi; (b) total SKS rekomendasi ≤ plafon, termasuk plafon nasional; (c) rekomendasi **tidak pernah** mendaftar otomatis — tombol "Terapkan" memanggil `enrollment.krs.submit` dengan seluruh gerbangnya; (d) siklus prasyarat → `422 PREREQ_CYCLE`, bukan peringkat palsu; (e) setiap rekomendasi membawa ≥ 1 `reasons` yang dapat dibaca manusia (`MENGGUNCI_12_SKS`, `HANYA_DIBUKA_GENAP`, `JADWAL_TIDAK_BENTROK`, `SAMAI_DENGAN_DIAMBIL_2024`).

**Mode turun.** Tanpa `course_prerequisites` (migrasi `0008`) komponen `crit`/`pathdelta` = nol dan hasil hanya berbasis sisa SKS + ketersediaan term, dengan `degraded: "NO_PREREQ_DATA"` **tampil di layar**. Tanpa riwayat nilai ≥ 2 periode, `hist`/`passrate` dinonaktifkan. Peringatan produk: rekomendasi tanpa prasyarat hanyalah daftar matakuliah — dan itu harus dikatakan begitu.

### 12.5 ALG-10 · Early Warning System / Dropout Risk Scorer

**Fungsi** Memperingatkan **pencegahan** lebih dini: risiko putus studi / telat lulus / proaktivitas akademik untuk tiap mahasiswa per periode, lengkap dengan faktor penyebab dan rute tindak lanjut.

**Vonis arsitektur lebih dulu.** Ini engine **prediksi**, bukan engine **keputusan**. Keluarannya **tidak pernah** mengubah `students.status_akademik`, tidak membuka/menutup gerbang KRS, tidak mengubah tagihan, dan tidak menjadi dasar kelulusan atau beasiswa. Tindak lanjut selalu aksi manusia (wali → kontak; BAAK → status; BAUK → skema pembayaran). Alasan: akurasi prediktor sosial-ekonomi-akademik di kampus Indonesia belum terukur, dan konsekuensi kesalahan tidak boleh jatuh otomatis ke mahasiswa.

**Fitur (semuanya dari data tenant sendiri — nol egress):** kehadiran < 75 % (per sesi, tren 4 minggu terakhir, rasio sesi tercatat vs sesi jurnal) · IPK terkini dan **delta** 2 periode · kecepatan studi = `kumulatif_sks / (semester_terdaftar × sks_target_per_semester)` · jumlah mengulang dan nilai `E`/`T` · KRS tidak diisi pada periode lewat (`enrollments` kosong) · keterlambatan/penunggakan pembayaran (`invoices.status`, `payment_windows`) · dispensasi aktif · status cuti · interaksi LMS (log akses) · riwayat RPL/MBKM · usia studi vs masa studi maksimal (BR-S). **Dilarang sebagai fitur** (hard-code *denylist*, diuji CI): agama, suku, kewarganegaraan, jenis kelamin, disabilitas, asal sekolah, jalur masuk, kelompokAbility bayaran orang tua sebagai prediktor tunggal.

**Model v1 (mengikat lebih dulu).** Regresi logistik atas fitur terstandar, **atau** GBDT dangkal (`depth ≤ 3`, `trees ≤ 60`), keduanya disimpan sebagai artefak terbaca-manusia:
`model_versions(features jsonb, coefficients jsonb | trees jsonb, train_window, n_train, n_eval, auc, pr_auc, brier, calibration jsonb, fairness jsonb, trained_by, approved_by, status)`.
Penyimpanan sebagai JSONB memberi tiga hal yang tidak diberikan biner opaque: dapat di-*diff*, dapat direproduksi dari snapshot, dan dapat dijelaskan ke auditor akreditasi. Skor = `numeric(6,5)` di DB; kalibrasi **isotonik** (monoton, deterministik) sehingga angka dapat dibaca sebagai probabilitas.

**Pelatihan.** *Worker* terpisah, **di luar** jendela puncak; data latih **tidak pernah** lintas-tenant (isolasi = hak atas data, UU PDP; model prodi A tidak boleh melatih prodi B tanpa persetujuan eksplisit sebagai konfigurasi). Pemisahan waktu: latih pada periode ≤ N−2, uji pada N−1, jalankan prediksi pada N — tanpa *leakage* (fitur yang nilainya baru tersedia setelah peristiwa yang diprediksi **dibuang**).

**Gerbang mutu (menolak membuka fitur, bukan menolak angka).** AUC *holdout* ≥ **0,70** dan Brier ≤ **0,18** di tenant itu sendiri; bila tidak tercapai, layar hanya menampilkan **aturan keras** yang deterministik (kehadiran < 75 %, KRS kosong, tunggakan > 30 hari, delta IPK < −0,30) sebagai temuan, tanpa skor probabilitas dan tanpa kata "prediksi". Aturan ini ada supaya kampus tidak mendapat angka yang tampak meyakinkan padahal tidak lebih baik dari tebakan.

**Pergeseran (drift).** `psi` (population stability index) per fitur tiap periode; `psi > 0,25` → bendera `MODEL_STALE` di hasil + usulan pelatihan ulang yang butuh `VALIDATE`. Tidak ada *retraining* otomatis diam-diam: model yang menentukan siapa dipanggil konseling adalah **konfigurasi berversi** (ADR-17), bukan efek samping cron.

**Penjelasan.** Untuk regresi logistik: kontribusi linier tiap fitur (`w_i × z_i`) — eksak. Untuk pohon dangkal: jalur keputusan yang dilalui + kontribusi tiap belah — eksak dan murah. `top_factors[3]` selalu ikut; lencana di UI menampilkan **penyebab**, bukan hanya skor (UI_UX_DESIGN §12.4).

**Alur tindak lanjut.** Temuan EWS → `study_warnings` (`0016`) dengan status `OPEN → CONTACTED → RESOLVED / ESCALATED`, pemilik (wali / BAAK / kemahasiswaan), dan jejak `audit_logs`. Retensi kelas akademik; hak baca hanya wali yang bertugas, BAAK, dan mahasiswa sendiri (proyeksi server).

**Kompleksitas & penempatan.** Skor v1 `O(n · f)`; 10.000 mahasiswa × 20 fitur = ordo 2·10⁵ perkalian → di bawah 1 detik di *worker*. *Run* dijadwalkan mingguan +-on-demand menjelang akhir periode. Mode turun: fitur kehadiran kosong → hasil `degraded: "NO_ATTENDANCE_FEED"` dan aturan kehadiran tidak diklaim.

### 12.6 ALG-11 · Feeder Pre-Validation & Auto-Fix Rule Engine

**Fungsi** Sebelum satu bait data dikirim ke PDDikti Neo Feeder: uji di **titik input** (AC-FDR-2), perbaiki yang murni salah format, dan usulkan sisanya untuk persetujuan manusia. Tujuan bisnis: memangkas 11 penolakan Checkpoint 1/2 dan mencegah `feeder_id` palsu masuk ke record pusat (I-14).

**Mesin = ALG-4, bukan mesin kedua.** Aturan Feeder dieksekusi oleh **jaringan RETE yang sama** (§11.6) dengan `fact_types` domain Feeder dan `scope` baru. Yang membuat RETE (bukan `if/else`): ribuan baris × puluhan aturan, aturan **berversi per periode kamus**, dan kebutuhan menjelaskan aturan mana yang menyala. Regenerasi katalog kamus (`reference_dictionary_versions`) memicu evaluasi ulang, bukan rilis kode.

**Kategori aturan (menentukan hak bertindak):**
| `kind` | Boleh | Contoh |
|---|---|---|
| `FORMAT` | **perbaiki otomatis** di salinan staging | rapikan spasi ganda, `UPPER` nama, tanggal → `YYYY-MM-DD`, `08xx` → `+62…`, buang titik/nama gelar dari kolom nama, hapus karakter kontrol |
| `ENRICH` | isi otomatis **dari data lokal** | `id_reg` prodi dari `pddikti_mappings`, kode akreditasi dari `programs`, `sks` dari `courses` |
| `IDENTITY` | usulkan pasangan, **tidak** menulis `feeder_id` | padanan mahasiswa lokal ↔ baris Feeder hasil *pull* |
| `SEMANTIC` | **hanya usulkan** | NISN tidak lolos periksa digit, status mahasiswa tidak cocok kamus, TTL < 17 tahun, SKS per jenis > 9 atau = 0 |
| `BLOCKING` | tolak kirim | NIK bukan 16 digit, email tanpa `@`, tanggal lulus sebelum tanggal masuk, `feeder_id` kosong saat baris sudah pernah dikirim |

**Pemeriksaan yang diikat sebagai aturan (bukan gaya bahasa):** `NIK` 16 digit + 6 digit awal harus ada di kamus wilayah Kemendagri (`reference_items`) — **catatan jujur: NIK tidak punya *checksum***, jadi yang bisa diperiksa hanya panjang, pola, dan keberadaan kode wilayah. `NISN` 10 digit **memiliki** rumus digit pemeriksaan; rumusnya disimpan sebagai **baris kamus berversi**, dan rumus yang dipakai wajib berasal dari dokumen resmi yang di-*seed* (SEED_DATA), **bukan** dari hafalan agen. `ID Reg` 10 karakter alfanumerik. `NIM` mengikuti `tenant_settings.format_nim` (regex berversi). SKS per jenis `≠ 0` dan `≤ 9` (DATA_MODEL §14.5). Paritas semester & periode aktif. Nama: **tidak pernah** dibetulkan secara diam-diam bila perubahannya mengubah identitas (lihat ambang di bawah).

**Pencocokan kemiripan (inti "auto-fix" dan bagian paling berbahaya).** Ruang kandidat dibatasi **milik tenant sendiri**, jadi ini *grounding* — bukan pembentukan teks.
1. **Normalisasi** (baku, urut): NFKC → *casefold* → hapus tanda baca → rapikan spasi → kanalisasi homoglyf OCR (`O→0`, `I→1`, `S→5`) **hanya pada kolom angka**, buang *diacritic* untuk keperluan banding saja (nilai resmi tetap apa adanya).
2. **Pembangkit kandidat (blocking)** — wajib, karena banding semua-ke-semua `O(n²)` tidak masuk *budget*: kunci blok `substr(norm,1,3)`, `kode_wilayah_nik(1:5)`, `tanggal_lahir`, `prodi_id`. Kandidat hanya dibandingkan dalam blok yang sama + indeks **BK-tree** atas jarak edit (atau *SymSpell*-style *delete variants* untuk kamus judul matakuliah).
3. **Ukur:** **Jaro–Winkler** untuk nama orang (`JW = J + l·p·(1−J)`, `l ≤ 4`, `p = 0,1` — pembobotan awalan cocok untuk nama yang salah ketik di bagian akhir); **Levenshtein** untuk kode pendek (NIK/NIM/`id_reg`; jarak ≤ 1 untuk `≤ 10` karakter, ≤ 2 untuk lebih panjang, dengan syarat **satu-ke-satu**); **Dice/Jaccard atas 3-gram** + TF-IDF *cosine* untuk judul matakuliah panjang.
4. **Vonis bukan dari skor mentah, tapi dari skor **dan** selisih peringkat** (`margin`) terhadap kandidat kedua: `≥ 0,95` **dan** `margin ≥ 0,10` **dan** tepat satu kandidat → `AUTO`; `0,80–0,95` **atau** margin tipis → `REVIEW`; `< 0,80` atau multi-kandidat setara → `NO_MATCH` (kosong + tautan bukti). Nilai ambang disimpan di `academic_rules` per tenant.
5. **Penugasan satu-ke-satu**: *greedy* terurut skor, atau Hungarian `O(n³)` bila `n ≤ 60` — agar satu baris Feeder tidak dipasangkan ke dua mahasiswa.

**Keamanan yang tidak boleh hilang (invariance).** (a) Auto-fix **hanya** menyentuh salinan staging/kolom yang ditujukan ke Feeder — tidak pernah menulis `students`, `enrollments`, `grades`; koreksi sumber data = permintaan + `VALIDATE` (BR-R10, tanpa *hard delete*). (b) `feeder_id` hanya boleh terisi dari respons *bridge* (I-14); pasangan kemiripan setinggi apa pun **tidak** memberi hak menulis id pusat. (c) Setiap perbaikan menghasilkan baris `feeder_autofix_suggestions(rule_code, kind, before, after, score, verdict, applied_by)` — reversibel dan ter-*diff*; aturan `FORMAT` yang diterapkan otomatis memakai kunci `(run_id, record_key, rule_code)` sehingga pengulangan *run* tidak menggandakan perubahan. (d) Gerbang kirim tetap dua orang (`validated_by <> decided_by`, API_SPEC §2.3 baris 55/56). (e) Aturan itu sendiri disahkan lewat empat-mata — sama seperti aturan predikat ALG-4.

**Kompleksitas & penempatan.** Evaluasi aturan `O(aturan × kolom)` per baris; 10.000 baris × 60 aturan = ordo 6·10⁵ uji — *worker*, bukan rute. Pencocokan identitas = bagian mahal; dengan blocking, total kerja turun ke `O(n · k)` dengan `k` = ukuran blok (target `k ≤ 50`). Hasil *run* ditulis ke `pddikti_validation_runs` **sebagai view atas `pddikti_sync_runs`** (DATA_MODEL §16.4 — keputusan nama sudah diambil, jangan membuat tabel kedua).

### 12.7 ALG-12 · Attendance Anti-Fraud: QR Berotasi + Geofence + Sinyal Perangkat

**Fungsi** Menekan titip-absen pada presensi mobile tanpa mengirim apa pun keluar infrastruktur (zero-API-key) dan tanpa memungut hak privasi berlebih.

#### 12.7.1 Token berotasi 5 detik (TOTP-HMAC, bentuk kanonik)

```
secret        = HKDF-Expand-SHA256(IK_attendance[tenant], info = session_id || period_id)   // 32 B, server-only
counter       = floor(unix_seconds_now / 5)                                                   // rotasi 5 detik
message       = counter(8 B, big-endian) || session_short(8 B) || room_seq(2 B)
mac           = HMAC-SHA256(secret, message)  →  truncation RFC 4226 → 9 digit desimal
payload QR    = "SICA1" | base32(session_short) | counter | mac9                              // ± 34 karakter
```

| butir | aturan | kenapa |
|---|---|---|
| kunci | `IK_attendance` = kunci **terpisah** per tenant dari DEK PII (§3.7 SECURITY), diturunkan per sesi, **tidak pernah** dikirim ke klien, **tidak pernah** muncul di URL/log | bocornya satu QR tidak mengungkap kunci; rotasi sesi membuat rekaman lama mati |
| waktu | server **tidak pernah** memercayai waktu klien; klien hanya mengirim `counter` yang tampil di QR dosen, dan server membandingkan dengan `C = floor(unix_server/5)` | tanpa ini, ubah jam ponsel = lulus selamanya |
| jendela terima | `counter ∈ {C−1, C, C+1}` (toleransi ± 5 detik) | memberi ruang latensi jaringan & render tanpa membuka *replay* |
| perbandingan | `timingSafeEqual` atas 9 digit; **bukan** `===` pada string yang di-*hash* | mencegah *oracle* waktu |
| sekali-pakai | `UNIQUE (tenant_id, session_id, counter)` di `attendance_token_uses` (tabel, bukan hanya Redis) — penggunaan kedua → `REJECTED_REPLAY` | Redis mati pun *replay* tetap tertolak (fail-closed §10.7) |
| *rate limit* | maksimal 3 upaya per `(student, session, 60 s)`, lalu `429` | menghentikan tebak-buta (ruang 10⁹ tetapi tetap jangan ditawar) |
| rotasi tampil | layar dosen me-render QR baru tiap 5 detik; **screenshot tidak berguna** karena `counter` berikutnya sudah bergeser | inti "dinamis" |
| tantang-balas | setelah pemindaian pertama, server menerbitkan **tantangan 6 digit** yang ditampilkan dosen (umur 5 s, sekali pakai) dan mahasiswa harus mengirimnya balik dalam 15 s | ini yang mematahkan "foto QR dikirim ke teman di rumah": pengirim jauh tidak bisa melihat tantangan berikutnya |

**Kenapa bukan NFC/bluetooth mutlak.** Buta keras terhadap perangkat: perangkat berbeda = sinyal, bukan vonis (lihat 12.7.3). **Kenapa bukan liveness/wajah.** Memerlukan layanan API berbayar dan memicu isu biometrik UU PDP; keluar dari jalur ini sampai ada keputusan produk tertulis.

#### 12.7.2 Geofence (jarak yang sadar-akurasi)

Titik acuan **milik server**, bukan badan permintaan (penutup `SEC-03`, ROADMAP CE-6.2): koordinat + radius disimpan di `rooms` (`longitude/latitude numeric(9,6)/numeric(9,6)`, `allowed_radius_m smallint default 75`, `max_accuracy_m smallint default 50`).

```
d = haversine(p_perangkat, p_ruang)                       // radius bumi 6371000 m, output meter
TERIMA hanya bila: accuracy_m ≤ rooms.max_accuracy_m
                  AND (d − accuracy_m) ≤ rooms.allowed_radius_m
TOLAK             : OUT_OF_FENCE | GPS_LOW_ACCURACY | NO_LOCATION_PERMISSION | MOCK_LOCATION_SUSPECT
```

Mengikat `d − accuracy ≤ radius`, bukan `d ≤ radius`: perangkat dengan akurasi 500 m tidak boleh "lulus" hanya karena pusat lingkarannya kebetulan dekat ruang. Deteksi *mock location*: `LocationManager.isFromMockProvider` (Android) / `mock` flag (iOS) → **temuan**, bukan penolakan tunggal (perangkat uji QA menghasilkan ini secara sah). Presisi tetap: `numeric`, bukan `float` (paritas Flutter, AGENTS §3.4).

#### 12.7.3 Sinyal perangkat dan skor kecurangan

Sinyal **boleh** menyumbang skor, **tidak boleh** menjadi vonis otomatis kecuali yang memang gerbang keras:

| sinyal | bentuk | catatan |
|---|---|---|
| IP | **dibaca server dari *request*** (`x-forwarded-for` hanya setelah middleware membersihkan nilai kiriman klien — pola `SEC-07`) | ASN/rumah ≠ kantor = bobot, bukan penolakan (kampus menyediakan Wi-Fi, mahasiswa berkuli dari kos) |
| BSSID | `room_network_allowlists(bssid_hash)` — disimpan sebagai **HMAC-SHA256 tenant-keyed**, bukan plaintext | BSSID mudah dipalsukan; ia **pelemah**, dan hash-nya mencegah kebocoran peta Wi-Fi |
| perangkat | `attendance_device_bindings(install_digest, …)` dengan `install_digest` = HMAC dari *install id* **lokal** (Keychain/Keystore) | *Firebase Installation ID* / Play Integrity butuh API Google → **dilarang** ADR-14; karena itu ikatan perangkat bersifat peringatan, bukan kunci |
| pergerakan mustahil | dua *scan* `< 10 menit` terpisah `> 5 km` untuk mahasiswa yang sama → `ANOMALY_IMPOSSIBLE_TRAVEL` | murah, deterministik, kuat |
| sebaran | N mahasiswa dari satu *device digest* pada sesi yang sama | temuan massal |

`fraud_score_bp = Σ (bobot_bp_sinyal × hadir_sinyal)` dengan bobot dari `academic_rules` per kampus; ambang `≤ 1500` terima, `1500–5000` → `PENDING_REVIEW` (masuk antrean banding `attendance_appeals`, `0017`), `> 5000` → `REJECTED_FRAUD_SUSPECT` + alasan + hak banding. Vonis ditulis ke kolom status yang **sudah ada** (`attendances.status`, enum terukur §15.1) — bukan kosakata baru.

#### 12.7.4 Pembagian tugas Web ↔ Flutter (AGENTS §3.4)

Dosen (Web): buka sesi → server turunkan `secret` → render QR berotasi + tantangan. Mahasiswa (Flutter): **tidak pernah** memegang `secret`; hanya memindai, mengirim `counter + mac9 + koordinat + akurasi + install_digest`. Verifikasi & seluruh perhitungan di server; *cache* lokal tidak boleh jadi otoritas. Mode turun: Redis/`attendance_token_uses` tidak terjangkau → **tolak presensi** (`503`), jangan terima tanpa sekali-pakai.

### 12.8 ALG-13 · OBE CPL Attainment Aggregator

**Fungsi** Menghitung capaian pembelajaran secara **berkelanjutan** (bukan hanya saat akreditasi): dari item penilaian → Sub-CPMK → CPMK → CPL → matakuliah → prodi → universitas, per semester, dan menutup loop ketika target tidak tercapai.

**Rantai objeknya sudah ada** (DATA_MODEL §16.2 / `0032_obe_outcomes.sql`): `program_outcomes` (Profil Lulusan & CPL) → `course_outcomes` (CPMK/Sub-CPMK) → `outcome_sub_components` → `assessment_indicators` → `grade_components` (Item Penilaian) → `outcome_matrix` (bobot CPL per matakuliah) → `outcome_attainments`. **Bab ini hanya mendefinisikan matematikanya**; membuat tabel capaian kedua adalah temuan `RD-32`.

**Rumus (semua `numeric`, basis poin, pembulatan *half-up* per langkah — bukan float):**
```
capaian_item(i)   = clamp((x_i − L_i) / (T_i − L_i), 0, 1)        // rubrik: L=sasaran "cukup", T=sasaran "baik", per indikator
sub_cpmk         = Σ (bobot_item_bp × capaian_item) / 10000
cpmk             = Σ (bobot_sub_bp      × sub_cpmk)     / 10000
course_to_cpl    = Σ (bobot_cpmk_bp    × cpmk)         / 10000
capaian_cpl_mk   = course_to_cpl × bobot_outcome_matrix_bp / 10000
```
Invariance penjumlahan ditegakkan di service **dan** pemicu *deferrable* (sudah diikat §16.2): `Σ bobot_item per Sub-CPMK = 10000`, `Σ bobot_outcome_matrix per CPL per kurikulum = 10000`. Bila tidak menutup → `422 WEIGHT_SUM_NOT_100` (kode lama API_SPEC §2.3; **tidak** membuat kode baru).

**Agregasi lintas mahasiswa — dua penyebut, keduanya disimpan.** Untuk satu matakuliah-per-CPL:
- `attainment_by_student` = rata-rata berbobot **SKS** atas `capaian_cpl_mk` tiap mahasiswa yang **punya bukti**;
- `attainment_by_class` = nilai dari **kelas terukur** (`n_evaluated`), dipakai laporan kelas;
- `coverage = n_evaluated / n_enrolled`.
Mahasiswa tanpa bukti (tidak hadir, nilai kosong, `EXCUSED`) **tidak** dihitung sebagai nol dan **tidak** dibuang tanpa jejak: mereka masuk `n_missing_evidence` dan menekan `coverage`. Angka capaian 0,85 dengan `coverage` 0,40 adalah temuan, bukan kemenangan — inilah cara yang jujur untuk laporan akreditasi.

**Rollup linear prodi → universitas.** Bukan rata-rata-rata-rata (itu membiaskan prodi kecil): agregat prodi = Σ(capaian_cpl_mk × sks_mk) / Σ sks_mk atas matakuliah yang memuat CPL itu; universitas = Σ(per prodi × total_sks_lulusan_prodi) / Σ total_sks. Karena agregasi linear, **sifat distributif berlaku**: hasil rollup harus sama dengan hitung ulang dari daun — dan itu **dijadikan tes CI** (satu fixtured kurikulum, bandingkan dua jalur, toleransi `0 bp`), bukan diyakini.

**Pemicu berkelanjutan.** Baris `grades` yang pindah ke `EFFECTIVE` (atau `LOCKED → koreksi → EFFECTIVE`) menerbitkan peristiwa **transactional outbox** (ADR-7) → *worker* memperbarui `outcome_attainments` **inkremental** untuk `(mk, CPL, periode)` terdampak: `O(mahasiswa_kelas)`, bukan re-gulp satu angkatan. Per **kunci periode** (`grading.lock`) dihitung penuh sebagai *snapshot* resmi dengan `inputs_digest`. Konversi MBKM (`0033`) ikut dengan penanda `weight_source = 'MBKM'` dan **tidak boleh** menghasilkan hitung ganda atas matakuliah internal yang sama (indeks unik parsial di §16.2 sudah menjaganya).

**Loop tertutup (`closing actions`).** Per `(kurikulum, CPL, angkatan)`: `target_cpl_bp` (mis. 7000 = capaian rata-rata ≥ 0,70). Kurang dari target → temuan `OBE_TARGET_MISSED` + **usul tindak lanjut** yang terikat ke matakuliah/indikator penyebab (bukan kalimat umum: "CPL-4 rendah pada Sub-CPMK 2 karena indikator laporan `n_evaluated` hanya 12"), disetujui `VALIDATE` Kaprodi, lalu **dipantau di siklus berikutnya** — karena bukti "loop tertutup" yang diminta asesor adalah: target → capaian → selisih → tindakan → capaian berikutnya, semuanya tertanggal dan dapat dilacak.

**Penjelasan & hierarki.** Setiap angka membuka *drill-down* universitas → prodi → matakuliah → CPL → indikator → item → sampel mahasiswa. Angka turunan tidak dapat diedit manual (`outcome_attainments` immutable-per-keadaan, `is_current`); koreksi = hitung ulang, bukan ketik ulang. Mode turun tanpa `grade_components`/`assessment_indicators` terisi: laporkan `degraded: "NO_INDICATOR_DATA"` dan **jangan** menyamakan "belum ada rubrik" dengan "capaian nol".

### 12.9 ALG-14 · Immutable Audit Chain Verifier (rantai SHA-256)

**Fungsi** Membuat jejak perubahan nilai (dan jejak sistem) **buktibel tak-ubah**: setiap baris menyimpan siapa, kapan, dari IP mana, nilai lama, nilai baru, alasan, dan **hash rantai** ke baris sebelumnya. Nama tabel yang dipakai: `grade_change_logs` dan `system_audit_trails` (DATA_MODEL §14.8 + `0034`) — **bukan** `grade_audit_logs`.

**Pembentuk rantai (normatif).**
```
canonical(row) = u8(type_code) || LE32(len) || bytes  untuk tiap field, secara berurutan:
                 tenant_id, stream, seq, occurred_at_us, actor_user_id, action,
                 entity, entity_id, old_value, new_value, reason, ip, request_id
record_hash      = SHA256( prev_hash(32 B) || canonical(row) )
```
- **Prefiks panjang wajib ada.** Rangkaian `a||b` tanpa panjang bersifat ambigu secara kriptografis: baris `(old="12", new="34")` dan `(old="123", new="4")` menghasilkan masukan yang sama. Ini bukan gaya, ini penolakan terhadap tabrakan yang disengaja.
- `stream` = `(tenant_id, table_name, entity_id)` untuk jejak per objek; rantai **bercabang per stream**, bukan satu rantai global — satu rantai global memaksa seluruh tulis nilai serial (persis yang dilarang §10.2).
- `seq` monoton per stream; **genesis** per stream diisi saat *partition* dibuat, tersimpan di `audit_chain_heads(tenant_id, partition_start, stream, head_hash, head_seq, updated_at)`.
- Penulisan: **satu** `pg_advisory_xact_lock(hashtextextended(stream_key, 0))` per stream di dalam transaksi yang sama dengan perubahan nilai + `audit_logs` + outbox. Hash dihitung di *worker*/aplikasi (bukan pemicu PL/pgSQL) supaya kanonisasi dapat diuji unit dan **identik** dengan verifier; DB menyimpan heksadesimalnya saja.
- Insert-only ditegakkan **bertingkat** (urutan ini penting, sudah diikat §16.3): `REVOKE UPDATE, DELETE` → `policy` SELECT-only → pemicu `app.reject_mutation()`. Peringatan yang tetap ditulis di sini: RLS saja **tidak** cukup, karena `sica_owner`/superuser melewatinya; yang menghentikannya adalah pemicu.

**Verifier (yang membuat klaim "tak-ubah" berarti).**
| mode | kerja | kompleksitas |
|---|---|---|
| inkremental | setiap append: `hash(prev_head) → cocok?` — dijaga di jalur tulis | 1 SHA256 per baris |
| audit periodik | *worker* memindai partisi per stream, membandingkan `seq` (celah), `prev_hash` (percabangan), `record_hash` (isi diubah) | `O(n)` SHA256; 1 juta baris ≈ menit, jalan di luar puncak |
| jangkar | **akar Merkle** per `(partition, stream, 1.000 daun)` → `audit_chain_anchors(root, leaf_count, sealed_at)`; akar hariannya dirangkai ke akar-hari-berikutnya | 1 hash per 1.000 baris; verifikasi 1 baris cukup `O(log n)` bukti |

**Jangkar luar — vonis jujur.** *Timestamping* RFC 3161 / *certificate transparency* adalah **layanan eksternal** yang memerlukan kredensial → **ditolak** oleh ADR-14 untuk jalur wajib. Penggantinya tanpa API: (a) *object storage* WORM (*S3 Object Lock*) atas berkas ekspor jangkar — milik akun sendiri, bukan layanan AI; (b) salinan jangkar di **tenant-platform** terpisah (`PLATFORM_OPERATOR`) sehingga tenant tidak dapat mengubah sejarah sendiri; (c) ekspor jangkar bulanan ke PDF bertanda tangan internal untuk kebutuhan hukum. Klaim yang boleh ditulis di laporan: "rantai dapat diverifikasi dan jangkar disimpan di luar kendali tenant"; **bukan** "dijamin oleh pihak ketiga".

**Perilaku saat gagal.** Temuan `CHAIN_GAP` / `CHAIN_BRANCH` / `HASH_MISMATCH` = alarm **CRITICAL** + *gate* CI menolak + rilis diblokir (selaras §7.2). Yang **dilarang keras**: "memperbaiki" dengan menghitung ulang hash — itu justru bentuk pemalsuan yang ingin dideteksi. Prosedurnya: bekukan partisi, tandai `compromised_at`, jalur investigasi, laporkan.

**Isi wajib per baris nilai** (permintaan pemilik, dipetakan ke kolom nyata): `actor_user_id`, `occurred_at`, `ip_address` (dari *request* yang dibersihkan middleware, bukan badan), `old_letter/old_point/old_status`, `new_letter/new_point/new_status`, `reason NOT NULL`, `approved_by` dengan `approved_by <> actor_user_id` (SoD BR-G4), `request_id`, `record_hash`, `prev_hash`, `seq`. Retensi mengikuti kelas retensi §16.5 (WORM, tidak dapat dipangkas sebelum waktunya).

### 12.10 Delta Sync Feeder (mekanika, bukan engine)

Yang diminta: hanya mengirim yang berubah. Realita: §10.4.1 sudah menetapkan `feeder.push` dengan *backoff* eksponensial + `attempts` + DLQ, dan §16.4 sudah menetapkan staging *append-only*. Yang belum ada adalah **cara menentukan himpunan "berubah"**.

```
sync_watermarks(tenant_id, domain, entity, last_committed_at, last_run_id, row_count, digest)

1  kandidat  = baris staging yang (updated_at > last_committed_at)
                 ATAU punya baris audit transisi setelah watermark (perubahan keadaan),
                 ATAU tercatat sebagai pembatalan/koreksi (tombstone — hard delete dilarang BR-R10)
2  saring    = hitung record_digest = SHA256(kanonis(kolom yang ditujukan ke Feeder)) per baris
                 bandingkan dengan digest pada feeder_identities/pull terakhir
                 -> sama = SKIP (tidak dikirim, tidak membakar kuota vendor)
3  urutkan   = deterministik: (kind: CREATE sebelum UPDATE), (tanggal masuk), (record_key)
                 supaya resume parsial tidak mengirim anak sebelum induk
4  kirim     = per record: Idempotency-Key = hash(tenant, domain, record_key, digest)  (UNIQUE di feeder_jobs)
5  catat     = setelah berhasil: simpan feeder_id_returned ke feeder_identities, geser watermark hanya untuk baris yang
                 benar-benar sukses; baris gagal TIDAK menggeser watermark
6  retry     = backoff eksponensial + jitter (sudah dinormakan §10.4.1); kegagalan terminal -> DLQ + temuan BLOCK
7  rekonsiliasi = pull state pusat (Get*) -> pddikti_reconciliation_diffs -> butuh dua orang (§16.4)
```

Tiga aturan yang membuat ini aman: (a) **watermark hanya maju atas baris yang sukses** — kalau tidak, satu kegagalan membuat barisnya tidak pernah dikirim lagi; (b) **`feeder_id` hanya dari respons** *bridge* (I-14); (c) **perubahan keadaan akademik tidak pernah dikirim sebagai efek samping** — hanya sebagai hasil transisi yang disetujui (SM/`VALIDATE`), karena delta sync menggoda orang untuk "mengirim sekarang, menyetujui belakangan".

### 12.11 Penempatan, *budget*, dan mode turun (lanjutan tabel §11.10)

| Engine | Penempatan | *Budget* baku | Skala target | Mode turun |
|---|---|---|---|---|
| ALG-8 | *worker* `engine.timetable` | 30 s / 200 ribu *backtrack* | 120 permintaan × 8 slot × 12 ruang | kendala tanpa data **dilaporkan tidak ditegakkan**, `PARTIAL_BUDGET_EXHAUSTED` |
| ALG-9 | *worker* (batch) + *cache* baca | 10 s / 200 ribu simpul | 10.000 mahasiswa per prodi | `NO_PREREQ_DATA`; `LOW_SAMPLE` per komponen |
| ALG-10 | *worker* `engine.ews` (skor) + `model.train` (di luar puncak) | 60 s per 10.000 mahasiswa | 10.000 × 20 fitur | ambang tidak lolos → **hanya aturan keras**, tanpa skor |
| ALG-11 | *worker* `engine.feederpre` | 120 s / 20 ribu baris | 10.000 baris × 60 aturan | `NO_MATCH` → kosong + bukti; tidak ada *auto-fix* tanpa aturan berversi |
| ALG-12 | verifikasi **di rute** (murah, `O(1)`) + tabel sekali-pakai | ≤ 50 ms per *scan*; 3 upaya/60 s | 3.000 *scan*/menit pada puncak | Redis tidak terjangkau → **tolak presensi** (`503`), tidak pernah terima tanpa sekali-pakai |
| ALG-13 | inkremental di *worker*; penuh saat kunci periode | 5 s per matakuliah; 60 s per prodi | 1.000 matakuliah × 6 CPL | `NO_INDICATOR_DATA`; `coverage` selalu ditampilkan |
| ALG-14 | inkremental (jalur tulis) + verifikasi periodik di *worker* | 1 SHA256 per baris; 1 akar per 1.000 daun | 5.000 ubah nilai/minggu | `seq`/hash tidak tersedia → **tulis gagal**, bukan tulis tanpa jejak |

Semua tetap tunduk AGENTS §3.7: mutasi hanya ke Primary, baca-setelah-tulis dari Primary, tanpa `LOCK TABLE`, indeks domain dengan `tenant_id` kolom pertama (`int4range` + GiST untuk jadwal/ruang, `EXCLUDE USING gist` untuk tumpang-tindih), hasil panjang tidak lewat HTTP.

### 12.12 Dependensi *design-only* dan gerbang CI tambahan

**Belum ada di `package.json` — tidak boleh diklaim berjalan** (pola pencatatan: TECH_CONVENTIONS §6): `bullmq`, `ioredis` (`RD-11`, keputusan `P-6`) · `or-tools` (perlu \*worker\* solver terpisah) — dipakai sebagai akselerator **design-only** oleh ALG-8 (§12.3) **dan ALG-15** (§12.14 MILP/CP-SAT, gerbang parity yang sama §12.2.3: tidak lebih buruk pada biaya lunak, tidak pernah meloloskan kendala keras, dan tetap bukan acuan golden vector) · runtime ONNX/*worker* Python (keputusan terbuka `P-11`) · `xgboost`/`scikit-learn` (hanya untuk pelatihan *offline*, bukan dependensi aplikasi) · Tesseract v5 (sudah di ALG-7, container sendiri) · PaddleOCR & PDF.js — **tidak** ada di daftar ini dan **tidak** diklaim; yang diminta pemilik sebagai "local document parser" sudah dilayani Tesseract v5 di §11.9 · pustaka interval-tree / graf luar untuk ALG-17 — **tidak dibutuhkan**: struktur dibangun di TS murni (§11.1) atas `int4range` + GiST yang sudah ada · `pgcrypto` untuk `digest()` di sisi DB.

**Gerbang CI baru (menambah daftar §7.2):**
- (g) **egress scan**: tidak ada `fetch(` / `axios` / `https.request` di dalam `modules/**/engine/**`; pelanggaran = build merah. Ini yang membuktikan zero-API-key secara mekanis, bukan dengan pernyataan.
- (h) **golden vector**: tiap `engine_code` punya vektor fixtured → keluaran byte-identik; PRNG **wajib** ter-*seed* dan seed-nya ikut tersimpan di `engine_runs` (tanpa ini, hasil ALG-8/ALG-10 tidak dapat direproduksi).
- (i) **paritas numerik TS ↔ Dart** untuk seluruh pembobotan (ALG-8 biaya lunak, ALG-9 skor, ALG-11 ambang kemiripan, ALG-12 `fraud_score_bp`, ALG-13 capaian): satu vektor masukan → angka yang sama di dua platform (AGENTS §3.4); larangan `float` diuji, bukan diasumsikan.
- (j) **uji empat titik kegagalan RBAC** (§3.8) untuk setiap rute engine + **uji penolakan** bahwa keluaran engine tidak dapat menulis tabel domain (invariance `proposal_only`).
- (k) **verifikasi rantai audit**: satu baris diubah di *fixture* → verifier harus menghasilkan `HASH_MISMATCH`; bila tes ini hijau palsu, fitur "tak-ubah" tidak ada.
- (l) **daftar terlarang sebagai fitur ML**: uji statis bahwa atribut yang disebut di §12.5 tidak pernah masuk `features` model.
- (q) **ambang engine berasal dari parameter, bukan dari kode**: setiap parameter/ambang yang dibaca engine (ALG-11 `0,95`/`margin 0,10`/`k ≤ 50`; ALG-15 jendela ujian, plafon pengawasan, bobot lunak; ALG-16 ambang kemiripan & plafon SKS; ALG-17 ambang minimal/pengecualian BKD; ALG-18 batas token & kapasitas `seqN`) **wajib** datang dari `master_system_parameters`/`academic_rules` (`parameter_version` ikut tersimpan di `engine_runs`). **Tidak ada konstanta ambang di dalam kode engine.** Uji: ganti ambang di DB → hasil run berikutnya berubah pada field itu; temukan angka liter di jalur keputusan engine → build merah. Pengecualian yang sah hanya **batas CHECK keamanan** (mis. rotasi TOTP 5–30, radius ≤ 500 — DATA_MODEL §21.1 kalimat penutup), dan itu bukan ambang yang engine baca sendiri. Huruf **(m)–(p)** sudah dipakai gerbang mesin data master (AGENTS §3.10), sehingga lanjutan di bab ini memang **tidak kontinu** — disengaja, bukan salah ketik.
- (r) **golden vector deret NIM (ALG-18)**: satu pola + satu seed sequence + satu urutan permintaan → **deret NIM byte-identik**. Ini vektor khusus karena sequence adalah state hidup: `input_snapshot_hash` **wajib** memuat `pattern_version` dan `next_value` awal, dan vektornya menguji tiga hal sekaligus — determinisme deret, `checksum` yang konsisten dengan digitnya, dan penolakan `NO_PATTERN_CONFIGURED` (tanpa pola aktif engine **menolak terbit**, bukan membangkitkan nilai asal).

**Catatan cakupan (siklus 2026-10-20, ALG-15…ALG-18).** §12.13–§12.20 **memperluas cakupan bab 12**: judul bab ini masih menulis `ALG-8…ALG-14` dan isinya (§12.1–§12.12) **tidak diubah satu baris pun** — vonis §12.2 tetap mengikat, dan empat engine baru di bawah tidak membuka kembali apa pun yang sudah ditutup. Perluasan ditaruh di dalam bab 12 (bukan bab baru) supaya harness §11.2, garis tegas §11.1, dan tabel penempatan §12.11 tetap satu-satunya rujukan; nomor §12.13 dst. hanya melanjutkan penomoran yang ada. Rujukan lintas dokumen yang masih menulis "ALG-1…ALG-14" (AGENTS §2.1 & §3.9, `INDEX.md`, judul bab 12 ini) perlu disamakan **oleh pemiliknya masing-masing** — dititipkan di sini, tidak dikerjakan di file yang bukan miliknya.

### 12.13 Peta enam belas permintaan engine → ALG (ketertelusuran penutup)

§12.1 memetakan permintaan gelombang-2. Tabel ini memetakan **keenam belas** permintaan yang diajukan pemilik sebagai "mesin algoritma", dan menutup daftar: tidak ada permintaan yang tidak punya pemilik.

| # | Permintaan pemilik (nama sebagaimana diminta) | Engine pemilik | Status | Catatan ketertelusuran |
|---|---|---|---|---|
| 1 | KRS War: Redis atomic counter, Redlock, `SELECT … FOR UPDATE`, BullMQ, SSE | §10 (bukan ALG) | **sudah divonis** | Opsi C = lease TTL 90 s + worker finalis. `FOR UPDATE` **dipindah** ke jalur finalis (§12.2.1); Redlock **DITOLAK**, diganti `lease_epoch` + *fencing token* (§12.2.2); SSE & `202` di §10.6. Tidak dibuka ulang di bagian ini |
| 2 | Smart Timetabling: CSP / GA / OR-Tools / backtracking | ALG-8 §12.3 | sudah terspesifikasi | jalur utama = DFS + *forward checking* + AC-3 TS murni; GA bersyarat; OR-Tools = akselerator *design-only* dengan gerbang parity (§12.2.3) |
| 3 | Exam Scheduling: DSatur / Welsh–Powell + MILP | **ALG-15 §12.14** | **BARU di bagian ini** | pewarnaan graf konflik; MILP akselerator saja; `exam_schedules`/`exam_participants` (`0024`) dipakai ulang |
| 4 | MBKM & Transfer Credit: DAG ekivalensi + bipartite + Jaro–Winkler | **ALG-16 §12.15** | **BARU di bagian ini** | pencocokan memakai koridor skor **dan** `margin` milik §12.6; `mbkm_grade_mappings` (`0033`); konversi = draf tiga orang |
| 5 | BKD Overlap: interval tree "O(log N)" | **ALG-17 §12.16** | **BARU di bagian ini** | angka pemilik benar untuk **query tunggal**; bangun struktur `O(n log n)` — diluruskan (bukan ditolak) di §12.16 |
| 6 | Graduation Clearance: DFA + RETE | ALG-4 §11.6 | sudah terspesifikasi | sisi aturan = RETE; sisi automata = transisi state service + register enum DATA_MODEL §15 — **bukan** engine automata kedua |
| 7 | Critical Path: CPM + DAG | ALG-1 §11.3 | sudah terspesifikasi | forward/backward pass + DP `nextOpenTerm`; rekomendasi isian = ALG-9 §12.4 |
| 8 | Multi-Resource Lab: bin-packing | ALG-2 §11.4 | sudah terspesifikasi | FFD multi-dimensi + B&B terbatas; deviasi dari optimum **dilaporkan**, tidak disembunyikan |
| 9 | Concentration: AHP/TOPSIS + Stable Marriage | ALG-3 §11.5 | sudah terspesifikasi | Gale–Shapley berkuota; ties dipecah deterministik; sertifikat stabilitas dapat diverifikasi ulang |
| 10 | Emergency Room Re-Router: Ford–Fulkerson | ALG-5 §11.7 | sudah divonis (nama) | lihat paragraf "Ford–Fulkerson" di bawah — yang diminta adalah keluarga jalur augmentasi; implementasi yang menang = **Dinic** |
| 11 | Gradebook: AST formula | ALG-6 §11.8 | sudah terspesifikasi | Pratt/shunting-yard, basis poin, tanpa `eval()` |
| 12 | PDDikti Auto-Fix: rule engine + fuzzy | ALG-11 §12.6 | sudah terspesifikasi | mesin aturannya = RETE ALG-4 (satu mesin, bukan dua); blocking + BK-tree |
| 13 | Anti-Fraud: Haversine + HMAC-TOTP 5 s | ALG-12 §12.7 | sudah terspesifikasi | + multi-modus & rekonsiliasi dua sumber di §12.18 |
| 14 | Immutable Audit: rantai hash SHA-256 | ALG-14 §12.9 | sudah terspesifikasi | nama kanonik `grade_change_logs`/`system_audit_trails` (`0034`); TSA pihak ketiga ditolak |
| 15 | Local Document Parser: Tesseract/PaddleOCR/PDF.js | ALG-7 §11.9 | sudah terspesifikasi | yang tercatat *design-only* di §12.12 hanya Tesseract v5; PaddleOCR & PDF.js **tidak** ada di daftar dan tidak diklaim; tulisan tangan dinyatakan tidak didukung |
| 16 | Dynamic Auto-NIM Pattern Compiler | **ALG-18 §12.17** | **BARU di bagian ini** | `tenant_settings.nim_format` = nama kanonik; menutup `RD-43`; sequence per prefix, bukan `MAX()+1` |

**Pernyataan terukur.** Dari 16 permintaan: **12 sudah punya pemilik terspesifikasi** — 11 engine (`ALG-1`…`ALG-8` + `ALG-11`, `ALG-12`, `ALG-14`) dan 1 bukan-engine (KRS War = §10 dengan vonis §12.2.1–§12.2.2); **4 BARU** dan dispesifikasi di bagian ini sebagai `ALG-15`…`ALG-18`. 12 + 4 = 16, tidak ada yang hilang dan tidak ada yang didaftarkan dua kali. Tiga engine lain yang lahir dari daftar §12.1 — `ALG-9` (§12.4), `ALG-10` (§12.5), `ALG-13` (§12.8) — **tidak termasuk** 16 permintaan di atas dan karena itu tidak ikut dihitung dalam angka 12 itu; ia tetap ada dan tidak dipindahkan.

**Kenapa permintaan 10 (Ford–Fulkerson) tidak dianggap terbuka.** Yang diminta pemilik adalah **nama keluarga** algoritma jalur augmentasi; §11.7 sudah memvonis **implementasinya**, dan vonis itu adalah angka, bukan selera: Edmonds–Karp `O(V·E²)` **ditolak** pada ukuran riil (V ≈ 120 sesi + 300 ruang-slot), yang dipakai **Dinic** (*blocking flow*; worst case `O(V²·E)`, mendekati `O(E·√V)` pada jaringan kapasitas satuan). Yang mengikat karena itu: **batas kompleksitas + perilaku min-cut** (inti konflik yang dapat dibaca manusia), bukan merek algoritmanya. Bila nanti terbukti Dinic kalah pada instance ujian (bukan kuliah), itu **diukur lebih dulu** dengan golden vector — bukan dinamai ulang di dokumen.

**Kenapa permintaan 1 tidak dibahas ulang.** §12.2.1 dan §12.2.2 menutupnya: `SELECT … FOR UPDATE` dipertahankan **tetapi dipindah** ke transaksi finalisasi worker (§10.3.5 langkah 6) dan ke klaim job (`SKIP LOCKED`, tujuan yang sama sekali berbeda), Redlock **DITOLAK** dan diganti `lease_epoch` + *fencing token* dengan DB sebagai penjaga terakhir. Empat engine baru di bawah **tidak menyentuh jalur kursi KRS**: ALG-15 hanya menghasilkan draf jadwal ujian, ALG-16 draf konversi, ALG-17 temuan beban, ALG-18 satu baris `nim_assignments`.

**Kepemilikan nama, nomor, kode — tidak berubah karena bagian ini.** Penamaan `ALG-15`…`ALG-18` sudah diputuskan dan tidak membuat ID tandingan. Nama objek, DDL, dan nomor migrasi tetap milik **DATA_MODEL** (§17–§21 + register §14.7): `0049_system_parameters.sql` dan `0050_menu_parameter_permissions.sql` **sudah terpakai**, jadi nomor untuk objek engine baru belum diambil dan tidak ditulis sebagai fakta di sini. Kode izin tetap milik **RBAC_MATRIX** dan path/kode error tetap milik **API_SPEC** — dua angka berikut **diukur hari ini**, bukan disalin dari kepala bagian:

| Register | Terukur | Artinya untuk empat engine ini |
|---|---|---|
| RBAC_MATRIX §4.5 (titik aksi) | **161 baris bernomor** (`grep -cE "^\| [0-9]+ \|"` pada rentang §4.5) | **belum ada satu pun** baris `run`/`view`/`apply` untuk ALG-15…ALG-18; yang terdekat (`pmb.nim.generate`, `hr.bkd.calc/.submit/.approve`, `academic.equivalency.view/.manage`) hidup di katalog modul §4.3/matriks menu §6 dan berstatus **non-normatif** sampai masuk register (`G-15`) |
| API_SPEC §2.3 (kode error) | **rujuk, jangan salin** — pemilik dan cacahnya ada di `API_SPEC §5.15` + gerbang `node .tools/error-dup.mjs`; berkas ini tidak lagi menyebut nomor tertinggi (norma `RD-55`, `RD-62`) | kode baru untuk ALG-15…ALG-18 mulai **baris 119**; `EVIDENCE_INSUFFICIENT` (117) **sudah ada** dan dipakai §12.18 — dipakai ulang, bukan dibuat kembaran |

Yang bertanda `degraded:` atau `NO_…` di bagian ini adalah **flag pada hasil `explain`**, bukan kode HTTP, sampai API_SPEC mendaftarkannya. Kepala bagian RBAC §4.5 sendiri masih menulis "145 titik aksi", dan judul bab 12 masih menulis "ALG-8…ALG-14": keduanya **sudah tertinggal** dari hasil ukur di atas, dan menjadi penitipan lintas-dokumen — ralatnya milik pemilik file masing-masing, bukan bagian ini.

### 12.14 ALG-15 · Exam Scheduling Solver

**Fungsi** Menyusun kalender ujian satu periode — UTS/UAS/SUSULAN per (matakuliah × kelompok) ke `(tanggal, blok jam, ruang, pengawas)` — atau memperbaiki kalender yang sudah tersusun sebagian, tanpa satu mahasiswa pun memegang dua ujian beririsan dan tanpa ruang/pengawas ganda.

**Algoritma — model graf konflik.** Simpul = **sesi ujian**. Sisi tak-berarah dibuat bila minimal satu syarat di bawah terpenuhi; sisi keras tidak boleh dilanggar berapa pun biayanya, sisi lunak hanya biaya:

| kode | sisi dibuat bila | sumber fakta |
|---|---|---|
| E-1 | `exam_participants` kedua simpul beririsan (satu mahasiswa ikut dua ujian) | `enrollments` + `class_distributions` (`0023`) |
| E-2 | `supervisor_membership_id` sama, atau pengampu yang sama pada irisan waktu | `lecturer_availability` (§18.2) + `class_assignments` |
| E-3 | ruang yang sama pada irisan waktu | `rooms` + `EXCLUDE USING gist` pada `0024` |
| E-4 | ujian bentrok dengan **kuliah** kelompok yang sama (bukan ujian vs ujian) | `class_schedules` + uji `int4range &&` |

Empat tahap, urutannya tidak boleh dibalik:
1. **Penyaringan domain (unari).** Hari dalam jendela ujian periode (`academic_periods` + `academic_rules`), ketersediaan pengawas per hari, tipe & kapasitas ruang, larangan bentrok kuliah (E-4). Domain menjadi kosong → temuan `UNFEASIBLE_REQUEST` beserta alasan unary-nya: ini jawaban, bukan kegagalan engine (corak §12.3 tahap 1).
2. **Batas bawah: clique.** `ω(G)` = jumlah gelombang yang **pasti** dibutuhkan. Yang selalu dihitung: *maximal-clique greedy* deterministik (derajat menurun, lalu `sesi_id` menaik) — murah dan sah sebagai batas bawah. *Maximum clique* eksak hanya dijalankan bila `|V|` di bawah ambang `budget`; kalau tidak, `explain` menyebut jelas batas mana yang dipakai.
3. **Batas atas: pewarnaan DSatur.** Simpul dengan saturasi (jumlah warna berbeda di tetangga) tertinggi lebih dulu; seri dipecah **tetap** pada `derajat menurun → sesi_id menaik`, sehingga dua run atas snapshot yang sama menghasilkan warna yang byte-identik. **Welsh–Powell** (nama yang pemilik minta) dijalankan sebagai **varian pembanding** pada instance yang sama di CI, dan kedua angka dilaporkan — bukan hanya yang lebih bagus. Klaim "DSatur tidak pernah lebih buruk dari Welsh–Powell pada graf ujian" **belum diukur di repo ini** `[TIDAK-TERVERIFIKASI]`, karena itu yang menjadi bukti adalah `gap = warna_DSatur − ω_bawah` yang tersimpan, bukan nama algoritmanya.
4. **Perbaikan biaya + MILP sebagai akselerator.** Min-conflicts / *late-acceptance* dengan PRNG ter-*seed* (`xorshift128+`, seed tersimpan di `engine_runs`) untuk menurunkan: jarak hari antar-ujian milik satu mahasiswa, ujian yang menempel blok kuliah, konsentrasi pemakaian ruang, dan **sebaran beban pengawas**. Beban pengawasan dihitung sebagai jam nyata ke **ALG-17** (§12.16) — seorang dosen tidak boleh ditugaskan mengawasi sampai BKD-nya melewati plafon BR-A11. MILP/CP-SAT (OR-Tools) = **akselerator design-only** dengan gerbang parity yang sama persis dengan §12.2.3: pada fixtured instance yang sama hasilnya **tidak boleh** meloloskan pelanggaran E-1…E-4 dan **tidak boleh** lebih buruk pada biaya lunak; jalur TS tetap yang menjadi acuan golden vector, karena keluaran solver luar tidak dapat direproduksi CI repo ini dan `engine_runs` wajib mencatat jalur mana yang menghasilkan.

**Kompleksitas.** Penyaringan `O(V·d)`; clique greedy `O(V·E)`; DSatur `O(V²)` naif dan `O((V+E)·log V)` dengan antrean prioritas per tingkat saturasi; lokal-search dibatasi `budget`. Pewarnaan graf = NP-hard, jadi **yang boleh diklaim hanya**: solusi layak + `gap` terhadap batas bawah. Skala target `[TIDAK-TERVERIFIKASI — belum diukur di repo ini]`: 1 prodi × 60 sesi × 5 hari × 20 ruang ≈ 6.000 pasangan (sesi, slot) sebelum propagasi; skala fakultas (±400 sesi) **wajib** dipecah per prodi menjadi beberapa *run*, satu *run* tidak boleh menahan worker melebihi *budget* (§12.20).

**Sumber data** `exam_schedules` + `exam_participants` (`0024_exam_scheduling.sql` — `EXCLUDE USING gist` untuk ruang **dan** untuk kelompok mahasiswa, aturan BENCH-52/53, sehingga bentrok ujian vs kuliah tertangkap DB bukan aplikasi), `enrollments`, `class_distributions` (`0023`), `class_schedules`, `rooms`, `class_assignments` + `lecturer_availability` (§18.2, `0037`), `academic_periods`/`academic_rules` (jendela ujian + bobot lunak), `lecturer_attendances` (`0025`) sebagai bukti pengawas benar-benar hadir, `exam_cards` (`0016`).

**Invariance.** (a) tidak ada mahasiswa terdaftar pada dua ujian beririsan (E-1); (b) tidak ada ruang dipakai dua ujian beririsan (E-3) — dijaga `EXCLUDE` di `0024`, bukan hanya query engine; (c) `supervisor_membership_id` wajib punya izin mengawasi pada scope itu **dan** tidak bentrok: namanya ada di daftar dosen ≠ berhak (L3/L4 — `requireDataPrincipal` + `holdsScoped`, `SEC-10`/`SEC-11`); (d) kartu ujian (`exam_cards`, BENCH-84) menyimpan **tiga** tanggal terpisah — `print_window_start`, `print_window_end`, `exam_date` — dan tidak terbit sebelum hasil di-`VALIDATE`; (e) `proposal_only`: engine tidak punya jalur INSERT/UPDATE ke `exam_schedules`; penerapan = aksi `VALIDATE` yang memanggil service jadwal dengan lock per kelas + `audit_logs` + outbox (corak §12.3 "Penulisan", §11.7); (f) draf yang melanggar kendala keras tidak dapat tersimpan — engine mengembalikan inti konflik.

**Mode turun.** Tanpa `lecturer_availability`: E-2 hanya anti-bentrok jam, tanpa konsep "hari yang diizinkan", hasil membawa `degraded: "NO_LECTURER_AVAILABILITY"` (flag yang sama dengan §12.3 — **dipakai ulang**, bukan nama baru). Tanpa `exam_participants` terisi dan pemanggil menuntut kalender final → `422 ENGINE_DATA_INSUFFICIENT` (99). `budget` habis → `PARTIAL_BUDGET_EXHAUSTED` (73) + `gap`. Ruang tanpa `facilities`/kapasitas terisi → kendala dilaporkan **tidak ditegakkan**, bukan "lolos".

**Keamanan.** Bobot lunak, jendela ujian, dan plafon pengawasan adalah **kewenangan** → artefak berversi + empat-mata (`requested_by <> approved_by` ditegakkan `CHECK`, pola `timetabling_constraint_defs` §18.2) + perubahannya masuk rantai audit ALG-14. Id ruang/mahasiswa/pengawas dari klien diselesaikan ke barisnya **di dalam transaksi** sebelum mutate (anti-IDOR). Presensi pengawas tidak dapat ditulis engine — hanya dibaca dari `lecturer_attendances`. Nol egress: solver cloud tidak dipakai, tidak ada kunci, tidak ada data keluar.

**Yang belum ada dan bukan milik bagian ini.** Tabel run/assignment draf ALG-15 **didaftarkan DATA_MODEL** (§14.7 + gugus §18 berikutnya) dengan `EXCLUDE` mengikuti pola §18.2 — tidak ada DDL di sini, dan nomor migrasinya belum diambil. Titik aksi `exam.scheduling.*` (`run` = `OTHER`, `apply` = `VALIDATE`) **mendaftarnya di RBAC_MATRIX §4.5**; yang ada hari ini hanya `cbt.session.schedule` dan `cbt.exam.start/.submit`, dan itu **bukan** padanannya: CBT adalah *delivery* ujian di layar, bukan penjadwalan — memakai diam-diam izin CBT sebagai gerbang ALG-15 adalah temuan, bukan penyederhanaan.

### 12.15 ALG-16 · MBKM & Transfer Credit Conversion

**Fungsi** Mengubah bukti belajar di luar kampus (magang, studi independen, KKN tematik, pertukaran mahasiswa, RPL, pindah prodi/PT) menjadi **draf konversi**: matakuliah internal mana yang diakui, berapa SKS, huruf apa — sebelum ada manusia yang menyetujuinya.

**Algoritma — empat mesin yang semuanya sudah punya pemilik.** Yang baru di sini **hanya** perakitannya; membuat mesin pencocok kedua atau skala huruf kedua adalah temuan `RD-32`.

1. **DAG ekivalensi.** `course_equivalencies` (`0008`, ADM-3): sisi = matakuliah luar/lama → matakuliah internal. Reachability/transitive closure dihitung sekali per `(kurikulum, versi_peta)` dengan urutan topologis `O(V+E)`; sisi yang sudah *retired* tidak ikut closure. Peta yang memuat siklus **ditolak saat kompilasi**, bukan saat eksekusi produksi — padanan `422 PREREQ_CYCLE` (§11.3); khusus ekivalensi namanya `EQUIV_CYCLE` dan **belum** terdaftar di API_SPEC §2.3, jadi tidak dipakai di kode sampai terdaftar.
2. **Pembangkit kandidat (blocking).** Baris transkrip (judul + SKS + nilai) dibandingkan hanya dengan matakuliah di dalam blok kunci yang sama: `substr(norm,1,3)` judul, `sks`, `kelompok_matakuliah`, `prodi`. Tanpa blocking, semua-ke-semua `O(n²)` tidak masuk *budget* — aturan yang sama §12.6 butir 2.
3. **Skor kemiripan, vonis dari skor DAN margin.** Normalisasi baku (NFKC → *casefold* → hapus tanda baca → rapikan spasi → kanalisasi homoglyf **hanya** pada kolom angka), lalu **Jaro–Winkler** untuk judul pendek/nama kegiatan, **Levenshtein** untuk kode, **Dice/Jaccard 3-gram + TF-IDF cosine** untuk judul panjang & ringkasan silabus. Koridor **identik** dengan §12.6: `≥ 0,95` **dan** `margin ≥ 0,10` dan tepat satu kandidat → `AUTO`; `0,80–0,95` **atau** margin tipis → `REVIEW`; di bawah itu / beberapa kandidat setara → `NO_MATCH` (kosong + tautan bukti). Ambang **dibaca** dari `academic_rules`/`master_system_parameters` (gerbang CI (q) §12.12), tidak ditulis sebagai konstanta di dalam engine.
4. **Penugasan bipartite satu-ke-satu.** *Greedy* terurut skor, atau Hungarian `O(n³)` bila `n ≤ 60` — supaya satu baris transkrip tidak diakui ke dua matakuliah internal **dan** satu matakuliah internal tidak terserap dua baris. Ini anti-dobel-hitung di level *matching*; indeks unik parsial tetap penjaga terakhir di level DB.
5. **Pembatas yang memotong sebelum skor ditampilkan:** plafon nasional BR-M1 (≤ 20 SKS per semester) + plafon BR-R2 + SKS yang sudah diakui pada periode sebelumnya; huruf hasil **wajib** anggota `grade_scales` (FK ke `grade_scale_bands`) lewat `mbkm_grade_mappings` (`0033`), pembulatan mengikuti `rounding_mode` prodi, dan band huruf tidak boleh beririsan (`EXCLUDE numrange`). Aturan-aturan itu **sudah** diikat DATA_MODEL §16.2 (`0033`) — engine membacanya, tidak menentukannya.

**Kompleksitas.** Closure `O(V+E)` per versi peta; *matching* teratas `O(n³)` untuk `n ≤ 60`; sisanya `O(baris × k)` dengan `k` = ukuran blok (target `k ≤ 50`, sama seperti §12.6). Satu batch 500 baris transkrip diselesaikan di worker dalam ordo puluhan detik — `[TIDAK-TERVERIFIKASI — belum diukur di repo ini]`.

**Sumber data** keluaran ALG-7 (`document_extractions` — §11.9 sudah menyebut transkrip hasil konversi MBKM/RPL sebagai berkas utamanya), `mbkm_programs`/`mbkm_contracts`/`mbkm_logs`/`mbkm_conversions` (`0016`), `mbkm_conversion_lines` + `mbkm_grade_mappings` (`0033`), `course_equivalencies` (`0008`), `courses.sks*` + `curricula`, `grade_scales`/`grade_scale_bands`, `enrollments`/`grades` (cek dobel-hitung), `students` + plafon.

**Invariance.** (a) **tiga orang berbeda** — `requested_by`, `first_approved_by`, `second_approved_by` dengan `CHECK` anti-tabrakan sudah diikat DATA_MODEL §16.2 (`0033`); engine tidak pernah menjadi salah satunya dan tidak pernah mengisi kolom itu; (b) hasil engine = **draf**; penerapan hanya lewat service `academic.equivalency.apply` + aksi `VALIDATE` (FR-KUR-02) — engine **tidak pernah** menulis `grades`, `enrollments`, atau transkrip; (c) anti IPK dobel-hitung: indeks unik parsial per `(tenant_id, student_id, internal_course_id)` adalah penjaga terakhir, dan ALG-13 menghitung baris konversi dengan `weight_source = 'MBKM'` **satu kali**; (d) tidak ada verdict `AUTO` tanpa `candidate_ref` + `score` + `margin` yang tersimpan dan dapat dibuka; (e) SKS yang akan diakui tidak pernah membuat total melewati plafon mana pun, termasuk plafon yang sudah terpakai di periode lain.

**Mode turun.** `NO_EQUIVALENCY_DICT`: selama `course_equivalencies` belum terisi (migrasi `0008` belum ada di `packages/database/migrations/` — yang riil baru `0001`–`0006` + `0011`), keluarannya draf **kosong** + daftar objek yang kurang (alur alternatif PRD), **bukan** daftar matakuliah yang "kira-kira sama". Tanpa `mbkm_grade_mappings` prodi → huruf tidak terdefinisi: temuan `NO_GRADE_MAP`, nilai mitra tetap tersimpan apa adanya sebagai bukti, dan tidak ada konversi paksa ke huruf SICA. Tanpa `mbkm_contracts` yang sudah dua-approval (FR-MKM-01) → run boleh dihitung tetapi tidak dapat di-`apply`.

**Keamanan.** Berkas bukti adalah PII: yang lewat hanya `attachment_id` + digest, transkrip tidak pernah keluar (ADR-14, UU PDP). Proyeksi server: peran akademik tanpa hak keuangan tidak membaca dampak konversi terhadap tagihan, dan nominal tidak pernah terbaca oleh peran yang bukan pemiliknya (SoD BAAK↔BAUK, AGENTS §3.8). Perubahan versi peta ekivalensi = perubahan hak orang atas pengakuan SKS → masuk rantai audit ALG-14.

### 12.16 ALG-17 · BKD Overlap & Workload Detector

**Fungsi** Menghitung beban kerja dosen (BKD) per periode dari **fakta** — jadwal, penugasan, jurnal sesi, presensi dosen — lalu mengembalikan temuan: jam beririsan, beban **lebih**, beban **kurang**, **beban ganda lintas prodi/unit**, dan **drift** antara yang terjadwal versus yang terealisasi.

**Luruskan angkanya lebih dulu (ini koreksi, bukan penolakan).** Permintaan berbunyi "interval tree O(log N)". Yang benar dan yang dipakai: **bangun** struktur `O(n log n)`; **query** satu rentang = `O(log n + k)` dengan `k` = interval yang benar-benar bertabrakan; daftar `q` rentang = `O(q log n + Σk)`. Menyebut hanya `O(log N)` membuat klaim kapasitas salah arah, karena harga bangun struktur tidak pernah dibayar di laporan. Interval disimpan sebagai `int4range` berindeks **GiST** di DB (§17.2, §18.2) dan tree in-memory dibangun per `(dosen, periode)` di worker — ukuran per dosen kecil sehingga rebuild murah dan tidak pernah jadi jalur panas.

**Algoritma.**
1. **Kumpulkan fakta** per `lecturer_membership_id` untuk satu periode: blok mengajar (`class_assignments` + `class_schedules`/`class_sessions`), ketersediaan deklaratif (`lecturer_availability` §18.2 — `EXCLUDE USING gist` sudah menjamin dua deklarasi milik satu dosen tidak bertumpuk), realisasi (`session_journals` `0017`, `lecturer_attendances` `0025`).
2. **Deteksi irisan** dengan augmented BST atas interval (urutan deterministik: `mulai` menaik, lalu `id` menaik). Kelas paralel satu dosen pada waktu yang sama **legal** menurut BENCH-53 selama bobot SKS pengampu di dalam kelas menutup tepat dan total tidak melewati plafon — jadi engine menguji **bobot & plafon**, bukan "satu dosen satu jam".
3. **Konversi ke angka BKD per komponen Tridharma**: **pengajaran** (SKS × rasio bobot pengampu, dari fakta di atas), **penelitian**, **pengabdian**, **penunjang**. Tiga komponen terakhir **tidak punya sumber otomatis** di sistem ini hari ini — isinya portofolio yang dosen entri (modul `hr_bkd`). Karena itu daftar komponennya adalah **kamus** `reference_items(kind='bkd_komponen')` kelas C, dibaca lewat mesin lookup (DATA_MODEL §20), **bukan** array literal di kode (AGENTS §3.10). Catatan nama, supaya tidak ada dua kebenaran: DATA_MODEL §20.4.3 hari ini mencatat jenis kamus itu sebagai `bkd_component_kinds` (**usulan**) — **ejaan `kind` final milik DATA_MODEL**, dan engine hanya memanggil mesin lookup dengan kode yang terdaftar di sana, tidak menempel `bkd_komponen` maupun `bkd_component_kinds` sebagai konstanta di kode.
4. **Beban ganda lintas prodi/unit** dijumlahkan sebagai **union interval** per dosen, bukan Σ SKS per penugasan. Inilah kasus yang paling sering salah di rekap manual: satu jam yang sama mengajar di dua prodi tetap **satu jam** kerja.
5. **Drift terjadwal vs terealisasi**: sesi terjadwal tanpa jurnal/kehadiran, jurnal tanpa sesi terjadwal, durasi menyimpang dari slot. Tiap selisih menjadi temuan dengan tautan ke baris sumbernya — angka rekap saja tidak menjawab "kenapa". Ini padanan teknis "Rekap Absen Dosen" pada benchmark (BENCH-66/74), laporan yang sampai hari ini tidak punya tabel sumber.
6. **Usul tindak lanjut terikat objek**: realokasi ke pengampu lain (memanggil ulang kendala H-6 ALG-8), penugasan tutor/TA untuk kelas paralel (BR-A11, peran `LAB_ASSIST`), atau permintaan bukti komponen ke dosen yang bersangkutan. Engine tidak pernah mengubah penugasan.

**Kompleksitas.** Per dosen: bangun `O(s log s)`, query `O(log s + k)`; agregasi batch `O(total_interval log total_interval)`. Acuan kasar 1.000 dosen × 320 sesi/tahun ≈ 3,2·10⁵ interval → ordo `10⁶` operasi per *run*; waktu dinding `[TIDAK-TERVERIFIKASI — belum diukur di repo ini]`, target *budget* ada di §12.20.

**Sumber data** `class_assignments`, `class_schedules`, `class_sessions`, `class_distributions` (`0023`), `lecturer_availability` (§18.2, `0037`), `lecturer_attendances` (`0025`), `session_journals` (`0017`), `lecturers` (jabatan fungsional `lecturer_job_rank` = sumber **pengecualian**), `reference_items` (komponen BKD), `academic_rules` (ambang minimal, rasio, pengecualian berversi) + `master_system_parameters` (ambang operasional), plafon 16 SKS mengajar = BR-A11.

**Invariance.** (a) tidak ada temuan tanpa baris bukti yang dapat dibuka (angka → baris); (b) satu jam tidak pernah dihitung dua kali untuk satu dosen, termasuk lintas prodi/unit (`union`, bukan Σ); (c) engine **tidak pernah** menulis `class_assignments`/`lecturers` — hasil = temuan draf yang butuh `VALIDATE`, dan yang menjalankan `hr.bkd.calc` tidak boleh menjadi orang yang menyetujui `hr.bkd.approve`; (d) dosen hanya membaca rekap dirinya; BKD orang lain milik `HR_BKD_OFFICER`/`HEAD_OF_PROGRAM` pada scope-nya (proyeksi server, `FIELD_RULES`); (e) angka yang keluar ke SISTER/Feeder hanya hasil yang sudah disetujui dan sudah lewat gerbang dua orang — engine tidak punya jalur kirim; (f) ambang minimal/pengecualian selalu menunjuk `parameter_version`/`rule_version` yang berlaku pada periode itu, supaya rekonstruksi historis mungkin (BR-R12).

**Mode turun.** Tanpa `lecturer_attendances` (`0025` belum dieksekusi): hanya perhitungan dari jadwal, dengan `degraded: "NO_LECTURER_ATTENDANCE_FEED"` dan **larangan eksplisit** menampilkannya sebagai "realisasi BKD" — labelnya "beban terjadwal". Tanpa kamus komponen: rasio Tridharma tidak terdefinisi → temuan kosong + tautan `/admin/master/**` (FR-ADM-10/11). Tanpa `lecturer_availability`: deklarasinya tidak ada, jadi hanya fakta jadwal yang dinilai dan itu dilaporkan sebagai **kendala tidak ditegakkan** (berdampak juga ke E-2 ALG-15 dan H-3/H-6 ALG-8).

**Objek yang belum ada.** Tabel temuan (permintaan pemilik menyebutnya `bkd_findings`) **didaftarkan DATA_MODEL** §18/§14.7 berikut `kind` kamus dan kolomnya; tidak ada DDL di bagian ini. Titik aksi `hr.bkd.*` hari ini ada di katalog modul §4.3 (non-normatif, `G-15`) — pemindahannya ke register §4.5 milik RBAC_MATRIX.

**Keamanan.** Rekap BKD = data kepegawaian (kelas retensi personalia, UU PDP). NIDN/NUPTK tidak pernah masuk payload laporan massal — hanya id keanggotaan. `explain` menampilkan sebab (aturan + baris bukti), bukan opini; nol egress: tidak ada kalkulator BKD pihak ketiga, tidak ada panggilan SISTER dari dalam engine.

### 12.17 ALG-18 · Dynamic NIM Pattern Compiler

**Fungsi** Mengompilasi pola NIM per tenant dari **konfigurasi** (bukan kode) menjadi artefak berversi — regex validasi, urutan token, prefix sequence — lalu menerbitkan NIM yang unik, berurutan, dapat divalidasi, dan dapat direproduksi, termasuk ketika sebuah kampus mengganti polanya di tahun berikutnya.

**Nama kanonik: `tenant_settings.nim_format`.** Kolomnya nyata hari ini (DATA_MODEL §14.3: `nim_format jsonb`, contoh `{"pattern":"{kodeFak}{tahun}{seq4}","perProdi":false}`). Ejaan `format_nim` yang masih muncul di §11.9 (Lapis 6) dan §12.6 (pemeriksaan pola NIM) **dibaca sebagai rujukan ke kolom yang sama** — tidak ada tempat ketiga. Keputusan DATA_MODEL (nama `nim_format` menang) ditegakkan di sini, dan catatan inilah yang menutup `RD-43` di AUDIT_READINESS. Ralat ejaan pada dua baris lama itu sendiri bukan vonis §12.2 dan tidak mengubah maknanya.

**Algoritma — bahasa pola = token, bukan regex bebas.** `{kodeFak}{kodeProdi}{tahun}{seqN}{checksumLuhn|mod11}`. Regex adalah **keluaran kompilasi**, bukan masukan operator — membiarkan regex mentah berarti membuka ReDoS dan pola yang tidak dapat direproduksi.

| token | sumber nilai | catatan kompilasi |
|---|---|---|
| `{kodeFak}` | kode fakultas tenant, **bila kolom sumbernya nyata ada** | DATA_MODEL §20.4.5 masih menandai `faculties` dengan tanda tanya → token yang sumbernya belum ada **ditolak saat kompilasi**, bukan diisi tebakan |
| `{kodeProdi}` | `study_programs.kode_prodi` | prodi tanpa kode menunda penerbitan (flag `NO_PATTERN_SOURCE`); segmen tidak pernah dibiarkan kosong |
| `{tahun}` | `entry_year` / tahun akademik periode berjalan | lebar 2 atau 4 digit dipilih **eksplisit** di pola; tidak disimpulkan dari panjang string |
| `{seqN}` | pencacah (sequence) per prefix, `N` ∈ 1..8 | pemadatan nol wajib; kapasitas `N` lebih kecil dari volume gelombang = **temuan saat kompilasi** (bukan kejutan saat sequence habis) |
| `{checksumLuhn}` / `{checksumMod11}` | dihitung dari digit di depannya | opsional; algoritma tersimpan di artefak dan **tidak boleh berubah** tanpa versi baru — kalau berubah, NIM terbitan lama menjadi tidak sah dan itu bukan hal kecil |

Batas kompilator: **maksimum token per pola** dan **jumlah versi aktif yang boleh hidup bersamaan** (dua angka yang keduanya dibaca sebagai parameter kelas `TECHNICAL`, bukan konstanta — gerbang CI (q) §12.12 berlaku juga untuk batas struktur ini), tolak token tak dikenal, dan **tolak dua versi pola yang ruang NIM-nya beririsan** (uji deterministik saat aktivasi) — kalau tidak, dua prefix berbeda dapat menerbitkan NIM yang sama dan `UNIQUE` akan menolak di tengah keramaian PMB.

**Artefak berversi + empat-mata.** Hasil kompilasi = satu artefak `(regex, urutan_token, prefix_sequences, checksum_algo)` dengan `effective_from/to`, `version`, `requested_by <> approved_by` (CHECK di DB), dan riwayat beralasan. Pola yang sudah menerbitkan NIM **tidak dapat disunting**: hanya digantikan versi baru dengan `effective_from` — karena NIM adalah identitas yang dilaporkan ke negara, bukan label tampilan.

**Penerbitan: sequence per prefix, bukan `MAX()+1`.** Alokasi = satu `UPDATE ... SET next_value = next_value + 1 ... RETURNING` yang atomik di **Primary**, di dalam transaksi yang sama dengan baris `nim_assignments` (BENCH-04). `MAX(nim)+1` **dilarang**: dua transaksi konkuren membaca maksimum yang sama, dan tabrakan baru terdeteksi ketika `UNIQUE` menolak — tepat di jam ramai. `UNIQUE (tenant_id, nim)` tetap penjaga terakhir, dan `UNIQUE (tenant_id, application_id)` + `Idempotency-Key` (§11.2) membuat klik kedua mengembalikan **NIM yang sama**, bukan NIM kedua.

**State, daur ulang, dan tombstone.** Baris `nim_assignments` (`0021`) berjalan `RESERVED → ISSUED`, dengan cabang `CANCELLED` dan `RECYCLED`. **Tombstone tetap tinggal** — tidak ada hard delete (BR-R10). NIM **hanya** boleh didaur ulang bila **belum pernah** terdaftar ke Feeder; satu NIM yang sudah keluar ke pangkalan nasional tidak pernah menjadi milik orang lain, berapa pun yang dibatalkan. Karena itu status `RECYCLED` **tidak** menggerakkan sequence mundur — ia menambah baris baru dengan penanda `recycled_from` ke baris asal, dan gerbangnya adalah cek riwayat kirim (`feeder_identities`, §16.4), bukan asumsi operator. `students.nim` adalah `SERVER_ONLY` dengan `immutable_after = 'NIM_ISSUED'` (DATA_MODEL §14.7, RBAC §4.6): **tidak pernah** diterima dari body, di layar mana pun.

**Kompleksitas.** Kompilasi `O(|token|)`; validasi `O(|nim|)`; penerbitan `O(1)` per NIM (satu `UPDATE` atomik + satu `INSERT`); uji irisan antar-prefix saat aktivasi `O(p²)` dengan `p` = jumlah versi aktif (kecil, dan `p` di atas plafon ditolak). Engine ini **bukan** jalur panas KRS: tidak perlu Redis, tidak ikut §10, dan tidak menyentuh `queue_operations`.

**Determinisme & golden vector.** Yang membuat hasilnya dapat dipercaya: `input_snapshot_hash` untuk penerbitan **wajib** memuat `pattern_version` **dan** keadaan sequence (`next_value` saat run dimulai). Tanpa itu "hasil identik" tidak dapat dibuktikan, karena sequence adalah state hidup — ini perbedaan penting dari engine murni §11.2. Gerbang CI (r) §12.12: pola sama + seed sequence sama + urutan permintaan sama ⇒ **deret NIM yang sama**, byte-identik.

**Invariance.** (a) tidak ada dua baris `students` dengan NIM sama dalam satu tenant (`UNIQUE (tenant_id, nim)`); (b) tidak ada penerbitan tanpa pola aktif — `NO_PATTERN_CONFIGURED` **menolak menerbitkan**, bukan membangkitkan NIM asal; ini bedanya dengan "format default" yang diam-diam dan menjadi sumber NIM fiktif di laporan Feeder; (c) NIM **tidak pernah** dibangkitkan di klien — paritas Flutter = **baca** (KTM, KHS, status), bukan hitung (AGENTS §3.4); (d) checksum (Luhn atau mod-11) adalah pemeriksaan **konsistensi internal pola**, dan tidak pernah diklaim sebagai validasi identitas nasional — §12.6 sudah mencatat NIK **tidak** punya *checksum*, jadi mencampur keduanya adalah kesalahan yang sama sekali lain; (e) tiap terbit/batal/daur ulang masuk jejak audit (ALG-14), dan tiap perubahan pola masuk `master_system_parameter_history` (`reason`, `ip`, `approver_id`).

**Mode turun.** `NO_PATTERN_CONFIGURED` (tenant belum mengompilasi pola apa pun) → **penerbitan ditolak**, pendaftar tetap berstatus calon dengan nomor pendaftaran, dan layar menampilkan tautan ke layar pola + daftar token yang hilang — tidak ada NIM sementara, tidak ada angka acak, tidak ada warisan dari tenant lain. `NO_PATTERN_SOURCE` (token aktif menunjuk kolom yang belum terisi, mis. `{kodeProdi}` kosong) → penolakan per prodi, bukan per tenant: prodi yang siap tetap dapat menerbit. Keduanya adalah **flag pada hasil**, dan penyebabnya ikut di `explain` supaya penolakan dapat diperbaiki, bukan sekadar dirasakan.

**Sumber data** `tenant_settings.nim_format`, `nim_assignments` + sequence-nya (`0021`; objek & kolom milik DATA_MODEL §14.3/§14.7), `study_programs.kode_prodi`, `academic_periods`/`entry_year`, `pmb_applications` (`0021`), `feeder_identities` (§16.4) untuk gerbang daur ulang, `audit_logs` (ALG-14), `master_system_parameters` sebagai **indeks penemuan** saja (`source_of_truth='tenant_settings'`, DATA_MODEL §21.3 baris 21 — nilai tidak dibaca dari baris itu).

**Keamanan.** Pola NIM berkelas **REGULATORY** (DATA_MODEL §21.3): mengubahnya mengubah identitas yang dilaporkan ke negara → empat-mata + MFA penulis-admin + riwayat beralasan, dan `parameter_permissions` tidak boleh melonggarkan batas `CHECK` yang sudah ada (RBAC §4.6 norma SoD anti-pelonggaran). Nol egress; tidak ada PII keluar; tidak ada "NIM sementara" yang boleh ikut kirim Feeder. Titik aksi terbit/batal/daur ulang (`pmb.nim.generate` dan turunannya) **didaftarkan RBAC_MATRIX §4.5** — hari ini ia masih katalog modul §4.3; path & kode error **didaftarkan API_SPEC §2.3**.

### 12.18 Presensi multi-modus & rekonsiliasi dua sumber (mekanika, bukan engine)

Bagian ini, seperti §12.10, adalah **mekanika**: ia menata bukti dan vonis, tidak mengoptimasi. Mesin vonis kecurangan tetap ALG-12 (§12.7). **Kepemilikan tidak berubah:** path, query, bentuk respons, dan kode error gugus ini sudah menjadi milik [API_SPEC §4.18](file:///c:/SICA/docs/API_SPEC.md) (`/attendance/scan`, `/attendance/events/lms`, `/webhooks/lms/{provider}`, `/attendance/{sessionId}/reconciliation`) — bagian di bawah **tidak menulis ulang kontrak itu**, ia menetapkan kenapa mekanikanya begini dan invariance apa yang tidak boleh dilanggar. Salah satu kodenya sudah terdaftar dan dipakai di sini: **`422 EVIDENCE_INSUFFICIENT` (baris 117)** justru lahir dari tiga keadaan yang §12.18 sebut (hanya laporan vendor; rasio di bawah ambang saat vonis hadir diminta; `REQUIRE_BOTH` dengan satu sumber).

**Kosakata tunggal lebih dulu.** Modus kelas/sesi = `learning_modality ∈ {ONSITE, ONLINE, BLENDED}` (DATA_MODEL §21.4 — kosakata kanonik, kelas A′). Tiga ejaan hasil pengukuran **dilepas**: `offline` → `ONSITE`, `hybrid` → `BLENDED`, `delivery_mode` → `learning_modality`; kolom lama boleh tinggal satu rilis sebagai alias yang **ditulis di migrasi**, bukan dipertahankan diam-diam di kode. Diagram §8 ("Mode ONSITE vs Mode ONLINE") dan teks §8.2 ("watch-time ≥ 80 %") dibaca mengikuti kosakata ini: §8 = arah produk, §12.18 = penegakannya, dan angka 80 % §8.2 digantikan ambang bertipe parameter (`attendance.online_min_join_ratio`, baku 0,75). Yang **bukan** sinonim modus: `session_kind ∈ {REGULAR, SYNC_LIVE, ASYNC_MODULE, PRAKTIKUM, UTS, UAS, SUSULAN}` per pertemuan — satu kelas `BLENDED` memiliki ketiganya.

**Tiga jalur bukti.**

| jalur | bukti | cara vonis | rujuk |
|---|---|---|---|
| **Luring** | QR berotasi + geofence | `counter ∈ {C−1, C, C+1}`, `mac9` dengan `timingSafeEqual`, sekali-pakai di `attendance_token_uses`, `d − accuracy ≤ radius` | §12.7.1–§12.7.2 |
| **Daring** | peristiwa LMS internal: `join`/`leave` + *heartbeat* 60 s | `ratio = durasi_hadir / durasi_sesi` ≥ ambang `attendance.online_min_join_ratio` (rentang sah 0,50–1,00) — dihitung server atas log peristiwa, **bukan** klaim klien | §21.3 baris 23 (DATA_MODEL), ADR-11 |
| **Hibrida** | keduanya tiba paralel | Dual-Reconciliation Engine di bawah | §21.5 |

**Dual-Reconciliation Engine.** Untuk satu `(sesi, mahasiswa)`: kumpulkan semua bukti → tentukan **satu** vonis menurut kebijakan tenant `attendance.multi_source_policy` (kamus `kebijakan_rekonsiliasi`, §21.5) → tulis **satu** baris `attendances.status` (enum terukur §15.1; `PENDING_REVIEW` untuk yang wajib ditinjau) → simpan **setiap** bukti tambahan sebagai baris `attendance_evidence(source, occurred_at, duration_s, ratio, digest, device_digest)` (insert-only, ber-digest, `0049`).

| kebijakan | perilaku yang dinilai |
|---|---|
| `ONSITE_PRIMARY` | bukti luring menang; daring tercatat sebagai `evidence` saja |
| `ONLINE_PRIMARY` | rasio-join ≥ ambang menang; QR menjadi bukti tambahan |
| `MERGE_ANY` | salah satu bukti cukup; sumber tercatat gabungan (`QR+LMS`) pada evidence |
| `REQUIRE_BOTH` | dua bukti wajib; yang hanya punya satu → `PENDING_REVIEW` + jalur banding |
| `STRICT_LATEST` | bukti terakhir menang — hanya untuk koreksi, selalu dengan `VALIDATE` + alasan |

**Invariance yang tidak boleh dibalik.** (a) **tepat satu** baris `attendances` per `(session, student)` (`uq_attendances_session_student`) apa pun kebijakannya — kebijakan mengubah **vonis**, bukan **jumlah baris**; dibuktikan query CI DATA_MODEL §21.8 butir 6, bukan diyakini; (b) bukti tambahan tidak pernah menjadi kolom kedua di `attendances` (§21.5), sehingga keadaan dapat direkonstruksi enam bulan kemudian; (c) **waktu otoritatif adalah server** — `occurred_at` dari peristiwa/token yang diverifikasi server, tidak pernah dari jam perangkat (aturan §12.7.1); (d) rasio daring tidak dapat dipalsukan dengan mengirim satu `leave` palsu: urutan peristiwa divalidasi (`join` sebelum `leave`, *heartbeat* monoton, `digest` anti-duplikat), dan peristiwa tanpa pasangan `join` menjadi temuan, bukan kehadiran; (e) `REQUIRE_BOTH` dengan satu bukti → `PENDING_REVIEW` + hak banding lewat `attendance_appeals` (`0017`), **bukan** `ABSENT` diam-diam; (f) vonis kecurangan tetap milik ALG-12 (`fraud_score_bp`, ambang dari `academic_rules`) — rekonsiliasi dan skor adalah dua fungsi berbeda yang menulis ke kolom status yang sama, bukan dua kosakata status.

**Beban & letak komputasi.** Presensi massal tetap lewat jalur §10.10 (*batch flush*, tanpa decrement per-request); rekonsiliasi berjalan di worker per sesi selesai + inkremental saat bukti baru tiba; hasil dibaca **dari Primary** karena layar dosen menampilkan vonis segera setelah *scan* (read-your-writes, AGENTS §3.7). Verifikasi satu *scan* tetap `O(1)` di rute (§12.11 baris ALG-12) — yang pindah ke worker hanya agregasi rasio dan rekonsiliasi lintas sumber.

**Postur vendor (garis yang harus tegas, tidak untuk dinegosiasikan).**
1. Jalur **otoritatif** = SICA Virtual Campus *self-hosted* (BigBlueButton/Jitsi, ADR-11): peristiwa `join`/`leave` masuk `attendance_evidence` tanpa satu pun panggilan keluar → nol-API-key terpenuhi penuh, nol-kunci.
2. Zoom/Meet/Teams = **opsional**, hanya untuk kampus yang sudah berlangganan, dengan kredensial di **vault/ENV** — **bukan** baris DB dan bukan parameter UI (`CHECK (is_secret = false)` DATA_MODEL §21.2 menutup jalan lain), payload diverifikasi **signature/HMAC**, `timestamp` tunduk batas *skew* (`finance.webhook_max_clock_skew_s`, §21.3 baris 6, dipakai ulang sebagai batas *skew* umum), dan payload yang membawa PII di luar `{event, user_ref, duration}` **ditolak utuh**.
3. **Dilarang**: menjadikan laporan peserta vendor sebagai **satu-satunya** oracle kehadiran; menerbitkan `attendances` dari angka dashboard vendor; mengirim nama lengkap/transkrip/rekaman keluar untuk "analisis" (AGENTS §3.9, UU PDP); memakai API kewujudan/wajah berbayar (sudah ditolak §12.7.1). Bukti vendor karena itu hanya **pendukung** dan wajib tersimpan dengan `vendor` + `credential_ref` + `event_digest`, tanpa materi pertemuan (§21.6 butir 4).
4. Paritas Web ↔ Flutter (AGENTS §3.4): mahasiswa melihat **satu** status + daftar bukti + (bila ditolak) sebab dan tautan banding; tidak ada layar yang menampilkan rasio mentah sumber-vendor sebagai angka kehadiran.

**Mode turun.** Feed peristiwa LMS tidak tersedia → sesi `ONLINE`/`SYNC_LIVE` menghasilkan `PENDING_REVIEW` + temuan, **bukan** `PRESENT` dan bukan `ABSENT`. Webhook gagal verifikasi signature → ditolak + alarm (fail-closed §10.7). Baris kebijakan belum ada di seed tenant → `NO_RECONCILIATION_POLICY`: mekanika ini **tidak** mengambil default yang tidak tertulis; semua vonis sesi itu `PENDING_REVIEW` sampai Admin menetapkan kebijakannya lewat `PARAM_EDIT` kelas ACADEMIC.

**Yang menahan pengerjaannya.** `0049` (tabel `attendance_evidence` + dua nilai baru `attendance_source`, dan `ALTER TYPE` wajib di migrasi tersendiri sesuai DATA_MODEL §15.2) + **peristiwa LMS internal lebih dulu** — urutan itu sudah tercatat di DATA_MODEL §21.9. Rekonsiliasi tanpa sumber internal berarti satu-satunya oracle adalah vendor, dan itu melanggar butir 3 di atas.

### 12.19 Rantai lifecycle mahasiswa end-to-end (gerbang yang harus terbukti)

Yang bagian ini tetapkan **hanya urutan gerbang dan pemiliknya**. Tidak ada mesin baru di sini; tiap mata rantai menunjuk dokumen pemiliknya, dan karena itu tidak ada satu pun angka akademik yang boleh dihitung di klien.

| # | Mata rantai | Pemilik spesifikasi | Kode izin (milik RBAC_MATRIX) | Apa yang menahan |
|---|---|---|---|---|
| 1 | Camaba mengisi **Dynamic Form** | UI_UX §13 + DATA_MODEL §20 (mesin kamus `reference_items`, atribut kustom `tenant_custom_attributes` + `attributes jsonb`) | `pmb.application.create/.update`, `pmb.document.upload` | `0021` (tabel PMB belum ada), `0048` (atribut), kamus nasional **`[VERIFIKASI-KAMUS]`** — wilayah/agama/penghasilan belum di-*seed* (SEED_DATA) |
| 2 | Berkas jadi data: **ALG-7** OCR/PDF | §11.9 Lapis 0–7 + `document_templates`/`document_template_anchors` (§17.9) | `document.extract`, `document.extraction.confirm`, `pmb.document.verify` | template aktif (`VALIDATE`), retensi mentah 30 hari; tulisan tangan **tidak** dijanjikan |
| 3 | Seleksi & **tie-break** | `pmb_waves`/`pmb_paths`/`pmb_program_quotas`/`pmb_selection_results` (`0021`; `EXCLUDE` anti-gelombang beririsan; `tie_break_rule` deterministik; promosi `RESERVE` saat ada yang tidak daftar ulang, BENCH-07) | `pmb.selection.rank`, `pmb.selection.announce` | `0021` + `pmb_program_quotas` = objek **CP1 Feeder** (tanpanya kirim checkpoint mustahil) |
| 4 | **Kelompok tarif / UKT** = pohon keputusan | **ALG-4 dipakai ulang** (§11.6) di atas `fee_tariff_groups`/`tuition_tariff_matrix` (`0046`); fakta = penghasilan & tanggungan ortu (`student_guardians`, `reference_items(kind='penghasilan')`), jalur (`pmb_paths`), wilayah (6 digit awal NIK → kamus Kemendagri, §12.6), **bukti** = berkas ALG-7 | `finance.tariffgroup.view/.create`, `finance.tuitionmatrix.view/.insert/.update/.approve` (`VALIDATE`, empat-mata) | `0046` tertahan `0021` (kunci `pmb_paths`/`pmb_waves`); `TARIFF_NO_MATCH` (106) & `TARIFF_RULE_AMBIGUOUS` (105) = generator **dilarang menebak**; keluaran = **draf** + `VALIDATE` BAUK, tidak ada angka tanpa bukti |
| 5 | **NIM** terbit | **ALG-18** §12.17 + `nim_assignments` (`0021`) + sequence per prefix | `pmb.nim.generate` (bundle `ADM_PMB`, + `identity.user.create` terbatas `APPLICANT`) | pola aktif `tenant_settings.nim_format`; gerbang daur ulang `feeder_identities`; MFA penulis-admin |
| 6 | **Pemaketan KRS semester-1** | `krs_packages` + item (`0023`; FR-AKA-16; `academic_rules.first_semester_packed_sks`) | `enrollment.krs.view`, lalu `enrollment.krs.submit` (baris 9) | `class_distributions` terisi — invariance I-12: kelas tidak muncul di KRS tanpa sebaran |
| 7 | **Alokasi shift hybrid** (praktikum + jadwal) | **ALG-2** §11.4 (FFD + B&B) & **ALG-8** §12.3 (CSP, H-5/H-6), kosakata `learning_modality`/`session_kind` §12.18 | `teaching.laballocation.run/.apply`, `teaching.timetable.run/.apply` (`VALIDATE`) | `lab_resource_capabilities` (§17.3) + `lecturer_availability` (`0037`); ruang tanpa kapasitas = kendala tidak ditegakkan |
| 8 | **VA & rekonsiliasi multi-bank** | `virtual_accounts`/`payment_windows`/`payment_allocations`/`receipts` (`0022`; `UNIQUE (bank_code, va_number)` **lintas tenant**, BENCH-34) | `finance.invoice.generate`, `finance.payment.view`, `finance.reconcile.run`, `finance.payment.confirm` (semua `UPDATE`/`INSERT`; yang `VALIDATE` ada di `finance.waiver.approve` & `finance.invoice.void`) | `0022` + kredensial kanal di vault/ENV; **idempoten**, saldo **suspens** untuk transfer tak cocok, dan dua orang untuk pembatalan (BR-K2) |
| 9 | **Gerbang KRS** (tagihan, presensi, wali) | service KRS §10 + rekomendasi ALG-9 §12.4 | `enrollment.krs.submit` (🔒 MFA), `enrollment.krs.approve`, `enrollment.advisor.recommendation.run` | `academic_rules` (jendela OW, plafon BR-A2/BR-R2), gerbang tagihan BR-K*, ambang presensi BR-A15 (75 %, §21.3 baris 1) |
| 10 | **Presensi hari pertama** | **ALG-12** §12.7 + mekanika §12.18 | `attendance.qr.generate`, `attendance.qr.scan`, `attendance.record.view`, `attendance.summary.view` | `0041` (anti-pemalsuan) + `0049` (`attendance_evidence`); `rooms.longitude/latitude` + `allowed_radius_m` terisi |

**Tiga aturan yang membuat rantai ini sah.** (1) **Tidak satu pun angka di atas dihitung di klien**: kelompok tarif/UKT, NIM, isi paket SKS, hasil seleksi & tie-break, status tagihan, dan vonis presensi adalah **proyeksi server** — kolom `SERVER_ONLY` + `FIELD_RULES` (AGENTS §3.8), dan klien tidak pernah menerima rumus atau ambang sebagai objek yang dapat disunting. (2) **Setiap mata rantai berhenti dengan sebab, bukan dengan nol**: `422 ENGINE_DATA_INSUFFICIENT` (99), `TARIFF_NO_MATCH` (106), `TARIFF_RULE_AMBIGUOUS` (105), `NO_PATTERN_CONFIGURED`/`NO_EQUIVALENCY_DICT`/`NO_RECONCILIATION_POLICY` adalah jawaban yang dapat dibaca, dan layar menampilkannya apa adanya (FR-ADM-11). (3) **Perpindahan ke mata rantai berikutnya hanya lewat gerbang `VALIDATE` service domain** — bukan lewat kolom yang diisi mesin (ADR-15, `proposal_only`), dan tiap perpindahan menghasilkan `audit_logs` + outbox (ADR-7) serta masuk rantai ALG-14 bila objeknya berjejak tak-ubah.

**Status rantai: design-only sampai migrasinya dieksekusi.** Yang menahan rantai ini secara fisik adalah `0021` (PMB), `0022` (kanal & VA), `0023` (sebaran & paket), `0041` (anti-pemalsuan presensi), `0046` (tarif), `0048` (atribut kustom), `0049` (parameter & bukti presensi), `0050` (menu & izin parameter) — semuanya sudah **didaftarkan DATA_MODEL** sebagai pemilik register objek & nomor, dan **belum** ada di `packages/database/migrations/` (yang riil hari ini `0001`–`0006` + `0011`). Karena itu klaim "alur camaba sampai presensi otomatis sudah berjalan" adalah temuan audit, bukan laporan kemajuan.

### 12.20 Penempatan, *budget*, dan mode turun (lanjutan tabel §12.11)

| Engine | Penempatan | *Budget* baku | Skala target | Mode turun |
|---|---|---|---|---|
| ALG-15 | *worker* `engine.exam` | 30 s / 200 ribu *backtrack* | 60 sesi × 5 hari × 20 ruang (per prodi per periode) | `NO_LECTURER_AVAILABILITY`; `PARTIAL_BUDGET_EXHAUSTED` **dengan `gap` vs batas bawah**; `422 ENGINE_DATA_INSUFFICIENT` (99) bila kalender final dituntut tanpa `exam_participants` |
| ALG-16 | *worker* `engine.mbkm` (batch per prodi) | 60 s / 500 baris transkrip; `k ≤ 50` per blok | 3.000 baris konversi per semester | `NO_EQUIVALENCY_DICT` (draf kosong + daftar objek kurang); tanpa peta huruf → `NO_GRADE_MAP`, nilai mitra dibiarkan apa adanya sebagai bukti |
| ALG-17 | *worker* `engine.bkd` (batch per unit, di luar jam kerja dosen) + baca hasil *cache* | 30 s / 1.000 dosen | 1.000 dosen × 320 sesi per tahun | `NO_LECTURER_ATTENDANCE_FEED` (hanya "beban terjadwal", labelnya tidak boleh "realisasi"); kamus komponen kosong → rasio Tridharma **tidak dilaporkan** |
| ALG-18 | **bukan** *worker*: modul murni + satu `UPDATE` atomik di **Primary** dalam transaksi `nim_assignments` | < 5 ms per terbit; batas token & jumlah versi aktif dibaca dari parameter (gerbang (q)) | 5.000 NIM per gelombang (musiman PMB; bukan jalur panas KRS) | `NO_PATTERN_CONFIGURED` → **menolak terbit**; `NO_PATTERN_SOURCE` bila segmen tidak punya sumber; tidak ada NIM parsial, tidak ada angka "sementara" |

Tetap tunduk AGENTS §3.7 dan penutup §12.11: mutasi hanya ke Primary, baca-setelah-tulis dari Primary, tanpa `LOCK TABLE`, indeks domain dengan `tenant_id` kolom pertama (`int4range` + GiST, `EXCLUDE USING gist` untuk tumpang-tindih ruang/jadwal/ujian), hasil panjang tidak lewat HTTP — yang dikembalikan adalah tautan ke baris `*_results`. ALG-18 secara sengaja **di luar** jalur §10: ia satu baris per mahasiswa, bukan resource rebutan, sehingga tidak butuh lease, tidak butuh Redis, dan tidak boleh ditulis sebagai "KRS War kedua".

**Dependensi *design-only* & gerbang CI untuk keempat engine ini tercatat di §12.12** (diperbarui pada siklus ini: `or-tools` berlaku juga untuk ALG-15; dua gerbang baru **(q)** dan **(r)**, dengan lompatan huruf dari (l) ke (q) yang sudah dijelaskan di sana).

**Catatan angka.** Seluruh *budget* dan "skala target" pada tabel §11.10, §12.11, dan §12.20 adalah **anggaran rancangan, bukan hasil ukur repositori ini** — sama seperti catatan di §10.1. Yang mengikat bukan angka itu, melainkan tiga hal yang dapat diuji: run yang melewati *budget* **wajib** mengembalikan `PARTIAL_BUDGET_EXHAUSTED` bersama `gap`/inti konflik (bukan hasil parsial berlabel "selesai"), kendala tanpa data sumber **wajib** dilaporkan sebagai tidak ditegakkan, dan setiap engine **wajib** menolak menulis tabel domain. Angka rancangan yang belum diukur ditandai `[TIDAK-TERVERIFIKASI]` di tiap engine.

---

### 12.21 ALG-25 · Anomaly Detection Multivariat (Isolation Forest + LOF, lokal, nol-kunci) — 2026-10-21

**Permintaan yang dijawab.** Brief pemilik menuntut "Anomaly Detection Engine (Local Isolation Forest / LOF WASM)" untuk tiga domain: kejanggalan presensi, transaksi keuangan, dan lonjakan trafik. Ketertelusuran mesin sebelumnya berhenti di 24 kode (`ALG-1…ALG-24`) dan **tidak satu pun** menangani deteksi anomali multivariat: yang dekat hanya `ALG-22 · On-Device Face-Mesh & Proctoring Anomaly Proposals` (citra, bukan gejala akademik/keuangan) dan `ALG-12` (anti-pemalsuan QR, aturan deterministik). `node .tools/ai-params-audit.mjs` mengukurnya sebagai `TANPA KODE`. Bagian ini menutupnya sebagai **ALG-25** dan mendaftarkan objeknya di [DATA_MODEL §25](file:///c:/SICA/docs/DATA_MODEL.md).

**Kenapa dua algoritma, bukan satu.** Isolation Forest dan Local Outlier Factor punya mode kegagalan yang berbeda dan keduanya harus dilaporkan: IF menangkap titik yang terisolasi di ruang fitur global (murah, `O(n)`, cocok untuk 10.000 baris presensi per minggu), LOF menangkap tetangga padat-yang-jarang (mahasiswa yang presensinya "normal" untuk klusternya tetapi menyimpang dari klaster itu sendiri, mis. prodi malam vs reguler). Menjalankan keduanya atas snapshot yang sama dan **mempertemukan peringkatnya** adalah desain, bukan pemborosan: temuan yang hanya muncul di satu algoritma ditandai `SINGLE_MODEL_AGREEMENT` dan tidak boleh naik ke vonis apa pun.

**Masukan per domain (fitur, bukan data mentah).** `attendance`: selisih jam scan terhadap `class_sessions.start_time`, jarak meter dari geofence (`accuracy_meters` ikut sebagai kualitas, bukan dibuang), rasio join kanal vicon terhadap ambang `attendance.online_min_join_ratio`, jumlah scan ditolak `OUT_OF_GEOFENCE` per mahasiswa-periode. `finance`: selisih `payments.amount_rupiah` terhadap `invoices.net_amount`, waktu bayar terhadap `payment_windows`, jumlah pembatalan/reverse per operator per hari, nominal ganjil (< Rp 10.000) pada rekening yang biasanya bulat. `traffic`: permintaan per tenant per menit, rasio 4xx/5xx, lonjakan `POST /attendance/qr/scan` di luar jam kuliah. Semua fitur dihitung **di worker dari DB**, tidak pernah dikirim dari klien; `pii_level='SPECIFIC'` tidak menjadi fitur mentah (NIK/NIM tidak pernah masuk vektor — hanya agregat atau hashed bucket).

**Harness, reproducibility, dan anggaran.** Enam kolom wajib ikut di setiap run (`engine_code='ALG-25'`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`) dan run disimpan sebagai baris `engine_runs` (`0036`), bukan tabel kedua. Anggaran baku: `maxSeconds=180`, `maxSamples=250.000` per domain per tenant per hari, `contamination_bp` dari parameter (baku 50 = 0,5 %, rentang 10–200), `n_estimators=100`, `k_nn=LOF 20`. Seed PRNG disimpan dan wajib ditampilkan di `explain`. Run di atas `n > 250.000` **tidak** dipaksakan: ia keluar `PARTIAL_BUDGET_EXHAUSTED` dengan cakupan yang benar-benar diperiksa, dan angka itu tidak pernah boleh tampil sebagai "seluruh transaksi sudah dibersihkan".

**Mode turun yang wajib tampil apa adanya.** `NO_PREREQ_DATA` (kolom fitur belum terisi, mis. `attendance_channel_evidence` belum berbaris), `SINGLE_MODEL_AGREEMENT` (hanya satu detektor yang menandai), `FEATURE_DRIFT` (`psi > 0,25` pada salah satu fitur — ambang yang sama dipakai `ALG-10`), `NO_BASELINE` (belum ada 30 hari data untuk domain itu), `NO_FEEDBACK_LABELS` (tidak ada verdict manusia, sehingga akurasi tidak dapat diklaim sama sekali). Tidak ada satu pun mode turun yang boleh disenyapkan oleh UI (`UI_UX §12`).

**Penjelasan & umpan balik.** Setiap temuan membawa `explain`: kontribusi fitur (skorPath-length untuk IF, `reachability`/`lrd` rasio untuk LOF), nilai fitur saat itu, pembanding (median klaster), dan `domain` + objek sumber (`attendance_id`/`payment_id`/`route_key`). Peran manusia adalah **vonis**, bukan hitung: `analyst_verdict ∈ {TRUE_ANOMALY, FALSE_POSITIVE, NEEDS_CONTEXT}` ditulis ke `anomaly_feedback_labels` (insert-only) dan menjadi bahan kalibrasi `contamination_bp` — dengan `parameter_version` baru, bukan dengan mengubah angka di kode.

**Keadilan antar-tenant dan privasi.** Kuota run per-tenant (fair-share, antrean terpisah dari OCR/penjadwalan), dan hasil agregat lintas tenant **tidak pernah** dihitung: model dilatih/diskor per penyewa, karena menyatukan distribusi keuangan kampus A dan B adalah pelanggaran isolasi, bukan efisiensi. Domain `traffic` hanya memakai data yang sudah masuk `system_audit_trails`/telemetri internal, bukan payload berisi PII.

### 12.22 Vonis penempatan WASM: preview di perangkat, vonis di server

**Permintaan vs norma.** Brief menyebut "LOF WASM" dan "Decision Tree / Logistic Regression WASM". Norma yang sudah terkunci tidak bisa dinegosiasikan ulang di level selera: `AGENTS §3.4` (paritas Web↔Flutter, aritmetika kanonik), `§3.9` (rute HTTP tidak menghitung; engine di worker), dan `§3.8` (masking/penyaringan UI bukan kontrol akses). Vonisnya satu kalimat: **WASM di perangkat boleh dipakai untuk PREVIEW dan EXPLAIN, tidak pernah untuk menghasilkan angka yang menjadi hak orang.**

| Bentuk | Boleh | Tidak boleh |
|---|---|---|
| WASM di browser/aplikasi | menghitung ulang skor **dari fitur yang sudah dikirim server** untuk animasi/penjelas interaktif; menampilkan `explain` pohon dangkal; mengisi ulang slider "apa yang berubah bila ambang dinaikkan" | menulis vonis akademik/presensi/keuangan; menjadi satu-satunya sumber skor; memakai model yang tidak terdaftar di `ml_model_versions` |
| Worker (satu-satunya jalur resmi) | menjalankan IF/LOF/ALG-10 atas snapshot DB, menulis `*_results`, menaikkan `parameter_version` | menghitung di dalam handler HTTP (202 + `runId`, bukan hasil sinkron) |

**Konsekuensi yang harus dipenuhi kode nanti.** Angka yang tampil di layar dan angka yang dihitung di perangkat wajib **identik byte** (gerbang CI paritas numerik `TS ↔ Dart` yang sudah ada di §3.9 butir i), karena kalau tidak, pengguna melihat skor berbeda di dua platform untuk subjek yang sama. Karena itu: (1) server mengirim **fitur + skor + `explain`**, bukan model mentah; (2) perangkat **tidak pernah** mengirim skor ke API — field input yang diterima dari klien untuk objek berversi engine adalah `runId`/`candidate_ref`, dan sisanya `SERVER_ONLY`; (3) `model_version`, `seed`, `parameter_version` tampil di layar (bukan di `console.log`) supaya perbedaan dapat dilaporkan pengguna, bukan ditambal diam-diam.

**Status jujur.** WASM **belum** ada di manifest dependensi mana pun (`opencv` diukur 0 pada enam manifest untuk kasus yang sama di `§13.6`), dan `scikit-learn`/`onnxruntime`/`faiss` juga tidak. Seluruh §12.21–§12.22 adalah **design-only sampai dependensi nyata + golden vector diuji**; klaim "anomaly detection berjalan" dilarang di dokumen, layar, maupun PR — dan itu dijaga `.tools/dimension-audit.mjs`/`.tools/ai-params-audit.mjs`, bukan oleh kalimat ini.

## 13. Rantai data lintas modul, jalur real-time, dan peta algoritma 47 modul (2026-10-20)

Bab ini **melanjutkan**, tidak membuka ulang. Yang sudah diikat dan tidak disentuh di sini: garis tegas boleh/dilarang (§11.1), harness tunggal (§11.2, ADR-15), vonis KRS War dan Redlock (§10.1–§10.5, §12.2.1–§12.2.2), vonis *Edmonds–Karp* → **Dinic** (§11.7, §12.13 baris 10), Vonis nama objek (§12.2.5), delta sync Feeder (§12.10), presensi multi-modus (§12.18), dan rantai lifecycle (§12.19).

**Kepemilikan, supaya tidak lahir sumber kebenaran kedua.** Peta modul `M-01`…`M-47` + `APP` dan empat belas vonis deduplikasi adalah milik [PRD §5.12–§5.13](file:///c:/SICA/docs/PRD.md) — bab ini **menunjuk** nomor `M-xx`, tidak menyalin tabelnya. Nama objek, DDL, dan nomor migrasi milik **DATA_MODEL** (register §14.7 + §14.8); kode izin milik **RBAC_MATRIX** (§4/§4.5); path dan kode error milik **API_SPEC** (§2.3 + §6); pola layar milik **UI_UX_DESIGN**. Yang bab ini tetapkan hanya tiga hal: **kosakata peristiwa**, **vonis jalur real-time**, dan **peta algoritma ke engine** — termasuk engine baru `ALG-19`…`ALG-24`.

**Satu fakta penomoran yang harus dibaca lebih dulu.** DATA_MODEL berhenti di **§21** (diukur: `grep -n "^## " docs/DATA_MODEL.md` → §2 … §21; tidak ada §22). Jadi setiap objek baru yang lahir di bab ini **tidak punya nomor** dan tidak boleh ditulis seolah punya. Formulanya seragam: **nomor dan DDL dimiliki `DATA_MODEL §22`** (bagian yang belum ditulis).

---

### 13.1 Katalog peristiwa (event catalog) — satu nama, satu penerbit

Kanon penamaan: **`modul.entitas.aksi`** — tiga segmen, huruf kecil, `aksi` dalam bentuk lampau. Fisiknya satu baris `outbox` (DATA_MODEL §4: `aggregate`, `aggregate_id`, `event_type`, `payload`, `published_at`, `attempts`) yang ditulis **dalam transaksi yang sama** dengan perubahan domain (ADR-7) dan di-*relay* oleh worker dengan `Idempotency-Key` (§11.2). Nomor migrasi pembentuk tabel itu adalah `0012_audit_outbox.sql` (DATA_MODEL §14.7; **belum dieksekusi** — lihat §13.4).

Kolom **transaksi** memakai empat label baku: `TX-OUTBOX` (satu transaksi dengan mutasi, wajib), `TX-OUTBOX + IDEM` (ditambah kunci idempotensi), `BATCH` (baris lahir dari *flush* massal §10.10, satu peristiwa per agregat), `EPHEMERAL` (tidak masuk outbox, hanya stream — §13.2). **VALIDATE** = peristiwa itu adalah *permintaan* kepada manusia, bukan keputusan; **boleh diabaikan** = konsumen sah mengabaikannya tanpa merusak keadaan (selalu disertai jalur baca-ulang).

| event_type | penerbit | konsumen | payload minimal | transaksi | VALIDATE | boleh diabaikan |
|---|---|---|---|---|---|---|
| `pmb.application.submitted` | M-09 | M-10, M-45, M-31 | application_id, wave_id, path_id, program_id, applicant_membership_id, submitted_at | TX-OUTBOX + IDEM | tidak | tidak |
| `pmb.document.verified` | M-09 | M-10, M-11, M-34 | application_id, document_kind, attachment_id, verified_by, digest | TX-OUTBOX | tidak | tidak |
| `pmb.selection.announced` | M-09 | M-10, M-11, M-45, APP | application_id, program_id, result SELECTED-RESERVE-REJECTED, rank, tie_break_rule, wave_id | TX-OUTBOX | ya — pengumuman adalah aksi `VALIDATE` Kaprodi/PMB | tidak |
| `pmb.reregistration.confirmed` | M-09 | M-10, M-11, M-34 | application_id, funding_source_code, entry_cost_rupiah, receives_kps, kps_number | TX-OUTBOX | ya — `pmb.reregistrasi.update` + gerbang dua orang untuk KPS | tidak |
| `finance.tariff.drafted` | M-10 | M-09, M-11 | application_id, tariff_group_id, matrix_row_id, evidence_extraction_id, rule_version | TX-OUTBOX | ya — `finance.tuitionmatrix…approve`, empat-mata BAUK | tidak |
| `finance.invoice.issued` | M-10 | M-09, M-11, M-13, M-30, M-42, APP | invoice_id, student_id, period_id, amount_rupiah, due_at, channel VA hanya untuk peran berhak | TX-OUTBOX + IDEM | tidak — penerbitan tagihan adalah `INSERT` pemilik, bukan persetujuan | tidak |
| `finance.payment.settled` | M-10 | M-13, M-30, M-42, APP | payment_id, invoice_id, student_id, allocated_rupiah, settled_at, recon_source | TX-OUTBOX + IDEM | ya untuk rekonsiliasi tak cocok (suspens → `finance.reconcile.run`) | tidak |
| `pmb.nim.issued` | M-09 | M-13, M-18, M-19, M-34, M-39, M-42, APP | nim, student_id, program_id, pattern_version, sequence_snapshot | TX-OUTBOX + IDEM | tidak — ALG-18 menerbitkan di satu `UPDATE` atomik | tidak |
| `enrollment.krs.submitted` | M-13 | M-14, M-16, M-18, M-07, M-34, M-26 | enrollment_id, student_id, class_id, period_id, sks_running_total, opId, lease_epoch | TX-OUTBOX + IDEM | ya — `enrollment.krs.approve` (wali) | tidak |
| `enrollment.krs.approved` | M-13 | M-14, M-16, M-19, M-07, M-34, M-12 | enrollment_id, student_id, class_id, approved_by, effective_sks | TX-OUTBOX | tidak — peristiwa ini **adalah** hasil VALIDATE | tidak |
| `enrollment.seat.released` | M-13 | M-14, M-45, APP, ADR-12 waiter promoter | class_id, student_id, release_reason EXPIRED-ABANDONED-WITHDRAWN, basket_state | TX-OUTBOX | tidak | ya — promotion dihitung ulang dari DB, bukan dari urutan event |
| `teaching.timetable.published` | M-14 | M-13, M-15, M-16, M-18, M-43, APP | period_id, schedule_ids[], room_ids[], modality, published_by, rule_version | TX-OUTBOX | ya — `teaching.timetable.apply` milik ALG-8 adalah `VALIDATE` | tidak |
| `teaching.room.incident_declared` | M-33 | M-14, M-15, M-18, APP, M-32 | incident_id, building_id, room_ids[], window_int4range, displaced_session_ids[] | TX-OUTBOX | tidak — deklarasi fakta; **re-routing** yang butuh VALIDATE | tidak |
| `attendance.session.opened` | M-18 | APP, M-16 | session_id, room_id, rotate_seconds, challenge_issued | EPHEMERAL | tidak | ya — klien selalu dapat membaca ulang dari Primary |
| `attendance.record.verdict` | M-18 | M-07, M-19, M-10, M-24, M-30, APP | attendance_id, session_id, student_id, status, evidence_sources[], policy_code, fraud_score_bp | BATCH | ya hanya bila `PENDING_REVIEW` (banding `attendance_appeals`) | tidak |
| `lms.activity.progressed` | M-16 | M-18, M-19, M-12, M-10 | course_id, student_id, activity_ref, joined_s, watch_ratio, event_digest | BATCH | tidak | ya — bukti, bukan vonis; vonis tetap M-18 |
| `cbt.incident.detected` | M-17 | M-19, M-05, APP | exam_session_id, candidate_id, signal_kind, severity_bp, frame_evidence_ref | EPHEMERAL dua-arah | ya — **tidak pernah** membatalkan ujian otomatis (§13.6) | ya untuk tampilan, tidak untuk jejak: setiap sinyal wajib mendarat di tabel bukti |
| `assessment.grade.entered` | M-19 | M-12, M-26, APP | grade_id, enrollment_id, component_id, value_numeric, ast_formula_version | TX-OUTBOX | tidak | tidak |
| `assessment.grade.locked` | M-19 | M-12, M-30, M-34, M-26, M-23, M-31 | class_id, period_id, locked_by, inputs_digest, affected_student_ids_ref | TX-OUTBOX | ya — `assessment.grade.lock` menuntut MFA + SoD BR-G4 | tidak |
| `academic.obe.attainment.recomputed` | M-12 | M-31, M-32, M-37, APP | mk_id, cpl_id, period_id, attainment_bp, coverage_bp, degraded_flag | TX-OUTBOX | tidak — angka turunan, koreksi = hitung ulang | ya untuk dashboard, tidak untuk borang |
| `academic.khs.published` | M-19 | APP, M-31, M-11, M-26, M-30 | khs_id, student_id, period_id, ip_semester, cumulative_sks, published_at | TX-OUTBOX | ya — pengumuman adalah aksi `VALIDATE` | tidak |
| `thesis.logbook.entry_logged` | M-20 | M-07, M-25, M-19 | logbook_id, project_id, student_id, week_no, minutes, endorsed_by | TX-OUTBOX | ya untuk *endorsement* pembimbing (`thesis.logbook.endorse`) | tidak |
| `thesis.defense.result.proposed` | M-20 | M-19, M-23, M-30 | project_id, proposed_letter, rubric_total_bp, panel_ids[], examiner_signatures | TX-OUTBOX + IDEM | ya — **M-19 yang menulis `grades`** (vonis PRD §5.13 no 2) | tidak |
| `thesis.rama.deposited` | M-20 | M-39, M-31, M-05, M-44 | project_id, rama_doc_id, accession_no, similarity_run_id, embargo_until | TX-OUTBOX | ya — pustakawan mengesahkan deposit | tidak |
| `research.output.recorded` | M-44 | M-07, M-22, M-31, M-32, M-34 | output_id, lecturer_membership_id, kind_reference_code, period_id, evidence_attachment_id | TX-OUTBOX | ya — reviewer/Asesor mengesahkan luaran sebelum masuk BKD | tidak |
| `research.grant.disbursed` | M-44 | M-10, M-47, M-32 | grant_id, contract_id, stage_no, amount_rupiah, source_fund_id | TX-OUTBOX + IDEM | ya — pencairan = jurnal M-10, dua orang | tidak |
| `hr.bkd.recap.approved` | M-07 | M-08, M-06, M-31, M-34 | recap_id, lecturer_membership_id, period_id, component_values_bp, findings_ref, approved_by | TX-OUTBOX | tidak — peristiwa ini **adalah** hasil `hr.bkd.approve` | tidak |
| `sister.portfolio.pushed` | M-08 | M-05, M-32 | batch_id, lecturer_count, pushed_items, failed_items_ref, watermark_before/after | TX-OUTBOX + IDEM | tidak | ya — kirim ulang idempoten, watermark hanya maju atas baris sukses (§12.10) |
| `procurement.goods.received` | M-46 | M-40, M-10, M-32 | po_id, acceptance_id, line_items_ref, committed_budget_id, vendor_id | TX-OUTBOX + IDEM | ya — BAST adalah aksi `VALIDATE` PPK | tidak |
| `asset.card.created` | M-40 | M-14, M-31, M-32, APP | asset_id, acceptance_id, class_reference_code, location_room_id, acquisition_rupiah | TX-OUTBOX | tidak — baris aset lahir dari service pemiliknya (vonis PRD §5.13 no 6) | tidak |
| `asset.depreciation.posted` | M-40 | M-10, M-31, M-32 | asset_id, period_id, book_value_rupiah, method_code, schedule_run_id | BATCH | ya — posting penyusutan massal butuh `VALIDATE` BAUK | tidak |
| `endowment.yield.allocated` | M-47 | M-11, M-44, M-10, M-32 | portfolio_id, fiscal_year, allocated_rupiah, purpose_scholarship-hibah, policy_version | TX-OUTBOX + IDEM | ya — alokasi dana = keputusan empat-mata | tidak |
| `scholarship.award.granted` | M-11 | M-10, M-09, M-34, APP | award_id, student_id, scheme_code, period_id, coverage_bp, billing_effect | TX-OUTBOX | tidak — peristiwa ini **adalah** hasil `VALIDATE` pemberi beasiswa | tidak |
| `library.loan.cleared` | M-39 | M-30, APP | student_id, dimension LIBRARY, outstanding_items 0, cleared_at | TX-OUTBOX | tidak — **sinyal**, bukan status kelulusan (vonis PRD §5.13 no 3) | ya — M-30 dapat menghitung ulang dari `clearances` |
| `finance.dunning.cleared` | M-10 | M-30, APP | student_id, dimension FINANCE, open_invoices 0, cleared_at | TX-OUTBOX | tidak — sinyal | ya — sama, dapat dihitung ulang |
| `student_affairs.points.cleared` | M-24 | M-30, APP | student_id, dimension STUDENT_AFFAIRS, skkm_points, sanction_state, cleared_at | TX-OUTBOX | tidak — sinyal; **tidak boleh** menciptakan keadaan mesin akademik (M-24 kolom *tanggung jawab tunggal*) | ya |
| `graduation.clearance.evaluated` | M-30 | M-23, M-35, M-34, M-27, APP | student_id, period_id, dimensions_state, rule_version, gate_result | TX-OUTBOX | ya — `academic.clearance.update` adalah `VALIDATE` (nyata di `0011_rbac_scoped.sql:248`) | tidak |
| `graduation.yudisium.decided` | M-30 | M-19, M-23, M-35, M-34, M-27, M-31, APP | student_id, decision_date, predicate, diploma_draft_id, rule_version | TX-OUTBOX + IDEM | tidak — peristiwa ini **adalah** hasil keputusan `VALIDATE` | tidak |
| `graduation.diploma.signed` | M-35 | M-27, M-05, publik-verifier | diploma_id, pin_id, signature_alg, signature_digest, sivil_ref | TX-OUTBOX + IDEM | ya — penerbitan PIN/SIVIL berhenti bila clearance belum lengkap | tidak |
| `tracer.response.received` | M-27 | M-32, M-28, M-31 | response_id, graduate_id, period_id, months_to_work_bp, salary_band_ref | TX-OUTBOX | tidak | ya — read-model M-32 menghitung ulang dari fakta |
| `crm.lead.converted` | M-45 | M-09, M-32 | lead_id, application_id, campaign_id, channel_ref, cac_rupiah | TX-OUTBOX + IDEM | tidak — konversi **hanya** lewat service PMB (vonis PRD §5.13 no 12) | tidak |
| `event.registration.checked_in` | M-43 | M-24, APP | event_id, participant_id, gate_id, checkin_at, skkm_proposal_points | TX-OUTBOX | ya — poin SKKM adalah usulan sampai `VALIDATE` kemahasiswaan | ya |
| `identity.user.provisioned` | M-03 | semua modul, APP | user_id, tenant_id, membership_id, initial_role_assignment_ids[] | TX-OUTBOX + IDEM | tidak | tidak |
| `audit.chain.sealed` | M-05 | M-31, M-32, M-03 | partition, stream, root_hash, leaf_count, sealed_at | TX-OUTBOX | tidak — pengubahan hash **dilarang** (§12.9) | tidak |
| `ppks.case.registered` | M-36 | M-05 **hanya** jejak akses, tidak ada konsumen isi | case_id, tenant_id, created_at — **payload kosong oleh desain** | TX-OUTBOX | ya — penanganan kasus selalu aksi manusia ber-MFA | tidak |

**Tiga catatan yang membuat katalog ini sah, bukan sekadar daftar.**

1. **Kolom uang tidak mengalir ke peran akademik.** Nominal hanya terbaca oleh peran yang `FIELD_RULES`-nya mengizinkan (SoD BAAK↔BAUK, AGENTS §3.8); peran lain menerima boolean tertahan beserta sebab. Karena itu `finance.invoice.issued` dan `asset.depreciation.posted` **wajib** diproyeksikan server-side sebelum masuk stream apa pun — peristiwa tidak pernah menjadi saluran pembocoran nominal.
2. **`ppks.case.registered` sengaja berpayload kosong.** Vonis PRD §5.13 no 14 menuntut nol visibilitas isi bagi `TENANT_ADMIN`; satu-satunya hal yang boleh dipancarkan adalah **bahwa ada** kasus. Menyertakan judul, pelapor, atau terlapor di outbox = pelanggaran Permendikbudristek 30/2021, karena outbox dibaca worker lintas proses dan dapat tertahan di log (pola yang sama yang menolak nilai `GRADE_PUBLISH` di payload — DATA_MODEL §16.6).
3. **Peristiwa bukan pengganti pembacaan.** Konsumen yang menampilkan hasil **sesudah** tulis tetap membaca dari **Primary** (read-your-writes, AGENTS §3.7, §12.18 "Beban & letak komputasi"). Tidak ada satu pun baris di kolom "boleh diabaikan = ya" yang boleh satu-satunya menjadi dasar keputusan bisnis.

**Alias yang ditolak** (nama yang mungkin muncul dari kepala pemilik atau sistem lama; tidak ada satu pun menjadi `event_type`, dan generator kontrak menolaknya saat *build*):

| alias ditolak | kanonik yang dipakai | kenapa ditolak |
|---|---|---|
| `student_registered`, `registration_approved`, `pmb.approved` | `pmb.selection.announced` | satu peristiwa, tiga ejaan = tiga konsumen dengan semantik berbeda; pola `RD-32` di sisi kosakata |
| `nim_generated`, `nim_created`, `student.nim.assign` | `pmb.nim.issued` | `issued` menunjuk transisi state `RESERVED → ISSUED` yang nyata di `nim_assignments` (`0021`); `generated` tidak menunjuk apa pun |
| `krs_submitted`, `krs.approved`, ` EnrollmentApproved` | `enrollment.krs.submitted`, `enrollment.krs.approved` | dua segmen kehilangan `entitas`; huruf besar menabrak konvensi `packages/contracts` |
| `attendance.marked`, `absen.created`, `attendance.qr.scanned` | `attendance.record.verdict` | yang dijual adalah **vonis** hasil rekonsiliasi multi-sumber (§12.18), bukan peristiwa *scan*; `scan` adalah EPHEMERAL (`attendance.session.opened`) |
| `nilai_final`, `grade_published_final` | `assessment.grade.locked`, `academic.khs.published` | "final" bukan keadaan; keadaan nyata adalah `LOCKED` (enum terukur DATA_MODEL §15.1) |
| `clearance_ok`, `lulus_siap`, `bebas_pustaka_done` | `library.loan.cleared`, `finance.dunning.cleared`, `student_affairs.points.cleared`, `graduation.clearance.evaluated` | sinyal per dimensi **harus** dibedakan dari evaluasi gabungan; `clearance_ok` mengaburkan vonis PRD §5.13 no 3 dan membuka jalan modul non-pemilik menyatakan "lulus" |
| `wisuda_ready`, `yudisium.event` | `graduation.yudisium.decided` | M-23 tidak memutuskan lulus (kolom tanggung jawab tunggal PRD §5.12.1 baris M-23) |
| `sync_full`, `delta_sync`, `feeder_changed` | `sister.portfolio.pushed`, `feeder.*` milik API_SPEC §6 | "delta" adalah **mekanika** §12.10, bukan peristiwa; peristiwa adalah hasilnya |
| `bkd_calculated`, `bkd.recap.generated` | `hr.bkd.recap.approved` | yang punya makna hukum adalah **persetujuan**, dan ALG-17 hanya menghasilkan temuan draf |
| `notif.push`, `websocket.message` | tidak ada — lihat §13.2 | saluran pengangkutan bukan kosakata domain; memasukkannya ke katalog membuat gerbang CI tidak dapat membedakan keduanya |

---


#### 13.1.1 perluasan 2026-10-21 — hop rantai pemilik yang belum punya penerbit (`RD-74`)

Gerbang `node .tools/chain-audit.mjs` memisahkan **seperti apa** rantai pemilik terjejak dari katalog 42 peristiwa di atas. Hasil ukur: **7 dari 10** rantai punya minimal satu hop tanpa peristiwa, dan **22 dari 48** modul registri tidak pernah menerbitkan apa pun (sebagian di antaranya memang read-model dan karena itu sah diam). Yang di bawah ini adalah **peristiwa yang masih kurang**, bukan peristiwa yang sudah ada dengan nama lain. Baris-baris ini **menyusul** katalog induk: ia belum punya nomor baris di §13.1 sebelum DDL penghasilnya ada di `DATA_MODEL §22`.

| Peristiwa yang diminta | Penerbit | Konsumen | Hop rantai pemilik | Prasyarat objek | Status |
|---|---|---|---|---|---|
| `fieldwork.logbook.logged` | M-25 | M-19, M-38, M-07 | rantai 2 (logbook DPL) | `0066` | **belum ada** |
| `fieldwork.mentor_grade.received` | M-25 | M-19 | rantai 2 (form nilai mitra) | `0066` | **belum ada** |
| `mbkm.conversion.proposed` | M-38 | M-19, M-13 | rantai 2 (konversi kredit ke KHS) | objek konversi MBKM **belum ternomor** di `DATA_MODEL` (rute `/mbkm/conversions` sudah dispesifikasi di `API_SPEC`) | **belum ada** |
| `thesis.defense.approved` | M-20 | M-19, M-30, M-39 | rantai 3 (approval sidang) | `thesis_records` (`0027`); penjadwalan sidang **belum ternomor** | **belum ada** |
| `thesis.grade.finalized` | M-19 | M-30, M-26 | rantai 3 (nilai sidang → clearance) | `grades` (`0002`) | **belum ada** |
| `hr.bkd.recap.approved` | M-07 | M-08, M-32 | rantai 4 (BKD → SISTER) | `admin.bkd` + item BKD (`0055` wilayah transport) | **belum ada** — padahal `RBAC_MATRIX` baris 173 sudah menyebutnya |
| `publication.sinda.verified` | M-21 | M-44, M-07, M-32 | rantai 4 (luaran terverifikasi) | §22.5 (`0061`) | **belum ada** |
| `ipr.filing.submitted` | M-22 | M-44, M-32 | rantai 4 (HAKI) | `0062` | **belum ada** |
| `graduation.convocation.registered` | M-23 | M-40, M-43 | rantai seremonial (wisuda) | `graduation_records` (`0019`/`0027`) | **belum ada** |
| `residence.wallet.settled` | M-42 | M-10, M-32 | rantai fasilitas (e-wallet → tagihan) | `0070` | **belum ada** |
| `clinic.counseling.booked` | M-41 | M-36 (rujukan kasus), APP | rantai kesejahteraan mahasiswa | `0071` | **belum ada** |
| `career.match.suggested` | M-28 | M-27, M-32 | rantai alumni-karier (IKU 1–2) | `0059` | **belum ada** |
| `mobility.credit.recognized` | M-29 | M-19, M-38 | rantai KUI (konversi ECTS) | `0060` | **belum ada** |
| `curriculum.cpl.attainment_updated` | M-12 | M-31, M-32, APP | rantai 8 (OBE) | §18.7 `cpl_targets` (`0036`) | **belum ada** |
| `modality.session.mode_changed` | M-15 | M-18, M-34 | rantai 7 (tag Feeder F/O/M ikut modus) | `0041`/§21.5 | **belum ada** |
| `quality.finding.raised` | M-37 | M-31, M-12, M-32 | rantai penjaminan mutu (PPEPP) | mesin state PPEPP ada di `DATA_MODEL` (§18); penerbit peristiwa belum dinomori | **belum ada** |
| `helpdesk.ticket.resolved` | M-04 | M-05, M-32 | rantai layanan internal | `0051` | **belum ada** |
| `hris.payroll.finalized` | M-06 | M-07, M-10 | rantai SDM (gaji → BKD/ledger) | `0054` | **belum ada** |
| `conference.attendance.captured` | M-16 | M-18, M-05 | rantai vicon (§5.15 PRD) | `0073`/`0074` | **belum ada** |

**Tiga aturan yang mencegah daftar ini menjadi polusi.** (1) Nama peristiwa mengikuti pola `modul.entitas.aksi` kosakata §13.1 dan **satu penerbit** per peristiwa; (2) peristiwa tidak boleh mendahului objeknya — bila `DATA_MODEL §22` belum menamai tabelnya, barisnya ditolak (norma `AGENTS §3.11`); (3) yang read-model dan yang memang tidak boleh menerbitkan **tidak** masuk daftar ini: `M-26`, `M-31`, `M-32`, `M-34` (staging milik M-34 hanya menerima), `M-01`/`M-02`/`M-03` sebagian sudah punya penerbit (`identity.user.provisioned`), `APP` bukan penerbit fakta tetapi konsumen.

**Angka yang boleh dikutip.** `node .tools/event-cite-audit.mjs` mencetak ukuran hari ini (katalog induk dan jumlah modul tanpa penerbit) sehingga kalimat di atas tidak basi ketika daftarnya bertambah. Catatan: rujukan peristiwa `hr.bkd.recap.approved` di `RBAC_MATRIX` baris 173 **sudah ada sebelum** peristiwa itu tercetak di katalog — itulah temuan `RD-74`, dan itulah yang ditutup oleh tabel ini.
### 13.2 Vonis jalur real-time

Pemilik menagih "WebSocket/Event Queue" untuk *real-time data integration*. Permintaannya sah; bentuknya harus diputus, bukan dibagi rata. Tiga jalur, dan ketiganya punya nasib berbeda:

| jalur | dipakai untuk | kenapa | status diukur hari ini |
|---|---|---|---|
| **SSE** (`text/event-stream`) | satu arah server→klien: antrean KRS War (§10.6.3), hasil `engine_runs` (ALG-1…ALG-24), dashboard IKU M-32, borang LKPS M-31, layar hasil ALG-8/ALG-15 | sudah punya preseden kontrak yang ditulis di §10.6.3 (heartbeat 15 s, `Last-Event-ID` jendela 15 menit, 2 stream/user, plafon 2.000 stream/tenant, degradasi wajib ke polling); tidak butuh *upgrade connection*, jadi jalan di belakang PgBouncer/CDN/L7 tanpa protokol kedua; amplopnya respons biasa | **nol** handler — diukur: `grep -ril "websocket\|EventSource\|text/event-stream" apps/web/src` → 0 berkas; **0** di seluruh repo untuk tiga bahasa sumber. §10.6.3 sudah menulis ini ("belum ada"); §13 ini **tidak** mengubahnya menjadi sudah ada |
| **WebSocket** | **hanya** dua arah: (a) *proctoring incident feed* M-17, (b) *gate check-in* M-43 | dua kasus ini satu-satunya yang punya **lalu-lintas klien→server terus-menerus** yang tidak dapat dibawa oleh satu `POST`: kandidat mengirim sinyal perangkat selama ujian berjalan, dan pintu acara mengirim pemindaian beruntun dengan balasan segera ("silakan masuk / tolak"). Untuk semuanya, satu `POST` + SSE sudah cukup dan lebih murah | belum ada dan **tidak** ada dependensinya di `package.json` (diukur: 0 kemunculan `ws`/`socket.io`); gugus ini karena itu design-only dan tidak boleh muncul di layar mana pun sebagai fitur |
| **Antrean berbasis DB** (`queue_operations`) | **spine** seluruh rantai §13.1: `opId`, state `QUEUED/PROCESSING/SUCCEEDED/FAILED/EXPIRED`, hasil terminal, DLQ | satu-satunya jalur yang **sudah dinormakan pemilik objeknya** (DATA_MODEL §16.1.4, `0030`), `UNIQUE (tenant_id, kind, idempotency_key)`, baris terminal tidak pernah di-UPDATE, dan ia tidak menambah komponen yang harus di-*failover*. Kontraknya **identik** dengan bentuk target BullMQ (§11.2 kalimat penutup), sehingga perpindahan tidak mengubah API maupun hasil | `queue_operations` **belum ada di kode** — 7 berkas migrasi nyata (`0001`–`0006` + `0011`) tidak memuatnya; 18 *route handler* yang ada juga tidak menyentuhnya |
| **Redis pub/sub + BullMQ** | *fan-out* stream lintas-instance dan worker domain saat ambang §10.5 menembak | satu-satunya cara men-*scale* SSE melampaui satu proses; pub/sub **bukan** penyimpan — peristiwa yang belum dibaca tetap harus ada di `outbox`/`queue_operations` | **design-only**. Diukur pada `package.json` akar, `apps/web/package.json`, `packages/contracts`, `packages/database`, `packages/logger`, `apps/mobile/pubspec.yaml`: `bullmq` **0**, `ioredis` **0**, `onnx` **0**, `opencv` **0**, `tesseract` **0**. Berlaku larangan AGENTS §3.9: tidak boleh disebut terpasang |

**Vonis yang mengikat.** (1) SSE adalah **satu-satunya** jalur dorong default; WebSocket **dilarang** untuk kasus lain, termasuk "biar terlihat real-time" di dashboard — dashboard M-31/M-32 membaca proyeksi lewat SSE/polling, bukan lewat koneksi dua arah. (2) Tidak ada **satu pun** angka akademik yang dihitung di klien: KRS War, vonis presensi, NIM, capaian CPL, tarif UKT, IKU, BKD, dan skor mesin adalah **proyeksi server** (`SERVER_ONLY` + `FIELD_RULES`, AGENTS §3.8; PRD §5.12.2 butir c). Ini lanjutan langsung dari §12.19 aturan 1 dan berlaku juga untuk SuperApp yang berjalan luring. (3) **Tidak ada state yang berubah hanya karena peristiwa UI.** Baris `queue_operations`/`outbox` adalah bukti; stream adalah **sinyal** (§10.6.3 butir terakhir). Klien yang kehilangan koneksi tidak boleh kehilangan keadaan, dan server tidak pernah mengubah `enrollments`, `grades`, `invoices`, `attendances` karena sebuah komponen React memanggil `onEvent`. (4) **Stream tidak pernah menjadi satu-satunya jalur keputusan** — setiap `SUCCEEDED`/`verdict`/`published` wajib diikuti satu `GET` read-your-writes ke Primary, dan setiap peristiwa EPHEMERAL harus punya padanan baca (`statusUrl`/`positionUrl` pola §10.6.1). (5) Urutan pengiriman **tidak** ditanggung oleh stream: konsumen yang bergantung pada urutan (misalnya promosi *waitlist*) menghitung ulang dari DB dengan `ORDER BY` deterministik (`sort_order, code` untuk kamus; `queue_number` untuk antrean), bukan dari urutan kedatangan event — pub/sub tidak menjamin urutan. (6) `attempts` + DLQ di `outbox` dan `queue_operations.kind` yang terdaftar (DATA_MODEL §15.3, kelas enum tertutup A) adalah **register**; menambah nilai baru = `ALTER TYPE … ADD VALUE` di migrasi tersendiri, bukan lewat UI.

---

### 13.3 Zero re-entry — aturan penolakan sunting

"Zero re-entry" bukan slogan. Ia adalah **daftar kolom yang dilarang diketik ulang di modul hilir**, dan setiap larangan menunjuk **satu vonis PRD §5.13** sebagai penegaknya. Bentuk penegakannya seragam: field itu **diterima sebagai `id`/`reference`, ditolak bila tiba sebagai nilai** (Zod *whitelist* L1 + `SERVER_ONLY` L3 + RLS L6; AGENTS §3.8 enam lapis).

| rantai | field yang **dilarang** diketik ulang di hilir | rumah tunggal nilainya | vonis yang menegakkan |
|---|---|---|---|
| PMB → billing → NIM → KRS | `nim`; `entry_year`; `program_id`; kelompok tarif; `tuition_rupiah`; nomor NIK dan penghasilan ortu | `nim_assignments` (`0021`) hasil ALG-18 §12.17; `fee_tariff_groups` + `tuition_tariff_matrix` (`0046`); NIM adalah `students.nim` **`SERVER_ONLY`** dengan `immutable_after = 'NIM_ISSUED'` | §5.13 no 10 (M-02 pemilik kamus, modul lain **dilarang menyalin nilai ke kolom sendiri**); §12.19 aturan 1; ALG-18 invariance (c) — NIM tidak pernah dibangkitkan di klien |
| PMB → billing (tarif) | angka UKT hasil "perkiraan petugas" | draf ALG-4 di atas matriks tarif; `TARIFF_NO_MATCH` (106) / `TARIFF_RULE_AMBIGUOUS` (105) berarti **generator dilarang menebak** | §12.19 baris 4; §5.13 no 5 (hanya M-10 yang menerbitkan invoice) |
| TA → logbook → sidang → RAMA → clearance | nilai sidang; tanggal sidang; SKS konversi hasil bimbingan; jumlah jam logbook sebagai "nilai" | `grades` milik **M-19**; logbook adalah **bukti**, bukan angka resmi; RAMA = objek deposit M-39 | §5.13 no 2 ("M-19 `grades` satu-satunya tempat nilai, termasuk nilai sidang"); no 3 (pemilik keadaan "boleh lulus" hanya M-30) |
| LPPM → luaran → BKD → SISTER → IKU5 | skor BKD; jumlah luaran; angka IKU | perhitungan BKD = **M-07** (ALG-17); fakta tridharma tetap di M-44/M-21/M-19; angka IKU dihitung **M-32 sebagai proyeksi**; M-08 = **transport** saja | §5.13 no 7 ("M-08 = transport saja, tidak memiliki angka") dan no 4 ("fakta tetap di modul sumber; M-31/M-32 proyeksi baca") |
| PBJ → anggaran → aset | kartu aset; harga perolehan; akun budget | `assets` milik **M-40**; komitmen & pembayaran milik **M-10**; M-46 menghasilkan **terima-aset** yang memicu service M-40 | §5.13 no 6 ("bukan INSERT sendiri") |
| Endowment → beasiswa / hibah | nominal alokasi yang boleh dipakai; tagihan beasiswa | M-47 menyatakan **porsi imbal hasil yang boleh dialokasikan** sebagai sumber dana berversi; M-10 satu-satunya penerbit jurnal/tagihan | §5.13 no 5 |
| KRS War → jadwal → presensi → BKD | `enrolled_count`; baris jadwal; jam mengajar | `enrollments` + guard `enrolled + held <= capacity` (§10.3.4 I-2); `class_schedules` milik **M-14**; jam BKD **dibaca** M-07 dari fakta, tidak pernah diketik | §5.13 no 8 (M-14 pemilik jadwal, M-13 pemilik enrollments + pegangan kursi); no 7 (M-07 hanya membaca fakta M-08/M-20/M-44) |
| Presensi + LMS → gradebook → OBE → KHS | `attendances.status`; bobot capaian; angka KHS | satu vonis per `(sesi, mahasiswa)` milik **M-18** (`uq_attendances_session_student`); `outcome_attainments` angka **turunan** yang tidak dapat diedit manual; KHS = proyeksi dari `grades` | §5.13 no 9 (modul lain mengirim **bukti** ke `attendance_evidence` lewat satu jalur ingest); §12.8 "Angka turunan tidak dapat diedit manual"; §12.18 invariance (a) |
| Yudisium → PIN/SIVIL → tracer | nomor ijazah; PIN; status lulus | `graduation.diploma` + PIN milik **M-35**, terbit hanya bila clearance M-30 lengkap; respons survei milik **M-27** | §5.13 no 3 (sinyal tidak boleh menyatakan lulus), no 13 (M-27 pemilik respons, keduanya memberi makan IKU 1/2 di M-32) |
| Clearance lintas sumber | status kelulusan yang "sudah boleh" | `clearances` + `clearance_dimension` (DATA_MODEL §5, enum nyata `ACADEMIC FINANCE LIBRARY LAB STUDENT_AFFAIRS ADMINISTRATIVE`); M-39/M-10/M-24 hanya memancarkan **sinyal** | §5.13 no 3 — dan diukur: **tiga** pemancar sinyal, **satu** penulis `student_clearance`; ejaan objek di PRD (`student_clearance`) vs DATA_MODEL (`clearances`) diselesaikan lewat arbitrase nama DATA_MODEL §14.8, bukan dengan membuat tabel kembar |
| CRM → PMB | nomor pendaftaran | `pmb_applications` milik **M-09**; M-45 memiliki lead/kampanye | §5.13 no 12 ("konversi lead hanya lewat service PMB, tidak membuat tabel pendaftar kedua") |
| PPKS / Klinik / Audit | isi kasus; isi rekam medis; isi jejak | M-36 pemilik kasus (isi tidak terbaca `TENANT_ADMIN`); M-41 kelas PII khusus; M-05 menyimpan **siapa membuka** tanpa isi | §5.13 no 14 |

**Empat aturan turunan yang dapat diuji mekanis.** (1) **Satu penulis per kolom keadaan** — tabel proyeksi hanya menyimpan salinan **baca-saja** yang dibangkitkan, seluruh kolomnya `SERVER_ONLY` (§5.13.2 butir 3). (2) **Konsumen tidak punya rute tulis** atas objek milik vonis; yang ada hanya satu endpoint pemancar sinyal berpola `POST /{objek}/{id}/signal-*` (§5.13.2 butir 2). (3) **Usulan dari non-pemilik = `403`, bukan `201`** — dan uji penolakannya wajib ada untuk tiga titik tempat tiga modul bertemu (vonis 1, 3, 9; §5.13.2 butir 5). (4) **Tidak ada field "AUTO" tanpa `candidate_ref` + ambang keyakinan + `margin`** (§11.1 "Kejujuran angka"): konsekuensi langsungnya, setiap isian otomatis dari rantai §13.1 menandai metodenya dan dapat dibuka kembali buktinya.

---

### 13.4 Lima skenario simulasi bisnis

Kolom **izin** menunjuk `resource × verb` sebagai **rujukan**, bukan penciptaan kode: kepemilikan katalog adalah RBAC_MATRIX §4/§4.5 (terukur 161 baris bernomor di §4.5, dengan kepala bagian yang masih menulis "145" — titipan ralat §12.13). Kode bertanda `(§4.3)` hari ini berstatus **non-normatif** sampai dipindahkan ke register (`G-15`). Kolom **state machine** menunjuk enum DATA_MODEL §15. **Kegagalan yang diuji** menunjuk empat titik kegagalan RBAC (AGENTS §3.8) dan uji penolakan engine (gerbang (j) §12.12).

#### Skenario 1 — Mahasiswa reguler (camaba → KHS pertama)

| # | aksi | M-xx | objek yang ditulis | event yang lahir | izin (resource × verb) | state machine | kegagalan yang diuji |
|---|---|---|---|---|---|---|---|
| 1 | Camaba mengisi Dynamic Form + unggah berkas | M-09 | `pmb_applications`, `pmb_documents`, `attachments` (`0021`, `0020`) | `pmb.application.submitted` | `pmb.application.create` INSERT, `pmb.document.upload` INSERT (keduanya §4.3) | `pmb_application_status` | form kamus kosong → tolak terbit field, bukan diam-diam memakai konstanta (§3.10); berkas `is_required` belum ada → tidak dapat lanjut |
| 2 | Berkas jadi data (ALG-7) | M-09 | `document_extractions`, `document_extraction_fields` | — (run engine; hasil di `*_results`) | `document.extract` OTHER | `extraction_state` `DRAFT → CONFIRMED` | Lapis 1 saja bila tanpa OCR; `score < 0,75` → field **kosong** + tautan bukti; tulisan tangan ditolak, tidak dijanjikan |
| 3 | Tagihan biaya pendaftaran | M-10 | `invoices`, `virtual_accounts` (`0022`) | `finance.invoice.issued` | `finance.invoice.generate` INSERT | `invoice_status` | replay `Idempotency-Key` → satu tagihan; nominal tidak terbaca peran akademik |
| 4 | Seleksi + *tie-break* deterministik | M-09 | `pmb_selection_results` | `pmb.selection.announced` | `pmb.selection.rank` OTHER, `pmb.selection.announce` VALIDATE | `selection_result_status` `SELECTED RESERVE REJECTED` | promosi `RESERVE` saat ada yang tidak daftar ulang dihitung ulang dari DB (bukan dari urutan event §13.2 butir 5); satu pendaftar lolos dua prodi → prodi kedua lepas otomatis |
| 5 | Kelompok tarif UKT (ALG-4 dipakai ulang) | M-10 | `fee_tariff_groups`, `tuition_tariff_matrix` draf (`0046`) | `finance.tariff.drafted` | `finance.tuitionmatrix.view` READ, `…insert` INSERT, `…approve` VALIDATE | `tariff_state` `DRAFT → ACTIVE` (ACTIVE butuh `approved_by <> requested_by`) | `TARIFF_NO_MATCH` (106) dan `TARIFF_RULE_AMBIGUOUS` (105) → **generator dilarang menebak**; empat-mata ditegakkan `CHECK` |
| 6 | NIM terbit (ALG-18) | M-09 | `nim_assignments` + satu `UPDATE` atomik sequence | `pmb.nim.issued` | `pmb.nim.generate` OTHER (§4.3) | `nim_assignments.status` `RESERVED → ISSUED` | `NO_PATTERN_CONFIGURED` → **menolak terbit**, bukan NIM asal; dua transaksi konkuren tidak boleh membaca `next_value` sama; `students.nim` ditolak dari body |
| 7 | Pemaketan KRS semester-1 | M-13 | `krs_packages` + item (`0023`) | `enrollment.krs.submitted` | `enrollment.krs.view` READ, `enrollment.krs.submit` INSERT wajib MFA | `enrollment_status` `DRAFT → SUBMITTED` | I-12: kelas tidak muncul di KRS tanpa `class_distributions`; plafon BR-A2 diuji di **pintu** dan di finalis (I-4) |
| 8 | Jadwal & ruang (ALG-8) | M-14 | `class_schedules`, `class_sessions` | `teaching.timetable.published` | `teaching.timetable.run` OTHER, `…apply` VALIDATE | `timetabling_run` `DRAFT → APPLIED` | kendala H-4/H-5 tanpa data → **dilaporkan tidak ditegakkan**, bukan "lolos"; `PARTIAL_BUDGET_EXHAUSTED` tidak boleh dirender "selesai" |
| 9 | Presensi hari pertama (ALG-12 + §12.18) | M-18 | `attendances`, `attendance_token_uses`, `attendance_evidence` (`0041`, `0049`) | `attendance.record.verdict` | `attendance.qr.generate` OTHER, `attendance.qr.scan` INSERT | `attendance_status` (+`PENDING_REVIEW`) | `counter` di luar `{C−1,C,C+1}` → tolak; `d − akurasi > radius` → `OUT_OF_FENCE`; `REQUIRE_BOTH` satu bukti → `PENDING_REVIEW`, **bukan** `ABSENT` diam-diam |
| 10 | Nilai & KHS | M-19 | `grades`, `grade_components` | `assessment.grade.entered`, `assessment.grade.locked`, `academic.khs.published` | `assessment.grade.publish` UPDATE , `assessment.grade.lock` VALIDATE | `grade_status` → `LOCKED` | penyetuju ≠ pengusul (BR-G4); formula dari AST, **tanpa** `eval()`; `Σ bobot ≠ 10000 bp` → `422 WEIGHT_SUM_NOT_100` |
| 11 | Feeder PDDikti | M-34 | staging + `feeder_jobs` | `feeder.*` milik API_SPEC §6 | `feeder.period.send` OTHER, gerbang kirim dua orang | `feeder_job.status` | watermark hanya maju atas baris sukses (§12.10 a); `feeder_id` hanya dari *bridge* (I-14); kemiripan setinggi apa pun **tidak** memberi hak menulis id pusat |

**Rantai yang selesai:** `pmb.application.submitted → finance.invoice.issued → pmb.nim.issued → enrollment.krs.submitted → teaching.timetable.published → attendance.record.verdict → assessment.grade.locked → academic.khs.published`. Delapan peristiwa, **nol** pengetikan ulang NIM/nominal/SKS di hilir (§13.3 baris 1, 3, 7, 8).

#### Skenario 2 — RPL Tipe A / konversi kredit

| # | aksi | M-xx | objek yang ditulis | event yang lahir | izin (resource × verb) | state machine | kegagalan yang diuji |
|---|---|---|---|---|---|---|---|
| 1 | Mahasiswa mengajukan transkrip RPL | M-38 | `mbkm_conversions` (draf, `0033`) | — (belum peristiwa; draf) | `academic.equivalency.view` READ (§4.3) | `mbkm_conversion_status` `DRAFT → SUBMITTED` | tanpa `mbkm_contracts` dua-approval → run boleh dihitung **tetapi tidak dapat di-apply** (§12.15 mode turun) |
| 2 | Berkas dikonversi ALG-7 → baris transkrip | M-09, M-38 | `document_extractions` | — | `document.extract` OTHER | `extraction_state` | IPK **dihitung ulang**, tidak dipercaya; konsistensi Σ baris vs tertulis |
| 3 | Kandidat + skor (ALG-16) | M-38 | `mbkm_conversion_lines` draf, `course_equivalencies` dibaca (`0008`) | — (hasil engine, `proposal_only`) | `academic.equivalency.manage` OTHER | `conversion_line_verdict` `AUTO REVIEW NO_MATCH` | `AUTO` tanpa `candidate_ref` + `score` + `margin` → ditolak CI; `EQUIV_CYCLE` **belum terdaftar** API_SPEC §2.3 sehingga tidak boleh dipakai di kode |
| 4 | Konversi ECTS / SKS mitra | M-29, M-38 | `eCTS` hanya sebagai **kamus kelas B** + baris konversi | — | `academic.equivalency.manage` OTHER, `master.lookup.*` (M-02) | — | matriks ECTS **bukan enum** (§13.6); tenant hanya memetakan label, tidak mengubah kode yang ditetapkan negara |
| 5 | Plafon & anti dobel-hitung | M-38 | cek `enrollments`/`grades` (baca), plafon dari `academic_rules` | — | — | — | BR-M1 ≤ 20 SKS/semester + plafon BR-R2 + SKS yang sudah diakui periode lalu; indeks unik parsial per `(tenant, student, internal_course)` adalah penjaga terakhir |
| 6 | Persetujuan **tiga orang** | M-38 | `mbkm_conversions.status` | `enrollment.krs.approved` (bila membuka KRS) | `academic.equivalency.apply` VALIDATE | `DRAFT → SUBMITTED → APPROVED → APPLIED` | `requested_by`/`first_approved_by`/`second_approved_by` wajib tiga identitas berbeda (`CHECK` nyata DATA_MODEL §16.2); **engine tidak pernah** menjadi salah satunya |
| 7 | Angka masuk KHS & OBE | M-19, M-12 | `grades`, `outcome_attainments` (`weight_source='MBKM'`) | `assessment.grade.locked`, `academic.obe.attainment.recomputed` | `assessment.grade.publish` UPDATE, `academic.obe.attainment.recompute` OTHER | `grade_status` | ALG-13 menghitung baris konversi **satu kali**; hitung ganda atas matakuliah internal yang sama → tes CI menolak |

**Yang membedakan skenario ini dari skenario 1:** SKS konversi **hanya** ada di tabel milik ALG-16/M-38. M-25 (KKN/PKL/Magang) mengirim *usulan* + logbook bergeofence sebagai bukti dan **tidak pernah** memutuskan angka (vonis §5.13 no 1). Tidak ada satu pun layar di M-25, M-29, atau M-20 yang boleh memiliki kolom "SKS hasil".

#### Skenario 3 — Dosen & riset (BKD → luaran → SISTER)

| # | aksi | M-xx | objek yang ditulis | event yang lahir | izin (resource × verb) | state machine | kegagalan yang diuji |
|---|---|---|---|---|---|---|---|
| 1 | Mengajar terjadwal | M-14, M-18 | `class_assignments`, `class_schedules`, `lecturer_attendances` (`0025`) | `attendance.record.verdict` (pengampu) | `teaching.assignment.update` UPDATE, `attendance.record.create` INSERT | `attendance_status` | pengampu di luar kelas ampuannya → `403` (L3 `requireDataPrincipal`, bukan label peran) |
| 2 | Deklarasi ketersediaan | M-14 | `lecturer_availability` (`0037`) | — | `teaching.availability.declare` INSERT | — | `EXCLUDE USING gist` menolak dua deklarasi bertumpuk; tanpa data → H-3 ALG-8 dan E-2 ALG-15 membawa `NO_LECTURER_AVAILABILITY` |
| 3 | Jurnal sesi (realisasi) | M-18, M-16 | `session_journals` (`0017`) | `lms.activity.progressed` | `attendance.record.view` READ | — | drift terjadwal vs terealisasi = **temuan dengan tautan baris sumber**, bukan angka rekap saja |
| 4 | Hitung BKD (ALG-17) | M-07 | temuan draf `bkd_*` (nomor dimiliki `DATA_MODEL §22`) | — (hasil engine) | `hr.bkd.calc` OTHER (§4.3) | `bkd_run.status` | **satu jam tidak dihitung dua kali** lintas prodi — `union` interval, bukan Σ SKS; tanpa `0025` → label wajib "beban terjadwal", **bukan** "realisasi BKD" |
| 5 | Komponen Tridharma non-otomatis | M-07, M-44 | portofolio entri dosen; kamus `reference_items(kind='bkd_komponen')` | — | `hr.bkd.submit` INSERT | `bkd_recap_status` `DRAFT → SUBMITTED → APPROVED` | kamus kosong → rasio Tridharma **tidak dilaporkan** + tautan `/admin/master/**`; ejaan `kind` final milik DATA_MODEL (catatan §12.16 butir 3), engine tidak menempel konstanta |
| 6 | Persetujuan BKD | M-07 | rekap final | `hr.bkd.recap.approved` | `hr.bkd.approve` VALIDATE | `→ APPROVED` | yang menjalankan `hr.bkd.calc` **tidak boleh** menjadi penyetuju `hr.bkd.approve` (SoD, invariance (c) §12.16) |
| 7 | Luaran & hibah | M-44 | kontrak hibah, luaran, monev | `research.output.recorded`, `research.grant.disbursed` | `research.*` — **belum ada di katalog**; mendaftarnya di RBAC_MATRIX §4.5 | `grant_status` | pencairan **ditulis sebagai jurnal M-10**, tidak ada jalur posting kedua di M-44 (vonis §5.13 no 5) |
| 8 | Kirim SISTER | M-08 | antrean kirim + watermark | `sister.portfolio.pushed` | `sister.*` — **belum ada di katalog** | `sync_run.status` | M-08 = transport: hanya mengirim item yang **sudah disetujui** M-07; kirim angka draf = temuan; kegagalan tidak menggeser watermark |
| 9 | IKU 5 & borang | M-32, M-31 | proyeksi baca-saja | `academic.obe.attainment.recomputed`, `audit.chain.sealed` | `report.iku.view` READ (spmi/tracer_iku) | — | M-31/M-32 **tidak menyimpan salinan yang dapat disunting** (vonis §5.13 no 4); `coverage` selalu ditampilkan — capaian 0,85 dengan `coverage` 0,40 adalah temuan |

#### Skenario 4 — Sarpras & keuangan (PBJ → anggaran → aset → penyusutan)

| # | aksi | M-xx | objek yang ditulis | event yang lahir | izin (resource × verb) | state machine | kegagalan yang diuji |
|---|---|---|---|---|---|---|---|
| 1 | Rencana kebutuhan + HPS | M-46 | paket pengadaan, HPS | — | `procurement.*` **belum ada** — daftar di RBAC_MATRIX §4.5 | `po_status` `DRAFT → ANNOUNCED → AWARDED` | HPS tidak boleh menjadi angka bebas tanpa jejak; empat-mata untuk penetapan PPK |
| 2 | Tender/RFQ + pemenang | M-46 | evaluasi (ALG-3 lapis AHP dipakai ulang — §13.5 `M-46`) | — | `procurement.award` VALIDATE | `→ AWARDED` | evaluator vendor **mengusulkan**, keputusan = `VALIDATE`; tidak ada skor yang menulis baris kontrak |
| 3 | Komitmen anggaran | M-10 | komitmen di ledger (bukan invoice kedua) | `procurement.goods.received` menunggu | `finance.invoice.create` INSERT, `finance.budget.*` **belum ada** | `ledger_status` | satu tagihan satu ledger satu jalur posting (tanggung jawab tunggal M-10); M-46 **tidak memposting jurnal sendiri** (vonis §5.13 no 6) |
| 4 | BAST / terima-aset | M-46 | berkas penerimaan | `procurement.goods.received` | `procurement.acceptance.validate` VALIDATE | `→ RECEIVED` | harga perolehan & spesifikasi **tidak diketik ulang** di M-40 — keduanya dibaca dari `acceptance_id` |
| 5 | Kartu aset | M-40 | `assets` (nomor dimiliki `DATA_MODEL §22`) | `asset.card.created` | `asset.card.insert` INSERT | `asset_status` | M-40 memanggil **service miliknya sendiri** atas peristiwa M-46; INSERT silang dari modul PBJ = `403` hasil uji penolakan §5.13.2 butir 5 |
| 6 | Penyusutan (ALG-23) | M-40 | jadwal penyusutan + posting draf | `asset.depreciation.posted` | `asset.depreciation.run` OTHER, `…post` VALIDATE | `posting_status` | aritmetika `numeric`/`bigint` rupiah (ADR-5), **bukan** float; nilai buku tidak pernah melampaui harga perolehan; metode tersimpan berversi karena mengubah laporan fiskal |
| 7 | Ruang menjadi bagian jadwal | M-14, M-33 | `rooms`, `class_schedules` | `teaching.room.incident_declared` (bila insiden) | `teaching.class.update` UPDATE, `academic.roomincident.declare` INSERT | `room_state` | aset sarpras **tidak boleh** menyunting jadwal langsung — M-33 memanggil solver yang sama dengan kendala tambahan (vonis §5.13 no 8) |
| 8 | Beasiswa dari dana abadi | M-47 → M-11 → M-10 | alokasi, award, jurnal | `endowment.yield.allocated`, `scholarship.award.granted`, `finance.invoice.issued` | `endowment.*`, `scholarship.*` **belum ada** di katalog | `allocation_status`, `award_status` | M-10 tetap satu-satunya penerbit tagihan; beasiswa mengubah **cakupan biaya**, bukan angka tarif dasar (tanggung jawab tunggal M-11) |

#### Skenario 5 — Interaksi multi-peran real-time (satu jendela Open Wiring)

| # | aksi | M-xx | objek yang ditulis | event yang lahir | izin (resource × verb) | state machine | kegagalan yang diuji |
|---|---|---|---|---|---|---|---|
| 1 | Mahasiswa menekan "Ambil Kelas" | M-13 | `queue_operations` (QUEUED) + `krs_baskets` (`0030`) | `enrollment.krs.submitted` | `enrollment.krs.submit` INSERT wajib MFA | basket `HELD` | `202 { opId }` **tidak pernah** dikirim sebelum baris `queue_operations` commit — tanpa baris, klien tidak punya apa pun untuk ditanyakan (DATA_MODEL §16.1.7) |
| 2 | SSE membuka stream posisi | M-13 → APP/Web | tidak ada (baca) | — (EPHEMERAL) | READ | `opId` `QUEUED → PROCESSING` | 2 stream/user + plafon tenant, `Last-Event-ID` 15 menit, heartbeat 15 s, degradasi ke polling — **tidak ada keputusan bisnis yang hanya bisa dicapai lewat SSE** (§10.6.3) |
| 3 | Dosen wali melihat antrean perwalian | M-13 | tidak ada (proyeksi) | — | `enrollment.krs.approve` VALIDATE | `enrollment_status` `SUBMITTED → APPROVED` | cache izin: penugasan wali yang **sudah dicabut dengan `valid_to`** harus terbit `403`, bukan `200` — titik kegagalan kedua dari empat (AGENTS §3.8) |
| 4 | Laboran melihat bentrok ruang | M-14 | tidak ada | — | `teaching.roomutilization.view` READ | — | izin cukup **tetapi** query membidik ruang prodi lain → wajib `0 baris` karena RLS, bukan karena filter aplikasi; tes CI menolak RLS tidak aktif |
| 5 | Pengawas ujian membuka *incident feed* | M-17 | `proctoring signals` (bila ada dasarnya) | `cbt.incident.detected` | `cbt.proctor.log.view` READ | — | dua-arah **hanya** di sini; sinyal tidak pernah otomatis membatalkan ujian (§13.6); **belum ada** di kode |
| 6 | Pintu acara melakukan check-in | M-43 | `event_checkins` | `event.registration.checked_in` | `event.checkin` INSERT — **belum ada** di katalog | — | dua-arah **hanya** di sini; poin SKKM lahir sebagai **usulan**, tidak sebagai keadaan akademik |
| 7 | Kursi habis di tengah perang | M-13 | basket `EXPIRED`, posisi `class_waitlists` dipertahankan | `enrollment.seat.released` | — | `HELD → EXPIRED` | Redis mati → `503 ENROLLMENT_ENGINE_UNAVAILABLE` **fail-closed**, bukan turun ke decrement DB per-request (§10.7); kode itu sendiri **belum ada** di API_SPEC §2.3 |
| 8 | Finalisasi worker | M-13 → M-14 | `enrollments`, `classes.enrolled_count` | `enrollment.krs.approved` | — | `HELD → CONSUMED` | `lease_epoch` lebih lama dari yang tersimpan → `FAILED_SUPERSEDED` terminal (§12.2.2); `CHECK (enrolled ≤ capacity)` adalah penjaga terakhir, fencing hanya memperkecil kerja sia-sia |
| 9 | BKD & presensi ikut bergerak | M-07, M-18 | temuan BKD, `attendances` | `attendance.record.verdict`, temuan §13.1 | `hr.bkd.calc` OTHER | — | hasil dibaca **dari Primary** oleh layar dosen (read-your-writes); menulis ke replica = pelanggaran §3.7, bukan micro-optimization |
| 10 | Yudisium mengevaluasi clearance | M-30 | `clearances` | `graduation.clearance.evaluated` | `academic.clearance.update` VALIDATE (nyata `0011:248`) | `clearance_state` | sinyal `library.loan.cleared` datang **setelah** evaluasi → wajib re-evaluasi, bukan diabaikan; M-39 tetap tidak dapat menyatakan "lulus" |

#### Batas bukti lima skenario (menggantikan inventaris historis 2026-10-20)

Lima skenario adalah spesifikasi gerbang, bukan laporan E2E lulus. Angka lama tujuh migrasi/18 route/16 modul NOL tidak lagi digunakan sebagai inventaris terkini. **0012_audit_outbox serta 0047–0050 sudah ada di filesystem**, sementara 0030 KRS baskets/queue dan sebagian besar engine/domain berikutnya belum memiliki file. 0049 adalah **system parameters**, bukan migrasi attendance_evidence; nomor bukti kanal mengikuti DATA_MODEL/0074. Daftar file terkini di MIGRATION_SOP §5.2.1, status penerapan DB harus diperiksa per lingkungan.

KRS masih sync advisory-lock/201 (`RD-11`/`P-6`); BullMQ/ioredis/Tesseract belum di manifest/lockfile. Keberadaan audit/outbox atau parameter tidak membuktikan rantai PMB→VA→NIM→KRS→presensi berjalan. Tiap hop memerlukan bukti source, kontrak, migrasi, uji scoped dan failure/recovery; tidak ada klaim semua engine siap dari diagram ini.

---

### 13.5 Peta algoritma per modul

Empat nilai status: **SUDAH DISPESIFIKASI** (§11/§12, punya alamat), **BARU** (dispesifikasikan di §13.5.1 — bab ini membuka nomor `ALG-19`…`ALG-24`), **DITOLAK** (punya vonis, lihat §13.6), **DESIGN-ONLY** (spesifikasi ada, dependensi/biner belum; AGENTS §3.9 melarang diklaim berjalan).

| M-xx | algoritma yang ditagih pemilik | ALG-xx pemilik | status | catatan |
|---|---|---|---|---|
| M-01 | Consistent Hashing | bukan engine (infra §9) | DESIGN-ONLY | ia strategi *sharding* Redis/cache, bukan komputasi akademik; tidak ada Redis di `package.json`, jadi tidak ada satu pun cincin konsisten yang dapat diuji. Alamat yang benar: §9.1 baris 3 |
| M-02 | Bitwise Permission Masking | — | **DITOLAK** | lihat §13.6 baris 2. Hak izin dibaca dari `user_role_assignments` (scope + `valid_to`), yang **tidak dapat** direpresentasikan sebagai bitmask tunggal |
| M-03 | Bitwise Permission Masking (versi gerbang) | — | DITOLAK sebagai sumber; **diterima sebagai cache** | bitmap `resolved-grants` di dalam proses boleh dipakai **setelah** dibaca dari tabel dan boleh dibuang kapan saja; ia tidak pernah menjadi bukti hak (AGENTS §3.8 L3/L4) |
| M-05 | Merkle SHA-256 chain | ALG-14 §12.9 | SUDAH DISPESIFIKASI | akar Merkle per 1.000 daun + `audit_chain_anchors`; TSA RFC 3161 **ditolak** (ADR-14) — jangkar WORM milik sendiri |
| M-06 | PPh21 bracket | **ALG-19** §13.5.1 | **BARU** | tarif progressif per lapisan + PTKP + biaya jabatan; `numeric`, berversi, dan tidak pernah menulis `ledger` |
| M-07 | Interval Tree O(log N) | ALG-17 §12.16 | SUDAH DISPESIFIKASI | angka pemilik **diluruskan** (bukan ditolak): bangun `O(n log n)`, query `O(log n + k)`; fisik di `int4range` + GiST |
| M-08 | Delta Hash Sync | mekanika §12.10 | SUDAH DISPESIFIKASI | `record_digest` SHA-256 atas kolom tujuan; watermark hanya maju atas baris sukses; M-08 tetap transport |
| M-09 | Tesseract OCR + Levenshtein | ALG-7 §11.9 + ALG-11 §12.6 | SUDAH DISPESIFIKASI (Tesseract DESIGN-ONLY) | jalur utama = AcroForm/layer teks **tanpa** OCR; tulisan tangan **tidak** didukung; Levenshtein ≤ 2 untuk kode pendek |
| M-10 | Multi-Variable Billing Matrix | ALG-4 dipakai ulang §11.6 | SUDAH DISPESIFIKASI | `fee_tariff_groups` + `tuition_tariff_matrix` (`0046`); keluaran draf + `VALIDATE`; tanpa cocok = `TARIFF_NO_MATCH`, bukan tebakan |
| M-11 | AHP economic scorer | ALG-3 §11.5 (lapis AHP) | SUDAH DISPESIFIKASI | matriks perbandingan berpasangan + **wajib** `CR ≤ 0,10`; `422 AHP_INCONSISTENT_MATRIX`; usulan kelayakan, keputusan manusia |
| M-12 | DAG topological sort | ALG-1 §11.3 + ALG-13 §12.8 | SUDAH DISPESIFIKASI | Kahn + forward/backward pass; rollup CPL linear dan **distributif** diuji CI |
| M-13 | Redis Redlock (O(1)) | — | **DITOLAK** | vonis §12.2.2 **tetap**; pengganti = `lease_epoch` + fencing token; lihat §13.6 baris 1 |
| M-14 | CSP + AC-3 | ALG-8 §12.3 | SUDAH DISPESIFIKASI | penyaringan unari → DFS + *forward checking* + AC-3 → min-conflicts; GA hanya sebagai perbaikan, tidak pernah satu-satunya jalur |
| M-15 | rekonsiliasi moda hibrida | mekanika §12.18 | SUDAH DISPESIFIKASI | `learning_modality` kelas A′; lima kebijakan `multi_source_policy`; satu vonis per `(sesi, mahasiswa)` |
| M-16 | TF-IDF local vector search | **ALG-20** §13.5.1 | **BARU** | indeks material & pencarian; **tidak** memanggil LLM, **tidak** mengirim teks keluar |
| M-17 | Local OpenCV Face Mesh WASM | **ALG-22** §13.5.1 | **DESIGN-ONLY** + DITOLAK sebagai vonis | `opencv` diukur 0 pada keenam manifest; lihat §13.6 baris 3 |
| M-18 | HMAC-SHA256 TOTP 5 s + Haversine < 30 m | ALG-12 §12.7.1–§12.7.2 | SUDAH DISPESIFIKASI | bentuk kanonik sudah tetap (`mac9`, `counter ∈ {C−1,C,C+1}`, `timingSafeEqual`, sekali-pakai di tabel); **30 m bukan konstanta** — ia nilai per-ruang, rentang sah dimiliki DATA_MODEL §21.3 baris 3 (10–500, kelas SECURITY sehingga tidak dapat dilonggarkan melewati `CHECK`) |
| M-19 | AST math evaluator | ALG-6 §11.8 | SUDAH DISPESIFIKASI | Pratt/shunting-yard, basis poin, kedalaman ≤ 12, **`eval()`/`new Function()` dilarang mutlak** |
| M-20 | Winnowing/Jaccard plagiarism | **ALG-21** §13.5.1 | **BARU** | sidik jari (*fingerprint*) + Jaccard atas *gram*; keluaran = temuan `similarity_bp`, **bukan** vonis mencontek |
| M-21 | OAI-PMH XML serializer + MARC21 BM25 ranker | **ALG-20** §13.5.1 | **BARU** | serialisasi keluar **bukan** engine keputusan; **egress hanya ke harvester yang terdaftar tenant**, dan bab ini menegaskan tidak ada panggilan keluar dari dalam engine (pola §11.1) |
| M-22 | (tidak ditagih sendiri) | ikut ALG-21 (kemiripan) + ALG-24 (skor) | SUDAH DISPESIFIKASI lewat pemiliknya | luaran HAKI mengalir sebagai **fakta** ke M-07; tidak ada skor kedua di sini |
| M-23 | Hungarian seating solver | ALG-16 §12.15 lapis 4 (Hungarian `O(n³)`, `n ≤ 60`) dipakai ulang | SUDAH DISPESIFIKASI | penugasan satu-ke-satu atas (kursi × peserta × rombongan); PRD §5.12.1 menaruhnya di M-23 dengan label `ALG-15` — nomor mesin tetap milik bab 12 dan tidak dipindah |
| M-24 | SKKM rule scorer | ALG-4 §11.6 dipakai ulang | SUDAH DISPESIFIKASI | aturan RETE dengan `fact_types` kemahasiswaan; poin adalah **usulan** sampai `VALIDATE`; tidak boleh menciptakan keadaan mesin akademik |
| M-25 | (geo-fence logbook) | ALG-12 §12.7.2 + ALG-16 §12.15 | SUDAH DISPESIFIKASI | M-25 mengirim usulan; konversi SKS **milik** ALG-16 (vonis §5.13 no 1) |
| M-26 | CPM DAG solver | ALG-1 §11.3 | SUDAH DISPESIFIKASI | read-model: tidak pernah menulis `enrollments` |
| M-27 | probabilistic lead funnel scorer (versi alumni) | **ALG-24** §13.5.1 | **BARU** | skor **prediksi**, bukan keputusan; tidak pernah mengubah status akademik |
| M-28 | bipartite matcher (lowongan × pelamar) | ALG-16 lapis 4 + ALG-20 (kecocokan) | SUDAH DISPESIFIKASI sebagai mesin, **BARU** sebagai perakitan | usulan pasangan; persetujuan oleh peran karir |
| M-29 | ECTS conversion matrix | ALG-16 §12.15 | SUDAH DISPESIFIKASI sebagai mesin; **enum DITOLAK** | lihat §13.6 baris 5: kelas **B** — kode ditetapkan negara/institusi pasangan, tenant hanya memetakan label |
| M-30 | DFA clearance | ALG-4 §11.6 + ALG-6 §11.8 | SUDAH DISPESIFIKASI | vonis §12.13 baris 6 tidak dibuka ulang: sisi aturan = RETE ALG-4, sisi automata = transisi state service + register enum DATA_MODEL §15; **tidak ada engine automata kedua** |
| M-31 | 9-criteria LKPS extractor | ALG-7 §11.9 + ALG-13 §12.8 | SUDAH DISPESIFIKASI | "ekstraktor" = template berversi ALG-7 atas data yang sudah ada + proyeksi baca; **tidak** menyimpan salinan yang dapat disunting (vonis §5.13 no 4) |
| M-32 | (agregat) | ALG-13 §12.8 + read-model | SUDAH DISPESIFIKASI | `analytics` sebagai modul sendiri sudah **ditolak** PRD §5.12.3; dashboard = proyeksi |
| M-33 | Max-Flow Min-Cut Edmonds-Karp | ALG-5 §11.7 | SUDAH DISPESIFIKASI — **nama keluarga diterima, implementasi Edmonds-Karp ditolak** | yang dipakai **Dinic** (worst `O(V²·E)`, mendekati `O(E·√V)` pada kapasitas satuan); alasan dan angka di §11.7 + §12.13 |
| M-34 | fuzzy matcher (Feeder) | ALG-11 §12.6 | SUDAH DISPESIFIKASI | Jaro–Winkler nama, Levenshtein kode, Dice/Jaccard 3-gram + TF-IDF *cosine* judul; vonis skor **dan** `margin` |
| M-35 | RSA/HMAC public signature | mekanika (bukan engine) | SUDAH DISPESIFIKASI sebagian; **DESIGN-ONLY** untuk TTE lintas-organisasi | kunci internal milik SECURITY/DATA_MODEL (RSA/FHPB atau HMAC ter-*wrap*); **tanpa TSA pihak ketiga** (§12.9 vonis "Jangkar luar") dan tanpa layanan tanda tangan berbayar |
| M-36 | AES-256-GCM zero-knowledge vault | mekanika DATA_MODEL §16.3.4 | SUDAH DISPESIFIKASI; klaim "zero-knowledge" **DITOLAK** | amplop `v(1) key_version(2) iv(12) ciphertext tag(16)` = `31 + n` byte + **dua kunci berbeda** (DEK dan HMAC blind index) sudah diikat; lihat §13.6 baris 6 |
| M-37 | PPEPP audit state machine | state machine + ALG-13 lapis *closing* | SUDAH DISPESIFIKASI | PRD FR-KUR-07 / BR-O4: `cpl_targets` → `obe_closing_actions` (`PROPOSED APPROVED DONE DROPPED`) → `next_cycle_attainment_id`; `gap_bp > 0` wajib; penyetuju ≠ pengusul; objek di `0042` |
| M-38 | bipartite matcher (konversi kredit) | ALG-16 §12.15 | SUDAH DISPESIFIKASI | satu-satunya konverter; tiga orang berbeda; `proposal_only` |
| M-39 | MARC21 BM25 ranker | **ALG-20** §13.5.1 | **BARU** | lihat catatan M-21; katalog adalah data, bukan indeks di kepala |
| M-40 | straight-line depreciation | **ALG-23** §13.5.1 | **BARU** | `numeric`, metode berversi, `post` butuh `VALIDATE` |
| M-41 | (tidak ditagih) | — | tidak ada engine | rekam medis = enkripsi + kelas retensi khusus (vonis §5.13 no 14), bukan algoritma |
| M-42 | 3D bin packing dorm | ALG-2 §11.4 (FFD multi-dimensi) dipakai ulang | SUDAH DISPESIFIKASI | FFD multi-dimensi **tidak dijamin optimum** dan itu wajib dilaporkan bersama selisih ke batas bawah (§11.1 "Kejujuran angka"); objek penghunian milik M-42 |
| M-43 | K-Means spatial clustering | **ALG-24** §13.5.1 | **BARU** | klaster pintu/acara; PRNG ter-*seed* dan seed tersimpan; tidak pernah menjadi dasar poin SKKM |
| M-44 | Naive Bayes proposal scorer | **ALG-24** §13.5.1 | **BARU** | v1 = koefisien terbaca-manusia (§12.2.4) — **bukan** ONNX; usulan telaah, reviewer yang memutuskan |
| M-45 | probabilistic lead funnel scorer | **ALG-24** §13.5.1 | **BARU** | corong lead; larangan fitur AGENTS §3.9 butir "daftar terlarang" berlaku juga di sini (gerbang (l)) |
| M-46 | AHP vendor evaluator | ALG-3 §11.5 lapis AHP dipakai ulang | SUDAH DISPESIFIKASI | `CR ≤ 0,10`; bobot = parameter berversi + empat-mata karena menentukan pemenang tender |
| M-47 | compound yield engine | **ALG-23** §13.5.1 | **BARU** | majemuk `numeric` per periode dengan `basis_poin`; hasil = proyeksi, alokasi = `VALIDATE`; **bukan** penasihat investasi |
| APP | SQLite differential sync + local TOTP hardware binding | mekanika, lanjutan §12.10 + **ALG-22** untuk luring-proctoring | **BARU di §13.5.2** (mekanika) | `drift ^2.18.0` + `sqlite3_flutter_libs ^0.5.24` **nyata** di `apps/mobile/pubspec.yaml:29-30` — satu-satunya nama di daftar pemilik yang **bukan** design-only; protokol selisihnya belum dispesifikasi, dan konflik **selalu** dimenangkan server (PRD §5.12.2 butir d) |

**Rekap terhitung.** 48 baris di atas (47 modul + `APP`). **27** menunjuk engine/mekanika yang **sudah dispesifikasi** (§11/§12), **7** menunjuk engine **BARU** (`ALG-19`…`ALG-24` + mekanika SuperApp §13.5.2), **6** berstatus **DESIGN-ONLY** sebagian atau seluruhnya (M-01, M-09 Tesseract, M-17, M-35, M-36 klaim, M-42 prasyarat `rooms`/`lab_resource_capabilities`), **4** **DITOLAK** sebagai model (`M-02`, `M-03` sebagai sumber kebenaran, `M-13` Redlock, `M-29` sebagai enum), dan **4** tidak menuntut algoritma (M-41 dan tiga baris cache/transport). Tidak ada satu pun nama algoritma dalam daftar tagihan pemilik yang **tidak** punya alamat.

#### 13.5.1 Engine baru ALG-19 … ALG-24

Keenamnya tunduk pada §11.1 (garis tegas), §11.2 (harness: `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain`, `proposal_only`), §11.10/§12.11/§12.20 (penempatan, `budget`, mode turun — tabel ini **melanjutkan** ketiga tabel itu dengan nomor baris baru), dan ADR-14…ADR-17. Rute HTTP tidak menghitung: ia mencatat job dan mengembalikan `202 { runId }`. Nama tabel hasil, DDL, dan nomornya **dimiliki `DATA_MODEL §22`**; titik aksinya **dimiliki RBAC_MATRIX §4.5**; path dan kode error **dimiliki API_SPEC**.

| engine_code | nama | fungsi & algoritma | kompleksitas / budget | tabel hasil milik sendiri | mode turun | gerbang CI |
|---|---|---|---|---|---|---|
| `pph21-bracket` | **ALG-19 · Statutory Withholding Bracket Calculator** | PPh 21 pegawai tetap: bruto − biaya jabatan − iuran pensiun → PKP (`pkp_annual = neto_annual × 50/12` untuk PTKP tidak terkawinkan dihitung sebagai **aturan berversi**, bukan rumus tersirat), lalu tarif per lapisan tarif negara. **Lapisan tarif adalah data kelas B** (`reference_dictionary_entries`) — tenant **tidak dapat** mengubah angka yang ditetapkan negara | `O(lapis)` = `O(1)` praktis; 100 ms / 20.000 pegawai per *run* di worker `engine.payroll` | `payroll_calc_results` + `payroll_calc_lines` | `NO_TARIF_DICT`: kamus kelas B belum di-*seed* → **menolak menghitung**, bukan memakai angka hafalan; status PTKP tidak terisi → baris ditandai `INCOMPLETE_PTKP` dan **tidak** ikut rekap | (g) nol egress; (h) golden vector setahun penuh; (i) paritas TS↔Dart untuk seluruh `numeric`; (j) engine tidak dapat menulis `ledger`/`payroll` |
| `local-retrieval` | **ALG-20 · Local TF-IDF / BM25 Retrieval Engine** | indeks terbalik atas korpus milik tenant (materi M-16, katalog MARC21 M-39, matakuliah M-12, lowongan M-28): tokenisasi → *stopword* bahasa id/en → **BM25** (`k1`, `b` = parameter berversi) dan/atau vektor TF-IDF *cosine* untuk kemiripan. **Serialis OAI-PMH bukan engine**: ia serialis deterministik atas hasil baca, dengan *resumption token* berversi | bangun `O(korpus)`; kueri `O(t + k)` dengan `t` = jumlah term kueri dan `k` = kandidat hasil pemangkasan plafon `top_k`; 5 s / indeks 500.000 dok | `retrieval_runs` + `retrieval_hits` (dengan `score_bp`, `method`, `explain`) | `NO_CORPUS`: korpus kosong → hasil kosong + tautan, **bukan** daftar "yang mungkin relevan" dari tenant lain; `degraded: "STEMMING_OFF"` saat pustaka *stemmer* id belum ada | (g) — **paling penting di sini**: tidak ada embedding cloud; (h) golden vector kueri→peringkat byte-identik; (l) uji bahwa tidak ada fitur terlarang ikut *scoring* |
| `winnowing-similarity` | **ALG-21 · Winnowing Fingerprint Similarity** | normalisasi → *gram* `k` (baku `k = 5`) → **Winnowing** (`window = w`, ambil nilai terkecil per jendela) → himpunan *fingerprint*; bandingkan antar-dokumen dengan **Jaccard** atas *fingerprint* dan laporkan `similarity_bp` + rentang *span* yang cocok. Untuk deposit RAMA (M-20/M-21) pembanding = korpus internal + deposit sebelumnya | `O(n)` bangun *fingerprint* per dokumen; perbandingan berpasangan `O(a + b)` dengan `a` = jumlah *fingerprint* dokumen pertama dan `b` = dokumen kedua, lewat *inverted index* atas *fingerprint* → bukan `O(n²)`; 60 s / 2.000 dok per *run* | `similarity_runs` + `similarity_pairs` + `similarity_spans` | `SELF_COMPARISON_ONLY_BULK`: dokumen tunggal tanpa pembanding → hasil `NO_BASELINE`, **bukan** "0 % mirip"; ambang penanda **wajib** parameter (gerbang (q)), dan `REVIEW` adalah keadaan akhir — tidak ada auto-reject | (h) golden vector teks→`similarity_bp`; (i) paritas; (j) engine tidak dapat mengubah `thesis_status` maupun nilai |
| `face-mesh-anomaly` | **ALG-22 · On-Device Face-Mesh & Proctoring Anomaly Proposals** | pra-pemrosesan citra **di perangkat/kontainer sendiri**: deteksi wajah → *mesh* titik → metrik **geometri** (rasio titik, sudut mata, keberadaan ≥ 1 atau ≥ 2 wajah) + metrik **temporal** (frekuensi wajah hilang, `ratio` wajah-di-luar-kotak). Keluarannya **anomali**, bukan identitas: tidak ada 1:N, tidak ada basis data biometrik, tidak ada "pengenalan wajah" | *mesh* 468 titik per bingkai ≈ `O(titik)`; 250 ms/bingkai di WASM perangkat; server hanya menerima **vektor metrik + digest bingkai**, bukan bingkai mentah | `proctoring_signals` + `proctoring_frames_digest` (`expires_at` baku 30 hari, **raw frame tidak pernah** di log) | **DESIGN-ONLY menyeluruh**: `opencv` terukur 0. Tanpa artefak WASM, layar yang tersedia = **daftar sinyal manual** pengawas. Tidak ada mode "akurasi tinggi" yang boleh ditulis sebelum ada hasil ukur nyata | (g) nol egress; (l) uji daftar terlarang (rasio wajah **bukan** prediktor integritas akademik); (j) sinyal tidak pernah mengubah `exam_session.status`; + gerbang (u)/(w) §13.7 |
| `fin-schedule` | **ALG-23 · Deterministic Financial Schedule Engine** | dua jadwal uang dengan satu evaluator: **penyusutan garis lurus** (`(cost − salvage) / useful_life_periods`, penyesuaian periode pertama/terakhir) dan **imbal hasil majemuk** per periode alokasi dana abadi (`value_{n+1} = value_n × (1 + r_bp/10000)`, `r_bp` dari parameter berversi). Seluruhnya `bigint` rupiah utuh dan `numeric`/basis-poin — **ADR-5** | `O(periode)` per aset/portofolio; 30 s / 20.000 aset per *run* | `depreciation_schedules`, `depreciation_postings` (draf), `yield_projections` | `NO_ACQUISITION_DATE`/`NO_SALVAGE`: **tolak menghitung** baris itu, jangan memakai asumsi; perubahan metode = perubahan laporan fiskal → wajib versi + empat-mata + jejak ALG-14 | (h) golden vector 20 tahun penuh; (i) paritas numerik (ini tempat selisih pembulatan paling mahal); (j) tidak dapat menulis `ledger` — posting hanya lewat service M-10 |
| `prob-scorer` | **ALG-24 · Seeded Probabilistic Scorer Family** (Naive Bayes proposal/lead + K-Means klaster geografis) | **satu harness, tiga model, nol float**. Naive Bayes *multinomial* atas fitur teks ter-*tokenize* (proposal M-44, lead M-45) dengan *smoothing* `α` sebagai parameter; K-Means **spasial** untuk klaster geografis (prospek M-45, pintu/acara M-43, domisili penerima bantuan M-11) dengan `k` dan `seed` tersimpan dan inisialisasi **k-means++ deterministik** atas urutan tetap | NB `O(n · f)`; K-Means `O(iter · n · k · d)` dengan `iter ≤ 50` dari `budget`; 60 s / 10.000 rekaman | `proposal_scores`, `lead_funnel_scores`, `geo_cluster_assignments` (semua `proposal_only = true`, semua menyimpan `model_version`, `seed`, `iterations`) | ambang mutu gagal (`log-loss`/silhouette di bawah parameter yang terdaftar) → **hanya aturan keras**, kata "prediksi" **dilarang** di layar (corak §12.5 "Gerbang mutu"); data spasial kurang akurasi → `NO_GEO_ACCURACY`, bukan klaster asal | (h) byte-identik dengan seed tersimpan; (l) daftar terlarang diuji statis — wilayah domisili **boleh**, agama/suku/kewarganegaraan/jenis kelamin/disabilitas **tidak**; (i) paritas; (j) tidak dapat menyentuh `students.status_akademik`, `invoices`, `mbkm_*` |

**Tiga larangan yang berlaku seragam untuk keenamnya.** (a) engine **tidak** menulis tabel domain — `proposal_only` diuji (gerbang (j)); (b) **tidak** ada satu pun ambang, tarif, atau `k` yang menjadi konstanta di kode (gerbang (q)); (c) **tidak** ada klaim kemampuan sebelum dependensinya nyata di `package.json` + *lockfile* dan tercatat di TECH_CONVENTIONS §6 — hari ini `ALG-22` melanggar itu lebih dulu bila disebut "jalan", dan karena itu seluruh barisnya bernada design-only.

#### 13.5.2 Mekanika sintis luring SuperApp (SQLite differential sync)

Seperti §12.10 dan §12.18, ini **mekanika**, bukan engine — dan `APP` bukan modul (PRD §5.12.2). Yang diikat: (1) **basis data lokal adalah cache, bukan otoritas** — `drift` menyimpan baris dengan `(row_id, version, server_updated_at, deleted_at)`; **tidak ada** tabel yang boleh dianggap tersinkron tanpa `version` yang dikonfirmasi server. (2) **Selisih dihitung server** atas `watermark` per `(tenant, objek)` — pola yang sama dengan §12.10 langkah 1–2; klien mengirim *watermark* + daftar *id* yang ia punya, bukan isi. (3) **Konflik selalu dimenangkan server** dengan `version` + `input_snapshot_hash` (PRD §5.12.2 butir d); baris konflik disimpan sebagai `conflict_copy` untuk ditinjau manusia, tidak pernah *merge* otomatis dua suntingan. (4) **Mutasi luring hanya boleh menjadi intents**: ia masuk antrean lokal, dikirim dengan `Idempotency-Key`, dan **hanya** sah setelah `queue_operations` mencatat terminal — sama seperti §10.6.1. (5) **Tidak ada angka akademik yang dihitung luring**: nilai, IPK, capaian CPL, BKD, tarif, dan vonis presensi tidak pernah dirender dari aritmetika Dart — Flutter membaca proyeksi (AGENTS §3.4, PRD §5.12.2 butir c). (6) **TOTP ikatan perangkat lokal** mengikuti bentuk §12.7.1: kunci `install_digest` = HMAC atas *install id* di Keychain/Keystore, server membandingkan digest, dan **tidak pernah** memakai Firebase Installation ID / Play Integrity (butuh API Google → dilarang ADR-14, sudah tercatat §12.7.3). (7) **Hapus-aman**: keluar tenant/pencabutan akun memanggil `PRAGMA secure_delete` + penghapusan baris terenkripsi lokal, dan salinan lokal **tidak pernah** memuat PII kelas khusus yang tidak boleh keluar dari layar yang sah (M-36, M-41). Yang menahan: tidak ada satu pun tabel sinkron luring yang terdaftar di DATA_MODEL hari ini — nomornya dimiliki `DATA_MODEL §22`.

---

### 13.6 Vonis & ralat terhadap permintaan pemilik

Tabel ini jujur ke dua arah: apa yang saya **tolak**, apa yang saya **terima dengan bentuk lain**, dan apa yang **design-only** dengan hasil ukur di belakangnya. Tidak satu pun barisnya menulis permintaan pemilik sebagai sesuatu yang sudah selesai.

| permintaan pemilik (sebagaimana ditulis) | vonis | bentuk yang diterima / penggantinya | dasar dan angka |
|---|---|---|---|
| **Redis Redlock (O(1))** sebagai jaminan kursi/kapasitas M-13 | **DITOLAK** | Target Redis Lua reservation + lease/fencing durable + idempotent BullMQ finalizer + DLQ + DB constraints (§10, §12.2.2) | O(1) command bukan ukuran latensi jaringan/kapasitas 10k–100k produksi. Cluster mensyaratkan hash-slot colocation; Sentinel bukan sharding. Failover memerlukan freeze/fencing/reconciliation dan budget, bukan anggapan lease hilang berarti aman. Belum terpasang (`RD-11`/`P-6`) |
| **Bitwise Permission Masking** (M-02/M-03) | **DITOLAK sebagai sumber kebenaran**; diterima sebagai **cache dalam proses** | hak dibaca dari `user_role_assignments` (scope + `valid_to`) lewat `requireDataPrincipal` + `holdsScoped`; bitmap hasil resolusi boleh hidup di proses dan dibuang kapan saja | Label peran bukan hak (§3.8); penugasan **ber-scope** dan **berwaktu** tidak termuat dalam satu bitmask; bitmask juga tidak dapat menyatakan `VALIDATE` yang menuntut MFA per aksi. Cache juga wajib tahu cara **dicabut** — dan itu justru salah satu dari empat titik kegagalan yang harus diuji ("izin ter-*cache* tetapi sudah dicabut") |
| **Local OpenCV Face Mesh WASM** sebagai kapabilitas *AI proctoring* | **DITOLAK sebagai vonis dan sebagai klaim**; diterima sebagai **ALG-22 design-only** yang mengusulkan **anomali**, bukan identitas | sinyal geometri + temporal → `proctoring_signals` → pengawas memutuskan; **tanpa** basis data biometrik, **tanpa** pengenalan 1:N, **tanpa** raw frame di log, `expires_at` 30 hari | Diukur pada `package.json` akar, `apps/web/package.json`, `packages/contracts`, `packages/database`, `packages/logger`, `apps/mobile/pubspec.yaml`: `opencv` **0** kemunculan, `onnx` **0**. §12.7.1 sudah menolak liveness/wajah karena layanan API berbayar **dan** isu biometrik UU PDP; §13 tidak membaliknya. "AI proctoring" yang berarti model berbayar/cloud: **ditolak** oleh ADR-14 — nondeterminisme pada ujian tidak dapat diaudit dan rekaman keluar = pelanggaran UU PDP |
| **Max-Flow Min-Cut Edmonds-Karp** (M-33) | nama **keluarga** diterima; **implementasi Edmonds-Karp ditolak** | **Dinic**; laporan wajib memuat `flow_total` + `cost_vs_lower_bound` + min-cut yang dapat dibaca manusia | `O(V·E²)` ditolak pada ukuran riil (V ≈ 120 sesi + 300 ruang-slot); Dinic worst `O(V²·E)`, praktis mendekati `O(E·√V)` pada jaringan kapasitas satuan (§11.7, ditegaskan ulang §12.13 baris 10). Yang mengikat adalah **batas kompleksitas + perilaku min-cut**, bukan merek algoritmanya |
| **ECTS conversion matrix sebagai enum** | **DITOLAK sebagai enum** | kelas **B**: kode/angka ditetapkan institusi atau negara mitra dan masuk `reference_dictionary_entries` **berversi**; tenant hanya memetakan label. Mesin konversinya tetap **ALG-16** | AGENTS §3.10: yang dapat berkembang tidak boleh menjadi `CHECK`/`z.enum`; register enum DATA_MODEL §15 hanya untuk kolom yang terdaftar. Membekukan ECTS sebagai enum = satu rilis kode untuk satu perubahan skema mitra |
| **AES-256-GCM zero-knowledge vault** (M-36) | primitif **diterima**; istilah **"zero-knowledge" DITOLAK** | enkripsi beramplop + **dua kunci berbeda** per tenant (DEK untuk AES-256-GCM, kunci HMAC untuk blind index), `wrapped_key` dari KMS/HSM, master key **tidak pernah** masuk DB; yang boleh diklaim: "rahasia tidak dapat dibaca oleh yang tidak memegang DEK aktif", bukan "kami tidak bisa membaca apa pun" | DATA_MODEL §16.3.4 sudah mengikat amplop `v(1) key_version(2) iv(12) ciphertext tag(16)` = `31 + n` byte dan melarang satu kunci untuk dua fungsi. **Kejujuran yang wajib ditulis:** server tetap dapat membuka plaintext untuk pemilik hak yang sah (itu **bukan** *zero-knowledge* dalam arti kriptografis). *Blocker* nyata: `TENANT_ENCRYPTION_MASTER_KEY` **belum ada** di `apps/web/src/config/env.ts` (dicatat ENV_CONTRACT §6.3) → gugus ini tidak boleh diklaim siap, dan hari ini hanya `mfa_factors.credential_encrypted` yang terenkripsi di kode |
| **Redis "Event Queue" / WebSocket untuk semuanya** | diterima dengan **bentuk berbeda** | SSE untuk satu arah; WebSocket **hanya** M-17 *incident feed* dan M-43 *gate check-in*; `queue_operations` (DB) sebagai *spine*; Redis pub/sub + BullMQ design-only — lihat §13.2 | Diukur: **0** berkas memuat `WebSocket`/`EventSource`/`text/event-stream` di seluruh sumber; `bullmq`/`ioredis` **0**. §10.6.3 sudah menetapkan SSE dan §10.5 menetapkan enam prasyarat sebelum jalur boleh dibalik |
| **AHP** sebagai *economic scorer* | **diterima dengan bentuk lain: sudah ada** | ALG-3 lapis AHP dipakai ulang untuk M-11 (kelayakan ekonomi), **bukan** mesin kedelapan belas | §11.5: *power iteration*, `CI/RI`, `CR > 0,10` → `422 AHP_INCONSISTENT_MATRIX`; kriteria kualitatif masuk lewat **kamus berperingkat**, tidak ada angka bebas per petugas |
| **Hungarian solver** | **diterima dengan bentuk lain: sudah ada dua alamat** | lapis penugasan bipartite ALG-11 (§12.6 butir 5) **dan** ALG-16 (§12.15 butir 4), `O(n³)` untuk `n ≤ 60`; dipakai ulang untuk tata duduk M-23 | Membuat "Hungarian ketiga" adalah temuan `RD-32`; §12.15 sudah menulisnya sebagai **perakitan**, bukan mesin baru |
| **3D bin packing** asrama | **diterima dengan bentuk lain: ALG-2** | FFD multi-dimensi atas vektor `(peserta, unit, lisensi, bahan)` + perbaikan B&B terpangkas `budget` | FFD multi-dimensi **tidak punya jaminan rasio konstan**; deviasi terhadap batas bawah `maks_d Σreq_d / Σcap_d` **wajib** ikut dilaporkan (§11.4, §11.1 "Kejujuran angka") |
| **DFA clearance** | **diterima dengan bentuk lain** | sisi aturan = **ALG-4** RETE (vonis §12.13 baris 6, tidak dibuka ulang); sisi normalisasi/transisi = **ALG-6** + state machine service dengan register enum DATA_MODEL §15 | Engine automata kedua akan punya **dua** hukum kelulusan — pola yang sama yang membuat `grade_audit_logs` dan `pddikti_validation_runs` ditolak (§12.2.5) |
| **Tesseract OCR + Levenshtein** | diterima sebagai **ALG-7 + ALG-11**, berstatus DESIGN-ONLY untuk biner OCR | AcroForm/layer teks **lebih dulu**; OCR hanya untuk citra, di kontainer sendiri; tulisan tangan **tidak didukung** | `tesseract` terukur **0** di keenam manifest; §11.9 dan §12.12 sudah menetapkan itu. Yang **tidak** ada di daftar dan **tidak** diklaim: PaddleOCR, PDF.js |
| **Consistent Hashing** | diterima sebagai **infrastruktur**, bukan engine | penempatan kunci Redis per-tenant (§10.3.1) dan *sharding* cluster (§9.1); tidak ada `*_results`-nya | Menjadikannya engine akan menciptakan "mesin" tanpa keluaran draf dan tanpa aksi `VALIDATE` — melanggar §11.2 |
| **MARC21 BM25**, **OAI-PMH XML serializer**, **TF-IDF vector search**, **K-Means**, **Naive Bayes**, **PPh21**, **straight-line depreciation**, **compound yield**, **Winnowing/Jaccard**, **face-mesh WASM** | **diterima** | `ALG-19`…`ALG-24` (§13.5.1) + mekanika `APP` (§13.5.2), dengan harness §11.2 penuh | Keenamnya **belum** punya titik aksi, path, atau nomor migrasi; yang ada di bab ini baru spesifikasi. PRD §5.12.1 mencatat **16** modul `NOL`, dan M-06/M-39/M-40/M-44/M-45/M-47 ada di antaranya |
| **Kampus luring / daring / hibrida** | diterima, **dengan kosakata yang sudah diputus** | `learning_modality ∈ {ONSITE, ONLINE, BLENDED}` (DATA_MODEL §21.4, kelas A′) + `session_kind` per pertemuan; vonis kehadiran oleh **§12.18 Dual-Reconciliation** | Tiga ejaan hasil pengukuran **dilepas**: `offline` → `ONSITE`, `hybrid` → `BLENDED`, `delivery_mode` → `learning_modality`; §8.2 "watch-time ≥ 80 %" digantikan ambang bertipe parameter (`attendance.online_min_join_ratio`, baku 0,75) |
| **47 modul + SuperApp sebagai 47 enum** | **Ditolak (sudah divonis PRD §5.12.3, tidak dibuka di sini)** | `M-xx` adalah baris `menu_items` yang menunjuk kode entitlement; SuperApp = **permukaan**, bukan SKU | 19 entitlement nyata (`packages/contracts/src/entitlement.ts`) + 18 usulan terregistri; 48 baris modul |

**Satu ralat yang saya buat terhadap dokumen sendiri.** Bab 12 masih berjudul "ALG-8…ALG-14" dan §12.13 menutup daftar dengan "16 permintaan, tidak ada yang hilang" (§12.13 kalimat penutup). Setelah bab ini, yang benar adalah: **18 engine** (`ALG-1`…`ALG-24` dengan `ALG-19`…`ALG-24` lahir di §13.5.1) dan **daftar permintaan pemilik yang lebih luas** (§13.5, 48 baris). Angka "16" di §12.13 adalah **jumlah permintaan gelombang-2**, bukan jumlah seluruh kapabilitas, dan tidak berubah. Rujukan lintas-dokumen yang masih menulis "ALG-1…ALG-14" (AGENTS §2.1 dan §3.9, `INDEX.md`) perlu disamakan **oleh pemiliknya masing-masing** — dititipkan di sini, tidak dikerjakan di berkas yang bukan miliknya, persis seperti pola titipan §12.13 dan §12.12.

---

### 13.7 Gerbang CI tambahan

Daftar §12.12 sudah memakai **(g)(h)(i)(j)(k)(l)** dan **(q)(r)**; huruf **(m)–(p)** adalah gerbang mesin data master (AGENTS §3.10) dan **tidak** dipakai ulang di sini. Yang berikut melanjutkan abjad dan **hanya** memuat hal yang dapat diuji mekanis — tidak ada satu pun yang berbunyi "pastikan arsitekturnya benar".

- **(s) Satu nama, satu penerbit.** Setiap `event_type` di §13.1 **wajib** punya tepat satu modul penerbit dan satu skema Zod di `packages/contracts` yang ikut ter-*compile* ke OpenAPI. Uji: *scan* atas pemanggilan tulis `outbox` → `event_type` yang tidak terdaftar di kontrak, atau terdaftar dengan **dua** penerbit = *build* merah. Ini gerbang yang membuat katalog §13.1 menjadi kontrak, bukan tabel dokumentasi.
- **(t) Nol rute tulis di luar pemilik objek.** Untuk tiap vonis PRD §5.13, *prefix* objek hanya boleh di-*mutate* dari modul pemilik; konsumen memakai `POST /{objek}/{id}/signal-*`. Uji: *grep* pola `route.ts` per *prefix* dengan pemetaan owner dari registri; satu rute tulis kedua (mis. `app/api/v1/library/clearance/status`) = merah. Termasuk di dalamnya uji penolakan: usulan dari non-pemilik harus menghasilkan `403`, bukan `201` (§5.13.2 butir 5).
- **(u) Kesesuaian klaim dependensi.** *Build* menolak berkas di `modules/**/engine/**` dan di *worker* yang mengimpor nama dari daftar *design-only* (`bullmq`, `ioredis`, `or-tools`, ONNX, `opencv`, `tesseract`) sementara nama itu **tidak** ada di `package.json` + *lockfile* commit. Uji ini **dua arah**: import tanpa dependensi = merah (klaim palsu), dan dependensi yang sudah masuk tetapi **tidak** tercatat di TECH_CONVENTIONS §6 = juga merah (dua sumber kebenaran).
- **(v) Nol PII di amplop peristiwa.** Kunci `payload` setiap baris `outbox` di-*match* terhadap register kolom terenkripsi/blind-index DATA_MODEL §16.3 dan kelas retensi §16.5; kemunculan `nik`, `nim` penuh, `mother_name`, isi rekam medis, atau **isi kasus PPKS** di payload = merah. Perluasan mekanis dari larangan yang sudah ada atas `GRADE_PUBLISH` dan `canonical_payload`, dan satu-satunya penjaga agar baris `ppks.case.registered` tetap berpayload kosong.
- **(w) Biometrik dan proctoring tidak memvonis.** Uji statis bahwa (1) tidak ada tabel yang menyimpan **bingkai mentah atau *template* wajah** — hanya `digest` + vektor metrik, (2) setiap baris `proctoring_*` punya `expires_at`, (3) tidak ada jalur tulis dari `proctoring_signals` ke `exam_session.status`/`grades`/`attendances`, dan (4) ambang sinyal dibaca dari parameter, bukan dari kode (gerbang (q)). Uji (3) adalah uji **penolakan** (`proposal_only`), bukan *smoke test*.
- **(x) Stream tidak pernah menjadi otoritas.** Dua tes: (1) *fixture* dua klien yang saling bertabrakan pada satu baris luring (SuperApp §13.5.2) **wajib** diselesaikan server-wins menurut `version` + `input_snapshot_hash`, tanpa *merge* otomatis; (2) hilangkan koneksi SSE di tengah *run* KRS — hasil akhirnya **wajib** sama dengan klien yang hanya mempolling `statusUrl`. Bila keduanya hijau, klaim §13.2 butir (3) "tidak ada state yang berubah hanya karena peristiwa UI" benar-benar ditegakkan, bukan diikrarkan.

Empat gerbang terakhir (§13.5.1 kolom gerbang) tetap mengikat per engine: **(g)** *egress scan* menolak `fetch(` / `axios` / `https.request` — yang paling penting untuk ALG-20 dan ALG-24, karena keduanya adalah pintu paling menggoda menuju layanan embedding/prediksi berbayar; **(h)** *golden vector* byte-identik (ALG-19 setahun penuh, ALG-20 kueri→peringkat, ALG-21 teks→`similarity_bp`, ALG-23 dua puluh tahun, ALG-24 dengan `seed` tersimpan); **(i)** paritas numerik TS ↔ Dart — tempat selisih pembulatan paling mahal adalah ALG-19 dan ALG-23; **(j)** uji penolakan tulis ke tabel domain; **(l)** daftar terlarang sebagai fitur (berlaku penuh untuk ALG-24: wilayah domisili boleh, agama/suku/kewarganegaraan/jenis kelamin/disabilitas tidak).

**Sisa utang yang membuat bab ini belum menjadi kemampuan.** Seluruh baris §13.5.1 menunggu lima hal berurutan yang tidak boleh dibalik (AGENTS §3.11): norma FR/BR/AC di PRD, DDL + nomor di `DATA_MODEL §22` yang **belum ada**, kode izin di RBAC_MATRIX §4.5 (terukur **161** baris dan **nol** di antaranya untuk `ALG-19`…`ALG-24`), path + kode error di API_SPEC §2.3 (terukur **118** baris; kode baru mulai **baris 119**), pola layar di UI_UX_DESIGN — **baru** kode. Sampai kelima itu selesai, tidak satu pun kalimat di bab 13 boleh dikutip sebagai "sudah berjalan".

### 13.8 Jalur peta sebaran sesi dan "aktif sekarang" (target)

**Vonis 8 — lokasi kasar, bukan pelacakan presisi pengguna.** GeoIP lokal berlisensi menyelesaikan IP mentah **transient dari proxy tepercaya sebelum hashing**; `ip_hash` tidak bisa dipakai untuk lookup GeoIP. Persist hanya hash dan lokasi kasar/bucket/source/dataset version sesuai DATA_MODEL/retensi; jangan log raw IP. W3C Geolocation presisi untuk kebutuhan geofence ber-consent/accuracy adalah tujuan berbeda, bukan alasan memperkaya peta sesi dengan titik individu.

**Sesi saat ini:** `auth.service.ts:171–214` mempersist `sessions` serta **hash** `refresh_tokens` dalam PostgreSQL; rotasi/logout juga di DB. Target app stateless memakai shared Redis cache/revocation index atau ZSET aktivitas tidak memindahkan sumber kebenaran sesi, refresh atau audit ke Redis. Indeks “aktif sekarang” mengikuti parameter `analytics.session.active_window_s`, dapat dibangun ulang dari fakta yang berwenang; bila data stale/tidak tersedia tampil degraded dengan waktu terakhir, bukan nol palsu. Jalur Redis/GeoIP ini design-only.

**Vonis 9 — SSE/polling sebagai sinyal.** Kanal satu arah mengikuti budget/reconnect/resync §10.6.3; event tidak menjadi bukti kehadiran atau perubahan sesi. Event/izin tetap didaftarkan pada katalog pemilik, tidak diciptakan oleh widget. Graceful drain pada rollout harus diuji, termasuk reconnect lintas instance dan fallback polling durable.

**Privasi:** proyeksi tenant-scoped melalui view security_invoker dan RLS, akses scoped, retensi minimal sesuai tujuan, tanpa user_id/raw IP. Bucket kecil (termasuk distinct_users=1) harus disuppression/coarsening sesuai kebijakan privasi yang disetujui; menyebut satu orang “agregat” tidak menghilangkan identifiabilitas. Dataset lokal bukan layanan tracking eksternal.

**Gate:** migrasi/izin/proyeksi/secret reference tervalidasi, dependency dan dataset nyata, parameter analytics.map.enabled false/degraded teruji, serta acceptance privacy/recovery di DEPLOYMENT_DEVOPS §6. Menulis desain tidak membuktikan gerbang sudah lulus.

### 13.9 Perluasan Phase 1 — peta bukti dan batas rilis

Crosswalk fase mengikuti **ROADMAP_TASKS §2.18**: Phase 1A = **R-1 Admin Aplikasi**, Phase 1B = **R-2 Admin IT Kampus**; bukan penomoran modul/fase baru dan bukan janji seluruh bisnis selesai Phase 1. Registry nama/ID tetap PRD §5.12.1; FR/AC, RBAC dan API hanya dirujuk pada pemilik, tidak disalin sebagai katalog baru.

- **R-1:** provisioning tenant, paket/lisensi platform, audit/impersonation/MFA, fondasi harness serta operasi terkontrol. Perluasan mencakup telemetry CPU/RAM/DB/Redis tersamarkan, dashboard job read-only, retry berizin dan bounded, cache invalidation namespace tenant, backup/export + isolated logical restore ber-approval. Tidak ada shell/SQL console atau arbitrary cluster restore (`DEPLOYMENT_DEVOPS §6`).
- **R-2:** user management dan scoped grants/SoD, kisi izin sub-detail, parameter berversi + CRUD/history/approval, master organization, dynamic menu routing. Menu bukan kontrol akses. Migrasi 0047–0050 ada di filesystem, tetapi itu tidak membuktikan seluruh UI/hot-reload/rute menu atau rollout sudah lengkap.
- **Release:** hanya platform memberi entitlement; tenant opt-out mengurangi hak. Release flag tidak sama dengan pembelian. Add-on dapat diaktifkan tanpa redeploy **hanya setelah** handler/migrasi/worker/kontrak terpasang; kode baru tetap deploy. ZDD target blue-green/rolling, readiness, drain worker/SSE, kompatibilitas N/N-1 dan expand-contract; zero table locks tidak dijanjikan.

| Modul (nama registry PRD) | Engine/mekanika yang sudah memiliki alamat desain | Bukti yang dituntut sebelum dibuka |
|---|---|---|
| **M-12 Kurikulum OBE** | ALG-1 DAG/topological sort §11.3 + ALG-13 OBE rollup §12.8 | Snapshot graf/bobot, deteksi siklus, golden vector CPL, approval sebelum apply |
| **M-14 Jadwal & Ruang** | ALG-8 CSP + AC-3 §12.3 | Fixture kendala, seed/tie-break deterministik, budget node/waktu, infeasible/partial jelas, approval jadwal |
| **M-13 KRS Online & Perwalian** | Lua reservations + lease/fencing + BullMQ finalizer/DLQ §10; **bukan Redlock O(1)** | Saat ini sync advisory-lock RD-11/P-6; target menunggu 0030/paket, receipt-before-202, zero oversell/replay/failover test |
| **M-15 Moda Perkuliahan / M-18 Presensi Smart** | Modality §12.18; ALG-12 QR/HMAC + geofence §12.7 | M-15 menentukan moda, M-18 vonis tunggal. Uji replay scoped mahasiswa, expiry, akurasi lokasi dan review; tidak menjamin anti-kecurangan mutlak |
| **M-16 LMS Digital → M-18** | Bukti Teams/LMS §8.2/§12.18 dan PRD §5.15 | Join kumulatif default target ≥75% **configurable**, bukan ambang hukum universal; vendor transport berkredensial, evidence incomplete → degraded/review |
| **M-19 Nilai & KHS** | ALG-6 AST evaluator §11.8 | Allowlist AST tanpa eval/new Function, bobot/version, parity numerik, approval/lock. Label ALG-11 pada registry PRD adalah drift rujukan, bukan engine AST baru |
| **M-10 Keuangan & Billing** | ALG-4 billing rules §11.6; Multi-VA reconciliation §12.19 langkah 8 | Signature/idempotensi callback, integer rupiah, satu ledger, mismatch → suspense/review; bukan autopost fuzzy |
| **M-09 PMB & OCR** | ALG-7 ekstraksi §11.9 + ALG-18 NIM §12.17 | OCR lokal Tesseract belum terpasang; hasil draft + human confirm, sequence/pola NIM snapshot, uji konkurensi; tanpa tulisan tangan yang dijanjikan |
| **M-34 Feeder PDDikti** | ALG-11 fuzzy §12.6 + delta sync §12.10 | Skor + margin + human approval; tidak menebak feeder_id, staging/snapshot dan rekonsiliasi sebelum kirim |

Semua engine **lokal tanpa API key/egress**; provider Teams/VA/Feeder adalah adapter terotorisasi dengan credential hanya ENV/secret-manager reference. Harness menyimpan seed, input/parameter/model/engine version, snapshot hash, idempotency dan budget; hasil proposal tidak langsung menulis domain. Mata uang integer rupiah/basis poin atau numeric sesuai model, bukan float. Algoritma deterministik tetap perlu golden fixtures dan stable ordering; ML/anomaly lokal (ALG-25) hanya skor eksploratif, tidak jaminan classifier malicious atau auto-block tanpa kebijakan/approval.

**Acceptance dan gap terbuka:** smoke staging dua tenant, mixed-version/worker/SSE drain, failure injection Redis/DB/worker, rehearsal rollback/tenant restore, p95/error/oversell dan waktu recovery terukur berada di DEPLOYMENT_DEVOPS §6.3. Pilihan provider, Sentinel vs Cluster, issuance epoch durable, budget recovery dan pemisahan SLO acknowledgment/finalization belum selesai. Tidak ada benchmark produksi, deployment, migrasi atau engine baru yang diklaim oleh sinkronisasi dokumen ini.
