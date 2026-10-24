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
| **Registri 47 modul bisnis + SuperApp & pemetaannya ke entitlement** | `PRD.md` (§5.12 registri · §5.13 vonis tanggung-jawab-tunggal) | `BENCHMARK_SEVIMA.md`, `BLUEPRINT_ENTERPRISE.md` (pohon menu), `RBAC_MATRIX.md` (partisi izin), `DATA_MODEL.md` (§21.7 `menu_items`) |
| **Rantai data lintas modul, peristiwa kanonik & jalur real-time** | `ARCHITECTURE.md` (§13.1 katalog peristiwa · §13.2 vonis SSE/WebSocket · §13.4 lima skenario simulasi) | `API_SPEC.md` (§7 endpoint modul baru), `UI_UX_DESIGN.md` (§17 grid kartu per peran), `INTEGRATIONS.md` |
| **Peta algoritma per modul (ALG-1…ALG-24) & vonis permintaan pemilik** | `ARCHITECTURE.md` (§11–§12 engine, §13.5–§13.6 peta & penolakan) | `DATA_MODEL.md` (§17–§18), `TECH_CONVENTIONS.md` (§7 design-only), `ROADMAP_TASKS.md` (§2.11/§2.14) |
| **Area Admin, Data Master & Benchmark Kompetitor** | `BENCHMARK_SEVIMA.md` | `PRD.md` (§5.8), `DATA_MODEL.md` (§14), `API_SPEC.md` (§4.6), `UI_UX_DESIGN.md` (§9), `ROADMAP_TASKS.md` (§2.5) |
| **Kanal vicon (Microsoft Teams/Zoom/Meet/BBB/Jitsi), kosakata tunggal modus, dan proyeksi hadir daring** | `PRD.md` (§5.15) | `DATA_MODEL.md` (§21.10, `0073`–`0075`), `API_SPEC.md` (§4.19 + register 145–149), `RBAC_MATRIX.md` (§4.5.2 baris 292–297), `INTEGRATIONS.md` (§6.8), `ENV_CONTRACT.md` (§7) |
| **Cetak biru enterprise, state machine & peta field** | `BLUEPRINT_ENTERPRISE.md` | `RBAC_MATRIX.md` (norma peran/izin), `BENCHMARK_SEVIMA.md` (bukti studi), `DATA_MODEL.md` (§14), `PRD.md` (§5.8) |
| **Blueprint per-peran (menu · tombol · field · API · UX per lapisan)** | `BLUEPRINT_ROLE_BY_ROLE.md` | `RBAC_MATRIX.md`, `AUDIT_READINESS.md`, `ROADMAP_TASKS.md` (§2.5.14), `UI_UX_DESIGN.md` (§9) |
| **Audit kesiapan, celah keamanan kode, delta benchmark** | `AUDIT_READINESS.md` | seluruh dokumen (ia menilai kesiapannya), `SECURITY_COMPLIANCE.md`, `BLUEPRINT_ROLE_BY_ROLE.md` |
| **Engine algoritma nol-API-key (ALG-1…ALG-14)** | `ARCHITECTURE.md` (§11–§12) | `DATA_MODEL.md` (§17–§18), `API_SPEC.md` (§6), `RBAC_MATRIX.md` (§4.5), `UI_UX_DESIGN.md` (§12), `ROADMAP_TASKS.md` (§2.11) |
| **Data master, kamus dinamis & atribut kustom (zero-hardcoding)** | `DATA_MODEL.md` (§14.2 & §20) | `PRD.md` (FR-ADM-07/09), `API_SPEC.md` (§4.14), `UI_UX_DESIGN.md` (§13), `SEED_DATA.md`, `RBAC_MATRIX.md` (§4.5) |
| **Engine algoritma deterministik (zero-API-Key): CPM, bin-packing, AHP/TOPSIS+Gale-Shapley, RETE, max-flow/min-cut, AST, ekstraksi dokumen** | `ARCHITECTURE.md` (§11 + ADR-14…17) | `DATA_MODEL.md` (§17), `API_SPEC.md` (§6 + register error 66–78), `SECURITY_COMPLIANCE.md` (§10), `RBAC_MATRIX.md` (§4.5), `ROADMAP_TASKS.md` (§2.11, W-13) |

