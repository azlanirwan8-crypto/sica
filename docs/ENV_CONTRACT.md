# SICA Environment Variables Strict Contract

**Status:** Standar wajib dengan gap implementasi yang dinyatakan eksplisit.

**Validation Engine:** Zod; sumber runtime web `apps/web/src/config/env.ts`.

**Batas audit dokumen:** membaca schema/source dan manifest, bukan `.env`, secret manager, atau nilai ENV runtime.

## 1. Kebijakan "Zero Unvalidated process.env Access"

Kode bisnis mengimpor konfigurasi tervalidasi, bukan membaca `process.env` sendiri. Parser/bootstrap, Edge dan CLI membutuhkan boundary validasinya sendiri; kebijakan ini **belum berarti seluruh akses liar sudah ditolak linter**. Contoh nyata gap: migrator dan readiness masih membaca ENV langsung.

### 1.1 Risiko Pelanggaran Tanpa Parser
Nilai undefined, boolean string yang salah dikoersi, serta secret yang masuk bundle/log dapat membuat aplikasi gagal atau membuka data. Jangan menganggap tipe TypeScript hasil cast sebagai bukti validasi runtime.

### 1.2 Aturan Impor Baku
```typescript
import { env } from '@/config/env';
const publicApiBaseUrl = env.NEXT_PUBLIC_API_URL;
```
Jangan mencetak `DATABASE_URL`, private key, token, DSN berkredensial, atau objek `env` utuh. Error validasi hanya nama field/kategori tanpa nilai. Credential hanya diinjeksi melalui ENV server-side dari secret manager; konfigurasi DB/dokumen menyimpan **referensi** secret/version. Secret tidak boleh memiliki default, masuk `NEXT_PUBLIC_*`, parameter akademik, manifest export, atau dashboard operator.

## 2. Skema Validasi Zod Web & Server (`apps/web/src/config/env.ts`)

Tidak ada parser runtime `packages/config/src/env.ts` pada checkout ini. Definisi lengkap tetap di source, inventaris pembacanya di §6; dokumen tidak menyalin schema alternatif yang bisa menyimpang.

**Perilaku aktual:** `ClientEnvSchema` divalidasi pada server **dan** browser. `ServerEnvSchema` hanya diparse di server. Client invalid selalu melempar error; server invalid melempar hanya ketika `NODE_ENV === 'production'`. Development/test/staging mengembalikan data client dengan cast gabungan, sehingga field server bisa undefined. Karena itu klaim “semua environment fail-fast” belum benar.

**Gerbang target:** staging dan production yang menjalankan layanan harus gagal sebelum menerima trafik jika konfigurasi kapabilitas wajib invalid; validasi kunci RS256 PEM/JWK yang cocok, boolean eksplisit, dan batas timeout harus diuji. Parser saat ini hanya menguji panjang string kunci; `z.coerce.boolean()` pada `MIDTRANS_IS_PRODUCTION` bukan parser string `true`/`false` yang aman (`"false"` truthy). Ini gap implementasi, bukan perubahan kode dalam sinkronisasi dokumentasi.

## 3. Skema Kontrak Lingkungan Flutter Mobile

Target konfigurasi publik compile-time: `APP_FLAVOR`, `API_BASE_URL`, `APP_PACKAGE_NAME`, `ENABLE_ROOT_DETECTION`, `ENABLE_SSL_PINNING`, `SENTRY_DSN`. Daftar ini kontrak desain, bukan bukti seluruh parser/fitur mobile telah diimplementasikan. Validasi URL HTTPS, flavor, dan opsi integritas sebelum `runApp`; default development tidak boleh menyamarkan salah konfigurasi produksi. Build mobile tidak boleh memuat secret backend/provider. Jangan menjanjikan endpoint WebSocket yang belum ada; kanal/polling mengikuti `API_SPEC`.

## 4. Matriks Ringkasan Variabel Wajib SICA

Ringkasan berikut menunjuk inventaris lengkap §6, bukan daftar credential contoh.

