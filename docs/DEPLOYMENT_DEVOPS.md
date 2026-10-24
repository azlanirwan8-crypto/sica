# SICA DevOps, Deployment & CI/CD Pipeline

**Status:** Standar target; bukan sertifikasi kesiapan produksi atau bukti zero downtime.

**Environments:** Development, Staging, Production

**Dokumen kanonik:** `DEPLOYMENT_DEVOPS.md` untuk deployment/staging; `ARCHITECTURE.md` untuk desain. Jangan membuat `DEPLOYMENT_STAGING_GUIDE.md` atau `ARCHITECTURE_OVERVIEW.md` sebagai sumber paralel.

## 1. Kontrak konfigurasi dan secret

### 1.1 Web Application & API
Inventaris nama, validasi aktual, dan proposal ENV berada di [ENV_CONTRACT.md](file:///C:/SICA/docs/ENV_CONTRACT.md), dengan parser nyata `apps/web/src/config/env.ts`. Tidak ada salinan `.env` atau contoh password, token, private key, maupun DSN berkredensial di runbook ini. Secret hanya melalui injeksi ENV server-side dari secret manager; konfigurasi tersimpan memakai referensi secret/version, bukan nilainya. Jangan mencetak ENV dalam log, manifest, dashboard, atau artefak CI.

`DATABASE_URL` memakai role runtime `NOBYPASSRLS`, bukan owner/superuser; `DIRECT_DATABASE_URL` memakai kredensial migrator terpisah pada koneksi direct/session yang disetujui. Kompatibilitas IPv4/IPv6, TLS, pooling, region, serta provider harus diuji pada lingkungan tujuan, bukan diasumsikan dari nomor port.

### 1.2 Mobile Client
Hanya konfigurasi publik yang boleh diinjeksi saat build Flutter. Secret backend dan kredensial provider tidak boleh masuk `--dart-define`, bundle, atau penyimpanan aplikasi. API/job versi lama tetap didukung selama jendela kompatibilitas klien yang disetujui; mobile tidak ikut berganti versi serentak dengan server.

### 1.3 Database, worker, dan sesi
`REDIS_URL` ada di parser, tetapi `bullmq`/`ioredis` belum ada di manifest/lockfile; konfigurasi bukan bukti konsumen berjalan. KRS saat ini sinkron dengan advisory lock (`RD-11`/`P-6`). Sesi durable `sessions`, hash `refresh_tokens`, dan audit tetap PostgreSQL. Target aplikasi stateless berarti tidak bergantung pada memori instance; Redis bersama hanya cache/revocation index atau indeks aktivitas yang dapat direkonsiliasi, bukan pemindahan sumber kebenaran autentikasi ke Redis.

## 2. Strategi Zero-Downtime Database Migration

**ZDD adalah target ketersediaan layanan yang harus dibuktikan, bukan zero table locks.** DDL PostgreSQL tetap dapat mengambil lock metadata/tabel, bahkan ketika tidak menulis ulang tabel. Tidak semua perubahan dapat dilakukan online. Jika rehearsal tidak memenuhi anggaran lock/latensi, tunda perubahan atau gunakan maintenance window yang diumumkan; jangan menjanjikan zero downtime.

### 2.1 Siklus 3 Fase Expand-and-Contract
1. **Expand:** tambahkan struktur kompatibel dengan aplikasi/worker N dan N-1; petakan versi skema, API, event, dan payload job yang keduanya bisa baca. Pilih satu pemilik dual-write (service atau trigger), bukan keduanya tanpa aturan konflik.
2. **Deploy & backfill:** jalankan blue-green atau rolling dengan kedua versi, backfill bertahap ber-checkpoint, idempoten, terukur WAL/replica lag/lock. Verifikasi hasil dan konsistensi dual-write sebelum beralih baca. Tidak boleh ada I/O provider di dalam transaksi DB.
3. **Contract:** hanya setelah backfill tervalidasi, tidak ada app/worker/job lama, jendela rollback berakhir, dan persetujuan DBA tercatat. **Tidak ada deployment aplikasi bersamaan dengan destructive DDL.** Penghapusan kolom/tabel dipisah sebagai perubahan tersendiri; rollback aplikasi tidak otomatis membalik DDL.

### 2.2 Aturan Baku DDL PostgreSQL SICA
- **Dilarang menjalankan explicit exclusive `LOCK TABLE` di runtime.** Lock implisit DDL tetap boleh dalam migrasi terkendali dengan budget bounded sesuai `MIGRATION_SOP §2.3`; analisis durasi transaksi dan blocker melalui rehearsal, jangan menyebut migrasi bebas lock.
- Untuk indeks tabel panas, rencanakan `CREATE INDEX CONCURRENTLY` **di luar transaction block**. Ia tetap memakai lock, menambah I/O/WAL, dan bisa meninggalkan indeks invalid saat gagal; verifikasi definisi/validitas sebelum retry. Indeks tabel baru kosong boleh dibuat transaksional setelah review.
- Anggaran awal review: `lock_timeout = '3000ms'`, `statement_timeout = '15000ms'`; bukan angka hasil benchmark. Indeks besar/backfill boleh mendapat anggaran lebih panjang yang tetap terbatas, disetujui, dan diukur; jangan `0`/unlimited atau retry tanpa batas.
- RLS `ENABLE` + `FORCE`, policy `USING`/`WITH CHECK`, serta privilege role runtime wajib diuji dua tenant. Katalog global hanya mengikuti pengecualian resmi `DATA_MODEL`.
- **Gap runner nyata:** `packages/database/src/migrate.ts` membungkus seluruh berkas SQL dalam `sql.begin`, menetapkan `SET LOCAL lock_timeout = '5s'`, belum menetapkan `statement_timeout` terpusat, mencatat nama tanpa checksum, dan belum menserialisasi beberapa migrator. Ia memakai `DIRECT_DATABASE_URL ?? DATABASE_URL`. Jadi jalur concurrent-index, batas waktu efektif, serialisasi, dan ledger/checksum perlu implementasi serta persetujuan terpisah sebelum klaim ZDD. Jangan memasukkan `CONCURRENTLY` ke runner ini atau menjalankan SQL ad-hoc sebagai jalan pintas. SOP rinci: [MIGRATION_SOP.md](file:///C:/SICA/docs/MIGRATION_SOP.md).

## 3. Pipeline Otomasi CI/CD (GitHub Actions)

**Bukti checkout, bukan hasil eksekusi:** `.github/workflows/main-pipeline.yml` mendefinisikan lint/typecheck Node 22, Semgrep, `gate-run`, Vitest dengan coverage, Flutter test, deployment web Vercel pada push `main`, serta APK Firebase pada `staging`. Definisi job bukan bukti semua job lulus. Paket coverage belum tercantum pada manifest web; workflow ini belum menunjukkan provisioning staging web, rehearsal migrasi, worker rollout/drain, atau traffic switching blue-green. YAML ilustratif lama di dokumen ini bukan konfigurasi aktif dan telah diganti dengan kontrak berikut.

Urutan target wajib sebelum promosi:
1. Build sekali; simpan digest artefak, commit, dependency lock, versi konfigurasi/secret reference, dan kompatibilitas skema/API/job. Artefak yang sama dipromosikan staging → produksi.
2. Lint/typecheck, unit/integrasi, isolasi RLS/izin/entitlement, pemeriksaan secret dan dependensi, kontrak lama-baru, serta replay idempotensi.
3. Rehearsal expand/backfill pada data staging sintetis atau tersamarkan yang representatif; catat lock, timeout, query plan, kapasitas pool, lag, dan anggaran biaya.
4. Deploy staging; smoke/failure/rollback §6.3 harus menghasilkan bukti terukur. Persetujuan pemilik layanan/DBA menjadi gerbang, bukan sekadar job bernama “80% coverage”.
5. Jalankan prosedur §4.4. Contract adalah perubahan terpisah sesudah jendela rollback, tidak ditumpuk ke job deployment aplikasi.

## 4. High-Availability & Auto-Scaling (Target 1.000+ Concurrent Users)

**Keputusan infrastruktur belum final:** ADR-10 memuat kandidat ECS Fargate/RDS; workflow checkout memakai Vercel untuk web. `apps/api` NestJS dan `apps/worker` BullMQ di diagram adalah target, bukan proses yang sudah ada. Provider, region, model worker long-running, dukungan SSE, dan biaya harus diputuskan bersama sebelum rollout. Kubernetes HPA bukan konfigurasi ECS, dan kontrol Vercel tidak identik dengan Cloud Run.

### 4.1 Auto-Scaling Horizontal
- App stateless, tanpa sticky-session wajib; data durable tetap DB. Tetapkan min/max instance, CPU/RAM, headroom pool, serta batas biaya dari pengukuran, bukan konversi otomatis concurrent users ke RPS.
- Worker dituning terhadap umur antrean, arrival/drain rate, retry/DLQ, dan kapasitas commit Primary. Batasi concurrency global dan per-tenant agar satu tenant tidak menghabiskan pool.
- Pisahkan cache disposable dari reservasi/BullMQ yang membutuhkan kebijakan `noeviction`, persistensi, batas memori, dan prosedur recovery; TTL/AOF tidak membuat keduanya transaksional dengan DB.
- Waktu drain harus mencakup request/job budget dan pembaruan lease yang sah. Nilai 30 detik bukan jaminan cukup untuk semua job; bila batas habis, tandai in-flight sebagai belum pasti dan pulihkan lewat fencing/idempotensi, bukan refund buta.

### 4.2 Health Check Endpoint
`GET /api/v1/health` adalah liveness murah; `GET /api/v1/health/ready` adalah readiness. **Saat ini** readiness menjalankan `SELECT 1` DB; Redis dan storage hanya cek keberadaan konfigurasi, bersifat degradable. Belum ada bukti probe BullMQ, kesiapan skema/job, atau write-capability Primary. Status 200 hari ini bukan bukti stack asinkron siap.

**Target:** probe bounded terhadap dependensi yang dibutuhkan kapabilitas aktif, kompatibilitas versi skema/API/job, dan status drain. Contoh anggaran awal: timeout 2 s, interval 5 s, tiga kegagalan sebelum keluar rotasi; ukur dampaknya. Redis/queue wajib untuk admission KRS asinkron: kegagalannya menutup admission, meskipun halaman read-only tetap tersedia. Dependensi opsional boleh menghasilkan degraded; jangan memutus seluruh web karena replica laporan lambat. Respons publik hanya status/version non-sensitif; diagnostik terperinci hanya operator berizin dan tersamarkan.

### 4.3 Failover dan rekonsiliasi
- **PostgreSQL:** mekanisme HA mengikuti provider terpilih. Promosi Primary, routing koneksi, RPO/RTO dan pemulihan transaksi commit-unknown harus diuji. Angka 30 s bukan jaminan failover. Mutasi dan read-your-writes hanya Primary.
- **Redis:** pilih **Sentinel** (HA primary-replica, tidak membagi data) **atau Redis Cluster** (hash-slot sharding + failover per shard). Keduanya bukan mode otomatis yang berjalan sekaligus. Semua key satu Lua harus colocated; domain tenant/periode §10 ARCHITECTURE dapat menjadi hot slot. Keputusan masih gerbang `P-6`.
- Failover Redis dapat kehilangan write yang telah diakui. Freeze admission, fence worker lama dengan epoch durable, lalu rekonsiliasi lease aktif, enrollment, operasi durable/outbox, dan job in-flight dari Primary sebelum buka kembali. TTL habis tidak mengembalikan counter dengan sendirinya. Jangan re-seed counter DB sambil lease lama masih bisa commit.
- Retry bounded + backoff/jitter + circuit breaker; accepted operation tidak boleh hilang, semua harus terminal atau tercatat untuk recovery/DLQ. Manual intervention harus punya batas waktu, pemilik, alasan, dan audit.
- PITR cluster hanya prosedur bencana platform berotorisasi, bukan fitur restore satu tenant. Tenant restore mengikuti §6.2.

### 4.4 Zero-Downtime Deployment Pipeline
1. Catat baseline, backup/restore evidence dan release manifest. Pastikan expand sudah selesai serta tidak ada destructive DDL aktif; hentikan promosi bila kompatibilitas belum terbukti.
2. Jalankan green di samping blue, atau rolling dengan kapasitas surge. `maxUnavailable: 0` hanya kebijakan scheduler, **bukan bukti zero service downtime**. Periksa readiness dan headroom nyata sebelum mengirim trafik.
3. Alihkan trafik bertahap (contoh target 5% → 25% → 50% → 100%) dengan observation window yang disepakati. Ukur latency/error, business invariants, saturasi, antrean, dan reconnect SSE pada setiap langkah.
4. **Graceful drain:** keluarkan old instance dari readiness/LB; hentikan request/job baru, selesaikan transaksi in-flight bounded. Worker berhenti mengambil job, tetap menjaga lease yang sah hingga selesai atau recovery. SSE ditutup secara terkontrol; klien reconnect ke instance baru dan mengambil status durable/polling bila event terlewat. Jangan mengandalkan Redis Pub/Sub sebagai riwayat event.
5. Jika acceptance gagal, stop promosi, kembalikan trafik ke artefak lama yang masih kompatibel, hentikan konsumsi job versi tak kompatibel, rekonsiliasi pekerjaan in-flight, dan verifikasi smoke ulang. Jangan DROP struktur expand atau restore seluruh DB otomatis.
6. Tutup rollout setelah bukti stabil dan semua op terhitung. Contract menunggu persetujuan serta jendela rollback habis.

**Deploy ≠ release ≠ lisensi.** Release flag adalah kendali rollout platform, entitlement adalah hak paket/add-on yang **hanya platform** dapat memberi, tenant opt-out hanya mengurangi hak efektif. Akses efektif juga memerlukan dependency dan izin scoped. Mengaktifkan add-on tanpa redeploy hanya sah jika handler, migrasi, worker, kontrak, dan dependensinya **sudah terpasang serta kompatibel**. Kode/migrasi baru tetap harus deployment. Flag tidak memasang BullMQ dan tidak mengizinkan dua writer KRS sync/async bersamaan.

## 5. Kanal vicon di produksi: egress, webhook, dan rotasi

Bagian ini **target integrasi**, bukan bukti kanal telah berjalan. Kontrak path/galat tetap di `API_SPEC`, provider dan muatan di `INTEGRATIONS`; jangan membuat katalog kedua di sini.

1. Webhook diverifikasi sebelum diterima secara durable; deduplikasi scoped tenant/provider/event, audit digest, lalu pekerjaan berat ke worker. Retry vendor tidak boleh menambah kehadiran atau pembayaran dua kali.
2. Egress hanya allowlist provider aktif. Mesin algoritma tetap lokal tanpa API key/egress; Teams/Zoom/Meet/BBB/Jitsi merupakan **transport berkredensial**, bukan pengecualian untuk memanggil model eksternal. Kanal gagal menghasilkan degraded/fail-closed; fallback sesuai kebijakan yang disetujui untuk sesi berikutnya, tidak memindahkan sesi berjalan diam-diam.
3. Rotasi memakai secret reference/version dan probe. Jangan cabut secret lama sebelum jalur pengganti tervalidasi; audit hanya metadata rotasi.
4. M-16 memasok bukti Teams/LMS ke M-18, pemilik vonis presensi. Target default join kumulatif ≥75% dibaca dari parameter berversi, bukan ambang hukum universal. Data vendor tunggal yang tidak lengkap tetap membutuhkan rekonsiliasi/review sesuai PRD §5.15.
5. Target 1.000+ peserta memerlukan uji laju join/leave, batching, deduplikasi dan lag; bukan klaim kapasitas yang sudah dicapai. Dasbor menampilkan kanal gagal, degraded, antrean menua, dan digest penolakan berulang tanpa payload pribadi.

## 6. Perluasan Phase 1: operasi aman dan acceptance staging

### 6.1 Kendali platform dan observabilitas
Phase 1A/R-1 dan Phase 1B/R-2 mengikuti crosswalk `ROADMAP_TASKS §2.18`, bukan janji seluruh engine bisnis selesai di Phase 1. Peta pemilik dan bukti engine: `ARCHITECTURE §13.9`; FR/RBAC/API tetap pada dokumen pemiliknya.

- Portal operator menampilkan CPU/RAM, pool/latensi/lock/lag DB, memori/eviction/latensi Redis, umur antrean dan DLQ dengan akses scoped dan data tersamarkan. Tidak boleh ada credential, raw payload, SQL console, terminal/shell, atau label metrik berisi PII.
- Dashboard BullMQ **read-only secara default**. Retry/cancel hanya aksi server allowlist setelah RBAC scoped, MFA/SoD sesuai kelas risiko, alasan dan audit; periksa epoch, status terminal, idempotensi, entitlement dan budget retry. Tidak ada tombol “retry all” tanpa dry-run dan batas tenant/batch.
- Clear cache hanya namespace tenant + jenis cache + versi yang diotorisasi; gunakan invalidasi terarah/batched. **Dilarang `FLUSHALL` maupun `FLUSHDB`**, wildcard lintas tenant, serta menghapus key sesi/lease/BullMQ seolah cache biasa. Redis Cluster slot bersama tidak memberi hak menghapus seluruh slot.
- GeoIP lokal hanya lokasi kasar/agregat, bukan pelacakan posisi tepat pengguna. Resolve IP transient dari proxy tepercaya sebelum hash; jangan log IP mentah. Terapkan retensi, pembatasan akses, dan suppression bucket kecil. Tidak adanya data harus tampil degraded, bukan lokasi/angka dummy.
- Isolation Forest/LOF lokal hanya eksplorasi skor anomali, bukan classifier “pengguna jahat”. Simpan seed/snapshot/model/parameter version, ukur false positive dan review manusia. Tidak boleh auto-block dari skor saja tanpa kebijakan eksplisit, approval, audit dan jalur banding.

### 6.2 Backup/export dan logical restore per tenant
1. Verifikasi izin tenant dari sesi, scope objek, MFA/approval sesuai risiko, tujuan, retensi, serta tiket perubahan. Hak operator platform bukan izin bebas mengambil data semua tenant.
2. Buat export/logical snapshot konsisten scoped tenant termasuk dependency dan referensi global yang diperlukan. Manifest tersamarkan memuat tenant pseudonym, schema/version, waktu snapshot, jumlah baris, checksum dan secret reference untuk enkripsi; tidak memuat secret/PII. Simpan terenkripsi dengan akses dan masa berlaku terbatas.
3. Restore **lebih dulu ke staging terisolasi**; matikan seluruh egress webhook, pembayaran, email dan Feeder. Verifikasi checksum, tenant boundary, FK/unique constraint, totals integer, serta kompatibilitas skema.
4. Rekonsiliasi rantai audit/chain head dan outbox/idempotensi/job. Jangan menulis ulang audit lama atau mengirim ulang side effect historis; simpan provenance import dan approval, serta daftar event yang ditahan/direkonsiliasi.
5. Setelah dry-run, diff dan persetujuan pemilik tenant/DBA, lakukan logical import terkontrol dengan freeze mutasi scoped bila diperlukan, checkpoint dan rollback/roll-forward yang tidak mengubah tenant lain. Catat waktu pemulihan dan kehilangan data yang benar-benar terukur. **Jangan menawarkan arbitrary cluster-wide restore untuk permintaan tenant.**

### 6.3 Acceptance staging: smoke, failure, rollback (target, belum hasil uji)
Sebelum uji, bekukan workload/seed, ukuran data, versi build/schema/job, topologi, timeout, observation window, SLO recovery dan plafon biaya. Simpan histogram p50/p95/p99, error numerator/denominator, offered/completed throughput, oversell, accepted/terminal/pending/DLQ counts dan waktu recovery; jangan mengutip O(1) Lua sebagai benchmark produksi.

| Skenario | Langkah minimum | Kriteria lulus target |
|---|---|---|
| Smoke dua tenant | Login/refresh/logout lintas instance; izin scoped; tenant tanpa lisensi mencoba menu/rute/API; tenant opt-out lalu mencoba activate; read-your-writes Primary | Tidak ada kebocoran/eskalasi; refresh/logout konsisten; opt-in tidak menciptakan lisensi; audit sesuai aksi |
| Mixed-version rollout | N dan N-1 bersamaan; expand/backfill; request, job lama/baru dan SSE aktif saat drain | Tidak ada incompatibility error atau accepted operation hilang; reconnect/poll membaca status durable; tidak ada destructive DDL bersamaan |
| Beban KRS | Fixture NFR-P1 3.000 mahasiswa/20 menit dengan profil burst eksplisit; 150 klaim atas satu kursi; ulang idempotency key | Oversell **0**, satu enrollment sah untuk kursi terakhir, tidak ada side effect duplikat; target NFR p95 ≤800 ms dan error tak terduga ≤0,1%. Untuk async pisahkan p95 acknowledgment dari finalization; usulan p95 finalisasi ≤8 s harus disetujui, bukan diam-diam mengganti NFR |
| Worker/queue failure | Kill worker sebelum/sesudah commit dan sebelum ack; job duplikat/stalled; Redis partition/failover dan kehilangan lease | Stale epoch tidak commit; admission tertutup saat state tak pasti; setiap accepted op terminal atau tercatat untuk recovery/DLQ; oversell 0; waktu pulih dan backlog drain ≤ budget recovery yang disetujui sebelum uji |
| DB/DDL failure | Primary unavailable, commit-unknown, pool penuh, lock contention, concurrent-index gagal | Timeout bounded, readiness sesuai kapabilitas; tidak ada retry storm/invalid index luput; audit/outbox tidak terpisah dari commit; latency/error dicatat sepanjang fault, tidak disembunyikan sebagai sukses |
| Rollback rehearsal | Gagalkan readiness/SLI saat canary; alihkan ke artefak lama; drain worker/SSE; periksa seluruh accepted op | Old version masih baca/tulis skema expand; tidak ada data hilang/dua writer; RTO rollback ≤ budget yang disetujui, business invariants tetap; zero service downtime hanya boleh diklaim bila bukti interval ini mendukung |
| Tenant recovery & operasi | Export tenant A → isolated restore → validasi; tenant B tetap aktif; coba clear cache/retry tanpa hak | Checksum/FK/audit/outbox cocok atau selisih disetujui sebelum import; tenant B tidak berubah; aksi lintas namespace/CLI/SQL ditolak; RPO/RTO restore terukur |

Jika budget recovery/finalization, provider/topologi, atau bukti uji belum disetujui, statusnya **blocked**, bukan “production-ready”. Kegagalan fault injection boleh menghasilkan degraded/503 yang dirancang, tetapi tetap dilaporkan terpisah dari SLO layanan normal dan menghalangi klaim zero downtime bila ada outage.