### 2.2 Daftar Lengkap 24 Dokumen

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
| 19 | `RBAC_MATRIX.md` | `/docs/RBAC_MATRIX.md` | **Sumber kebenaran hak akses**: 22 peran normatif ber-scope (+3 usulan), katalog **222 izin atomik terukur** (6 aksi kanonik per FR-IDT-04), matriks Role × Modul × Menu × Aksi, aturan SoD/ABAC/PII, celah G-01…G-15 |
| 20 | `BENCHMARK_SEVIMA.md` | `/docs/BENCHMARK_SEVIMA.md` | Hasil studi dokumentasi Sevima (peran, menu, modul, data master, flow) + kondisi SICA + peta selisih + urutan pengerjaan Area Admin |
| 21 | `BLUEPRINT_ENTERPRISE.md` | `/docs/BLUEPRINT_ENTERPRISE.md` | **Cetak biru dekonstruksi Sevima Enterprise**: matriks RBAC 14 kolom peran × 7 gugus modul (A–G), tree menu `/admin/**` per peran + 21 modal, peta field ±90 entitas, 8 state machine + 10 invariance, verifikasi realita kode, urutan ADM-0…ADM-12 |
| 22 | `BLUEPRINT_ROLE_BY_ROLE.md` | `/docs/BLUEPRINT_ROLE_BY_ROLE.md` | **Blueprint eksekusi per-peran** (6 lapisan `R-1`…`R-6`): pohon menu, hak tingkat tombol (10 aksi → 6 verba), **hak tingkat field** (`FIELD_RULES`, `SERVER_ONLY`), objek DB & endpoint, komponen Velzon, edge case, DoD per lapisan + matriks SoD/IDOR/RLS |
| 23 | `AUDIT_READINESS.md` | `/docs/AUDIT_READINESS.md` | **Laporan audit kesiapan** (three-lens): skor 22 dokumen, 38 gap `RD-*`, 30 kontradiksi bernorma, 54+ objek tanpa DDL, 18 temuan keamanan kode `SEC-*` (1 CRITICAL), 138 delta benchmark `BENCH-*`, 10 keputusan produk `P-*`, urutan penutupan P0–P3 |
| 24 | `PROGRESS_REPORT.md` | `/docs/PROGRESS_REPORT.md` | Laporan kemajuan & bukti verifikasi per siklus (`tsc`/`vitest`/`gen-rbac-seed --check`, temuan tulis-tersua, ralat yang dibuat sendiri). Daftarnya baru dimasukkan ke register ini pada 2026-10-19 (menutup `RD-37`) |

---

### 2.3 Ralat nama rujukan (terukur 2026-10-20)