| Kategori | Kontrak | Batas penggunaan |
|---|---|---|
| Database runtime | `DATABASE_URL` | Role DML `NOBYPASSRLS`, tanpa DDL; bukan owner/superuser. RLS `FORCE` tidak membatasi superuser/BYPASSRLS |
| Migrator | `DIRECT_DATABASE_URL` | Koneksi direct/session dengan role terpisah. Runner saat ini masih fallback ke `DATABASE_URL`; produksi harus memverifikasi sumber koneksi sebelum eksekusi |
| Redis | `REDIS_URL` | Ada di schema, belum menjadi konsumen KRS/queue; `bullmq`/`ioredis` belum di manifest/lockfile (`RD-11`/`P-6`) |
| Auth | Kunci RS256, issuer/audience, TTL, pepper (§6.1) | Server-only kecuali material publik minimum untuk verifier; jangan kirim private key ke Edge/browser |
| Provider & storage | Nama yang diparse §6.1; proposal §7 | Credential dari ENV/secret-manager reference; adanya field wajib tidak membuktikan integrasi terpasang |
| Browser | Hanya `NEXT_PUBLIC_*` (§6.2) | Publik ketika dibuild; tidak untuk credential atau tenant authorization |

Host, IPv4/IPv6, port dan TLS berbeda menurut provider/proyek. Tidak ada aturan universal “Supabase direct selalu ENOTFOUND”, tidak ada region wajib dari dokumen ini, dan user `postgres.<ref>` bukan rekomendasi runtime. Uji jaringan/privilege pada lingkungan tujuan tanpa menampilkan connection string.

## 5. Catatan penomoran

Nomor §1–§8 dipertahankan agar rujukan dokumen lain tetap stabil. Perluasan tidak membuat dokumen arsitektur/deployment baru: gunakan `ARCHITECTURE.md` dan `DEPLOYMENT_DEVOPS.md`. Alat audit dokumen membantu mendeteksi drift, tetapi keberadaan nama variabel di Markdown bukan bukti dukungan parser.

## 6. Inventaris dari kode dan batas validasi

Dasar: `apps/web/src/config/env.ts`, manifest workspace dan `pnpm-lock.yaml`. Nilai default non-secret di bawah adalah **perilaku source**, bukan konfigurasi lingkungan yang diperiksa. Tidak ada hasil boot/deployment yang diklaim.

### 6.1 Server — ada di skema