Permintaan produk pernah menyebut `INTEGRATION_SPEC.md`. Berkas itu **tidak ada** dan tidak akan dibuat: yang nyata adalah [`docs/INTEGRATIONS.md`](file:///c:/SICA/docs/INTEGRATIONS.md). Membuat berkas kedua dengan isi serupa adalah persis pola `RD-03`/`RD-32` yang kita perangi. Agen yang diminta "perbarui INTEGRATION_SPEC" wajib membaca dan menulis `INTEGRATIONS.md`.

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

### 3.8 Penegakan RBAC Ber-scope (Sumber Kebenaran: `RBAC_MATRIX.md`)
Rujukan: `RBAC_MATRIX.md` (§2 peran, §4 katalog izin, §6 matriks menu), `SECURITY_COMPLIANCE.md` §3, `DATA_MODEL.md` §14.4. Setiap agen **wajib**:
- **Jangan pernah membuat kode `roles` atau string permission baru di luar `RBAC_MATRIX.md`.** Titik aksi = baris di `RBAC_MATRIX.md` §4 lebih dulu, baru ke kode (`packages/contracts/src/authz.ts` — `PERMISSION_SPECS`; **bukan** `packages/domain` yang tidak pernah ada, lihat AUDIT_READINESS `RD-05`). Izin add-on di RBAC §4.3 berstatus **non-normatif** sampai dimasukkan ke katalog (`G-15`).
- **Simpan izin sebagai `resource × verb`** dengan `verb` ∈ `READ · INSERT · UPDATE · DELETE · VALIDATE · OTHER` (FR-IDT-04). `VALIDATE` = aksi persetujuan; `OTHER` hanya untuk aksi yang terdaftar eksplisit — bukan tempat sisa.
- **Hak dibaca dari `user_role_assignments` (scope + `valid_to`), bukan dari label role global.** Nilai enum `member_role` hanya carrier login; satu user bisa memegang banyak role di scope berbeda.
- **Guard dua lapis.** Layer transport: validasi Zod + cek permission (403). Layer service: cek relasi & state (kelas ampuan, periode `OPEN`, status `LOCKED`, gerbang tagihan, cekal). Masking menu di UI **bukan** kontrol akses.
- **Urutan L1↔L3 pada rute tulis: izin mendahului bentuk.** Daftar enam lapis di bawah menyebut lapis, **bukan** urutan eksekusi, dan tanpa aturan tertulis hal ini dua kali diperdebatkan bolak-balik. Normanya sekarang: pada rute tulis admin, `requireAdmin*`/`requireDataPrincipal` dipanggil **sebelum** `safeParse` body/param, sehingga peran yang tidak berhak selalu menerima `403` datar dan tidak pernah menerima `422` ber-`details` field-level. Alasannya sama dengan ralat 2026-10-23 pada `admin-guard.ts` (403→401 untuk sesi non-`amr`): menjawab kontrak objek kepada orang yang memang tidak boleh menyentuhnya adalah **oracle kecil** — ia mengajari penyerang bentuk body yang harus disiapkan. Sisa metode tulis warisan yang masih `parse`-dahulu didaftarkan sebagai `AUDIT_READINESS RD-155` dan ditutup bertahap; **rute baru tidak boleh** mengulang pola itu, dan e2e lapisan ini wajib memuat harapan "body cacah dari peran tanpa izin tetap 403" (bentuk uji: `.tools/e2e-fase-1d.mjs`).
- **Empat titik kegagalan wajib diuji, bukan diasumsikan aman:** izin cukup tapi data prodi lain · izin ter-cache tapi sudah dicabut · `tenant_id` benar tapi periode salah · filter di query tapi RLS tidak aktif (CI menolak).
- **Larangan:** pencocokan **substring** nama peran (mis. `role.includes('admin')` — celah G-01); `hasRole` tunggal sebagai satu-satunya gerbang; tulis izin/`VALIDATE` tanpa MFA untuk peran admin; satu actor sebagai pemohon **dan** penyetuju pada `finance.invoice.void` / `finance.waiver.approve` / `grading.unlock` (SoD, BR-K2/BR-G4).
- **Entitlement memotong lebih dulu dari role:** modul non-`ACTIVE`/`TRIAL` → `404 MODULE_NOT_AVAILABLE`, walau izin ada. Menu Web & bottom-nav Mobile disaring dari `GET /tenant/modules` × role aktif. Penyaringan menu **bukan** penegakan: gerbang server `withModule` wajib terpasang di rute (audit menemukan helper ada tapi nol call site — `AUDIT_READINESS SEC-09`).
- **Enam lapis penegakan wajib lengkap di setiap rute tulis** (`BLUEPRINT_ROLE_BY_ROLE` §0.4): L1 transport (Zod whitelist) · L2 identitas (tenant & user **hanya** dari token terverifikasi; middleware **wajib menghapus** `x-tenant-id`/`x-user-id` kiriman klien sebelum menyetel milik sendiri — `SEC-07`) · L3 permission berbasis tabel (`requireDataPrincipal`, bukan perluasan carrier — `SEC-10`) · L4 scope (`holdsScoped(access, PERM.x, {…})` — hari ini fungsi ada tetapi tidak dipanggil, `SEC-11`) · L5 state (periode `OPEN`, `LOCKED`, gerbang, clearance) · L6 RLS. **Anti-IDOR:** id apa pun dari klien wajib diselesaikan ke barisnya **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND id = $1`) lalu dibuktikan kepemilikan sebelum mutate. Rute yang menerima `enrollmentIds[]`/`sessionId`/`periodId` tanpa pembacaan DB = temuan `SEC-02/03/04`, bukan gaya kode.
- **Hak tingkat field (baru, `BLUEPRINT_ROLE_BY_ROLE §0.3`).** Aturan field didefinisikan di kode (`FIELD_RULES` di `packages/contracts/src/authz.ts`), bukan sebagai baris DB, dan diterapkan pada **proyeksi server** (bukan menyembunyikan sel di UI). Kolom yang hanya berubah lewat transisi state ditandai `SERVER_ONLY` (`grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `students.nim`, `students.status_akademik`, `mfa_factors.secret`, `pddikti_*_id`) dan **tidak pernah** diterima dari body. Nominal keuangan tidak boleh terbaca oleh peran akademik yang tidak berhak (SoD BAAK↔BAUK); peran lain menerima boolean "tertahan/tidak" beserta sebab, bukan jumlahnya.
- **Pengecualian sementara yang tercatat (bukan norma).** Jalur KRS hari ini **sinkron** dengan `pg_advisory_xact_lock` (`krs.service.ts:371`), sementara `AGENTS §3.7` mewajibkan Redis-Lua + BullMQ pada beban puncak. Ini diterima sebagai **pengecualian berjangka** sampai `bullmq`/`ioredis` menjadi dependensi nyata (`RD-11`, keputusan `P-6`); agen dilarang menyebut pola sync ini sebagai arsitektur final, dan dilarang membalik jalur tanpa memasang antrean + idempotensi + DLQ lebih dulu.
- **Pengecualian sementara kedua — `SICA_DEV_MFA_BYPASS` (`RD-173`, diminta pemilik produk 2026-10-24).** Pada `NODE_ENV=development` dengan flag `'1'` di `apps/web/.env` (gitignored), langkah MFA pada login **dilewati**: tantangan `mfa_challenges` tidak dibuat. Batasnya tegas dan itu bagian dari rancangannya: sesi tetap terbit dengan `amr = ['pwd']` (bukan `['pwd','mfa']`), sehingga `requirePlatformWrite` dan `requireAdminWriteAny` **tetap** menjawab `401 MFA_REQUIRED`, dan `login_events.auth_method` tetap mencatat `password` — jejak audit tidak dibohongi. `validateEnv()` melempar sebelum validasi skema bila `'1'` berpasangan dengan `production`. Agen dilarang: memakainya sebagai alasan menormalkan tulis-platform tanpa MFA, menyalin flag ke env staging/production, atau melebarkan jendela TOTP (`window`) atas nama kenyamanan yang sama. Kontrak variabelnya hidup di `ENV_CONTRACT §6.1`, bukan di sini.