| Variabel | Aturan nyata | Default | Catatan |
|---|---|---|---|
| `NODE_ENV` | enum development/test/staging/production | development | Perbedaan fail-fast §2 |
| `PORT` | int positif | 3000 | — |
| `LOG_LEVEL` | trace/debug/info/warn/error/fatal | info | Log tetap redacted |
| `DATABASE_URL` | URL, awalan postgresql:// | tidak ada | Koneksi runtime |
| `DIRECT_DATABASE_URL` | URL, awalan postgresql:// | tidak ada | Sudah ada dalam parser, bukan proposal |
| `REDIS_URL` | URL + pola redis:// atau rediss:// | tidak ada | Konfigurasi belum berarti konektivitas/konsumen tersedia |
| `JWT_PUBLIC_KEY` | string minimal 64 | tidak ada | PEM publik; belum validasi pasangan kriptografis |
| `JWT_PUBLIC_KEY_JWK` | string minimal 20 | tidak ada | **Sudah ada di ServerEnvSchema**; boundary Edge perlu validasi sendiri |
| `JWT_PRIVATE_KEY` | string minimal 64 | tidak ada | Signing server-only |
| `JWT_ISSUER` / `JWT_AUDIENCE` | string | sica / sica-web | Verifikasi claim mengikuti auth |
| `JWT_ACCESS_TOKEN_TTL_SEC` | int 60…86400 | 900 | TTL bukan bukti semua pencabutan grant menunggu 15 menit; cek sesi/izin tetap diperlukan |
| `JWT_REFRESH_TOKEN_TTL_SEC` | int minimal 86400 | 604800 | Default tujuh hari |
| `PASSWORD_HASH_PEPPER` | string minimal 32 | tidak ada | Deskripsi schema menyebut Argon2id; implementasi interim Scrypt, paket argon2 belum ada |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional string | tidak ada | Tidak membuktikan jalur SSO aktif |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | string minimal 10 | tidak ada | Wajib menurut parser saat ini |
| `MIDTRANS_IS_PRODUCTION` | z.coerce.boolean | false | Gap parsing string §2 |
| `XENDIT_SECRET_KEY` | optional string minimal 10 | tidak ada | — |
| `PAYMENT_WEBHOOK_SECRET` | string minimal 16 | tidak ada | Kontrak webhook di API_SPEC/INTEGRATIONS |
| `FONNTE_WHATSAPP_TOKEN` | string minimal 10 | tidak ada | Wajib parser |
| `RESEND_API_KEY` | string berawalan re_ | tidak ada | **Bukan** validasi URL |
| `EMAIL_SENDER_ADDRESS` | email | no-reply@sica.ac.id | Identitas non-secret default source |
| `STORAGE_ENDPOINT` / `STORAGE_PUBLIC_CDN_URL` | URL | tidak ada | SDK S3 belum terpasang |
| `STORAGE_BUCKET_NAME` | string minimal 3 | tidak ada | — |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` | string minimal 10 / 20 | tidak ada | Wajib parser, tetap server-only |
| `SICA_DEV_MFA_BYPASS` | enum `'0'`/`'1'` | `'0'` | **Bendera development saja (`RD-173`)**, dibaca lewat `src/lib/dev-flags.ts`. `'1'` melewati LANGKAH MFA pada login **hanya** saat `NODE_ENV=development`: tantangan `mfa_challenges` tidak dibuat dan sesi terbit dengan `amr = ['pwd']` — kelas sesi TIDAK dinaikkan, sehingga `requirePlatformWrite`/`requireAdminWriteAny` tetap menjawab `401 MFA_REQUIRED` dan `login_events.auth_method` tetap jujur (`password`). `validateEnv()` melempar sebelum validasi skema bila `'1'` berpasangan dengan `production`. Boleh ada hanya di `apps/web/.env` (gitignored); menyalinnya ke berkas env staging/production adalah insiden, bukan konfigurasi |

### 6.2 Client (`NEXT_PUBLIC_*`)

`NEXT_PUBLIC_APP_ENV` enum development/staging/production (default development); `NEXT_PUBLIC_APP_NAME` default **SICA Academic Cloud** (`apps/web/src/config/env.ts:61`); `NEXT_PUBLIC_BASE_URL` default `http://localhost:3000`; `NEXT_PUBLIC_API_URL` default `http://localhost:3000/api/v1`; `NEXT_PUBLIC_SENTRY_DSN` optional URL. Default ini bukan izin memakai localhost pada release staging/production.

### 6.3 Proposal yang belum sah diperlakukan sebagai runtime

| Nama/kelompok usulan | Status dan keputusan yang diperlukan |
|---|---|
| `RATE_LIMIT_MAX_REQUESTS_PER_MIN`, `CORS_ALLOWED_ORIGINS` | Belum parser; rate class/allowlist harus diputuskan sebelum implementasi. Jangan jadikan ENV global pengganti parameter tenant |
| `SENTRY_AUTH_TOKEN` | Secret CI build/deploy, bukan otomatis konfigurasi aplikasi |
| `TENANT_ENCRYPTION_MASTER_KEY`, `PII_BLIND_INDEX_SALT` | Belum schema; produksi menggunakan KMS/Vault, ENV hanya reference, tanpa default. Blind index secret per tenant; pilihan provider/resolver dan format envelope masih gerbang CE-5.6/P-5 |
| `NEXT_PUBLIC_SUPABASE_*` | Tidak dalam parser yang diperiksa; tidak ada klaim mengenai isi `.env` lokal |
| `ATTENDANCE_QR_TTL_SECONDS`, `ATTENDANCE_SCAN_WINDOW_SECONDS`, `ATTENDANCE_NONCE_TTL_SECONDS` | Proposal lama, bukan sumber kedua: TTL/window akademik berasal dari parameter berversi di DATA_MODEL; respons challenge mengirim nilai efektif ke kedua klien |
| `FEEDER_CONNECT_TIMEOUT_MS`, `FEEDER_READ_TIMEOUT_MS`, `FEEDER_RETRY_BASE_MS`, `FEEDER_RETRY_FACTOR`, `FEEDER_RETRY_MAX_ATTEMPTS`, `FEEDER_BREAKER_THRESHOLD`, `FEEDER_BREAKER_OPEN_SECONDS`, `FEEDER_RATE_RPS`, `FEEDER_RATE_BURST` | Belum parser; pisahkan plafon resource proses dari kebijakan tenant berversi. Nilai/retry mengikuti INTEGRATIONS, bukan default duplikat di sini |
| `BULLMQ_CONCURRENCY`, `BULLMQ_MAX_RETRIES`, `KRS_LEASE_TTL_MS` | Belum parser/paket. Worker budget perlu uji; TTL reservasi harus berasal dari satu parameter berversi, tidak diduplikasi ENV dan Redis. Dukungan namespace/topologi/secret reference memerlukan desain terpisah |
| `KRS_SSE_MAX_CONNECTIONS_PER_USER`, `KRS_SSE_HEARTBEAT_MS` | Belum parser; bounded connections/reconnect/drain wajib sebelum SSE dibuka, sesuai API_SPEC dan hasil staging |
| `APP_VERSION` | Dibaca readiness langsung, belum ada pada ServerEnvSchema; metadata build bukan secret, tetap memerlukan validasi boundary |