### 3.9 Engine Algoritma Deterministik Zero-API-Key (Sumber Kebenaran: `ARCHITECTURE.md` §11)
Rujukan: `ARCHITECTURE.md` §11 + ADR-14…ADR-17, `DATA_MODEL.md` §17, `API_SPEC.md` §6, `SECURITY_COMPLIANCE.md` §10, `RBAC_MATRIX.md` §4.5, `ROADMAP_TASKS.md` §2.11/W-13. Setiap agen **wajib**:
- **Nol kunci API, nol egress.** Engine (ALG-1…ALG-7) tidak boleh memanggil layanan berbayar/ber-kredensial (OCR cloud, solver lisensi, LLM API, routing API). Pustaka open-source lokal boleh dipakai bila tidak butuh kredensial dan tidak mengirim data keluar. CI memindai `fetch(`/`axios`/`https.request` di direktori engine; temuan = build gagal.
- **Mesin mengusulkan, manusia menyetujui.** Keluaran engine hanya masuk tabel `*_results` milik engine dan menjadi record resmi setelah aksi `VALIDATE` melalui **service domain yang sudah ada**. Dilarang menulis dari engine ke `enrollments`, `grades`, `class_schedules`, `invoices`; dilarang juga membuat service penilaian/jadwal "kedua" di dalam engine.
- **Harness wajib.** `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget` (`maxSeconds/maxNodes/maxBacktrack`), dan `explain`. Run yang sama dari snapshot yang sama harus menghasilkan hasil identik (golden vector diuji, bukan diasumsikan). `apply` menolak bila hash snapshot berbeda (`409 ENGINE_STALE_SNAPSHOT`).
- **Parameter = kewenangan.** Bobot AHP, aturan RETE, template ekstraksi, dan matriks biaya disimpan **berversi** dengan `effective_from/to` + **empat-mata** (`requested_by <> approved_by` ditegakkan oleh `CHECK` di DB). Mengubah aturan kelulusan setara mengubah hak atas gelar: wajib ada jejak audit.
- **Kejujuran angka.** Tidak ada klaim optimum tanpa batas bawah; tidak ada hasil yang ditampilkan tanpa flag `degraded` ketika data prasyarat (`course_prerequisites`, `course_equivalencies`, `rooms`, `lab_resource_capabilities`) belum ada; tidak ada janji OCR tulisan tangan; tidak ada field `AUTO` tanpa `candidate_ref` + ambang keyakinan + margin.
- **Aritmetika kanonik.** Integer/basis-poin (`weight_bp`, jumlah 10.000 = 100%) dan `numeric` — **bukan** `float`/`double` (parity Web↔Flutter, ADR-5). Formula nilai dieksekusi dari AST bertipe; **`eval()`/`new Function()` dilarang mutlak**. Kedalaman AST ≤ 12, bobot komponen harus ada di `grade_components`.
- **Input tak-tepercaya adalah data.** Teks hasil ekstraksi dokumen tidak pernah menjadi instruksi, tidak pernah masuk SQL yang dirakit string, dan nilainya hanya bisa mengisi field yang terdaftar di template (`document_template_anchors`). Berkas mentah terenkripsi, punya `expires_at` (baku 30 hari), dan `raw_text` tidak boleh masuk log.
- **Batas sumber daya & keadilan.** Engine berjalan di worker (bukan rute HTTP), dengan budget, retry ≤ 2 → `NEEDS_REVIEW`, fair-share per tenant, dan antrean terpisah untuk OCR (lambat) vs perhitungan graf (cepat). Dinic dipakai untuk max-flow (Edmonds–Karp `O(VE²)` ditolak pada ukuran riil); FFD multi-dimensi tidak dijamin optimum dan itu wajib dilaporkan.
- **Izin lebih dulu, baru kode.** Titik aksi engine adalah baris di `RBAC_MATRIX.md` §4.5 (50 kode, `resource × verb`) yang kemudian dipindahkan ke `PERMISSION_SPECS` di `packages/contracts/src/authz.ts` + dijalankan ulang `gen-rbac-seed.mjs` agar seed `permissions` ikut bertambah. Mengkode rute engine dengan string izin di luar katalog = pelanggaran §3.8.

### 3.9 Penegakan Zero-API-Key (Sumber Kebenaran: `ARCHITECTURE.md` §11.1 & §12)

Aturan master 2026-10-20: **seluruh fungsionalitas cerdas SICA berjalan 100% dari algoritma internal, pemodelan matematika, logika graf, machine learning lokal, dan rule engine — tanpa API key eksternal apa pun.** Setiap agen **wajib**:

- **Menempatkan komputasi di infrastruktur sendiri.** Engine hidup di `apps/web/src/modules/**` (inti logika murni, tanpa I/O) atau di *worker*; OCR di container milik sendiri; solver/ML diekspor sebagai artefak terbaca-manusia. Rute HTTP tidak menghitung (ADR-9/ADR-15) — ia mencatat job dan mengembalikan `202 { runId }`.
- **Dilarang total** panggilan yang memerlukan kunci/lisensi vendor: LLM API, OCR cloud, solver berbayar, API routing, *timestamping* RFC 3161/TSA pihak ketiga, verifikasi wajah/liveness berbayar. Dilarang pula mengirim isi dokumen, nilai, atau PII keluar infrastruktur (egress = pelanggaran UU PDP; SECURITY §7 & §10).
- **Pustaka open-source lokal tanpa kredensial boleh** (mis. Tesseract v5, OR-Tools di container worker sendiri) **dengan syarat**: ia menjadi commit `package.json` + lockfile nyata dan tercatat di `TECH_CONVENTIONS §6`; sebelum itu statusnya **design-only** dan tidak boleh diklaim berjalan di dokumen, layar, atau PR.
- **Mesin mengusulkan, manusia memutuskan.** Keluaran engine masuk tabel `*_results` miliknya sendiri dengan `proposal_only = true` dan hanya menjadi data resmi setelah aksi `VALIDATE`. Engine tidak punya jalur tulis ke tabel domain.
- **Hasil wajib dapat direproduksi**: `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain`. PRNG wajib ter-*seed* dan seed-nya tersimpan. Enam engine NP-hard (ALG-2/3/5/8/9/13 + rantai audit ALG-14) tidak boleh menampilkan angka parsial sebagai angka final — mode turun (`degraded`, `PARTIAL_BUDGET_EXHAUSTED`, `NO_PREREQ_DATA`) tampil apa adanya.
- **Aritmetika integer/`numeric` sebagai bentuk kanonik** untuk pembobotan dan agregasi (basis poin, `numeric(6,3)`); `float`/`double` dilarang lintas platform karena melanggar paritas §3.4 Next.js ↔ Flutter.
- **Gerbang CI membuktikan, bukan menyatakan:** (g) *egress scan* `fetch(`/`axios`/`https.request` di direktori engine; (h) *golden vector* byte-identik per engine; (i) paritas numerik TS ↔ Dart; (j) uji penolakan bahwa engine tidak dapat menulis tabel domain; (k) verifikasi rantai audit (baris diubah → verifier harus menghasilkan `HASH_MISMATCH`); (l) uji daftar-terlarang atribut model ML.

**Larangan turunan.** Agen dilarang: menyebut hasil nondeterministik sebagai angka akademik; menjanjikan kemampuan yang butuh kunci ("nanti pakai OCR cloud"); menulis engine yang membaca replica untuk data yang baru ditulis; atau menyebut `bullmq`/`ioredis`/`or-tools`/ONNX sebagai arsitektur yang sudah terpasang.

### 3.10 Penegakan Zero-Hardcoding Data Master (Sumber Kebenaran: `DATA_MODEL.md` §20)

Setiap nilai yang **dapat dinamai ulang atau ditambah oleh kampus** wajib menjadi **data** di mesin kamus (`reference_kinds` + `reference_items`), dibaca lewat `GET /api/v1/master/lookups?group={GROUP_CODE}`, dan dirender oleh Dynamic Form Generator — bukan konstanta di kode.