**Topologi Redis:** keputusan Sentinel (HA tanpa sharding) **versus** Cluster (hash-slot sharding + failover) belum final; jangan menambahkan kedua mode sebagai runtime otomatis atau menganggap `REDIS_URL` mengonfigurasi keduanya. Daftar node/service discovery, TLS/ACL, slot Lua, `noeviction`, persistensi, budget recovery dan compatible client harus disetujui sebelum schema diperluas. Satu Lua multi-key mensyaratkan satu hash slot (`ARCHITECTURE §10.3`).

### 6.4 Aturan mencegah drift
Daftar ini diselaraskan manual dengan source; generator inventaris merupakan target, bukan bukti sudah berjalan. Perubahan parser memerlukan pembaruan kontrak serta tes validasi dalam perubahan implementasi tersendiri. Jangan mengklaim enkripsi/integrasi siap hanya karena nama secret tercatat. `DEPLOYMENT_DEVOPS §4.2` membedakan cek konfigurasi dari probe dependensi nyata.

## 7. Kredensial kanal vicon dan sistem eksternal (`RD-67`)

Semua nama berikut **design-only, belum bagian ServerEnvSchema**. Mereka bukan mesin ber-API-key: engine tetap lokal tanpa egress; provider di bawah adalah transport/integrasi yang diizinkan. Jangan meminta secret untuk provider yang tidak aktif. Saat aktif tetapi secret reference/probe invalid, fail-closed/degraded sesuai kontrak API, bukan fallback credential diam-diam.