- **Empat kelas, terukur** (DATA_MODEL §20.1): **A** protokol & mesin state yang dicabangi kode → enum PostgreSQL tertutup; **A′** keadaan tetap, label kampus → enum + label di kamus; **B** nilai yang ditetapkan negara → `reference_dictionary_entries` berversi (tenant hanya memetakan label, tidak mengubah kode); **C** kamus yang dapat dirawat kampus → `reference_items` per tenant dengan RLS `ENABLE`+`FORCE`; **D** field yang tidak ada di model → `tenant_custom_attributes` + nilai di `attributes jsonb`.
- **Dilarang** untuk kelas C/D: array opsi literal di TypeScript/Dart, `<option>` hardcoded, `z.enum([...])` di `packages/contracts`, dan `CHECK (col IN ('A','B','C'))` di SQL untuk nilai yang dapat berkembang antar kampus.
- **Kecualian yang sah dan wajib tercatat.** "Zero-hardcoding" tidak berarti "tanpa konstanta". Kelas A/A′ tetap kosakata tertutup — `permission_verb`, `enrollments.status`, `queue_operations.state`, `pddikti_domain`, payload PDDikti tidak boleh menjadi data yang dapat disunting saat runtime, karena seluruh gerbang RBAC, mesin state, dan kirim Feeder bergantung padanya. Daftar kolom yang boleh punya `CHECK` tertutup adalah register enum §15.1/§15.2/§15.3 dan tidak ada yang lain.
- **Atribut kustom bukan tempat sampah.** Definisi + tipe + regex + wajib + scope + visibilitas peran disimpan di `tenant_custom_attributes`; nilainya di kolom `attributes jsonb` tabel induk (EAV murni ditolak sebagai penyimpan). Aturan keras: atribut **tidak boleh** menciptakan keadaan mesin; input berpilihan wajib menunjuk `options_kind` (kamus), bukan daftar dalam JSONB; `feeder_mapping IS NULL` berarti tidak pernah ikut kirim; `pii_level='SPECIFIC'` menolak isi-mandiri klien; plafon 40 atribut `is_searchable` per entitas; mengaktifkan butuh empat-mata; riwayat insert-only.
- **Satu fisik, satu view.** Nama alternatif dari dokumen/permintaan lain (`master_lookup_groups`, `master_lookup_items`, `metadata`, `sorting_order`) dilayani sebagai **view** dengan `security_invoker = true` — bukan tabel kedua (pola `RD-32`). View `security_definer` menembus RLS dan karena itu dilarang.
- **Urutan baca deterministik**: `ORDER BY sort_order, code` — tidak pernah `id` (UUIDv7 berubah urutan saat tenant menambah item, sehingga layar tampak "acak" setelah impor). Nilai `is_active=false` tetap terbaca lewat `?at=YYYY-MM-DD` demi rekonstruksi laporan historis (BR-R12).
- **Parameter operasional juga wajib dinamis** (DATA_MODEL §21). Skalar tingkat tenant — ambang presensi, umur rotasi QR, radius geofence, ambang akurasi GPS, rasio durasi join daring, timeout & skew webhook, plafon cicilan, TTL lease KRS — disimpan di `master_system_parameters` dengan CRUD penuh, riwayat insert-only beralasan + IP, dampak, dan pengajuan–persetujuan. **Batasnya:** kredensial/rahasia **tidak pernah** menjadi baris parameter (`CHECK (is_secret = false)`, `source_of_truth <> 'ENV'`), dan **ambang keamanan tidak dapat dilonggarkan melewati rentang `CHECK`** (`min/max_value`) seandainya Admin IT menginginkannya; kelas `SECURITY`/`REGULATORY` menuntut penyetuju kedua + MFA. Aturan struktural (band SKS per IPK, skala nilai, komponen biaya, kanal VA, pola NIM) **tidak** dipindahkan ke key-value karena sudah punya tabel — memindahkannya akan menciptakan dua sumber kebenaran.
- **Gerbang CI (m)(n)(o)(p):** scanner kosakata literal; setiap `kind` yang dibaca UI wajib punya baris `reference_kind_usage`; `CHECK` tertutup hanya untuk kolom yang tercatat di register; scanner nama menolak tabel kamus kembar berbetuk `(code, name)`.

### 3.11 Penegakan Enam Engine + Data Master = Satu Jalur Eksekusi

Ketika sebuah fitur membutuhkan **keduanya** (mis. tarif UKT yang dapat dirawat kampus **dan** dihitung mesin; atau pencocokan kemiripan Feeder yang memakai kamus wilayah nasional), urutannya tidak boleh dibalik: (1) normanya masuk `PRD.md` sebagai FR/BR/AC, (2) pemilik nama objek menuliskan DDL + nomor migrasi di `DATA_MODEL.md`, (3) `RBAC_MATRIX.md` menambah kode izin `resource × verb`, (4) `API_SPEC.md` menambah path + kode error, (5) `UI_UX_DESIGN.md` menambah pola layar termasuk copy mode turun, (6) `ROADMAP_TASKS.md` menaruh task pada slice peran yang benar, (7) **baru** kode ditulis. Menulis kode di langkah mana pun sebelum langkah 6 selesai melanggar "tidak ada progress tanpa catatan dokumen".
### 3.12 Penegakan Kanal Vicon (Sumber Kebenaran: `PRD.md §5.15`, `DATA_MODEL.md §21.10`)

Rujukan: `API_SPEC.md` §4.19 + §4.18.3, `RBAC_MATRIX.md` §4.5.2, `INTEGRATIONS.md` §6.8, `SECURITY_COMPLIANCE.md` §7/§13, `ENV_CONTRACT.md` §7. Setiap agen **wajib**:

- **Pakai satu kosakata kanal.** Nilai sah = enum `conference_provider` (`BUILTIN_LMS · BBB · JITSI · GOOGLE_MEET · MICROSOFT_TEAMS · ZOOM`). Dilarang menulis ulang daftar di kontrak, slug webhook, atau kode; slug webhook **turun** dari enum (`lower(provider)`). Alias lama (`TEAMS`, `BUILTIN`) hanya dibaca lewat satu mapper dan ditolak saat tulis.
- **Kanal adalah transport, bukan mesin dan bukan pemilik fakta.** Tidak ada OCR/proctoring/optimasi yang dialihkan ke vendor; vonis kehadiran dihitung M-18 di server. Laporan vendor bersifat pendukung (`INTEGRATIONS §6.2`, `ARCHITECTURE §13.3` vonis 4).
- **Rahasia tidak pernah menjadi parameter atau body.** Hanya `credential_ref` + `ENV_CONTRACT §7`; `DATA_MODEL §21.2` (`is_secret = false`, `source_of_truth` bukan `ENV`) adalah penegaknya. Identifier penyewa tetap server-only.
- **Label hadir daring bukan enum baru.** `HADIR_ONLINE`/`HADIR_MIXED` adalah proyeksi dari (`attendance_status`, kanal, rasio ≥ ambang) + tag Feeder `O`/`M` dari kamus; `attendance_status` tetap lima nilai. Banding memakai `attendance_appeals` (`0017`) + `attendances.review_state` (`0074`), bukan status kedua.
- **Gagal-closed dan jujur saat kanal mati.** `CHANNEL_UNAVAILABLE` dan flag `degraded` wajib terlihat; tidak ada rasio parsial yang boleh dikunci sebagai angka akademik, dan tidak ada fallback diam-diam.
- **Angka registri dihitung, tidak disalin.** Jumlah baris izin: `node .tools/rbac-count.mjs`; konsistensi kode error: `node .tools/error-dup.mjs`; kosakata: `node .tools/vocab-audit.mjs`; rantai peristiwa: `node .tools/chain-audit.mjs`.


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