| Nama usulan | Pemilik/pemakaian | Penyimpanan dan gerbang |
|---|---|---|
| `TEAMS_TENANT_ID`, `TEAMS_CLIENT_ID`, `TEAMS_CLIENT_SECRET`, `TEAMS_NOTIFY_CLIENT_STATE` | MICROSOFT_TEAMS | Identifier server-only; secret di ENV terinjeksi/secret manager. Rotasi hanya mencatat reference/version di audit |
| `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | ZOOM | Sama; bukan credential mesin algoritma |
| `MEET_WORKSPACE_PROJECT_ID`, `MEET_SERVICE_ACCOUNT_JSON_REF` | GOOGLE_MEET | Pointer ke secret, bukan isi JSON di DB |
| `BBB_BASE_URL`, `BBB_API_SECRET` | BBB self-host | Tidak memerlukan key vendor, tetapi tetap credential transport internal |
| `JITSI_BASE_URL`, `JITSI_APP_ID`, `JITSI_APP_SECRET` | JITSI self-host | JWT moderasi server-only |
| `SISTEP_ENDPOINT`, `SISTEP_*_REF` | SISTER / M-08 | Nama mengikuti kontrak integrasi; reference scoped tenant |
| `DJKI_ENDPOINT`, `DJKI_CREDENTIAL_REF` | DJKI / M-22 | Reference; payload mengikuti INTEGRATIONS |
| `PAYMENT_VA_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_PUBLIC_KEY_REF` | Multi-VA / M-10 | Verifikasi signature dan deduplikasi sebelum rekonsiliasi |
| `PDDIKTI_FEEDER_ENDPOINT`, `PDDIKTI_FEEDER_CREDENTIAL_REF` | Neo Feeder / M-34 | Credential tenant melalui vault reference, bukan plaintext feeder_credentials |
| `TENANT_ENCRYPTION_MASTER_KEY` | Envelope PII / M-36, M-41, M-35 | Produksi KMS/Vault reference; belum parser/resolver, jangan menyatakan ciphertext siap |

DB `credential_ref` hanya pointer; secret tidak masuk `master_system_parameters` atau riwayat parameter. `CHECK (is_secret = false)` bukan pengganti pemeriksaan isi. Probe/rotasi harus menjaga sesi berjalan dan memenuhi audit/MFA/SoD sesuai izin. Alat `env-drift` dapat dipakai setelah diperiksa, tetapi laporan lama bukan hasil sesi ini; path parser yang benar adalah `apps/web/src/config/env.ts`.

## 8. Peta sesi, GeoIP, dan jaminan sosial (`RD-88`)

Bagian ini desain, bukan pengukuran “100% riil” atau daftar layanan terpasang. `sessions` serta hash `refresh_tokens` saat ini durable di PostgreSQL (`auth.service.ts:171–214`); logout/rotasi juga memakai DB. Target app stateless/shared Redis tidak memindahkan audit maupun sumber kebenaran refresh ke Redis.

| Nama usulan | Pemakaian | Batas |
|---|---|---|
| `GEOIP_DB_PATH` | Dataset GeoIP lokal berlisensi | Artifact/version lokal; tidak memanggil layanan lokasi eksternal pada request |
| `GEOIP_LICENSE_REF` | Referensi lisensi dataset | Secret manager reference; audit metadata rotasi, bukan riwayat parameter berisi secret |
| `REDIS_SESSION_URL` | Indeks aktivitas ZSET/cache revocation target | Bukan durable auth session store. Belum parser/paket; DB authoritative, outage berarti degraded, bukan online-count nol palsu |
| `SESSION_ACTIVE_WINDOW_S` | Proposal bootstrap lama | Tidak menjadi fallback akademik diam-diam. Sumber kanonik `analytics.session.active_window_s`; parameter tidak tersedia → widget degraded |
| `SSE_MAP_MAX_STREAMS_PER_USER` | Batas resource stream target | Belum parser; verifikasi dengan budget serta kontrak SSE, termasuk graceful drain |
| `SOCIAL_INSURANCE_ENDPOINT`, `SOCIAL_INSURANCE_CREDENTIAL_REF` | BPJS/SIPP/EDBU M-06 | Integrasi tenant aktif saja; reference, payload harus diverifikasi |
| `EWMP_ENDPOINT`, `EWMP_CREDENTIAL_REF` | EWMP/SISTER M-08 | Payload tetap [VERIFIKASI-VENDOR]; nama ENV tidak membuktikan skema vendor |

GeoIP menyelesaikan **IP mentah transient yang berasal dari proxy tepercaya sebelum hashing**, bukan `ip_hash` yang tidak dapat dibalik. Persist hanya lokasi kasar/bucket, source, versi dataset dan hash yang diizinkan; jangan log raw IP. GeoIP tidak memberi posisi tepat pengguna. Peta sesi menggunakan agregasi, suppression bucket kecil, retensi dan akses terbatas; kebutuhan geofence presensi dengan consent/accuracy adalah tujuan terpisah, bukan alasan melacak sesi secara presisi.

Telemetry CPU/RAM/DB/Redis dan skor Isolation Forest lokal tidak memerlukan API-key mesin. Skor anomali bersifat eksploratif, harus berversi/reproducible dan ditinjau manusia; bukan jaminan classifier malicious dan bukan pemicu auto-block tanpa kebijakan eksplisit. Kontrol operasional dan acceptance: `DEPLOYMENT_DEVOPS §6`.