> **Ralat 2026-10-19 (Principal Lead Architect).** Bagian ini sebelumnya **mengklaim tiga berkas yang tidak pernah ada**. Diukur langsung: `CLAUDE.md` → `ENOENT`, `.windsurfrules` → tidak ada di root, `.github/` hanya berisi `workflows/` (tidak ada `copilot-instructions.md`). Hanya `.cursor/rules/` yang benar nyata. Klaim palsu di file router berbahaya karena agen lain mempercayainya tanpa membuka repo — jadi bagian ini ditulis ulang mengikuti realita, dan pembuatan berkasnya menjadi **task** (`RD-38` di [AUDIT_READINESS.md](file:///c:/SICA/docs/AUDIT_READINESS.md)), bukan asumsi.

### 5.1 Yang nyata hari ini
| Adaptor | Status | Isi |
|---|---|---|
| `.cursor/rules/01-architecture.mdc`, `02-security.mdc`, `03-ui-conventions.mdc`, `04-workflow.mdc` | ✅ **ada** | empat glob rules sesuai tabel §4; terverifikasi `ls .cursor/rules/` |
| `AGENTS.md` (file ini) | ✅ **ada** | router utama; agen mana pun yang mendukung konvensi `AGENTS.md` membacanya otomatis |

### 5.2 Yang belum ada — dibuat bila perlu, jangan diklaim
| Adaptor | Untuk siapa | Keputusan |
|---|---|---|
| `CLAUDE.md` | Claude Code | Belum ada. Bila diperlukan, isinya **hanya** rujukan ke file ini (jangan menyalin guardrail — salinan kedua = dua sumber kebenaran, pola `RD-03`/`RD-12` yang kita perangi) |
| `.windsurfrules` | Windsurf | Belum ada. Perlakuan sama dengan `CLAUDE.md` |
| `.github/copilot-instructions.md` | GitHub Copilot | Belum ada. Catatan: `.github/workflows/main-pipeline.yml` **memang ada**, jadi direktorinya tidak kosong |

**Aturan pakai.** Agen yang bekerja di repo ini cukup membaca `AGENTS.md` + `.cursor/rules/*`. Menambah berkas adaptor baru **wajib** di satu arah: menunjuk ke sini, tidak pernah mengulang norma di sini.

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

### 6.1 Format laporan baku ke pemilik produk (ditetapkan 2026-10-21)

Setiap siklus perubahan yang menyentuh spesifikasi modul **wajib** ditutup dengan laporan berkolom tetap berikut — satu baris per modul registri (`PRD.md` §5.12) — dan laporan itu **dicetak oleh alat**, bukan diketik ulang:

```
node .tools/module-readiness.mjs              # 48 baris + rincian CRUD/menu per modul
node .tools/module-readiness.mjs --only=M-01  # satu modul
node .tools/module-readiness.mjs --summary    # hanya tabel utama, tanpa rincian
node .tools/fr-ac-gap.mjs                     # penahan ketujuh: FR yang tidak dikutip AC mana pun
```

| Kolom | Isi | Pemilik angka (jangan menyalin dari tempat lain) |
|---|---|---|
| `M` | ID modul registri | `PRD.md` §5.12 |
| `Modul` | Nama modul | `PRD.md` §5.12 |
| `CRUD` | `c·r·u·d·v` — jumlah rute per verba yang **ada** untuk modul ini | `.tools/crud-matrix.mjs` (dipindai dari `API_SPEC.md`, bukan daftar tangan) |
| `Rute→handler` | `n/m (kelas)` — berapa rute yang sudah punya `route.ts` nyata dan kelas terbaiknya (`DB` / `DB_MOCK` / `MOCK` / `UNPROVEN` / `NONE`) | `.tools/handler-inventory.mjs --json` |
| `Menu §6` | Jumlah baris menu modul + presisi atribusinya (`eksplisit` / `resource` / `SKU`) | `RBAC_MATRIX.md` §6 lewat `.tools/module-readiness.mjs` |
| `Tabel` | Jumlah objek DDL yang berlabel modul di `DATA_MODEL.md` | `.tools/module-provenance.mjs` |
| `Izin` | `eksplisit / ber-nomor / usulan` | `RBAC_MATRIX.md` §4 lewat `.tools/rbac-count.mjs` |
| `Kode` | Kode entitlement/SKU pemilik modul, atau `—` bila gerbangnya peran (mis. M-01) | `PRD.md` §5.12.3 · `RBAC_MATRIX.md` §4.5.1 |
| `STATUS SIAP DEV?` | Vonis **spesifikasi**: `SPESIFIKASI SIAP` atau daftar penahan fungsional | Enam penahan di `AUDIT_READINESS.md` §20 (alat yang menghitung) |
| `Kurang di mana` | Rincian verba/menu/izin/layar/seed/AC yang belum ada, dipisah `‖ CATATAN:` untuk isu atribusi (`PRV-4`) | tujuh penahan di `AUDIT_READINESS.md` §20 (alat yang menghitung) |

**Tiga larangan saat membaca laporan ini.** (1) `Tabel = 0` atau `Izin = 0` tidak otomatis berarti objeknya tidak ada — ia berarti **belum dilabeli ke modul**; lubang pelabelan itu bernama `PRV-4` dan tercatat sebagai CATATAN, bukan sebagai fungsional yang hilang. (2) `SPESIFIKASI SIAP` **bukan** izin mulai koding: gerbang global `DEV-G1…DEV-G7` dan `CI-G1…CI-G7` (`ROADMAP_TASKS.md`) menahan seluruh 48 modul sampai penegakan tiga lapis punya pemanggil produksi dan migrasi tertanam di pipeline. (3) vonis per modul diambil dari **tujuh penahan fungsional** — verba wajib tanpa rute, nol izin ber-nomor, nol baris menu `RBAC §6`, nol rujukan layar, nol rujukan seed, nol pemetaan menu di tempat lain, dan **nol FR yang dikutip sebuah acceptance criteria** — bukan dari enam saja; yang ketujuh dimiliki `.tools/fr-ac-gap.mjs` dan dipasang setelah kajian pakar M-02 menemukan modul berobjek lengkap tetapi tanpa definisi selesai.

Kolomnya tidak boleh ditambah atau dibalik di laporan lain. Dokumen yang butuh angka ini menunjuk `AUDIT_READINESS.md` §20 — menyalin angkanya melanggar `RD-55`; mencetaknya dari alat lain tanpa pemilikan yang terdaftar melanggar `RD-95`.

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
