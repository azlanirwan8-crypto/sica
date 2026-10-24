# SICA REST API Specification (Dual-Platform: Web & Mobile)
**Status:** Canonical Reference  
**Version:** 1.0.0  
**Target Clients:** Next.js Web Portal (Admin/Dosen/Mahasiswa) & Flutter Mobile App (iOS/Android)  
**Security Base:** Bearer JWT (Tenant-Aware), TLS 1.3, Rate-Limited  

---

## 1. Arsitektur & Standar REST API

Seluruh endpoint REST API SICA beroperasi di bawah prefix path `/api/v1` dan mematuhi konvensi arsitektur RESTful JSON over HTTPS. Komunikasi data dua arah wajib menggunakan format UTF-8 dengan header `Content-Type: application/json`.

### 1.1 Headers Wajib Client

| Header Name | Format / Nilai | Wajib | Keterangan |
| :--- | :--- | :---: | :--- |
| `Authorization` | `Bearer <access_token>` | Ya (Kecuali Public Auth) | Token JWT RS256 berisi klaim `tenant_id`, `sub`, dan `role`. |
| `X-Tenant-ID` | UUID v4 | Ya (Semua Request) | ID institusi/kampus untuk validasi konteks multi-tenant. |
| `X-Device-ID` | String (Alphanumeric/UUID) | Ya (Mobile Client) | ID perangkat keras unik untuk validasi token presensi dan audit trail. |
| `X-App-Version` | SemVer (e.g. `1.2.0`) | Opsional | Versi aplikasi client untuk pendeteksian deprecation endpoint. |
| `X-Request-ID` | UUID v4 | Direkomendasikan | Correlation ID client untuk distributed tracing lintas microservice/log. |

**Pengecualian header (berlaku untuk tiga kelas rute saja):** `POST /api/v1/payments/webhook/:gateway` (§4.7), `GET /api/v1/public/verify/:digest` (§4.9), dan `GET /api/v1/health` + `GET /api/v1/health/ready` (§5.6) **tidak** memakai `Authorization`/`X-Tenant-ID`; pembuktinya signature kanal / digest, dan tenant diturunkan dari baris data. Respons ketiga kelas ini **tidak** dijamin berpembungkus envelope §2.1/§2.2 (health sudah terbukti mengirim bentuk lain — `apps/web/src/app/api/v1/health/route.ts:11-18`). Untuk semua rute lain, §2.1/§2.2 **wajib** dan tanpa pengecualian.

**Kelas pengecualian keempat (baru dispesifikasi 2026-10-19, `spec-only`)**: `GET /api/v1/academic/krs/stream` (§4.2.12) dan setiap badan `text/event-stream` berikutnya. Rutenya **terautentikasi** (`Authorization`/cookie tetap diminta), tetapi badannya **bukan** envelope §2.1/§2.2 — setiap event adalah fragmen JSON berdiri sendiri. Ini bukan bentuk list kedua dan tidak menyentuh kontrak §2.4; satu-satunya kelas non-envelope yang terautentikasi.

**Kelas pengecualian kelima (baru 2026-10-20, `spec-only`)**: setiap respons **`304 Not Modified`** — hari ini hanya dari `GET /api/v1/master/lookups` (§4.14.1) saat `If-None-Match` cocok. Status 304 **tidak boleh** membawa badan (RFC 9110), jadi ia **bukan** pelanggaran envelope §2.1 dan **bukan** amplop list §2.4; yang membawa informasi adalah header `ETag`, `X-Lookup-Version`, `Cache-Control`. Klien yang membaca `304` sebagai "kosong" akan mengosongkan cache-nya sendiri — itu bug klien, bukan bentuk respons kedua. Tidak ada rute lain yang diizinkan memakai 304 sampai §4.14 terbukti menurunkan beban kamus di uji beban.

**Kelas pengecualian keenam (baru 2026-10-20, `spec-only`)**: `GET /api/v1/settings/effective` (§4.16.5). Aturan yang sama persis berlaku — status 304 **tanpa body**, yang membawa informasi adalah `ETag`, `X-Parameter-Version`, `Cache-Control: private, max-age=60`. Dua rute itu (§4.14.1 dan §4.16.5) adalah **seluruh** daftar pemakai 304 di dokumen ini; `GET /me/menu` (§4.17.1) justru **`no-store`** dan karena itu tidak pernah menjawab 304, karena pohon menu adalah turunan (izin × entitlement × state) yang tidak boleh basi.

> Header identitas yang dikirim klien **tidak pernah dipercaya**: `x-tenant-id`/`x-user-id` wajib dihapus middleware sebelum disetel ulang dari klaim JWT terverifikasi (temuan SEC-07). Nilai `tenantId`/`userId`/`role`/`sessionId` di `RequestContext` berasal dari JWT RS256, dan cookie tanpa tanda tangan valid diabaikan fail-closed (`apps/web/src/lib/api-response.ts:49-80`).

---

## 2. Standard Response Envelope

Semua respons HTTP dari backend SICA dibungkus dalam skema *Standard Response Envelope* seragam, baik untuk status sukses (2xx) maupun kegagalan (4xx/5xx). Client Web dan Mobile dapat mengandalkan properti boolean `success` sebagai predikat awal pengolahan state.

### 2.1 Skema Envelope Sukses (HTTP 200, 201)

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-10-18T08:15:30.124Z",
    "requestId": "req_8f1d2c3e4a5b6789",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalRecords": 142,
      "totalPages": 8,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

*Catatan: Objek `meta.pagination` bersifat opsional dan hanya disertakan pada endpoint koleksi (list).*

### 2.2 Skema Envelope Error (HTTP 4xx, 5xx)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Payload permintaan tidak memenuhi spesifikasi skema validasi.",
    "details": [
      {
        "field": "academicYearId",
        "message": "Format UUID tidak valid."
      },
      {
        "field": "totalCredits",
        "message": "Jumlah SKS melebihi batas kuota IPK semester sebelumnya (Maks 20 SKS)."
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-18T08:15:30.130Z",
    "requestId": "req_8f1d2c3e4a5b6789"
  }
}
```

### 2.3 Inventaris Kode Error — SATU Tabel Normatif

Tabel ini adalah **satu-satunya register kode error** SICA. §4.6.5 dan §4.6.6 tidak lagi memelihara tabel paralel; keduanya hanya menunjuk ke sini dan menyebut nomor barisnya.

**Jumlah terukur: 143 kode** (65 lama + **13** milik gugus engine algoritma gelombang 1 §6.1–§6.9 + **13** milik gelombang 2 §6.10 dan objek institusi §4.6.7 + **15** milik kamus data master dinamis & atribut kustom §4.14 + **12** milik mesin parameter sistem dinamis §4.16, menu dinamis & grant §4.17, dan presensi multi-modus §4.18 + **25** milik kontrak endpoint 47 modul §7; bukan "11 asli + 6 baru = 17" yang pernah ditulis di §4.6.6 — angka naratif itu salah dan sudah dihapus). Angka ini **diukur**, tidak dihitung dari narasi: menghitung baris tabel yang berformat "pipa — nomor — pipa" dengan `grep -c` atas blok di bawah mengembalikan **143** (sebelum siklus §7 jumlahnya 118; cara yang sama dipakai `RBAC_MATRIX §4.5` untuk menghitung titik aksinya). Komposisinya:

| Gugus | Baris | Asal |
|---|---|---|
| Transport & umum | 1–10 | tabel lama §2.3 (terukur **10** baris, bukan 11) |
| Generic yang **dipakai kode tetapi belum pernah didokumentasikan** | 11–15 | `apps/web/src/lib/api-response.ts` + `auth/login` |
| Administrasi & data master | 16–25 | tabel §4.6.5 (terukur **10** baris) |
| Entitlement modul | 26–28 | prosa §4.5 |
| Gelombang enterprise | 29–35 | prosa §4.6.6 (**6** baris) + `GRADE_LOCKED_USE_CORRECTION_WORKFLOW` yang selama ini hanya hidup di tabel rute §4.6.6 |
| Dipakai/diklaim di dokumen lain, belum masuk register | 36–41 | **6** kode (`GRADE_LOCKED_…` dihitung di gugus sebelumnya) |
| KRS war asinkron (§4.2.11–§4.2.14) | 42–48 | **7** kode baru, semua `spec` — antrean belum ada di kode |
| Webhook reconcile (§4.7.7–§4.7.8) | 49–52 | **4** kode baru — menggantikan klaim lama "tidak ada kode baru untuk gugus ini" |
| Dispensasi, waiver & siklus VA (§4.10) | 53–59 | **7** kode baru; baris 53 adalah `VA_FILTER_CONFLICT` yang sejak lama diklaim milik §4.6 padahal tidak pernah ada di sana |
| Presensi QR anti-spoofing (§4.3.6–§4.3.9) | 60–64 | **5** kode baru; baris 8 dipersempit maknanya agar satu kondisi tetap satu kode |
| MBKM konversi & OBE (§4.12) | 65 | **1** kode baru |
| Engine algoritma deterministik (§6, ALG-1…ALG-7) | 66–78 | **13** kode baru — semua `spec`; tidak ada satu pun rute engine yang ada di `apps/web/src` hari ini |
| Engine gelombang 2 (§6.10, ALG-8…ALG-14) & objek institusi (§4.6.7) | 79–91 | **13** kode baru — semua `spec`; bergantung migrasi `0037`–`0046` yang **DDL-nya sudah ditulis tetapi belum dieksekusi** |
| Kamus data master dinamis & atribut kustom (§4.14) + sisa keadaan gelombang 2 yang baru terukur (§6.10, §4.6.7) | 92–106 | **15** kode baru — semua `spec`; bergantung `0047_master_lookup_engine.sql` dan `0048_custom_attributes.sql` (DDL **ditulis** 2026-10-20, **nol** berkas di `packages/database/migrations/`) dan izin yang **belum ada di register `RBAC_MATRIX §4.5` sama sekali** (lihat §4.14.6) — **ralat terukur 2026-10-20**: keduanya kini sudah menjadi baris **127–145** di register itu dengan status `usulan`, jadi klaim "belum ada sama sekali" milik baris ini sudah kedaluwarsa dan pembetulan lengkapnya ada di §4.14.6 butir 2 |
| Mesin parameter sistem dinamis (§4.16), menu dinamis & grant (§4.17), presensi multi-modus & rekonsiliasi (§4.18) | 107–118 | **12** kode baru — semua `spec`; bergantung `0049_system_parameters.sql` + `0050_menu_parameter_permissions.sql` (DDL **ditulis** 2026-10-20 di `DATA_MODEL §21.2`/`§21.7`, **nol** berkas di `packages/database/migrations/`) dan izin keluarga `settings.param.*` / `platform.menu.*` yang **belum menjadi baris mana pun** di `RBAC_MATRIX §4.5` — register itu telah memuat baris **146–161** sejak 2026-10-20 (`settings.param.*` = 146–157, `platform.menu.*` = 158–161), tetapi statusnya tetap **`usulan`** dan **nol** di `PERMISSION_SPECS` (lihat §4.16.6, §4.17.5) |
| Kontrak endpoint 47 modul (§7) | 119–143 | **25** kode baru — semua `spec`; nol handler di seluruh prefix §7 (terukur: 18 `route.ts`, semuanya di luar §7); bergantung izin `usulan` yang **belum** menjadi baris `RBAC_MATRIX §4.5` (register itu terukur berhenti di **161**), DDL `DATA_MODEL §22` untuk **14** dari 21 gugus yang belum bernama, dan dependensi `bullmq`/`ioredis`/`ws` yang **0** kemunculan di manifest — lihat §7.23 |

**Legenda angka dalam kurung (dibedakan agar tidak tertukar).** Di **§4.14, §4.16, §4.17, §4.18** dan di register ini, angka dalam kurung/penulisan "baris N" adalah **nomor baris §2.3 = kode error**. Angka untuk **izin** selalu ditulis penuh sebagai `resource.verb` dan, bila dirujuk, disebut **"izin RBAC §4.5 baris N"**. Catatan: **§6.10 dan §4.6.7 memakai konvensi sebaliknya** — angka kurung di sana (`(104)`, `(107)`, `(126)` …) adalah **nomor izin `RBAC_MATRIX §4.5`**, bukan baris §2.3. Kalau kedua ruang nomor itu bertemu di satu kalimat, tulisan **"izin"** atau **"§2.3"** wajib ada; tanpa penanda itu, baris 107 (`PARAM_OUT_OF_RANGE`) dan izin 107 (`audit.verify.view`) akan terbaca sama — dan keduanya nyata ada pada siklus ini.

**Legenda kolom "Status":**

| Penanda | Arti |
|---|---|
| `kode` | Benar-benar dikirim sebagai `error.code` oleh rute hari ini — ada bukti `file:line`. |
| `kind` | Dipakai di kode sebagai **`kind` hasil service**, tetapi layer transport memetakannya ke `error.code` generik. Wajib dinaikkan menjadi kode khusus (baris ini). |
| `kontrak` | Konstanta kontrak sudah ada di `packages/contracts`, tetapi **tidak ada call site runtime** — penegakan belum hidup. |
| `spec` | Belum pernah muncul di `apps/web/src`; murni spesifikasi (target). |

Verifikasi dilakukan dengan `grep` atas seluruh `apps/web/src` (18 route handler + service) dan `packages/contracts/src`. Kunci i18n di bawah adalah **nama target**: namespace `admin.errors.*` belum ada di `apps/web/src/locales/id.json` (namespace yang ada baru `auth`, `dashboard`, `navigation`, `landing`) — penambahan kunci ini bagian dari penutupan RD-12.

| # | HTTP | Kode | Makna & trigger | Retryable? | Kunci i18n `admin.errors.<CODE>` | Status |
|---:|---:|---|---|---|---|---|
| 1 | 401 | `UNAUTHORIZED` | JWT kedaluwarsa, tanda tangan tidak cocok, atau cookie/header `Authorization` kosong. | Tidak — ulangi setelah login ulang | `admin.errors.UNAUTHORIZED` | `kode` — `apps/web/src/lib/api-response.ts:152` |
| 2 | 401 | `MFA_REQUIRED` | Kredensial benar, tetapi akun mewajibkan tantangan MFA. | Tidak — lanjut ke `POST /auth/mfa/verify` | `admin.errors.MFA_REQUIRED` | `spec` — login hari ini menjawab `200 {requireMfa:true, mfaToken}` (`apps/web/src/app/api/v1/auth/login/route.ts:91-99`) |
| 3 | 403 | `FORBIDDEN` | RBAC menolak: izin tidak ada di penugasan aktif pemanggil. | Tidak | `admin.errors.FORBIDDEN` | `kode` — `apps/web/src/lib/api-response.ts:157` |
| 4 | 403 | `TENANT_ACCESS_DENIED` | `tenant_id` pada token ≠ tenant/subdomain request. | Tidak | `admin.errors.TENANT_ACCESS_DENIED` | `spec` — yang terkirim hari ini adalah `INVALID_TENANT` (baris 13) |
| 5 | 404 | `NOT_FOUND` | Entitas tidak ada dalam scope tenant aktif (RLS default-deny). | Tidak | `admin.errors.NOT_FOUND` | `kode` — `apps/web/src/lib/api-response.ts:162` |
| 6 | 422 | `VALIDATION_FAILED` | Payload/query/path gagal skema Zod di `packages/contracts`. | Tidak — perbaiki payload | `admin.errors.VALIDATION_FAILED` | `kode` — `apps/web/src/lib/api-response.ts:172` |
| 7 | 422 | `ACADEMIC_RULE_VIOLATION` | Aturan bisnis akademik dilanggar (bentrok jadwal, prasyarat, kuota SKS). | Tidak | `admin.errors.ACADEMIC_RULE_VIOLATION` | `spec` — jalur KRS memetakan kasus ini ke `BAD_REQUEST` (baris 11) |
| 8 | 422 | `QR_TOKEN_INVALID` | **Hanya** cacat pada token: HMAC/TOTP tidak cocok, `windowIndex` di luar toleransi, `algorithmVersion`/`keyVersion` tidak dikenal, atau token sudah dipakai. Penyebab geografis, perangkat, dan wifi **tidak** memakai baris ini lagi (lihat 60–64) — persempitan dilakukan 2026-10-19 agar satu kondisi tetap satu kode. | Ya — scan token QR berikutnya | `admin.errors.QR_TOKEN_INVALID` | `spec` — rute scan mengirim `VALIDATION_FAILED` (`apps/web/src/app/api/v1/attendance/qr/scan/route.ts:200-207`) |
| 9 | 429 | `RATE_LIMIT_EXCEEDED` | Melebihi batas laju per IP/subjek (kelas rate limit: `docs/SECURITY_COMPLIANCE.md` §2.3; angka baku lintas dokumen masih dibuka di RD-14). | Ya — backoff + hormati `Retry-After` | `admin.errors.RATE_LIMIT_EXCEEDED` | `spec` — belum ada limiter di `apps/web/src` (grep `rateLimit`/`RATE_LIMIT` = 0 hasil) |
| 10 | 500 | `INTERNAL_SERVER_ERROR` | Kegagalan internal tak tertangani; detail dirahasiakan dari publik. | Ya — backoff eksponensial (aman untuk GET) | `admin.errors.INTERNAL_SERVER_ERROR` | `kode` — `apps/web/src/lib/api-response.ts:177` |
| 11 | 400 | `BAD_REQUEST` | Permintaan tidak dapat diproses tetapi bukan salah format (mis. akun tidak tertaut profil mahasiswa, periode bukan `OPEN`). | Tidak | `admin.errors.BAD_REQUEST` | `kode` — `apps/web/src/lib/api-response.ts:147`; dipakai `apps/web/src/app/api/v1/academic/krs/submit/route.ts:56-62` |
| 12 | 409 | `CONFLICT` | State objek berubah / tabrakan keunikan (jadwal bentrok, kursi habis). | Kondisional — baca ulang state, lalu ulangi | `admin.errors.CONFLICT` | `kode` — `apps/web/src/lib/api-response.ts:167`; dipakai `krs/submit/route.ts:71-78` |
| 13 | 422 | `INVALID_TENANT` | `tenantIdentifier`/subdomain tidak dikenali. | Tidak | `admin.errors.INVALID_TENANT` | `kode` — `apps/web/src/app/api/v1/auth/login/route.ts:75` |
| 14 | 423 | `ACCOUNT_LOCKED` | Akun sementara terkunci akibat kegagalan login berulang. | Kondisional — setelah jendela unlock lewat | `admin.errors.ACCOUNT_LOCKED` | `kode` — `apps/web/src/app/api/v1/auth/login/route.ts:81` |
| 15 | 403 | `ACCOUNT_DISABLED` | Keanggotaan atau tenant berstatus nonaktif. | Tidak | `admin.errors.ACCOUNT_DISABLED` | `kode` — `apps/web/src/app/api/v1/auth/login/route.ts:83` |
| 16 | 403 | `ADMIN_SCOPE_MISMATCH` | Peran ada, tetapi scope (organisasi/prodi/kelas/periode **dan `SITE` sejak `0044`**) tidak mencakup objek. **Baris inilah** yang menampung keadaan "hak hanya di kampus cabang" — nama `SITE_SCOPE_VIOLATION` yang diminta untuk gugus multi-site **kalah** karena kondisinya identik dengan baris ini (satu keadaan = satu kode, aturan pemeliharaan butir 4); `details[].scopeKind` bernilai `SITE` + `siteId` agar layarnya tetap dapat menjelaskan. | Tidak | `admin.errors.ADMIN_SCOPE_MISMATCH` | `spec` — `holdsScoped()` tersedia tetapi belum dipanggil rute (`rbac-resolver.ts`; temuan SEC-11) |
| 17 | 403 | `CALENDAR_REGULATORY_EVENT` | Mencoba menghapus agenda wajib regulasi (BR-R9). | Tidak | `admin.errors.CALENDAR_REGULATORY_EVENT` | `spec` |
| 18 | 403 | `REOPEN_REQUIRES_APPROVAL` | Membuka kembali periode `CLOSED` tanpa persetujuan `access_change_requests` (BR-A9). | Kondisional — setelah disahkan | `admin.errors.REOPEN_REQUIRES_APPROVAL` | `spec` |
| 19 | 409 | `REFERENCE_IN_USE` | Master dirujuk transaksi; server menawarkan `deactivate` sebagai jalan keluar. Berlaku **pula** untuk item kamus §4.14 (`reference_items`) yang masih dipakai — nama `LOOKUP_ITEM_IN_USE` **kalah** sebagai kode kedua untuk keadaan yang sama; yang membedakan hanya **muatannya**: `details[]` wajib berisi dampak dari `reference_kind_usage` + query pemakaian nyata (`affectedSurfaces[]`, `affectedTables[]`, `rowCounts`, `lastUsedAt`, `remedyHref` → `deactivate`). | Tidak — gunakan `deactivate` | `admin.errors.REFERENCE_IN_USE` | `spec` |
| 20 | 409 | `MAX_PARALLEL_CLASSES_EXCEEDED` | `generate` kelas paralel melewati plafon prodi. | Tidak | `admin.errors.MAX_PARALLEL_CLASSES_EXCEEDED` | `spec` |
| 21 | 422 | `NATIONAL_CAP_TIGHTEN_ONLY` | Mencoba melonggarkan plafon SKS/masa studi nasional; hanya pengencangan yang diizinkan (NFR-R2). | Tidak | `admin.errors.NATIONAL_CAP_TIGHTEN_ONLY` | `spec` |
| 22 | 422 | `BAND_OVERLAP` | Band skala nilai tumpang tindih. | Tidak | `admin.errors.BAND_OVERLAP` | `spec` |
| 23 | 422 | `WEIGHT_SUM_NOT_100` | Jumlah bobot komposisi nilai bukan 100% (AC-NIL-4). | Tidak | `admin.errors.WEIGHT_SUM_NOT_100` | `spec` |
| 24 | 422 | `LECTURER_WORKLOAD_EXCEEDED` | Penugasan melewati beban mengajar maks 16 SKS (BR-A11). | Tidak | `admin.errors.LECTURER_WORKLOAD_EXCEEDED` | `spec` |
| 25 | 423 | `PERIOD_CLOSED` | Operasi tulis pada periode terkunci (BR-A9). | Tidak | `admin.errors.PERIOD_CLOSED` | `spec` |
| 26 | 404 | `MODULE_NOT_AVAILABLE` | Modul tenant tidak `ACTIVE`/`TRIAL`. Memotong **sebelum** pemeriksaan peran (§3.8 AGENTS). | Kondisional — setelah modul aktif | `admin.errors.MODULE_NOT_AVAILABLE` | `kontrak` — konstanta `packages/contracts/src/entitlement.ts:70`, tetapi helper `withModule` tidak punya call site di rute (temuan SEC-09) |
| 27 | 422 | `MODULE_DEPENDENCY_UNMET` | Prasyarat modul belum diaktifkan. | Kondisional — aktifkan dependensi | `admin.errors.MODULE_DEPENDENCY_UNMET` | `kode` — `apps/web/src/app/api/v1/tenant/modules/[code]/activate/route.ts:65` |
| 28 | 409 | `MODULE_IN_USE` | Modul masih menjadi prasyarat addon aktif lain. | Tidak — kecuali `force` dengan cascade | `admin.errors.MODULE_IN_USE` | `kode` — `apps/web/src/app/api/v1/tenant/modules/[code]/deactivate/route.ts:66` |
| 29 | 409 | `APPEAL_WINDOW_CLOSED` | Banding presensi diajukan melewati jendela kalender. | Tidak | `admin.errors.APPEAL_WINDOW_CLOSED` | `spec` |
| 30 | 422 | `MBKM_SKS_CAP_EXCEEDED` | Konversi SKS MBKM melewati plafon 20 SKS/semester (BR-M1). | Tidak | `admin.errors.MBKM_SKS_CAP_EXCEEDED` | `spec` |
| 31 | 409 | `GRADUATION_GATE_UNRESOLVED` | Yudisium ditolak selama gerbang (tagihan, clearance, cekal) belum bersih. | Kondisional — setelah gerbang lepas | `admin.errors.GRADUATION_GATE_UNRESOLVED` | `spec` |
| 32 | 409 | `FEEDER_BLOCKING_FINDINGS` | `push` Feeder ditahan selama ada temuan `BLOCK` (AC-FDR-2). | Kondisional — perbaiki temuan | `admin.errors.FEEDER_BLOCKING_FINDINGS` | `spec` |
| 33 | 409 | `PDDIKTI_CORRECTION_REQUIRED` | Koreksi PDM belum disetujui sebelum data dikirim. | Kondisional — setelah koreksi disetujui | `admin.errors.PDDIKTI_CORRECTION_REQUIRED` | `spec` |
| 34 | 423 | `DEKAN_SCOPE_REQUIRED` | Transisi menuntut peran `DEKAN` sementara wadah scope-nya belum ada (celah G-13). | Tidak | `admin.errors.DEKAN_SCOPE_REQUIRED` | `spec` — dipakai sampai `DEKAN` punya payung scope |
| 35 | 409 | `GRADE_LOCKED_USE_CORRECTION_WORKFLOW` | Membuka kunci nilai `EFFECTIVE` tanpa `correctionRequestId` (SoD BR-G4). | Tidak — ajukan koreksi nilai | `admin.errors.GRADE_LOCKED_USE_CORRECTION_WORKFLOW` | `spec` — belum ditegakkan; baris `LOCKED` masih dapat ditimpa (temuan SEC-02) |
| 36 | 409 | `CLASS_FULL` | Kapasitas kelas habis saat KRS disubmit (kursi tidak bebas). | Kondisional — kursi bisa bebas; atau ikut waitlist | `admin.errors.CLASS_FULL` | `kind` — `apps/web/src/modules/academic/services/krs.service.ts:74,417` dikirim sebagai `CONFLICT` (`krs/submit/route.ts:74-78`); wajib dinaikkan |
| 37 | 422 | `ACADEMIC_CREDIT_QUOTA_EXCEEDED` | Kuota SKS semester terlampaui berdasarkan IPK semester sebelumnya. | Tidak | `admin.errors.ACADEMIC_CREDIT_QUOTA_EXCEEDED` | `spec` — satu-satunya kemunculan dokumen adalah sampel di `docs/ISSUE_RESOLUTION.md:56` (dinilai belum ber-register oleh RD-12). Kode nyata memakai `kind` `QUOTA_EXCEEDED` → `BAD_REQUEST` (`krs.service.ts:72,350`) dan hasil validator internal `SKS_QUOTA_EXCEEDED` (`apps/web/src/modules/academic/services/sks-quota-validator.service.ts:205`) — keduanya naik menjadi kode ini |
| 38 | 403 | `GATE_BLOCKED` | `academic_rules.gates` / `blockades` menahan operasi (langkah 8 alur otorisasi RBAC_MATRIX §3; FR-ADM-11). Muat `details[]` + `state` §2.5 agar layar "mengapa terkunci" bisa dirender. | Kondisional — setelah tagihan/cekal bersih | `admin.errors.GATE_BLOCKED` | `spec` — `docs/RBAC_MATRIX.md:145`, `docs/BLUEPRINT_ENTERPRISE.md:695`; nol call site |
| 39 | 422 | `INVALID_UPLOAD_CATEGORY` | Kategori presign tidak ada di allowlist §4.8. | Tidak | `admin.errors.INVALID_UPLOAD_CATEGORY` | `spec` — baru berupa pseudocode `docs/INTEGRATIONS.md:358`; endpoint §4.8 belum dibuat |
| 40 | 413 | `FILE_TOO_LARGE` | Ukuran berkas melewati batas kategori §4.8. | Tidak | `admin.errors.FILE_TOO_LARGE` | `spec` — pseudocode `docs/INTEGRATIONS.md:365` |
| 41 | 403 | `NOT_YOUR_CLASS` | Dosen memproses kelas di luar `class_assignments`-nya. | Tidak | `admin.errors.NOT_YOUR_CLASS` | `spec` — `docs/SECURITY_COMPLIANCE.md:135`; kode nyata memakai `kind` `FORBIDDEN_NOT_ASSIGNED` → `FORBIDDEN` (`apps/web/src/modules/academic/services/grading.service.ts:43,84`) |
| 42 | 503 | `ENROLLMENT_ENGINE_UNAVAILABLE` | Mesin antrean KRS tidak dapat melayani: queue/Redis tidak sehat, worker finalis mati, atau seed kursi belum dimuat sebelum jendela `OPEN`. Jalur sinkron **tidak** dipakai sebagai fallback diam-diam. | Ya — hormati `Retry-After` | `admin.errors.ENROLLMENT_ENGINE_UNAVAILABLE` | `spec` — gugus §4.2.11–§4.2.14; `bullmq`/`ioredis` belum menjadi dependensi (`RD-11`, `P-6`) |
| 43 | 409 | `LEASE_CONFLICT` | Mahasiswa lain memegang lease kursi pada kelas yang sama saat submit masuk; atau lease diminta untuk kelas yang sudah dipegang lease lain oleh subjek ini. | Kondisional — baca ulang `GET /academic/krs/queue-position` | `admin.errors.LEASE_CONFLICT` | `spec` |
| 44 | 410 | `LEASE_EXPIRED` | Lease kursi kedaluwarsa sebelum submit dikonversi menjadi enrollment; klien wajib mengambil lease ulang, **bukan** mengirim ulang `opId` lama. | Ya — dengan lease baru | `admin.errors.LEASE_EXPIRED` | `spec` |
| 45 | 410 | `QUEUE_POSITION_LOST` | `opId`/posisi antrean tidak dapat lagi diselesaikan: `QUEUED` dipromosikan lalu kursi terlanjur habis, atau job masuk DLQ setelah attempts habis. | Tidak — objek sudah terminal, baca hasil | `admin.errors.QUEUE_POSITION_LOST` | `spec` |
| 46 | 409 | `DUPLICATE_SUBMIT` | `Idempotency-Key` yang sama sudah dipakai untuk payload berbeda, atau submit dengan lease yang sudah berstatus `COMMITTED`. Respons memuat `opId` asli (§4.2.13); replay **tidak pernah** menghasilkan kursi ganda. | Tidak | `admin.errors.DUPLICATE_SUBMIT` | `spec` — `grep -r "Idempotency-Key" apps/web/src` = 0 hasil hari ini |
| 47 | 409 | `KRS_NOT_SUBMITTED` | Aksi hilir (approve DPA, cetak, konversi MBKM) menuntut KRS berstatus `SUBMITTED`/`APPROVED`, tetapi state sekarang `DRAFT`/`WITHDRAWN`/`REJECTED`. | Kondisional — selesaikan SM-2 lebih dulu | `admin.errors.KRS_NOT_SUBMITTED` | `spec` |
| 48 | 403 | `NOT_YOUR_STUDENT` | Wali/DPA/staf memproses data mahasiswa di luar penugasan scope-nya (`user_role_assignments` + relasi bimbingan). Padanan `enrollment` dari baris 41. | Tidak | `admin.errors.NOT_YOUR_STUDENT` | `spec` — lapis L3/L4 §4.2.14 belum ada call site (`SEC-10`, `SEC-11`) |
| 49 | 410 | `CALLBACK_TARGET_EXPIRED` | Callback datang setelah objek target **tidak dapat lagi** diselesaikan secara normal: VA `EXPIRED`/`CANCELLED` dan dana tidak dapat dicocokkan ke tagihan mana pun. Bukan untuk replay biasa — itu tetap `200 {ignored:"REPLAY_WINDOW"}` (§4.7.6). | Tidak — terminal; dana pindah ke `SUSPENSE` | `admin.errors.CALLBACK_TARGET_EXPIRED` | `spec` — gugus §4.7.7–§4.7.8; sebelumnya §4.7 menyatakan "tidak ada kode baru untuk gugus ini" dan itu dicabut |
| 50 | 409 | `CANCEL_WINDOW_CLOSED` | Pembatalan bayar diminta melewati `tenant_settings.payment_cancellation_window_days` (§4.7.8). | Tidak | `admin.errors.CANCEL_WINDOW_CLOSED` | `spec` |
| 51 | 409 | `CANCEL_CHANNEL_NOT_ALLOWED` | Kanal pembayaran bukan `MANUAL`/`TELLER`; pembatalan hanya lewat `REFUND` API vendor (§4.7.8). | Tidak — ajukan refund | `admin.errors.CANCEL_CHANNEL_NOT_ALLOWED` | `spec` |
| 52 | 409 | `SUSPENSE_UNRESOLVED` | Menutup buku periode / melepaskan gerbang ditahan selama masih ada baris rekonsiliasi `SUSPENSE` yang belum diputuskan (`match` / `refund` / koreksi manual oleh `TREASURER`). | Kondisional — selesaikan suspense lewat `VALIDATE` | `admin.errors.SUSPENSE_UNRESOLVED` | `spec` — aturan sudah ditulis `docs/INTEGRATIONS.md:518`; belum berpindah ke register |
| 53 | 422 | `VA_FILTER_CONFLICT` | Kombinasi filter yang saling meniadakan pada pembuatan/daftar VA: `tariffGroupId` diisi bersamaan dengan `invoiceIds[]` spesifik (§4.10.3). | Tidak | `admin.errors.VA_FILTER_CONFLICT` | `spec` — **diklaim dua kali sebelum ada**: `docs/AUDIT_READINESS.md:304` menunjuk "API_SPEC §4.6" padahal §4.6 tidak pernah memuat kode ini, dan `docs/INTEGRATIONS.md:265` menandainya `[USUL]` dengan aturan wajib daftar di sini lebih dulu. Sekarang terdaftar. |
| 54 | 409 | `VA_ALREADY_USED` | VA dengan status `USED` hendak dibatalkan/diterbitkan ulang; dana sudah masuk dan hanya boleh lewat `REFUND` atau rekonsiliasi. | Tidak | `admin.errors.VA_ALREADY_USED` | `spec` |
| 55 | 409 | `DECISION_ALREADY_MADE` | Satu objek keputusan (dispensasi §4.10.1, waiver, banding presensi §4.3.8, konversi MBKM §4.12) sudah berada pada state terminal `APPROVED`/`REJECTED`/`CANCELLED` dan transisinya satu arah. | Tidak | `admin.errors.DECISION_ALREADY_MADE` | `spec` — dipakai silang oleh keempat gugus, bukan satu rute |
| 56 | 403 | `SELF_APPROVAL_FORBIDDEN` | Actor `VALIDATE` pada objek yang sama yang dia ajukan (`approverId == requesterId`) — SoD BR-K2 (dispensasi, waiver, void) dan BR-M1 (MBKM dua-approver). | Tidak | `admin.errors.SELF_APPROVAL_FORBIDDEN` | `spec` — `violatesSoD()` tersedia tetapi tidak dipanggil rute (`docs/BLUEPRINT_ROLE_BY_ROLE.md:429`, temuan `SEC-12`) |
| 57 | 422 | `WAIVER_EXCEEDS_OUTSTANDING` | Nominal keringanan/dispensasi melebihi sisa tagihan (`net_amount − paid_amount`) atau menyentuh baris ledger yang sudah `SETTLED`. | Tidak | `admin.errors.WAIVER_EXCEEDS_OUTSTANDING` | `spec` |
| 58 | 422 | `INSTALLMENT_PLAN_INVALID` | Rencana cicilan/termin tidak menutup kewajiban: jumlah termin ≠ pokok + denda, termin melewati `payment_windows.cutoff_time`, atau pola bertentangan dengan `penalty_mode`. | Tidak | `admin.errors.INSTALLMENT_PLAN_INVALID` | `spec` |
| 59 | 422 | `EXPORT_LIMIT_EXCEEDED` | Permintaan `OTHER: export` melewati plafon baris/ukuran sinkron; klien dipindah ke job ekspor asinkron (§4.10.5). | Tidak — perkecil filter atau pakai job | `admin.errors.EXPORT_LIMIT_EXCEEDED` | `spec` — `EXPORT` bukan verba kanonik; ia `OTHER` dengan resource terdaftar |
| 60 | 422 | `OUT_OF_GEOFENCE` | Hasil Haversine antara koordinat perangkat dan **koordinat ruang milik server** melewati `allowedRadiusMeters` tenant (§4.3.7). | Tidak — pindah lokasi | `admin.errors.OUT_OF_GEOFENCE` | `spec` — dipindah keluar dari baris 8; hari ini rute scan mengirim `VALIDATION_FAILED` |
| 61 | 422 | `DEVICE_INTEGRITY_FAILED` | `isMockLocation` benar, `isRooted` benar, `deviceProfile` tidak cocok dengan registrasi perangkat, atau attestation gagal. Alasan perangkat, bukan alasan token. | Tidak — hubungi pengampu kelas | `admin.errors.DEVICE_INTEGRITY_FAILED` | `spec` — dipindah keluar dari baris 8; aturan lama di §4.3.2 butir 1 memakai kode token untuk masalah perangkat |
| 62 | 409 | `SCAN_REPLAY_DETECTED` | Token/challenge pada `windowIndex` yang sama sudah pernah dikonsumsi untuk (mahasiswa, sesi) ini. Baris `attendances` tetap satu (`uq_attendances_session_student`); scan kedua **tidak** menambah presensi. | Tidak | `admin.errors.SCAN_REPLAY_DETECTED` | `spec` — `grep` kolom token di `attendances`: tidak ada (lihat §4.3.9) |
| 63 | 422 | `ROOM_GEO_UNAVAILABLE` | Ruang kelas tidak punya koordinat valid / akurasinya di luar batas sehingga radius tidak dapat dibuktikan server. **Fail-closed**: scan ditolak, bukan diloloskan karena "tidak ada data lokasi". | Kondisional — admin melengkapi `rooms` | `admin.errors.ROOM_GEO_UNAVAILABLE` | `spec` |
| 64 | 422 | `WIFI_NOT_ALLOWED` | `wifiBssid` tidak ada pada allowlist BSSID ruang (**`attendance_network_allowlists`**, `DATA_MODEL §18.6`, `0041_attendance_antifraud.sql` — ejaan `room_wifi_allowlist` yang pernah ditulis di sini **kalah** dan rujukannya dibetulkan pada §4.3.7 butir 5) ketika tenant mengaktifkan bukti wifi; atau BSSID dilaporkan berbeda dari kelas fisik yang sama. Perbandingan dilakukan pada `bssid_hash` (HMAC ber-kunci tenant), **bukan** plaintext. | Tidak | `admin.errors.WIFI_NOT_ALLOWED` | `spec` |
| 65 | 422 | `OUTCOME_MATRIX_NOT_COVERED` | `POST …/outcome-matrix/validate` menemukan CPL/CLO/CMO tanpa jalur pengukuran (tidak ada matakuliah/komponen nilai yang memetakannya) atau bobot agregasi ≠ 100%. | Tidak | `admin.errors.OUTCOME_MATRIX_NOT_COVERED` | `spec` — gugus OBE §4.12 |
| 66 | 422 | `PREREQ_CYCLE` | ALG-1: graf prasyarat memuat siklus sehingga jalur kritis tidak terdefinisi. `explain.cyclicCourses` berisi simpul pelaku. **Bukan** angka palsu. | Tidak — perbaiki `course_prerequisites` | `admin.errors.PREREQ_CYCLE` | `spec` §6.3 |
| 67 | 422 | `LAB_ALLOCATION_INFEASIBLE` | ALG-2: kendala keras tidak dapat dipenuhi pada konfigurasi saat ini. `explain.conflictCore` berisi batas minimal (ruang, sumber daya, jam) yang membuat mustahil. | Kondisional — longarkan kapasitas/shift | `admin.errors.LAB_ALLOCATION_INFEASIBLE` | `spec` §6.4 |
| 68 | 422 | `AHP_INCONSISTENT_MATRIX` | ALG-3: matriks perbandingan berpasangan menghasilkan `CR > 0.10`. Respons menyertakan pasangan baris-kolom paling menyimpang. | Tidak — perbaiki matriks | `admin.errors.AHP_INCONSISTENT_MATRIX` | `spec` §6.5 |
| 69 | 422 | `CONCENTRATION_QUOTA_UNFEASIBLE` | ALG-3: total kuota < jumlah peminat aktif, sehingga beberapa mahasiswa tidak dapat ditampung pada preferensi manapun. | Kondisional — tambah kuota/dosen | `admin.errors.CONCENTRATION_QUOTA_UNFEASIBLE` | `spec` §6.5 |
| 70 | 422 | `RETE_RULE_CYCLE` | ALG-4: kompilasi aturan mendeteksi dependensi melingkar antar fakta turunan (stratifikasi gagal). | Tidak — pecah rantai aturan | `admin.errors.RETE_RULE_CYCLE` | `spec` §6.6 |
| 71 | 422 | `RETE_UNKNOWN_FACT` | ALG-4: aturan mereferensikan `fact_key` yang tidak terdaftar di `rete_fact_types` atau tipe nilainya tidak cocok. | Tidak — daftarkan fakta lebih dulu | `admin.errors.RETE_UNKNOWN_FACT` | `spec` §6.6 |
| 72 | 422 | `REROUTE_INFEASIBLE_MINCUT` | ALG-5: max-flow < permintaan sesi tergusur. `explain.cutSide` menjelaskan ruang/slot mana yang habis (min-cut) + daftar relaksasi berjenjang. | Kondisional — terima relaksasi usulan | `admin.errors.REROUTE_INFEASIBLE_MINCUT` | `spec` §6.7 |
| 73 | 503 | `ENGINE_BUDGET_EXCEEDED` | Harness: run melampaui `maxSeconds`/`maxNodes`/`maxBacktrack`. Hasil parsial disimpan sebagai `status='FAILED'` + `stats`, tidak dipotong diam-diam menjadi "sukses". | Ya — naikkan budget atau perkecil cakupan | `admin.errors.ENGINE_BUDGET_EXCEEDED` | `spec` §6.2 |
| 74 | 409 | `ENGINE_STALE_SNAPSHOT` | `apply` ditolak: `input_snapshot_hash` run ≠ hash data saat ini (ada nilai/jadwal baru di tengah jalan). Klien wajib run ulang. | Ya — jalankan run baru | `admin.errors.ENGINE_STALE_SNAPSHOT` | `spec` §6.2 |
| 75 | 409 | `ENGINE_RUN_NOT_APPLICABLE` | Run belum `SUCCEEDED`/`NEEDS_REVIEW`, atau periode target sudah `CLOSED`/`LOCKED` sehingga penerapan tidak mungkin sah. | Tidak — buka jalur koreksi | `admin.errors.ENGINE_RUN_NOT_APPLICABLE` | `spec` §6.2 |
| 76 | 422 | `DOC_ENCRYPTED_OR_SCRIPTED` | ALG-7 intake: PDF terenkripsi, atau mengandung objek `JavaScript`/`OpenAction`/`AA`. Ditolak sebelum parsing. | Tidak — unggah salinan tanpa enkripsi/skrip | `admin.errors.DOC_ENCRYPTED_OR_SCRIPTED` | `spec` §6.8 |
| 77 | 422 | `DOC_TEMPLATE_UNRECOGNIZED` | ALG-7: tidak ada `document_templates` yang cocok dengan *fingerprint* dokumen. Sistem tidak menebak; pengguna memilih template atau mengisi manual. | Ya — pilih template/daftar template baru | `admin.errors.DOC_TEMPLATE_UNRECOGNIZED` | `spec` §6.8 |
| 78 | 422 | `EXTRACTION_REVIEW_REQUIRED` | `apply` diminta sementara masih ada field berverdict `REVIEW`/`EMPTY` yang wajib untuk tujuan (mis. `nim`, `courses[].grade`). Ukuran `auto_fill_min`/`review_min` ada di template. | Ya — konfirmasi manual field tersebut | `admin.errors.EXTRACTION_REVIEW_REQUIRED` | `spec` §6.8 |
| 79 | 422 | `TIMETABLING_INFEASIBLE` | ALG-8: kendala keras H-1…H-8 tidak dapat dipenuhi pada konfigurasi saat ini. `explain.conflictCore` memuat himpunan permintaan + kendala minimal penyebabnya, **dan** `lowerBoundSoftCostBp` (batas bawah, bukan klaim optimum). Hasil parsial karena *budget* habis **bukan** baris ini — itu `degraded:"PARTIAL_BUDGET_EXHAUSTED"` (§6.10.5). Nama `TIMETABLE_UNFEASIBLE_CORE` yang diminta untuk keadaan ini **kalah** — `conflictCore` sudah menjadi muatan baris ini, jadi tidak ada kode kedua untuk satu keadaan. | Kondisional — tambah ruang/slot, longarkan kendala lunak | `admin.errors.TIMETABLING_INFEASIBLE` | `spec` §6.10.2 — objek `0037`, migrasi belum dieksekusi |
| 80 | 422 | `MODEL_QUALITY_GATE_UNMET` | ALG-10: model tidak dapat di-`ACTIVE` atau tidak dapat dipakai men-skor bila `auc < 0.70` **atau** `brier > 0.18` **pada tenant itu sendiri**. Yang terjadi di layar: fitur turun ke **aturan keras** deterministik tanpa kata "prediksi". Penegak sebenarnya adalah `CHECK` di DB (`0039`); rute hanya memetakan sebabnya. Alias `MODEL_NOT_QUALIFIED` **kalah** — keadaannya sudah baris ini. | Tidak — latih ulang / terima mode aturan keras | `admin.errors.MODEL_QUALITY_GATE_UNMET` | `spec` §6.10.3 — objek `0039` |
| 81 | 422 | `MODEL_FEATURE_DENYLISTED` | ALG-10: `features` memuat atribut terlarang (agama, suku, kewarganegaraan, jenis kelamin, disabilitas, asal sekolah, jalur masuk, kelompok penghasilan orang tua sebagai prediktor tunggal). Ditolak **sebelum** insert, bukan disaring diam-diam; penjaga ganda di tes CI (`DATA_MODEL §18.9` butir 6). | Tidak | `admin.errors.MODEL_FEATURE_DENYLISTED` | `spec` §6.10.3 |
| 82 | 422 | `AUTOFIX_REVIEW_REQUIRED` | ALG-11: `apply` usulan auto-fix atau `push` Feeder diminta sementara masih ada baris berverdict `REVIEW`/`NO_MATCH` pada kolom wajib. `error.details[]` **per record** (`stagingTable`, `stagingId`, `recordKey`, `columnName`, `ruleCode`, `verdict`, `score`, `margin`, `remedyHref`) — **dilarang** meratakan menjadi satu pesan global "data belum bersih"; operator harus dapat membuka satu per satu. | Ya — konfirmasi per record lalu ulangi | `admin.errors.AUTOFIX_REVIEW_REQUIRED` | `spec` §6.10.4 — objek `0040`; kembar kondisi dengan baris 78 (dokumen vs Feeder) tetap dua kode karena ruang perbaikannya beda |
| 83 | 422 | `AUTOFIX_EXPR_FORBIDDEN` | ALG-11: aturan ber-`kind` `SEMANTIC`/`BLOCKING`/`IDENTITY` dikirim dengan `fix_expr` terisi. Mesin tidak boleh membubuhkan **makna**, hanya format; `CHECK` pada `0040` adalah penegak utama, rute menolak lebih dulu agar sebabnya terbaca. | Tidak — kosongkan `fix_expr` atau ubah `kind` | `admin.errors.AUTOFIX_EXPR_FORBIDDEN` | `spec` §6.10.4 |
| 84 | 422 | `GPS_ACCURACY_TOO_LOW` | ALG-12: akurasi laporan perangkat melebihi `rooms.max_accuracy_m` → vonis tersimpan `attendance_token_uses.result = 'GPS_LOW_ACCURACY'`. Jarak diuji sebagai `d − accuracy ≤ radius`, bukan `d ≤ radius`: akurasi 500 m tidak boleh "lulus" karena kebetulan dekat pusat. | Ya — tunggu fix GPS lebih baik, lalu scan jendela berikutnya | `admin.errors.GPS_ACCURACY_TOO_LOW` | `spec` §6.10.6 — objek `0041` |
| 85 | 422 | `LOCATION_UNAVAILABLE` | ALG-12: perangkat tidak memberikan koordinat sama sekali (izin lokasi mati) → `result = 'NO_LOCATION'`. **Fail-closed**: tidak pernah diloloskan karena "data lokasi tidak ada". Beda objek dengan baris 63 — itu **ruang** milik server yang tanpa koordinat, ini **perangkat**. | Ya — aktifkan izin lokasi | `admin.errors.LOCATION_UNAVAILABLE` | `spec` §6.10.6 |
| 86 | 422 | `FRAUD_SUSPECT_REJECTED` | ALG-12: `fraud_score_bp > 5000` → `result/verdict = 'REJECTED_FRAUD_SUSPECT'`, respons memuat `signals[]` + ambang + **hak banding** (§4.3.8). Pita 1500–5000 **bukan** baris ini: itu `PENDING_REVIEW` yang masuk antrean banding dengan `201` (bukan error). | Tidak — ajukan banding lewat §4.3.8 | `admin.errors.FRAUD_SUSPECT_REJECTED` | `spec` §6.10.6 |
| 87 | 422 | `CHALLENGE_FAILED` | ALG-12: tantangan-balas (`challenge_required = true`) tidak dijawab, salah, atau lewat umur 15 detik → `result = 'CHALLENGED_FAILED'`. Ini penahan "QR difoto lalu dikirim ke teman di luar kelas": penjawab jauh tidak dapat melihat `counter` berikutnya. Alias `ATTENDANCE_CHALLENGED_FAILED` **kalah** — vonis DB-nya `CHALLENGED_FAILED` (`0041`) dan kode kawatnya baris ini. | Tidak — pengampu menerbitkan tantangan baru | `admin.errors.CHALLENGE_FAILED` | `spec` §6.10.6 |
| 88 | 503 | `ATTENDANCE_TOKEN_STORE_UNAVAILABLE` | ALG-12: penahan sekali-pakai (`attendance_token_uses` dan/atau Redis) tidak terjangkau → presensi **ditolak**, **tidak pernah** diterima tanpa penahan sekali-pakai. | Ya — hormati `Retry-After` | `admin.errors.ATTENDANCE_TOKEN_STORE_UNAVAILABLE` | `spec` §6.10.6 — `ioredis` belum menjadi dependensi nyata (`RD-11`, `P-6`) |
| 89 | 422 | `OBE_TARGET_MISSING` | ALG-13: `recompute`/usul `obe_closing_actions` diminta tanpa `cpl_targets` untuk `(kurikulum, outcome, entry_year)` — selisih (`gap_bp`) tidak terdefinisi sehingga "tindak lanjut" tidak dapat berbentuk angka. Server tetap mengembalikan `coverage` + `n_missing_evidence` apa adanya, **bukan** capaian 0. | Kondisional — tetapkan target lebih dulu (`VALIDATE`) | `admin.errors.OBE_TARGET_MISSING` | `spec` §6.10.7 — objek `0042` |
| 90 | 409 | `AUDIT_CHAIN_COMPROMISED` | ALG-14: verifier (`audit_verification_runs`) menghasilkan temuan `CHAIN_GAP` / `CHAIN_BRANCH` / `HASH_MISMATCH` → partisi dibekukan, `compromised_at` terisi, alarm CRITICAL + rilis diblokir (`ARCHITECTURE §12.9`). **Tidak ada jalur repair**: menghitung ulang hash adalah pemalsuan yang sedang dideteksi. | Tidak — jalur investigasi | `admin.errors.AUDIT_CHAIN_COMPROMISED` | `spec` §6.10.8 — objek `0043` |
| 91 | 409 | `PROJECT_OUTPUT_REQUIRED` | §4.6.7: transisi Tugas Akhir ke `PASSED` ditolak selama `final_project_kinds.requires_publication` (atau `requires_prototype`/`requires_industry_agreement`) belum punya `final_project_outputs` **tervalidasi** dengan `attachment_id` bukti. `validated_by` wajib orang kedua dari pembimbing (SoD nilai). | Kondisional — unggah + validasi luaran | `admin.errors.PROJECT_OUTPUT_REQUIRED` | `spec` §4.6.7 — objek `0045`, migrasi belum dieksekusi |
| 92 | 404 | `LOOKUP_GROUP_NOT_FOUND` | §4.14.1: `?group={GROUP_CODE}` tidak cocok dengan satu pun `reference_kinds.api_group_code` **maupun** `kind`. Server **tidak** menjawab daftar kosong (kosong = "kampus belum mengisi", dibaca sebagai fitur rusak), dan **tidak** membocorkan group milik tenant lain: group yang ada tapi bukan milik pemanggil juga dijawab baris ini. `details[].suggestions[]` memuat sampai 5 `api_group_code` terdekat (Jaro-Winkler lokal, tanpa egress). | Tidak — perbaiki kode group | `admin.errors.LOOKUP_GROUP_NOT_FOUND` | `spec` §4.14 — kolom `api_group_code` ada di `0047`, berkas migrasi belum ada |
| 93 | 403 | `LOOKUP_KIND_SYSTEM_IMMUTABLE` | §4.14.2: tulis pada kamus kelas **A/A′** (`reference_kinds.is_system = true`) atau pada item `reference_items.is_system = true` — kode & struktur tidak dapat diubah, hanya label lokal (`name`/`name_en`) dan `sort_order`. Ini garis yang menjaga `permission_verb`, `enrollments.status`, kosakata payload PDDikti tetap enum tertutup (`AGENTS §3.10`, `DATA_MODEL §20.1`). Menonaktifkan item sistem pun ditolak bila `required_role` masih menunjuknya. | Tidak — ajukan perluasan lewat `tenant_custom_attributes` (§4.14.3) | `admin.errors.LOOKUP_KIND_SYSTEM_IMMUTABLE` | `spec` §4.14.2 |
| 94 | 409 | `LOOKUP_MERGE_CYCLE` | §4.14.2: `POST …/items/{id}/merge` akan membentuk rantai `merged_into_id` melingkar (A→B→A) atau menunjuk item yang sudah menyatu ke dalamnya. `CHECK ck_refitems_notself` (`0047`) hanya melarang merge ke diri sendiri, jadi siklus harus ditutup di service — **dan** server memuat rantai tereduksi (`resolvedIntoId`) supaya klien tidak menelusuri rantai sendiri. | Tidak — merge ke target ujung rantai | `admin.errors.LOOKUP_MERGE_CYCLE` | `spec` §4.14.2 |
| 95 | 422 | `CUSTOM_ATTR_TYPE_MISMATCH` | §4.14.4: nilai `attributes.{code}` tidak cocok dengan `tenant_custom_attributes.data_type` (`STRING/INT/DECIMAL/DATE/BOOL/ENUM/MULTI/URL/EMAIL/PHONE`), atau nilai ENUM/`MULTI` berisi `code` yang tidak ada di `options_kind` yang ditunjuk, atau `MULTI` melewati `max_selections` kamus. Ditolak **sebelum** JSONB ditulis — isi-mandiri tanpa tipe adalah cara fitur ini berubah menjadi tempat sampah. | Tidak — perbaiki nilai/tipe | `admin.errors.CUSTOM_ATTR_TYPE_MISMATCH` | `spec` §4.14.4 |
| 96 | 422 | `CUSTOM_ATTR_REGEX_FAILED` | §4.14.4: nilai melanggar `validation_regex` atribut (atau `validation_regex` kamus `reference_kinds` untuk kode seperti NIM/kodepos), atau `min_value`/`max_value`/`decimal_scale`/`max_length` terlampaui. `details[]` menyebut `code` atribut + pola yang diharapkan **tanpa** mengulang nilai PII pengguna. | Tidak — perbaiki format | `admin.errors.CUSTOM_ATTR_REGEX_FAILED` | `spec` §4.14.4 |
| 97 | 422 | `CUSTOM_ATTR_LIMIT_EXCEEDED` | §4.14.3: melewati plafon mesin atribut — **40 atribut `is_searchable` per `entity_type`** (pemicu `COUNT` di `DATA_MODEL §20.5` aturan 5; tanpa batas, indeks GIN per kunci menggerus jalur tulis `students` yang dipakai KRS War) atau plafon atribut aktif per tenant yang dihitung dari `tenant_quotas`. `details[]` memuat angka pembilang/penyebut dan daftar atribut `is_searchable` terlama yang dapat di-retire. | Tidak — retire-kan atribut lain atau turunkan `is_searchable` | `admin.errors.CUSTOM_ATTR_LIMIT_EXCEEDED` | `spec` §4.14.3 |
| 98 | 403 | `CUSTOM_ATTR_READONLY_FOR_ROLE` | §4.14.4: hak tingkat **field** menolak — pemanggil punya izin objek (`PATCH …/{id}/attributes` lolos L3/L4), tetapi atribut yang dituju tidak mengizinkannya: `role_edit` tidak memuat peran aktifnya, atau `student_self_editable = false` sedangkan penulisan berasal dari peran `STUDENT`, atau atribut `pii_level = 'SPECIFIC'` (menolak isi-mandiri klien), atau nilainya `SERVER_ONLY` karena hanya boleh berubah lewat impor/migrasi. Ini **bukan** baris 3 dan bukan baris 16: izin objeknya cukup, yang menolak adalah aturan per kolom (`BLUEPRINT_ROLE_BY_ROLE §0.3`). | Tidak — minta peran dengan `role_edit` | `admin.errors.CUSTOM_ATTR_READONLY_FOR_ROLE` | `spec` §4.14.4 — penegakan `FIELD_RULES` belum ada call site |
| 99 | 422 | `ENGINE_DATA_INSUFFICIENT` | **Dipakai bersama seluruh engine** (§6.3–§6.8, §6.10.2–§6.10.8): prasyarat data tidak ada sehingga hasilnya **tidak terdefinisi**, bukan buruk — `course_prerequisites`/`course_equivalencies` kosong (ALG-1/ALG-9), `lab_resource_capabilities` kosong (ALG-2), `rooms`/`lecturer_availability` kosong (ALG-8), `ml_model_versions` belum `ACTIVE` (ALG-10), `grade_components`/`assessment_indicators` kosong (ALG-13), jangkar `seq` tidak tersedia (ALG-14). Timbul hanya bila peminta meminta **angka final** (`requireComplete: true` pada run, atau `apply` atas hasil `degraded`). **Bukan** pengganti token `degraded`: mode turun tetap `200`/`201` dengan `degraded` apa adanya (§6.10.5); baris ini adalah penolakan saat mode turun dipaksa menjadi angka. `details[].missingTables[]` wajib persis, bukan "data belum lengkap". | Kondisional — lengkapi data lebih dulu | `admin.errors.ENGINE_DATA_INSUFFICIENT` | `spec` §6.2/§6.10.5 |
| 100 | 422 | `ADVISOR_QUOTA_EXCEEDED` | §6.10.3: run ALG-9 diminta melewati rasio mahasiswa per wali yang diizinkan `academic_rules` (mis. 1:200), atau `apply` penugasan wali menolak karena kuota wali pada scope itu penuh. **Bukan** baris 24 (beban mengajar SKS) dan bukan baris 37 (kuota SKS mahasiswa): ini kuota **penugasan bimbingan**, dan yang terlampaui adalah kapasitas seorang dosen, bukan kursi kelas. | Kondisional — kurangi cakupan run / tambah wali | `admin.errors.ADVISOR_QUOTA_EXCEEDED` | `spec` §6.10.3 |
| 101 | 422 | `MODEL_STALE` | §6.10.3: pemanggil meminta skor **prediktif** (`scoring:"MODEL_ONLY"`) sementara model `ACTIVE`tenant itu melewati ambang drift (`psi > 0.25` per fitur, `0039`). Yang **tidak** terjadi: diam-diam menurunkan mutu lalu tetap menyebutnya "prediksi". Yang terjadi: baris ini **atau** — bila pemanggil tidak memaksa mode — hasil tetap dikirim dengan `degraded:"MODEL_STALE"` + fallback aturan keras (§6.10.5). Dua permukaan, satu keadaan: token `degraded` adalah label keadaan di body, kode ini adalah penolakan saat label itu tidak dapat diterima. Usulan latih ulang dibuat `VALIDATE`, tidak pernah otomatis. | Kondisional — latih ulang (`academic.mlmodel.train`, 70) atau terima aturan keras | `admin.errors.MODEL_STALE` | `spec` §6.10.3 |
| 102 | 422 | `ATTENDANCE_IMPOSSIBLE_TRAVEL` | §6.10.6: jarak geodesik antara presensi sah terakhir dan scan ini mustahil ditempuh pada selisih waktunya (mis. `> 5 km` dalam `< 10 menit`, `ARCHITECTURE §12.7.3`). **Bukan** baris 86: 86 menolak karena **skor** kecurangan melampaui ambang, baris ini adalah **gerbang keras** dua titik yang tidak bergantung pada bobot. Yang wajib dijaga kejujurannya: kolom `attendance_token_uses.result` (`0041`) **tidak punya** nilai `IMPOSSIBLE_TRAVEL` — penahan itu enum tertutup milik `DATA_MODEL §18.6` — jadi vonis yang tersimpan tetap `REJECTED_FRAUD_SUSPECT` dengan sinyal `impossible_travel_m` di `attendance_fraud_findings.signals`, dan HTTP-nya baris ini. Bila vonis tersendiri diminta, itu **perluasan enum milik DATA_MODEL**, bukan keputusan dokumen ini. | Tidak — ajukan banding (§4.3.8) | `admin.errors.ATTENDANCE_IMPOSSIBLE_TRAVEL` | `spec` §6.10.6 — objek `0041` |
| 103 | 409 | `DEVICE_BINDING_CONFLICT` | §6.10.6: `installDigest` yang dibawa sudah terikat ke **keanggotaan lain** pada tenant ini (`attendance_device_bindings`, `UNIQUE (tenant_id, membership_id, install_digest)`, `0041`), atau klien mencoba mendaftar ulang digest yang sudah dipakai N perangkat berbeda. **Bukan** baris 61 (itu integritas perangkat: mock location/rooted/attestation gagal) dan bukan baris 86 (itu skor): di sini identitas perangkatnya sendiri yang bertabrakan, dan `share_count` naik sebagai **sinyal**, bukan vonis. Respons tidak pernah memuat daftar mahasiswa lain yang memakai digest itu (anti-oracle). | Tidak — hubungi Unit TI kampus | `admin.errors.DEVICE_BINDING_CONFLICT` | `spec` §6.10.6 |
| 104 | 422 | `ATTAINMENT_COVERAGE_LOW` | §6.10.7/§4.12.2: angka capaian diminta **dipublikasikan atau di-`apply`** (yudisium, laporan akreditasi, `approve` target) sementara `coverage < cpl_targets.min_coverage` (baku `0.800`). Yang **tidak** dilakukan server: menyembunyikan angkanya. Sel capaian **tetap** dihitung dan **tetap** dikirim bersama `coverage` + `nMissingEvidence` (angka di bawah ambang bukan berarti nol), hanya penerbitannya yang ditahan. **Bukan** baris 65 (matriks tidak menutup: tidak ada jalur pengukuran sama sekali) dan bukan baris 89 (target belum ada, sehingga `gapBp` tidak terdefinisi) — ketiganya sebab berbeda dengan perbaikan berbeda. | Kondisional — lengkapi bukti pengukuran lalu hitung ulang | `admin.errors.ATTAINMENT_COVERAGE_LOW` | `spec` §6.10.7 — objek `0042` |
| 105 | 409 | `TARIFF_RULE_AMBIGUOUS` | §4.6.7/§4.6.8: resolusi tarif menemukan **dua baris `ACTIVE` dengan tingkat spesifik yang sama** pada kunci mahasiswa (mis. dua baris bedanya hanya `gl_account_code`, atau satu baris dibuat sebelum `0046` sempat menegakkan `UNIQUE … COALESCE`). `UNIQUE` ber-`COALESCE` menjaga kunci penuh, tetapi **tidak** menjaga agar dua kunci berbeda tidak sama-spesifik — itu tugas service. Yang dikembalikan: kedua kandidat + `matchedKeys[]` agar operator tahu baris mana yang harus di-`RETIRED`. **Bukan** baris 53 (dua filter saling meniadakan pada permintaan klien). | Tidak — retire-kan salah satu baris | `admin.errors.TARIFF_RULE_AMBIGUOUS` | `spec` §4.6.7 — objek `0046`, tertahan `0021` (`pmb_paths`/`pmb_waves`) |
| 106 | 422 | `TARIFF_NO_MATCH` | §4.6.7/§4.6.8: **tidak ada satu pun** baris `tuition_tariff_matrix` `ACTIVE` yang menutupi (prodi, `entry_year`, `program_type`, site, jalur, gelombang, kelompok penghasilan) untuk mahasiswa itu pada tanggal tagihan. Generator tagihan **dilarang** menebak nominal terdekat atau memakai default 0 — kegagalan harus berbunyi. `details[]` memuat kunci yang dicoba + `nearestCandidates[]` + `remedyHref` ke layar matriks. **Bukan** baris 105 (di sana kandidatnya dua, di sini kandidatnya nol). | Kondisional — setujui baris tarif yang menutup | `admin.errors.TARIFF_NO_MATCH` | `spec` §4.6.7 — objek `0046` |
| 107 | 422 | `PARAM_OUT_OF_RANGE` | §4.16.2: nilai numerik di luar `[min_value, max_value]` **milik kunci itu**, terukur dari katalog `DATA_MODEL §21.3`: `attendance.totp_rotate_seconds` hanya **5–30 dan `IN (5,10,15)`**, `attendance.totp_window_steps` 0–2, `attendance.geofence_default_radius_m` 10–500, `attendance.gps_max_accuracy_m` 5–200, `attendance.online_min_join_ratio` 0,50–1,00, `attendance.min_presence_pct` 0–100, `finance.webhook_max_clock_skew_s` ≤ 300, `finance.installment_max_terms` ≤ 12, `krs.war_lease_ttl_s` 30–600. Rentang ini **tetap `CHECK` di DB** (`DATA_MODEL §21.1` kalimat penutup + CI §21.8(2)): kalau dipindah menjadi angka bebas yang dapat disunting, satu klik Admin IT dapat melemahkan kontrol anti-replay tanpa satu pun uji yang gagal. `details[]` = `parameterKey`, `sentValue`, `min`, `max`, `unit`, `riskClass`. | Tidak — kirim nilai di dalam rentang | `admin.errors.PARAM_OUT_OF_RANGE` | `spec` §4.16 — objek `0049`, berkas migrasi belum ada |
| 108 | 403 | `PARAM_READONLY` | §4.16.2: tulis pada kunci `is_editable = false`, atau pada baris yang `source_of_truth != 'PARAM'` — yaitu **indeks penemuan** belaka (`krs.withdraw_window_hours` bila rumahnya `academic_rules`, pola NIM yang rumahnya `tenant_settings.nim_format`, denda/cicilan yang rumahnya tabel struktural `payment_plans`/`academic_rules`), atau pada kolom `SERVER_ONLY` gugus ini (`riskClass`, `dataType`, `enumKind`, `version`, `requestedBy`/`approvedBy`/`approvedAt`, `isSecret`, `sourceOfTruth`). **Bukan** baris 3 dan bukan 16: izin objeknya cukup, yang menolak adalah **sifat kolom/barisnya** (hak tingkat field, `BLUEPRINT_ROLE_BY_ROLE §0.3`). | Tidak — tulis di rumah aslinya | `admin.errors.PARAM_READONLY` | `spec` §4.16 |
| 109 | 422 | `PARAM_INVALID_TYPE` | §4.16.2: nilai tidak cocok `data_type` kunci — bukan angka untuk `INT`/`DECIMAL`/`PCT`/`BP`/`SECONDS`/`METERS`, `PCT` > 100 atau `BP` > 10.000, `DATE`/`TIME`/`CRON` tidak terurai, `BOOL` selain `true`/`false` kanonik, `JSON` tidak sah, `REGEX` tidak dapat dikompilasi (`PARAM_PATTERN_INVALID` khusus untuk **pola** di `parameter_permissions`, baris 114). **Bukan** baris 6 (6 = field tak dikenal/amplop salah), **bukan** 95 (95 = nilai atribut kustom). Satu kunci satu tipe: kolom *generated* `value_num`/`value_bool`/`value_json` (`0049`) akan **gagal cast** kalau ini diloloskan, jadi penolakan di transport mencegah 500 di layer baca. | Tidak — perbaiki tipe | `admin.errors.PARAM_INVALID_TYPE` | `spec` §4.16 |
| 110 | 422 | `PARAM_ENUM_UNKNOWN` | §4.16.2: nilai untuk kunci yang punya `enum_kind` tidak ada di `reference_items(kind = enum_kind)` **pada tanggal itu**. Contoh nyata: `attendance.multi_source_policy` = `REQUIRE_ALL` ditolak karena kamus `kebijakan_rekonsiliasi` hanya berisi `ONSITE_PRIMARY · ONLINE_PRIMARY · MERGE_ANY · REQUIRE_BOTH · STRICT_LATEST` (`DATA_MODEL §21.5`). **Dua larangan tertulis di sini**: klien **dilarang** mengirim daftar nilai valid di body (sumbernya kamus §4.14; `z.enum([...])` literal untuk kunci seperti ini melanggar `AGENTS §3.10`), dan server **dilarang** menambah item kamus diam-diam supaya nilai "lulus". Kind-nya yang tidak ada → baris 92; nilainya yang tidak ada → baris ini. | Tidak — pilih dari kamus | `admin.errors.PARAM_ENUM_UNKNOWN` | `spec` §4.16 — bergantung `0047` (kind kamus) **dan** `0049` (kolom `enum_kind`) |
| 111 | 422 | `PARAM_SECRET_FORBIDDEN` | §4.16.2: nilai yang diajukan berbentuk kredensial/rahasia (DSN, `Bearer …`, kunci HMAC, API key vendor webinar, `webhook_secret` kanal pembayaran), atau body mencoba menyetel `isSecret = true` / `secretRef` / `credentialValue`. Penegak utama = `CHECK (is_secret = false)` **dan** `CHECK (source_of_truth <> 'ENV')` pada `0049` (CI §21.8(1) wajib 0 baris); baris ini adalah **sebab yang dibaca manusia**, bukan longgaran CHECK. Kredensial hanya hidup di vault/ENV (`ENV_CONTRACT`, `DATA_MODEL §21.6`). Respons **tidak pernah** mengecho nilai terkirim dan tidak pernah menuliskannya ke log. | Tidak — pasang di vault/ENV | `admin.errors.PARAM_SECRET_FORBIDDEN` | `spec` §4.16 — vault belum menjadi dependensi nyata (design-only, `RD-11`/`P-6`) |
| 112 | 409 | `PARAM_RESTART_REQUIRED` | §4.16.2: kunci berversi `requires_restart = true` — nilainya tidak dapat berlaku hot karena dibekukan saat build/bootstrap (mis. ukuran pool koneksi). Permintaan **tidak** dihitung sebagai keadaan efektif: nilai baru disimpan + ditandai `pendingRestart`, `GET /settings/effective` tetap mengirim angka **yang sedang berjalan** bersama `pendingValue`, dan respons meminta `deployRef`. Norma `DATA_MODEL §21.2`: kolom ini seharusnya `false` — `true` adalah **deviasi tercatat yang harus disertai catatan pengembang**, karena parameter yang baru berlaku setelah deploy adalah konstanta yang menyamar. | Kondisional — setelah rilis/canary | `admin.errors.PARAM_RESTART_REQUIRED` | `spec` §4.16 — design-only (butuh jalur release `DEPLOYMENT_DEVOPS §4`) |
| 113 | 409 | `PARAM_APPROVAL_REQUIRED` | §4.16.3: nilai sudah sah secara bentuk tetapi **belum boleh berlaku** — `risk_class ∈ {REGULATORY, SECURITY}` sementara `approved_by IS NULL` (CHECK `0049` + CI §21.8(5)), atau `parameter_permissions.requires_second_approver = true` dan permintaan `applyNow` dikirim tanpa persetujuan, atau kunci `SECURITY` diakses tanpa MFA sesi. Yang **tidak** terjadi: nilai tersimpan lalu terpakai diam-diam — `GET /settings/effective` tetap mengembalikan nilai **efektif terakhir**. Actor yang sama dengan pemohon ≠ baris ini, itu baris 56. | Kondisional — `…/request-approval` lalu `…/approve` | `admin.errors.PARAM_APPROVAL_REQUIRED` | `spec` §4.16 |
| 114 | 422 | `PARAM_PATTERN_INVALID` | §4.16.4: `parameter_permissions.parameter_pattern` melanggar `^[a-z][a-z0-9_]*(\.[a-z0-9_*$]+)+$` (`CHECK 0050`), tidak cocok dengan satu pun kunci terdaftar (CI §21.8(4) — "rujukan hantu" wajib 0 baris), atau pola tanpa `note` (review menolak, `DATA_MODEL §21.7` keputusan 1). Pola **tidak** boleh melintasi modul (`*.*`) dan **tidak dapat** melonggarkan `CHECK` rentang kelas `SECURITY`: rotasi TOTP tidak dapat turun di bawah 5 detik oleh pola apa pun, karena evaluasinya `parameter_permissions` kalah dari keputusan servis. | Tidak — perbaiki pola atau hapus barisnya | `admin.errors.PARAM_PATTERN_INVALID` | `spec` §4.16 — objek `0050` |
| 115 | 422 | `MENU_CYCLE` | §4.17.2: `parent_id` pada `menu_items` membentuk siklus (A→B→A) atau kedalaman pohon melewati **4** (CI `DATA_MODEL §21.8(3)`). `CHECK (parent_id <> id)` hanya menahan siklus satu langkah, jadi siklus panjang adalah tugas service + resolver rekursif — sama seperti `LOOKUP_MERGE_CYCLE` (94) menahan rantai merge kamus. Kembar **sadar**, bukan duplikasi: objeknya beda (hierarki menu vs lebur item kamus) dan ruang perbaikannya beda (tempel ulang subtree vs pilih target ujung). | Tidak — tempel di bawah akar yang sah | `admin.errors.MENU_CYCLE` | `spec` §4.17 — objek `0050` |
| 116 | 422 | `MENU_PERMISSION_UNKNOWN` | §4.17.2/§4.16.4: `menu_permissions.permission_code` atau `parameter_permissions.permission_code` tidak ada di katalog `permissions` — **222** kode terukur di `packages/contracts/src/authz.ts`. Dua tabel ini adalah **peta menu/parameter → izin**, bukan **kosakata izin**: kalau kode baru boleh lahir dari layar, `RBAC_MATRIX.md` kehilangan status sumber kebenaran (`AGENTS §3.8`, pola `RD-04`/`G-15`) dan seed `permissions` tidak pernah diaudit. | Tidak — daftarkan izin di `RBAC_MATRIX §4` lebih dulu | `admin.errors.MENU_PERMISSION_UNKNOWN` | `spec` §4.17 — bergantung `0050` |
| 117 | 422 | `EVIDENCE_INSUFFICIENT` | §4.18.3/§4.18.4: bukti yang terkumpul **tidak cukup untuk menandai hadir** sesuai kebijakan tenant. Tiga keadaan: (a) hanya laporan webinar vendor (`attendance_evidence.source = 'WEBHOOK_EVENT'`) tanpa peristiwa LMS internal — `DATA_MODEL §21.6` butir 3 melarang vendor menjadi satu-satunya oracle; (b) rasio durasi join di bawah `attendance.online_min_join_ratio` (baku 0,75) padahal diminta vonis hadir; (c) `attendance.multi_source_policy = 'REQUIRE_BOTH'` dengan satu sumber. Yang **tetap** terjadi: bukti tersimpan di `attendance_evidence` (insert-only), baris `attendances` tidak dibuat dan tidak diubah, rekonsiliasi berstatus `PENDING_REVIEW`. **Bukan** 60/63/84/85 (itu vonis geofence/ruang/akurasi/lokasi pada scan luring). | Kondisional — lengkapi bukti sumber internal, atau ajukan banding §4.3.8 | `admin.errors.EVIDENCE_INSUFFICIENT` | `spec` §4.18 — `attendance_evidence` + dua nilai `attendance_source` ada di `0049`, berkas migrasi belum ada |
| 118 | 422 | `MENU_ROUTE_KEY_UNKNOWN` | §4.17.2: `route_key` tidak ada di registri rute statis aplikasi (mis. `admin.master.periode`). Path **tidak pernah** dirakit dari string bebas: tanpa registri, "menu routing dinamis" berubah menjadi vektor penyuntikan path dan pohon layar 404. Registri adalah kode (`route_keys.ts` target), label berasal dari `navigation.*` di `id.json`/`en.json` atau `label`/`label_en` DB — **dua hal berbeda**, jangan digabung. **Bukan** 115 (itu kode izin), bukan 6 (itu field tak dikenal), bukan 39 (itu kategori presign). | Tidak — daftarkan `route_key` lebih dulu | `admin.errors.MENU_ROUTE_KEY_UNKNOWN` | `spec` §4.17 — registri rute kunci belum ada (`grep route_key apps/web/src` = 0 hasil, terukur) |
| 119 | 403 | `CROSS_MODULE_WRITE_FORBIDDEN` | §7 (seluruh gugus): rute tulis dijalankan terhadap objek milik vonis lain, atau payload mencoba menulis kolom milik pemilik objek (`PRD §5.13.2` butir 2 dan 5). **Beda dari 3**: di sini izin bisa saja ada, yang tidak ada adalah hak menulis objek orang lain; `details.ownerModule` wajib terisi. Contoh nyata: `POST /crm/applications`, `POST /procurement/receipts/{id}/create-asset`, `PUT /library/patrons/{id}/graduation-status` | Tidak — pakai endpoint sinyal pemilik objek | `admin.errors.CROSS_MODULE_WRITE_FORBIDDEN` | `spec` §7 — nol handler, diukur 18 `route.ts` seluruhnya di luar prefix §7 |
| 120 | 503 | `SIGNAL_DELIVERY_UNAVAILABLE` | §7: permintaan memancarkan sinyal lintas modul sedangkan `outbox`/`queue_operations` belum ada (`RD-11`, `P-6`). Menolak **tanpa** diam-diam menulis keadaan lokal; baris domain tidak berubah | Ya — setelah spine antrean tersedia | `admin.errors.SIGNAL_DELIVERY_UNAVAILABLE` | `spec` §7 — `bullmq` dan `ioredis` terukur 0 di keempat manifest |
| 121 | 503 | `REALTIME_CHANNEL_UNAVAILABLE` | §7.15 dan §7.21: kanal SSE atau WebSocket diminta sedangkan handler dan dependensinya nol (`ws`, `socket.io` 0 kemunculan; `text/event-stream` 0 berkas). Vonis `ARCHITECTURE §13.2` tetap: dua jalur ini **design-only** | Ya — degradasi ke polling dengan `pollAfterMs` | `admin.errors.REALTIME_CHANNEL_UNAVAILABLE` | `spec` §7 |
| 122 | 409 | `TICKET_STATE_TRANSITION_INVALID` | §7.1: transisi keadaan tiket di luar penjaga mesin keadaan helpdesk. Keadaan tiket adalah enum kelas A, jadi ini **bukan** 6: bentuk payload benar, **transisinya** yang tidak sah | Tidak — baca keadaan kini | `admin.errors.TICKET_STATE_TRANSITION_INVALID` | `spec` §7.1 — objek `0051` |
| 123 | 409 | `PAYROLL_RUN_NOT_FINAL` | §7.2: slip atau posting diminta sebelum run `APPROVED`; posting dari `DRAFT`/`CALCULATED` ditolak. Keadaan mesin M-06, bukan gerbang periode (25) | Kondisional — selesaikan `approve` lebih dulu | `admin.errors.PAYROLL_RUN_NOT_FINAL` | `spec` §7.2 — objek `0054` |
| 124 | 422 | `TAX_RULE_VERSION_INACTIVE` | §7.2: run PPh 21 menunjuk `taxRuleVersion` yang tidak `ACTIVE` pada tanggal periode gaji (kelas B berversi). **Beda dari 105/106**: satu versi diminta secara eksplisit dan ia tidak berlaku — bukan aturan ambigu atau tidak menutup | Tidak — pakai versi yang berlaku pada tanggal itu | `admin.errors.TAX_RULE_VERSION_INACTIVE` | `spec` §7.2 — `ALG-19`, `NO_TARIF_DICT` menolak menghitung |
| 125 | 409 | `SISTER_WATERMARK_REGRESSION` | §7.3 dan §7.20: delta push membawa `watermarkBefore` lebih baru dari yang tersimpan (`ARCHITECTURE §12.10`: watermark hanya maju atas baris sukses). Mencegah mata air kedua memundurkan titik sinkron | Tidak — tarik delta dari watermark tersimpan | `admin.errors.SISTER_WATERMARK_REGRESSION` | `spec` §7.3 — objek `0055` |
| 126 | 409 | `EXTERNAL_SOURCE_FIELD_READONLY` | §7.5, §7.7, §7.9, §7.11, §7.12, §7.20: klien mengirim nilai yang hanya boleh terisi dari **respons otoritas luar** (DOI, status indexing, nomor permohonan/keputusan HKI, klasifikasi BMN nasional, ISSN, nomor sertifikat prestasi, nomor registrasi SIVIL). **Beda dari 6**: bentuknya sah, kolomnya bukan milik pengirim | Tidak — rekam lewat endpoint respons pemilik | `admin.errors.EXTERNAL_SOURCE_FIELD_READONLY` | `spec` §7 — dipakai lintas gugus, satu keadaan satu kode |
| 127 | 422 | `POINTS_EVIDENCE_REQUIRED` | §7.6: usulan poin SKKM tanpa bukti terverifikasi. **Beda dari 117**: 117 = bukti ada tetapi tidak cukup; 127 = tidak ada bukti terlampir | Ya — lampirkan bukti lewat §4.8 | `admin.errors.POINTS_EVIDENCE_REQUIRED` | `spec` §7.6 — objek belum bernama di `DATA_MODEL §22` |
| 128 | 422 | `FIELDWORK_LOGBOOK_BACKDATED` | §7.7: entri logbook KKN/PKL mundur melewati jendela toleransi; toleransinya sendiri adalah parameter berversi (§4.16), bukan angka di kode | Kondisional — dalam jendela atau ajukan koreksi beralasan | `admin.errors.FIELDWORK_LOGBOOK_BACKDATED` | `spec` §7.7 |
| 129 | 403 | `CONSENT_MISSING` | §7.13, §7.17, §7.18: aksi menuntut consent yang **belum pernah** diberikan (tindakan klinis, pesan pemasaran, lamaran kerja). **Beda dari 3**: hak peran sudah ada, yang belum ada izin subjek data | Tidak — minta consent lebih dulu | `admin.errors.CONSENT_MISSING` | `spec` §7 |
| 130 | 409 | `CONSENT_WITHDRAWN` | §7.13, §7.17, §7.18: consent pernah ada lalu **ditarik**; penolakan berlaku ke depan dan tidak menghapus rekaman historis. Consent yang ditarik **mengalahkan** nilai parameter (§7.17) | Tidak — penarikan hanya dapat dicabut oleh subjek data | `admin.errors.CONSENT_WITHDRAWN` | `spec` §7 |
| 131 | 422 | `MOBILITY_DOCUMENT_EXPIRED` | §7.9: dokumen izin tinggal/paspor kedaluwarsa sebelum keberangkatan mobilitas. Nomor dokumennya sendiri tidak pernah ikut terbaca maupun ter-log | Kondisional — perbarui dokumen | `admin.errors.MOBILITY_DOCUMENT_EXPIRED` | `spec` §7.9 |
| 132 | 403 | `SPECIAL_PII_ACCESS_DENIED` | §7.10 dan §7.13: permintaan **isi** kelas data khusus UU PDP (kasus PPKS, rekam medis, catatan konseling) oleh peran yang tidak berhak — termasuk `TENANT_ADMIN` untuk kasus PPKS (`PRD §5.13.1` vonis 14, Permendikbudristek 30/2021). **Beda dari 3**: permintaannya wajib tercatat di access-log dan kodenya menunjuk kelas data, bukan tabel izin | Tidak — dan penolakannya diaudit | `admin.errors.SPECIAL_PII_ACCESS_DENIED` | `spec` §7 — wajib diuji, bukan diasumsikan aman |
| 133 | 503 | `ENVELOPE_ENCRYPTION_UNAVAILABLE` | §7.10 dan §7.13: rute yang menulis/membaca plaintext terenkripsi beramplop (DEK AES-256-GCM + kunci HMAC untuk blind index) ketika `TENANT_ENCRYPTION_MASTER_KEY` belum tersedia (`ENV_CONTRACT §6.3`). **Menolak menulis teks polos**, bukan degradasi senyap | Ya — setelah master key tersedia | `admin.errors.ENVELOPE_ENCRYPTION_UNAVAILABLE` | `spec` §7 — blocker nyata, terukur belum ada di `config/env.ts` |
| 134 | 409 | `FINE_CAP_REACHED` | §7.11: perhitungan ulang denda pustaka melewati plafon per eksemplar (`library.fine_per_day_idr` dan `max_value` plafon). Menahan akumulasi tak-berbatas, bukan menolak permintaan | Tidak — plafon kebijakan adalah penjaga | `admin.errors.FINE_CAP_REACHED` | `spec` §7.11 |
| 135 | 409 | `ASSET_ACQUISITION_IMMUTABLE` | §7.12: klien mengirim `acquisitionRupiah`, `acquisitionDate`, atau `bookValueRupiah` padahal aset lahir dari penerimaan M-46 (`PRD §5.13.1` vonis 6; zero re-entry `ARCHITECTURE §13.3`) | Tidak — kirim `acceptanceId` | `admin.errors.ASSET_ACQUISITION_IMMUTABLE` | `spec` §7.12 |
| 136 | 409 | `DEPRECIATION_PERIOD_ALREADY_POSTED` | §7.12: run atau posting penyusutan ganda untuk pasangan `(aset, periode)`. Idempoten **level baris**, bukan hanya level `Idempotency-Key` (46) | Tidak — satu posting per periode | `admin.errors.DEPRECIATION_PERIOD_ALREADY_POSTED` | `spec` §7.12 — `ALG-23` |
| 137 | 422 | `WALLET_NOT_ACADEMIC_RECEIVABLE` | §7.14: saldo dompet elektronik dipakai melunasi piutang akademik. Dua objek sadar dipisah (`PRD §5.12.1` baris M-42), jadi ini **bukan** 38 (gerbang tagihan) melainkan **salah instrumen** | Tidak — bayar lewat jalur tagihan M-10 | `admin.errors.WALLET_NOT_ACADEMIC_RECEIVABLE` | `spec` §7.14 |
| 138 | 409 | `ALREADY_CHECKED_IN` | §7.15: pemindaian ulang peserta yang sudah berstatus masuk di gate yang sama. **Beda dari 46**: 46 adalah replay `Idempotency-Key` atas satu permintaan; 138 adalah keadaan peserta yang memang sudah masuk | Tidak — keadaan akhir tidak dapat dimundur dari scanner | `admin.errors.ALREADY_CHECKED_IN` | `spec` §7.15 |
| 139 | 409 | `RESEARCH_DISBURSEMENT_STAGE_INCOMPLETE` | §7.16: pencairan tahap berikutnya sementara keluaran/monev tahap berjalan belum tervalidasi (gerbang L5 M-44). Bukan periode tertutup (25) | Kondisional — selesaikan tahap berjalan | `admin.errors.RESEARCH_DISBURSEMENT_STAGE_INCOMPLETE` | `spec` §7.16 |
| 140 | 422 | `PROCUREMENT_HPS_EXPIRED` | §7.18: paket atau penetapan memakai HPS di luar `procurement.hps_validity_days` — ambangnya hidup di parameter (§4.16), pelanggarannya tetap punya kode sendiri | Tidak — susun HPS versi baru | `admin.errors.PROCUREMENT_HPS_EXPIRED` | `spec` §7.18 |
| 141 | 422 | `ENDOWMENT_ALLOCATION_EXCEEDS_POLICY` | §7.19: alokasi dana abadi melewati porsi imbal hasil yang diizinkan `endowment.allocation_max_pct_of_yield_bp` (kelas `REGULATORY`; plafon tidak dapat dilonggarkan melewati `max_value`, `DATA_MODEL §21`) | Tidak — turunkan jumlah atau tunggu tahun fiskal | `admin.errors.ENDOWMENT_ALLOCATION_EXCEEDS_POLICY` | `spec` §7.19 — objek `0057` |
| 142 | 422 | `STATUTORY_PRECONDITION_UNMET` | §7.4 dan §7.9: syarat yang **ditetapkan regulasi negara** tidak terpenuhi (kelayakan KIP-K kelas B, plafon SKS nasional). **Beda dari 7** (`ACADEMIC_RULE_VIOLATION`, aturan kampus): penyebabnya regulasi, sehingga uji penolakannya menunjuk dasar yang benar | Tidak — penuhi syarat atau tolak secara resmi | `admin.errors.STATUTORY_PRECONDITION_UNMET` | `spec` §7 |
| 143 | 409 | `AWARD_SNAPSHOT_STALE` | §7.4: keputusan beasiswa/keringanan merujuk snapshot kelayakan (nilai + data ekonomi) yang berubah sejak run skor selesai. Padanan **non-engine** dari 74 (`ENGINE_STALE_SNAPSHOT`), karena award bukan hasil `apply` engine tetapi tetap wajib dapat direproduksi | Ya — hitung ulang skor lalu putuskan | `admin.errors.AWARD_SNAPSHOT_STALE` | `spec` §7.4 — objek `0056` |
| 144 | 501 | `MFA_NOT_IMPLEMENTED` | Tantangan MFA belum dapat diverifikasi server. Alasan terukur: `auth.service.ts:144-146` mengembalikan `mfaToken: generateOpaqueToken()` yang tidak pernah disimpan dan tidak terikat ke satu pun upaya login, sementara `auth/mfa/verify/route.ts` tidak membaca `mfaToken` dan menerima enam digit apa pun (`RD-56`, `SEC-01`). Rute **menolak total** — tanpa token, tanpa cookie, tanpa identitas — dan **tidak** menyamar jadi sukses; stub lama justru itu. Cabut 501 ini hanya setelah objek tantangan dinomori `DATA_MODEL`, `mfa_factors` punya `tenant_id`+RLS+`secret bytea` (`SC-G4-11`), TOTP dihitung server dengan jendela dari parameter dan perbandingan waktu-konstan, serta uji eskalasi dua tenant hijau. | Tidak — sampai empat syarat di kolom samping lulus | `admin.errors.MFA_NOT_IMPLEMENTED` | `spec` — hari ini rute justru fail-open; baris ini adalah kontrak **pengganti**, bukan deskripsi |
| 145 | 422 | `PARAM_VALUE_NOT_ALLOWED` | Nilai parameter bukan anggota register yang mengikatnya — kasus nyata: `conference.default_provider` di luar enum `conference_provider`, atau `conference.fallback_chain` memuat token asing/berulang (`PRD §5.15.2`, `DATA_MODEL §21.10.3`). Dibedakan dari baris 107 (`PARAM_OUT_OF_RANGE`, numerik di luar `[min_value,max_value]`): ini pelanggaran **keanggotaan**, bukan rentang | Tidak — nilai harus diperbaiki lebih dulu (bukan dikirim ulang) | `admin.errors.PARAM_VALUE_NOT_ALLOWED` | `spec` §21.10.3 (0049/0073) — belum pernah dipancarkan |
| 146 | 409 | `CONFERENCE_CONNECTION_DISABLED` | Kanal diminta (provisioning, tarik laporan, atau uji) sedangkan `conference_connections.enabled = false` atau `credential_ref` menunjuk entri kosong. Gagal-closed: tidak ada sesi di kanal hantu; layar menampilkan `CHANNEL_UNAVAILABLE`, bukan angka parsial (`BR-VIC-05`) | Tidak — aktifkan koneksi dan isi `credential_ref` lebih dulu | `admin.errors.CONFERENCE_CONNECTION_DISABLED` | `spec` §4.19 (0073) — belum pernah dipancarkan |
| 147 | 502 | `CONFERENCE_PROVIDER_UNREACHABLE` | Panggilan keluar ke kanal gagal setelah retry habis (Graph `401/403/429`, BBB `returncode`, Zoom `429`); rantai `conference.fallback_chain` dicoba berurutan dan tiap percobaan tercatat di `conference_connections.last_probe_*`. Sebab yang ditampilkan = kanal + kelas kegagalan, **bukan** isi token | Ya — dengan `Idempotency-Key` sama; rantai fallback sudah dicoba sebelum kode ini keluar | `admin.errors.CONFERENCE_PROVIDER_UNREACHABLE` | `spec` §4.19 (0073) — belum pernah dipancarkan |
| 148 | 422 | `CONFERENCE_EVIDENCE_STALE` | Bukti kanal lebih tua dari `conference.evidence_max_age_hours` (baku 24) sehingga tidak ikut vonis; barisnya tetap disimpan dengan `degraded = true` (`BR-VIC-02`, `DATA_MODEL §21.10.3` baris 28) | Tidak — tarik laporan baru; bukti lama tetap tersimpan dengan `degraded = true` | `admin.errors.CONFERENCE_EVIDENCE_STALE` | `spec` §4.19 (0074) — belum pernah dipancarkan |
| 149 | 409 | `ATTENDANCE_REVIEW_STATE_CONFLICT` | Banding presensi diajukan atau diproses pada baris `attendances` yang vonisnya sudah terkunci, atau `review_state` sudah final. Penanda `review_state` (`0074`) bukan status kehadiran, jadi negara ini butuh kode sendiri alih-alih menyuntik `PENDING_REVIEW` ke `attendance_status` (`RD-70`) | Tidak — buka banding pada sesi yang vonisnya masih terbuka | `admin.errors.ATTENDANCE_REVIEW_STATE_CONFLICT` | `spec` §4.19 (0074) — belum pernah dipancarkan |
| 150 | 409 | `TENANT_PROVISION_FAILED` | Salah satu langkah provisioning tenant gugur (domain sudah dipakai, seed 22 peran sistem gagal, `plan_id` tidak aktif, `uq_subscriptions_active` menolak langganan kedua) sehingga **seluruh** transaksi dibatalkan dan tidak ada tenant yatim (`PRD AC-PLT-1`, `DATA_MODEL §9`). Sebab yang ditampilkan = langkah yang gugur, bukan isi badan permintaan | Tidak — perbaiki sebab lalu kirim ulang dengan `Idempotency-Key` yang sama | `admin.errors.TENANT_PROVISION_FAILED` | `spec` §4.20 — belum pernah dipancarkan |
| 151 | 403 | `TENANT_SUSPENDED` | Permintaan tulis tingkat tenant diajukan sedangkan `tenants.status` = `SUSPENDED` (atau `ARCHIVED`). `GET` tetap diizinkan supaya bahan penagihan dan jejak periode lama terbaca (`BR-R12`); kosakata keadaan ada di `DATA_MODEL §15.1` dan arah transisinya di §3.1 | Tidak — sampai `platform.tenant.suspend` diarahkan balik (`RBAC §4.5.3` baris 304) | `admin.errors.TENANT_SUSPENDED` | `spec` §4.20 (`login_events` sudah memuat penanda yang sama, `DATA_MODEL §3.2`) — belum pernah dipancarkan |
| 152 | 410 | `IMPERSONATION_GRANT_EXPIRED` | Grant dukungan/impersonation dipakai setelah TTL ≤ 30 menit lewat atau setelah dicabut oleh `TENANT_ADMIN` tenant sasaran (`PRD AC-PLT-4`, `RBAC §4.5.3` baris 318). Baris jejaknya tetap ada — yang kedaluwarsa adalah haknya, bukan buktinya | Tidak — ajukan grant baru dengan alasan baru | `admin.errors.IMPERSONATION_GRANT_EXPIRED` | `spec` §4.20 — belum pernah dipancarkan |
| 153 | 422 | `PLATFORM_QUOTA_KEY_UNKNOWN` | `platform.quota.manage` mengirim kunci di luar kolom `tenant_quotas` (`DATA_MODEL §3.1`). Kuota adalah kolom bertipe dengan `CHECK`, bukan pasangan kunci-nilai bebas, jadi kunci asing adalah kesalahan pemanggil, bukan nilai yang bisa dilonggarkan | Tidak — kunci harus ada di register §3.1 | `admin.errors.PLATFORM_QUOTA_KEY_UNKNOWN` | `spec` §4.20 — belum pernah dipancarkan |
| 154 | 409 | `SEAT_LIMIT_BELOW_ACTIVE_USAGE` | Menurunkan batas `PER_SEAT` di bawah pemakaian aktif pada tenant (`entitlement.seat.manage`, `RBAC §4.5.3` baris 315). Penolakannya menyatakan angka terpakai; memutus pengguna yang sudah ada **bukan** efek dari kode ini | Tidak — naikkan batas atau kurangi pemakaian lebih dulu | `admin.errors.SEAT_LIMIT_BELOW_ACTIVE_USAGE` | `spec` §4.20 — belum pernah dipancarkan |
| 155 | 403 | `MODULE_NOT_ENTITLED` | Toggle/fitur tingkat tenant diminta menyala sedangkan modul induknya tidak `ACTIVE`/`TRIAL` di `tenant_modules` (`entitlement.*`, `FR-PLT-05`, `AC-PLT-7`). **403, bukan 404:** saklarnya memang terlihat di katalog, jadi menjawab "tidak ada" adalah kebohongan kedua; jawabannya adalah "ada, tapi tidak dilisensikan" + nama modulnya | Tidak | `admin.errors.MODULE_NOT_ENTITLED` | `spec` §4.20 — belum pernah dipancarkan |
| 156 | 422 | `LICENSE_EXCEEDS_PLAN_CEILING` | `entitlement.license.update` (390) meminta `seats` atau `valid_to` di luar plafon `plan_modules`/`subscriptions.ends_at` tenant (`AC-PLT-5`). Yang ditolak adalah **angka**, jadi respons menyebut `field` + batas yang sah — bukan pesan generik| Tidak | `admin.errors.LICENSE_EXCEEDS_PLAN_CEILING` | `spec` §4.20 — belum pernah dipancarkan |
| 157 | 409 | `PLATFORM_INVOICE_STATE_TERMINAL` | Transisi/tulis pada `platform_invoices` yang sudah `PAID` atau `VOID` (mesin keadaan §12.5 `0091`). Keadaan terminal tidak dapat dibalik; koreksi diterbitkan sebagai tagihan baru ber-`reason`, bukan dengan mengedit yang lama (BR-R12) | Tidak — terbitkan tagihan koreksi baru | `admin.errors.PLATFORM_INVOICE_STATE_TERMINAL` | `spec` §4.20 — belum pernah dipancarkan |
| 158 | 409 | `PLATFORM_PAYMENT_DOUBLE_SETTLE` | Referensi provider sudah digunakan oleh operasi pembayaran berbeda; tidak boleh membayar ulang invoice atau mengalokasikan transfer yang sama ke tenant lain. Replay `Idempotency-Key` dengan payload identik mengembalikan hasil pertama; key sama payload berbeda memakai error 12 `CONFLICT`, bukan 158 | Tidak — rekonsiliasi referensi pembayaran | `admin.errors.PLATFORM_PAYMENT_DOUBLE_SETTLE` | `spec` §4.20 — belum pernah dipancarkan |
| 159 | 401 | `MFA_CHALLENGE_STALE` | Tantangan MFA yang dipegang klien **tidak dapat dipakai lagi**: `mfa_challenges.attempts ≥ 5` (`MAX_ATTEMPTS`, `mfa.service.ts:15`) atau `expires_at` (TTL 5 menit) sudah lewat. Sebabnya bukan kode yang salah, jadi mengirim kode benar berikutnya tetap `401` — inilah yang membuat pengguna berputar pada layar yang sama. Pesan **sengaja tidak membedakan** habis-percobaan dari kedaluwarsa: tanpa itu penerka token belajar status baris tantangannya. Tidak membocorkan identitas — tantangan hanya terbit sesudah kredensial benar. | Tidak — ulangi `POST /auth/login` untuk tantangan baru | `admin.errors.MFA_CHALLENGE_STALE` | nyata 2026-10-24 — `POST /auth/mfa/verify` memancarkan kode ini; `CHALLENGE_INVALID`/`BAD_CODE`/`NO_FACTOR` tetap `401 UNAUTHORIZED` seragam |

**Aturan pemeliharaan register ini (wajib):**

1. Kode baru **lahir di tabel ini lebih dulu** (dengan HTTP, makna, retryable, kunci i18n) sebelum ditulis di service/route — sama seperti izin yang lahir di `RBAC_MATRIX.md` §4 lebih dulu (AGENTS §3.8).
2. Layer transport **dilarang** memetakannya `kind` service ke `error.code` generik bila barisnya sudah ada di tabel ini: baris 36, 37, 41 adalah utang yang harus ditutup (`errorResponse(code, …)` langsung, `apps/web/src/lib/api-response.ts:123`).
3. Status `kode`/`kind`/`kontrak`/`spec` **diukur ulang**, tidak dikutip: jalankan grep atas `errorResponse(` dan `kind: '` di `apps/web/src`, lalu sinkronkan kolom terakhir.
4. Satu kondisi = satu kode. Jangan menambah `424 MODULE_INACTIVE` untuk kondisi baris 26 (alasan yang sama dipertahankan dari §4.6.5).
5. Klien boleh otomatis retry **hanya** pada baris yang kolom "Retryable?"-nya `Ya`; `Kondisional` wajib membaca ulang state (§2.5) lebih dulu.
6. Baris **42–118** seluruhnya berstatus `spec` dan **tidak boleh dipancarkan** sebelum rutenya ada: gugus war (42–48) bergantung `bullmq`/`ioredis` nyata (`RD-11`, `P-6`), gugus keuangan (49–59) bergantung `virtual_accounts`/`reconciliation_runs` yang bahkan belum punya DDL (`docs/AUDIT_READINESS.md:179`), gugus presensi (60–64) bergantung perluasan kolom token (`§4.3.9`), gugus engine gelombang 1 (66–78) bergantung harness `0036_engine_algorithms.sql` (nomor **final** — bukan `0013`, yang telah dibatalkan sebagai harness karena bertabrakan dengan `0013_institution_gaps.sql`; registrinya `DATA_MODEL §14.7`). Gugus gelombang 2 (79–91, plus 99–106) bergantung migrasi `0037`–`0046`: **DDL-nya sudah ditulis** di `DATA_MODEL §18/§19` pada 2026-10-20, **belum ada berkasnya** di `packages/database/migrations/` (terukur: `ls` = 7 berkas, `0001`–`0006` + `0011`), dan seluruh izin pasangannya masih **usulan** — jadi tidak satu pun baris ini boleh diklaim berjalan. Gugus kamus & atribut kustom (92–98) bergantung `0047_master_lookup_engine.sql` + `0048_custom_attributes.sql` (ditulis di `DATA_MODEL §20`, **nol** berkas migrasi). **Ralat terukur 2026-10-20 untuk kalimat lama butir ini**: keluarga izin `master.kind.*`/`master.item.*`/`master.impact.view`/`master.usage.view`/`master.lookup.consume`/`settings.customattr.*` **sudah menjadi baris 127–145** di `RBAC_MATRIX §4.5` (register itu kini mencapai **161**; baris 127–145 gugus ini, 146–161 milik §4.16/§4.17 — terukur dengan `grep -cE` yang sama) — tetapi statusnya tetap **`usulan`/non-normatif** karena `packages/contracts/src/authz.ts` masih berisi **222** entri `{ key:` (terukur) dan `gen-rbac-seed.mjs` belum dijalankan ulang. Konsekuensinya tidak berubah: dilarang menulis string izin itu di rute sebelum dipromosikan (`AGENTS §3.8`). Gugus baru **107–118** bergantung `0049_system_parameters.sql` + `0050_menu_parameter_permissions.sql` (DDL **ditulis** di `DATA_MODEL §21.2`/`§21.7` pada 2026-10-20, **nol** berkas) **dan** pada izin keluarga `settings.param.*` / `platform.menu.*` yang **belum menjadi baris mana pun** di `RBAC_MATRIX §4.5` — nomor 146 ke atas masih bebas dan dipakai di §4.16.6/§4.17.5 sebagai **usulan**. Dua di antaranya (109 `PARAM_SECRET_FORBIDDEN` dan 117 `EVIDENCE_INSUFFICIENT`) menyebut **vault** dan **kanal peristiwa LMS**: keduanya **design-only** sampai dependensinya nyata, sama seperti `bullmq`/`ioredis`. Yang hari ini benar-benar terkirim tetap **12** kode (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28) — sisanya target.
7. **Kondisi yang sudah punya baris = pakai baris itu, jangan menambah kode kedua.** Gugus gelombang 2 secara sadar memakai ulang: `BAND_OVERLAP` (22) untuk pita rubrik OBE, `WEIGHT_SUM_NOT_100` (23) untuk bobot indikator/Sub-CPMK, `CONFLICT` (12) untuk tabrakan kunci matriks tarif & slot ketersediaan dosen, `REFERENCE_IN_USE` (19) untuk site yang masih punya ruang aktif, `CLASS_FULL` (36) & `ACADEMIC_CREDIT_QUOTA_EXCEEDED` (37) untuk penyaringan kelayakan ALG-9, `ENROLLMENT_ENGINE_UNAVAILABLE` (42) untuk gerbang antrean KRS, `DECISION_ALREADY_MADE` (55) dan `SELF_APPROVAL_FORBIDDEN` (56) untuk **seluruh** aksi `VALIDATE` (kendala jadwal, jenis TA, target CPL, model ML, matriks tarif, konfirmasi identitas Feeder), `EXPORT_LIMIT_EXCEEDED` (59) saat hasil engine terlalu panjang untuk HTTP, `VA_FILTER_CONFLICT` (53) untuk filter tarif yang saling meniadakan, `SCAN_REPLAY_DETECTED` (62) untuk vonis `REJECTED_REPLAY`, `OUT_OF_GEOFENCE` (60) untuk `OUT_OF_FENCE`, `ACADEMIC_RULE_VIOLATION` (7) untuk aturan lintas field `program_type`/`delivery_mode`. Baris **79–118 hanya berisi kondisi yang benar-benar baru**. Gugus §4.14 (kamus & atribut kustom) memakai ulang dengan cara yang sama: `NOT_FOUND` (5) untuk id item/atribut di luar tenant, `VALIDATION_FAILED` (6) untuk field tak dikenal pada Zod `strict()` **dan** untuk `entity_type` yang belum punya kolom `attributes` (lihat §4.14.4), `CONFLICT` (12) untuk tabrakan `UNIQUE (tenant_id, kind, code)` kamus dan `UNIQUE (tenant_id, entity_type, code)` atribut, `REFERENCE_IN_USE` (19) untuk item/kamus yang dirujuk, `SELF_APPROVAL_FORBIDDEN` (56) untuk aktivasi empat-mata atribut, `DECISION_ALREADY_MADE` (55) untuk atribut yang sudah `ACTIVE`/`RETIRED`, `ADMIN_SCOPE_MISMATCH` (16) untuk scope `SITE`, `FORBIDDEN` (3) bila izin belum ada — dan **tidak menambah kode** untuk keadaan-keadaan itu. Gugus §4.16–§4.18 melakukan hal yang sama: memakai ulang baris yang sudah ada, bukan menambah kode kedua, untuk semua keadaan berikut. `VALIDATION_FAILED` (6) untuk field tak dikenal pada body/query, `NOT_FOUND` (5) untuk `parameterKey` yang tidak terdaftar pada tenant (dan untuk `menuId`/`parentId`/`provider` lintas tenant — **bukan** 403, agar keberadaan objek tidak bocor), `CONFLICT` (12) untuk `If-Match`/`version` yang tidak cocok pada `PUT …/system-parameters/{key}` dan tabrakan `UNIQUE (tenant_id, module_code, parameter_key)` serta `UNIQUE (tenant_id, layer, code)` menu, `FORBIDDEN` (3) untuk izin kelas parameter yang tidak dimiliki actor, `SELF_APPROVAL_FORBIDDEN` (56) untuk `approve` oleh penulis nilai itu sendiri, `DECISION_ALREADY_MADE` (55) untuk `approve`/`revert` atas permintaan yang sudah terminal, `MODULE_NOT_AVAILABLE` (26) untuk menu yang modulnya non-`ACTIVE` (entitlement memotong lebih dulu dari role), `UNAUTHORIZED` (1) untuk signature webhook LMS gagal (preseden sama dengan §4.7.2), `DUPLICATE_SUBMIT` (46) untuk replay `Idempotency-Key` dengan payload berbeda, `RATE_LIMIT_EXCEEDED` (9) untuk laju peristiwa LMS yang melewati batas kanal, dan `PERIOD_CLOSED` (25) untuk tulis rekonsiliasi pada periode `LOCKED`.

8. **Register alias yang kalah (2026-10-20).** Nama-nama yang diminta dari luar dokumen ini **tidak** dibuat menjadi kode kedua ketika keadaannya sudah punya baris; yang terjadi adalah baris yang ada diperluas maknanya secara tertulis, dan ejaan yang kalah dicatat di sini supaya tidak muncul lagi sebagai rute/enum kedua:

| Diminta | Pemenang | Alasan |
|---|---|---|
| `LOOKUP_ITEM_IN_USE` | **19** `REFERENCE_IN_USE` | Keadaan yang sama (master dirujuk transaksi) sudah punya baris; yang berbeda hanya **muatan dampak** dari `reference_kind_usage`, dan itu ditambahkan ke baris 19, bukan menjadi kode baru |
| `SITE_SCOPE_VIOLATION` | **16** `ADMIN_SCOPE_MISMATCH` | Baris 16 sudah enumerasi_kind scope dan hanya perlu menambah `SITE` (`0044`); membuat kode per-jenis-scope berarti satu kondisi punya N kode |
| `TIMETABLE_UNFEASIBLE_CORE` | **79** `TIMETABLING_INFEASIBLE` | `explain.conflictCore` adalah muatan baris 79, bukan keadaan kedua |
| `MODEL_NOT_QUALIFIED` | **80** `MODEL_QUALITY_GATE_UNMET` | Satu ambang mutu (AUC/Brier) = satu kode |
| `ATTENDANCE_CHALLENGED_FAILED` | **87** `CHALLENGE_FAILED` | Vonis DB-nya `CHALLENGED_FAILED` (`0041`, enum tertutup milik DATA_MODEL); kode kawat tidak boleh meniru ulang ejaan kolom |
| `ENGINE_BUDGET_EXCEEDED` | **73** (sudah terdaftar sejak gelombang 1) | Dipakai ulang oleh ALG-8/9/10/11/13/14, bukan didaftarkan dua kali |
| `AUDIT_CHAIN_COMPROMISED` | **90** (sudah terdaftar) | Barisnya sudah ada sejak gelombang 2 didaftarkan; tidak ada tambahan |
| `room_wifi_allowlist` (nama tabel) | **`attendance_network_allowlists`** (`DATA_MODEL §18.6`, `0041`) | Nama fisik milik pemilik skema; rujukannya dikoreksi di baris 64, §4.3.7 butir 5, dan §6.10.6 |
| `PARAM_VERSION_CONFLICT` | **12** `CONFLICT` | `If-Match`/`version` tidak cocok pada `PUT …/system-parameters/{key}` adalah keadaan "state objek berubah" yang sudah punya baris; yang berbeda hanya muatannya (`currentVersion`, `sentVersion`) |
| `PARAM_NOT_REGISTERED` | **5** `NOT_FOUND` | Kunci yang tidak terdaftar pada tenant **tidak** boleh dibedakan dari kunci milik tenant lain — membedakan keduanya adalah oracle keberadaan (pola anti-IDOR §4.11 butir 3) |
| `MENU_PARENT_NOT_FOUND` | **5** `NOT_FOUND` | `parentId` tak dikenal di luar tenant menjawab 400/403 = membocorkan keberadaan menu tenant lain |
| `WEBHOOK_SIGNATURE_INVALID` | **1** `UNAUTHORIZED` | Preseden **sudah ada dan sudah divonis** di §4.7.2 butir "signature gagal tetap baris 1"; kanal LMS memakai hukum yang sama, tidak membuat kode kedua |
| `WEBHOOK_CLOCK_SKEW` (sebagai kode error) | **pola ACK §4.7.3** + `EVIDENCE_INSUFFICIENT` (117) di permukaan pembacaan | `X-Webhook-Timestamp` di luar `finance.webhook_max_clock_skew_s` di-**ACK** `200 {ignored:"CLOCK_SKEW"}` **tanpa mutasi** karena mengirim `4xx` membuat vendor retry selamanya (§4.7.3 alasan persis sama); keadaan "bukti tidak cukup untuk hadir" yang dibaca operator/laporan itulah yang menjadi baris 117 |
| `MENU_PERMISSION_MISSING` | **116** `MENU_PERMISSION_UNKNOWN` | Yang bermasalah adalah **kode izin tidak dikenal**, bukan izin tidak dimiliki; "tidak dimiliki" sudah dijawab baris 3 dan disaring di §4.17.1 |
| `LOOKUP_ENUM_ITEM_MISSING` | **110** `PARAM_ENUM_UNKNOWN` (nilai) / **92** `LOOKUP_GROUP_NOT_FOUND` (kind) | Keadaan kamus sudah punya dua baris menurut **objek yang hilang**; menambah varian ketiga per-pemanggil hanya mengabdi pada bentuk permintaan, bukan pada sebab |

---

### 2.4 Kontrak List (satu amplop, satu set parameter) — NORMATIF

Sebelum §2.4 ini ada, dokumen ini memuat **dua kontrak list yang saling eksklusif**: `meta.pagination{page,limit,totalRecords,totalPages}` di §2.1 dan `page/pageSize/sort/q` + `meta.total`/`meta.auditId` di §4.6. Yang benar adalah yang pertama — ia yang diimplementasi (`apps/web/src/lib/api-response.ts:93-109`, `packages/contracts/src/envelope.ts:27-34`). §2.4 ini menetapkan varian pertama sebagai **satu-satunya kontrak list** dan **menghapus** varian kedua.

**(a) Amplop list — bentuk kanonik**

List **selalu** mengembalikan `data` berupa array dan paginasi **selalu di dalam `meta.pagination`** (bukan `meta` di level atas, bukan `meta.total`, bukan `items`/`results`):

```json
{
  "success": true,
  "data": [ /* …baris… */ ],
  "meta": {
    "timestamp": "2026-10-19T08:15:30.124Z",
    "requestId": "req_8f1d2c3e4a5b6789",
    "pagination": {
      "page": 1,
      "limit": 25,
      "totalRecords": 61,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    },
    "auditId": null
  }
}
```

Bentuknya identik `PaginationMetaSchema` (`packages/contracts/src/envelope.ts:27-34`) + `MetaResponseSchema` (`:38-42`). `meta.auditId` **opsional**: ada hanya pada respons mutasi yang menulis `audit_logs` (§4.6 butir 5), tidak pernah pada list baca.

**(b) Set parameter query — seragam untuk semua endpoint koleksi**

| Parameter | Tipe | Default | Aturan |
|---|---|---|---|
| `page` | int ≥ 1 | `1` | Halaman yang diminta. |
| `limit` | int 1–100 | `20` | Plafon 100 ditegakkan Zod; nilai di atas 100 → `422 VALIDATION_FAILED`, bukan dipotong diam-diam. |
| `sortBy` | string | — | **Wajib divalidasi terhadap allowlist kolom per resource** (lihat (d)). |
| `sortDir` | `asc` / `desc` | `asc` | Hanya dua nilai ini; `asc`/`ASC`/`ascending` ditolak. |
| `q` | string | — | Pencarian bebas, **disanitasi + diparameterkan** (lihat (e)). |
| *(filter per resource)* | — | — | Ditambah lewat `PaginationQuerySchema.extend({…})` — contoh: `periodId`, `dayOfWeek`, `programId`, `jenjang`, `status`. Nama filter = nama field DTO (camelCase), bukan nama kolom DB. |

```typescript
// packages/contracts/src/envelope.ts — kontrak kanonik list
export const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().min(1).max(64).optional(),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().min(1).max(120).optional(),
});
export type ListQuery = z.infer<typeof ListQuerySchema>;

/** Setiap resource MENDAFTARKAN allowlist-nya sendiri; tanpa entri = tidak bisa diurutkan. */
export const SORTABLE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'admin/study-programs': ['code', 'name', 'accreditationStatus', 'isActive'],
  'admin/rooms':            ['code', 'name', 'capacity', 'roomType'],
  'academic/open-classes':  ['courseCode', 'className', 'remainingQuota'],
};
```

**(c) Varian yang dihapus (deprecated — jangan dipakai untuk rute baru maupun lama)**

| Bentuk lama | Status | Pengganti |
|---|---|---|
| `?pageSize=` | **DEPRECATED** | `?limit=` |
| `?sort=name,-createdAt` (gabungan kolom+arah dalam satu parameter) | **DEPRECATED** | `sortBy` + `sortDir` terpisah |
| `meta.page`, `meta.pageSize`, `meta.total` di level atas | **DEPRECATED** | `meta.pagination.{page,limit,totalRecords,totalPages}` |
| `?search=` | **DEPRECATED** (nama implementasi lama) | `?q=` |
| `sortOrder` | **DEPRECATED** (nama implementasi lama) | `sortDir` |
| `data.items` / `data.results` + paginasi bersarang di `data` | **DILARANG** | `data` array murni + `meta.pagination` |

**(d) Aturan allowlist `sortBy` (anti injeksi ORDER BY)**

- Nilai `sortBy` **tidak pernah** lolos sebagai teks bebas ke SQL. Transport memvalidasi `sortBy ∈ SORTABLE_FIELDS[resource]`; di luar itu → `422 VALIDATION_FAILED` dengan `details[].field = "sortBy"`.
- Pemetaan ke kolom dilakukan lewat **lookup tabel → kolom** (kamus statis), bukan `ORDER BY ${sortBy}`. Kolom turunan yang tidak ada di proyeksi (mis. `fullName` dari `first_name`+`last_name`) wajib didaftarkan sebagai ekspresi tetap di kamus, bukan dirakit dari input.
- Query dengan `sortBy` tidak dikenal **gagal tertutup** (422), bukan jatuh ke urutan default tanpa peringatan.
- Sort wajib disertai urutan tie-breaker implisit (`id` sebagai pembanding terakhir) agar paginasi deterministik.

**(e) Aturan `q` (anti injeksi ILIKE)**

- `q` **selalu** diparameterkan: `WHERE … ILIKE '%' || $1 || '%'`. Dilarang merakit string (`'%' + q + '%'`, template literal, atau `sql.raw`).
- Karakter pola (`%`, `_`, `\`) di-escape sebelum masuk `ILIKE`, sehingga `q=100%` dicari sebagai teks harfiah.
- Panjang `q` dibatasi 1–120 karakter (Zod) dan dipangkas; spasi ujung tidak dihitung.
- Kolom yang ikut dicari ditetapkan server per resource (mis. prodi: `code`, `name`, `pddikti_code`) — klien tidak bisa menyaring kolom sembarang, termasuk kolom PII yang di-masking untuk peran itu (§4.6 `students`/`student-biodata`).
- Bila indeks belum mendukung `ILIKE` bebas, batasi `q` ke `limit` kecil dan jadwalkan indeks `pg_trgm` (lihat `DATA_MODEL.md` §13); `EXPLAIN (ANALYZE, BUFFERS)` atas query ber-`q` adalah gate CI.

**(f) Δ yang harus ditutup di kode (diukur 2026-10-19, bukan diasumsikan)**

| Fakta di kode | Konsekuensi |
|---|---|
| `PaginationQuerySchema` memakai nama `search` + `sortOrder` (`packages/contracts/src/envelope.ts:14-20`), bukan `q` + `sortDir` | Renamai ke `q`/`sortDir` (satu PR, codegen Web+Flutter ikut). Selama transisi, **server menerima `search`/`sortOrder` sebagai alias** dan menjawab dengan `meta.pagination` yang benar; alias tidak pernah didokumentasikan sebagai kontrak. |
| Satu-satunya rute list yang jalan hari ini (`GET /academic/krs/open-classes`) memakai `search` dan **tidak** menyortir sama sekali (`apps/web/src/app/api/v1/academic/krs/open-classes/route.ts:30-60`) | Rute itu harus ikut kontrak §2.4 saat dipindah ke DB (bukan mock). |
| Tidak ada satu pun rute yang mengirim `pageSize`/`sort` di sisi server; `pageSize` hanya state grid klien (`apps/web/src/components/ui/velzon-data-grid.tsx:51`) | Contoh di §4.6.1 sudah dikoreksi ke bentuk baru; jangan menyalin ulang bentuk lama dari riwayat dokumen. |

**(g) Larangan lain**

- Satu endpoint **tidak boleh** mengembalikan bentuk paginasi berbeda dari bentuk di atas, termasuk seluruh `/admin/*`. Pengecualian hanya kelas rute yang disebut di §1.1 (webhook §4.7, verifikasi publik §4.9, health §5.6, dan badan SSE §4.2.12) — dan keempatnya **tidak** berpaginasi sama sekali, jadi tidak ada bentuk kedua.
- List **tidak boleh** membaca replica bila hasilnya akan dipakai untuk menulis (read-your-writes, AGENTS §3.7).
- Endpoint yang tidak berpaginasi (mis. `GET /tenant/modules`) wajib mengembalikan array penuh dan **tanpa** `meta.pagination`; kehadiran `meta.pagination` berarti kontrak menuntut paginasi.

---

### 2.5 Kontrak Tampilan State Machine

**Aturan dasar:** setiap halaman transaksional (KRS, nilai, tagihan, yudisium, feeder) merender strip statusnya (`StateMachineStrip`, `docs/UI_UX_DESIGN.md` §9.7) **dari field yang dikirim server** — bukan dari tebakan UI. UI tidak pernah menyimpulkan "tombol ini pasti boleh ditekan": kalau server tidak mendaftarkan transisinya, tombol tidak dirender. Kontrak ini adalah jawaban FR-ADM-11 ("mengapa terkunci", bukan pesan generik).

Skema `StateMachineViewSchema` (target: `packages/contracts/src/state-machine.ts`; **status: dispesifikasi, belum ada**):

```typescript
export const StateMachineTransitionSchema = z.object({
  action: z.string().min(2).max(64)                       // id transisi, mis. 'krs.submit', 'grade.unlock'
    .describe('Aksi kanonik; harus punya baris izin di RBAC_MATRIX §4'),
  permission: z.string()                                  // 'resource.verb' terukur, mis. 'enrollment.krs.submit'
    .describe('Izin yang ditanyakan server untuk aksi ini'),
  enabled: z.boolean(),
  blockedBy: z.array(z.object({
    code: z.string(),                                     // kode dari §2.3, mis. 'GATE_BLOCKED'
    reason: z.string(),                                   // kalimat sebab, sudah terlokalisasi server-side
    remedyHref: z.string().nullable()                     // tautan perbaikan; null bila tidak ada jalur mandiri
  })).default([]),
});

export const StateMachineViewSchema = z.object({
  resource: z.object({ type: z.string(), id: z.string().uuid() }),
  machine: z.enum(['SM-1','SM-2','SM-3','SM-4','SM-5','SM-6','SM-7','SM-8']),
  state: z.string().describe('State sekarang, enum DB apa adanya (mis. OPEN, SUBMITTED, LOCKED)'),
  allowedTransitions: z.array(StateMachineTransitionSchema).default([]),
  actorNext: z.object({
    roleCode: z.string(),                                 // roles.code, mis. 'TREASURER', 'ADVISER'
    scope: z.object({
      kind: z.enum(['TENANT','ORG','PROGRAM','CLASS','PERIOD','SELF']),
      id: z.string().uuid().nullable(),
    }),
    displayName: z.string().nullable().describe('Boleh null bila identitas berikutnya bukan PII pemanggil'),
    waitingSince: z.string().datetime().nullable(),
  }).nullable().describe('Siapa yang harus bertindak berikutnya; null bila objek sudah terminal'),
});

export type StateMachineView = z.infer<typeof StateMachineViewSchema>;
```

**Aturan penegakan**

1. `allowedTransitions[]` dihitung server dengan **lapis yang sama dengan guard tulis** (izin + scope + state periode + gerbang + cekal). Daftar ini bukan hasil filter menu di klien.
2. Transisi yang **tidak** tersedia tetap boleh muncul di daftar dengan `enabled: false` + isi `blockedBy[]` — itu justru isi layar "mengapa terkunci". Transisi yang sama sekali tidak punya baris izin **tidak muncul**, bukan muncul lalu ditolak.
3. `blockedBy[].code` wajib anggota register §2.3 (tidak ada kode liar). `reason` memakai pesan yang sama dengan `admin.errors.<CODE>` agar strip dan toast konsisten.
4. `remedyHref` adalah **route path aplikasi** (mis. `/keuangan/tagihan/:invoiceId`), bukan URL absolut dari klien.
5. View ini muncul di respons **detail** (`data.stateMachine`) dan di endpoint baca khusus `GET /api/v1/state-machine/:type/:id`. Daftar (list) tidak membawa view ini — terlalu mahal; layar list hanya memakai `state`.
6. Mutasi yang berhasil mengembalikan view terbaru (bukan `204`), sehingga UI tidak menegakkannya sendiri.
7. Nilai `state` memakai enum DB apa adanya; peta label→chip ada di `docs/UI_UX_DESIGN.md` §9.8 (peta kanonik `invoice_status` 7 nilai), bukan di kontrak API.

**Contoh tergarap — KRS mahasiswa yang tertahan gerbang keuangan**

`GET /api/v1/academic/krs/current?periodId=…` → `200 OK` (dipangkas):

```json
{
  "success": true,
  "data": {
    "krsId": "0f0d1a2b-…",
    "status": "DRAFT",
    "stateMachine": {
      "resource": { "type": "krs", "id": "0f0d1a2b-…" },
      "machine": "SM-2",
      "state": "DRAFT",
      "allowedTransitions": [
        {
          "action": "krs.submit",
          "permission": "enrollment.krs.submit",
          "enabled": false,
          "blockedBy": [
            {
              "code": "GATE_BLOCKED",
              "reason": "Ada tagihan UKT jatuh tempo (Rp2.400.000) yang menahan pengajuan KRS.",
              "remedyHref": "/mahasiswa/keuangan/tagihan/7c31be55-…"
            }
          ]
        },
        {
          "action": "krs.discard",
          "permission": "enrollment.krs.withdraw",
          "enabled": true,
          "blockedBy": []
        }
      ],
      "actorNext": {
        "roleCode": "TREASURER",
        "scope": { "kind": "TENANT", "id": null },
        "displayName": null,
        "waitingSince": "2026-08-01T00:00:00.000Z"
      }
    }
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```

Klien hanya merender satu tombol hidup (`krs.discard`) plus strip sebab `GATE_BLOCKED` dan tautan ke halaman tagihan. Bila mahasiswa lalu melunasi, respons mutasi berikutnya membawa view terbaru dengan `krs.submit.enabled: true` — dan **tetap** service layer yang menolak submit bila gerbang belum lepas (guard dua lapis, AGENTS §3.8; lapisan §4.6 butir 1): strip ini kenyamanan, bukan kontrol akses.

---

## 3. Skema Validasi & Tipe Data Global (Zod Core)

Berikut adalah definisi pustaka validasi Zod TypeScript yang digunakan bersama oleh Next.js Server Action / Route Handlers. Blok ini **menyalin kontrak target** — kolom "Δ" di §2.4f mencatat nama yang masih dipakai `packages/contracts/src/envelope.ts:14-20` hari ini (`search`, `sortOrder`) sehingga selisihnya terlihat, bukan tersembunyi.

```typescript
import { z } from 'zod';

// ==========================================
// 1. Primitive Reusable Schemas
// ==========================================
export const UUIDSchema = z.string().uuid({ message: "Harus berupa format UUID v4 yang valid." });
export const TimestampSchema = z.string().datetime({ message: "Format waktu harus ISO-8601 UTC." });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().trim().min(1).max(64).optional(),   // divalidasi ulang terhadap SORTABLE_FIELDS (§2.4d)
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  q: z.string().trim().min(1).max(120).optional()        // selalu diparameterkan (§2.4e)
});

/** Nama lama yang masih ada di kontrak terbitan hari ini — diterima sebagai alias selama transisi. */
export const LegacyListQueryAliases = { search: 'q', sortOrder: 'sortDir', pageSize: 'limit' } as const;

// ==========================================
// 2. Standard Envelope Schemas
// ==========================================
export const MetaResponseSchema = z.object({
  timestamp: TimestampSchema,
  requestId: z.string(),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    totalRecords: z.number().int(),
    totalPages: z.number().int(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean()
  }).optional()
});

export const ErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string()
});

export const StandardErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ErrorDetailSchema)
  }),
  meta: MetaResponseSchema
});

export const createSuccessEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) => {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: MetaResponseSchema
  });
};
```

---

## 4. Endpoint Spesifikasi MVP

### 4.1 Modul Otentikasi & Sesi (`/api/v1/auth/*`) (M-03)

#### 4.1.1 POST `/api/v1/auth/login`
Autentikasi akun pengguna menggunakan identifier (NIM/NIDN/Email) dan password.

**Request Body Schema (Zod):**
```typescript
export const LoginRequestSchema = z.object({
  tenantIdentifier: z.string().min(3).max(64).describe("Subdomain institusi (e.g. unpad)"),
  username: z.string().min(3).max(100).describe("NIM, NIDN, atau Email Pengguna"),
  // Postur keamanan: minimal 12 karakter (SECURITY_COMPLIANCE §2.1) — BUKAN 8.
  password: z.string().min(12).max(128),
  deviceId: z.string().max(128).optional().describe("Wajib dikirimkan oleh Flutter Mobile"),
  deviceInfo: z.object({
    os: z.enum(['ios', 'android', 'web']),
    model: z.string().optional(),
    appVersion: z.string()
  }).optional()
});
```

> **Koreksi panjang sandi (K-23 / RD-24; diputuskan ulang 2026-10-19).** `min(8)` pada kontrak login **tidak dinaikkan menjadi 12** — penjelasannya ada di [`SECURITY_COMPLIANCE §2.1`](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md): kebijakan panjang + breach check ditegakkan di **pembuatan/penggantian** sandi (`register`, `password.reset`, `password.change`, `identity.user.create`), sedangkan kolom login sengaja longgar agar pemilik sandi warisan 8–11 karakter masih dapat masuk (lalu dipaksa rotasi). Kesalahan yang pernah terjadi di sini adalah **menyebut keduanya satu kebijakan**; sekarang keduanya dibedakan eksplisit. Yang tetap wajib sebelum codegen: validator kebijakan di empat jalur tulis sandi + `password_history` 5 terakhir.
> Kebijakan lain yang mengikat pada field ini: `password_history` 5 sandi terakhir (reuse ditolak), dan penolakan diam-diam tanpa membocorkan field mana yang salah (`401` seragam, tanpa username enumeration).

**Response Payload Schema (Zod) - Status 200 OK:**

Payload wajib membawa **dua lapis identitas sekaligus** (K-17): `carrierRole` = enum `member_role` (lapis login, 5 nilai) dan `activeAssignment[]` = penugasan riil ber-scope dari `user_role_assignments` (satu user bisa memegang banyak peran di banyak scope). Hak akses dibaca dari `activeAssignment`, **bukan** dari `carrierRole`.

```typescript
export const ActiveAssignmentSchema = z.object({
  assignmentId: UUIDSchema,
  roleCode: RoleCodeSchema,            // roles.code — 17 nilai, authz.ts:26-44
  scopeKind: ScopeKindSchema,          // TENANT | ORG | PROGRAM | CLASS | PERIOD | SELF
  scopeId: z.string().uuid().nullable().describe("id entitas scope sesuai scopeKind"),
  scopeLabel: z.string().nullable().describe("Label manusiawi untuk pemilih konteks, mis. 'S1 Informatika'"),
  validFrom: TimestampSchema,
  validTo: z.string().datetime().nullable().describe("null = berlaku sampai dicabut"),
  origin: z.enum(['GRANTED','MIGRATED','SYSTEM']),
  isActiveNow: z.boolean().describe("false bila jendela waktu/validitas sudah lewat"),
});

export const LoginResponseDataSchema = z.object({
  requireMfa: z.boolean(),
  mfaToken: z.string().optional().describe("Diberikan jika requireMfa=true"),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().optional().describe("Masa berlaku access token dalam detik (900 = 15m)"),
  user: z.object({
    id: UUIDSchema,
    tenantId: UUIDSchema,
    username: z.string(),
    fullName: z.string(),
    avatarUrl: z.string().url().nullable(),
    // ── dua lapis identitas (K-17) ─────────────────────────────────────────
    carrierRole: CarrierRoleSchema,                     // enum member_role, 5 nilai
    activeAssignment: z.array(ActiveAssignmentSchema)   // sumber hak akses yang sesungguhnya
      .describe("Kosong ⇒ pemanggil tidak punya penugasan aktif: hanya rute SELF yang boleh jalan"),
    activeContext: z.object({                           // konteks terpilih untuk sesi ini
      assignmentId: UUIDSchema,
      roleCode: RoleCodeSchema,
      scopeKind: ScopeKindSchema,
      scopeId: z.string().uuid().nullable(),
    }).nullable()
  }).optional()
});
```

**Aturan yang mengikat field ini**

1. **Perluasan carrier → peran hanya lewat penugasan.** Peta `CARRIER_TO_ROLES` (`packages/contracts/src/authz.ts:78-85`) adalah transisi *sementara* selama `user_role_assignments` belum dibaca runtime; `ADMIN_FINANCE`/`TREASURER`/`HEAD_OF_PROGRAM` **sengaja tidak** dipetakan ke carrier. Menampilkan satu label `role` saja = persis celah G-01 (pencocokan substring/peran global).
2. **`activeAssignment[]` wajib diurutkan deterministik** (`scopeKind`, lalu `roleCode`) agar pemilih konteks di Web & Mobile tidak berayun antar-login.
3. **Jangan** mengirim izin lengkap di payload login; klien menanyakan kebutuhan per layar (atau memakai menu tersaring dari `GET /tenant/modules` × penugasan aktif). Token tidak boleh membengkak dengan ±200 string izin.
4. Pencabutan peran harus terlihat pada panggilan berikutnya — karena itu `GET /auth/me` memakai bentuk yang sama dan **WAJIB** dibaca ulang setelah `role-assignments` berubah (cache izin Redis TTL 5 menit + invalidasi event-driven).
5. Δ implementasi hari ini: payload login hanya membawa `user.role` (carrier) — lihat `packages/contracts/src/auth.ts:64-71` dan `apps/web/src/app/api/v1/auth/login/route.ts:108-118`; `activeAssignment` **belum ada**. Resolver datanya sudah siap (`apps/web/src/modules/authz/rbac-repository.ts:70-95` memuat `scope*` + `validFrom/validTo`) tetapi tidak terhubung ke rute mana pun (temuan SEC-10).

---

#### 4.1.2 POST `/api/v1/auth/mfa/verify`

Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) terhadap tantangan MFA yang **diterbitkan dan disimpan server**.

> **Vonis `SEC-01` 2026-10-20 — gerbang ini harus ditutup sebelum boleh ada isinya.** Sasaran kontrak: `501 MFA_NOT_IMPLEMENTED` (baris §2.3 nomor 144) selama tantangan belum punya rumah objek. Basis keputusan, semuanya terukur hari ini: `mfaToken` dari login adalah token opaque yang **tidak** disimpan (`auth.service.ts:144-146`); rute verifikasi **tidak** membacanya; dan satu-satunya syarat yang diperiksa adalah bentuk enam digit, yang sudah dijamin skema Zod — lalu server mencetak `accessToken` + cookie untuk identitas acak. Bentuk itu fail-open dan lebih buruk daripada 501, karena klien menafsirkannya sebagai "MFA berhasil".
>
> **Empat syarat mencabut 501** (semua wajib, berurutan): (1) objek penyimpanan tantangan dinomori di `DATA_MODEL §14.7` — kolom minimal `tenant_id`, `user_id`, `factor_type`, `challenge_hash` (bukan token mentah), `expires_at` ±120 s, `attempt_count` plafon 5, `consumed_at`, `bound_device_id`; (2) `mfa_factors` berdiri dengan `tenant_id` + RLS `ENABLE`/`FORCE` + `secret bytea` (`SC-G4-11`, menutup `SEC-14`/`SEC-30`) dan rahasianya **tidak pernah** menjadi baris `master_system_parameters` (`AGENTS §3.10`: `is_secret = false`); (3) TOTP RFC 6238 dihitung server, jendela langkah dibaca dari parameter (`auth.totp_step_seconds`, `auth.totp_window_steps`) dengan **perbandingan waktu-konstan** (`crypto.timingSafeEqual`, pola yang sudah hidup di `password.service.ts:77` dan `token.service.ts:51`); (4) satu tantangan satu kali pakai dan setiap kegagalan masuk riwayat audit. Uji yang menahan: kode benar dari tantangan **lain** → 401; kode dari tenant **lain** → 401; tantangan kedaluwarsa → 401; pemakaian ulang → 409.

**Request Body Schema (Zod):**
```typescript
export const MfaVerifyRequestSchema = z.object({
  mfaToken: z.string().min(32),
  totpCode: z.string().length(6, { message: "Kode OTP harus tepat 6 digit angka." }).regex(/^\d+$/)
});
```

---

#### 4.1.3 POST `/api/v1/auth/refresh`
Memperbarui access token yang telah kadaluarsa menggunakan refresh token rotasi.

> **Masa berlaku refresh token = 7 hari (`604800` detik).** Ini nilai Environment Contract (`docs/ENV_CONTRACT.md`: `JWT_REFRESH_TOKEN_TTL_SEC` default 604800, min 86400) dan inilah yang dieksekusi kode (`apps/web/src/config/env.ts:32`, `apps/web/src/modules/auth/services/auth-config.ts:18`, dipakai sebagai `maxAge` cookie di `auth/login/route.ts:136` dan `auth/refresh/route.ts:72`). Klaim "14 hari" di `docs/SECURITY_COMPLIANCE.md` §2.2 adalah **yang salah** dan **sudah dibetulkan menjadi 7 hari pada 2026-10-19**: satu angka = 7 hari (K-22/RD-24). Access token tetap 900 detik (15 menit).

**Request Body Schema (Zod):**
```typescript
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(32),
  deviceId: z.string().max(128).optional()
});
```

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const RefreshTokenResponseDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().describe("Refresh token rotasi baru (token lama di-revoke)"),
  expiresIn: z.number().int().default(900).describe("Detik; = JWT_ACCESS_TOKEN_TTL_SEC"),
  refreshExpiresIn: z.number().int().default(604800).describe("Sisa umur refresh token = 7 hari")
});
```

**Aturan:**
1. Tanpa refresh token → `401 UNAUTHORIZED`. Token invalid / reuse terdeteksi / sesi dicabut → **`401 UNAUTHORIZED` dengan pesan seragam**; jangan membedakan `INVALID_TOKEN`, `REUSE_DETECTED`, `SESSION_REVOKED` ke klien (pola sudah benar di `auth/refresh/route.ts:43-46`).
2. Refresh token bersifat **opaque** (bukan JWT), disimpan sebagai hash SHA-256, dan hanya boleh dikirim ke rute ini (cookie `sica_refresh_token` di-`path`-kan ke `/api/v1/auth`).
3. Rotasi: token lama di-revoke saat token baru terbit. Replay token lama setelah rotasi = indikasi kebocoran → cabut seluruh rantai sesi.
4. Refresh **tidak** mengubah `activeAssignment`; untuk pembaruan hak, klien memanggil `GET /auth/me`.

---

#### 4.1.4 GET `/api/v1/auth/me`
Identitas + penugasan aktif pengguna terautentikasi pada tenant sesi ini. Dipakai navigasi Web & bottom-nav Mobile, dan wajib dibaca ulang setelah hak berubah.

**Response Payload Schema (Zod) - Status 200 OK:** bentuk `data` = objek `user` pada §4.1.1 (`carrierRole` + `activeAssignment[]` + `activeContext`) ditambah profil tenant:

```typescript
export const MeResponseDataSchema = z.object({
  userId: UUIDSchema,
  fullName: z.string(),
  email: z.string().email(),
  memberCode: z.string().nullable().describe("NIM/NIDN/NIP — PII, hanya untuk pemilik atau peran berhak"),
  tenantId: UUIDSchema,
  tenantSlug: z.string(),
  tenantName: z.string(),
  carrierRole: CarrierRoleSchema,
  activeAssignment: z.array(ActiveAssignmentSchema),
  activeContext: z.object({
    assignmentId: UUIDSchema,
    roleCode: RoleCodeSchema,
    scopeKind: ScopeKindSchema,
    scopeId: z.string().uuid().nullable()
  }).nullable(),
  mfaEnabled: z.boolean()
});
```

**Aturan:**
1. **Sumber kebenaran identitas = klaim JWT terverifikasi**, bukan cookie mentah (`apps/web/src/lib/api-response.ts:66-75` sudah fail-closed). Header `x-tenant-id`/`x-user-id` kiriman klien **tidak pernah** dipercaya (temuan SEC-07).
2. Tanpa sesi valid → `401 UNAUTHORIZED`; keanggotaan sudah dihapus/dinonaktifkan → `401` dengan pesan "Akun tidak lagi terdaftar pada institusi ini" (pola `apps/web/src/app/api/v1/auth/me/route.ts:19-31`).
3. Δ implementasi hari ini: `GET /auth/me` mengembalikan `role` carrier saja, dibaca dari `tenant_memberships.role` (`apps/web/src/modules/auth/services/me.service.ts:8-16,42-50`) — **belum** ada `activeAssignment[]`. Perluasan ke `user_role_assignments` adalah bagian penutupan K-17/SEC-10.
4. Endpoint ini termasuk 4 rute terautentikasi tanpa cek permission (temuan SEC-05): setelah guard terpasang, respons harus disaring `requirePrincipal(...)` sesuai peran penanya — bukan hanya "punya `tid`".

---

### 4.2 Modul Akademik & KRS (`/api/v1/academic/*`)

#### 4.2.1 GET `/api/v1/academic/krs/open-classes`
Mendapatkan daftar kelas perkuliahan yang ditawarkan pada semester aktif untuk program studi mahasiswa terkait.

**Query Parameters (Zod):**
```typescript
export const OpenClassesQuerySchema = PaginationQuerySchema.extend({
  academicPeriodId: UUIDSchema.optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
  departmentId: UUIDSchema.optional()
});
```

**Response Payload Data Item (Zod) - Status 200 OK:**
```typescript
export const ClassOfferingItemSchema = z.object({
  classId: UUIDSchema,
  courseCode: z.string(),
  courseName: z.string(),
  courseNameEn: z.string().nullable(),
  credits: z.number().int().min(1).max(6),
  className: z.string(), // e.g. "Kelas A"
  lecturerName: z.string(),
  learningModality: z.enum(['ONSITE', 'ONLINE', 'BLENDED']).default('ONSITE'),
  // RALAT 2026-10-21 (RD-71): proyeksi kelas ini sebelumnya memuat `deliveryMode`
  // ONSITE/ONLINE_SYNC/ONLINE_ASYNC — satu kolom dua konsep, dan dua tokennya adalah
  // alias kalah (`DATA_MODEL §21.10.2`). Kosakata yang berlaku = §21.4; pemetaan alias
  // ONLINE_SYNC -> ONLINE + sessionKind SYNC_LIVE, ONLINE_ASYNC -> ONLINE + ASYNC_MODULE.
  sessionKind: z.enum(['REGULAR', 'SYNC_LIVE', 'ASYNC_MODULE', 'PRAKTIKUM', 'UTS', 'UAS', 'SUSULAN']).default('REGULAR'),
  capacity: z.number().int(),
  enrolledCount: z.number().int(),
  remainingQuota: z.number().int(),
  schedules: z.array(z.object({
    dayOfWeek: z.number().int().min(1).max(7),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    roomCode: z.string(),
    building: z.string()
  })),
  isConflicting: z.boolean().describe("True jika jam bentrok dengan kelas yang sudah diambil"),
  isEnrolled: z.boolean().describe("True jika sudah masuk dalam draf KRS"),
  // Informasi antrean saat kelas penuh (Waitlist Threshold Engine)
  waitlistInfo: z.object({
    isWaitlistOpen: z.boolean(),
    currentQueueCount: z.number().int(),
    thresholdToOpenNewClass: z.number().int(),
    myQueuePosition: z.number().int().nullable()
  }).optional()
});
```

---

#### 4.2.2 POST `/api/v1/academic/krs/submit`
Mengajukan rencana studi semester untuk verifikasi Dosen Pembimbing Akademik (DPA).

**Request Body Schema (Zod):**
```typescript
export const SubmitKrsRequestSchema = z.object({
  academicPeriodId: UUIDSchema,
  selectedClassIds: z.array(UUIDSchema).min(1, { message: "Pilih minimal 1 mata kuliah." }),
  studentNotes: z.string().max(500).optional()
});
```

**Business Logic Rules (Enforced by Handler):**
1. Periksa batas kuota SKS (berdasarkan IPK semester sebelumnya, maks 24 SKS).
2. Periksa bentrok jadwal antarkelas terpilih (Collision Matrix).
3. Periksa ketersediaan kuota kelas secara atomic (`remaining_quota > 0`).
4. Catat status KRS menjadi `submitted` dan kirim notifikasi ke DPA.

**Response Payload Schema (Zod) - Status 201 Created:**
```typescript
export const SubmitKrsResponseDataSchema = z.object({
  krsId: UUIDSchema,
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
  totalCredits: z.number().int(),
  submittedAt: TimestampSchema,
  validationSummary: z.object({
    maxCreditsAllowed: z.number().int(),
    totalCoursesSelected: z.number().int()
  })
});
```

> **Δ bentuk vs target (jangan dibaca sebagai dua kontrak yang setara).** Blok Zod di atas adalah **bentuk hari ini** dan ia yang benar untuk klien hari ini: rute menjawab **`201` final** (`apps/web/src/app/api/v1/academic/krs/submit/route.ts:90` — `result.created.length > 0 ? 201 : 200`) dengan penguncian `pg_advisory_xact_lock` per kelas di dalam transaksi (`apps/web/src/modules/academic/services/krs.service.ts:371`). Ini **pengecualian berjangka** yang tercatat di `AGENTS.md` §3.8, bukan arsitektur final. Bentuk target — `202 Accepted` + `opId` + lease + antrean — dispesifikasi di **§4.2.11–§4.2.14** dan dinormakan di [`ARCHITECTURE.md` §10](file:///c:/SICA/docs/ARCHITECTURE.md) (§10.1 alur seat reservation → async commit).
>
> **Aturan rilis** (ARCHITECTURE §10, `DEPLOYMENT_DEVOPS.md` §4): perpindahan `201 → 202` **tidak pernah** terjadi diam-diam lewat deploy biasa. Ia dikendalikan **feature flag per tenant** (`platform.flag.manage`, izin terdaftar di `RBAC_MATRIX §4.2`) yang dievaluasi **setelah** gerbang entitlement dan **sebelum** state guard, dengan urutan wajib: (1) `bullmq` + `ioredis` menjadi dependensi nyata dan `/health/ready` memeriksa queue; (2) `idempotency_keys` + DLQ + rollback seat terbukti di uji; (3) flag dinyalakan untuk **satu** tenant sandbox, klien Web **dan** Flutter sudah bisa menerima `202`; (4) baru rollout progresif. Mengembalikan flag ke `201` harus tetap aman untuk klien yang sudah membaca `202` — karena itu §4.2.11 mewajibkan bentuk jawaban yang dapat dikenali dari **satu** field, `data.mode`.

---

#### 4.2.11 POST `/api/v1/academic/krs/submit` — bentuk target asinkron (`202 Accepted`)
**Status: `spec-only`** — tidak ada satu pun berkas antrean di `apps/web/src/app/api/v1/academic/krs/**` selain rute sinkron. Nomor `4.2.11` dipakai agar tidak menabrak `§4.2.7`–`§4.2.10` yang sudah direzerwasi oleh catatan di §5.2 (`krs/approve`, `grading`, `krs/current`, `krs/withdraw`).

**Request** = badan yang sama dengan §4.2.2 **ditambah** header `Idempotency-Key` (§4.2.14). Tidak ada field baru di body: `mode` dipilih server lewat feature flag, **bukan** dikirim klien (klien yang mengirim `mode` diabaikan dan itu tercatat di `meta.requestId`, bukan ditolak — agar rollout tidak memecah aplikasi lama).

**Response — `202 Accepted`** (amplop §2.1; **bukan** list, jadi tidak ada `meta.pagination`):
```json
{
  "success": true,
  "data": {
    "mode": "ASYNC",
    "opId": "9c1f2a77-4b0e-6f21-8d3a-01a9e4c5b7f2",
    "statusUrl": "/api/v1/ops/9c1f2a77-4b0e-6f21-8d3a-01a9e4c5b7f2",
    "streamUrl": "/api/v1/academic/krs/stream?opId=9c1f2a77-4b0e-6f21-8d3a-01a9e4c5b7f2",
    "positionUrl": "/api/v1/academic/krs/queue-position",
    "leaseExpiresAt": "2026-10-19T08:16:30.000Z",
    "enrollmentDraft": { "totalCredits": 20, "classCount": 5 }
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```
`202` **wajib** membawa header `Retry-After` (detik; nilai = estimasi waktu tunggu + margin p50 worker, minimum 2, maksimum 30). Untuk bentuk lama, respons `201` **tidak** membawa `Retry-After` — ketiadaan header itu sendiri sudah menjadi pembeda, tetapi klien **wajib** membaca `data.mode` (`SYNC` pada bentuk §4.2.2, `ASYNC` pada bentuk ini) dan bukan menebak dari status code saja.

**Field yang dijamin server:**
| Field | Aturan |
|---|---|
| `opId` | UUID yang dibuat server; **juga** nilai `jobId` BullMQ (§10.3 ARCHITECTURE) sehingga enqueue ulang tidak membuat operasi kedua. |
| `statusUrl` | Path relatif; klien memblokir nilai absolut dari server (pola `remedyHref` §2.5 butir 4). |
| `streamUrl` | Endpoint SSE §4.2.12; **tidak** mengandung token akses (lihat aturan auth §4.2.12). |
| `positionUrl` | Baca murah dan boleh di-poll; hasil `QUEUED` **tidak** boleh dianggap final. |
| `leaseExpiresAt` | Batas kursi yang dipegang Redis; lewat waktu → `410 LEASE_EXPIRED` (baris 44) dan klien harus `POST …/krs/lease` ulang. |

**Penegakan enam lapis (AGENTS §3.8) untuk rute ini** — wajib didaftar eksplisit di handler, bukan diasumsikan:
- **L1 transport**: Zod `selectedClassIds` array UUID non-kosong, tanpa field tak dikenal (`strict()`); kolom `SERVER_ONLY` (`enrollments.status`, `students.nim`, `students.status_akademik`) **tidak pernah** diterima dari body — daftar kanonik: `DATA_MODEL.md` §14.9.
- **L2 identitas**: `tenantId`/`userId` hanya dari JWT terverifikasi; middleware menghapus `x-tenant-id`/`x-user-id` kiriman klien lebih dulu (`SEC-07`).
- **L3 permission berbasis tabel**: `requireDataPrincipal` atas `user_role_assignments`, bukan perluasan carrier `member_role` (`SEC-10`). Izin: `enrollment.krs.submit` (sudah ada di katalog `authz.ts`).
- **L4 scope**: `holdsScoped(access, PERM.enrollmentKrsSubmit, { kind: 'SELF', studentId })` untuk mahasiswa dan `{kind:'PROGRAM'}` untuk operator yang mengajukan atas nama mahasiswa (`SEC-11` — fungsi tersedia, nol call site hari ini).
- **L5 state**: periode `OPEN` (`423 PERIOD_CLOSED`, baris 25), gerbang tagihan lepas (`403 GATE_BLOCKED`, baris 38), prasyarat & kuota SKS (`422 ACADEMIC_CREDIT_QUOTA_EXCEEDED`, baris 37), kursi (`409 CLASS_FULL`, baris 36 — **wajib** dipancarkan sebagai kode ini, bukan diratakan jadi `CONFLICT`).
- **L6 RLS**: `SET LOCAL app.current_tenant` di transaksi worker **dan** di rute pembacaan hasil; `sica_app` `NOBYPASSRLS`.

**Anti-IDOR** (pola wajib semua rute tulis): setiap `classId`/`studentId`/`periodId` dari klien diselesaikan ke barisnya **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND id = $1`), kepemilikan dibuktikan, **baru** mutate. Rute yang menerima `selectedClassIds[]` tanpa pembacaan DB = temuan `SEC-02/03/04`, bukan gaya kode. Rute lama `POST /academic/krs/approve` yang menerima `enrollmentIds[]` apa adanya adalah contoh nyata yang harus diperbaiki (§5.2).

---

#### 4.2.12 GET `/api/v1/academic/krs/stream` — Server-Sent Events
**Status: `spec-only`.** `grep -r "text/event-stream" apps/web/src` = 0 hasil.

**Event names** (nama tetap; klien tidak membuat padanan sendiri):

| Event | Data payload (ringkas) | Arti |
|---|---|---|
| `position` | `{opId, queuePosition, estimatedSeconds}` | Kirim ulang setiap kali posisi berubah; **tidak** mengubah state akhir. |
| `leased` | `{opId, classId, leaseExpiresAt}` | Kursi dipegang Redis; mulai hitung mundur. |
| `committed` | `{opId, enrollments[], totalCredits}` | Finalisasi DB sukses — **ini satu-satunya event yang boleh dianggap hasil akhir**. |
| `rejected` | `{opId, code, message}` | Finalisasi gagal permanen; `code` wajib anggota §2.3 (mis. baris 36, 45, 46). |
| `expired` | `{opId, leaseExpiresAt}` | Lease lewat tanpa submit; seat dikembalikan ke Redis. |
| `heartbeat` | `{opId, serverTime}` | COMMENT line `: ping` + event tiap 15 detik agar proxy/CDN tidak memutus koneksi senyap. |

**Aturan transport:** `Content-Type: text/event-stream`, `Cache-Control: no-store, no-transform`, `X-Accel-Buffering: no`, setiap event membawa `id: <opId>:<seq>` sehingga `Last-Event-ID` dapat dipulihkan. Reconnect tanpa `committed`/`rejected` **tidak** boleh membuat klien menganggap sukses; klien jatuh ke `GET /ops/{opId}` (§4.2.13) untuk membaca state otoritatif — SSE adalah kenyamanan, bukan sumber kebenaran (paralel dengan aturan "strip state machine bukan kontrol akses" di §2.5).

**Batas koneksi per tenant**: maksimal **3 koneksi SSE simultan per pengguna** dan **200 per tenant** (kuota di `tenant_quotas`, nilai awal ditetapkan `DEPLOYMENT_DEVOPS.md` §4). Melebihi → `429 RATE_LIMIT_EXCEEDED` (baris 9) + `Retry-After`. Koneksi ditutup paksa setelah `committed`/`rejected`/`expired` atau 120 detik tanpa aktivitas.

**Keputusan autentikasi (diputuskan di sini, bukan dibiarkan untuk implementator):**
1. **Dilarang** mengirim access token JWT di query string (`?access_token=…`). Alasannya terukur: query string masuk log akses nginx/CDN, riwayat browser, header `Referer`, dan telemetri proxy; satu kebocoran = sesi curian 15 menit penuh untuk seluruh akun.
2. **Pilihan utama = cookie sesi `http-only`** yang sama dengan rute lain, di-`Path`-kan ke `/api/v1/academic/krs/stream` dan `SameSite=Strict`; **`Authorization` header tidak dipakai** karena `EventSource` di Web tidak dapat mengatur header. Flutter memakai `http` package yang mampu mengirim header, tetapi **wajib memakai jalur cookie yang sama** agar satu kontrak tidak bercabang dua (paritas §3.4 AGENTS).
3. **Pilihan cadangan = tiket sekali-pakai ber-umur pendek** untuk kondisi cookie tidak dapat dipakai (webview tertentu, klien tanpa cookie jar): `POST /api/v1/academic/krs/stream-ticket` → `{ticket, expiresInSeconds: 30, singleUse: true}`; tiket opaque (bukan JWT), **di-hash SHA-256 saat disimpan**, terikat `(tenantId, userId, opId)`, dan **dihanguskan pada konsumsi pertama** — koneksi yang terputus lalu reconnect **wajib** meminta tiket baru, bukan memakai ulang.
4. **Risiko yang diterima secara sadar** untuk opsi 3: tiket tetap lewat query string sehingga tetap berpotensi tercatat di log. Mitigasi yang **wajib** terpasang agar risiko itu dapat diterima: redaksi parameter `ticket` di level proxy **dan** Pino (`docs/SECURITY_COMPLIANCE.md` redaction), `Referrer-Policy: no-referrer` pada halaman pemesan, TTL 30 detik, sekali-pakai, terikat pasangan (user, opId) sehingga tiket curi tidak dapat dipakai untuk operasi orang lain, dan audit `stream.ticket.issue/consume` di `audit_logs`. Keputusan akhir: **cookie sebagai jalur utama, tiket hanya fallback eksplisit yang diizinkan per tenant lewat feature flag** — bila keduanya tidak tersedia, klien memakai polling `GET /ops/{opId}` (yang tidak punya masalah ini karena memakai header biasa).
5. **Pengecualian amplop**: badan `text/event-stream` **tidak** memakai envelope §2.1/§2.2 (tiap event adalah fragmen JSON kecil, bukan satu respons). Ini menambah **kelas pengecualian keempat** di §1.1 — §1.1 sudah disesuaikan pada siklus ini, dan sampai rute ini benar-benar ada statusnya tetap `spec-only`. `/ops/{opId}` **bukan** bagian dari pengecualian itu: ia rute berautentikasi biasa dan **wajib** berpembungkus §2.1.

---

#### 4.2.13 GET `/api/v1/ops/{opId}` — status operasi asinkron
**Status: `spec-only`** (tidak ada rute `/ops/**`). Sumber kebenaran akhir; aman di-poll.

State yang dinormakan (bukan kosakata DB, ini state **operasi**, berbeda dari `enrollment_status` di `DATA_MODEL.md` §15):

| State | Arti | Lanjutan yang sah |
|---|---|---|
| `QUEUED` | Job terdaftar, belum dieksekusi worker. | `PROCESSING`, `EXPIRED` |
| `PROCESSING` | Worker memegang job (advisory lock per kelas aktif). | `SUCCEEDED`, `FAILED`, `EXPIRED` |
| `SUCCEEDED` | Enrollment terkcommit; `data.enrollments[]` terisi. | terminal |
| `FAILED` | Gagal permanen (attempts habis / ditolak state guard); `code` wajib anggota §2.3; job masuk DLQ untuk investigasi. | terminal |
| `EXPIRED` | Lease/posisi kedaluwarsa sebelum finalisasi. | terminal — klien ambil lease baru |

Transisi **satu arah**; `QUEUED` tidak pernah muncul lagi setelah `PROCESSING` untuk `opId` yang sama.

```json
{
  "success": true,
  "data": {
    "opId": "9c1f2a77-…",
    "kind": "krs.submit",
    "state": "PROCESSING",
    "queuePosition": 37,
    "estimatedSeconds": 12,
    "leaseExpiresAt": "2026-10-19T08:16:30.000Z",
    "attempts": 1,
    "startedAt": "2026-10-19T08:15:31.000Z",
    "finishedAt": null,
    "code": null,
    "enrollments": [
      { "enrollmentId": "…", "classId": "…", "courseCode": "IF2101", "credits": 3, "status": "EFFECTIVE" }
    ],
    "stateMachine": { "resource": { "type": "krs", "id": "…" }, "machine": "SM-2", "state": "SUBMITTED" }
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```

Aturan:
1. `enrollments[]` **hanya** terisi pada `SUCCEEDED` dan **wajib** dibaca dari **Primary** (read-your-writes, AGENTS §3.7). Kosong pada state lain — klien tidak boleh menarik kesimpulan "tidak ada kursi" dari array kosong di `PROCESSING`.
2. `code` (bukan `error.code`) memakai register §2.3 saat `FAILED`: baris 36 `CLASS_FULL`, 44 `LEASE_EXPIRED`, 45 `QUEUE_POSITION_LOST`, 42 `ENROLLMENT_ENGINE_UNAVAILABLE`.
3. `opId` milik tenant lain → **`404 NOT_FOUND`** (baris 5), bukan 403, agar keberadaan operasi tidak bocor lintas tenant (`RBAC_MATRIX §1` butir 5).
4. `queuePosition`/`estimatedSeconds` adalah **estimasi**; `QUEUED` tidak boleh dipakai untuk menyatakan sukses/gagal.
5. Retensi hasil 24 jam, lalu `410 QUEUE_POSITION_LOST` (baris 45) dengan saran membaca `GET /academic/krs/current`.
6. Polling disarankan 2–5 detik dengan jitter; SSE (§4.2.12) hanya accelerator.

---

#### 4.2.14 Lease kursi, posisi antrean, dan `Idempotency-Key`
**Status: `spec-only` untuk seluruh blok ini.**

```http
POST   /api/v1/academic/krs/lease                body { academicPeriodId, classId }  → 201
DELETE /api/v1/academic/krs/lease/{classId}      lepas eksplisit                      → 200
GET    /api/v1/academic/krs/queue-position       posisi + estimasi untuk opId/lease    → 200
POST   /api/v1/academic/krs/stream-ticket        tiket SSE sekali-pakai (fallback)     → 201
```

| Aspek | Aturan |
|---|---|
| Lease TTL | **90 detik** bawaan (VONIS 2026-10-20), rentang aman **30–300**, kunci kanonik **`krs.war_lease_ttl_s`** (`DATA_MODEL §21.2`, `0049`); `tenant_settings.krs_lease_ttl_seconds` adalah **alias yang kalah** (`§14.8`) dan hanya dibaca sebagai compat satu rilis. Tidak ada perpanjangan diam-diam: `POST …/lease` yang sama saat lease aktif = **perpanjangan idempoten** dan mengembalikan `leaseId` yang sama. |
| Kepemilikan | Satu lease = satu pasangan (mahasiswa, kelas). Lease atas `classId` yang bukan milik pemanggil ditolak **`403 NOT_YOUR_STUDENT`** (baris 48) untuk operator dan `409 LEASE_CONFLICT` (baris 43) bila dipegang mahasiswa lain. |
| Lepas eksplisit | `DELETE …/lease/{classId}` mengembalikan kursi ke Redis **sebelum** TTL; hanya boleh untuk lease milik sendiri dan **tidak** menghapus `opId` yang sudah terlanjur `PROCESSING` (itu `409 LEASE_CONFLICT` dengan `details[].state`). |
| `GET …/queue-position` | Query read-only non-transaksional → boleh ke **Replica**, **kecuali** dipanggil segera setelah tulis (positif: posisi milik sendiri pasca-lease) → **Primary**. Bentuknya amplop §2.1 tanpa `meta.pagination`. |
| Header `Idempotency-Key` | Wajib pada `POST …/submit` dan `POST …/lease`. Karakter: `[A-Za-z0-9_-]` 16–64 char, dibuat klien (UUID disarankan). Kunci disimpan sebagai `(tenant_id, actor_user_id, header_value)`. |
| TTL idempotensi | **24 jam** sejak permintaan pertama; disimpan di `idempotency_keys` (DDL: `DATA_MODEL.md` §14, rujukan kolom sudah disebut di §4.7 tabel "Sifat rute"). |
| Konflik bentuk | Key sama + payload **sama** → **`200`** dengan `opId` asli dan `data.replayed: true` (bukan `202` kedua, bukan dua job). Key sama + payload **berbeda** → **`409 DUPLICATE_SUBMIT`** (baris 46) dengan `error.details[].opId` asli. |
| Jaminan inti | Replay **tidak pernah** menghasilkan kursi/enrollment ganda: `opId` diturunkan dari key, `jobId` BullMQ = `opId` (ARCHITECTURE §10.3), dan `uq` pada enrollments per (mahasiswa, kelas) menjadi penahan terakhir di DB. Tiga submit bersamaan dari tiga perangkat = **tepat satu** enrollment. |
| Enam lapis | L1 `strict()` Zod + whitelist header · L2 identitas hanya dari token (`SEC-07`) · L3 `requireDataPrincipal` (`SEC-10`) · L4 `holdsScoped(...)` (`SEC-11`) · L5 periode `OPEN` + gerbang + lease hidup · L6 RLS `app.current_tenant`. Setiap rute di atas adalah rute tulis kecuali `queue-position` (baca). |

---


#### 4.2.3 GET `/api/v1/academic/khs/:periodId`
Mengambil lembar Kartu Hasil Studi (KHS) mahasiswa pada semester tertentu.

**Path Parameters:**
- `periodId`: UUID v4 ID periode akademik.

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const KhsDetailResponseDataSchema = z.object({
  student: z.object({
    nim: z.string(),
    name: z.string(),
    programStudy: z.string(),
    academicAdvisor: z.string()
  }),
  academicPeriod: z.object({
    id: UUIDSchema,
    name: z.string(), // "2026/2027 Ganjil"
    semesterType: z.enum(['odd', 'even', 'short'])
  }),
  summary: z.object({
    semesterCreditsTaken: z.number().int(),
    semesterCreditsEarned: z.number().int(),
    semesterGpa: z.number().min(0.0).max(4.0), // IPS
    cumulativeCreditsEarned: z.number().int(),
    cumulativeGpa: z.number().min(0.0).max(4.0), // IPK
    maxCreditsNextSemester: z.number().int()
  }),
  grades: z.array(z.object({
    courseCode: z.string(),
    courseName: z.string(),
    credits: z.number().int(),
    numericScore: z.number().min(0).max(100).nullable(),
    letterGrade: z.enum(['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'E', 'T']).nullable(),
    gradePoint: z.number().min(0.0).max(4.0).nullable(),
    isPublished: z.boolean()
  }))
});
```

---

#### 4.2.4 GET `/api/v1/academic/transcript`
Mengambil transkrip akademik kumulatif resmi lengkap.

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const TranscriptResponseDataSchema = z.object({
  studentId: UUIDSchema,
  nim: z.string(),
  fullName: z.string(),
  admissionYear: z.string(),
  facultyName: z.string(),
  departmentName: z.string(),
  totalCreditsPassed: z.number().int(),
  cumulativeGpa: z.number().min(0.0).max(4.0),
  predicate: z.enum(['Cumlaude', 'Sangat Memuaskan', 'Memuaskan', 'Cukup']),
  verifiedDigitalSignature: z.string().describe("HMAC-SHA256 signature dokumen resmi"),
  courses: z.array(z.object({
    courseCode: z.string(),
    courseName: z.string(),
    credits: z.number().int(),
    letterGrade: z.string(),
    gradePoint: z.number(),
    periodTaken: z.string()
  }))
});
```

---

#### 4.2.5 POST `/api/v1/academic/krs/waitlist/join`
Mendaftarkan mahasiswa ke antrean daftar tunggu (*Waitlist*) ketika kuota kelas utama penuh (BR-A10). Kuota SKS akan dikunci sementara.

**Request Body Schema (Zod):**
```typescript
export const JoinWaitlistRequestSchema = z.object({
  academicPeriodId: UUIDSchema,
  courseId: UUIDSchema,
  targetClassId: UUIDSchema.describe("Kelas penuh yang dituju (misal: Kelas A)")
});
```

**Response Payload Schema (Zod) - Status 201 Created:**
```typescript
export const JoinWaitlistResponseDataSchema = z.object({
  waitlistId: UUIDSchema,
  queueNumber: z.number().int(),
  heldCredits: z.number(),
  thresholdToOpenNewClass: z.number().int().default(15),
  status: z.literal('WAITING'),
  message: z.string()
});
```

---

#### 4.2.6 DELETE `/api/v1/academic/krs/waitlist/leave`
Membatalkan pendaftaran dari daftar tunggu antrean kelas dan melepaskan kuota SKS yang tertahan.

**Request Body Schema (Zod):**
```typescript
export const LeaveWaitlistRequestSchema = z.object({
  waitlistId: UUIDSchema
});
```

---

#### 4.2.15 Paket KRS — kelola draf per prodi/periode/angkatan

**Status: `spec-only`.** Pemilik data `krs_packages`/`krs_package_lines` adalah DATA_MODEL §26.8. Izin `enrollment.pack.view`/`enrollment.pack.apply` tercatat untuk FR-AKA-16; `enrollment.pack.create` di RBAC §4.5.6 masih **usulan**, jadi POST belum boleh dikode sampai promosi nomor/grant (`CRD-5b`).

| METHOD | Jalur | Izin | Verba | Status | Modul |
|---|---|---|---|---|---|
| GET | `/admin/academic/krs-packages` | `enrollment.pack.view` | READ | `spec-only` · filter `programId`, `periodId`, `entryYear`, `state`; HOP dibatasi scope PROGRAM | M-14 |
| POST | `/admin/academic/krs-packages` | usulan `enrollment.pack.create` | INSERT | `spec-only` · membuat DRAFT cohort package | M-14 |
| GET | `/admin/academic/krs-packages/{packageId}` | `enrollment.pack.view` | READ | `spec-only` · ID diselesaikan dalam tenant/scope, 404 seragam | M-14 |
| PATCH | `/admin/academic/krs-packages/{packageId}` | `enrollment.pack.apply` | UPDATE | `spec-only` · hanya DRAFT; `If-Match: "v{version}"` wajib | M-14 |
| POST | `/admin/academic/krs-packages/{packageId}/archive` | `enrollment.pack.apply` | UPDATE | `spec-only` · transisi ke `ARCHIVED`; tidak ada DELETE fisik | M-14 |

**Body POST/PATCH (allowlist):** `programId`, `periodId`, `entryYearFrom`, `entryYearTo`, `code`, `name`, `isAutoFill`, `lines: [{ classId, seq, isRequired }]`. Nilai `tenantId`, `state`, `version`, `createdBy`, `requestedBy`, `approvedBy`, `approvedAt`, `publishedAt`, `packedSks`, dan `sksSnapshot` **SERVER_ONLY**. Server menghitung SKS dari kelas; `If-Match` basi → 409 dan tidak ada perubahan. Paket PUBLISHED tidak ditimpa; revisi = DRAFT baru dengan kode sama dan versi berikutnya.

**Gerbang sebelum simpan/publikasi:** setiap kelas berada pada prodi/periode dan rentang angkatan paket, memiliki distribusi `PUBLISHED` yang cocok (I-12), serta jadwal; jumlah `sksSnapshot` sama dengan `packedSks`; `packedSks` tidak melebihi BR-R2 untuk periode target. `isAutoFill` hanya mengatur prapilih baris pada form, bukan menulis basket/enrollment.

#### 4.2.16 POST `/api/v1/admin/academic/krs-packages/{packageId}/publish` (M-14)

**Status: `spec-only`; izin `enrollment.pack.publish` pada RBAC §4.5.6 masih usulan.** Aksi `VALIDATE` memerlukan MFA dan penyetuju berbeda dari `requestedBy`; L5 memvalidasi versi, periode, distribusi, jadwal, jumlah baris, total SKS, dan plafon BR-R2 dalam transaksi. Keberhasilan menetapkan `approvedBy`, `approvedAt`, `publishedAt`, `state=PUBLISHED`; check DB menolak SoD atau paket tanpa baris/SKS positif. Paket terbit menjadi immutable; edit menghasilkan versi baru.

Body kosong; versi memakai `If-Match`. Identitas penyetuju hanya dari token, tidak dari body. Konflik versi mengembalikan 409; validasi isi memakai `422 VALIDATION_FAILED` (6), plafon memakai `422 ACADEMIC_CREDIT_QUOTA_EXCEEDED` (37), periode tutup memakai `423 PERIOD_CLOSED` (25). Tidak ada kode error baru.

#### 4.2.17 GET `/api/v1/academic/krs/packages/current` (M-13)

**Status: `spec-only`.** Permission `enrollment.krs.view`, scope SELF. Query `academicPeriodId` wajib di-resolve di tenant; identitas mahasiswa, program, dan angkatan diambil dari principal/data server, bukan dari `studentId` klien.

`data.package` berisi `packageId`, `code`, `name`, `entryYearFrom`, `entryYearTo`, `packedSks`, `maxSksAllowed` hasil aturan BR-R2, `version`, dan `lines[]` berisi `classId`, `seq`, `isRequired`, `sksSnapshot`, proyeksi kelas/matakuliah/jadwal/kuota. Tidak ada package cocok → `package: null`; UI menampilkan empty state i18n, bukan angka nol sebagai paket. GET tidak menahan kursi.

KRS UI dapat memprapilih kelas sesuai `isAutoFill`/`isRequired`; mahasiswa tetap meninjau dan mengirim pilihan lewat POST `/academic/krs/submit` (§4.2.2). Tidak ada enrollment otomatis; submit membaca ulang setiap ID dan menjalankan semua gerbang yang sama.

### 4.3 Modul Presensi QR Dinamis & Geofencing (`/api/v1/attendance/*`)

Modul presensi dirancang anti-kecurangan (*anti-cheat*) dengan menerapkan perputaran token QR berbasis waktu (*dynamic rotating token*, TTL 30 detik) dan validasi lokasi koordinat GPS client (*Haversine Geofencing*, radius maks 50 meter dari kelas).

#### 4.3.1 POST `/api/v1/attendance/qr/generate`
Digunakan oleh Dosen pada Web Portal atau Mobile Dosen untuk mengaktifkan sesi kelas dan mendapatkan token QR dinamis.

**Request Body Schema (Zod):**
```typescript
export const GenerateQrRequestSchema = z.object({
  classScheduleId: UUIDSchema,
  meetingNumber: z.number().int().min(1).max(16),
  teachingTopic: z.string().min(5).max(255),
  teachingMethod: z.enum(['offline', 'online', 'hybrid']).default('offline'),
  // RALAT 2026-10-20 (DATA_MODEL §21.4): kosakata ini **alias** dan dipetakan
  // `offline`->ONSITE, `online`->ONLINE, `hybrid`->BLENDED pada `learningModality`,
  // + `sessionKind` terpisah. Kontrak final & jadwal pelepasan alias: lihat §4.4.1.
  // Rute lama **tidak** menerima nilai kanonik sampai rutenya dipindah ke §4.3.6/§4.3.7,
  // jadi dua bentuk tidak pernah hidup bersamaan pada satu handler.
  latitude: z.number().min(-90).max(90).describe("Koordinat Dosen/Ruang Kuliah"),
  longitude: z.number().min(-180).max(180),
  allowedRadiusMeters: z.number().int().min(10).max(200).default(50)
});
```

**Response Payload Schema (Zod) - Status 201 Created:**
```typescript
export const GenerateQrResponseDataSchema = z.object({
  sessionId: UUIDSchema,
  qrPayload: z.string().describe("Enkripsi signed token berformat JWE/Base64"),
  refreshIntervalSeconds: z.literal(30),
  expiresAt: TimestampSchema,
  meetingDetails: z.object({
    className: z.string(),
    meetingNumber: z.number().int(),
    openedAt: TimestampSchema
  })
});
```

---

#### 4.3.2 POST `/api/v1/attendance/qr/scan`
Dipanggil oleh aplikasi Flutter Mahasiswa setelah berhasil membaca QR Code melalui kamera dan mendapatkan koordinat GPS akurat.

**Request Body Schema (Zod):**
```typescript
export const ScanQrAttendanceRequestSchema = z.object({
  sessionId: UUIDSchema,
  qrPayload: z.string().min(32).describe("Token hasil scan kamera"),
  clientTimestamp: TimestampSchema,
  deviceCoordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(100).describe("GPS accuracy circle")
  }),
  deviceFingerprint: z.object({
    deviceId: z.string().min(10),
    isMockLocation: z.boolean().describe("Hasil deteksi mock GPS native Android/iOS"),
    isRootedOrJailbroken: z.boolean().describe("Status keamanan device integrity")
  })
});
```

**Validasi Keamanan Backend:**
1. Jika `deviceFingerprint.isMockLocation === true` atau `isRootedOrJailbroken === true` → Tolak dengan `QR_TOKEN_INVALID` (Status 422).
2. Periksa delta waktu `clientTimestamp` dengan server (maksimal deviasi 10 detik).
3. Hitung jarak Haversine antara `deviceCoordinates` dan koordinat ruang kelas. Jika `jarak > allowedRadiusMeters` → Tolak dengan pesan "Anda berada di luar radius ruang perkuliahan".
4. Verifikasi signature HMAC payload QR dengan Redis key sesi aktif.

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const ScanQrAttendanceResponseDataSchema = z.object({
  attendanceId: UUIDSchema,
  status: z.enum(['PRESENT', 'ABSENT_LATE', 'EXCUSED', 'SICK']),  // UPPERCASE = casing wire kanonik (DATA_MODEL §15).
                                                                  // Scan hanya boleh menghasilkan 4 dari 5 nilai
                                                                  // `attendance_status`; `ABSENT` adalah turunan
                                                                  // akhir sesi, bukan hasil scan. Bentuk lama
                                                                  // `['present','late','absent']` **dilepas** (RD-13/K-13)
                                                                  // karena tidak memuat izin sakit/masalah DB.
  recordedAt: TimestampSchema,
  distanceFromClassMeters: z.number(),
  courseName: z.string(),
  meetingNumber: z.number().int(),
  studentSummary: z.object({
    totalAttendances: z.number().int(),
    attendancePercentage: z.number().min(0).max(100)
  })
});
```

---

#### 4.3.6 POST `/api/v1/attendance/sessions/{sessionId}/challenge` — penerbit tantangan dinamis
**Status: `spec-only`** (tidak ada rute `/attendance/sessions/**/challenge`; yang hidup hanya `/attendance/qr/generate`).

**Badan (Zod, `strict()` — tidak ada field lokasi di sini):**
```typescript
export const AttendanceChallengeRequestSchema = z.object({
  meetingNumber: z.number().int().min(1).max(16),
  teachingTopic: z.string().min(5).max(255),
  learningModality: z.enum(['ONSITE', 'ONLINE', 'BLENDED']).default('ONSITE'),
  sessionKind: z.enum(['REGULAR', 'SYNC_LIVE', 'ASYNC_MODULE', 'PRAKTIKUM', 'UTS', 'UAS', 'SUSULAN']).default('REGULAR'),
  // RALAT 2026-10-20 + 2026-10-21 (DATA_MODEL §21.4, `RD-71`): `teachingMethod`
  // ONSITE/ONLINE_SYNC/ONLINE_ASYNC memuat DUA konsep dan karena itu **kalah**; bentuk
  // final adalah dua sumbu di atas. Klien lama masih boleh mengirim `teachingMethod`
  // selama satu rilis dan server yang memetakan (ONLINE_SYNC -> ONLINE + SYNC_LIVE,
  // ONLINE_ASYNC -> ONLINE + ASYNC_MODULE) — tulis-kanonik hanya lewat dua field ini.
  // Aturan alias: §4.4.1 butir 1-2. Nilai di luar dua enum → 422 (validasi L1).
  ttlSeconds: z.number().int().min(30).max(300).default(60).describe("Durasi sesi membuka tantangan, bukan periodisitas token"),
});
```

**Response `201 Created` (amplop §2.1):**
```json
{
  "success": true,
  "data": {
    "sessionId": "…",
    "classId": "…",
    "windowSeconds": 5,
    "windowIndex": 4821377,
    "algorithmVersion": "totp-hmac-sha256-v1",
    "keyVersion": 3,
    "rotationUrl": "/api/v1/attendance/sessions/…/challenge",
    "displayPayload": "eyJrIjozLCJjIjoi…",
    "expiresAt": "2026-10-19T08:20:00.000Z",
    "geofence": { "source": "ROOM", "allowedRadiusMeters": 50, "wifiRequired": true },
    "sessionState": "OPEN",
    "nextRotationAt": "2026-10-19T08:15:05.000Z"
  },
  "meta": { "timestamp": "…", "requestId": "…", "auditId": "…" }
}
```
> **`sessionState`, bukan `stateMachine`.** Katalog 8 mesin state (`docs/BLUEPRINT_ENTERPRISE.md` §5.2–§5.9, dan enum `machine` pada `StateMachineViewSchema` §2.5) **tidak punya** mesin untuk sesi presensi/banding: SM-1 periode, SM-2 KRS, SM-3 tagihan, SM-4 nilai, SM-5 status mahasiswa, SM-6 yudisium, SM-7 feeder, SM-8 MBKM. Karena §2.5 melarang `machine` di luar daftar itu, respons gugus presensi memakai field `sessionState` biasa dan **tidak** mengarang id mesin. Kontradiksi lama yang harus ditutup Lead Architect: §4.6.6 baris Presensi menulis "**SM-4 penjaga**" padahal `BLUEPRINT §5.5` mendefinisikan SM-4 sebagai **nilai** — lihat §4.3.9 butir 7.

| Field | Aturan |
|---|---|
| `windowSeconds` | **5 detik** — siklus rotasi tantangan (berbeda dari TTL lama 30 dtk di §4.3.1; lihat Δ §4.3.9 butir 5). Nilai ditetapkan server, **tidak dapat** dinaikkan klien. |
| `windowIndex` | Counter diskret monotonik per sesi = `floor(serverEpochSeconds / windowSeconds)`; klien menampilkan QR dari nilai ini, **tidak** menghitung sendiri. |
| `algorithmVersion` | Versi algoritma turunan token (`totp-hmac-sha256-v1`). Klien **tidak** boleh menurunkan versi sendiri; versi tak dikenal → `422 QR_TOKEN_INVALID` (baris 8). |
| `keyVersion` | Rotasi rahasia HMAC per tenant (int). Rahasia **tidak pernah** keluar dari server/secret manager; `keyVersion` hanya memberitahu sisi verifikasi kunci mana yang dipakai. Rotasi terjadwal + jendela transisi 1 `windowSeconds`. |
| `displayPayload` | Isi QR untuk ditampilkan (layar dosen / print). **Bukan** bahan verifikasi tunggal: server memverifikasi challenge aktif milik sesi, bukan apa pun yang dikirim pemindai tentang token. |
| Penerbit | Dosen pengampu kelas itu **atau** koordinator/admin dengan scope `CLASS`/`PROGRAM` yang relevan. Izin `attendance.qr.generate` (`authz.ts:273`, **terdaftar**). **Wajib** L4: `holdsScoped(..., {kind:'CLASS', id: classId})` membuktikan `class_assignments` **sebelum** menandatangani — inilah yang menghilangkan oracle tanda tangan (§4.3.9 butir 1). |

**Enam lapis:** L1 `strict()` tanpa `latitude`/`longitude`/`radiusMeters`/`classId` di badan (semuanya dulu diterima dari body = `SEC-03`) · L2 identitas hanya dari token (`SEC-07`) · L3 permission berbasis tabel (`requireDataPrincipal`, `SEC-10`) · L4 scope `CLASS` dari `class_assignments` (`holdsScoped`, `SEC-11`) · L5 sesi `SCHEDULED`/`OPEN` + jadwal hari itu + periode `OPEN` · L6 RLS.

---

#### 4.3.7 POST `/api/v1/attendance/scan` — pemindaian dengan bukti server-side
**Status: `spec-only` untuk path ini.** Path yang hidup adalah `POST /api/v1/attendance/qr/scan` (§4.3.2); **`/attendance/scan` adalah path final** dan `/attendance/qr/scan` menjadi alias sementara selama migrasi (satu handler, satu kontrak, tanpa dua bentuk badan). Dua rute `spesifikasi-hilang` di §5.3 (`GET /attendance/sessions/:id/stats`, `GET /attendance/history`) **tetap memegang §4.3.3/§4.3.4** — gugus anti-spoofing ini memakai §4.3.6–§4.3.9 justru agar tidak merampas nomor mereka.

**Badan (Zod, `strict()`):**
```typescript
export const AttendanceScanRequestSchema = z.object({
  sessionId: UUIDSchema.describe("Dari QR; wajib dibuktikan ke baris class_sessions milik tenant"),
  challengeToken: z.string().min(16).max(256).describe("Kode hasil render QR, bukan salinan displayPayload utuh"),
  observedWindowIndex: z.number().int().positive().optional().describe("Hanya accelerator; server menghitung sendiri dan memakai selisih sebagai diagnostik"),
  deviceCoordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(100),
  }).describe("Klaim perangkat; TIDAK pernah menjadi satu-satunya dasar jarak"),
  wifiBssid: z.string().max(35).nullable().optional().describe("Diperiksa terhadap allowlist BSSID ruang milik server"),
  deviceProfile: z.object({
    deviceId: z.string().min(10).max(128),
    platform: z.enum(['android', 'ios']),
    appVersion: z.string().max(32),
    attestation: z.string().max(512).optional(),
  }),
  isMockLocation: z.boolean(),
  isRooted: z.boolean(),
  clientTimestamp: TimestampSchema.describe("Untuk diagnostik selisih jam; keputusan memakai waktu server"),
});
```

**Larangan oracle tanda tangan (menutup `SEC-03`).** Tidak ada satu pun rute yang **menandatangani tantangan untuk `classId`/`sessionId` yang dikirim pemanggil tanpa bukti penugasan**, dan tidak ada rute yang mengembalikan bahan token kepada peminta yang bukan penerbit sah. Rute `/attendance/qr/generate` hari ini menerima `sessionId`/`classId`/`latitude`/`longitude`/`radiusMeters` dari body dan hanya memanggil `requirePermission(ctx, PERM.attendanceQrGenerate)` tanpa cek scope — itu oracle tanda tangan: siapa pun dengan izin generik dapat menandatangani QR untuk kelas apa pun di mana pun. Perbaikannya adalah **§4.3.6** (id kelas diturunkan dari `sessionId` + `class_assignments`, koordinat dari `rooms`), bukan penambahan parameter baru di rute lama.

**Verifikasi wajib, berurutan, dan gagal-closed:**
1. **Kepemilikan & scope** (L3/L4): `sessionId` diselesaikan ke baris `class_sessions` **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND id = $1`); mahasiswa harus terdaftar pada kelas itu (`enrollments`) — jika tidak → `403 NOT_YOUR_CLASS` (baris 41). **Anti-IDOR**: tanpa pembacaan ini tidak boleh ada `INSERT`.
2. **Token**: HMAC/TOTP dihitung server atas `(sessionId, keyVersion, windowIndex)` dan dicocokkan dengan **`windowIndex` sekarang ±1** (satu jendela toleransi ke belakang untuk latensi kamera). `algorithmVersion`/`keyVersion` tak dikenal → `422 QR_TOKEN_INVALID` (baris 8).
3. **Replay**: token pada `windowIndex` yang sudah dikonsumsi untuk pasangan (mahasiswa, sesi) ini → `409 SCAN_REPLAY_DETECTED` (baris 62). Penahan terakhir tetap `uq_attendances_session_student` (`packages/database/src/schema/enrollments.ts:92-94`) — scan ganda **tidak pernah** menambah presensi kedua, dan untuk kasus itu respons yang benar adalah `200` dengan baris yang sudah ada (`data.replayed: true`), bukan error, bila statusnya sama; error hanya bila klien mencoba mengubah status lewat scan ulang.
4. **RADIUS DARI KOORDINAT RUANG MILIK SERVER.** Jarak Haversine dihitung antara koordinat **`rooms.latitude`/`rooms.longitude`** (dengan `accuracyMeters` maksimum yang diizinkan) dan klaim perangkat; **`allowedRadiusMeters` tidak pernah dibaca dari body** — sumbernya `tenant_settings`/`rooms` (kolom: DDL `DATA_MODEL.md` §14). Ruang tanpa koordinat valid → `422 ROOM_GEO_UNAVAILABLE` (baris 63) dan **bukan** diloloskan. Klaim perangkat dipakai sebagai pembukti kehadiran, koordinat ruang sebagai pusat lingkaran; `deviceCoordinates` yang dikirim klien **tidak pernah** menjadi pusat.
5. **Wifi**: bila kanal `wifiRequired` aktif, `wifiBssid` wajib ada di allowlist BSSID **ruang** itu — tabelnya **`attendance_network_allowlists`** (nama final, `DATA_MODEL §18.6`, `0041_attendance_antifraud.sql`; ejaan `room_wifi_allowlist` yang pernah ditulis di dokumen ini **kalah** dan tidak dipakai lagi, sesuai vonis `DATA_MODEL §14.8`) → bila tidak → `422 WIFI_NOT_ALLOWED` (baris 64). Yang dibandingkan adalah **`bssid_hash`** (HMAC ber-kunci tenant), bukan plaintext: BSSID adalah data lokasi sehingga plaintext tidak pernah disimpan; allowlist CRUD-nya di §4.6.7 (izin 87–88) dan **tidak pernah** menerima BSSID polos dari body. Kanal IP tetap milik `tenant_settings.attendance_ip_allowlist` (`inet[]`, `DATA_MODEL §14.3`) — dua permukaan, satu maksud, jangan digabung menjadi tabel ketiga.
6. **Integritas perangkat**: `isMockLocation` / `isRooted` / `deviceProfile` tidak cocok dengan registrasi → `422 DEVICE_INTEGRITY_FAILED` (baris 61).
7. **Toleransi jam klien-vs-server**: keputusan **selalu** memakai `serverTime`. `clientTimestamp` hanya diagnostik. Deviasi absolut di atas **10 detik** → tantangan dianggap tidak sah oleh window calculator dan menghasilkan baris 8; deviasi yang membuat `observedWindowIndex` berbeda lebih dari 1 dari perhitungan server → `422 QR_TOKEN_INVALID`, **bukan** koreksi otomatis. Aturan anti-replay tidak boleh bergantung pada jam perangkat: `windowIndex` dihitung dari jam server dan token pada jendela itu hanya berlaku sekali (lihat 3).
8. **Status turunan**: scan hanya boleh menghasilkan `PRESENT` atau `ABSENT_LATE` (anggota enum `attendance_status`, `packages/database/src/schema/enums.ts:128-134`; kolomnya `attendances.status` di `packages/database/src/schema/enrollments.ts:79`). Datang setelah ambang telat sesi → `ABSENT_LATE`. `EXCUSED`/`SICK`/`ABSENT` **tidak dapat** dihasilkan oleh scan (§4.3.9 butir 4).

**Response `200 OK`** — bentuk lama §4.3.2 dipertahankan + empat field yang **wajib** ada agar klien tidak menebak:
```json
{
  "success": true,
  "data": {
    "attendanceId": "…",
    "status": "ABSENT_LATE",
    "recordedAt": "2026-10-19T08:15:30.124Z",
    "distanceFromClassMeters": 41.7,
    "radiusLimitMeters": 50,
    "serverTime": "2026-10-19T08:15:30.100Z",
    "clientServerClockDeltaMs": 820,
    "verifications": { "token": "OK", "window": "OK", "geofence": "OK", "wifi": "OK", "device": "OK", "scope": "OK" },
    "rejected": null,
    "replayed": false,
    "courseName": "Basis Data",
    "meetingNumber": 6,
    "studentSummary": { "totalAttendances": 5, "attendancePercentage": 83.3 },
    "sessionState": "OPEN",
    "remainingChallengeWindows": 12
  },
  "meta": { "timestamp": "…", "requestId": "…", "auditId": "…" }
}
```
Bila ditolak (`4xx`), `error.details[]` memuat **sebab yang dapat tindakan** (mis. `"out_of_geofence"` dengan `distanceFromClassMeters`) — bukan pesan generik — agar layar Mobile dapat menampilkan apa yang harus dilakukan pengguna; nominal/rahasia tidak pernah masuk `details`.

#### 4.3.8 POST `/api/v1/attendance/appeals` + keputusan `VALIDATE` oleh pengampu kelas
**Status: `spec-only`.**

```http
POST  /api/v1/attendance/appeals                        body { sessionId, requestedStatus, reason, attachmentId }  → 201
GET   /api/v1/attendance/appeals                        list §2.4 (page, limit, sortBy, sortDir, q + sessionId, status) → 200
GET   /api/v1/attendance/appeals/{id}                   detail + riwayat keputusan + sessionState (lihat catatan §4.3.6)  → 200
POST  /api/v1/attendance/appeals/{id}/decision          body { decision: "APPROVE" | "REJECT", reason }               → 200
```

| Aturan | Isi |
|---|---|
| Pemohon | Mahasiswa pemilik presensi itu sendiri (`requestedStatus ∈ {EXCUSED, SICK, ABSENT_LATE, PRESENT}` — koreksi terhadap keadaan akhir sesi). Izin pengajuan: **`attendance.appeal.request` — terdaftar sebagai `RBAC_MATRIX §4.5.2` baris 298** (status `usulan`, belum dipromosikan ke `PERMISSION_SPECS`; ralat `RD-73` menutup klaim "belum di katalog"). |
| Penyetuju | **Hanya** dosen pengampu kelas itu (scope `CLASS` dari `class_assignments`), bukan koordinator lain dan bukan admin pusat. `holdsScoped(..., {kind:'CLASS'})` **wajib** dipanggil (hari ini nol call site, `SEC-11`). Izin keputusan: **`attendance.appeal.decide` (verba `VALIDATE`) — terdaftar sebagai `RBAC_MATRIX §4.5.2` baris 299**, MFA + SoD; ralat `RD-73`. |
| SoD | Penyetuju ≠ pemohon **dan** ≠ orang yang mencatat presensi manual pada sesi itu → tolak `403 SELF_APPROVAL_FORBIDDEN` (baris 56). |
| Jendela | Lewat kalender banding → `409 APPEAL_WINDOW_CLOSED` (baris 29). Sudah diputus → `409 DECISION_ALREADY_MADE` (baris 55); transisi banding satu arah (`SUBMITTED → APPROVED / REJECTED / WITHDRAWN`). |
| Bukti | `attachmentId` **wajib** dari §4.8 (`category` baru `attendance_appeal` masih **usulan** di allowlist §4.8.2 — sampai ditambahkan, gunakan kategori yang sudah ada dan catat risikonya di `DATA_MODEL`/`INTEGRATIONS`). Klien tidak mengirim URL (`§4.8.5 butir 6`). |
| Efek approve | **Bukan** `UPDATE attendances.status` bebas: presensi manual/koreksi memakai izin `attendance.record.update` (`authz.ts:277`, terdaftar) dan **wajib** menulis `marked_by` = penyetuju, `notes` = alasan banding, `source` = `MANUAL` (anggota `attendance_source`; `FEEDER_SYNC`/`APP_BULK` bukan jalur banding), `audit_logs`, `meta.auditId`. Status akhir sesi (`ABSENT`) tetap turunan keadaan sesi yang ditutup, bukan ditulis tangan. |
| Enam lapis | L1 `strict()` + enum `requestedStatus` kanonik · L2 identitas dari token (`SEC-07`) · L3 `requireDataPrincipal` · L4 scope `CLASS` untuk penyetuju, `SELF` untuk pemohon · L5 jendela banding + state `SUBMITTED` + periode `OPEN` · L6 RLS `app.current_tenant`. |

#### 4.3.9 Aturan lintas mekanisme presensi (normatif)

1. **Oracle tanda tangan dilarang.** Lihat §4.3.7. Satu-satunya rute yang dapat menghasilkan bahan tantangan adalah §4.3.6, dan hanya untuk sesi yang penerbitnya terbukti pengampu.
2. **`attendances` belum punya kolom token.** Diukur pada `packages/database/src/schema/enrollments.ts:66-99`: kolom yang ada `id, tenant_id, session_id, student_id, status, present, source, marked_at, marked_by, latitude, longitude, distance_meters, is_mock_location, notes, created_at`. **Tidak ada** kolom untuk `windowIndex`/`challengeId`/`keyVersion`/`tokenHash`/`deviceProfile`/`bssid`. Tanpa penahan konsumsi-sekali, replay hanya dapat dicegah di Redis (hilang saat restart) — jadi **perluasan skema wajib** sebelum §4.3.7 bisa diklaim aman. Nama kolom yang **diusulkan** (ejaan final + tipe + indeks adalah milik `DATA_MODEL.md`, DDL: DATA_MODEL §14/§15 slice ADM): `challenge_id uuid`, `window_index int`, `key_version smallint`, `token_hash bytea`, `device_profile jsonb`, `observed_bssid text`, `clock_delta_ms int`. Kolom bssid/koordinat = PII bergerak → retensi & masking tunduk `DATA_MODEL §14.9`.

**Kedudukan kolom-kolom itu (ditegaskan 2026-10-20, jangan dibaca ulang):** semuanya adalah **BUKTI pada baris presensi yang diterima** — jejak yang dibaca auditor, penyusun laporan, dan layar banding. Kolom-kolom itu **bukan penahan sekali-pakai**, dan tidak boleh dirubah menjadi itu: penahan sekali-pakai yang sebenarnya adalah tabel **`attendance_token_uses`** (`DATA_MODEL §18.6`, `0041`) dengan **`UNIQUE (tenant_id, session_id, counter)`**, karena (a) satu `counter` dapat dipakai oleh banyak mahasiswa dalam jendela yang sama sehingga kunci uniknya harus per-sesi-per-counter, bukan per-baris `attendances`; (b) kolom di `attendances` hanya terisi untuk scan yang **diterima**, sedangkan upaya yang **ditolak** (replay, `OUT_OF_FENCE`, `CHALLENGED_FAILED`) justru harus tercatat dan tidak boleh menyentuh baris presensi mana pun; (c) tabel itu tidak menyimpan `secret` maupun 9 digit penuh untuk upaya gagal (`§18.6`), jadi menjadikannya penahan berarti menyimpan bahan pemalsuan mundur. Rute yang "menahan replay" dengan mengecek `token_hash`/`window_index` di `attendances` = bug, bukan desain: itu menghapus jejak penolakan dan membuka celah bagi scan yang statusnya sama (lihat §4.3.7 butir 3 dan §6.10.6 butir 4).
3. **Toleransi jam & replay.** Server tidak pernah mempercayai jam perangkat. `windowIndex` dihitung dari jam server; toleransi ±1 jendela hanya untuk latensi render/kamera; token pada satu `(sessionId, windowIndex)` hanya dapat dikonsumsi sekali per mahasiswa; percobaan kedua → baris 62, bukan presensi kedua. Device clock yang menyimpang >10 detik → baris 8 dengan `details[].field = "clientTimestamp"`; pengguna diarahkan menyinkronkan jam perangkat, bukan diminta mengulang scan.
4. **Enum kanonik & UX state.** `attendance_status` = `PRESENT · EXCUSED · SICK · ABSENT_LATE · ABSENT` (`packages/database/src/schema/enums.ts:128-134`, wire casing UPPER per `DATA_MODEL §15`) dan `attendance_source` = `QR · GEOFENCE · MANUAL · APP_BULK · FEEDER_SYNC` (`enums.ts:137-143`). Kosakata lama `present/late/absent` **dilepas** (`RD-13`). View model LMS (§4.4.1) memakai enum yang sama + keadaan tayangan `NOT_RECORDED` (bukan nilai DB). **Klien tidak boleh menebak keadaan**: setiap respons presensi **wajib** membawa `status` + `sessionState` + `verifications` + `studentSummary` (bukan `stateMachine` — lihat butir 7), dan daftar sesi membawa `attendanceStatus` per pertemuan. Pemetaan label→chip UI ada di `UI_UX_DESIGN.md` §9.8, bukan di kontrak API.
5. **Δ periode rotasi.** Dokumen lama (§4.3.1, `docs/RBAC_MATRIX.md:249`) menulis **TTL 30 detik**; kontrak anti-spoofing di §4.3.6 menetapkan **siklus tantangan 5 detik**. Keduanya bukan hal yang sama: 5 dtk = periodisitas rotasi token, TTL sesi = berapa lama sesi dibuka menerima scan (`ttlSeconds`, default 60, maks 300). Angka 30 dtk sebagai TTL sesi dipertahankan hanya untuk kecocokan rute lama dan **wajib** direkonsiliasi saat implementasi; `docs/RBAC_MATRIX.md:249` menyebutnya "QR rotasi 30 detik" dan itu kini menyesatkan — catat sebagai kontradiksi lintas dokumen yang harus ditutup Lead Architect (bukan wewenang dokumen ini untuk mengubah RBAC).
6. **Presensi massal** tetap tunduk `AGENTS §3.7`: penulisan `attendances` di-**batch flush** oleh worker (`ARCHITECTURE §10.2`), rate limit per kelas di Redis, idempoten per `(studentId, sessionId)`. §4.3.7 **tidak** boleh dijadikan jalur `UPDATE … FOR UPDATE` per scan.
7. **Tidak ada mesin state presensi yang terdaftar — jangan mengarang id.** Katalog `machine` pada `StateMachineViewSchema` (§2.5) hanya memuat SM-1…SM-8 sebagaimana didefinisikan `docs/BLUEPRINT_ENTERPRISE.md` §5.2–§5.9, dan **tidak satu pun** adalah sesi/banding presensi. Karena itu gugus ini memakai `sessionState` biasa. Dua rujukan lama yang **saling bertentangan** dan harus diputuskan Lead Architect (bukan wewenang dokumen ini untuk mengubah `BLUEPRINT`): (a) §4.6.6 baris Presensi menulis "SM-4 penjaga" padahal §5.5 BLUEPRINT menetapkan SM-4 = **nilai**; (b) `docs/RBAC_MATRIX.md` menautkan banding presensi ke jendela kalender tanpa state machine induk. Sampai diputuskan, **tidak** ada respons §4.3.6–§4.3.8 yang membawa `stateMachine` — dan §2.5 butir 3 melarang `blockedBy[].code` di luar §2.3, jadi penolakan banding tetap memakai baris 29/55/56.
8. **Nomor sub-bagian.** §4.3.3/§4.3.4 tetap bebas untuk dua rute `spesifikasi-hilang` di §5.3; gugus ini memakai §4.3.6–§4.3.9 (lihat §4.13).
9. **Kanal daring bukan jalur tulis kedua — §4.18 adalah rumahnya (ditambah 2026-10-20).** Presensi dari sesi `ONLINE`/`BLENDED` **tidak pernah** ditulis lewat rute baru di §4.3; yang ada hanya **bukti** (`attendance_evidence`) yang kemudian direkonsiliasi oleh service penutupan sesi sesuai `attendance.multi_source_policy` (baku `ONSITE_PRIMARY`) di **§4.18.4**. Tiga konsekuensi yang mengikat gugus ini: (a) **satu baris `attendances` per (sesi, mahasiswa)** tetap berlaku di atas semua kebijakan (`uq_attendances_session_student`, CI `DATA_MODEL §21.8(6)`) — §4.3.7 butir 3 tidak boleh dibaca sebagai "khusus luring"; (b) modus sesi (`learning_modality`/`session_kind`) dan ambang (`attendance.online_min_join_ratio`, `attendance.challenge_required`, `attendance.gps_max_accuracy_m`, rotasi TOTP) **dibaca server dari §4.16** — tidak ada satu pun dari itu diterima dari body, dan konstanta keras yang ada hari ini (`dashboard.service.ts:263` `>= 75`, `qr/generate/route.ts:29,65`) adalah **pengecualian tercatat** selama `0049` belum berberkas; (c) laporan webinar **vendor** tidak pernah cukup menjadi hadir (`DATA_MODEL §21.6` butir 3 → `422 EVIDENCE_INSUFFICIENT`, baris 117). Kosakata modus itu sendiri diralat **di tempat** di §4.4.1, bukan di sini.

---

### 4.4 Modul Pembelajaran Daring & SICA Virtual Campus (`/api/v1/lms/*`)

Modul ini mengadopsi arsitektur terintegrasi ala **SEVIMA EdLink** yang menyatukan alur perkuliahan daring (live webinar Zoom & modul asinkron), forum diskusi, kuis CBT, dan auto-rekap nilai ke SIAKAD.

**Bagian ini adalah view model, bukan penegak kehadiran.** Kosakata modus mengikuti `learningModality` + `sessionKind` (`DATA_MODEL §21.4`; ralat di tempat ada di §4.4.1), dan tiga hal yang tadinya tersebar di sini dipindah agar satu keadaan punya satu rumah: (a) **cara peristiwa kehadiran daring masuk** — `POST /api/v1/attendance/events/lms` dan `POST /api/v1/webhooks/lms/{provider}`, dispesifikasi di **§4.18**, bukan di §4.4.2; (b) **ambang yang memutuskan hadir** (`attendance.online_min_join_ratio`, `attendance.min_presence_pct`, `attendance.multi_source_policy`) dibaca **server-side** dari mesin parameter **§4.16**, bukan dikirim klien; (c) **satu-satunya oracle kehadiran daring** adalah peristiwa LMS internal/self-hosted (SICA Virtual Campus, ADR-11), sedangkan Zoom/Meet/Teams bersifat pendukung dengan aturan integritas sendiri (`DATA_MODEL §21.6`, `§4.18.3`) — dan karena itu `virtualRoom.provider` di §4.4.1 hanyalah **tautan masuk**, bukan dasar presensi.

#### 4.4.1 GET `/api/v1/lms/classes/:classId/sessions`
Mengambil daftar 16 sesi pertemuan terstruktur untuk kelas tertentu, lengkap dengan modul materi, tugas, dan link sesi live.

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const LmsSessionListResponseDataSchema = z.array(z.object({
  sessionId: UUIDSchema,
  sequenceNumber: z.number().int().min(1).max(16),
  topic: z.string(),
  learningModality: z.enum(['ONSITE', 'ONLINE', 'BLENDED'])
    .describe("Kanonik (DATA_MODEL §21.4). Sifat kelas/sesi sebagai objek — bukan bentuk pertemuannya."),
  sessionKind: z.enum(['REGULAR', 'SYNC_LIVE', 'ASYNC_MODULE', 'PRAKTIKUM', 'UTS', 'UAS', 'SUSULAN'])
    .describe("Kanonik (DATA_MODEL §21.4). Satu kelas BLENDED punya ketiganya; inilah jawaban 'pertemuan ini berlangsung bagaimana'."),
  deliveryType: z.enum(['ONSITE', 'SYNC_LIVE', 'ASYNC_MODULE']).optional()
    .describe("ALIAS satu rilis untuk kecocokan klien lama — jangan dipakai untuk logika baru; sumber kebenaran = sessionKind. Lihat ralat di bawah."),
  heldOn: z.string(),
  virtualRoom: z.object({
    // Register kanonik: enum `conference_provider` (DATA_MODEL §21.10.1, migrasi 0073). Ejaan lama
    // 'BUILTIN' dan 'TEAMS' = alias kalah (§21.10.2): diterima saat BACA lewat satu mapper, ditolak saat TULIS.
    provider: z.enum(['BUILTIN_LMS', 'BBB', 'JITSI', 'GOOGLE_MEET', 'MICROSOFT_TEAMS', 'ZOOM']),
    joinUrl: z.string().url().nullable(),
    isLiveNow: z.boolean()
  }).nullable(),
  materialsCount: z.number().int(),
  assignmentsCount: z.number().int(),
  attendanceStatus: z.enum(['NOT_RECORDED', 'PRESENT', 'ABSENT_LATE', 'EXCUSED', 'SICK', 'ABSENT'])
  // `NOT_RECORDED` = **tidak ada baris** `attendances` (keadaan tayangan, bukan nilai enum DB);
  // sisanya persis `attendance_status` (DATA_MODEL §15). Nilai lama `LATE` **dilepas** — padanan
  // kanoniknya `ABSENT_LATE` (RD-13). View model LMS tidak boleh punya kosakata status sendiri.
}));
```

**RALAT KOSAKATA DI TEMPAT (2026-10-20, lanjutan `DATA_MODEL §21.4`).** Konsep "bagaimana pembelajaran berlangsung" ditulis **tiga cara** di dokumen ini dan itu terukur: `teachingMethod: offline|online|hybrid` (§4.3.1, lower-case), `teachingMethod: ONSITE|ONLINE_SYNC|ONLINE_ASYNC` (§4.3.6), dan `deliveryType: ONSITE|SYNC_LIVE|ASYNC_MODULE` (blok Zod di atas). Vonis pemilik kosakata (`DATA_MODEL §21.4`) dan cara pembetulan ini diterapkan:

| Field lama | Status | Padanan kanonik | Catatan migrasi |
|---|---|---|---|
| `teachingMethod` `offline` | **alias, dilepas satu rilis** | `learningModality = ONSITE` | `classes.learning_modality` (`0049`); kolom `delivery_mode` lama dituliskan ulang ke `learning_modality` lewat migrasi, lalu alias dihapus |
| `teachingMethod` `online` | **alias** | `learningModality = ONLINE` | modus ini milik **kelas/sesi sebagai objek**, bukan milik satu pertemuan |
| `teachingMethod` `hybrid` | **alias** | `learningModality = BLENDED` | `hybrid` **kalah**; `BLENDED` adalah kosakata kanonik |
| `deliveryType` `ONSITE` | **bukan modus** | `sessionKind = REGULAR` | `deliveryType` menjawab "pertemuan ini berlangsung bagaimana", jadi ia **pemetaan `session_kind`**, bukan `learning_modality` |
| `deliveryType` `SYNC_LIVE` / `ASYNC_MODULE` | **diganti nama** | `sessionKind = SYNC_LIVE` / `ASYNC_MODULE` | nilai lain yang sah di `session_kind`: `PRAKTIKUM`, `UTS`, `UAS`, `SUSULAN` (`DATA_MODEL §21.4`) — tiga nilai lama tidak menutup ruang lingkup ini |
| §4.3.6 `ONLINE_SYNC` / `ONLINE_ASYNC` | **diganti** | `learningModality = ONLINE` **plus** `sessionKind = SYNC_LIVE` / `ASYNC_MODULE` | satu field lama memuat **dua** konsep sekaligus; itu persis alasan kosakata tunggal diminta |

**Aturan yang mengikat kedua sisi kawat (normatif, bukan saran):**

1. **Satu kosakata kanonik, dua dimensi.** `learningModality` ∈ `ONSITE · ONLINE · BLENDED` (sifat kelas/sesi) **dan** `sessionKind` ∈ `REGULAR · SYNC_LIVE · ASYNC_MODULE · PRAKTIKUM · UTS · UAS · SUSULAN` (bentuk satu pertemuan). Keduanya **wajib** dikirim pada respons §4.4.1; `deliveryType` **tidak** lagi menjadi sumber kebenaran walau masih terbawa satu rilis.
2. **Respons lama boleh membawa alias satu rilis, tidak lebih.** Bentuknya: `deliveryType` **dan** `teachingMethod` tetap ada di body dengan nilai **tersuai** (`offline`→`ONSITE`, `hybrid`→`BLENDED`, `SYNC_LIVE`→`sessionKind`), **bersama-sama** dengan field kanonik, plus `meta.deprecatedFields: ["teachingMethod","deliveryType"]` dan header `Deprecation` (RFC 9745) + ` Sunset`. Setelah satu rilis, keduanya **dihapus**; pada titik itu permintaan yang masih mengirim `offline`/`hybrid` dijawab `422 VALIDATION_FAILED` (6) dengan `details[].message` menyebut padanan kanoniknya — **bukan** dipetakan diam-diam selamanya, karena pemetaan diam-diam adalah cara kosakata kedua bertahan hidup (pola `RD-32`).
3. **Klas `A-prime`: kosakata ini bukan kamus.** `learning_modality` dan `session_kind` disimpan sebagai `text + CHECK` tertutup (`DATA_MODEL §21.4`, CI §21.8(8) menuntut 0 baris di luar tiga nilai) dan **tidak dilayani** `GET /master/lookups` (§4.14.1) — nilai yang dapat ditambah kampus adalah **label**-nya, bukan kodenya (`AGENTS §3.10`). Tidak ada `enum_kind` untuk kedua kolom ini di `0049`; yang punya `enum_kind` adalah kunci parameter yang benar-benar kamus, mis. `attendance.multi_source_policy`.
4. **Yang tidak ikut berubah.** Enum `attendance_status`/`attendance_source` tetap milik `DATA_MODEL §15`; `attendance_source` **bertambah** `LMS_ACTIVITY` dan `WEBHOOK_EVENT` lewat `0049` (perluasan enum itu milik DATA_MODEL, bukan keputusan dokumen ini) — pemakaiannya dispesifikasi di **§4.18**, tidak di sini.
5. **Pemetaan PDDikti `F`/`O`/`M` tidak dikarang.** Kode sifat pembelajaran diambil dari `reference_dictionary_entries` + `pddikti_mappings`; selama kamus belum di-*seed*, kolomnya `NULL` dan barisnya **tidak ikut kirim** (I-14, `[VERIFIKASI-KAMUS]` di `DATA_MODEL §21.4`). Daftar sesi §4.4.1 **tidak** mengirim kode Feeder.

---

#### 4.4.2 POST `/api/v1/lms/sessions/:sessionId/progress`
Melaporkan progress belajar modul asinkron (watch-time video atau pembacaan materi) untuk klaim kehadiran otomatis (`BR-A13`).

**Request Body Schema (Zod):**
```typescript
export const TrackProgressRequestSchema = z.object({
  materialId: UUIDSchema,
  watchedDurationSeconds: z.number().int().min(1),
  totalDurationSeconds: z.number().int().min(1),
  isCompleted: z.boolean()
});
```

**Response:** Status 200 OK dengan indikator apakah presensi mahasiswa otomatis ditandai `PRESENT`.

> **Dibatasi 2026-10-20 (rujuk §4.18, jangan diduplikasi di sini).** Angka `watchedDurationSeconds`/`totalDurationSeconds` dari klien adalah **klaim**, bukan bukti: rasio kehadiran dihitung ulang dari **log peristiwa internal** (join/leave/heartbeat 60 detik) di §4.18.2, dan klaim yang tidak cocok dengan log disimpan sebagai selisih diagnostik (`ratioClaimed` vs `ratioComputed`) — bukan sebagai dasar vonis. Untuk `sessionKind = ASYNC_MODULE` tanpa kanal peristiwa (modul pihak ketiga), hasilnya `PENDING_REVIEW` + baris 117 `EVIDENCE_INSUFFICIENT` bila ada yang memaksa vonis hadir. Ambang `attendance.online_min_join_ratio` (baku `0.75`, rentang 0,50–1,00) dibaca **server-side** lewat §4.16.5 dan tidak pernah dikirim klien.

---

#### 4.4.3 POST `/api/v1/lms/assignments/:id/submit`
Mengunggah berkas pengumpulan tugas mahasiswa. Nilai dari dosen/asisten otomatis mengalir ke komponen nilai (`grade_components`) KHS di SIAKAD.

**Request Body Schema (Zod):**
```typescript
export const SubmitAssignmentRequestSchema = z.object({
  fileUrl: z.string().url().describe("Pre-signed upload URL dari S3/R2"),
  studentNotes: z.string().max(1000).optional()
});
```

---

### 4.5 Modul Entitlement & Add-on (`/api/v1/tenant/modules`)
Gerbang paket: tenant hanya dapat mengakses modul yang efektif, bukan sekadar punya izin. Endpoint aktivasi/deaktivasi di bawah adalah **kontrak warisan yang sudah berjalan**, bukan desain akhir lisensi komersial. Target DATA_MODEL §12.3 memisahkan pemberian platform dari preferensi tenant; body `trial`/`seats` pada jalur tenant harus dicabut saat migrasi kontrak tersebut. Sampai itu ditegakkan server dan diuji, Admin IT belum terbukti tidak dapat mengubah lisensinya sendiri.

```http
GET  /api/v1/tenant/modules            → daftar modul + status utk tenant aktif (drives sidebar)
GET  /api/v1/tenant/modules/catalog     → seluruh modul tersedia (katalog global)
POST /api/v1/tenant/modules/:code/activate    → aktifkan add-on (validasi dependensi)
POST /api/v1/tenant/modules/:code/deactivate  → nonaktifkan (tolak bila dipakai modul lain)
```

**Zod (packages/contracts/src/entitlement.ts):**
```ts
export const TenantModuleSchema = z.object({
  code: z.string(), name: z.string(),
  category: z.enum(['CORE','ADDON']),
  status: z.enum(['ACTIVE','TRIAL','DISABLED','EXPIRED','PENDING_PAYMENT']),
  seats: z.number().int().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
});
export const ActivateModuleSchema = z.object({   // nama simbol = `entitlement.ts:57` (RD-22 diralat 2026-10-19)
  seats: z.number().int().positive().optional(),
  trial: z.boolean().default(false),
});
// Padanan `DeactivateModuleSchema` ada di `entitlement.ts:64`. Skema ini tinggal di
// packages/contracts dan **diimpor**, tidak diketik ulang, oleh rute maupun generator OpenAPI
// (AGENTS §3.3). Kolom DB `tenant_modules` memakai snake_case (`valid_to`, `seats`, `activated_by`
// — modules.ts:89-105); `trial` **bukan kolom**, ia keadaan `status='TRIAL'` pada enum
// `tenant_module_status`. Pemetaan dilakukan repository, bukan UI.
```

**Response sukses `GET /tenant/modules` (200):**
```json
{ "success": true, "data": [
  { "code": "enrollment", "category": "CORE", "status": "ACTIVE" },
  { "code": "lms", "category": "ADDON", "status": "ACTIVE", "seats": 1200 },
  { "code": "pmb", "category": "ADDON", "status": "DISABLED" }
], "meta": { "timestamp": "…", "requestId": "…" } }
```

**Error aktivasi `POST /tenant/modules/lms/activate` (422 — prasyarat belum aktif):**
```json
{ "success": false, "error": { "code": "MODULE_DEPENDENCY_UNMET",
  "message": "LMS membutuhkan modul 'teaching' dan 'enrollment' yang aktif.",
  "details": [ { "field": "dependencies", "message": "'enrollment' belum aktif untuk tenant ini." } ] },
  "meta": { "timestamp": "…", "requestId": "…" } }
```

**Aturan HTTP:** 401 tanpa sesi; 403 bila permission/scope tidak cukup, bukan daftar label peran; 422 `MODULE_DEPENDENCY_UNMET`; 409 `MODULE_IN_USE`. Mutasi lisensi target hanya platform; preferensi tenant harus menolak modul tak berlisensi dengan `403 MODULE_NOT_ENTITLED`. Tiap perubahan wajib audit. Gerbang domain mengembalikan `404 MODULE_NOT_AVAILABLE` bila modul tidak efektif; memanggil helper pada sebagian rute belum membuktikan cakupan seluruh endpoint.

---

### 4.6 Modul Administrasi & Data Master (`/api/v1/admin/*`)
> Rujukan kebutuhan: [PRD §5.8](file:///c:/SICA/docs/PRD.md) · objek & DDL: [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md) · struktur menu: [BENCHMARK_SEVIMA.md §4.1](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) · padanan layar Sevima: §2.3/§2.4. **Status: dispesifikasi, belum diimplementasi.**

**Kontrak silang yang berlaku untuk SEMUA rute `/admin/*` (tidak boleh dilanggar):**
1. **4 lapis penegakan** di tiap handler: (a) verifikasi JWT RS256 (`extractRequestContext`), (b) role + **scope** (`user_role_assignments`), (c) `withModule(code)` gerbang entitlement, (d) `withTenantContext` → `set_config('app.current_tenant', …)` sebelum query apa pun. Menambah data tanpa keempatnya = temuan audit.
2. **Envelope standar** §2.1/§2.2. List **memakai kontrak tunggal §2.4**: `page`, `limit`, `sortBy`, `sortDir`, `q` + filter per resource, dengan hasil di `meta.pagination{page,limit,totalRecords,totalPages,hasNextPage,hasPrevPage}`. Bentuk lama `pageSize`/`sort` + `meta.total` **dihapus** (RD-03).
3. **Mutasi hanya ke Primary**; list yang dibaca segera setelah tulis (read-your-writes) **tidak boleh** ke replica (AGENTS §3.7).
4. **Idempotensi** untuk aksi massal: header `Idempotency-Key` (tabel `idempotency_keys` §4) — `Generate Kelas`/`Generate Pertemuan` yang dijalankan ulang tidak boleh menghasilkan baris ganda.
5. **Audit** setiap tulis: `audit_logs(actor, action, resource, before, after, reason)` + pantulkan `auditId` di `meta` respons.
6. Delete master **selalu** lewat dua langkah: `POST …/impact` (baca dependensi) lalu `DELETE`/`PATCH {isActive:false}`. Server menolak `409 REFERENCE_IN_USE` bila ada rujukan (FR-ADM-12).

**Pola CRUD seragam untuk tiap objek master** (diwajibkan agar kontrak, UI, dan generator OpenAPI konsisten):
| Metode & rute | Fungsi | Izin (`resource:verb`) | Modul |
|---|---|---|---|
| `GET /api/v1/admin/<objek>` | list + filter + paginasi | `admin.<objek>:READ` | `academic` |
| `POST /api/v1/admin/<objek>` | buat | `admin.<objek>:INSERT` | `academic` |
| `GET /api/v1/admin/<objek>/:id` | detail | `…:READ` | `academic` |
| `PATCH /api/v1/admin/<objek>/:id` | ubah sebagian (Zod partial) | `…:UPDATE` | `academic` |
| `POST /api/v1/admin/<objek>/:id/deactivate` | nonaktif-soft (preferensi alih-alih hapus) | `…:UPDATE` | `academic` |
| `DELETE /api/v1/admin/<objek>/:id` | hapus keras **hanya** bila belum dirujuk | `…:DELETE` | `academic` |
| `POST /api/v1/admin/<objek>/:id/impact` | pratinjau dependensi sebelum hapus/ubah kunci | `…:READ` | `academic` |

**Rute objek master (nama path final):**
| # | `<objek>` | Catatan khusus |
|---|---|---|
| 1 | `tahun-akademik` (`academic-years`) | label unik per tenant |
| 2 | `periode` (`periods`) | + aksi status di §4.6.2 |
| 3 | `kalender` (`calendar-events`) | `kind` terbatas; `is_mandatory` → `403 CALENDAR_REGULATORY_EVENT` bila dihapus |
| 4 | `organisasi` (`organizations`) | hierarki `parentId`; tolak siklus |
| 5 | `prodi` (`study-programs`) | validasi plafon BR-R2/R3/R4; **hanya boleh mengencangkan** (`422 NATIONAL_CAP_TIGHTEN_ONLY`) |
| 6 | `kurikulum` (`curricula`) | berversi; `gradeScaleId` wajib sebelum kelas dibuat |
| 7 | `matakuliah` (`courses`) | `sks = sksTeori+sksPraktik(+…)`, `CHECK` di kontrak |
| 8 | `prasyarat` (`course-prerequisites`) | anti self-prerequisite, anti siklus |
| 9 | `ekivalensi` (`course-equivalencies`) | butuh `VALIDATE` (persetujuan) |
| 10 | `skala-nilai` (`grade-scales`) + `skala-nilai/:id/bands` | band tumpang tindih → `422 BAND_OVERLAP` |
| 11 | `komposisi-nilai` (`grade-components`) | jumlah bobot ≠ 100 → `422 WEIGHT_SUM_NOT_100` (AC-NIL-4) |
| 12 | `ruang` (`rooms`) | `capacity > 0`; `roomType` enum |
| 13 | `referensi` (`reference-kinds`, `reference-items`) | kamus §14.2; `isSystem` tak boleh hapus. **Kontrak baca/tulis yang melayani ±30 layar ini ada di §4.14** (`/master/lookups` + CRUD `/admin/master/lookups`), bukan di pola §4.6: satu fisik kamus hanya punya satu jalur kontrak |
| 14 | `skema-enrollment` (`enrollment-schemes`) | padanan "Sistem Kuliah" Sevima |
| 15 | `mahasiswa` (`students`) | + `student-biodata` ( alamat/ortu ) — PII, respons ter-masking sesuai peran |
| 16 | `dosen` (`lecturers`), `tendik` (`staff`) | NIDN/NUPTK unik per tenant (bukan global) |
| 17 | `status-mahasiswa` (`student-status`) | `POST …/change` (alasan wajib + approval) & `POST …/bulk` (set semester) |
| 18 | `pengaturan-akademik` (`academic-rules`) | `PUT /admin/pengaturan-akademik` body = `{programId, periodId, params}`; simpan versi baru, jangan `UPDATE` in-place |
| 19 | `pengaturan-tenant` (`tenant-settings`) | format NIM, penomoran, blok tanda tangan, allowlist IP presensi |
| 20 | `pengguna` (`users`), `hak-akses` (`role-assignments`), `sesi` (`sessions`) | **§4.6.9** — CRUD pengguna/peran/penugasan, permintaan hak empat-mata, layanan mandiri `/me/**`; path lama `/admin/access/requests` dibatalkan, bukan dialias |
| 21 | `audit` (`audit-logs`) | **READ-only**; tak ada rute tulis/ubah (AC-AUD-1) |
| 22 | `impor` (`imports`) | §4.6.4 |
| 23 | `kelas` (`classes`), `pengampu` (`class-assignments`), `jadwal` (`schedules`), `pertemuan` (`sessions-generation`) | §4.6.3, domain `teaching` |

#### 4.6.1 Contoh — list data master (bentuk §2.4, berlaku untuk seluruh objek di tabel §4.6)
`GET /api/v1/admin/study-programs?page=1&limit=25&sortBy=name&sortDir=asc&q=si&jenjang=S1`
```json
{ "success": true,
  "data": [ { "id":"…","code":"IF","name":"S1 Teknik Informatika","level":"S1",
              "pddiktiCode":"12345","accreditationStatus":"UNGGUL","accreditationExpiresOn":"2028-12-01",
              "minTotalSks":"144.0","maxStudySemesters":16,"deliveryMode":"ONSITE","isActive":true } ],
  "meta": { "timestamp":"…", "requestId":"…",
            "pagination": { "page":1, "limit":25, "totalRecords":61, "totalPages":3,
                            "hasNextPage": true, "hasPrevPage": false },
            "auditId": null } }
```

Contoh di atas **sengaja** memakai bentuk baru. Bentuk lama yang masih tertinggal di dokumen ini sebelum RD-03 ditutup (`?pageSize=25` dan `"meta":{"page","pageSize","total"}`) tidak boleh disalin ke rute mana pun; `sortBy=name` juga hanya sah karena `name` ada di allowlist `admin/study-programs` (§2.4d).

**Jumlah objek master (meluruskan angka "23 objek", K-27).** Angka **23** di tabel rute §4.6 adalah **jumlah baris**, bukan jumlah objek. Baris 10, 13, 15, 16, 20, dan 23 masing-masing menamai lebih dari satu objek, sehingga tabel itu sebenarnya memuat **32 objek** (`academic-years` … `sessions-generation`, terhitung baris demi baris). Katalog izin atomik di kode lebih luas lagi: **51 resource** berprefiks `admin.*` terdaftar di `packages/contracts/src/authz.ts` (`resource: 'admin.…'`, termasuk gugus keuangan, persuratan, yudisium, dan penyelenggaraan yang tidak muncul di tabel §4.6). Konsekuensi yang mengikat: setiap objek — bukan setiap baris — punya resource izin sendiri (`admin.<objek>:VERBA`), dan generator kontrak/OpenAPI menghitungnya per objek.

#### 4.6.2 Transisi status periode (gerbang semua operasi tulis)
`POST /api/v1/admin/periode/:id/status` body `{ "status": "OPEN" | "CLOSED", "reason": "…" }`
| Dari → Ke | Aturan | Error bila dilanggar |
|---|---|---|
| `DRAFT → OPEN` | kalender + prodi + kurikulum + minimal 1 kelas siap | `422 PERIOD_NOT_READY` (daftar penyebab dari §14 FR-ADM-10) |
| `OPEN → CLOSED` | tidak ada nilai `DRAFT` tertinggal **atau** disertai `reason` + `acknowledge` | `409 PERIOD_HAS_OPEN_DRAFT_GRADES` |
| `CLOSED → OPEN` | **wajib** `period_reopen_requests` di-approve (BR-A9/R10) | `403 REOPEN_REQUIRES_APPROVAL` |
> Setelah `CLOSED`, seluruh rute tulis domain menolak `423 PERIOD_CLOSED` (bukan hanya menyembunyikan tombol — PRD P5).

#### 4.6.3 Aksi massal khas Admin (benchmark §2.4c/d/e)
| Rute | Aksi | Jaminan |
|---|---|---|
| `POST /api/v1/admin/kelas/generate` | buat N kelas paralel dari (periode, prodi, kurikulum/matakuliah, daya tampung) | idempoten + nama kelas A/B/C deterministik; `409` bila `maxParallelClasses` terlampaui |
| `POST /api/v1/admin/pertemuan/generate` | buat `class_sessions` 1..n, **lewati hari libur** dari `academic_calendar_events` | satu transaksi per kelas; hasil `{created, skipped}` |
| `POST /api/v1/admin/jadwal/validate` | uji bentrok dosen+ruang tanpa menyimpan (AC-JDW-1) | kembalikan daftar irisan (nama, rentang) |
| `POST /api/v1/admin/pengampu` | `bulk` penugasan dosen | tolak `422 LECTURER_WORKLOAD_EXCEEDED` (BR-A11 maks 16 SKS) |
| `POST /api/v1/admin/status-mahasiswa/bulk` | aktif/cuti/non-aktif set per semester | alasan wajib + approval + audit |
| `POST /api/v1/admin/nilai/kunci` / `/umumkan` | kunci/membuka & umumkan massal | membuka kunci nilai `EFFECTIVE` butuh `VALIDATE` + alasan |
| `POST /api/v1/admin/nilai/hitung-ulang` | recalc IP/IPS/IPK/transkrip kelas | tulis snapshot baru, **bukan** `UPDATE` diam-diam (P3) |

#### 4.6.4 Impor & rekonsiliasi master data (FR-ADM / AC-MIG-1)
```
POST /api/v1/admin/impor/validate     (body: {attachmentId, objek, dryRun:true})
POST /api/v1/admin/impor/commit       (body: {importId, mode:"CREATE|UPSERT"})
GET  /api/v1/admin/impor/:id          → { barisSumber, terimpor, ditolak, alasan[] , deviasiIpk }
```
- Urutan dependensi dipaksakan server: prodi → kurikulum → matakuliah → prasyarat → dosen → mahasiswa → kelas → jadwal.
- Batas: ≤ 20.000 baris/berkas; prosess per-batch 500 baris dalam transaksi terpisah; gagal total tidak meninggalkan state setengah-jadi (NFR-U1).
- Berkas impor **tidak dikirim sebagai multipart ke rute ini**: klien meminta presign §4.8 dengan `category=import`, PUT ke object storage, lalu `POST /admin/imports/validate` membawa `attachmentId`. Badan `multipart` di blok rute di atas adalah bentuk lama yang ditinggalkan (satu jalur unggah saja).
- File disimpan di object storage dengan akses sementara; **PII tidak pernah masuk log** (Pino redaction, AGENTS/SECURITY).

#### 4.6.5 Kode error khas administrasi — sudah berpindah ke register §2.3
Tabel paralel di sub-bagian ini **dihapus** karena menjadi sumber kedua kebenaran (RD-12): dulu §2.3, §4.6.5, dan §4.6.6 memelihara tiga daftar yang tidak pernah cocok. Kesepuluh kode gugus administrasi kini bernomor tetap di **§2.3**:

| Kode | Baris §2.3 | HTTP |
|---|---:|---:|
| `ADMIN_SCOPE_MISMATCH` | 16 | 403 |
| `CALENDAR_REGULATORY_EVENT` | 17 | 403 |
| `REOPEN_REQUIRES_APPROVAL` | 18 | 403 |
| `REFERENCE_IN_USE` | 19 | 409 |
| `MAX_PARALLEL_CLASSES_EXCEEDED` | 20 | 409 |
| `NATIONAL_CAP_TIGHTEN_ONLY` | 21 | 422 |
| `BAND_OVERLAP` | 22 | 422 |
| `WEIGHT_SUM_NOT_100` | 23 | 422 |
| `LECTURER_WORKLOAD_EXCEEDED` | 24 | 422 |
| `PERIOD_CLOSED` | 25 | 423 |

> Modul entitlement yang belum aktif **tidak** memakai kode baru: tetap **404 `MODULE_NOT_AVAILABLE`** (baris 26) sesuai §4.5, `packages/contracts/src/entitlement.ts::ModuleNotAvailableCode`, dan `TECH_CONVENTIONS` (`withModule`). Menambah `424 MODULE_INACTIVE` akan menciptakan dua kode untuk satu kondisi.

#### 4.6.6 Rute gelombang enterprise (dari [BLUEPRINT §3 & §5](file:///c:/SICA/docs/BLUEPRINT_ENTERPRISE.md)) — disusun 2026-10-19, belum diimplementasi
Pola seragam §4.6 (`list → drawer`, aksi eksplisit, empat-mata untuk `VALIDATE`) berlaku penuh di sini. **Tidak ada rute di bawah yang boleh dibuat sebelum baris izinnya ada di [RBAC_MATRIX §4](file:///c:/SICA/docs/RBAC_MATRIX.md)** — beberapa bergantung penutupan celah `K-1`…`K-5` (sel noted).

| Gugus | Rute | Aksi & penjaga | Catatan kontrak |
|---|---|---|---|
| Periode | `POST /admin/periods/:id/reopen` | `VALIDATE` + badan `{type:1 ATAU 2, reason, evidenceUrl}`; `TENANT_ADMIN` **tidak** boleh reopen hasil karyanya sendiri → SM-1 | tolak `403 REOPEN_REQUIRES_APPROVAL` bila `access_change_requests` belum `APPROVED` |
| KRS | `POST /admin/krs/dispense` | `VALIDATE` (`enrollment.krs.dispense`) — **butuh K-1** | wajib `reason ≥ 10 char`, menghasilkan baris `academic_rule_overrides` + notifikasi mahasiswa (AC-AKA-1) |
| KRS | `POST /admin/krs/amendments` · `POST /admin/krs/amendments/:id/approve` | `INSERT` pemohon / `VALIDATE` penyetuju; dua actor berbeda (SoD) | `enrollments` tidak pernah diubah in-place; amendment = riwayat |
| Presensi | `POST /admin/attendance/appeals` · `POST /admin/attendance/appeals/:id/decision` | mahasiswa `INSERT`; **dosen pengampu kelas itu** `VALIDATE` (scope `CLASS`) | SM-4 penjaga; menolak bila melewati tanggal kalender → `409 APPEAL_WINDOW_CLOSED` |
| Kartu ujian | `POST /admin/exam-cards/generate` (per kelas/periode) · `GET /admin/exam-cards/:id/pdf` | `OTHER` (`generate`, `print`) | prasyarat: enrolled + presensi ≥ BR-A15 + gerbang keuangan lolos; QR digest per AC-DOC-1 |
| Penilaian | `POST /admin/grades/:classId/publish` (umumkan) · `POST .../lock` · `POST .../unlock` · `POST .../recompute` | `UPDATE` untuk publish/lock, **`VALIDATE` untuk unlock & recompute ter-audit** — `unlock` hari ini tersimpan `UPDATE` (**K-5**) | unlock wajib menyertakan `correctionRequestId`; tanpa itu `409 GRADE_LOCKED_USE_CORRECTION_WORKFLOW` |
| Penilaian | `GET/POST /admin/grade-components/:classId/scores` | `READ`/`INSERT` nilai **per komponen** (bukan hanya agregat) | memisahkan skor mentah vs konversi band (FR-ADM-16) |
| MBKM | `POST /admin/mbkm/contracts` · `POST /admin/mbkm/contracts/:id/approve` (prodi) · `POST .../approve-mitra` (koordinator) · `POST /admin/mbkm/logs/:id/validate` · `POST /admin/mbkm/conversions` | SM-8 dua-approval; konversi memakai `course_equivalencies` + plafon BR-M1 | `422 MBKM_SKS_CAP_EXCEEDED` saat konversi melewati 20 SKS/semester |
| Clearance | `POST /admin/clearances/:studentId/dimensions` · `POST /admin/clearances/:id/close` | pengelola tiap dimensi `UPDATE`; penutupan hanya bila semua dimensi selesai | dimensi `STUDENT_AFFAIRS` hanya muncul bila modul aktif — jangan buat blockers hantu (AC-KBM-1) |
| Kelulusan | `POST /admin/graduation/eligibility-check` · `POST /admin/graduation/:id/yudisium` · `POST .../sign` · `POST .../pisn` | `VALIDATE` berjenjang Kaprodi → **`DEKAN`** (G-13) → Rektorat; TTE per BR-R15 | setiap panah SM-6 = 1 transaksi + 1 `audit_logs` + 1 `outbox` |
| Feeder | `POST /admin/feeder/validate` · `POST /admin/feeder/push` · `GET /admin/feeder/runs/:id` · `POST /admin/feeder/corrections` | `OTHER` (`validate`, `push`) + `VALIDATE` koreksi (SM-7) | `push` menahan kirim selama ada temuan `BLOCK` (AC-FDR-2); retry memakai `bridge_id` + `error_code=100` |
| Impor | `POST /admin/imports/validate` · `POST /admin/imports/commit` | **dua izin berbeda** (`platform.import.validate`, `platform.import.commit`) — **butuh K-2** | menggantikan/normalisasi §4.6.4 agar satu jalur, bukan dua |
| Hak akses | **lihat §4.6.9** (kontrak penuh, 34 rute) | empat-mata, `VALIDATE`; penolakan wajib `reason` (**AC-ADM-6**) | rute lama `/admin/access/requests` **dibatalkan**, bukan dialias: satu path harus punya satu pemilik kontrak. Persetujuan memakai `POST /api/v1/admin/permintaan-hak/:id/approve`; penolakan memakai izin `VALIDATE` yang sama (vonis `RBAC §4.5.1`), bukan kode kedua |

**Kode error gugus ini** tidak lagi didaftar di sini — semuanya sudah masuk register tunggal §2.3 (baris 29–35: `APPEAL_WINDOW_CLOSED`, `MBKM_SKS_CAP_EXCEEDED`, `GRADUATION_GATE_UNRESOLVED`, `FEEDER_BLOCKING_FINDINGS`, `PDDIKTI_CORRECTION_REQUIRED`, `DEKAN_SCOPE_REQUIRED`, plus `GRADE_LOCKED_USE_CORRECTION_WORKFLOW` yang selama ini hanya hidup di tabel rute di atas).

Angka lama **"11 kode asli + 6 baru = 17" adalah salah dan dihapus** (K-5). Hasil hitung langsung atas berkas ini sebelum koreksi: **10** baris di §2.3 + **10** baris di §4.6.5 + **6** kode di prosa §4.6.6 + **3** kode entitlement di §4.5 + **1** kode di tabel rute §4.6.6 = **30** kode terdokumentasi. Register §2.3 hari ini memuat **41** baris karena menyerap **11** kode yang selama ini dipakai/diklaim tanpa pernah masuk register: 5 kode generik yang benar-benar dikirim aplikasi (baris 11–15), 6 kode yang dipakai/diisyaratkan dokumen lain (baris 36–41). Selisih 41 − 30 = 11. ✅ **Angka 41 itu sendiri sudah lewat zaman:** register §2.3 hari ini memuat **106** baris (66–78 gugus engine gelombang 1, 79–91 gugus engine gelombang 2 §6.10 dan objek institusi §4.6.7, 92–106 gugus kamus dinamis & atribut kustom §4.14 plus sisa keadaan gelombang 2). Jangan mengutip "41" — atau "91" — sebagai ukuran terkini.

#### 4.6.7 Set CRUD & approve objek gelombang 2 (multi-kampus, jenis TA 53/2023, matriks tarif, OBE, kendala jadwal, ketersediaan dosen, auto-fix Feeder) — disusun 2026-10-20

**Status: `spec-only` seluruh gugus ini.** Yang **sudah ada** adalah DDL-nya (`DATA_MODEL §18.2`–`§18.8` dan `§19.1`–`§19.4`, ditulis 2026-10-20, bernomor `0037`–`0046`); yang **belum ada** adalah (a) berkas migrasi di `packages/database/migrations/`, (b) satu pun `route.ts` di bawah `apps/web/src/app/api/v1/admin/**` (terukur: `find apps/web/src/app/api/v1 -name route.ts` tidak menghasilkan satu pun berkas di bawah `admin/`), dan (c) promosi izin — nomor **51–126** di `RBAC_MATRIX §4.5` berstatus **usulan**, jadi rute di bawah **tidak boleh** dikode sebelum izinnya masuk `PERMISSION_SPECS` (`G-15`, AGENTS §3.8). Semua baris mengikuti pola CRUD §4.6 (`list` lalu `drawer`, `POST …/impact` sebelum hapus/ubah kunci, `deactivate` alih-alih hard delete, `409 REFERENCE_IN_USE` bila dirujuk) dan kontrak list §2.4.

| Objek & path final | Metode & aksi | Izin (`RBAC_MATRIX §4.5`, nomor) | Migrasi (`DATA_MODEL §14.7`) | Penjaga kontrak yang mengikat |
|---|---|---|---|---|
| `campus_sites` — `/api/v1/admin/sites` | `GET` list, `POST`, `GET /:id`, `PATCH /:id`, `POST /:id/deactivate`, `DELETE /:id`, `POST /:id/impact` | `academic.site.view`, `.create`, `.update`, `.deactivate` (108–111) | `0044_institution_sites.sql` | `code` unik per tenant; site masih punya ruang aktif → **`409 REFERENCE_IN_USE` (baris 19)**, bukan kode baru; `feeder_kode_pt` **tidak boleh** berbeda antar site — multi-site **tidak** punya bentuk resmi di PDDikti dan itu ditampilkan sebagai batas, bukan fitur (`DATA_MODEL §19.1`) |
| Penugasan scope `SITE` — **lihat §4.6.9** | `PATCH` (satu metode, kontrak penuh di §4.6.9) | `identity.assignment.scope` (112, **usulan — belum di `PERMISSION_SPECS`**) | `0044` (ALTER `user_role_assignments`) | **Lapis L4 baru**: `holdsScoped(access, PERM.x, { kind:'SITE', id: siteId })`. Tanpa dimensi ini, "hak hanya di kampus cabang" tidak dapat dinyatakan; satu pengguna = banyak penugasan per site |
| Jenis program — **tanpa tabel baru**: `/api/v1/admin/reference-kinds/jenis_program/items` + kolom `program_type` dan `delivery_mode` | `GET`, `POST`, `PATCH` (label lokal) | `academic.programtype.view`, `.manage` (113–114) | `0044` (ALTER `study_programs`, `classes`, `enrollments`) | **Vonis model:** `program_types` **kalah** — kamus nasional satu rumah di `reference_items(kind='jenis_program')` (`DATA_MODEL §14.8`); rute kembar dilarang. Label = `text` + `CHECK`, **bukan** enum baru. Aturan lintas field (`PJJ` memaksa `delivery_mode='ONLINE'`, geofence tidak berlaku) = **`422 ACADEMIC_RULE_VIOLATION` (baris 7)**, bukan kode baru. `enrollments.program_type` adalah **`SERVER_ONLY`** (disalin dari `classes` saat daftar, tidak pernah dibaca dari body, tidak dihitung ulang di laporan) |
| `final_project_kinds` — `/api/v1/admin/final-project-kinds` | CRUD + `POST /:id/approve` (`VALIDATE`) | `thesis.projectkind.view`, `.insert`, `.approve` (115–117) | `0045_final_project_kinds.sql` | gerbang modul `thesis` non-`ACTIVE` → `404 MODULE_NOT_AVAILABLE` (26) memotong **sebelum** peran; jenis TA adalah **data** — `feeder_jenis_ta` kosong berarti **tidak ikut kirim** (I-14), bukan "pakai kode terdekat"; empat-mata `TENANT_ADMIN` bukan pembuat → `403 SELF_APPROVAL_FORBIDDEN` (56) |
| `final_project_outputs` — `/api/v1/admin/final-project-outputs` | `GET`, `POST`, `GET /:id`, `POST /:id/validate` (`VALIDATE`), `POST /:id/retract` | `thesis.projectoutput.view`, `.create`, `.validate` (118–120) | `0045` | `attachmentId` **wajib** dari §4.8 (klien tidak mengirim URL); `validatedBy` = orang kedua, bukan pembimbing; transisi TA ke `PASSED` tanpa luaran tervalidasi → **`409 PROJECT_OUTPUT_REQUIRED` (baris 91)** |
| `fee_tariff_groups` — `/api/v1/admin/fee-tariff-groups` | CRUD + `POST /:id/deactivate` | `finance.tariffgroup.view`, `.create` (121–122) | `0046_tuition_tariff_matrix.sql` | satu `payableTo` per komponen; `glAccountCode` kosong = posting jurnal mustahil (tolak `ACTIVE`); nominal **tidak** terbaca oleh peran akademik tanpa hak — proyeksi server, bukan CSS |
| `tuition_tariff_matrix` — `/api/v1/admin/tuition-tariff-matrix` | `GET` list, `POST` draf, `PATCH /:id` versi baru, `POST /:id/approve` (`VALIDATE`), `POST /:id/retire`, `GET /resolve-preview`, **`POST /preview`** (§4.6.8) | `finance.tuitionmatrix.view`, `.insert`, `.update`, `.approve` (123–126) | `0046` | **`amountRupiah` adalah `SERVER_ONLY`: nominal hanya berubah lewat jalur `APPROVE`**, tidak pernah diterima dari `PATCH`; kunci identik → `409 CONFLICT` (12) karena `UNIQUE` memakai `COALESCE` (NULL tidak pernah bertabrakan dengan NULL); `approve` oleh `requestedBy` sendiri → `403 SELF_APPROVAL_FORBIDDEN` (56), ditegakkan ganda oleh `CHECK` DB; resolusi **dua baris sama-spesifik** → `409 TARIFF_RULE_AMBIGUOUS` (105); **nol baris cocok** → `422 TARIFF_NO_MATCH` (106) — generator tagihan dilarang menebak nominal terdekat atau menulis 0; gugus ini **tertahan di `0021`** (`pmb_paths` dan `pmb_waves` belum dieksekusi), bukan di `0046` |
| `assessment_rubric_bands` — `/api/v1/admin/assessment-indicators/:indicatorId/rubric-bands` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` | `assessment.rubricband.view`, `.create`, `.delete` (93–95) | `0042_obe_attainment_loop.sql` | rentang tumpang tindih → **`422 BAND_OVERLAP` (baris 22)** dipakai ulang (penegak utama `EXCLUDE USING gist`); `attainmentNum` 0 sampai 1; band yang sudah dipakai indikator aktif **tidak** dihapus — nonaktifkan |
| `cpl_targets` — `/api/v1/admin/cpl-targets` | `GET`, `POST`, `PATCH /:id`, `POST /:id/approve` (`VALIDATE`) | `academic.obe.target.view`, `.insert`, `.approve` (96–98) | `0042` | target capaian = kebijakan mutu → penyetuju bukan pengusul (56) + MFA penulis-admin; `minCoverage` baku 0.800; tanpa target, `recompute` atau usulan tindak lanjut → **`422 OBE_TARGET_MISSING` (baris 89)** |
| `obe_closing_actions` — `/api/v1/admin/obe-closing-actions` | `GET` list §2.4, `POST`, `POST /:id/approve` (`VALIDATE`), `POST /:id/complete`, `POST /:id/drop` | `academic.obe.closing.view`, `.propose`, `.approve` (101–103) | `0042` | `gapBp > 0` **wajib** (tidak ada "sedikit di bawah" tanpa angka); `ownerMembershipId` + `dueDate` wajib saat approve; `nextCycleAttainmentId` = bukti loop tertutup; `rootCause` menunjuk indikator terukur, bukan kalimat umum |
| `timetabling_constraint_defs` — `/api/v1/admin/timetabling-constraints` | `GET`, `POST`, `PATCH /:id` (versi baru), `POST /:id/approve` (`VALIDATE`), `GET /:id/impact` | `teaching.timetable.constraint.view`, `.insert`, `.update`, `.approve` (51–54) | `0037_timetabling_csp.sql` | `PATCH` atas versi `ACTIVE` **ditolak** — buat `version` baru + `effectiveFrom`/`effectiveTo`; `kind='HARD'` dengan `weightBp` terisi → `422 VALIDATION_FAILED` (6) karena `CHECK` DB menolaknya; kendala = kewenangan akademik, jadi penulis-peran-admin wajib MFA |
| `lecturer_availability` — `/api/v1/admin/lecturer-availability` | `GET` list (filter `lecturerMembershipId`, `dayOfWeek`, `siteId`), `POST` deklarasikan, `PATCH /:id`, `DELETE /:id`, `POST /import` | `teaching.availability.view`, `.declare`, `.import` (60–62) | `0037` | `slot` = `int4range` menit-ke-menit; tumpang tindih hari yang sama → `409 CONFLICT` (12) (`EXCLUDE USING gist`); dosen hanya dapat mendeklarasikan **miliknya sendiri** (L4 `SELF`); `POST /import` **tidak boleh** mengatasnamakan dosen — sumber ditandai `IMPORTED`, `DERIVED_FROM_SCHEDULE`, atau `BKD_PLAN` |
| `feeder_autofix_rules` — `/api/v1/admin/feeder-autofix-rules` | `GET`, `POST`, `PATCH /:id` (versi baru), `POST /:id/approve` (`VALIDATE`), `POST /:id/test` (dry-run tanpa tulis) | `feeder.autofixrule.view`, `.insert`, `.update`, `.approve` (76–79) | `0040_feeder_autofix.sql` | `sourceRef` **wajib** (aturan tanpa sumber regulasi/kamus tidak dapat `ACTIVE`); `kind` `SEMANTIC`, `BLOCKING`, atau `IDENTITY` dengan `fixExpr` → **`422 AUTOFIX_EXPR_FORBIDDEN` (baris 83)**; `checkExpr` memakai **pohon kondisi RETE yang sama** dengan harness `0036` (satu interpreter, bukan dua); `POST /:id/test` tidak pernah menulis state |
| Usulan & penerapan auto-fix — `/api/v1/admin/feeder-autofix-suggestions` | `GET` list §2.4 (filter `runId`, `verdict`, `domain`), `GET /:id`, `POST /apply`, `POST /:id/revert` | `feeder.autofix.view`, `.apply`, `.revert` (80–82) | `0040` | penerapan **hanya** menyentuh kolom staging, **tidak pernah** `students`, `enrollments`, atau `grades`; idempoten per `(runId, stagingTable, stagingId, columnName, ruleId)`; sisa `REVIEW` atau `NO_MATCH` pada kolom wajib → **`422 AUTOFIX_REVIEW_REQUIRED` (baris 82)** dengan `details[]` per record; `push` Feeder tetap `409 FEEDER_BLOCKING_FINDINGS` (32); revert **tidak** menghapus jejak |
| Pencocokan identitas Feeder — `/api/v1/admin/feeder-identity-matches` | `GET` list, `POST /:id/confirm` (`VALIDATE`), `POST /:id/reject` | `feeder.identity.view`, `.confirm` (83–84) | `0040` | **tidak ada satu pun rute yang menulis `feeder_id`** (I-14): id pusat hanya masuk dari respons *bridge* ke `feeder_identities`; tabelnya secara bentuk skema tidak punya kolom tersebut. Skor + `margin` + `blockedBy` selalu ikut agar keputusan dapat dijelaskan |
| Airmen sinkron Feeder — `/api/v1/admin/feeder-sync-watermarks` | `GET` list (lihat), `GET /:id`, `POST /:id/force-full`, `POST /:id/reset` | `feeder.watermark.view`, `.force` (85–86) | `0040` | airmen **hanya** maju atas baris yang benar-benar `SUCCEEDED` — me-`reset` airmen untuk run gagal **dilarang**; `force-full` menulis `forcedFullAt` + audit ganda + **konfirmasi tersurat** karena risikonya kirim ulang massal (membakar kuota vendor); badan `force-full` = `{ domain, entity, reason }`, tidak ada field lain |
| Allowlist jaringan ruang — `/api/v1/admin/attendance-network-allowlists` | `GET` list, `POST`, `PATCH /:id` (`validFrom`/`validTo`), `DELETE /:id` | `attendance.allowlist.view`, `.manage` (87–88) | `0041_attendance_antifraud.sql` | **BSSID plaintext tidak pernah diterima dari body**: klien mengirim `wifiBssid` hanya pada rute scan (§6.10.6) dan server yang meng-HMAC-nya; entri allowlist mengikuti `site` lewat `roomId`; nilai hash tidak dapat dibalik, jadi ia bukan rahasia — tapi tetap PII bergerak |
| Versi model EWS — `/api/v1/admin/ml-models` | `GET` list, `GET /:id`, `POST /train`, `POST /:id/approve` (`VALIDATE`), `POST /:id/retire` | `academic.mlmodel.view`, `.train`, `.approve`, `.retire` (69–72) | `0039_ews_risk_models.sql` | `artifact`, `features`, `metrics`, `calibration`, `fairness`, `trainedBy`, `approvedBy`, `status` semuanya **`SERVER_ONLY`** — badan `POST /train` hanya `{ task, version, trainWindow, features[], family, budget }`; ambang mutu gagal → **`422 MODEL_QUALITY_GATE_UNMET` (80)**; atribut terlarang → **`422 MODEL_FEATURE_DENYLISTED` (81)**; data latih tidak pernah lintas-tenant; `retire` = `UPDATE` status, hard-delete riwayat model dilarang |
| Skor risiko & tindak lanjut EWS — `/api/v1/academic/risk-scores` (baca), `/api/v1/academic/study-warnings/:id/follow-up` (tulis) | `GET` list §2.4, `GET /:id`, `POST …/follow-up` | `academic.ews.snapshot.view` (68), `academic.ews.risk.view` (73), `academic.ews.followup.update` (75) | `0039` (ALTER `study_warnings` dari `0016`) | `risk_scores.score`, `band`, `topFactors`, `hardTriggers`, `degraded`, `modelId` adalah **`SERVER_ONLY`** — tidak ada rute yang menerima skor dari klien; penutupan `study_warnings` memakai enum `resolvedOutcome` yang terdaftar; skor **tidak pernah** mengubah `students.status_akademik`, gerbang KRS, atau tagihan |
| Catatan wali — `/api/v1/admin/advisor-notes` dan `GET /api/v1/academic/advisor-notes?studentId=` | `GET` list, `POST`, `PATCH /:id` | `academic.advisornote.view`, `.create`, `.update` (65–67) | `0038_advisor_recommendations.sql` | **`visibility` = `SERVER_ONLY`**, baku `ADVISOR_ONLY`; nilai `ADVISOR_ONLY` **tidak pernah** diproyeksikan ke peran `STUDENT` (proyeksi server, bukan menyembunyikan sel); ubah visibilitas ke `STUDENT_VISIBLE` ter-audit dan hanya oleh pemilik catatan; L4 `SELF` untuk mahasiswa, scope bimbingan untuk wali |
| Jangkar rantai audit — **lihat §4.21** | — | `audit.anchor.view` (104), `audit.anchor.seal` (105) | `0043_audit_chain_anchors.sql` | **dipindah 2026-10-22 (siklus M-05, `RD-121`)**: gugus ini dulu menuliskan daun rutenya sebagai kalimat, sehingga tidak terhitung alat dan tidak punya pemegang kontrak; daftar lengkap + gerbang ada di §4.21. Sisi yang tetap berlaku di sini: `rootHash`, `prevAnchorRoot`, `sealedAt`, `sealedBy`, `storageKey`, `leafFrom`, `leafTo` semuanya **`SERVER_ONLY`**; segel hanya `PLATFORM_OPERATOR`; jangkar luar = object storage WORM milik sendiri — **tanpa TSA RFC 3161** (zero-API-key, `ARCHITECTURE §12.9`) |
| Verifikasi rantai — **lihat §4.21** | — | `audit.verify.run` (106), `audit.verify.view` (107) | `0043` | **dipindah 2026-10-22 (`RD-121`)**; semantik engine tetap di §6.10.8, kontrak HTTP tetap di §4.21. Norma yang tidak berubah: **tidak ada izin "repair"** dan tidak akan pernah ada — rute yang menghitung ulang hash = pemalsuan; temuan `CHAIN_GAP`, `CHAIN_BRANCH`, atau `HASH_MISMATCH` → **`409 AUDIT_CHAIN_COMPROMISED` (baris 90)**; pembaca `audit-logs` **tidak** otomatis boleh menjalankan verifier (dua izin terpisah, `§4.6c` butir c) |

**Kolom `SERVER_ONLY` gugus ini (tidak pernah diterima dari body — `strict()` menolak, bukan mengabaikan):** `ml_model_versions.artifact`, `ml_model_versions.features`, `ml_model_versions.metrics`, `ml_model_versions.calibration`, `ml_model_versions.fairness`, `ml_model_versions.trained_by`, `ml_model_versions.approved_by`, `ml_model_versions.status`, `advisor_notes.visibility`, `risk_scores.score`, `risk_scores.top_factors`, `risk_scores.hard_triggers`, `risk_scores.degraded`, seluruh kolom `attendance_token_uses.*` (baris itu **dihasilkan** server, tidak pernah ditulis klien), seluruh kolom `audit_chain_anchors.*`, `audit_verification_runs.findings`/`verdict`/`compromised_at`, seluruh kolom `outcome_attainments.*` (turunan — koreksi = hitung ulang, bukan ketik ulang), `tuition_tariff_matrix.amount_rupiah` (**hanya** lewat jalur `APPROVE`), `tuition_tariff_matrix.status`/`approved_by`/`approved_at`, `enrollments.program_type`, `grade_change_logs.*` (insert-only; `seq`/`prev_hash`/`hash` dihitung server). Daftar kanonik tetap milik `docs/DATA_MODEL.md` §14.9 — bagian ini hanya menyebut turunan gelombang 2, tidak menggandakan daftar itu.

**Enam lapis penegakan (setiap rute tulis di tabel di atas; gaya sama dengan §4.6.6 dan §4.10):**

| Lapis | Kewajiban konkret di gugus §4.6.7 |
|---|---|
| L1 transport | Zod `strict()` + whitelist field per objek; enum **UPPER** untuk nilai yang dipantulkan ke DB (`kind`, `status`, `verdict`, `plannedAction`, `resolvedOutcome`, `programType`, `deliveryMode`); `limit ≤ 100`; kolom `SERVER_ONLY` di atas ditolak bila muncul di body; nominal dalam **basis poin** atau **bigint rupiah**, tanpa `float` |
| L2 identitas | `tenantId`/`userId` **hanya** dari JWT terverifikasi; middleware **wajib menghapus** `x-tenant-id`/`x-user-id` kiriman klien sebelum menyetel milik sendiri (`SEC-07`); `ip` untuk jejak rantai dan jejak scan diambil dari *request* yang sudah dibersihkan, bukan dari body |
| L3 permission berbasis tabel | `requireDataPrincipal` atas `user_role_assignments` + `valid_to`, **bukan** perluasan carrier `member_role` (`SEC-10`); izin per objek = nomor 51–126 `RBAC_MATRIX §4.5`, dan seluruhnya masih **usulan** — tidak ada call site sebelum dipromosikan (`G-15`) |
| L4 scope | `holdsScoped(access, PERM.x, { kind, id })` untuk TENANT/ORG/PROGRAM/CLASS/PERIOD/SELF **dan `SITE` yang baru** (`0044`; `siteId` dari `campus_sites`, dipropagasi ke `rooms`, `class_sessions`, `enrollments`). `LECTURER` pada `lecturer-availability` dan `final_project_outputs` = `SELF`/pembimbing; `ADVISER` pada catatan wali = scope bimbingan; `COMPLIANCE_OFFICER` pada verifier = khusus verifikasi, bukan pembaca audit (`SEC-11` — fungsi ada, nol call site hari ini) |
| L5 state | Periode `OPEN` (`423 PERIOD_CLOSED`, 25) untuk objek ber-periode; versi `ACTIVE` tidak dapat ditimpa (buat versi baru); `404 MODULE_NOT_AVAILABLE` (26) memotong lebih dulu (mis. `thesis` untuk jenis TA); gerbang uang/akademik (`403 GATE_BLOCKED`, 38) untuk tarif; empat-mata untuk **setiap** `VALIDATE` (`403 SELF_APPROVAL_FORBIDDEN`, 56) dan objek terminal (`409 DECISION_ALREADY_MADE`, 55); `feeder_autofix_suggestions` hanya atas run `SUCCEEDED`; `PASSED` TA butuh luaran (91) |
| L6 RLS | `SET LOCAL app.current_tenant` dalam setiap transaksi; `sica_app` `NOBYPASSRLS`; seluruh tabel baru `0037`–`0046` **wajib** mendapat policy dari generator RLS sebelum satu pun rute dibuka; `tuition_tariff_matrix.amount_rupiah` dan `risk_scores` disaring pada **proyeksi server** |

**Anti-IDOR.** Setiap `siteId`, `indicatorId`, `outcomeId`, `curriculumId`, `roomId`, `lecturerMembershipId`, `thesisRecordId`, `attachmentId`, `runId`, `stagingId`, `ruleId` dari klien diselesaikan ke barisnya **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND id = $1`), kepemilikan/scope dibuktikan, **baru** mutate. Rute yang menerima `studentIds[]`, `requestIds[]`, `enrollmentIds[]`, atau `indicatorId` tanpa pembacaan DB = temuan `SEC-02/03/04`, bukan gaya kode. Id milik tenant lain dijawab **`404 NOT_FOUND`** (5), bukan 403, agar keberadaan objek tidak bocor lintas tenant.

**Contoh yang paling sering salah dibuat (3): `403 SELF_APPROVAL_FORBIDDEN` pada approve tarif.** Kesalahan yang umum: (a) body approve membawa `amountRupiah` "untuk konfirmasi" — field itu `SERVER_ONLY`, kehadirannya di body adalah `422 VALIDATION_FAILED` (6) lebih dulu; (b) penyetuju yang sama dengan pengusul diloloskan karena perannya memegang dua izin (`insert` **dan** `approve`) — yang menolak adalah **subjek**, bukan peran, dan `CHECK` DB `approved_by <> requested_by` adalah penegak kedua; (c) menolak dengan `403 FORBIDDEN` generik sehingga UI tidak dapat menampilkan sebabnya. Bentuk benar:

```http
POST /api/v1/admin/tuition-tariff-matrix/0196e2b7-4c1d-7a82-9f05-2b1e7c6d3a90/approve
Authorization: Bearer <access_token>
Idempotency-Key: tariffapprove-2026-genap-0007
Content-Type: application/json

{ "reason": "Sudah diverifikasi BAUK pada rapat tarif 2026-10-18.",
  "acknowledgeEffectiveFrom": "2026-02-01" }
```

```json
{
  "success": false,
  "error": {
    "code": "SELF_APPROVAL_FORBIDDEN",
    "message": "Penyetuju tarif tidak boleh orang yang sama dengan pengusul (SoD BR-K2).",
    "details": [
      { "field": "approverId", "message": "Actor ini = requestedBy baris 0196e2b7.", "remedyHref": "/admin/tuition-tariff-matrix/0196e2b7-4c1d-7a82-9f05-2b1e7c6d3a90" },
      { "field": "requestedByRole", "message": "Ajukan ke LEADER atau TENANT_ADMIN lain pada scope SITE baris ini." }
    ]
  },
  "meta": { "timestamp": "2026-10-20T08:15:30.130Z", "requestId": "req_8f1d2c3e4a5b6789" }
}
```
> HTTP **403**; `meta.auditId` **tidak** ada karena penolakan tidak mengubah baris tarif (percobaan `VALIDATE` tetap tercatat di `audit_logs`). Respons **tidak pernah** memuat `amountRupiah` untuk peran tanpa hak finansial — yang dikembalikan adalah `data.blocked` beserta `reasons[]` (`BLUEPRINT_ROLE_BY_ROLE §0.3`).

**Empat titik kegagalan yang wajib diuji per baris di atas (AGENTS §3.8), bukan diasumsikan aman:** izin ada tapi data prodi/site lain · izin ter-cache tapi penugasan sudah dicabut (`valid_to`) · `tenant_id` benar tapi periode atau `effective_from` salah · filter ada di query tapi RLS tidak aktif (CI menolak).

#### 4.6.8 Pratinjau resolusi tarif per mahasiswa — `POST /api/v1/admin/tuition-tariff-matrix/preview` (deterministik, tanpa mutasi)

**Status `spec-only`; objek `0046_tuition_tariff_matrix.sql` — DDL ditulis 2026-10-20, berkas migrasi belum ada, izin 121–126 masih usulan.** Rute ini menjawab satu pertanyaan yang **tidak boleh** dijawab oleh tagihan nyata: *"kalau matriks ini saya aktifkan, berapa UKT mahasiswa X pada semester Y?"* Ia **tidak** menulis `invoices`, **tidak** menulis `ledger`, **tidak** menaikkan nomor dokumen, dan **tidak** menyentuh `payment_windows`. Ia hanya menjalankan fungsi resolusi yang sama yang nanti dipakai generator tagihan.

```http
POST /api/v1/admin/tuition-tariff-matrix/preview          → 200   satu mahasiswa, satu tanggal, deterministik
```

**Badan (Zod `strict()` — izin objeknya `finance.tuitionmatrix.view`, `READ` 123; aksi ini `READ` secara state, jadi bukan `INSERT`):**
```typescript
export const TariffPreviewSchema = z.object({
  studentId: UUIDSchema.describe("Diselesaikan ke barisnya di bawah RLS; enrollment aktif pada periode itu dibaca server"),
  periodId: UUIDSchema,
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Tanggal efektif resolusi; default = tanggal server. Kunci pemilihan memakai effective_from/effective_to, jadi angka dapat berbeda per tanggal"),
  draftMatrixIds: z.array(UUIDSchema).max(500).optional()
    .describe("Baris DRAFT yang ikut diuji SEBELUM di-approve; hanya dibaca pada tenant pemanggil, tidak pernah menjadi tagihan"),
  feeGroupIds: z.array(UUIDSchema).max(40).optional().describe("Persempit komponen; kosong = seluruh komponen aktif untuk prodi itu"),
  override: z.object({
    entryYear: z.number().int().min(2000).max(2100).optional(),
    programType: z.string().max(32).optional(),
    siteId: UUIDSchema.optional(),
    pmbPathId: UUIDSchema.optional(),
    pmbWaveId: UUIDSchema.optional(),
    incomeGroupCode: z.string().max(32).optional(),
  }).optional().describe("Yang boleh dioverride HANYA kunci resolusi. Nominal, status, approvedBy, dan amountRupiah tidak pernah dapat di-pass"),
});
// SERVER_ONLY: amountRupiah hasil tidak pernah dapat dikirim masuk; status tarif; approvedBy/approvedAt; invoiceId
```

**Respons `200` — keputusan + bukti, bukan satu angka polos:**
```json
{
  "success": true,
  "data": {
    "studentId": "0196…", "periodId": "0196…", "asOfDate": "2026-02-01",
    "resolutionKey": {
      "programId": "0196…", "entryYear": 2024, "programType": "REGULER",
      "siteId": "0196…", "pmbPathId": null, "pmbWaveId": null, "incomeGroupCode": "GOL_3"
    },
    "components": [
      { "feeGroupId": "0196…", "code": "UKT-DIKTI-3", "component": "UKT",
        "amountRupiah": "5000000", "billingBasis": "PER_SEMESTER", "payableTo": "BAUK",
        "matchedMatrixId": "0196…", "matchedVersion": 2, "specificity": 4,
        "effectiveFrom": "2026-02-01", "effectiveTo": null, "source": "ACTIVE" },
      { "feeGroupId": "0196…", "code": "TPP-REGULER", "component": "TPP",
        "amountRupiah": "1250000", "billingBasis": "PER_SEMESTER", "payableTo": "FACULTY",
        "matchedMatrixId": "0196…", "matchedVersion": 1, "specificity": 3,
        "effectiveFrom": "2026-02-01", "effectiveTo": null, "source": "DRAFT_TESTED" }
    ],
    "totalRupiah": "6250000",
    "shadowed": false,
    "wouldHaveFailed": null,
    "unmatchedFeeGroups": []
  },
  "meta": { "timestamp": "2026-10-20T08:30:00.000Z", "requestId": "req_…", "auditId": null }
}
```

| Aturan | Isi |
|---|---|
| **Deterministik** | Urutan pemilihan = **paling spesifik → paling netral** atas kunci `(program, entry_year, program_type, site, pmb_path, pmb_wave, income_group, fee_group)`; ties **tidak pernah** diselesaikan oleh urutan fisik atau `id`. Dua baris sama-spesifik → **`409 TARIFF_RULE_AMBIGUOUS` (105)** dengan `details[].candidates[]` (kedua `matrixId` + kunci yang cocok) supaya operator tahu baris mana yang di-`RETIRED`. Nol baris cocok → **`422 TARIFF_NO_MATCH` (106)** dengan kunci yang dicoba + `nearestCandidates[]`. `preview` adalah tempat **kedua** keadaan ini harus kelihatan: setelah aktivasi, keduanya adalah kegagalan generator tagihan. |
| **NULL ≠ netral otomatis** | `site_id`/`pmb_path_id`/`pmb_wave_id`/`income_group_code` yang `NULL` berarti "semua", dan `UNIQUE` ber-`COALESCE` (`0046`) menjaga agar dua baris "semua" tidak dapat disimpan. Yang **tidak** dapat dijaga `UNIQUE` adalah dua kunci *berbeda* dengan tingkat spesifik sama — itu tugas service, dan karena itu baris 105 ada. |
| **Angka di wire = string** | `amountRupiah`/`totalRupiah` adalah **bigint rupiah** yang dikirim sebagai string agar tidak rusak di JS/Dart (ADR-5, paritas `AGENTS §3.4`). Tidak ada `float` di jalur ini, dan tidak ada pembulatan: penjumlahan dilakukan integer. |
| **Rahasia finansial** | Peran tanpa hak finansial **tidak** menerima angka. Yang kembali adalah `data.blocked: true` + `reasons[]` + `specificity` (proyeksi server, `BLUEPRINT_ROLE_BY_ROLE §0.3`; SoD BAAK↔BAUK, `RBAC_MATRIX §4.6`). Ini bukan baris 98: yang menolak adalah **izin resource finansial**, bukan aturan field atribut kustom. |
| **`draftMatrixIds`** | Mengizinkan pengujian baris `DRAFT` **sebelum** `approve`; nilainya diberi tanda `source: "DRAFT_TESTED"` dan **tidak pernah** dapat dipakai oleh generator tagihan. Memakai draft sebagai dasar tagihan nyata = temuan, bukan fitur. |
| **`override`** | Hanya kunci resolusi yang boleh dioverride (mis. "bagaimana kalau mahasiswa ini pindah site / masuk jalur Mandiri gelombang 2"). `override` **tidak pernah** disimpan; ia tidak mengubah `students`, `enrollments`, atau `pmb_*`. |
| **Enam lapis** | §4.11 penuh. L1 `strict()` + tolak `amountRupiah` di body (6); L2 identitas hanya dari token (`SEC-07`); L3 `requireDataPrincipal` + `finance.tuitionmatrix.view` (masih **usulan** 123); L4 `holdsScoped` termasuk `SITE` — penolakan lewat **baris 16** `ADMIN_SCOPE_MISMATCH` (nama `SITE_SCOPE_VIOLATION` kalah, lihat §2.3 butir 8), dan `STUDENT` tidak punya rute ini sama sekali (mahasiswa membaca tagihannya lewat §4.10, bukan lewat pratinjau tarif); L5 periode `OPEN`/`DRAFT` boleh (pratinjau tidak butuh periode terbuka — ia justru untuk sebelum aktivasi) + modul `finance` aktif (`404 MODULE_NOT_AVAILABLE`, 26); L6 RLS + **baca dari Primary** karena hasil ini akan dipakai memutuskan `approve` (read-your-writes). |
| **`Idempotency-Key`** | **Tidak wajib** (rutenya tanpa efek samping) tetapi **dihormati**; replay dengan badan sama boleh dijawab dari cache pembacaan selama `X-Lookup-Version`/versi matriks tidak berubah. |
| **Audit** | `auditId` `null` pada sukses (`GET`-like secara state). Percobaan `override` yang melewati plafon baris (`feeGroupIds > 40`, `draftMatrixIds > 500`) → `422 EXPORT_LIMIT_EXCEEDED` (59) dengan `details[].nextStep` mengarah ke job, bukan perluasan batas. |
| **Bentuk lama** | `GET /resolve-preview` (didaftarkan di baris §4.6.7 sebelum bagian ini ada) adalah **satu-satunya varian query-string** untuk satu titik waktu tanpa `override` dan tanpa `draftMatrixIds`. Saat implementasi, **`POST /preview` adalah bentuk final** karena kunci resolusi adalah badan permintaan, bukan kumpulan query parameter yang dapat melewati batas panjang URL; `GET /resolve-preview` tetap terdokumentasi sebagai **alias baca-saja** selama satu siklus dan dicabut pada siklus berikutnya — bukan dibiarkan menjadi dua kebenaran. |

**Kenapa rute ini ada, bukan satu kalimat di dalam `approve`:** `approve` tarif adalah aksi uang yang lewat empat-mata dan wajib MFA; menaruh logika resolusi di dalamnya membuat penyetuju menilai angka yang **belum tahu** apakah matriks menutupi 4.000 mahasiswa atau menyisakan 300 di antaranya tanpa kecocokan. `preview` memisahkan "menguji" dari "mengesahkan" — persis pola `POST …/:id/test` pada aturan auto-fix Feeder di §4.6.7 (satu prinsip, dua gugus).

---
#### 4.6.9 Inti identitas: pengguna, peran, penugasan, permintaan hak & layanan mandiri (M-03) — 2026-10-22

**Status: `berjalan` untuk gugus `/admin/**` — terukur 2026-10-23: 28 berkas `route.ts`, 39 metode HTTP (inti identitas 13/21 + mesin parameter 11/16 + master organisasi & prodi 4/6; hitungan per-gugus tidak menjumlah bersih karena satu berkas memuat beberapa metode) — `spec-only` untuk `/me/**` dan blok DSAR.** Diukur 2026-10-23: `apps/web/src/app/api/v1/admin/**` berisi rute pengguna (daftar/buat/detail/ubah/nonaktif), hak-akses (peran + sub-rinci izin + katalog izin + penugasan), dan permintaan-hak (daftar/detail/approve/reject). Yang **belum** dikode dari tabel di bawah: `…/pengguna/:id/keanggotaan`, `PATCH /admin/keanggotaan/:id`, `PATCH /admin/hak-akses/penugasan/:id/scope-site` (diblokir `G-15` — service menjawab `409 CONFLICT` dengan sebab, bukan diam), `GET /admin/monitoring/login-stats`, `POST /admin/pengguna/:id/reset-password`, dan SELURUH blok `/api/v1/me/**`. Rujukan DDL: [DATA_MODEL §3](file:///c:/SICA/docs/DATA_MODEL.md) (`users`, `tenant_memberships`, `roles`, `permissions`, `role_permissions`, `user_role_assignments`, `access_change_requests`) dan §14.3.3 (migrasi `0082`, sudah diterapkan). Izin: **26 kode normatif** `identity.*` — 24 ber-nomor di [RBAC §4.5.8](file:///c:/SICA/docs/RBAC_MATRIX.md) baris 329–352, dua impersonasi di baris 317–318; semuanya **sudah** ada di [`authz.ts`](file:///C:/SICA/packages/contracts/src/authz.ts) baris 132–157, bukan usulan.

**Satu jalan untuk satu perubahan hak.** Memberi, mencabut, mengubah scope, dan mengubah komposisi izin role **tidak pernah** menulis `user_role_assignments`/`role_permissions` secara langsung. Keempatnya membuat baris `access_change_requests` berstatus `PENDING` (`202 { requestId, status }`) dengan `request_kind` `GRANT`/`REVOKE`/`SCOPE_CHANGE`/`ROLE_PERMISSION_CHANGE`; efeknya baru lahir saat **orang kedua** memanggil `POST /api/v1/admin/permintaan-hak/:id/approve` (`VALIDATE` 352) atau menolaknya dengan alasan. Ini menutup dua jalur eskalasi sekaligus: admin yang menyetujui permintaannya sendiri (`403 SELF_APPROVAL_FORBIDDEN`, 56) dan admin yang menyetujui grant untuk dirinya sendiri (baris 56 yang sama, `details.reason = 'APPROVER_IS_TARGET'`).

**Batas empat-mata yang ditegakkan, bukan diandaikan.** (a) `approver_id <> requester_id` dan `approver_id <> target_user_id` adalah `CHECK` di `0082` (`chk_acr_no_self_approval`, `chk_acr_approver_not_target`), bukan hanya tombol tersembunyi — dan keduanya **teruji di database**: harness `db:test:rls` menyisipkan baris yang melanggar dan wajib menerima `23514`; (b) scope yang diberikan wajib **himpunan bagian** scope penyetuju — pelanggaran `403 ADMIN_SCOPE_MISMATCH` (16). L4 memanggil `holdsScoped(access, PERM.x)` untuk membuktikan izin dipegang lalu `coversScope(...)` untuk membandingkan lima dimensi lingkup kolom-per-kolom (`access-request.service.ts`) — pemanggil produksi pertama `holdsScoped`, menutup `SEC-11` untuk gugus ini; (c) role sistem (`is_system = true`) tidak dapat diubah/dihapus — `409 CONFLICT` (12); (d) keputusan terminal tidak dapat diulang — `409 DECISION_ALREADY_MADE` (55); (e) penolakan wajib `reason ≥ 10` karakter dan memakai izin `VALIDATE` yang sama, bukan kode kedua; (f) penyetuju wajib sesi ber-MFA — `401 MFA_REQUIRED` (2) **sebelum** baris ditulis; (g) pasangan peran mutual-eksklusif (`MUTUALLY_EXCLUSIVE_ROLES`, BR-K2) ditolak oleh `violatesSoD()` saat pengajuan **dan** saat keputusan — pemanggil produksi pertama fungsi itu, menutup `SEC-12`.

**Berlaku pada pemeriksaan berikutnya, bukan pada token yang beredar.** Setelah keputusan sah: assignment baru/berubah dibaca dari `user_role_assignments` + `valid_to` pada setiap permintaan (bukan label peran di carrier); `refresh` untuk sesi yang haknya dicabut ditolak; cache izin per pengguna dibuang; pencabutan menutup `valid_to`/status dan **tidak menghapus baris**. Setiap pengajuan, persetujuan, dan penolakan menulis `audit_logs` berisi actor, target, before/after, alasan, IP, dan `request_id` (FR-IDT-05).

**Layanan mandiri (`/me/**`) adalah jalur SELF, bukan pintu belakang admin.** Setiap `:id` diselesaikan di dalam transaksi dengan `WHERE tenant_id = ctx.tenantId` (anti-IDOR, `SEC-02`–`SEC-04`); pengguna hanya menyentuh baris miliknya (`subject_user_id = token.sub`), dan kolom `SERVER_ONLY` (`students.nim`, `students.status_akademik`, `grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `mfa_factors.secret`, `pddikti_*_id`) tidak pernah diterima dari body. Membaca/mengelola MFA dijaga satu kode `identity.mfa.manage` (334, `UPDATE`): katalog sengaja tidak memecahnya menjadi `INSERT`/`DELETE` karena enrolmen, pencabutan, dan rotasi recovery code adalah **satu tindakan kelola** dengan gerbang yang sama.

**Batas realita yang tidak boleh disembunyikan.** Yang berjalan **hari ini** hanya gugus `/admin/**` di atas; `/me/**` masih kontrak. Tiga hal tetap terbuka dan tidak boleh dibaca sebagai "sudah selesai": (1) `PATCH /admin/hak-akses/penugasan/:id/scope-site` **sengaja tidak ada** — tanpa dimensi `SITE` (migrasi `0044`) "hak hanya di kampus cabang" tidak dapat dinyatakan, dan kodenya (112) belum dipromosikan (`G-15`); (2) rute `/admin/**` belum di-gate `tenant_modules` karena `identity` adalah modul bootstrapping yang wajib `ACTIVE` untuk bisa login sama sekali — gerbang modul tetap wajib untuk gugus lain; (3) layar `/admin/**` sudah dipakai di browser (login MFA nyata), tetapi **belum** ada test runner end-to-end otomatis untuk jalur UI-nya — bukti otomatis ada di `.tools/e2e-fase-1b.mjs` (jalur API) dan `tests/unit/access-request-scope.test.ts` (L4 murni).

| Rute | Aksi | Izin (nomor §4.5) | Gerbang wajib | Catatan kontrak |
|---|---|---|---|---|
| GET /api/v1/admin/pengguna | READ | `identity.user.view` (336) | L1–L6 · MFA tidak | ✅ `berjalan`. Filter terpasang: `q` (nama/email/kode anggota), `status` = `users.status`, `page`/`limit`. `roleId`/`scopeKind` **tidak** diterima di sini — itu filter daftar penugasan (§4.6.9 baris `GET …/penugasan`); PII diproyeksikan per peran, bukan difilter di CSS |
| POST /api/v1/admin/pengguna | INSERT | `identity.user.create` (337) | MFA ya | ✅ `berjalan`. Body nyata `{fullName, email, memberCode, memberRole, initialPassword, reason}` — `users` tidak punya kolom `username` (identitas login = email global) dan `member_code` wajib unik per tenant; tanpa `initialPassword` akun tidak dapat login, jadi sandi awal adalah bagian kontrak, bukan tambahan. Sandi hanya sekali-tampil dan tidak pernah masuk log. **Akun lahir tanpa hak apa pun**: grant adalah jalur `POST …/penugasan` |
| GET /api/v1/admin/pengguna/:id | READ | `identity.user.view` (336) | MFA tidak | id lintas tenant → `404 NOT_FOUND` (5), bukan `403`, agar keberadaan baris tidak bocor |
| PATCH /api/v1/admin/pengguna/:id | UPDATE | `identity.user.update` (338) | MFA ya | `SERVER_ONLY` di body → `422 VALIDATION_FAILED` (6); perubahan email memaksa verifikasi ulang |
| POST /api/v1/admin/pengguna/:id/nonaktif | UPDATE | `identity.user.deactivate` (339) | MFA ya | ✅ `berjalan` sebagai **POST** (bukan PATCH): ia transisi keadaan beralasan, bukan penyuntingan field. nonaktif = `users.status DISABLED` + keanggotaan `LEFT` + seluruh `valid_to` ditutup + sesi aktif dicabut; **tidak ada** `DELETE` baris pengguna. Menonaktifkan diri sendiri → `403` (56) |
| POST /api/v1/admin/pengguna/:id/reset-password | UPDATE | `identity.user.update` (338) — **bukan** 331 (itu SELF) | MFA ya | ⛔ **spec-only — belum dikode**. token reset sekali pakai TTL 30 menit; semua sesi pengguna dicabut; respons tidak pernah memuat sandi |
| GET /api/v1/admin/pengguna/:id/keanggotaan | READ | `identity.membership.view` (340) | MFA tidak | ⛔ **spec-only — belum dikode**. `tenant_memberships` + `member_code`; satu akun dapat punya banyak membership per unit |
| POST /api/v1/admin/pengguna/:id/keanggotaan | INSERT | `identity.membership.create` (341) | MFA ya | ⛔ **spec-only — belum dikode**. `member_code` unik per tenant; unit wajib berada di bawah scope aktor |
| PATCH /api/v1/admin/keanggotaan/:id | UPDATE | `identity.membership.update` (342) | MFA ya | ⛔ **spec-only — belum dikode**. pindah unit/status dicatat before/after di `audit_logs` |
| GET /api/v1/admin/hak-akses/peran | READ | `identity.role.view` (343) | MFA tidak | sertakan `is_system` dan jumlah pemegang; role sistem tampil terkunci, bukan hilang |
| POST /api/v1/admin/hak-akses/peran | INSERT | `identity.role.create` (344) | MFA ya | ✅ `berjalan`. Body `{code, displayName, scopeKind, reason}`; `is_system` selalu `false` dan tidak dapat diminta. **Deviasi yang disengaja dari "izin awal (bila ada)"**: pembuatan peran tidak menerima daftar izin sama sekali — peran tanpa grant belum memberi hak kepada siapa pun, sedangkan grant yang ikut body akan melompati empat-mata |
| GET /api/v1/admin/hak-akses/peran/:id | READ | `identity.role.view` (343) | MFA tidak | ✅ `berjalan`: peran + `permissions` efektif. Delta `PENDING` **tidak** disisipkan di respons ini — ia terlihat di daftar permintaan (satu objek, satu tempat), agar layar tidak pernah menampilkan dua angka yang tampak benar |
| PATCH /api/v1/admin/hak-akses/peran/:id | UPDATE | `identity.role.update` (345) | MFA ya | ✅ `berjalan`. **Hanya** `displayName` (+`reason`): tabel `roles` tidak punya kolom deskripsi, dan menambahkannya di sini akan menciptakan field yang tidak dibaca siapa pun. Izin tidak pernah berubah lewat PATCH — gunakan `PUT …/izin`. `is_system=true` → `409` (12) |
| DELETE /api/v1/admin/hak-akses/peran/:id | DELETE | `identity.role.delete` (346) | MFA ya | ✅ `berjalan`; `reason` dibawa sebagai **query** (≥10) karena `DELETE` ber-body tidak dapat diandalkan lintas klien. `is_system=true` → `409 CONFLICT` (12); peran masih memegang penugasan → `409` dengan `details[].message = REFERENCE_IN_USE` (19), bukan hapus paksa |
| GET /api/v1/admin/hak-akses/izin | READ | `identity.permission.view` (347) | MFA tidak | katalog `resource × verb × module`; dipakai layar matriks izin (G-09) |
| GET /api/v1/admin/hak-akses/peran/:id/izin | READ | `identity.role.view` (343) | MFA tidak | daftar izin efektif role; `PENDING` ditandai terpisah dan **belum berlaku** |
| PUT /api/v1/admin/hak-akses/peran/:id/izin | UPDATE | `identity.role.update` (345) | MFA ya · **empat-mata** | body `{grant:[permissionId], revoke:[permissionId], reason}`; menulis `access_change_requests` `ROLE_PERMISSION_CHANGE` dan menjawab `202 { requestId }`; `role_permissions` **tidak berubah** sampai approve; `is_system=true` → `409 CONFLICT` (12) |
| GET /api/v1/admin/hak-akses/penugasan | READ | `identity.assignment.view` (348) | MFA tidak | ✅ `berjalan`. Filter `userId`, `roleId`, `includeExpired=true` (default `false`), `page`/`limit`; `scopeKind` ikut terproyeksi di baris hasil, bukan sebagai filter |
| POST /api/v1/admin/hak-akses/penugasan | INSERT | `identity.assignment.grant` (349) | MFA ya · **empat-mata** | body `{userId, roleId, scope, validTo?, reason}`; scope wajib subset scope aktor (`403 ADMIN_SCOPE_MISMATCH`, 16); menjawab `202 { requestId }`, **bukan** menulis assignment |
| DELETE /api/v1/admin/hak-akses/penugasan/:id | DELETE | `identity.assignment.revoke` (350) | MFA ya · **empat-mata** | ✅ `berjalan`; `reason` di query. Menulis permintaan `REVOKE` (202); `roleId`/`target`/`scope` dibaca dari baris penugasan, **tidak** dipercaya dari klien (anti-IDOR). Baris assignment baru ditutup (`valid_to`) setelah approve; tidak ada hard delete |
| PATCH /api/v1/admin/hak-akses/penugasan/:id/scope-site | UPDATE | `identity.assignment.scope` (112 — **usulan**) | MFA ya · **empat-mata** | ⛔ **spec-only — belum dikode**. menulis permintaan `SCOPE_CHANGE` (202); **rute diblokir** sampai kode 112 dipromosikan ke `PERMISSION_SPECS` (`G-15`); tanpa dimensi SITE, "hak hanya di kampus cabang" tidak dapat dinyatakan |
| GET /api/v1/admin/permintaan-hak | READ | `identity.accessrequest.view` (351) | MFA tidak | ✅ `berjalan`. Pemohon selalu melihat miliknya (gerbang `requireAdminReadAny`: 351 **atau** salah satu izin pengajuan), penyetuju melihat tenant; filter `status`, `requestKind`, `perspective=MINE/TENANT`, `page`/`limit`; alasan terlihat utuh, bukan diringkas menjadi boolean |
| GET /api/v1/admin/permintaan-hak/:id | READ | sama dengan daftar di atas | MFA tidak | ✅ `berjalan`; memakai penyaring daftar yang sama sehingga aturan pandangan tidak bisa berbeda antara "lihat semua" dan "lihat satu" |
| POST /api/v1/admin/permintaan-hak | INSERT | izin per `requestKind` (349/350/345) | MFA ya · **empat-mata** | ✅ `berjalan`. Jalur umum di belakang `POST …/penugasan` dan `PUT …/peran/:id/izin`; keberadaannya membuat `SCOPE_CHANGE` **ditolak dengan sebab yang terbaca** (112 belum dipromosikan, `G-15`) alih-alih dilayani diam-diam dengan izin pinjaman |
| POST /api/v1/admin/permintaan-hak/:id/approve | VALIDATE | `identity.accessrequest.approve` (352) | MFA ya · **empat-mata** | menerapkan transisi; penyetuju ≠ pemohon ≠ target; terminal → `409 DECISION_ALREADY_MADE` (55); `ROLE_PERMISSION_CHANGE` menerapkan delta izin role secara atomik |
| POST /api/v1/admin/permintaan-hak/:id/reject | VALIDATE | `identity.accessrequest.approve` (352) — **satu izin, hasil negatif** | MFA ya · **empat-mata** | `reason ≥ 10` wajib; tidak ada izin `.reject` kedua (vonis `RBAC §4.5.1`, `G-12`) |
| GET /api/v1/admin/monitoring/login-stats | READ | `identity.loginstats.view` (335) | MFA tidak | ⛔ **spec-only — belum dikode**. agregat per hari/perangkat; tanpa PII per-record; sumber `login_events`/`audit_logs` |
| GET /api/v1/me/profile | READ | `identity.profile.view` (329) | SELF | ⛔ **spec-only — belum dikode**. hanya baris milik token; kolom `SERVER_ONLY` tidak diproyeksikan |
| PATCH /api/v1/me/profile | UPDATE | `identity.profile.update` (330) | SELF | ⛔ **spec-only — belum dikode**. `SERVER_ONLY` di body → `422 VALIDATION_FAILED` (6); NIM/status akademik hanya berubah lewat layanan akademik |
| POST /api/v1/me/password | UPDATE | `identity.password.reset` (331) | MFA ya · SELF | ⛔ **spec-only — belum dikode**. wajib sandi lama; kebijakan panjang/breach + `password_history` 5 terakhir; sesi lain dicabut |
| GET /api/v1/me/sessions | READ | `identity.session.view` (332) | SELF | ⛔ **spec-only — belum dikode**. sesi aktif + riwayat; sesi saat ini ditandai |
| DELETE /api/v1/me/sessions/:id | DELETE | `identity.session.revoke` (333) | SELF | ⛔ **spec-only — belum dikode**. hanya sesi sendiri; mencabut refresh-token family, bukan hanya access token |
| GET /api/v1/me/mfa | READ | `identity.mfa.manage` (334, `UPDATE`) | MFA ya · SELF | ⛔ **spec-only — belum dikode**. daftar faktor + status; `mfa_factors.secret` tidak pernah dikirim |
| POST /api/v1/me/mfa | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | ⛔ **spec-only — belum dikode**. mulai/konfirmasi enrolmen TOTP/WebAuthn; recovery code ditampilkan **sekali** |
| DELETE /api/v1/me/mfa/:id | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | ⛔ **spec-only — belum dikode**. faktor terakhir tidak dapat dihapus tanpa recovery code aktif; `DELETE` HTTP tetap satu tindakan kelola |
| POST /api/v1/me/mfa/recovery-codes | UPDATE | `identity.mfa.manage` (334) | MFA ya · SELF | ⛔ **spec-only — belum dikode**. rotasi kode pemulihan; kode lama langsung tidak berlaku |

**Kode error yang dipakai (tanpa kode baru).** `UNAUTHORIZED` (1) · `MFA_REQUIRED` (2) · `FORBIDDEN` (3) · `NOT_FOUND` (5) · `VALIDATION_FAILED` (6) · `RATE_LIMIT_EXCEEDED` (9) · `CONFLICT` (12) · `ADMIN_SCOPE_MISMATCH` (16) · `REFERENCE_IN_USE` (19) · `DECISION_ALREADY_MADE` (55) · `SELF_APPROVAL_FORBIDDEN` (56). Tidak ada kode baru untuk keadaan yang sudah punya baris; `APPROVER_IS_TARGET` adalah `details.reason` pada baris 56, bukan kode kedua.

**Urutan baca untuk implementasi (tidak boleh dibalik).** (1) promosikan `identity.assignment.scope` (112) bila route SITE akan dikode — hari ini **jangan**; (2) berkas migrasi `0082` + `gen-rbac-seed.mjs`; (3) `requireDataPrincipal` + `holdsScoped` di setiap rute (bukan perluasan carrier); (4) Zod `strict()` di `packages/contracts`; (5) baru handler. Rute yang tidak memenuhi lima lapis pertama tetap `spec-only`, bukan "hampir selesai".

#### 4.6.10 Permintaan Subjek Data (DSAR) (M-05) — 2026-10-22

**Status: `spec-only`, izin masih usulan.** `data_subject_requests` ([DATA_MODEL §5.1](file:///c:/SICA/docs/DATA_MODEL.md)) adalah jalur UU PDP 27/2022: subjek mengajukan hak sesuai `dsr_kind`, DPO memverifikasi dasar pemrosesan, retensi/legal hold dan menentukan hasil yang dapat dibuktikan. Penghapusan tidak berlaku atas arsip yang masih wajib disimpan; menyamarkan tampilan saja tidak cukup untuk menyatakan hak penghapusan dipenuhi. Tiga kode di [RBAC §4.5.6](file:///c:/SICA/docs/RBAC_MATRIX.md) — `audit.dsar.submit`, `audit.dsar.view`, `audit.dsar.decide` — **belum** ada di `PERMISSION_SPECS`; rute di bawah tidak boleh dikode sebelum dipromosikan (`G-31`, keputusan pemilik `CRD-5b`). DSAR **tidak** memakai `identity.accessrequest.*`: izin itu milik alur perubahan hak, dan meminjamnya membuat DPO dapat menyetujui pemberian peran.

| Rute | Aksi | Izin (usulan §4.5.6) | Gerbang wajib | Catatan kontrak |
|---|---|---|---|---|
| POST /api/v1/me/permintaan-subjek-data | INSERT | `audit.dsar.submit` | SELF · rate limit | keanggotaan pemohon diselesaikan dari token ke `requester_membership_id`; `kind` memakai enum `dsr_kind` (`ACCESS`, `COPY`, `CORRECTION`, `OBJECTION`, `WITHDRAW_CONSENT`, `ERASURE`), bukan enum API kedua; jawaban `202 { requestId }`; tidak memberi hak membaca kasus orang lain |
| GET /api/v1/admin/permintaan-subjek-data | READ | `audit.dsar.view` | MFA ya · DPO | antrean + status; isi kasus diproyeksikan, bukan disalin ke log |
| GET /api/v1/admin/permintaan-subjek-data/{requestId} | READ | `audit.dsar.view` | MFA ya · DPO · baris harus milik tenant | drawer detail: `kind`, `status`, `received_at`, `responded_by_due`, `outcome`, `handler_id`, `notes`; **isi permintaan tidak pernah dirender mentah untuk peran non-DPO** — proyeksi server memotong kolom PII, dan `requester_membership_id` wajib diselesaikan ke subjek dan tenant sebelum diputus (anti-IDOR); kasus tenant lain dijawab `404 NOT_FOUND` (5), bukan 403 |
| POST /api/v1/admin/permintaan-subjek-data/:id/decide | VALIDATE | `audit.dsar.decide` | MFA ya · DPO ≠ subjek | keputusan terminal `409 DECISION_ALREADY_MADE` (55); penolakan wajib alasan; `ERASURE` dapat menghasilkan `PARTIAL`/`DENIED` bila kewajiban retensi atau legal hold masih berlaku |

**Batas DSAR.** Keputusan wajib menghormati retensi/legal hold, mencatat identitas pemutus dan alasan tanpa menyalin PII kasus ke log. DPO tidak memperoleh hak perubahan peran. Salinan data disiapkan oleh layanan berwenang dengan proyeksi subjek; izin DSAR tidak membuka ekspor seluruh tenant. Anonimisasi tampilan saja bukan bukti bahwa permintaan penghapusan sudah dipenuhi.

#### 4.6.11 Organisasi dan program studi (M-02)

Kontrak ini milik administrasi data master, bukan bagian dari DSAR. Izin berikut sudah tercatat dalam katalog terapan; keberadaan handler tidak menutup seluruh backlog master gedung/ruang/lab.

| Rute | Aksi | Izin | Gerbang wajib | Catatan kontrak |
|---|---|---|---|---|
| GET /api/v1/admin/organisasi | READ | `academic.organization.view` (381) | MFA tidak | ✅ `berjalan` (Fase 1B item 4). Proyeksi per-tenant `organizations` + `childCount`/`programCount` sebagai subquery berkorelasi yang **menyebut nama tabel** (`organizations.id`, bukan `id` polos — pelajaran regresi `R-2.1`) |
| POST /api/v1/admin/organisasi | INSERT | `academic.organization.create` (382) | MFA ya | ✅ `berjalan`. `kind` = enum kelas A (`HQ·FACULTY·DEPARTMENT·UNIT·LIBRARY`) — kampus menambah BARIS, bukan nama kelas; `code` unik per tenant (`uq_orgs_tenant_code`) → `409 CONFLICT` (12); indukan asing → `404` (5) |
| PATCH /api/v1/admin/organisasi/:id | UPDATE | `academic.organization.update` (383) | MFA ya | ✅ `berjalan`. **Siklus indukan ditolak di aplikasi** (`409`, detail `parentId=ORG_PARENT_CYCLE`) karena `0002` tidak memasang CHECK penutup siklus — tanpa penjaga ini resolusi lingkup `ORG` tidak pernah berhenti. `:id` bukan UUID → `422` di transport, bukan `22P02` → 500 dari DB. **Urutan dijaga: izin lebih dulu, baru bentuk** (`RD-155`) — peran tanpa hak menerima `403` datar, tidak pernah `422` ber-`details` |
| GET /api/v1/admin/master/prodi | READ | `academic.program.view` (385) | MFA tidak | ✅ `berjalan`. `orgName` hasil LEFT JOIN dalam tenant yang sama; `min_total_sks`/`graduation_min_ipk` diproyeksikan sebagai string `numeric` (paritas Web↔Flutter, ADR-5) |
| POST /api/v1/admin/master/prodi | INSERT | `academic.program.create` (386) | MFA ya | ✅ `berjalan`. Angka akademik (beban SKS, masa studi normal/maksimum, ambang IPK) adalah **data**, bukan konstanta (AGENTS §3.10) — karena itu ia lewat rute ini dan tercatat di `audit_logs` dengan `reason`. `level` enum kelas A; `maxStudySemesters < nominalStudySemesters` → `422` |
| PATCH /api/v1/admin/master/prodi/:id | UPDATE | `academic.program.update` (387) | MFA ya | ✅ `berjalan`. Empat-mata **belum** dipasang di sini: `study_programs` bukan baris parameter, jadi kelas `REGULATORY` mesin parameter tidak menjangkaunya — keputusan produk terbuka, dicatat di baris ini bukan disembunyikan. `:id` bukan UUID → `422` transport, dan **izin mendahului bentuk** (`RD-155`): peran tanpa hak selalu `403` datar |

### 4.7 Webhook pembayaran (`/api/v1/payments/webhook/:gateway`)
**Status: dispesifikasi — belum diimplementasi** (tidak ada rute di `apps/web/src/app/api/v1/payments/**`; rujukan kebutuhan: [INTEGRATIONS §2](file:///c:/SICA/docs/INTEGRATIONS.md), ledger & cekal: [DATA_MODEL §5](file:///c:/SICA/docs/DATA_MODEL.md)).

```http
POST /api/v1/payments/webhook/midtrans
POST /api/v1/payments/webhook/xendit
```

`GET`/`HEAD` pada rute ini **tidak disediakan**; vendor hanya memakai `POST`.

**Sifat rute (berbeda dari seluruh rute lain di dokumen ini)**

| Aspek | Aturan |
|---|---|
| Autentikasi | **Tanpa JWT/session.** Penanda tangan = signature vendor. Header `Authorization`/`X-Tenant-ID` §1.1 **tidak** diminta dan **tidak** dipercaya. |
| Identifikasi tenant | Dari **`order_id`/`external_transaction_id`** yang di-mint bernuansa tenant (`{tenantSlug}-{invoiceNumber}` atau `invoiceId` UUID tersimpan), **bukan** dari body mentah. `tenant_id` hasil resolusi wajib sama dengan `invoices.tenant_id` di dalam transaksi. |
| Idempotensi | **Kunci alami kanonik gugus ini: `UNIQUE (tenant_id, channel_id, external_ref)`** pada `payments`. `external_ref` adalah ejaan final (`docs/INTEGRATIONS.md:512`); `vendor_transaction_id` dan `provider_ref` **dilepas** (`RD-08`) — kepemilikan nama kolom & DDL tetap milik `DATA_MODEL.md`, dokumen ini hanya menetapkan **identitas logikanya**: satu transaksi vendor, pada satu kanal, untuk satu tenant = tepat satu baris pembayaran. Ditambah `idempotency_keys` (`docs/DATA_MODEL.md:438-445`) sebagai penahan replay lintas percobaan, dan dedup `event_id` (§4.7.7 butir 3) sebagai penahan replay **notification** yang tidak membawa id transaksi (satu invoice, banyak event). |
| Rate limit | Per IP vendor + jendela replay (baris 9 §2.3). IP allowlist gateway dipakai **hanya** sebagai lapisan kedua; signature tetap pembukti utama karena IP vendor bisa berubah. |
| Body mentah | Wajib disimpan utuh di `payments.raw_callback` untuk rekonsiliasi manual **sebelum** diputuskan (Pino redaction: nominal boleh, token/secret tidak). |
| `amount` | **Tidak pernah dipercaya.** Lihat aturan "nominal" di bawah. |

#### 4.7.1 Bentuk permintaan per gateway

**Midtrans** (`Core API` / notification; body JSON untuk QRIS & Core API, `application/x-www-form-urlencoded` untuk sebagian callback VA — handler **wajib** menerima keduanya):

```json
{
  "transaction_id": "…",
  "order_id": "unpad-2026-000123",
  "status_code": "200",
  "gross_amount": "1500000",
  "transaction_status": "settlement",
  "payment_type": "bank_transfer",
  "va_number": "8880123456789",
  "fraud_status": "accept",
  "transaction_time": "2026-10-19 14:03:22",
  "signature": "<hex sha512>"
}
```

- Signature: `SHA512(order_id + status_code + gross_amount + SERVER_KEY)` → heksa kecil (skema ini yang dipakai `INTEGRATIONS.md:141-153`).
- **Hanya** `transaction_status ∈ {settlement, capture}` dengan `fraud_status = accept` yang dianggap selesai. `pending`/`expire`/`cancel`/`deny`/`failed` → `payments.status = FAILED` (atau tetap `PENDING` untuk `pending`), **tidak** menyentuh ledger.
- `status_code` harus `200` (settlement VA/QRIS); `201` = capture sukses.
- Rekam `transaction_time` untuk jendela replay.
- **`[TIDAK-TERVERIFIKASI]`**: daftar lengkap `status_code`/`transaction_status` per produk Midtrans yang dibeli tenant (Core API vs Snap) dikonfirmasi ke dokumentasi vendor + sandbox pada slice ADM/KEU. Handler wajib **fail-closed**: status yang tidak dikenali dicatat sebagai `payments.raw_callback` dengan status `PENDING`, **tidak** pernah dianggap settlement.

**Xendit** (Invoice / VA callback):

```json
{
  "id": "…",
  "external_id": "unpad-2026-000123",
  "invoice_id": "…",
  "status": "PAID",
  "paid_at": "2026-10-19T14:03:22.000Z",
  "paid_amount": 1500000,
  "payment_method": "BCA",
  "events": [
    { "id": "…", "type": "INVOICE.PAID", "created_at": "…",
      "payload": { /* salinan body di atas */ },
      "api_version": "2020-01-31" }
  ]
}
```

- Verifikasi memakai **token callback** pada header `x-callback-token` dibandingkan rahasia kanal (`payment_channels.webhook_secret_ref`) — perbandingan **constant-time**, bukan `===`. Untuk kanal yang mengaktifkan payload bertanda tangan, header `x-signature` berisi **HMAC-SHA256** atas **body mentah** (bytes persis seperti diterima, bukan hasil re-serialisasi JSON) dengan secret kanal.
- Status yang menyelesaikan pembayaran: `PAID` (dan `SETTLED` untuk kanal tertentu). `EXPIRED`/`VOIDED` → batalkan, jangan lepaskan gerbang dua kali.
- **`[TIDAK-TERVERIFIKASI]`**: nomor versi API, nama header, dan algoritma persis untuk akun Xendit yang dipakai **wajib** dikonfirmasi ke dokumentasi vendor + sandbox saat slice ADM/KEU dikerjakan. Yang diikat dokumen ini adalah **kontrak kita**: bila signature tidak cocok → tolak, apa pun skemanya.

#### 4.7.2 Verifikasi signature — termasuk guard panjang

```typescript
import crypto from 'node:crypto';

/**
 * Guard panjang WAJIB sebelum timingSafeEqual.
 * crypto.timingSafeEqual(a, b) MELEMPAR RangeError bila a.length !== b.length,
 * sehingga webhook dengan signature pendek/acak berubah menjadi HTTP 500
 * (bukan penolakan bersih) — temuan RD-26 pada `INTEGRATIONS.md:153`.
 */
export function safeEqualHex(computedHex: string, received: string): boolean {
  const computedBuf = Buffer.from(computedHex.toLowerCase(), 'hex');
  const receivedBuf = Buffer.from((received ?? '').trim().toLowerCase(), 'hex');
  if (computedBuf.length === 0) return false;              // konfigurasi salah → gagal tertutup
  if (computedBuf.length !== receivedBuf.length) return false; // ← guard: tidak pernah masuk timingSafeEqual
  return crypto.timingSafeEqual(computedBuf, receivedBuf);
}

export function verifyMidtransSignature(
  orderId: string, statusCode: string, grossAmount: string, signatureReceived: string, serverKey: string
): boolean {
  const computed = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return safeEqualHex(computed, signatureReceived);
}

export function verifyXenditCallbackToken(tokenHeader: string, secretRefValue: string): boolean {
  const a = Buffer.from(secretRefValue, 'utf8');
  const b = Buffer.from(tokenHeader ?? '', 'utf8');
  if (a.length !== b.length) return false;                 // guard yang sama, versi utf8
  return crypto.timingSafeEqual(a, b);
}
```

Aturan turunannya:
1. Baca **body mentah** (`await request.text()`) lalu parse sendiri; jangan memakai body hasil transformasi framework untuk menghitung signature.
2. Secret per **kanal**, per **tenant** (`payment_channels.webhook_secret_ref` → secret manager), bukan satu server-key global untuk semua tenant.
3. Signature tidak cocok / token tidak ada → `401 UNAUTHORIZED` (baris 1) dengan body envelope standar; **jangan** pernah menulis apa pun ke DB pada tahap ini, dan jangan mengirim detail secret di `error.details`.
4. Mode gagal = **tolak**, bukan crash. Tidak ada jalur webhook yang boleh menghasilkan `500` karena input vendor.

#### 4.7.3 Jendela replay

| Pemeriksaan | Aturan |
|---|---|
| Usia event | `now − transaction_time` (Midtrans) / `events[].created_at` (Xendit) **≤ 24 jam**. Lebih tua → `200` di-ACK dengan `ignored: "REPLAY_WINDOW"`, **tanpa mutasi** (ACK menghentikan retry vendor). |
| Clock skew maju | Maksimal **5 menit** di depan waktu server; selebihnya ditolak `200 {ignored:"CLOCK_SKEW"}`. |
| Duplikat | `(tenant_id, channel_id, external_ref)` sudah ada dengan status akhir → `200 {duplicate: true}` dan `data.status` tidak berubah. Tiga callback bersamaan untuk satu invoice = **tepat satu** baris ledger (`AC-KEU-1`). |
| `event_id` | Notification **tanpa** id transaksi (mis. `INVOICE.PAID` Xendit yang hanya membawa `external_id`) wajib didedup pada `(tenant_id, channel_id, event_id)` sebelum masuk antrean pemrosesan. `event_id` dilihat **sebelum** `external_ref`: dua event berbeda untuk invoice sama (`CREATE` lalu `PAID`) bukan duplikat dan keduanya harus jalan. Event dengan `event_id` yang sudah pernah diproses → `200 {duplicate: true, byEventId: true}`. |
| Urutan | Event `PENDING` yang datang **setelah** `SETTLED` tidak boleh menurunkan status; transisi status satu arah (`INITIATED → PENDING → SETTLED`, `SETTLED → REFUNDED` khusus refund ber-authorization). |
| Lock | `SELECT … FOR UPDATE` pada baris `invoices` target **di dalam** transaksi (pola `INTEGRATIONS.md:174-178`), bukan advisory lock global. Baris `payments` hasil `INSERT … ON CONFLICT DO NOTHING … RETURNING` diperiksa ulang; **tidak ada** mutasi sebelum lock berhasil. |
| Kadaluarsa target | Callback yang **tidak dapat lagi** diselesaikan (VA `EXPIRED`/`CANCELLED` dan dana tidak terpasang ke tagihan mana pun) → `410 CALLBACK_TARGET_EXPIRED` (baris 49) + jalur kompensasi §4.7.8. Ini **berbeda** dari replay biasa: replay tetap `200 ACK` supaya vendor berhenti mencoba. |

#### 4.7.4 Aturan nominal

- Nominal yang dipakai untuk **membukukan** = nominal **invoice di database**, bukan angka dari payload.
- `gross_amount` / `paid_amount` dari payload **hanya** dibandingkan dengan tagihan: cocok persis → lanjut; kurang (parsial) → hanya diperbolehkan bila kanal & tenant mengizinkan cicilan (`invoice_installments`, `DATA_MODEL.md:804`), dan tetap dibaca dari DB untuk besar yang dicatat; lebih/tidak cocok → **`409 CONFLICT`** (baris 12) dengan `details[].field = "gross_amount"`, **tidak ada mutasi**, payload disimpan untuk rekonsiliasi manual.
- Dilarang membuat tagihan/ledger dari angka webhook. Webhook **tidak pernah** menciptakan `invoices` baru.
- Selisih mata uang/pembulatan: nominal disimpan `bigint` dalam rupiah (`amount_rupiah`), tanpa float.

#### 4.7.5 Satu transaksi: settlement + ledger + lepas cekal

Ketiga langkah di bawah terjadi di **satu** `db.transaction()` pada **Primary**; tidak ada penyelesaian sebagian:

```typescript
// pseudokode kontrak — bukan implementasi
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`);

  // 1. kunci invoice (baris target, bukan tabel)
  const invoice = await lockInvoice(tx, tenantId, invoiceId);           // SELECT … FOR UPDATE
  if (!invoice) throw new NotFoundError();                               // 404 NOT_FOUND
  if (invoice.status === 'PAID') return { duplicate: true };             // idempoten

  // 2. satu usaha bayar + status settlement
  const payment = await insertPayment(tx, {
    tenantId, invoiceId, vendorTransactionId, amountRupiah: invoice.amountRupiah,
    status: 'SETTLED', settledAt, rawCallback, idempotencyKey,
  });                                                                     // UNIQUE (tenant_id, provider, provider_ref)

  // 3. invoice → PAID (parsial → PARTIAL)
  await markInvoicePaid(tx, invoice, payment);

  // 4. posting double-entry: Kas (debet) vs Piutang akademik (kredit)
  await postLedger(tx, { referenceId: invoice.id, amountRupiah: invoice.amountRupiah }); // append-only

  // 5. LEPAS CEKAL — update, bukan hapus baris (riwayat penahan harus tersisa)
  await tx.execute(sql`
    UPDATE blockades
       SET lifted_by = ${channelActorId}, lifted_at = now(),
           lift_reason = 'AUTO_SETTLED_BY_PAYMENT'
     WHERE tenant_id = ${tenantId} AND kind = 'FINANCE'
       AND source_id = ${invoice.id} AND lifted_at IS NULL`);

  // 6. audit + outbox dalam transaksi yang sama
  await writeAudit(tx, { actorId: channelActorId, action: 'payment.settle', resource: invoice.id });
  await enqueueOutbox(tx, { type: 'invoice.paid', payload: { invoiceId: invoice.id } });
});
```

**`channelActorId` wajib berasal dari kanal terdaftar** (`payment_channels.created_by` atau akun sistem yang eksplisit), **bukan `null` dan bukan `ctx.actorId`** — webhook tidak punya pemanggil, dan snippet lama di `INTEGRATIONS.md:226` memakai `ctx` yang tidak terdefinisi di cakupan itu (temuan RD-26). `audit_logs` tidak boleh kehilangan pelaku.

Gagal di langkah mana pun → **seluruh** langkah dibatalkan; respons `500 INTERNAL_SERVER_ERROR` (baris 10) agar vendor **retry**, dengan idempotensi sebagai penahan duplikasi saat retry datang.

#### 4.7.6 Kode respons yang disyaratkan

| Situasi | HTTP | `error.code` / `data` | Efek ke vendor |
|---|---:|---|---|
| Terproses | `200` | `data: { settled: true, invoiceId, paymentId }` | berhenti retry |
| Duplikat / sudah `PAID` | `200` | `data: { settled: false, duplicate: true }` | berhenti retry |
| Di luar jendela replay | `200` | `data: { settled: false, ignored: "REPLAY_WINDOW" }` | berhenti retry |
| Status non-final (`pending`, `expire`) | `200` | `data: { settled: false, recorded: "PENDING" }` | berhenti retry |
| Signature/token tidak valid | `401` | `UNAUTHORIZED` (baris 1) | retry (aman: tidak ada mutasi) |
| `:gateway` tidak ada di allowlist | `404` | `NOT_FOUND` (baris 5) | berhenti |
| Invoice tidak ditemukan di tenant ini | `404` | `NOT_FOUND` (baris 5) | berhenti setelah 3 percobaan |
| Nominal tidak cocok / status bertentangan | `409` | `CONFLICT` (baris 12) | berhenti; ditangani rekonsiliasi manual |
| Bentuk body tidak dapat diparse | `400` | `BAD_REQUEST` (baris 11) | berhenti; insiden integrasi |
| Target tidak dapat diselesaikan lagi (VA `EXPIRED`/`CANCELLED`, dana tanpa tagihan) | `410` | `CALLBACK_TARGET_EXPIRED` (baris 49) | berhenti; dana masuk kompensasi §4.7.8 |
| Kegagalan sementara (DB/lock timeout) | `500` | `INTERNAL_SERVER_ERROR` (baris 10) | **harus** retry |
| Melebihi laju per IP | `429` | `RATE_LIMIT_EXCEEDED` (baris 9) | retry ber-backoff |

Batas tegas `500`: **hanya** kegagalan internal yang transaksinya sudah di-rollback penuh dan karena itu aman diulang vendor (`db.transaction` gagal, lock timeout, worker mati). Semua penolakan semantik memakai `200`/`4xx`; `500` karena input vendor adalah bug, bukan kebijakan — lihat guard panjang `crypto.timingSafeEqual` di §4.7.2 yang dulu mengubah signature cacat menjadi `500` (`RD-26`).

**Ditambahkan untuk gugus ini (diralat 2026-10-19).** Kalimat lama "tidak ada kode baru untuk gugus ini" **dicabut** karena sudah tidak benar: empat kondisi baru benar-benar muncul setelah §4.7.7–§4.7.8 dinormakan, dan semuanya terdaftar di register tunggal **§2.3 baris 49–52** (`CALLBACK_TARGET_EXPIRED`, `CANCEL_WINDOW_CLOSED`, `CANCEL_CHANNEL_NOT_ALLOWED`, `SUSPENSE_UNRESOLVED`). Kondisi yang **sudah** ada tidak dibuatkan kode baru: signature gagal tetap baris 1, nominal tidak cocok tetap baris 12, invoice tak ditemukan tetap baris 5 (aturan pemeliharaan §2.3 butir 4).

#### 4.7.7 Kontrak penegakan anti-duplikasi — NORMATIF untuk webhook dan dua jalur masuk dana lainnya

Ketiga jalur masuk dana (`webhook`, `pull status` ke gateway, `manual teller` — `docs/INTEGRATIONS.md:516`) **wajib** memanggil satu fungsi penulisan yang sama. Kontraknya bukan saran; tiap butir punya nomor agar bisa dirujuk test.

| # | Butir | Aturan yang ditegakkan server |
|---:|---|---|
| W-1 | Kunci idempotensi | `(tenant_id, channel_id, external_ref)` unik; pelanggaran = **bukan** error, melainkan `200 {duplicate:true}`. `channel_id` **wajib** dari baris `payment_channels` hasil resolusi `:gateway` + tenant, **bukan** dari string di body. |
| W-2 | Jendela replay | Umur maksimum event **24 jam** (`transaction_time` Midtrans / `events[].created_at` Xendit) dan clock skew maju maksimum **5 menit**; keduanya diukur terhadap **waktu server**, bukan waktu klien. Di luar jendela: `200 {ignored:"REPLAY_WINDOW"}` tanpa mutasi. |
| W-3 | Dedup `event_id` | `(tenant_id, channel_id, event_id)` diperiksa **lebih dulu** (retensi 7 hari di `idempotency_keys`); hanya notification yang benar-benar baru yang boleh masuk transaksi. |
| W-4 | Transisi satu arah | `payments.status` dan `invoices.status` **hanya** bergerak maju pada busur yang terdaftar di SM-3 (`docs/BLUEPRINT_ENTERPRISE.md` §5.4). Penurunan status (`SETTLED → PENDING`) **tidak pernah** terjadi karena urutan callback; busur `PAID → PARTIAL` yang ada di SM-3 **hanya** boleh ditulis oleh workflow koreksi/void ber-`VALIDATE` (§4.10), **tidak pernah** oleh webhook. |
| W-5 | Kunci baris | `SELECT … FOR UPDATE` pada `invoices` **dan** `payments` target di dalam satu transaksi, sebelum memutuskan apa pun. Tanpa baris terkunci = tanpa mutasi. Bukan `LOCK TABLE` (dilarang AGENTS §3.7) dan bukan advisory lock global. |
| W-6 | Nominal dari DB | Angka yang dibukukan = `invoices.net_amount`/sisa tagihan **di database**. `gross_amount`/`paid_amount` payload **hanya dibandingkan**; tidak cocok → `409 CONFLICT` (baris 12) tanpa mutasi. Webhook **tidak pernah** menciptakan invoice/ledger (§4.7.4). |
| W-7 | Actor terdaftar | `audit_logs.actor` = `channelActorId` dari `payment_channels` (akun sistem kanal), **bukan `null` dan bukan `ctx.actorId`** (webhook tidak punya pemanggil; `INTEGRATIONS.md:226` salah, `RD-26`). |
| W-8 | Respons per kasus | Lihat tabel §4.7.6: `200` ACK untuk duplikat/replay/non-final, `410` untuk target mati, `500` **hanya** untuk kegagalan internal yang boleh di-retry. Klien vendor tidak pernah disuruh retry terhadap kondisi semantik. |
| W-9 | Transaksi tunggal | settlement + ledger + lepas cekal + audit + outbox dalam **satu** `db.transaction` di **Primary** (§4.7.5); tidak ada penyelesaian sebagian. |
| W-10 | Read-your-writes | Status `SETTLED` yang dibaca kembali oleh kasir/mahasiswa **wajib** dari Primary (AGENTS §3.7), bukan replica. |

#### 4.7.8 Kompensasi callback terlambat, suspens, dan pembatalan bayar

**(a) Callback datang setelah VA expired / cancelled.** VA adalah objek ber-nyawa (`ISSUED → USED / CANCELLED / EXPIRED`; `docs/INTEGRATIONS.md:513`) dan **tidak pernah** auto-lunas setelah kedaluwarsa (BENCH-23). Karena uang riilnya bisa tetap masuk belakangan (transfer tertahan bank), urutannya:

```
1. Verifikasi signature + W-1..W-6  → dana sah secara kanal, tetapi target VA tidak aktif.
2. Dana ditandai SUSPENSE (status rekonsiliasi), BUKAN SETTLED; TIDAK ada ledger,
   TIDAK ada lepas cekal, TIDAK ada perubahan invoices.status.
3. Buat baris rekonsiliasi di reconciliation_runs dengan status SUSPENSE
   (kolom rows_suspense; DDL: DATA_MODEL §14, slice ADM/KEU).
4. Respons: 410 CALLBACK_TARGET_EXPIRED (baris 49) bila tagihan induk sudah VOID/PAID,
   atau 200 {settled:false, recorded:"SUSPENSE"} bila masih ada peluang penempatan.
5. Penyelesaian oleh TREASURER lewat satu dari tiga jalur, semuanya aksi VALIDATE:
   (i) MATCH    → pasang ke tagihan lain milik mahasiswa yang sama (payment_allocations),
                  lalu jalur settlement normal (§4.7.5) dan ledger ditulis.
   (ii) DEPOSIT → simpan sebagai deposits (saldo mahasiswa) dan terbitkan kuitansi;
                  dipakai pada tagihan berikutnya. Tagihan lama TIDAK di-reopen.
   (iii) RETUR  → pengembalian dana ke sumber (refund/transfer balik), tercatat di ledger
                  sebagai dua entri pembalik yang saling menunjuk (reverses_entry_id, I-4).
6. Setiap jalur menulis audit_logs (actor = petugas, bukan kanal) + outbox.
```
**Larangan keras:** suspens **tidak pernah** diam-diam menjadi lunas (`INTEGRATIONS.md:518`). Menutup buku periode (`accounting_periods`) atau melepaskan gerbang akademik saat masih ada baris `SUSPENSE` → `409 SUSPENSE_UNRESOLVED` (baris 52).

**Catatan kejujuran soal kosakata state (milik `DATA_MODEL.md`, bukan ini).** Enum `payment_status` yang terukur hari ini hanya **INITIATED · PENDING · SETTLED · FAILED · REFUNDED** (`docs/DATA_MODEL.md:2109`), dan `invoice_status` hanya **DRAFT · ISSUED · PARTIAL · PAID · OVERDUE · WAIVED · VOID** (`:2108`). Nilai `SUSPENSE` untuk dana terlambat dan `CANCELLED` untuk pembatalan kanal manual adalah **keadaan yang dibutuhkan kontrak API ini** dan **belum ada di enum mana pun**; `reconciliation_runs.status` yang disebut `INTEGRATIONS.md:515` juga belum punya DDL. Kontrak ini tidak memutuskan ejaan maupun tipe kolom: perluasan enum, tabel, dan migrasi adalah **DDL: `DATA_MODEL.md` §14/§15** (gugus keuangan, slice ADM/KEU). Selama nilai itu belum ada di enum, implementasi **wajib** menahannya di kolom status `reconciliation_runs` dan **tidak** menulis `payments.status` di luar lima nilai sah — bukan memaksakan string baru ke enum yang sudah dibuat.

**(b) Pembatalan bayar (payment cancellation) — kanal manual saja.**

| Aspek | Aturan |
|---|---|
| Siapa | Petugas dengan izin `finance.payment.confirm` (`VALIDATE`, `authz.ts:315`) **dan** bukan orang yang sama yang mencatat pembayaran (`finance.payment.record`, `authz.ts:316`) — SoD, tolak `403 SELF_APPROVAL_FORBIDDEN` (baris 56). |
| Kanal | **Hanya** `payment_channels.kind ∈ {MANUAL, TELLER}`. Kanal gateway (`VA_BANK`, `QRIS`, `BILL`) **ditolak** `409 CANCEL_CHANNEL_NOT_ALLOWED` (baris 51) dan diarahkan ke `POST …/refunds` → `REFUND` via API vendor; `payments.status` berubah hanya lewat callback refund kanal (W-4 tetap satu arah). |
| Jendela | `tenant_settings.payment_cancellation_window_days` (int 0–90; `0` = batal bayar dimatikan untuk tenant). Diukur dari **`settled_at`** di DB, bukan dari waktu yang dikirim klien. Lewat jendela → `409 CANCEL_WINDOW_CLOSED` (baris 50). Batas ini adalah penerjemahan `Batas Akhir Pembatalan Pembayaran` milik pembanding (BENCH-25). |
| Efek tulis | Satu transaksi: pembayaran ditandai batal **lewat entri pembalik** (bukan `UPDATE nominal`) — keadaan `CANCELLED` tunduk pada catatan kejujuran enum di atas, jadi implementasi hari ini menulis pembatalan sebagai `ledger` pembalik + baris `receipts` void (`void_of_receipt_id`), bukan sebagai nilai enum baru; ledger `INSERT` dua baris pembalik yang saling menunjuk, `invoices.status` mundur **hanya** lewat busur koreksi eksplisit `PAID → PARTIAL` (SM-3) dengan `reason` wajib, cekal **dipasang kembali**, `audit_logs` + outbox, `meta.auditId` dikembalikan. |
| Kontrak respons | `POST /api/v1/finance/payments/{paymentId}/cancel` body `{ reason: string(10..500), attachmentId? }` → `200` amplop §2.1 dengan `data.stateMachine` (§2.5) terbaru. `paymentId` dari klien **wajib** diselesaikan ke barisnya di dalam transaksi (`WHERE tenant_id = ctx.tenantId AND id = $1`) sebelum mutate — anti-IDOR. |
| Ledger | `ledger` append-only (`REVOKE UPDATE, DELETE`); pembatalan **tidak pernah** menghapus baris lama (`docs/INTEGRATIONS.md:517`, invariance I-4). |

---

### 4.8 Unggah berkas bertanda tangan (`/api/v1/uploads/*`)
**Status: dispesifikasi — belum diimplementasi.** Rujukan generator: [INTEGRATIONS §4](file:///c:/SICA/docs/INTEGRATIONS.md) (R2/S3, `getSignedUrl` TTL 300 dtk). Tidak ada satu pun rute `/uploads/**` di `apps/web/src/app/api/v1` hari ini.

Prinsip: **klien tidak pernah mengirim URL atau kunci penyimpanan ke rute domain**; klien mengirim `attachmentId` hasil §4.8.

#### 4.8.1 Minta presign

```http
POST /api/v1/uploads/presign
```

**Request (Zod):**
```typescript
export const PresignUploadRequestSchema = z.object({
  category: z.enum([
    'payment_proof',     // bukti bayar
    'pmb_document',      // berkas PMB
    'final_project',     // tugas akhir / skripsi
    'legalisation',      // berkas legalisir
    'import_file',       // berkas impor master data (§4.6.4)
    'avatar',            // dipertahankan dari INTEGRATIONS §4.2
    'assignment',        // dipertahankan dari INTEGRATIONS §4.2
    'diploma_archive',   // dipertahankan dari INTEGRATIONS §4.2
  ]),
  contentType: z.string().min(8).max(128),        // MIME yang ditawarkan klien; divalidasi terhadap allowlist kategori
  sizeBytes: z.coerce.number().int().min(1),      // klaim; dibuktikan ulang saat confirm
  fileNameHint: z.string().max(200).optional(),   // untuk tampilan saja — TIDAK pernah masuk key
  context: z.object({                             // objek penaut, opsional saat unggah awal
    type: z.string().max(40).optional(),          // mis. 'invoice' | 'legalisation_request'
    id: z.string().uuid().optional(),
  }).optional(),
});
```

**Response (`201 Created`) — sama bentuk envelope §2.1:**
```json
{
  "success": true,
  "data": {
    "attachmentId": "b2f7…",
    "uploadUrl": "https://<account>.r2.cloudflarestorage.com/sica-attachments/tenants/…/b2f7.pdf?X-Amz-…",
    "method": "PUT",
    "requiredHeaders": { "Content-Type": "application/pdf" },
    "storageKey": "tenants/8f2a…/payment_proof/2026/10/19/b2f7.pdf",
    "maxBytes": 5242880,
    "expiresAt": "2026-10-19T14:08:22.000Z",
    "expiresInSeconds": 300
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```

#### 4.8.2 Kategori, MIME, dan batas ukuran

| `category` | MIME diizinkan | Maks | TTL presign | Catatan |
|---|---|---:|---:|---|
| `payment_proof` | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | 5 MiB | 300 dtk | Dibaca petugas keuangan; PII → hanya pemilik + peran berhak |
| `pmb_document` | `image/jpeg`, `image/png`, `application/pdf` | 5 MiB | 300 dtk | KTP/Ijazah/skor: **PII berkategori Tinggi** |
| `final_project` | `application/pdf`, `application/zip` | 50 MiB | 900 dtk | Zip di-scan antivirus + isi diperiksa sebelum `AVAILABLE` |
| `legalisation` | `application/pdf` | 10 MiB | 300 dtk | Sumber cetak; tidak boleh diganti setelah `APPROVED` |
| `import_file` | `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | 25 MiB | 900 dtk | Baris ≤ 20.000 (§4.6.4); PII tidak pernah masuk log |
| `avatar` | `image/jpeg`, `image/png`, `image/webp` | 2 MiB | 300 dtk | Existing (`INTEGRATIONS.md:345`) |
| `assignment` | `application/pdf`, `application/zip` | 25 MiB | 300 dtk | Existing (`INTEGRATIONS.md:346`) |
| `diploma_archive` | `application/pdf` | 10 MiB | 300 dtk | Existing (`INTEGRATIONS.md:347`) |

Di luar allowlist → `422 INVALID_UPLOAD_CATEGORY` (baris 39) / `422 VALIDATION_FAILED` (baris 6); `sizeBytes` melewati batas kategori → `413 FILE_TOO_LARGE` (baris 40). Plafon agregat per tenant (`tenant_quotas.storage_bytes`) diperiksa **sebelum** presign diterbitkan; terlampaui → `409 CONFLICT` (baris 12).

#### 4.8.3 Kunci objek yang disanitasi

```
tenants/{tenantId}/{category}/{yyyy}/{mm}/{dd}/{attachmentId}.{ext}
```

- `{attachmentId}` = UUID yang dibuat server (row `attachments` dibuat **sebelum** presign). `{ext}` diturunkan dari **MIME yang lolos allowlist** lewat kamus tetap (`application/pdf → pdf`), **bukan** dari nama file klien.
- **Dilarang** memakai `fileName` mentah dari klien sebagai bagian dari key. Pola lama `…/${Date.now()}-${params.fileName}` (`INTEGRATIONS.md:369`) adalah sumber path traversal (`../../`), tabrakan nama, dan pemalsuan ekstensi — digantikan template di atas.
- Nama asli disimpan terpisah di `attachments.original_name` setelah disanitasi: buang semua karakter kendali, buang komponen path (`path.basename`), normalisasi spasi berlebih, potong 200 karakter, dan **tidak pernah** dipakai untuk penamaan objek maupun routing. Ekstensi asli tidak menentukan MIME.
- `Content-Type` diikat ke presign (`requiredHeaders` di respons): PUT dengan MIME berbeda → S3/R2 menolak (403), dan `confirm` juga menolak bila hasil HEAD tidak sama dengan yang diizinkan kategori.
- Tidak ada `PublicRead`; akses hanya lewat presigned **GET** ber-TTL pendek (§4.8.5). Bucket wajib `block public access` + bucket policy (`docs/SECURITY_COMPLIANCE.md:254`).

#### 4.8.4 Baris `attachments` yang dipersist

Tabel **`attachments` belum memiliki DDL di mana pun** (temuan RD-27): tidak ada di `packages/database/src/schema/*` dan tidak ada `CREATE TABLE attachments` di `docs/DATA_MODEL.md`. Kontrak API ini menetapkan **baris yang wajib ada**; pemilik DDL = `DATA_MODEL.md` (§14, slice ADM), dengan kolom sekurang-kurangnya:

| Kolom | Tipe | Isi |
|---|---|---|
| `id` | `uuid PK` | = `attachmentId` di kontrak |
| `tenant_id` | `uuid NOT NULL` | kolom pertama; RLS `ENABLE` + `FORCE` (AGENTS §3.2) |
| `category` | `text` (`CHECK` = allowlist §4.8.2) | tidak bebas |
| `storage_key` | `text NOT NULL` | template §4.8.3; `UNIQUE (tenant_id, storage_key)` |
| `original_name` | `text` | sudah disanitasi; tampilan saja |
| `content_type` | `text` | hasil verifikasi HEAD, bukan klaim |
| `size_bytes` | `bigint` | hasil verifikasi HEAD |
| `sha256` | `bytea` | digest isi; bukti integritas & dedup |
| `status` | `enum` (`PENDING` → `UPLOADED` → `SCANNING` → `AVAILABLE` / `REJECTED` / `EXPIRED`) | hanya `AVAILABLE` yang boleh ditaut objek bisnis |
| `uploaded_by` | `uuid` | subjek penunggah (audit) |
| `context_type`, `context_id` | `text`, `uuid` | penautan ke invoice/tagihan/permohonan/impor |
| `expires_at` | `timestamptz` | berkas `PENDING`/`EXPIRED` dibuang otomatis lewat lifecycle |
| `created_at`, `updated_at` | `timestamptz` | — |

#### 4.8.5 Konfirmasi, pembacaan, dan penautan

```http
POST /api/v1/uploads/confirm      body { "attachmentId": "…" }
GET  /api/v1/uploads/:id          → metadata (tanpa isi)
GET  /api/v1/uploads/:id/url      → presigned GET, TTL 60 dtk
```

1. `confirm` melakukan `HEAD Object`: objek harus ada, `size_bytes` ≤ batas kategori, `Content-Type` ∈ allowlist, lalu hitung `sha256`. Objek tidak ada → `404 NOT_FOUND` (baris 5); isi melebihi batas → `413 FILE_TOO_LARGE` (baris 40) + hapus objek yatim.
2. Status pindah ke `AVAILABLE` **hanya** setelah `confirm` sukses (dan scan/inspection untuk `final_project`/`import_file` selesai). Rute domain menolak `attachmentId` yang masih `PENDING`/`REJECTED` dengan `422 VALIDATION_FAILED`.
3. Presign kedaluwarsa tanpa PUT → baris menjadi `EXPIRED`, objek ikut dibersihkan lifecycle; `attachmentId` lama tidak dapat diterbitkan ulang (buat baru).
4. `GET /uploads/:id/url` **wajib** melewati guard dua lapis (izin modul + relasi `context_id` milik peminta). Pemanggil tidak boleh mengambil berkas tenant lain walau tahu `attachmentId` — RLS `tenant_isolation` + filter relasi, keduanya, bukan salah satunya.
5. Paritas Mobile (§3.4 AGENTS): Flutter memakai rute yang sama; tidak ada jalur unggah khusus mobile yang menerima `fileUrl` bebas.
6. Konsumen lama yang menerima URL dari klien **diubah ke `attachmentId`**: contoh §4.4.3 `POST /lms/assignments/:id/submit` (badan `fileUrl: z.string().url()` adalah vektor SSRF/pemalsuan dan tidak dipakai lagi).

---

### 4.9 Verifikasi keaslian dokumen (publik) — `GET /api/v1/public/verify/:digest`
**Status: dispesifikasi — belum diimplementasi.** Menutup BENCH-121 (endpoint verifikasi publik tidak ada di koleksi rute) dan AC-DOC-1 / NFR-R5 / invariance I-10 (`docs/BLUEPRINT_ENTERPRISE.md:827`). QR pada KHS/Transkrip/Kartu Ujian/SKPI/legalisir menunjuk ke rute ini.

```http
GET /api/v1/public/verify/{digest}
```

| Aspek | Aturan |
|---|---|
| Autentikasi | **Tanpa auth.** Tidak ada JWT, tidak ada `X-Tenant-ID` (tenant diturunkan dari baris dokumen). |
| `digest` | 64 karakter heksa SHA-256, **case-insensitive, divalidasi Zod**: `z.string().regex(/^[0-9a-fA-F]{64}$/)`. Bukan UUID, bukan id dokumen — tidak dapat ditelusuri berurutan (anti-enumeration). |
| Rate limit | Kelas publik, agresif: per IP sumber (dimensi kedua: `digest` yang sama dari IP berbeda). Lewati batas → `429 RATE_LIMIT_EXCEEDED` (baris 9). Format `digest` salah → `422 VALIDATION_FAILED` (baris 6). |
| Cache | `Cache-Control: private, no-store` — hasil verifikasi bisa berubah saat dokumen di-revoke, jadi **tidak boleh** di-cache CDN per `digest` tanpa invalidasi. |
| Sumber | Baris `documents` (`kind`, `number`, `digest_sha256`, `verification_url`, `is_revoked`, `signed_at`) — tabel ini **belum punya DDL** (`docs/DATA_MODEL.md:1662` menjadwalkannya ke migrasi `0019_graduation_documents.sql`); `document_signatures` menyimpan `cert_serial`/`provider` untuk TTE tersertifikasi (BR-R15). |

**Response `200 OK` (dokumen sah & masih berlaku):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "document": { "kind": "TRANSKRIP", "number": "1234/UNPAD/TU/2026", "issuedOn": "2026-09-01" },
    "subject":  { "name": "Budi Hartono", "nim": "10123456", "programName": "S1 Teknik Informatika", "status": "LULUS" },
    "issuer":   { "tenantName": "Universitas Contoh", "issuedAt": "2026-09-01T08:00:00.000Z" },
    "signature":{ "provider": "BSRE", "certified": true, "signedAt": "2026-09-01T08:00:00.000Z" }
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```

**Dokumen ditarik / kedaluwarsa — verifikasi menolak mengesahkan:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "status": "REVOKED",
    "document": { "kind": "TRANSKRIP", "number": "1234/UNPAD/TU/2026" },
    "revokedAt": "2026-10-12T10:00:00.000Z",
    "subject": null
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```

**Aturan isi respons (PII minimal — wajib):**
1. **Hanya** empat identifikasi subjek yang boleh muncul: `name`, `nim`, `programName`, `status`. Dilarang: tanggal lahir, alamat, NIK/IPK rinci, daftar nilai, email, nomor WhatsApp, `studentId` internal, `tenantId`.
2. Untuk `status ∈ {REVOKED, EXPIRED}`: `subject` **di-`null`-kan** dan hanya `kind` + `number` yang ditampilkan. Verifikasi gagal tidak boleh menjadi kanal pembocoran data (pola yang dikecam pada pembanding: BENCHMARK D-4).
3. Digest tidak dikenal → `404 NOT_FOUND` (baris 5) dengan pesan seragam: **sama** untuk "tidak pernah ada" dan "sudah dihapus" — tidak ada sinyal yang membedakan.
4. Tidak ada daftar/pencarian: rute ini hanya menerima satu digest, mengembalikan satu ringkasan. Tidak ada `?q=`, tidak ada paginasi, `meta.pagination` **tidak** muncul.
5. Setiap verifikasi dicatat ke `document_verifications(digest, verified_at, ip_hash, user_agent_hash, result)` — **`ip_hash`**, bukan IP mentah (pola kolom yang sama dipakai `docs/DATA_MODEL.md:250,294` dan bentuk `audit_logs` di `docs/SECURITY_COMPLIANCE.md:341`; redaksi PII log adalah aturan wajib §4.6.4). Pencatatan ini tidak boleh memperbesar latensi secara kasatmata (tulis via outbox).
6. Nomor akses publik yang tampil di dokumen cetak adalah `verificationUrl` berisi digest ini; URL **tidak boleh** dapat ditebak dari nomor induk saja.
7. Paritas Mobile: layar "Pindai QR verifikasi" memakai rute yang sama; tidak ada varian berautentikasi.

---

### 4.10 Dispensasi keuangan, keringanan (waiver), cicilan & siklus Virtual Account (`/api/v1/finance/*`)
**Status: `spec-only` seluruh gugus ini.** Diukur: `ls apps/web/src/app/api/v1` hanya menghasilkan `academic`, `attendance`, `auth`, `health`, `tenant` — jadi **tidak ada** `/api/v1/finance/**`, `/api/v1/mbkm/**`, `/api/v1/curricula/**`, `/api/v1/reports/**`, `/api/v1/ops/**`, `/api/v1/uploads/**`, dan `/api/v1/admin/**`. Rujukan objek & DDL: `DATA_MODEL.md` §5/§14 (gugus keuangan, migrasi `0015`/`0020`, `virtual_accounts` **belum punya DDL** — `docs/AUDIT_READINESS.md:179`). Rujukan kebutuhan: `PRD.md` FR-KEU-05/06/07/11, `INTEGRATIONS.md` §2.4.

**Izin yang dipakai gugus ini.** Dari katalog 222 izin (`packages/contracts/src/authz.ts`, terukur 222 entri `{ key:`): `finance.waiver.request` (`:319`, `INSERT`), `finance.waiver.approve` (`:320`, `VALIDATE`), `finance.invoice.voidrequest` (`:311`, `INSERT`), `finance.invoice.void` (`:310`, `VALIDATE`), `finance.installment.create` (`:313`, `INSERT`), `finance.installment.view` (`:312`, `READ`), `finance.deposit.manage` (`:318`, `UPDATE`), `finance.payment.confirm` (`:315`, `VALIDATE`), `finance.payment.record` (`:316`, `INSERT`), `finance.reconcile.run` (`:322`, `UPDATE`), `finance.gate.override` (`:324`, `OTHER`), `finance.report.view` (`:325`, `READ`), `finance.ledger.view` (`:321`, `READ`). **Usulan — belum di katalog (`G-15` jalur promosi):** `finance.dispensation.request/.decide`, `finance.va.generate/.cancel/.view`, `finance.waiver.approve`, `finance.export.run`. Kelima kelompok itu **tidak boleh** ditulis ke kode sebelum naik ke `RBAC_MATRIX.md` §4 lalu `PERMISSION_SPECS`; rute di bawah menandainya per baris.

#### 4.10.1 Pengajuan & keputusan dispensasi (gerbang KRS dibuka tanpa pelunasan)

Dispensasi ≠ waiver. **Dispensasi** membuka *gerbang akademik* (`academic_rules.gates`) untuk mahasiswa bertagihan; **waiver/keringanan** mengubah *nominal* tagihan lewat entri ledger. Keduanya tidak boleh disatukan jadi satu endpoint.

```http
POST  /api/v1/finance/dispensations                    body DispensationRequestSchema                     → 201
GET   /api/v1/finance/dispensations                    list §2.4                                          → 200
GET   /api/v1/finance/dispensations/{id}               detail + `data.stateMachine` = view **tagihan/gerbang** (SM-3)  → 200
POST  /api/v1/finance/dispensations/{id}/approve       VALIDATE pihak ke-1 (keuangan)                    → 200
POST  /api/v1/finance/dispensations/{id}/academic-ok   VALIDATE pihak ke-2 (akademik)                    → 200
POST  /api/v1/finance/dispensations/{id}/reject        body { reason }                                   → 200
POST  /api/v1/finance/dispensations/{id}/cancel        hanya selama SUBMITTED, oleh pemohon               → 200
```

```typescript
export const DispensationRequestSchema = z.object({
  studentId: UUIDSchema.describe("Diselesaikan ke barisnya di dalam transaksi; carrier tidak dipercaya"),
  periodId: UUIDSchema,
  invoiceIds: z.array(UUIDSchema).min(1).describe("Set yang dibebaskan dari gerbang; bukan semua tagihan"),
  gateCodes: z.array(z.string().max(64)).min(1).describe("krs.submit | khs.view | exam.card | yudisium"),
  reason: z.string().min(10).max(1000),
  attachmentId: UUIDSchema.describe("Wajib: SK cuti / surat tugas / bukti beasiswa dari §4.8"),
  validUntil: z.string().datetime().optional().describe("Dispensasi berumur; sesudahnya gerbang menutup sendiri"),
});
// SERVER_ONLY — ditolak bila muncul di body (§4.11 butir 2):
//   status, approvedBy, academicApprovedBy, grantedAt, nim, status_akademik
```

**Dua pihak berbeda peran (SoD, wajib diuji bukan diasumsikan):**
1. Approver **keuangan** (`TREASURER`, izin `finance.waiver.approve` dipakai silang sampai `finance.dispensation.decide` dipromosikan) menyetujui sisi nominal/penahan.
2. Approver **akademik** (`HEAD_OF_PROGRAM` atau `ADMIN_ACADEMIC`; `DEKAN` menunggu wadah scope `G-13`) menyetujui sisi akademik. **Wajib orang berbeda** dan **bukan pemohon**: `approverId ≠ requesterId` dan `approverKeuangan ≠ approverAkademik` → tolak `403 SELF_APPROVAL_FORBIDDEN` (baris 56).
3. Gerbang baru lepas **setelah** dua APPROVED **dan** `validUntil` belum lewat; efeknya satu transaksi: tulis `academic_rule_overrides` (objek: `DATA_MODEL.md` §14), pasang `blockades.lifted_*` dengan `lift_reason='DISPENSATION_GRANTED'`, `audit_logs`, outbox, dan `data.stateMachine` terbaru di respons. **Catatan:** objek dispensasi sendiri **tidak** punya mesin state terdaftar; view yang dikirim adalah view **tagihan/gerbang pada SM-3** (`DATA_MODEL §15`: `invoice_status` = 7 nilai, SM-3), bukan `machine` baru yang dikarang (§2.5 butir 3 membatasi enum `machine` pada SM-1…SM-8).
4. Transisi **satu arah**: `SUBMITTED → FINANCE_APPROVED → APPROVED`, cabang `REJECTED`/`CANCELLED` terminal. Keputusan kedua pada objek terminal → `409 DECISION_ALREADY_MADE` (baris 55).
5. Nominal **tidak** ditampilkan ke peran akademik yang tidak berhak (SoD BAAK↔BAUK); mereka menerima `data.blocked: true` + `reasons[]` — bukan jumlah (`BLUEPRINT_ROLE_BY_ROLE §0.3`).

**List** memakai amplop tunggal §2.4: `page, limit, sortBy, sortDir, q` + filter `periodId`, `studentId`, `status`, `gateCode`; hasil di `meta.pagination{page,limit,totalRecords,totalPages,hasNextPage,hasPrevPage}`. Allowlist `sortBy` resource `finance/dispensations`: `submittedAt`, `status`, `validUntil`, `decisionAt`.

#### 4.10.2 Keringanan / waiver (mengubah nominal lewat ledger)

```http
POST /api/v1/finance/waivers      body { invoiceId, basis, kind, amountRupiah | percentBps, reason, attachmentId }
GET  /api/v1/finance/waivers      list §2.4
POST /api/v1/finance/waivers/{id}/approve      VALIDATE oleh bendahara (bukan pemohon)
POST /api/v1/finance/waivers/{id}/reject       body { reason }
```
| Aturan | Isi |
|---|---|
| `basis` | Enum `FULL / AMOUNT / PERCENT / SCHOLARSHIP / ERROR_CORRECTION` — **wajib** ada karena keringanan tanpa dasar tidak dapat diaudit (FR-KEU-05). |
| Nominal | `amountRupiah` **bigint rupiah**, tanpa float; `percentBps` basis poin (10000 = 100%) agar tidak ada galat pembulatan. Melebihi sisa tagihan → `422 WAIVER_EXCEEDS_OUTSTANDING` (baris 57). |
| Efek tulis | **Bukan** edit `invoices.total_rupiah`/`net_amount` in-place: waiverApproved → `INSERT` baris `payment_waivers` (DDL: `DATA_MODEL.md:994`) + **entri ledger baru** bertipe penyesuaian + tagihan menjadi `WAIVED`/`PARTIAL` sesuai busur SM-3. Ledger append-only; `invoices.waiver_id` menunjuk keputusan utama. |
| Approver | `finance.waiver.approve` (`VALIDATE`) **mutual-exclusion** dengan grant `finance.waiver.request` pada peran yang sama (`RBAC_MATRIX:463`); penolakan wajib `reason ≥ 10 char` dan **bukan izin kedua** (vonis `RBAC §4.5.1`: hasil negatif dari transisi `VALIDATE` pada baris yang sama), sehingga `K-3` tertutup sebagai ralat bukan sebagai izin baru. |
| Enam lapis | lihat §4.11. |

#### 4.10.3 Siklus hidup Virtual Account

```http
POST   /api/v1/finance/virtual-accounts            generate (VA ber-nyawa)             → 201
GET    /api/v1/finance/virtual-accounts             list §2.4                            → 200
GET    /api/v1/finance/virtual-accounts/{id}         detail + sub-state SM-3 (view tagihan)  → 200
DELETE /api/v1/finance/virtual-accounts/{id}         batal VA (bukan hapus baris)         → 200
POST   /api/v1/finance/virtual-accounts/{id}/cancel  batal + alasan + audit               → 200
```

```typescript
export const GenerateVaRequestSchema = z.object({
  studentId: UUIDSchema.optional(),
  invoiceIds: z.array(UUIDSchema).max(200).optional(),
  tariffGroupId: UUIDSchema.optional(),
  channelCode: z.string().max(64).describe("payment_channels.code milik tenant; wajib is_active"),
  expiresInHours: z.number().int().min(1).max(720).default(168).describe("Tunduk payment_windows.cutoff_time bila lebih ketat"),
});
```

| Aturan | Isi |
|---|---|
| **Filter yang saling meniadakan** | `tariffGroupId` terisi **bersamaan** dengan `invoiceIds[]` → **`422 VA_FILTER_CONFLICT`** (register §2.3 **baris 53**). Dua sumber seleksi = dua kebenaran berbeda; server menolak, tidak pernah mendahulukan salah satunya diam-diam. Justru hal yang tidak dapat dilakukan pembanding (BENCH-22) kini menjadi kontrak eksplisit. |
| Minimal satu sumber | Keduanya kosong → `422 VALIDATION_FAILED` (baris 6) dengan `details[].field = "invoiceIds"`. |
| Kepemilikan | Setiap `invoiceIds[]` diselesaikan `WHERE tenant_id = ctx.tenantId AND id = $1` **di dalam transaksi** dan dibuktikan milik `studentId` sebelum VA diterbitkan (anti-IDOR). |
| Keunikan | `va_number` unik **global per bank** lintas tenant (BENCH-34) — kunci ini berada di luar RLS dan harus ditegakkan lewat `UNIQUE (bank_code, va_number)`; DDL + migrasi: `DATA_MODEL.md` §14 (`0020/0022`). |
| Status | `ISSUED → USED / CANCELLED / EXPIRED` (sub-state SM-3). Batal pada `USED` → `409 VA_ALREADY_USED` (baris 54); lewat `expires_at` → `EXPIRED` oleh job sweep, dan dana yang datang kemudian masuk §4.7.8(a), **bukan** auto-lunas (BENCH-23). |
| Izin | `finance.va.generate/.cancel/.view` = **usulan — belum di katalog (`G-15`)**; sementara implementasi **tidak boleh** mengarang string, sehingga rute ini tidak dapat dibuka sebelum promosi izin. |
| Enam lapis | L5 termasuk gerbang "tagihan sudah `ISSUED`" (VA tidak terbit untuk `DRAFT`) dan `channel.is_active`. |

#### 4.10.4 Cicilan, denda, dan jadwal bayar

```http
GET  /api/v1/finance/invoices/{id}/schedule      → 200  (bentuk §2.1; array termin di data.installments[])
POST /api/v1/finance/invoices/{id}/installments  → 201  (finance.installment.create, terdaftar)
```
1. `GET …/schedule` mengembalikan **hasil perhitungan server**: `{invoiceId, netAmountRupiah, penaltyMode, dueAt, cutoffTime, installments[{seq, dueAt, amountRupiah, lateFeeRule, status}], outstandingRupiah, gateState}`. Klien tidak menjumlahkan sendiri.
2. Jumlah termin **wajib** menutup pokok + denda sesuai `penalty_mode` (`payment_windows.penalty_mode`; `docs/INTEGRATIONS.md:514`); tidak → `422 INSTALLMENT_PLAN_INVALID` (baris 58). `invoice_installments` dan `payment_plans` **masih satu konsep ganda** yang wajib direkonsiliasi oleh `DATA_MODEL.md` sebelum `0015` (dicatat di `INTEGRATIONS.md:515`) — kontrak API hanya mengenal `installments[]`.
3. **Denda tidak pernah berupa sunting nominal.** Denda muncul sebagai **baris ledger baru** (`ref_type='penalty'`, `DATA_MODEL.md:941`) dengan `source_id` menunjuk tagihan, pada peristiwa `PENALTY_POSTED` saat `OVERDUE` tercapai. Koreksi denda = entri pembalik. `invoices.*` tidak di-`UPDATE` untuk mengubah denda; `ledger.*` adalah `SERVER_ONLY`.
4. Waiver/cuti **tidak** menghentikan dema secara diam-diam: `payment_waivers`/`student_status = ON_LEAVE` dievaluasi server dalam perhitungan `lateFeeRule`; penyimpangan dilaporkan sebagai `warnings[]`, bukan dihitung klien.
5. Gerbang akademik mengikuti tagihan **induk** (AC-KEU-5): cicilan lunas ≠ tagihan lunas; `gateState` pada respons inilah yang menentukan KRS boleh jalan, dan `GATE_BLOCKED` (baris 38) memuat `details[]` + `state` §2.5 agar layar "mengapa terkunci" dapat dirender.

#### 4.10.5 Ekspor (verba `OTHER`, bukan verba ketujuh)

```http
POST /api/v1/finance/dispensations/export    body { filter §2.4 tanpa page/limit, format: "XLSX" | "CSV", columns[] }
GET  /api/v1/finance/exports/{jobId}         status job + attachmentId hasil §4.8
```
- `EXPORT` **tidak** menjadi verba ketujuh: ia `OTHER` dengan resource terdaftar (`RBAC_MATRIX §4.1`: `EXPORT → OTHER`). Izin spesifik (`finance.export.run`) = **usulan — belum di katalog**; sementara ini hanya peran ber-`finance.report.view` yang boleh mengajukan.
- Plafon sinkron **10.000 baris**; lebih → `422 EXPORT_LIMIT_EXCEEDED` (baris 59) dan klien dipindah ke job asinkron yang hasilnya ditaut sebagai `attachments` (`category` ekspor: usulan) lalu diambil lewat `GET /uploads/:id/url` (§4.8.5) — **bukan** URL langsung di respons.
- Ekspor **selalu** menyaring kolom PII sesuai peran pengekspor (proyeksi server, `FIELD_RULES`), mencatat `audit_logs` + `meta.auditId`, dan **tidak** membaca replica.

#### 4.10.6 Audit setiap mutasi finansial

Tidak ada mutasi finansial tanpa jejak: `POST/PATCH/DELETE` pada `dispensations`, `waivers`, `virtual-accounts`, `installments`, `payments/{id}/cancel`, dan `exports` **wajib** menulis `audit_logs(actor, action, resource, before, after, reason)` **di dalam transaksi yang sama** dan **memantulkan `auditId` di `meta` respons** (amplop §2.4a; `meta.auditId` hanya ada pada mutasi, tidak pernah pada list baca). `actor` = subjek terverifikasi untuk rute berautentikasi, `channelActorId` untuk webhook (§4.7.5) — keduanya tidak boleh `null`.

---

### 4.11 Aturan lintas-gugus untuk seluruh rute tulis enterprise (§4.2.11–§4.2.14, §4.3.6–§4.3.8, §4.6.7, §4.6.8, §4.7.7–§4.7.8, §4.10, §4.12, §4.14, §4.16, §4.17, §4.18, §6.10)

Sub-bagian ini ada agar enam lapis **tidak ditulis empat kali dengan sedikit berbeda**. Setiap rute tulis baru di dokumen ini **wajib** memenuhinya; menyalahi satu butir = temuan audit, bukan gaya kode.

1. **Enam lapis penegakan (AGENTS §3.8, `BLUEPRINT_ROLE_BY_ROLE §0.4`).**

   | Lapis | Nama | Kewajiban konkret pada rute baru | Bukti kegagalan yang sudah ada di kode |
   |---|---|---|---|
   | L1 | Transport | Zod `strict()` + **whitelist field**; field tak dikenal ditolak, tidak diabaikan; `limit ≤ 100`; enum kanonik (UPPER) untuk nilai yang dikirim ulang ke DB | `krs/submit` sudah divalidasi; `qr/generate` menerima `classId`/koordinat dari body |
   | L2 | Identitas | `tenantId`/`userId` **hanya** dari JWT terverifikasi; middleware **wajib menghapus** `x-tenant-id`/`x-user-id` kiriman klien **sebelum** menyetel milik sendiri | `SEC-07` — header klien hari ini ikut dibaca |
   | L3 | Permission berbasis tabel | `requireDataPrincipal` atas `user_role_assignments` + `valid_to`; **bukan** perluasan carrier `member_role` | `SEC-10` — resolver ada (`rbac-repository.ts:70-95`), tidak terhubung ke rute |
   | L4 | Scope | `holdsScoped(access, PERM.x, { kind, id })` untuk TENANT/ORG/PROGRAM/CLASS/PERIOD/SELF **dan SITE** (dimensi baru dari `0044`/§4.6.7; tanpa itu "hak hanya di kampus cabang" tidak dapat dinyatakan) | `SEC-11` — fungsi ada, **nol** pemanggil |
   | L5 | State | Periode `OPEN` (baris 25), status `LOCKED` (baris 35), gerbang tagihan (baris 38), cekal, jendela waktu, lease hidup, SoD (baris 56) | `SEC-02` — baris `LOCKED` masih bisa ditimpa |
   | L6 | RLS | `SET LOCAL app.current_tenant` dalam tiap transaksi; `sica_app` `NOBYPASSRLS`; filter query **bukan** pengganti RLS (CI menolak) | empat titik kegagalan wajib diuji (AGENTS §3.8) |

2. **Kolom `SERVER_ONLY` tidak pernah diterima dari body.** Daftar kanonik: `grades.status`, `grades.letter`, `invoices.status`, `payments.status`, `ledger.*`, `enrollments.status`, `students.nim`, `students.status_akademik`, `mfa_factors.secret`, `pddikti_*_id` — **satu-satunya daftar ada di `docs/DATA_MODEL.md` §14.9**; dokumen ini tidak menggandakannya. Rute §4.10 secara khusus menolak `status`, `approvedBy`, `academicApprovedBy`, `grantedAt`, `waiverId`, `netAmount` dari badan: semuanya hasil transisi state. Turunan gelombang 2 (`ml_model_versions.*`, `risk_scores.*`, `attendance_token_uses.*`, `audit_chain_anchors.*`, `outcome_attainments.*`, `tuition_tariff_matrix.amount_rupiah`, `enrollments.program_type`, `grade_change_logs.*`) didaftar **satu kali saja** di §4.6.7 dan §6.10 — bukan diulang per rute; tambahan gugus kamus & atribut kustom (`reference_kinds.*`, `reference_items.*`, `tenant_custom_attributes.*`, `custom_attribute_history.*`) didaftar satu kali di **§4.14.5**.
3. **Anti-IDOR.** Setiap id dari klien (`invoiceId`, `studentId`, `sessionId`, `periodId`, `opId`, `paymentId`, `attachmentId`) diselesaikan ke barisnya **di dalam transaksi** dengan `WHERE tenant_id = ctx.tenantId AND id = $1`, kepemilikan **dibuktikan**, **baru** mutate. Rute tulis yang menerima `enrollmentIds[]`/`invoiceIds[]` tanpa pembacaan DB = temuan `SEC-02/03/04`.
4. **Nominal & PII.** Nominal hanya dibaca dari DB (W-6); peran tanpa hak finansial menerima boolean tertahan + sebab, bukan angka. Kolom PII disaring pada **proyeksi server**, bukan disembunyikan di sel UI.
5. **Mutasi hanya ke Primary**; hasil yang akan dipakai menulis lagi dibaca dari Primary (AGENTS §3.7). **Audit + `meta.auditId`** pada setiap tulis. **Idempotensi** (`Idempotency-Key`, §4.2.14) untuk setiap aksi yang dapat diulang klien.
6. **Entitlement memotong lebih dulu dari role**: modul non-`ACTIVE`/`TRIAL` → `404 MODULE_NOT_AVAILABLE` (baris 26) walau izin ada. Helper `withModule` **wajib** terpasang sebagai call site nyata pada seluruh rute baru ini (hari ini nol call site — `SEC-09`), bukan hanya ada sebagai fungsi.
7. **Izin lebih dulu, kode kemudian.** Tidak ada rute §4.10/§4.12 yang boleh diimplementasi sebelum baris izinnya ada di `RBAC_MATRIX.md` §4 lalu `PERMISSION_SPECS` (`authz.ts`). Label **"usulan — belum di katalog (`G-15`)"** pada §4.10 pembuka dan §4.12.1 berarti izin itu **tidak boleh dipakai di kode** hari ini; menulis string permission di luar katalog dilarang `AGENTS §3.8` dan akan melahirkan katalog kedua (`RD-04`/`RD-05`).
8. **Empat titik kegagalan wajib diuji, bukan diasumsikan aman** (AGENTS §3.8): izin ada tapi data prodi lain · izin ter-cache tapi sudah dicabut · `tenant_id` benar tapi periode salah · filter ada di query tapi RLS tidak aktif. Empat test itu adalah gate CI untuk setiap rute gugus ini, bukan backlog.

---

### 4.12 MBKM: konversi SKS & OBE (outcome-based education)
**Status: `spec-only`.** Tidak ada rute `/mbkm/**` maupun `/curricula/**/outcome-matrix`. **Catatan jujur (diperbarahi 2026-10-20):** klaim lama "objek `mbkm` dan seluruh gugus OBE belum punya DDL di mana pun" **sudah tidak tepat** — DDL-nya **sudah ditulis** di `DATA_MODEL.md`: rantai outcome + `outcome_attainments` pada `0032_obe_outcomes.sql`, konversi MBKM pada `0033_mbkm_conversion.sql`, loop capaian OBE pada `0042_obe_attainment_loop.sql` (`DATA_MODEL §16.2`, `§18.7`). Yang **belum** adalah berkas migrasinya di `packages/database/migrations/`, policy RLS hasil generator, dan izin `VALIDATE` penyetuju yang masih **usulan** (`G-13`, `G-15`). Kontrak API di bagian ini **tetap** tidak memutuskan ejaan tabel/kolom/enum — itu milik `DATA_MODEL.md`; dan loop OBE yang dihitung mesin dispesifikasi di **§6.10.7**, CRUD target & tindak lanjut di **§4.6.7**, agar satu objek tidak punya dua pemilik kontrak.

#### 4.12.1 Konversi MBKM

```http
GET   /api/v1/mbkm/conversions                 list §2.4 (filter: periodId, studentId, status, partnerCode)
POST  /api/v1/mbkm/conversions                 ajukan konversi        → 201
POST  /api/v1/mbkm/conversions/{id}/evaluate   hitung equivalensi + plafon (server-side)  → 200
POST  /api/v1/mbkm/conversions/{id}/approve    approver ke-1 (prodi asal)  → 200
POST  /api/v1/mbkm/conversions/{id}/approve-mitra  approver ke-2 (koordinator mitra)  → 200
POST  /api/v1/mbkm/conversions/{id}/reject     body { reason }        → 200
```

```typescript
export const CreateMbkmConversionSchema = z.object({
  studentId: UUIDSchema,
  periodId: UUIDSchema,
  contractId: UUIDSchema.describe("MBKM contract yang sudah APPROVED (SM-8)"),
  items: z.array(z.object({
    externalCourseCode: z.string().max(64),
    externalCredits: z.number().int().min(1).max(6),
    mappedCourseIds: z.array(UUIDSchema).min(1),
    gradeEvidence: z.string().max(16).nullable(),
  })).min(1).max(40),
  attachmentId: UUIDSchema.describe("Transkrip mitra, dari §4.8"),
});
// SERVER_ONLY: status, approvedBy, approvedMitraBy, convertedCredits, grades (hasil evaluasi)
```

| Aturan | Isi |
|---|---|
| Evaluasi | **Selalu** dua langkah: `evaluate` (kalkulasi, **tanpa** menulis state) lalu `approve`. Hasil `evaluate` = `{proposedLines[], totalProposedSks, remainingCapSks, unmapped[]}`; klien tidak boleh menampilkan angka final sebelum server mengevaluasi. |
| Plafon | Konversi melewati **20 SKS/semester** (BR-M1) → `422 MBKM_SKS_CAP_EXCEEDED` (baris 30). Dasar pemetaan = `course_equivalencies` (§4.6 objek 9), **bukan** tabel bebas. |
| Dua approver | Approver prodi asal (`VALIDATE`) **dan** koordinator mitra (`VALIDATE`) = **dua actor berbeda**, keduanya ≠ pemohon → `403 SELF_APPROVAL_FORBIDDEN` (baris 56). Keputusan kedua pada objek terminal → `409 DECISION_ALREADY_MADE` (baris 55). |
| State | Mengikuti **SM-8** MBKM (`docs/BLUEPRINT_ENTERPRISE.md` §5.9): `DRAFT → SUBMITTED → EVALUATED → APPROVED / REJECTED`; `EFFECTIVE` hanya setelah nilai turunan tertulis via koreksi/`grades`, tidak via edit. |
| Izin | `mbkm.conversion.request/.approve` ada di **`RBAC_MATRIX §4.3` yang berstatus NON-NORMATIF** (`G-15`: ±54 kode add-on nol entri di `PERMISSION_SPECS`). Jadi keduanya = **usulan — belum di katalog**; wajib dipromosikan per modul (`P-10`: jangan jual modul tanpa tabel) sebelum kode. |
| Enam lapis | §4.11. L5 mencakup: contract `APPROVED`, periode `OPEN`, gerbang tagihan, plafon SKS, logbook MBKM lengkap. |

#### 4.12.2 Matriks outcome (CPL/CLO/CMO) & capaian

```http
GET  /api/v1/curricula/{id}/outcome-matrix            → 200  matriks + coverage + versionState
POST /api/v1/curricula/{id}/outcome-matrix/validate   → 200  hasil validasi (tanpa mutasi state)
POST /api/v1/curricula/{id}/outcome-matrix            → 201  simpan draft versi baru
GET  /api/v1/reports/obe/attainment                   → 200  list §2.4 (agregat capaian)
```

1. **Bentuk `GET …/outcome-matrix`** (amplop §2.1; ini **bukan** list, jadi tidak ada `meta.pagination` — baris capaian ada di `data.rows[]` dan agregasi di `data.summary`):
```json
{
  "success": true,
  "data": {
    "curriculumId": "…",
    "curriculumVersion": 4,
    "versionState": "DRAFT",
    "summary": { "cplCount": 8, "cloCount": 42, "coveredClos": 39, "coveragePct": 92.8, "uncoveredOutcomeIds": ["…"] },
    "rows": [
      { "outcomeId": "…", "code": "CLO-3", "level": "C3", "mappedCourseIds": ["…"], "weightPct": 25, "evidence": "grade_component_scores" }
    ]
  },
  "meta": { "timestamp": "…", "requestId": "…" }
}
```
2. **`…/validate`** menghitung: setiap CPL punya ≥1 CLO; setiap CLO punya ≥1 matakuliah + ≥1 komponen pengukuran; bobot agregasi per outcome **= 100%**; tidak ada baris yatim. Gagal → `422 OUTCOME_MATRIX_NOT_COVERED` (baris 65) dengan `details[]` berisi `outcomeId` yang bolong (satu kode untuk satu kondisi: "matriks tidak menutup"). Rute ini **read-only secara state** — ia **tidak** boleh memindahkan kurikulum ke `APPROVED`.
3. **`attainment`** = proyeksi agregat (list §2.4: `page, limit, sortBy, sortDir, q` + filter `programId`, `periodId`, `outcomeCode`, `cohortYear`), dihitung dari **`grades` efektif + matriks versi yang berlaku** — **bukan** dari rata-rata yang dihitung klien. Baca boleh ke **Replica** (agregat laporan, bukan read-your-writes), dan nilainya **snapshot** per `calculatedAt` agar angka historis tidak berubah diam-diam.
4. **Peran.** Penulis matriks: `HEAD_OF_PROGRAM`/`ADMIN_ACADEMIC` (`academic.curriculum*` terdaftar sebagai `INSERT/UPDATE`). Penyetuju (`VALIDATE`) kurikulum: **usulan — belum di katalog**; `DEKAN` masih tanpa wadah scope (`G-13` → `423 DEKAN_SCOPE_REQUIRED`, baris 34).
5. **Paritas Mobile** (§3.4 AGENTS): layar OBE Mobile memakai rute yang sama; tidak ada varian agregasi di klien.

---

### 4.13 Catatan penomoran (agar tidak ada tumpang tindih)
Gugus baru menempati §4.10–§4.12 (sebelumnya dokumen berhenti di §4.9) dan §4.2.11–§4.2.14 serta §4.3.6–§4.3.9. Nomor yang **direzerwasi dan belum ditulis** tetap milik penghuninya: §4.2.7–§4.2.10 untuk `krs/approve`, `grading`, `krs/current`, `krs/withdraw` (catatan §5.2); §4.3.3–§4.3.4 untuk `attendance/sessions/:id/stats` dan `attendance/history` (catatan §5.3); **§4.15** untuk `documents/print/:type` (`spesifikasi-hilang`, §5.9) bila dipulihkan — bukan dibatalkan diam-diam. Nomor **§4.14 pernah** menunjuk rute itu; sejak 2026-10-20 sore nomor itu diisi oleh gugus "Master data dinamis & atribut kustom" yang sudah ditagih `DATA_MODEL §20.3`/`§20.8` dan `AGENTS §2.1`, dan rezerwasi `documents/print/:type` **dipindahkan ke §4.15**, bukan dicabut (lihat paragraf rekursi di bawah dan §4.15).

**Gelombang 2 (2026-10-20) tidak merampas nomor siapa pun.** Objek master & set CRUD/approve masuk **§4.6.7** (anak §4.6, bukan gugus §4 baru) karena ia memang penghuni pola CRUD §4.6; kontrak endpoint engine **ALG-8…ALG-14** masuk **§6.10** (anak bab engine §6). Nama field `counter`/`mac9` (§6.10.6) adalah keputusan penamaan final yang **mengganti** `windowIndex`/`challengeToken` di §4.3.6–§4.3.7 pada saat implementasi — §4.3 tidak dihapus agar rujukannya tidak patah, tetapi satu kontrak hanya boleh ada satu bentuk: §6.10.6 menang.

**Rekursi nomor 2026-10-20 (sore).** §4.14 **dibuka** untuk "Master data dinamis & atribut kustom" karena dua dokumen sudah menunjuk ke nomor itu sebelum nomornya terisi: `DATA_MODEL §20.3` menormakan kontrak pembacaan kamus "di API_SPEC §4.14" dan `DATA_MODEL §20.8` menagihkan biaya cache `ETag`/`X-Lookup-Version` sebagai "tugas API_SPEC §4.14"; `AGENTS §2.1` juga sudah memetakan gugus ini ke §4.14. Rute `GET /documents/print/:type` (`spesifikasi-hilang`, §5.9) yang semula memegang nomor itu **pindah ke §4.15** — **direzerwasi, bukan dibatalkan**: tetap satu-satunya pemilik nomor itu sampai spesifikasinya ditulis atau dicabut dari `INDEX.md`, dan pemindahan ini dicatat di kedua tempat (§4.13 ini dan barisnya di §5.9) agar rujukan lama tidak menjadi klaim palsu.

**Rekursi nomor 2026-10-20 (malam).** §4.16, §4.17, §4.18 **dibuka** pada siklus ini karena tiga dokumen sudah menagih kontrak API sebelum nomornya ada: `DATA_MODEL §21.2`/`§21.3` (mesin parameter + katalog 25 baris — 24 permintaan pemilik + satu kunci hasil vonis TTL), `DATA_MODEL §21.4`–`§21.6` (kosakata modus, rekonsiliasi dua sumber, batas kredensial vendor) dan `DATA_MODEL §21.7` (`menu_items`/`menu_permissions`/`parameter_permissions`), ditambah `AGENTS §2.1` yang sudah memetakan gugus "data master & parameter dinamis" ke `API_SPEC §4.14`–§4.16. **Tidak ada nomor yang dirampas:** §4.15 **tetap** milik rezerwasi `GET /api/v1/documents/print/:type` (`spesifikasi-hilang`, §5.9) — bukan dialihfungsikan menjadi "catatan penomoran" dan bukan dicabut. Gugus baru **tidak** masuk §4.6 sebagai anak (padat: §4.6 sudah memegang pola CRUD 32 objek + §4.6.7 + §4.6.8) dan **tidak** masuk §6 (mesin parameter bukan engine ALG, dan §6 hanya untuk harness engine). Yang **berada di bawah** nomor lama: ralat kosakata modus ditulis **di tempat** di §4.4.1 (nomor §4.4 tidak berubah, makna historis `teachingMethod`/`deliveryType` **tidak dihapus** — hanya dipetakan ke `learningModality`/`sessionKind` dengan masa alias satu rilis), dan perluasan presensi ditulis sebagai §4.18 yang **merujuk** §4.3.6–§4.3.9 alih-alih mengulanginya. Inventaris rutenya satu rumah: **§5.15** (melanjutkan §5.14), register error-nya **§2.3 baris 107–118**.

---

### 4.14 Master data dinamis & atribut kustom (zero-hardcoding) — M-02 — 2026-10-20

**Status: `spec-only` seluruh §4.14.** Ini kontrak target, bukan deskripsi realita. Yang terukur hari ini (diukur ulang 2026-10-20, bukan dikutip): (a) `find apps/web/src/app/api/v1 -name route.ts` = **18** berkas dan **nol** di bawah `admin/`; (b) direktori `apps/web/src/app/api/v1` hanya berisi `academic`, `attendance`, `auth`, `health`, `tenant` — prefix **`/api/v1/master/**` belum pernah ada**; (c) `ls packages/database/migrations/` = **7** berkas (`0001`–`0006`, `0011`) — `0047_master_lookup_engine.sql` dan `0048_custom_attributes.sql` **DDL-nya sudah ditulis** di `DATA_MODEL §20.3`/`§20.5` pada 2026-10-20 dan **belum ada berkasnya**; (d) izin gugus ini **sudah** menjadi baris katalog: `RBAC_MATRIX §4.5` kini mencapai **161** dan baris **127–145** gugus ini adalah `master.kind.*`, `master.item.*`, `master.impact.view`, `master.usage.view`, `master.lookup.consume`, `settings.customattr.*` (terukur; keluarga nama `master.lookup.view/.insert/.update/.delete/.merge` yang dulu disebut di §4.14.2 **diganti** pemetaannya di sana — `G-16`). Statusnya tetap **`usulan`**: `packages/contracts/src/authz.ts` masih **222** kode (terukur) dan `gen-rbac-seed.mjs` belum dijalankan ulang, jadi tidak satu pun string izin itu boleh dipakai di rute sebelum dipromosikan (`AGENTS §3.8`; ralat lengkap + konsekuensi: **§4.14.6 butir 2**).

**Pemilik nama (tidak dinegosiasikan di bagian ini).** Fisik tabel, kolom, enum, dan nomor migrasi = [DATA_MODEL §20](file:///c:/SICA/docs/DATA_MODEL.md) (`reference_kinds` + `reference_items` + view + `reference_kind_usage` + `tenant_custom_attributes` + `custom_attribute_history` + kolom `attributes jsonb`). Norma empat kelas A/A′/B/C/D, gerbang CI (m)(n)(o)(p), dan tujuh aturan atribut = `DATA_MODEL §20.1`/`§20.5` dan `AGENTS §3.10` — **tidak diulang di sini**. Kode izin & verba = [RBAC_MATRIX §4](file:///c:/SICA/docs/RBAC_MATRIX.md). Layar "Data Referensi" + Dynamic Form Generator = `UI_UX_DESIGN §13`. **Path, bentuk respons, skema Zod, dan kode error = bagian ini** (§2.3 adalah register kode error-nya).

**Vonis yang sudah dijatuhkan dan tidak dibalik di sini** (`DATA_MODEL §20.2`, `§14.8`): `master_lookup_groups` dan `master_lookup_items` **kalah sebagai tabel** dan **menang sebagai view** di atas `reference_kinds`/`reference_items` dengan `security_invoker = true`; `metadata` = alias `extra`, `sorting_order` = alias `sort_order`, `label` = alias `name`. View **tidak pernah** di-`UPDATE`: seluruh tulis masuk lewat tabel dasar supaya pemicu audit + empat-mata ikut bekerja. Rute ini tidak menyediakan endpoint tulis untuk nama view — tidak ada `PUT /master/lookup-groups`, dan tidak akan ada.

#### 4.14.1 Membaca kamus — `GET /api/v1/master/lookups?group={GROUP_CODE}`

```http
GET /api/v1/master/lookups?group=AGAMA                     → 200 / 304 / 404
GET /api/v1/master/lookups?groups=AGAMA,PEKERJAAN,PENGHASILAN   (batch, maks 20 group)
GET /api/v1/master/lookups?group=JENIS_MATAKULIAH&at=2023-08-01  (keadaan pada tanggal)
GET /api/v1/master/lookups?group=SUKU&includeInactive=1    (item nonaktif ikut, tetap ber-`isActive:false`)
GET /api/v1/master/lookups?group=WILAYAH&depth=3&parentCode=35      (TREE)
GET /api/v1/master/lookups/groups                          → 200  katalog group yang tersedia bagi tenant ini
```

**Skema query (Zod `strict()` — query tak dikenal ditolak, tidak diabaikan):**
```typescript
export const MasterLookupQuerySchema = z.object({
  group: z.string().regex(/^[A-Z0-9_]{2,64}$/).optional()
    .describe("api_group_code bila terisi; fallback ke reference_kinds.kind. Bukan label."),
  groups: z.string().optional()
    .describe("Daftar koma untuk batch, maks 20; dikabulkan karena satu layar biodata mengirim 12 permintaan identik (DATA_MODEL §20.8)"),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Rekonstruksi keadaan kamus pada tanggal itu; wajib untuk laporan historis (BR-R12)"),
  includeInactive: z.coerce.boolean().default(false),
  depth: z.coerce.number().int().min(1).max(5).default(1)
    .describe("Hanya untuk input_kind=TREE; 5 = negara-provinsi-kota-kecamatan-kelurahan"),
  parentCode: z.string().max(64).optional().describe("Akar subtree pada TREE; tidak pernah melintasi tenant"),
  fresh: z.coerce.boolean().default(false)
    .describe("Read-your-writes: paksa Primary + no-store (AGENTS §3.7) untuk layar admin sesaat setelah tulis"),
  limit: z.coerce.number().int().min(1).max(2000).default(1000)
    .describe("Kamus kecil cukup sekali tarik; kamus wilayah diiris per parentCode, bukan per id"),
});
// group XOR groups — keduanya terisi = 422 VALIDATION_FAILED (6), bukan "yang terakhir menang"
```

**Kontrak yang mengikat (dinormakan di sini atas permintaan `DATA_MODEL §20.3`):**

| Aspek | Aturan |
|---|---|
| **Urutan** | **Selalu** `ORDER BY sort_order, code` — **tidak pernah `id`**. `id` adalah UUIDv7 (ikut waktu pembuatan), jadi urutan `id` berubah setiap tenant menambah atau mengimpor item dan seluruh layar tampak "diacak ulang". Klien **tidak** boleh mengurutkan ulang. |
| **Determinisme** | Item dengan `sort_order` kembar diurutkan lanjutan oleh `code`, lalu `id`, agar dua permintaan atas data yang sama tidak pernah menghasilkan urutan berbeda (golden vector UI). |
| **Cache** | `Cache-Control: private, max-age=60`. **`private`** karena isinya kamus satu tenant; CDN/lapisan bersama **dilarang** menyimpan. `Vary: Accept-Language` karena label punya dua wujud (`name`, `name_en`). |
| **Validator** | `ETag: W/"<tenant8>-<kind>-<version>-<h8>"` dengan `h8` = 8 hex pertama SHA-256 atas proyeksi `(code, isActive, effectiveFrom, effectiveTo, sortOrder)` **dalam urutan baca**. `If-None-Match` yang cocok → **`304` tanpa body**. |
| **Versi** | `X-Lookup-Version: <tenantId>-<kind>-<reference_kinds.version>`. Naik pada **setiap** tulis §4.14.2 ke group itu. Klien menyimpannya dan mengirimnya lagi sebagai `If-None-Match`; klien juga boleh membandingkan `X-Lookup-Version` untuk memutuskan invalidasi lokal — **tanpa** polling. |
| **Item nonaktif** | **Tidak pernah hilang diam-diam.** Default tersembunyi di balik `includeInactive`; **selalu** tampil ketika `?at=` diminta dan tanggal itu masih dalam jendela berlakunya (`effective_from`/`effective_to`). Ini kewajiban arsip (BR-R12), bukan kemewahan. |
| **Masa berlaku** | Tanpa `?at=`: hanya item dengan `is_active = true` **dan** tanggal server jatuh dalam `[effective_from, effective_to]`. `?at=` mengabaikan `is_active` dan menyaring **hanya** atas jendela — dua sumbu yang berbeda, jangan digabung. |
| **Kodefiedar** | `feederCode` dan `codeExternal` ikut **hanya** untuk peran dengan hak tulis kamus (`academic.reference.manage`); pembaca biasa (dosen/mahasiswa) menerima `code` lokal + label. Alasannya: kode pusat bukan informasi pemakai akhir dan tidak boleh menjadi bahan tebak-tebakan lintas tenant. |
| **Kirim ke Feeder** | Yang dipakai pemetaan pusat adalah `feeder_code` (`NULL` = **tidak ikut kirim**, I-14). Endpoint ini tidak pernah mengirim nilai ke luar; sinkronisasi kamus nasional adalah kanal `Get*` milik `INTEGRATIONS §1.2`. |
| **Replica vs Primary** | Baca biasa boleh ke **Replica**; `fresh=1` **wajib** ke Primary. Menyimpan `X-Lookup-Version` di klien lalu membaca replica boleh karena versi hanya dinaikkan oleh tulis di Primary dan invalidasi mengikuti versi, bukan jam. |
| **Muatan kosong** | Group yang **ada** tapi belum punya item → `200` dengan `data.items: []` + `degraded:"LOOKUP_GROUP_EMPTY"` dan `details[].remedyHref` ke layar admin. Group yang **tidak ada** → `404 LOOKUP_GROUP_NOT_FOUND` (92). Membedakan keduanya adalah cara layar tidak lagi menyamar menjadi "fitur rusak". |

**Respons `200 OK` (amplop §2.1; ini **bukan** list §2.4 — kamus bukan objek berpaginasi, jadi tidak ada `meta.pagination`):**
```json
{
  "success": true,
  "data": {
    "group": {
      "groupCode": "UKURAN_BAJU", "kind": "ukuran_baju", "name": "Ukuran Baju",
      "domain": "KEMAHASISWAAN", "inputKind": "SELECT", "isSystem": false,
      "isRequired": false, "minSelections": null, "maxSelections": null,
      "validationRegex": null, "feederDictPath": null, "entityType": "student",
      "version": 3, "effectiveFrom": "2024-01-01", "effectiveTo": null,
      "hasExternalDictionary": false, "totalItems": 5, "activeItems": 5
    },
    "items": [
      { "id": "0196…", "code": "S",  "label": "S",  "labelEn": "S",  "shortCode": "S",
        "sortOrder": 10, "isActive": true, "isSystem": false, "parentId": null,
        "points": null, "requiresDocument": false, "effectiveFrom": "2024-01-01", "effectiveTo": null },
      { "id": "0196…", "code": "XL", "label": "XL", "labelEn": "XL", "shortCode": "XL",
        "sortOrder": 40, "isActive": true, "isSystem": false, "parentId": null,
        "points": null, "requiresDocument": false, "effectiveFrom": "2024-01-01", "effectiveTo": null }
    ],
    "ordering": "sort_order, code",
    "asOf": "2026-10-20"
  },
  "meta": { "timestamp": "2026-10-20T08:00:00.000Z", "requestId": "req_…", "lookupVersion": "4f19…-ukuran_baju-3" }
}
```
> Untuk `inputKind = TREE`, item bersarang lewat `children[]` sampai `depth`; `parentCode` memotong subtree. Untuk `MULTI`/`CHECKBOX`, `maxSelections`/`minSelections` **ikut terkirim** supaya generator formulir dapat memvalidasi sebelum submit — angkanya tetap direvalidasi server (L1/L5), klien tidak pernah menjadi penegak. Untuk `SELECT` yang menunjuk kamus nasional (`reference_dictionary_entries`, kelas B), `code` tidak dapat diubah tenant dan hanya `label` yang dapat dipetakan; mencoba menulis `code`-nya → `403 LOOKUP_KIND_SYSTEM_IMMUTABLE` (93).

**`304 Not Modified`** — header saja, tanpa body, tanpa amplop:
```http
HTTP/1.1 304 Not Modified
ETag: W/"4f19c2b7-ukuran_baju-3-9c1f2a77"
Cache-Control: private, max-age=60
X-Lookup-Version: 4f19c2b7-ukuran_baju-3
```

**`404 Not Found`** — group tidak dikenal (`details[].suggestions[]` dari kemiripan lokal, tanpa egress):
```json
{
  "success": false,
  "error": {
    "code": "LOOKUP_GROUP_NOT_FOUND",
    "message": "Group kamus \"UKURAN_SEPATU\" tidak terdaftar pada tenant ini.",
    "details": [
      { "field": "group", "message": "Pernah dibaca sebagai api_group_code maupun kind.", "suggestions": ["UKURAN_BAJU", "WARNA_KULIT", "JENIS_TINGGAL"], "remedyHref": "/admin/master/referensi" }
    ]
  },
  "meta": { "timestamp": "2026-10-20T08:00:00.000Z", "requestId": "req_…" }
}
```

**Yang dilarang oleh bagian ini (norma `AGENTS §3.10`, gerbang CI m/n):** array opsi literal di TypeScript/Dart, `<option>` keras, `z.enum([...])` di `packages/contracts` untuk kolom kelas C/D, dan `CHECK (col IN (…))` untuk nilai yang dapat berkembang antar kampus. Kosakata kelas A/A′ (`permission_verb`, `enrollments.status`, `pddikti_domain`, payload Feeder) **tetap** enum tertutup dan **tidak** dilayani sebagai kamus yang dapat disunting saat runtime — kalau ini dibalik, seluruh gerbang RBAC dan kirim Feeder kehilangan arti.

#### 4.14.2 Merawat kamus — CRUD admin

```http
GET    /api/v1/admin/master/lookups/groups                    → 200  katalog group + versi + jumlah item
GET    /api/v1/admin/master/lookups?group=AGAMA               → 200  daftar item (list §2.4, read-your-writes → Primary)
POST   /api/v1/admin/master/lookups                           → 201  buat item
PUT    /api/v1/admin/master/lookups                           → 200  ganti penuh item (Idempotency-Key + If-Match)
DELETE /api/v1/admin/master/lookups                           → 204  hapus keras HANYA bila tidak dirujuk
POST   /api/v1/admin/master/lookups/items/{id}/merge          → 200  pensiunkan kode ke item tujuan
GET    /api/v1/admin/master/lookups/impact?kind=agama         → 200  dampak pemakaian (FR-ADM-12)
```

**Deviasi yang disengaja dari pola §4.6 (ditulis agar tidak disalah-baca sebagai typo):** §4.6 menetapkan `PATCH /admin/<objek>/:id` untuk ubah sebagian. Untuk item kamus yang **kecil dan whole-replace** (`code`, `name`, `sort_order`, jendela berlaku), `PUT` dipakai sebagai bentuk final karena (1) hilangnya satu field karena formulir lama lebih berbahaya daripada penggantian utuh, dan (2) `PUT` + `If-Match` atas `X-Lookup-Version` menutup *lost update* pada kamus yang sama-sama disunting dua admin. `PATCH` **tidak** disediakan untuk objek ini; satu objek satu bentuk, bukan dua jalur tulis.

**Badan `POST`/`PUT` (Zod `strict()`):**
```typescript
export const ReferenceItemUpsertSchema = z.object({
  kind: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).describe("Kunci alamiah group; dipindahtangankan = buat item baru"),
  code: z.string().min(1).max(64).describe("UNIQUE per (tenant, kind); tidak dapat diubah setelah dirujuk transaksi"),
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).nullable().optional(),
  shortCode: z.string().max(32).nullable().optional(),
  feederCode: z.string().max(64).nullable().optional()
    .describe("NULL = tidak ikut kirim ke pusat (I-14). Hanya boleh diisi oleh sinkronisasi kanal Get*, bukan oleh layar"),
  codeExternal: z.string().max(64).nullable().optional(),
  parentId: UUIDSchema.nullable().optional().describe("TREE/hierarki wilayah; wajib diselesaikan ke barisnya sebelum simpan"),
  sortOrder: z.number().int().min(0).max(9999).default(100),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  points: z.number().multipleOf(0.01).gte(0).lte(9999.99).nullable().optional()
    .describe("numeric(6,2) — dipakai SKPI & basis UKT; bukan float di jalur wire (ADR-5)"),
  requiresDocument: z.boolean().default(false),
  extra: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
    .describe("Bidang bebas yang TIDAK pernah menjadi keadaan mesin (DATA_MODEL §20.5 aturan 1)"),
  reason: z.string().min(10).max(500).describe("Wajib untuk tulis kamus — masuk audit_logs.before/after"),
});
// SERVER_ONLY — kehadiran di body = 422 VALIDATION_FAILED (6):
//   id, isSystem, mergedIntoId, version, createdAt, updatedAt, tenantId, approvedBy, approvedAt
```

| Penjaga | Aturan & kode yang dipakai |
|---|---|
| Izin | Baca: `academic.reference.view` (`READ`, resource `admin.master.referensi`, `authz.ts:185`). Tulis: `academic.reference.manage` (`UPDATE`, `authz.ts:186`). **Keduanya `kontrak` tanpa call site.** Peran halus (`master.lookup.view/.insert/.update/.delete/.merge`, `DELETE` terpisah dari `UPDATE`) **belum ada** di `RBAC_MATRIX §4.5` → §4.14.6. Hari ini **tidak ada** verba `DELETE` untuk gugus ini, jadi `DELETE` belum boleh dikode. |
| Keunikan | `UNIQUE (tenant_id, kind, code)` → tabrakan dijawab **`409 CONFLICT` (12)** dengan `details[].existingItemId`, bukan `422`. Jangan menambah kode "kode kembar" — keadaannya sudah punya baris. |
| Item/kamus sistem | `is_system = true` pada kind kelas A/A′ menolak ubah struktur & hapus → **`403 LOOKUP_KIND_SYSTEM_IMMUTABLE` (93)**; label lokal (`name`, `name_en`) dan `sortOrder` **boleh**. Item kelas B (kamus nasional di `reference_dictionary_entries`) **tidak** dapat dibuat/dihapus tenant — hanya dipetakan labelnya. |
| Hapus | Dua langkah wajib: `GET …/impact?kind=` lalu `DELETE`. Dirujuk → **`409 REFERENCE_IN_USE` (19)** dengan muatan dampak (§4.14.2 di bawah); jalan keluar resmi = `PUT { isActive: false }`. Hard delete historis dilarang `BR-R10`. |
| Merge | `POST …/items/{id}/merge` body `{ intoItemId, reason }`: menulis `merged_into_id` pada item sumber (item sumber **tidak** dihapus — transkrip & tagihan lama harus tetap dapat direkonstruksi), menolak siklus (A→B→A) dengan **`409 LOOKUP_MERGE_CYCLE` (94)**, menolak tujuan yang sendiri sudah `merged_into_id != null` (rantai harus satu langkah; server memuat `resolvedIntoId` tereduksi), dan menolak merge lintas `kind` (agama tidak bisa dilebur ke pekerjaan). Nilai lama di transaksi **tidak** ditulis ulang secara massal: yang berubah hanya pembacaan lewat `?at=` + resolusi merge. |
| Versi & invalidasi | **Setiap** tulis menaikkan `reference_kinds.version` (dan karena itu `X-Lookup-Version`), mengirim `Cache-Control: no-store` pada respons tulis, dan menambah `meta.auditId`. Tanpa kenaikan versi, 12 layar biodata terus menyajikan label basi selama 60 detik dan itu tidak akan ketahuan di demo. |
| `If-Match` | `PUT`/`DELETE`/`merge` **wajib** membawa `If-Match` dengan `ETag`/`X-Lookup-Version` yang dibaca. Versi tidak cocok → `412` dengan body §2.2 ber-`code: CONFLICT` (12) — klien membaca ulang, bukan menimpa. |
| Anti-IDOR | `kind`, `parentId`, `intoItemId` dari klien diselesaikan **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND …`) sebelum mutate. Id milik tenant lain dijawab **`404 NOT_FOUND` (5)**, bukan 403. |
| Idempotensi | `POST`/`PUT`/`DELETE`/`merge` **wajib** `Idempotency-Key`. Replay kunci yang sama dengan payload sama = hasil pertama (`data.replayed: true`, pola §4.2.14); payload berbeda = `409 DUPLICATE_SUBMIT` (46). |

**`GET …/impact?kind=agama` — dasar `reference_kind_usage` + hitung nyata (FR-ADM-12, penutup D-3 benchmark):**

```json
{
  "success": true,
  "data": {
    "kind": "agama", "apiGroupCode": "AGAMA", "itemCount": 7, "inactiveCount": 0,
    "surfaces": [
      { "surface": "/admin/master/mahasiswa", "entityType": "students", "columnName": "religion_code", "requiredRole": "ADMIN_ACADEMIC", "isDeprecated": false },
      { "surface": "/spmb/biodata", "entityType": "students", "columnName": "religion_code", "requiredRole": "STUDENT", "isDeprecated": false },
      { "surface": "feeder:Mahasiswa", "entityType": "students", "columnName": null, "attributeCode": null, "isDeprecated": false },
      { "surface": "report:transkrip", "entityType": "documents", "columnName": null, "isDeprecated": true }
    ],
    "usage": [
      { "entityType": "students", "column": "religion_code", "rowsTotal": 18422, "rowsActive": 17905, "lastUsedAt": "2026-10-19T22:14:03Z" },
      { "entityType": "invoices", "column": null, "attributeCode": "agama_penanggung", "rowsTotal": 310, "rowsActive": 310, "lastUsedAt": "2026-09-01T03:11:44Z" }
    ],
    "verdict": "BLOCKED_BY_USAGE",
    "offeredRemedy": "deactivate",
    "orphanKinds": []
  },
  "meta": { "timestamp": "…", "requestId": "…", "auditId": null }
}
```
> Baca: **boleh ke Replica** (ini analisis, bukan read-your-writes). Izin: `academic.impact.view` (`READ`, resource `admin.impact-hapus`, `authz.ts:228`) — **terdaftar sebagai kontrak, nol call site**. `surfaces[]` diambil dari `reference_kind_usage` yang **global tanpa `tenant_id`** (ia mendeskripsikan kode aplikasi, dan karena itu masuk daftar pengecualian RLS `DATA_MODEL §6.2`; penulisannya hanya lewat migrasi/review, bukan lewat UI tenant), sedangkan `usage[]` dihitung dari tabel tenant **di bawah RLS** — jadi angka baris tidak dapat melintas tenant. `offeredRemedy` selalu ada: menolak tanpa jalan keluar adalah persis kegagalan yang dicatat `BENCHMARK_SEVIMA §2.5`.

#### 4.14.3 Atribut kustom — definisi oleh kampus

```http
GET    /api/v1/admin/master/custom-attributes?entityType=student&status=ACTIVE&includeRetired=0   → 200 list §2.4
POST   /api/v1/admin/master/custom-attributes                                                     → 201 draf
GET    /api/v1/admin/master/custom-attributes/{id}                                                → 200
PATCH  /api/v1/admin/master/custom-attributes/{id}                                                → 200 (hanya DRAFT; versi++ untuk ACTIVE)
PUT    /api/v1/admin/master/custom-attributes/{id}/activate                                       → 200 EMPAT-MATA
PUT    /api/v1/admin/master/custom-attributes/{id}/retire                                         → 200 (bukan hard delete)
POST   /api/v1/admin/master/custom-attributes/{id}/validate-values                                → 200 dry-run, tanpa mutasi
```

**Badan `POST` (Zod `strict()`; kolom & `CHECK` finalnya milik `DATA_MODEL §20.5`):**
```typescript
export const CustomAttributeCreateSchema = z.object({
  entityType: z.enum(['student','student_guardian','lecturer','staff','user','course','class','room','invoice','document','activity'])
    .describe("Enum tertutup milik DATA_MODEL; bukan string bebas. Hanya 6 nilai yang PUNYA kolom attributes hari ini — lihat baris penyimpanan di bawah"),
  code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).describe("Kunci di dalam attributes jsonb; stabil, tidak berubah saat label berubah"),
  label: z.string().min(1).max(255), labelEn: z.string().max(255).nullable().optional(), helpText: z.string().max(500).nullable().optional(),
  inputKind: z.enum(['TEXT','TEXTAREA','NUMBER','DECIMAL','DATE','BOOL','SELECT','MULTI','RADIO','CHECKBOX','URL','EMAIL','PHONE','FILE']),
  optionsKind: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).nullable().optional()
    .describe("WAJIB terisi untuk SELECT/MULTI/RADIO/CHECKBOX dan WAJIB kosong untuk yang lain (CHECK DB)"),
  dataType: z.enum(['STRING','INT','DECIMAL','DATE','BOOL','ENUM','MULTI','URL','EMAIL','PHONE']),
  isRequired: z.boolean().default(false),
  maxLength: z.number().int().min(1).max(4000).nullable().optional(),
  validationRegex: z.string().max(500).nullable().optional().describe("Pola kode (NIM, kodepos), bukan kosakata"),
  minValue: z.number().nullable().optional(), maxValue: z.number().nullable().optional(),
  decimalScale: z.number().int().min(0).max(6).nullable().optional(), unit: z.string().max(16).nullable().optional(),
  appliesTo: z.record(z.string(), z.unknown()).default({}).describe("{programIds,entryYears,programTypes,sites} — disaring server, bukan kepercayaan klien"),
  roleView: z.array(RoleSchema).default([]), roleEdit: z.array(RoleSchema).default([])
    .describe("Kosakata peran milik RBAC_MATRIX; string bebas ditolak sebelum insert"),
  studentSelfEditable: z.boolean().default(false),
  showInTranscript: z.boolean().default(false), isSearchable: z.boolean().default(false), isTracked: z.boolean().default(false),
  piiLevel: z.enum(['NONE','ORDINARY','SPECIFIC']).default('NONE'),
  feederMapping: z.object({ domain: z.string().max(64), column: z.string().max(64) }).nullable().default(null)
    .describe("NULL = tidak pernah ikut kirim (aturan 3 §20.5)"),
  sortOrder: z.number().int().min(0).max(9999).default(100),
  reason: z.string().min(10).max(500),
});
// SERVER_ONLY: id, status, version, requestedBy, approvedBy, approvedAt, createdAt, updatedAt, tenantId
```

| Penjaga | Aturan & kode |
|---|---|
| Penyimpanan | `attributes jsonb` **baru ada** pada `students`, `lecturers`, `staff`, `rooms`, `courses`, `invoices` (`DATA_MODEL §20.5`, ALTER expand-only). Membuat definisi untuk `entityType` di luar enam itu → **`422 VALIDATION_FAILED` (6)** dengan `details[].message` menyebut daftar enam + catatan bahwa kolomnya adalah perluasan **milik `DATA_MODEL`** (`0048` berikutnya), bukan sesuatu yang dapat dipaksakan kontrak API. Ini disengaja: definisi tanpa penampung = dropdown yang datanya tidak pernah dapat dibaca. |
| Aktivasi empat-mata | `PUT …/{id}/activate` menuntut **izin `VALIDATE`** (belum ada di katalog — §4.14.6), `approvedBy IS NOT NULL AND approvedBy <> requestedBy` (`CHECK` `0048` adalah penegak kedua), MFA untuk peran penulis-admin, dan `status = 'DRAFT'`. Actor sama → **`403 SELF_APPROVAL_FORBIDDEN` (56)**. Sudah `ACTIVE` → **`409 DECISION_ALREADY_MADE` (55)**. Alasannya tertulis di `§20.5` aturan 7: satu atribut "wajib" yang salah aktif dapat memblokir registrasi **seluruh angkatan**. |
| Plafon | `isSearchable = true` melewati **40 atribut per `entityType`** → **`422 CUSTOM_ATTR_LIMIT_EXCEEDED` (97)**. Tanpa plafon ini, indeks GIN per kunci menggerus jalur tulis `students` yang sama yang dipakai KRS War (`AGENTS §3.7`). Plafon jumlah atribut aktif per tenant dibaca dari `tenant_quotas`, bukan konstanta di kode. |
| Pilihan | `optionsKind` wajib menunjuk `reference_kinds.kind` yang **ada**; kind tidak dikenal → `404 LOOKUP_GROUP_NOT_FOUND` (92) dengan `field: optionsKind`. Menaruh daftar opsi di dalam JSONB definisi **dilarang** (aturan 2 §20.5). |
| PII | `piiLevel = 'SPECIFIC'` dengan `studentSelfEditable = true` → `422 VALIDATION_FAILED` (6) karena `CHECK` `0048` menolaknya; nilainya tunduk enkripsi amplop + blind index (`DATA_MODEL §16.3`) dan **tidak pernah** tampil di layar peran tanpa hak. Respons tidak pernah mengecho nilai PII yang ditolak. |
| Ubah definisi aktif | `PATCH` pada `ACTIVE` yang menyentuh `dataType`, `validationRegex`, `optionsKind`, `piiLevel`, atau `isRequired` menaikkan `version` **dan** wajib disertai hasil `POST …/validate-values` yang bersih (dry-run atas nilai tersimpan, **tanpa** mutasi) — kalau tidak, satu perubahan membuat 18.000 baris yang sudah ada menjadi tidak sah tanpa ada yang tahu. |
| Retire | `PUT …/{id}/retire` = `status 'RETIRED'`. Nilai lama **tinggal** di `attributes` dan riwayat; laporan periode sebelumnya harus tetap dapat direkonstruksi (aturan 6 §20.5). Hard delete atribut tidak tersedia. |
| Keunikan | `UNIQUE (tenant_id, entity_type, code)` → `409 CONFLICT` (12). |

#### 4.14.4 Nilai atribut pada entitas — `GET`/`PATCH /api/v1/{entity}/{id}/attributes`

```http
GET   /api/v1/students/{id}/attributes       → 200  nilai + definisi teresolusi + hak per field untuk pemanggil ini
PATCH /api/v1/students/{id}/attributes       → 200  tulis sebagian (merge per kunci), Idempotency-Key wajib
GET   /api/v1/students/{id}/attributes/history?code=nomor_rekening_koperasi&from=2026-01-01  → 200 list §2.4
```
`{entity}` ∈ `students · lecturers · staff · rooms · courses · invoices` — himpunan yang sama dengan yang punya kolom `attributes`; path di luar itu dijawab `404 NOT_FOUND` (5), bukan dibuat menjadi rute kedua.

```typescript
export const AttributesPatchSchema = z.object({
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]))
    .refine((v) => Object.keys(v).length > 0 && Object.keys(v).length <= 60, "0 atau > 60 kunci per permintaan"),
  reason: z.string().min(10).max(500).nullable().optional()
    .describe("Wajib bila ada kunci is_tracked yang berubah atau nilai PII disentuh"),
});
// Kunci yang TIDAK dikirim tetap utuh (merge per kunci). Menghapus nilai = kirim null untuk kunci itu.
// source custom_attribute_history diturunkan dari kanal request (UI/MOBILE/API/IMPORT), TIDAK pernah dari body.
```

**Urutan validasi server (berhenti pada kegagalan pertama, `details[]` menyebut `attributes.<code>`):**

1. **Resolusi objek** (anti-IDOR): `WHERE tenant_id = ctx.tenantId AND id = $1` **di dalam transaksi**; tidak ditemukan → `404` (5); ditemukan tapi scope penugasan tidak mencakup → `403 ADMIN_SCOPE_MISMATCH` (16), termasuk scope **`SITE`** (`0044`).
2. **Definisi aktif** untuk `(entityType, code)`: kunci tanpa definisi → `422 VALIDATION_FAILED` (6) dengan `message: "Atribut tidak terdaftar"`. Nilai untuk atribut `RETIRED` **boleh dibaca** tetapi tidak boleh ditulis.
3. **Hak tingkat field**: peran tidak ada di `role_view` → kuncinya **tidak diproyeksikan sama sekali** pada `GET` (bukan dikirim lalu disembunyikan CSS); peran tidak ada di `roleEdit`, atau `studentSelfEditable = false` sementara penulisan berasal dari `STUDENT`, atau `piiLevel = 'SPECIFIC'` → **`403 CUSTOM_ATTR_READONLY_FOR_ROLE` (98)** dengan `field` + `reason` (`role_edit` | `self_edit_disabled` | `pii_specific` | `server_only`).
4. **Tipe & bentuk** → **`422 CUSTOM_ATTR_TYPE_MISMATCH` (95)**; `ENUM`/`MULTI` divalidasi terhadap `code` yang **aktif pada tanggal itu** di `optionsKind` (bukan terhadap daftar yang di-cache klien).
5. **Pola & rentang** → **`422 CUSTOM_ATTR_REGEX_FAILED` (96)** (`validationRegex`, `minValue`/`maxValue`/`decimalScale`/`maxLength`).
6. **Lintas field (L5, service — bukan kamus):** aturan seperti "bila penghasilan ≤ 1 juta maka wajib melampirkan surat" tinggal di service dan memakai `requiresDocument` dari kamus sebagai **data**, bukan logika yang dititipkan ke `extra` (`DATA_MODEL §20.8`). Pelanggaran → `422 ACADEMIC_RULE_VIOLATION` (7) + `state` §2.5.
7. **Plafon** → `422 CUSTOM_ATTR_LIMIT_EXCEEDED` (97) bila jumlah kunci/atribut melewati batas.
8. **Tulis** ke `attributes` (Primary) + `custom_attribute_history` **hanya** untuk atribut `is_tracked` (insert-only; `REVOKE UPDATE, DELETE` + pemicu `app.reject_mutation()`), `audit_logs`, `meta.auditId`, dan kenaikan `X-Lookup-Version` bila group kamus yang bersangkutan tersentuh.

**Respons `GET` memuat hak, bukan hanya nilai** — inilah yang membuat generator formulir tidak perlu menebak:
```json
{
  "success": true,
  "data": {
    "entityType": "student", "entityId": "0196…", "attributesVersion": 7,
    "values": { "ukuran_baju": "L", "nomor_rekening_koperasi": null, "jalur_beasiswa_lokal": "KIP" },
    "fields": [
      { "code": "ukuran_baju", "label": "Ukuran Baju", "inputKind": "SELECT", "optionsGroup": "UKURAN_BAJU",
        "isRequired": false, "piiLevel": "NONE", "isTracked": false, "editable": true, "readOnlyReason": null },
      { "code": "nomor_rekening_koperasi", "label": "No. Rekening Koperasi", "inputKind": "TEXT",
        "isRequired": false, "piiLevel": "ORDINARY", "isTracked": true, "editable": false, "readOnlyReason": "role_edit" },
      { "code": "jalur_beasiswa_lokal", "label": "Jalur Beasiswa", "inputKind": "SELECT", "optionsGroup": "JALUR_BEASISWA",
        "isRequired": true, "piiLevel": "NONE", "isTracked": false, "editable": true, "readOnlyReason": null }
    ]
  },
  "meta": { "timestamp": "…", "requestId": "…", "pagination": null }
}
```
> `meta.pagination` sengaja `null`: ini objek tunggal, bukan list §2.4. Nilai atribut yang menunjuk kamus **selalu** kembali bersama kode mentahnya (`"KIP"`) dan label dibaca dari §4.14.1 — respons ini tidak pernah menggandakan label ke dalam `values` agar cache kamus tetap berguna.

**`GET …/attributes/history`** hanya tersedia untuk atribut `is_tracked`; list §2.4 dengan filter `code`, `from`, `to`, diurut `occurred_at DESC`; **READ-only mutlak** — tidak ada rute tulis/ubah/hapus riwayat (AC-AUD-1), dan tidak ada rute yang menerima `oldValue`/`newValue`/`changedBy`/`source` dari body.

#### 4.14.5 Enam lapis penegakan untuk setiap rute tulis §4.14

Kewajiban penuh `AGENTS §3.8` / `BLUEPRINT_ROLE_BY_ROLE §0.4`, dispesifikasi per gugus agar tidak ditulis empat kali dengan sedikit berbeda:

| Lapis | Kewajiban konkret di §4.14 | Bukti kegagalan yang sudah ada |
|---|---|---|
| L1 | Zod `strict()` pada body **dan** query (field tak dikenal = `422 VALIDATION_FAILED`, 6); enum kanonik UPPER untuk `status`/`piiLevel`/`inputKind`/`dataType`; `limit ≤ 100` pada list admin; `points`/`minValue` sebagai `numeric` dalam **string** di wire, tanpa `float` (ADR-5); kolom `SERVER_ONLY` di §4.14.2/§4.14.3 ditolak bila muncul di body | `qr/generate` masih menerima field dari body (§4.3.7) |
| L2 | `tenantId`/`userId` **hanya** dari JWT terverifikasi; middleware **wajib menghapus** `x-tenant-id`/`x-user-id` kiriman klien **sebelum** menyetel milik sendiri; `kind`/`entityType`/`code` **tidak pernah** menjadi sumber identitas | `SEC-07` — header klien hari ini ikut dibaca |
| L3 | `requireDataPrincipal` atas `user_role_assignments` + `valid_to`, bukan carrier `member_role`; izin objek kamus = `academic.reference.view`/`.manage`, dampak = `academic.impact.view`, meta-konfigurasi = `settings.meta.view`/`.update` (semuanya `kontrak`, **nol call site**); izin halus `master.lookup.*`/`settings.customattr.*` **belum terdaftar** | `SEC-10`; `G-14` (katalog hanya `view`+`manage`, tidak ada `DELETE`) |
| L4 | `holdsScoped(access, PERM.x, { kind, id })` untuk TENANT/ORG/PROGRAM/CLASS/PERIOD/SELF **dan `SITE`** (`0044`): `appliesTo.sites` pada definisi atribut dan `site_id` pada objek induk harus dibuktikan, bukan dipercaya dari body; penulisan `STUDENT` atas atribut dirinya sendiri = scope `SELF` | `SEC-11` — fungsi ada, **nol** pemanggil |
| L5 | Kamus/atribut `ACTIVE` dan jatuh dalam jendela berlaku; `status` atribut (DRAFT → ACTIVE → RETIRED, satu arah — 55); aktivasi empat-mata (56); plafon `isSearchable` & kuotanya (97); `validate-values` bersih sebelum ubah definisi aktif; `reference_kind_usage` punya baris untuk `kind` yang dibaca UI (gerbang n) | `SEC-02` — baris `LOCKED` masih bisa ditimpa di gugus lain |
| L6 | `SET LOCAL app.current_tenant` dalam tiap transaksi; `sica_app` `NOBYPASSRLS`; `reference_items`, `tenant_custom_attributes`, `custom_attribute_history` **wajib** `ENABLE`+`FORCE`+`tenant_isolation`; **view** `master_lookup_*` wajib `security_invoker = true`; `reference_kind_usage` masuk daftar pengecualian RLS sebagai **kecualian tercatat**, bukan lupa | `DATA_MODEL §20.6`; CI menolak filter-query-tanpa-RLS |

**Anti-IDOR.** `id` item, `kind`, `parentId`, `intoItemId`, `attributeId`, `entityId` dari klien diselesaikan ke barisnya **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND id = $1`) dan kepemilikannya dibuktikan **sebelum** mutate; id lintas tenant dijawab **`404 NOT_FOUND` (5)** agar keberadaan objek tidak bocor. **`Idempotency-Key`** wajib pada `POST`/`PUT`/`DELETE`/`merge`/`activate`/`retire` (§4.2.14); replay = hasil pertama, payload berbeda pada kunci sama = `409 DUPLICATE_SUBMIT` (46). Mutasi **hanya ke Primary**; list yang dibaca segera setelah tulis memakai `fresh=1`.

**Daftar `SERVER_ONLY` gugus ini** (tambahan di atas daftar kanonik `DATA_MODEL §14.9`, tidak menggandakannya): `reference_kinds.kind`, `reference_kinds.isSystem`, `reference_kinds.version`, `reference_kinds.approvedBy`/`approvedAt`, `reference_items.id`, `reference_items.isSystem`, `reference_items.mergedIntoId`, `reference_items.feederCode` (hanya dari kanal `Get*`), `tenant_custom_attributes.status`, `.requestedBy`, `.approvedBy`, `.approvedAt`, `.version`, `custom_attribute_history.*` (insert-only).

#### 4.14.6 Kode error, status jujur, dan sekuensi pengerjaan

| Baris §2.3 | Kode | Kapan | Status |
|---:|---|---|---|
| 92 | `LOOKUP_GROUP_NOT_FOUND` | `?group=` tidak cocok `api_group_code` maupun `kind` | `spec` |
| 93 | `LOOKUP_KIND_SYSTEM_IMMUTABLE` | tulis struktur pada kamus/item kelas A/A′/B | `spec` |
| 94 | `LOOKUP_MERGE_CYCLE` | `merge` membentuk rantai melingkar / tujuan sudah melebur | `spec` |
| 95 | `CUSTOM_ATTR_TYPE_MISMATCH` | nilai melanggar `dataType` / `code` kamus / `maxSelections` | `spec` |
| 96 | `CUSTOM_ATTR_REGEX_FAILED` | nilai melanggar `validationRegex`, panjang, atau rentang | `spec` |
| 97 | `CUSTOM_ATTR_LIMIT_EXCEEDED` | 40 atribut `isSearchable` per entity / plafon `tenant_quotas` | `spec` |
| 98 | `CUSTOM_ATTR_READONLY_FOR_ROLE` | hak tingkat field menolak penulisan peran ini | `spec` |
| 99–101 | `ENGINE_DATA_INSUFFICIENT`, `ADVISOR_QUOTA_EXCEEDED`, `MODEL_STALE` | engine (§6.2, §6.10.3, §6.10.5) | `spec` |
| 102–103 | `ATTENDANCE_IMPOSSIBLE_TRAVEL`, `DEVICE_BINDING_CONFLICT` | presensi (§6.10.6) | `spec` |
| 104 | `ATTAINMENT_COVERAGE_LOW` | publikasi/approve capaian OBE (§6.10.7) | `spec` |
| 105–106 | `TARIFF_RULE_AMBIGUOUS`, `TARIFF_NO_MATCH` | resolusi tarif (§4.6.7, §4.6.8) | `spec` |
| 107–118 | `PARAM_*`, `MENU_*`, `EVIDENCE_INSUFFICIENT` | **milik §4.16–§4.18** — lihat §4.16.7, §4.17.3, §4.18.5; **bukan** gugus ini, tidak diulang di sini | `spec` |
| dipakai ulang | 5, 6, 7, 12, 16, 19, 26, 46, 55, 56 | lihat kalimat "Gugus §4.14 memakai ulang" di aturan pemeliharaan §2.3 butir 7 | — |
| alias kalah | `LOOKUP_ITEM_IN_USE` → 19 · `SITE_SCOPE_VIOLATION` → 16 · `TIMETABLE_UNFEASIBLE_CORE` → 79 · `MODEL_NOT_QUALIFIED` → 80 · `ATTENDANCE_CHALLENGED_FAILED` → 87 · `room_wifi_allowlist` → `attendance_network_allowlists` | daftar lengkapnya §2.3 butir 8 | — |

**Butir jujur yang tidak boleh dihapus dari bagian ini:**

1. **Tidak satu pun rute §4.14 ada hari ini.** `apps/web/src/app/api/v1` tidak memuat `master/` maupun `admin/`; kata `lookup` tidak muncul di kontrak atau kode. Semua baris di atas adalah **target**.
2. **Izinnya sudah lahir sebagai baris katalog — tetapi tetap bukan norma.** **Ralat terukur 2026-10-20 (sore).** Butir ini sebelumnya menulis "register `RBAC_MATRIX §4.5` berisi nomor 51–126 dan tidak memuat satu pun baris `master.lookup.*` atau `settings.customattr.*`". Itu sudah kedaluwarsa: `RBAC_MATRIX §4.5` kini memuat **145 titik aksi** (terukur; baris 127–145 adalah gugus kamus & atribut kustom: `master.kind.view/.manage`, `master.item.view/.create/.update/.deactivate/.reorder/.merge`, `master.impact.view`, `master.usage.view`, `master.lookup.consume`, `settings.customattr.view/.create/.update/.activate/.retire/.value.view/.value.update/.history.view`), dan pemetaan nama sementara §4.14.2 sudah diputuskan di sana (`view→129`, `insert→130`, `update→131`, `delete→132`, `merge→134`; nama `master.lookup.*` sebagai keluarga tunggal **diganti** — dokumen itu pemilik kode izin, dokumen ini tetap pemilik path & kode error, celah `G-16`). **Yang tidak berubah adalah konsekuensinya:** seluruh 95 baris gelombang 2 (51–145) berstatus **`usulan`/non-normatif** karena `packages/contracts/src/authz.ts` masih **222** entri `{ key:` (terukur) dan `gen-rbac-seed.mjs` belum dijalankan ulang. Jadi `DELETE /admin/master/lookups` dan `PUT …/activate` **tetap tidak boleh diimplementasi** sebelum barisnya dipromosikan ke `PERMISSION_SPECS`; memakai string izin 127–145 hari-hari ini = pelanggaran `AGENTS §3.8`. Klaim serupa di §4.14 pembuka butir (d), §4.14.5 baris L3, §5.14, dan §6.10.10 butir 1 mengikuti ralat ini.
3. **Nomor 92–98 adalah usulan milik §2.3 yang belum punya penegasan peran.** Menambah kode error tidak menambah hak apa pun; satu baris izin = satu titik aksi, bukan dua.
4. **Urutan pengerjaan tidak boleh dibalik** (`AGENTS §3.11`): PRD (FR-ADM-07/09/12 sudah ada) → DDL + nomor migrasi di `DATA_MODEL` (sudah ditulis: `0047`, `0048`) → izin di `RBAC_MATRIX §4.5` (**selesai 2026-10-20**: baris 127–145, status `usulan`) → path + kode error di sini (**selesai 2026-10-20**) → pola layar + Dynamic Form Generator di `UI_UX_DESIGN §13` (**selesai 2026-10-20**) → task di `ROADMAP_TASKS` (usulan ADM-1 / R-2 Fase 1B) → **baru** kode.
5. **33 baris katalog `DATA_MODEL §20.4` belum punya objek.** Membuka generator formulir di atas kamus kosong menghasilkan dropdown kosong yang akan disalah-artikan sebagai "fitur belum siap". Layar admin wajib menampilkan jumlah item + `degraded:"LOOKUP_GROUP_EMPTY"`, bukan dropdown hampa.
6. **`metadata` bukan tempat sampah dan `attributes` bukan keadaan mesin.** Kelas A/A′ tetap enum tertutup; `extra`/`attributes` tidak boleh dibaca oleh gerbang RBAC, mesin state, atau payload Feeder.
7. **Biaya tersembunyi sudah dibiayai di kontrak ini** — `ETag`, `X-Lookup-Version`, `private, max-age=60`, dan batch `groups=` — tetapi belum diuji: beban 1.000+ pengguna (`ARCHITECTURE §10.8`) wajib membuktikan satu layar biodata tidak lagi mengirim 12 permintaan identik.
8. **Paritas Mobile (`AGENTS §3.4`).** Web dan Flutter membaca endpoint yang sama dan merender dari `inputKind`/`minSelections`/`maxSelections`/`validationRegex`; **dilarang** membuat kamus per platform atau validasi Regex yang berbeda di Dart. Aturan yang tidak diekspresikan `tenant_custom_attributes` (lintas field) tetap hidup di service, bukan di salah satu klien.
9. **i18n (`AGENTS §3.5`).** Label dua wujud (`name`/`name_en`) dengan `Vary: Accept-Language`; pesan `admin.errors.*` untuk baris 92–106 **wajib** ada di `id.json` **dan** `en.json` dengan sebab + langkah perbaikan, dan namespace `admin.errors` **belum ada** hari ini (bagian dari penutupan RD-12).
10. **Batas ukuran payload & variabel environment milik `ENV_CONTRACT`.** Bagian ini tidak menetapkan angka byte; ia hanya menetapkan bahwa `groups=` dibatasi 20 dan `limit` dibatasi server.

---

---

### 4.15 Catatan rute yang menunggu spesifikasi (rezerwasi nomor)

| Path | Status | Kenapa nomornya ada |
|---|---|---|
| `GET /api/v1/documents/print/:type` | `spesifikasi-hilang` (§5.9) | Muncul hanya di `docs/INDEX.md:88` (FR-AKA-14), tidak ada di §4 mana pun dan tidak ada di kode. **§4.15 direzerwasi** untuknya sampai penulisannya disetujui atau entri `INDEX.md` dicabut — bukan dibatalkan diam-diam (penomoran §4.13). |

---

### 4.16 Mesin parameter sistem dinamis (satu rumah untuk ambang, batas, flag & pola) — M-02 — 2026-10-20

**Status: `spec-only` seluruh §4.16.** Kontrak target, bukan deskripsi realita. Terukur 2026-10-20: (a) `find apps/web/src/app/api/v1 -name route.ts` = **18** berkas, **nol** di bawah `admin/`, dan **nol** berkas di bawah `settings/`; (b) `ls packages/database/migrations/` = 7 berkas (`0001`–`0006`, `0011`) — `0049_system_parameters.sql` **DDL-nya sudah ditulis** di `DATA_MODEL §21.2` dan **belum ada berkasnya**; (c) `grep -rniE "master_system_parameters|system-parameters|settings/effective" apps/web/src packages` = **0** hasil → hari ini **tidak ada satu pun** konsumen parameter, dan angka-angka yang akan dipindah ke mesin ini memang hidup sebagai konstanta (terukur: ambang presensi `attPct >= 75` di `apps/web/src/modules/academic/services/dashboard.service.ts:263`; TTL QR `const ttlSeconds = 30` di `apps/web/src/app/api/v1/attendance/qr/generate/route.ts:65`; radius `z.number().min(10).max(500).default(50)` di baris 29 rute yang sama). (d) izin `settings.param.view|edit.<class>` dan `platform.menu.view|manage|grant|revoke` **sudah menjadi baris katalog** di `RBAC_MATRIX §4.5` nomor **146–161** (terukur; status `usulan` sampai masuk `PERMISSION_SPECS`). Yang belum ada tetap **kode**: tidak satu pun consumer parameter terpasang, dan `authz.ts` masih 222 izin normatif.

**Pemilik nama.** Kolom, `CHECK`, riwayat, nomor migrasi, katalog 25 baris parameter, kosakata modus, tabel `menu_items`/`menu_permissions`/`parameter_permissions` = [DATA_MODEL §21](file:///c:/SICA/docs/DATA_MODEL.md) (`0049`, `0050`) — **tidak diulang di sini**. Kode izin & verba = `RBAC_MATRIX §4`. Pola layar = `UI_UX_DESIGN §14`. **Path, bentuk respons, skema Zod, header cache, dan kode error = bagian ini.**

**Garis pemisah lima rumah (`DATA_MODEL §21.1`, tidak dinegosiasikan di sini).** Mesin ini melayani **skalar kunci-tunggal**: ambang, timeout, penentu jendela, flag fitur, pola. Ia **menolak** menjadi tempat untuk: aturan berversi ber-scope (`academic_rules`), **daftar nilai** (`reference_items` — §4.14), field tambahan per entitas (`tenant_custom_attributes` — §4.14.3), dan **rahasia/kredensial** (vault & ENV — `ENV_CONTRACT`). Enam butir katalog `DATA_MODEL §21.3` (nomor 4, 13, 16, 17, 20, 21) ditolak menjadi key-value dan itu **bukan** kegagalan bagian ini: rute di sini akan menjawabnya `403 PARAM_READONLY` (108) dengan `remedyHref` ke rumah yang benar.

**Yang dijaga oleh `CHECK` dan tidak pernah menjadi angka bebas (`DATA_MODEL §21.1` penutup).** Rentang seperti `attendance.totp_rotate_seconds` 5–30 dengan nilai sah `IN (5,10,15)`, `attendance.totp_window_steps` 0–2, `attendance.geofence_default_radius_m` ≤ 500, `finance.webhook_max_clock_skew_s` ≤ 300 **wajib tetap `CHECK` di DB**. Konsekuensi yang mengikat kedua sisi: layar Admin **tidak** menampilkan slider tanpa batas untuk kunci `risk_class = 'SECURITY'`; menolak di transport (`107`) bukan berarti boleh lebih longgar, dan service **tidak** pernah menerima nilai di luar `CHECK` walaupun klien bersikeras.

#### 4.16.1 Membaca katalog — `GET /api/v1/admin/system-parameters`

```http
GET /api/v1/admin/system-parameters?module=attendance&riskClass=SECURITY&q=totp&at=2026-10-20   → 200
GET /api/v1/admin/system-parameters/attendance.totp_rotate_seconds                              → 200
```

**Skema query (Zod `strict()` — query tak dikenal ditolak, bukan diabaikan):**
```typescript
export const SystemParameterListQuerySchema = z.object({
  module: z.enum(['attendance','krs','grading','feeder','finance','pmb','lms','platform']).optional()
    .describe("reference_kinds-like prefix module_code; bukan string bebas (kolomnya text + CHECK milik DATA_MODEL)"),
  riskClass: z.enum(['TECHNICAL','OPS','ACADEMIC','FINANCIAL','REGULATORY','SECURITY']).optional(),
  q: z.string().min(1).max(80).optional().describe("Cocok pada parameter_key dan description (ILIKE ber-index, tenant-scoped)"),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Rekonstruksi 'aturan mana yang berlaku pada tanggal itu' — jendela effective_from/effective_to + riwayat (BR-R12)"),
  includeInactive: z.coerce.boolean().default(false),
  editableOnly: z.coerce.boolean().default(false).describe("Hanya is_editable=true pada baris source_of_truth='PARAM'"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['parameterKey','moduleCode','riskClass','version','updatedAt']).default('parameterKey'),
  sortDir: z.enum(['asc','desc']).default('asc'),
});
// list memakai amplop §2.4 (data[] + meta.pagination) — tidak ada bentuk list kedua di dokumen ini
```

**Respons `200 OK` (dipangkas; satu baris untuk kunci SECURITY dan satu untuk kunci PARAM pointer):**
```json
{
  "success": true,
  "data": [
    {
      "parameterKey": "attendance.totp_rotate_seconds", "module": "attendance",
      "dataType": "SECONDS", "unit": "s",
      "currentValue": "5", "value": 5,
      "defaultValue": "5", "min": 5, "max": 30, "allowedValues": [5, 10, 15],
      "effective": { "from": "2024-01-01", "to": null, "appliesTo": {}, "isEffectiveNow": true },
      "riskClass": "SECURITY", "version": 3,
      "isEditable": true, "isActive": true, "isSecret": false,
      "requiresRestart": false, "requiresSecondApprover": true,
      "sourceOfTruth": "PARAM",
      "enumKind": null,
      "description": "Periode rotasi token Tantangan QR. Menurunkan nilai di bawah 5 detik tidak dapat disimpan (CHECK).",
      "requestedBy": "0196…", "approvedBy": "0197…", "approvedAt": "2026-10-18T04:11:09.000Z",
      "updatedAt": "2026-10-18T04:11:09.000Z", "updateDisabledReason": null
    },
    {
      "parameterKey": "mahasiswa.nim.pola", "module": "pmb",
      "dataType": "REGEX", "currentValue": null, "value": null,
      "defaultValue": null, "min": null, "max": null, "allowedValues": null,
      "riskClass": "REGULATORY", "version": 1,
      "isEditable": false, "requiresSecondApprover": true,
      "sourceOfTruth": "tenant_settings",
      "description": "Indeks penemuan saja. Nilai sebenarnya kolom tenant_settings.nim_format; ubah lewat layar Pengaturan, bukan dari baris ini.",
      "updateDisabledReason": "NOT_A_PARAM_SOURCE"
    }
  ],
  "meta": { "timestamp": "…", "requestId": "…", "pagination": { "page": 1, "limit": 50, "totalRecords": 41, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false } }
}
```

| Kontrak | Aturan |
|---|---|
| **Selalu ada** | `min`, `max`, `defaultValue`, `currentValue` (raw text kawat), `value` (kolom *generated* bertipe), `effective.*`, `riskClass`, `version`, `isEditable`, `requiresSecondApprover`. Layar tanpa salah satu dari ini tidak dapat menjelaskan "kenapa kotak ini mati". |
| **Pointer bukan salinan** | Baris dengan `source_of_truth != 'PARAM'` dikirim dengan `currentValue: null` + `updateDisabledReason` — nilainya **tidak dibaca** dari baris itu (`DATA_MODEL §21.2`), dan menulis ke baris itu dijawab `403 PARAM_READONLY` (108). Menampilkan angka salinan = dua sumber kebenaran, pola `RD-32`. |
| **`allowedValues`** | Terisi hanya bila `CHECK … IN (…)` ada pada kunci itu (`attendance.totp_rotate_seconds` → `[5,10,15]`). Ini **proyeksi server atas batas**, bukan daftar nilai yang dapat disunting — lihat larangan di §4.16.2. |
| **`requiresSecondApprover`** | Diturunkan server dari `risk_class ∈ {REGULATORY, SECURITY}` **atau** `parameter_permissions.requires_second_approver = true` (`0050`). Klien tidak pernah mengirimnya. |
| **`?at=`** | Membaca `master_system_parameters` + `master_system_parameter_history` untuk merekonstruksi keadaan tanggal itu; **read-only analisis** → boleh ke **Replica**. Tanpa `?at=` = proyeksi keadaan sekarang → **Primary** bila permintaan datang segera setelah tulis (`fresh` implisit dari `If-None-Match` yang gagal). |
| **Cache** | List admin: `Cache-Control: no-store` (read-your-writes + angka sensitif). Ini **berbeda** dari §4.16.5 yang boleh di-cache 60 dtk. |
| **Kodefiedar** | `description` tampil apa adanya dan **wajib** menyebut efek bila diubah (`DATA_MODEL §21.2`); bila `requires_restart = true`, pesan itu ikut di baris list agar operator tidak mengira perubahannya langsung terasa. |

#### 4.16.2 Merawat nilai — `PUT /api/v1/admin/system-parameters/{key}`

**Bukan `POST` bebas.** Kunci yang sudah terdaftar **tidak pernah** dibuat/diubah strukturnya lewat rute ini; badan `PUT` hanya berisi **nilai + alasan**. Kunci baru lahir lewat **migrasi/seed** (`0049` seed katalog §21.3) atau lewat `POST /api/v1/admin/system-parameters/register` (§4.16.4) yang **beraksi `VALIDATE` dan empat-mata**. Alasannya tertulis di sini agar tidak dibaca sebagai gaya REST: kalau `POST` bebas diperbolehkan, satu layar dapat menciptakan `parameter_key` baru yang tidak punya konsumen statis — itulah "parameter hantu" yang membuat katalog berhenti cocok dengan kode.

```typescript
export const SystemParameterPutSchema = z.object({
  value: z.union([z.string().max(4000), z.number(), z.boolean()])
    .describe("Kawat selalu string; angka/boolean diterima untuk kenyamanan klien dan dikanonisasi server. Kontrol karakter: CHECK parameter_value ~ '^[^[:cntrl:]]{0,4000}$' menolak baris kontrol di dalamnya"),
  appliesTo: z.object({
    programIds: z.array(UUIDSchema).max(50).optional(),
    sites: z.array(UUIDSchema).max(50).optional(),
    programTypes: z.array(z.string().max(32)).optional(),
    periods: z.array(UUIDSchema).max(20).optional(),
  }).optional().describe("Override ber-scope; kosong = warisi nilai tenant. Nilai dibaca HANYA bila cocok scope, §4.16.5"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reason: z.string().min(10).max(500)
    .describe("WAJIB. Masuk master_system_parameter_history.reason + audit_logs.before/after; tanpa alasan tidak ada rekonstruksi (BR-R12)"),
  expectedVersion: z.number().int().positive().describe("Optimistic lock; tidak cocok = 409 CONFLICT (12), bukan menimpa suntingan admin lain"),
});
// SERVER_ONLY — kehadiran di body = 422 VALIDATION_FAILED (6):
//   id, tenantId, moduleCode, parameterKey (dari path), dataType, unit, defaultValue, minValue, maxValue,
//   enumKind, description, riskClass, isEditable, isSecret, requiresRestart, sourceOfTruth,
//   version, requestedBy, approvedBy, approvedAt, allowedValues, requiresSecondApprover
// DILARANG: sendingOptionValues / values / allowedValues / enumValues — daftar nilai TIDAK PERNAH masuk body.
//   Sumber daftar adalah kamus (enum_kind -> reference_kinds, §4.14) atau CHECK kolom (DATA_MODEL).
```

**Sembilan penjaga transport, berurutan, gagal-closed** (nomor §2.3 dipakai, bukan diciptakan ulang):

| # | Penjaga | Kode |
|---:|---|---|
| 1 | `parameterKey` di path ada di scope tenant, `is_active`, dan `source_of_truth = 'PARAM'` | tidak ada → `404 NOT_FOUND` (5) · pointer → `403 PARAM_READONLY` (108) |
| 2 | Tipe nilai cocok `data_type` (INT/DECIMAL/PCT/BP/SECONDS/METERS/BOOL/JSON/DATE/TIME/CRON/STRING/REGEX) — `PCT` ≤ 100, `BP` ≤ 10.000, `REGEX` dapat dikompilasi | `422 PARAM_INVALID_TYPE` (109) |
| 3 | `min_value` ≤ nilai ≤ `max_value` (dibandingkan sebagai `numeric`, **bukan** string) | `422 PARAM_OUT_OF_RANGE` (107) dengan `details[]` `{parameterKey, sentValue, min, max, unit}` |
| 4 | Nilai sah ∈ `allowedValues` bila kunci punya `CHECK IN (…)` | `422 PARAM_OUT_OF_RANGE` (107) — satu keadaan, satu kode; `allowedValues` ikut di muatan |
| 5 | Kunci ber-`enum_kind`: nilai **wajib** anggota `reference_items(kind = enum_kind)` yang aktif pada tanggal itu | kind tidak ada → `404 LOOKUP_GROUP_NOT_FOUND` (92) · nilai tidak ada → `422 PARAM_ENUM_UNKNOWN` (110). **Server tidak pernah** menambah item kamus agar nilai "lulus" |
| 6 | `is_editable = true`; penyetelan `riskClass`/`isSecret`/`requiresRestart`/`sourceOfTruth` dari body ditolak sebelum apapun ditulis | `403 PARAM_READONLY` (108) |
| 7 | Nilai tidak berbentuk kredensial (`secret`, `password`, `token`, `Authorization:`, ` -----BEGIN`, DSN ber-password, `webhook_secret` kanal) **dan** klien tidak mencoba mengirim `isSecret` | `422 PARAM_SECRET_FORBIDDEN` (111); penegak kedua = `CHECK (is_secret = false)` + `CHECK (source_of_truth <> 'ENV')` di `0049`, gerbang CI §21.8(1) |
| 8 | `expectedVersion` cocok | `409 CONFLICT` (12) + `currentVersion` — klien membaca ulang, tidak menimpa |
| 9 | Kunci `requires_restart = true` | `409 PARAM_RESTART_REQUIRED` (112) dengan `deployRef` yang diminta; nilai **tidak** dihitung efektif sampai restart terbukti |

**Kelas `SECURITY`/`REGULATORY` tidak dapat berlaku sebelum disetujui orang kedua (`DATA_MODEL §21.2` CHECK + CI §21.8(5)):** `PUT` atas kunci itu **tidak** menaikkan nilai efektif — ia menyimpan **draf** dan menjawab `409 PARAM_APPROVAL_REQUIRED` (113) dengan `approvalId`. Yang menolak actor yang sama menyetujui dirinya sendiri tetap baris **56** (`SELF_APPROVAL_FORBIDDEN`), dan MFA untuk peran penulis-admin adalah syarat sesi (`AGENTS §3.8`) — bukan field body.

**Respons `200 OK`** (amplop §2.1; nilai `SECURITY` yang belum disetujui **tidak** ditampilkan sebagai efektif):
```json
{
  "success": true,
  "data": {
    "parameterKey": "attendance.geofence_default_radius_m",
    "previousValue": "50", "proposedValue": "75", "effectiveValue": "50",
    "version": 4, "riskClass": "SECURITY", "requiresSecondApprover": true,
    "approval": { "approvalId": "0198…", "state": "PENDING", "requestedBy": "0196…", "allowedActors": ["ROLE:TENANT_ADMIN"] },
    "pendingRestart": false, "effectiveFrom": "2026-10-20", "scopeDiff": { "added": { "sites": ["0190…"] }, "removed": {} },
    "historyId": "0198…"
  },
  "meta": { "timestamp": "…", "requestId": "…", "auditId": "0198…" }
}
```
> `effectiveValue` **≠** `proposedValue` adalah inti kontrak ini: klien yang menampilkan `proposedValue` sebagai "sudah berlaku" sedang berbohong ke operator. Header respons tulis selalu `Cache-Control: no-store`.

**Ralat 2026-10-23 (dikonfirmasi oleh realita, bukan gaya).** Contoh di atas ditulis sebagai `200 OK`, padahal paragraf sebelumnya mewajibkan **`409 PARAM_APPROVAL_REQUIRED` (113)** untuk kunci `SECURITY`/`REGULATORY`. Satu keadaan tidak boleh punya dua bentuk jawaban, dan yang menang adalah norma (nilai efektif tidak naik tanpa orang kedua). Yang berlaku: **muatan `data` di atas adalah `error.details[]` pada respons `409`**, dengan satu field tambahan `approvalId` (identitas draf, §21.2.1) agar klien dapat menampilkan tautan "lihat antrean persetujuan" alih-alih pesan generik. `200 OK` dari `PUT` hanya terjadi pada kelas `TECHNICAL`/`OPS`/`ACADEMIC`/`FINANCIAL`, dan pada respons itu `effectiveValue == proposedValue` selalu. Objek penampung drafnya sekarang **bernomor dan ber-DDL**: [DATA_MODEL §21.2.1](file:///c:/SICA/docs/DATA_MODEL.md) → `master_system_parameter_approvals` → `0088_parameter_approvals.sql`; sebelum ralat ini, `approvalId` adalah rujukan hantu (pola `RD-54`).

**Baca antrean (`GET /api/v1/admin/system-parameter-approvals`).** Ditambahkan 2026-10-23 karena `SPE-5` menuntut layar "Antrean persetujuan" sedangkan §4.16.3 hanya punya `approve`/`reject` — penyetuju kedua tidak dapat menyetujui id yang tidak pernah dapat ia temukan. Bentuknya list kanonik §2.4 (amplop + `meta.pagination`), filter `state` (`PENDING` baku) / `parameterKey` / `from` / `to`, **read-only**, dan hanya menampilkan baris milik tenant peminta (RLS). Gerbangnya `requireAdminReadAny`: izin `approve` kedua kelas ATAU izin `edit`/`view` kelas yang sesuai kunci — pemegang `edit.security` berhak melihat drafnya sendiri menunggu, tanpa berhak menyetujuinya.


#### 4.16.3 Persetujuan, revert, riwayat, dampak, dan toggle

```http
POST  /api/v1/admin/system-parameters/{key}/request-approval   → 201  { approvalId }  (VALIDATE-later; MFA utk SECURITY/REGULATORY)
GET   /api/v1/admin/system-parameter-approvals?state=PENDING   → 200  list §2.4 — antrean yang dilihat penyetuju kedua (ditambah 2026-10-23, §4.16.2)
POST  /api/v1/admin/system-parameter-approvals/{id}/approve    → 200  approve: approverId != requesterId, verba VALIDATE
POST  /api/v1/admin/system-parameter-approvals/{id}/reject     → 200  state REJECTED + reason wajib
POST  /api/v1/admin/system-parameters/{key}/revert             → 200  ke default ATAU ke versi sebelumnya, alasan wajib
GET   /api/v1/admin/system-parameters/{key}/history?from=&to=  → 200  list §2.4 (insert-only)
GET   /api/v1/admin/system-parameters/{key}/impact            → 200  siapa membaca kunci ini
PATCH /api/v1/admin/system-parameters/{key}/toggle-active      → 200  is_active flip, reason wajib
```

`{key}` dan `{id}` **bukan** dua nama untuk satu hal: kunci parameter adalah identitas **baris konfigurasi**, `approvalId` adalah identitas **permintaan persetujuan** (satu kunci dapat punya beberapa permintaan bersejarah). Rute `approve`/`reject` karena itu menunjuk `…/system-parameter-approvals/{id}/…` — tidak ada `POST /admin/system-parameters/{id}/approve` yang membuat `{id}` bermakna ganda.

| Aksi | Aturan & kode |
|---|---|
| `request-approval` | Body `{ value, appliesTo?, reason }` (bentuk sama dengan §4.16.2 — **satu** skema Zod, tidak ada jalur kedua). Semua sembilan penjaga §4.16.2 dijalankan **sebelum** approval dibuat: mengajukan nilai yang pasti ditolak adalah cara antrean persetujuan menjadi tempat sampah. Izin `settings.param.edit.<class>` (usulan 146+, §4.16.7). |
| `approve` | `VALIDATE`; `approverId != requesterId` → `403 SELF_APPROVAL_FORBIDDEN` (56); MFA di sesi; `DECISION_ALREADY_MADE` (55) bila permintaan sudah `APPROVED`/`REJECTED`/`CANCELLED` (transisi satu arah); `PERIOD_CLOSED` (25) tidak berlaku — parameter sistem tidak terikat periode akademik, dan itu dinyatakan agar tidak ditafsirkan sendiri. Efek: `version++`, `approved_by`/`approved_at` terisi, **invalidasi cache §4.16.5** (versi naik ⇒ `ETag` berubah), riwayat + `audit_logs` + `meta.auditId`. |
| `revert` | Body `{ toVersion \| toDefault, reason (10–500), expectedVersion }`. `toVersion` menunjuk `new_version` **yang ada di riwayat**; versi tak ada → `404 NOT_FOUND` (5). Revert **tidak** menghapus riwayat: ia menulis **entri baru** dengan `reason` berisi tautan entri asal (insert-only; `REVOKE UPDATE, DELETE` + pemicu `app.reject_mutation()` seperti `custom_attribute_history`). Kelas `SECURITY`/`REGULATORY` juga butuh empat-mata: revert adalah perubahan nilai, dan "kembali" bukan alasan untuk lolos persetujuan. |
| `history` | Proyeksi `master_system_parameter_history` (`old_value`/`new_value`/`old_version`/`new_version`/`reason`/`ip`/`approver_id`/`source`/`request_id`, `0049`). **READ-only mutlak** — tidak ada rute tulis/ubah/hapus riwayat (AC-AUD-1); `ip` dan `changed_by` hanya ke peran dengan izin riwayat (§4.16.7); urut `occurred_at DESC`; filter `from`/`to` wajib ISO-date, `to < from` → `422 VALIDATION_FAILED` (6). Boleh ke **Replica**. |
| `impact` | Jawaban atas "kalau angka ini turun, apa yang berubah?". Tiga sumber digabung deterministik dan **satu daftar hasil, tanpa duplikat**: (1) `parameter_permissions` (pola yang cocokkan kunci) + `menu_items`/`menu_permissions` lewat grant ⇒ layar; (2) `reference_kind_usage` (§4.14.2 — milik kamus, dipakai di sini bila `enum_kind` terisi); (3) **registri statis kode**: daftar `parameterKey → call site` yang dikompilasi dari sumber (target `packages/contracts/src/parameter-keys.ts`, pola `AGENTS §3.10` gerbang n). Item yang tidak punya baris di (3) ditandai `orphanKeys[]` — itu **tunggakan CI**, bukan fitur. Boleh ke Replica; izin `settings.param.impact.view` (usulan). |
| `toggle-active` | `PATCH` satu field + `reason`. Menonaktifkan kunci `SECURITY`/`REGULATORY` yang **dibaca** oleh gerbang berarti gerbang kehilangan ambangnya, jadi server **menolak** bila pemakai aktif terdaftar di impact dan `fallback` tidak terdefinisi: `409 PARAM_APPROVAL_REQUIRED` (113) dengan `details[].fallback: "DEFAULT_VALUE_MISSING"`. Menonaktifkan kunci dengan `default_value` yang sah = nilai **default** yang berlaku, bukan nol. |

#### 4.16.4 Kunci baru & pola grant parameter

```http
POST /api/v1/admin/system-parameters/register                                    → 201  VALIDATE + empat-mata
GET  /api/v1/admin/system-parameters/patterns?parameterKey=attendance.totp_*      → 200  grant yang cocok (parameter_permissions)
PUT  /api/v1/admin/system-parameters/patterns                                    → 200  tulis grant pola (allowlist + DENY)
```

```typescript
export const SystemParameterRegisterSchema = z.object({
  module: z.enum(['attendance','krs','grading','feeder','finance','pmb','lms','platform']),
  parameterKey: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_*]+)+$/).max(128)
    .describe("Berawalan modul, stabil, tidak pernah diganti label (DATA_MODEL §21.2)"),
  dataType: z.enum(['STRING','REGEX','INT','DECIMAL','PCT','BP','SECONDS','METERS','BOOL','JSON','DATE','TIME','CRON']),
  unit: z.string().max(16).nullable().optional(), defaultValue: z.string().max(4000),
  minValue: z.string().max(32).nullable().optional(), maxValue: z.string().max(32).nullable().optional(),
  enumKind: z.string().max(64).nullable().optional().describe("Kunci reference_kinds.kind; NULL untuk tipe numerik/boolean"),
  description: z.string().min(20).max(1000), riskClass: z.enum(['TECHNICAL','OPS','ACADEMIC','FINANCIAL','REGULATORY','SECURITY']),
  appliesTo: z.record(z.string(), z.unknown()).default({}),
  requiresRestart: z.literal(false).default(false).describe("Kunci baru TIDAK boleh lahir sebagai konstanta yang menyamar; true hanya lewat deviasi tercatat di DATA_MODEL"),
  consumerEvidence: z.object({
    callSites: z.array(z.string().max(200)).min(1).max(20).describe("file:symbol pemakai yang SUDAH ada di branch ini"),
    testRef: z.string().max(200).describe("referensi uji yang membaca nilai itu"),
  }).describe("Bukti bahwa kunci punya konsumen; tanpanya register ditolak"),
  reason: z.string().min(10).max(500),
});
// SERVER_ONLY: id, tenantId, isSecret (terkunci false), sourceOfTruth (terkunci 'PARAM'), version,
//              isEditable, isActive, requestedBy, approvedBy, approvedAt
```

| Penjaga register & pola | Kode |
|---|---|
| `parameterKey` sudah ada | `409 CONFLICT` (12) — `UNIQUE (tenant_id, module_code, parameter_key)` (`0049`); **bukan** `POST` idempoten diam-diam |
| `enumKind` menunjuk kind yang tidak ada | `404 LOOKUP_GROUP_NOT_FOUND` (92) dengan `field: "enumKind"` — kind dibuat lebih dulu di §4.14.2 |
| `dataType` numerik tetapi `enumKind` terisi (`CHECK enum_kind IS NULL OR data_type IN ('STRING','INT')`) | `422 PARAM_INVALID_TYPE` (109) dengan kutipan CHECK — `DATA_MODEL` pemilik `CHECK`, bagian ini hanya memetakan sebab |
| `minValue`/`maxValue` tidak bisa dikast ke `dataType`, atau `min > max`, atau `defaultValue` di luar rentang | `422 PARAM_OUT_OF_RANGE` (107) — mustahil menerima kunci yang baris pertamanya sudah melanggar CI §21.8(2) |
| `consumerEvidence.callSites` kosong / menunjuk berkas yang tidak ada di branch | `422 VALIDATION_FAILED` (6) dengan `details[].missingConsumers[]` — **inilah** penangkal "parameter hantu"; gerbang CI (n) menuntut konsumen nyata, bukan janji |
| Register oleh actor yang sama dengan pemohon, atau tanpa `VALIDATE` | `403 SELF_APPROVAL_FORBIDDEN` (56) · `403 FORBIDDEN` (3) selama izin belum dipromosikan |
| Pola grant (`PUT …/patterns`) | Body `{ patterns: [{ parameterPattern, permissionCode, effect, minScope, requiresMfa, requiresSecondApprover, note, validFrom?, validTo? }] }`. Evaluasi server **deterministik** dan tertulis di kontrak ini: **DENY menang atas ALLOW**, lalu pola paling spesifik (segmen literal terbanyak) menang, lalu **`parameter_permissions` kalah terhadap keputusan servis untuk kelas `SECURITY`** (`DATA_MODEL §21.7` keputusan 1). Pola tak sah → `422 PARAM_PATTERN_INVALID` (114); pola tanpa `note` → **ditolak** (baris `CHECK` + review); `permissionCode` tidak ada di katalog → `422 MENU_PERMISSION_UNKNOWN` (116) — satu kode untuk "kode izin tidak dikenal", dipakai baik oleh grant menu maupun grant parameter, karena keadaannya identik |

**Norma evaluasi, dibaca ulang oleh semua pihak (tidak ada interpretasi lain):** nilai efektif = keputusan atas **satu** baris untuk `(tenant, parameter_key, scope peminta, tanggal)`; dua baris `ACTIVE` dengan spesifisitas `applies_to` yang sama adalah **konfigurasi rusak** dan dijawab `409 CONFLICT` (12) dengan kedua kandidat + `remedyHref`, bukan "yang terakhir menang" (pola yang sama dengan baris 105 untuk matriks tarif).

#### 4.16.5 Kontrak baca untuk klien — `GET /api/v1/settings/effective`

```http
GET /api/v1/settings/effective?keys=attendance.min_presence_pct,attendance.multi_source_policy
GET /api/v1/settings/effective?module=lms&keys=lms.challenge_required
```

```typescript
export const EffectiveSettingsQuerySchema = z.object({
  keys: z.string().min(1).max(2000).transform((s) => s.split(',').map((k) => k.trim()).filter(Boolean))
    .refine((a) => a.length >= 1 && a.length <= 40, "1..40 kunci per permintaan"),
  module: z.enum(['attendance','krs','grading','feeder','finance','pmb','lms','platform']).optional(),
  scopeHint: z.enum(['SELF','CLASS','PROGRAM']).optional()
    .describe("Hanya untuk memilih turunan applies_to yang sah bagi peminta; TIDAK pernah memotong RLS dan TIDAK pernah menjadi pengganti izin"),
});
// TANPA body. TANPA parameter "tenantId". Klien tidak pernah menulis di rute ini.
```

**Respons `200 OK`:**
```json
{
  "success": true,
  "data": {
    "resolvedAt": "2026-10-20T08:00:00.000Z",
    "settings": [
      { "key": "attendance.min_presence_pct", "value": 75, "dataType": "PCT", "unit": "%",
        "source": "TENANT_PARAM", "version": 2, "riskClass": "ACADEMIC", "requiresSecondApprover": false },
      { "key": "attendance.multi_source_policy", "value": "ONSITE_PRIMARY", "dataType": "STRING",
        "enumKind": "kebijakan_rekonsiliasi", "enumLabel": "Luring jadi dasar, daring hanya bukti",
        "source": "TENANT_PARAM", "version": 1, "riskClass": "ACADEMIC" },
      { "key": "attendance.totp_rotate_seconds", "value": null, "masked": true, "maskedReason": "READ_ROLE_NOT_ALLOWED",
        "dataType": "SECONDS", "version": 3, "riskClass": "SECURITY" }
    ],
    "unresolvedKeys": []
  },
  "meta": { "timestamp": "…", "requestId": "…", "parameterVersion": "4f19c2b7-2026-10-20T07:59:51Z-17" }
}
```

| Aspek | Aturan yang mengikat |
|---|---|
| **Resolusi server-side** | Nilai yang dikembalikan **sudah** melewati (1) `is_active`, (2) jendela `effective_from`/`effective_to`, (3) **`applies_to` paling spesifik yang cocok dengan konteks peminta** (prodi/site/jenis program/periode), (4) fallback ke baris tenant tanpa scope, (5) fallback ke `default_value`. Yang **tidak** terjadi: mengirim seluruh kandidat lalu klien memilih — itu memindahkan keputusan ke dua platform dan melanggar paritas `AGENTS §3.4`. |
| **`source`** | `TENANT_PARAM` (override tenant) · `SCOPE_PARAM` (baris ber-`applies_to`) · `DEFAULT` (turun ke `default_value`) · `DERIVED` (bukan milik rumah ini; `DATA_MODEL §21.1` — mis. band SKS per IPK yang berasal dari `academic_rules`, dikirim sebagai **bukan** nilai mentah). Klien berhak tahu mengapa angkanya begitu; `version` ikut supaya laporan dapat menyebutnya. |
| **Header** | `X-Parameter-Version: <tenant8>-<h8>` dengan `h8` = 8 hex pertama SHA-256 atas proyeksi `(key, value, version)` dalam urutan kunci yang diminta. `ETag: W/"<versi>"`. **`Cache-Control: private, max-age=60`** — `private` karena isinya ambang satu tenant; CDN/lapisan bersama **dilarang** menyimpan. `Vary: Accept-Language` (label enum punya dua wujud) dan `Vary: X-Parameter-Scope` bila `scopeHint` dipakai. `If-None-Match` cocok → **`304` tanpa body** (kelas pengecualian keenam, dinegosiasi di §1.1). |
| **Klien tidak menulis** | Tidak ada `POST`/`PUT`/`PATCH` pada prefix `/settings/effective`. Menulis **hanya** lewat §4.16.2–§4.16.4 dengan izin kelas. Ini dinyatakan karena "endpoint pengaturan" adalah permukaan godaan. |
| **Ambang keputusan keamanan** | `attendance.totp_rotate_seconds`, `attendance.totp_window_steps`, `attendance.geofence_default_radius_m`, `attendance.gps_max_accuracy_m`, `attendance.challenge_required`, `finance.webhook_max_clock_skew_s` **dibaca server-side di titik keputusan** (verifikasi Tantangan, Haversine, validasi webhook — §4.18) dan **tidak pernah** menjadi dasar keputusan di klien. Klien yang meminta kunci `riskClass ∈ {SECURITY, REGULATORY}` tanpa izin kelas membaca **`masked: true`** (`READ_ROLE_NOT_ALLOWED`), bukan `403` seluruh permintaan — satu kunci sensitif tidak boleh menjatuhkan satu layar. |
| **Read-your-writes** | Setelah `PUT`/`approve`, klien **wajib** memakai `?fresh` implisit via `If-None-Match` yang gagal; resolver membaca **Primary** (AGENTS §3.7) — memvalidasi keputusan "kuota/ambang" dari replica = memutuskan dari angka basi. |
| **`unresolvedKeys`** | Kunci yang tidak ada di katalog tenant **tidak** menjawab `404`: mereka masuk `unresolvedKeys[]` dengan `reason: "NOT_REGISTERED"` dan HTTP tetap `200`. Alasannya kontrak klien: satu layar meminta 12 kunci, dan satu kunci milik modul yang belum diaktifkan tidak boleh membuat seluruh form gagal. Kunci **milik tenant lain** juga masuk sini (anti-oracle, bukan 403). |
| **Entitlement memotong lebih dulu** | Kunci dengan `module_code` yang modulnya non-`ACTIVE`/`TRIAL` **tidak** dikembalikan sebagai angka: masuk `unresolvedKeys` dengan `reason: "MODULE_NOT_AVAILABLE"`. Kalau klien **memaksa** satu kunci modul itu (permintaan tunggal `keys=<module>.x`), jawabannya `404 MODULE_NOT_AVAILABLE` (26) — tetap sesuai aturan "entitlement sebelum role". |
| **Kapasitas** | Permintaan ini **hot path** (dibaca banyak layar per sesi). Resolver **wajib** men-cache hasil per `(tenant, versi, set kunci)` di memori worker dengan invalidasi berbasis `version` (`DATA_MODEL §21.3`; Redis sebagai lapisan kedua = **design-only**, `ioredis` belum dependensi — `RD-11`, `P-6`). Angka latensi target tidak diklaim di sini; ia diukur di uji beban (`ARCHITECTURE §10.8`). |
| **i18n** | Label enum (`enumLabel`) dua wujud; pesan `admin.errors.*` untuk baris 107–114 **dan** 116 **wajib** ada di `id.json` **dan** `en.json` dengan **sebab + langkah perbaikan** (`AGENTS §3.5`). Namespace `admin.errors` **belum ada** hari ini (RD-12) — menuliskan kodenya di §2.3 tidak menambah satu pun kunci. |

#### 4.16.6 Enam lapis penegakan untuk rute tulis §4.16

| Lapis | Kewajiban konkret di gugus ini | Bukti kegagalan yang sudah ada |
|---|---|---|
| L1 | Zod `strict()` pada body **dan** query; `limit ≤ 100` list admin; field tak dikenal → `422` (6); daftar nilai **tidak pernah** dari body; kolom `SERVER_ONLY` §4.16.2 ditolak bila muncul | `qr/generate` masih menerima koordinat & radius dari body (§4.3.7) |
| L2 | `tenantId`/`userId` **hanya** dari JWT terverifikasi; middleware **wajib menghapus** `x-tenant-id`/`x-user-id` kiriman klien sebelum menyetel milik sendiri; `parameterKey` **tidak pernah** menjadi sumber identitas | `SEC-07` |
| L3 | `requireDataPrincipal` atas `user_role_assignments` + `valid_to`; izin **kelas parameter** (`settings.param.view.<class>` / `.edit.<class>`), bukan perluasan carrier `member_role` | `SEC-10`; belum ada satu pun kode izin parameter |
| L4 | `holdsScoped(access, PERM.x, { kind, id })` — `applies_to` (prodi/site/jenis program/periode) **dibuktikan**, bukan dipercaya dari body; kunci kelas `REGULATORY` menuntut scope `TENANT` atau `ORG` yang nyata | `SEC-11` — fungsi ada, nol pemanggil |
| L5 | Nilai di dalam `CHECK` rentang; `enum_kind` ada di kamus **pada tanggal itu**; jendela `effective_from`/`effective_to`; `version` cocok; approval belum terminal (55); actor ≠ pemohon (56); `is_active` | `SEC-02` (baris `LOCKED` masih bisa ditimpa di gugus lain) |
| L6 | `SET LOCAL app.current_tenant` tiap transaksi; `sica_app` `NOBYPASSRLS`; `master_system_parameters`, `master_system_parameter_history`, `menu_items`, `menu_permissions`, `parameter_permissions`, `attendance_evidence` **wajib** `ENABLE`+`FORCE`+`tenant_isolation` (`DATA_MODEL §21.9`); CI §21.8(1)(2)(5) harus 0 baris | generator policy §6.2 belum menghasilkan policy untuk tabel baru |

**Anti-IDOR.** `parameterKey` (natural key), `approvalId`, `historyId`, `menuId`, `parentId`, `intoItemId`, dan id di dalam `appliesTo` **selalu** diselesaikan ke barisnya **di dalam transaksi** (`WHERE tenant_id = ctx.tenantId AND …`) dan kepemilikan/scope-nya dibuktikan **sebelum** mutate; objek tenant lain dijawab `404 NOT_FOUND` (5), bukan 403 (anti-oracle). **Idempotensi — diralat 2026-10-23 dari "wajib header" menjadi "dibuktikan oleh keadaan".** Teks ini sebelumnya menuntut `Idempotency-Key` (§4.2.14) pada `PUT`/`register`/`request-approval`/`approve`/`reject`/`revert`/`toggle-active`. Terukur: **tidak satu pun** rute itu membaca header tersebut (`.tools/handler-inventory.mjs` + `grep -rn "Idempotency-Key" apps/web/src/app/api/v1/admin/system-parameters/**` = 0), sehingga menuliskannya sebagai "wajib" adalah norma tanpa penegakan — pola `RD-40` yang sudah pernah kita catat. Yang sebenarnya menahan replika ganda di gugus ini adalah **kunci keadaan**, dan itu yang diuji (`.tools/e2e-fase-1c.mjs`):

| Mutasi | Penahan replika yang NYATA | Galat replika |
|---|---|---|
| `PUT` nilai | `expectedVersion` wajib (`.strict()` menolak body tanpa itu) + `version` dinaikkan dalam transaksi yang sama | `409 CONFLICT` (12) — nilai admin lain tidak tertimpa |
| `request-approval` / `PUT` kelas empat-mata | indeks parsial `uq_param_approval_pending (tenant_id, parameter_id) WHERE state='PENDING'` (`0088`) | `409` (12) dengan `approvalId` yang sudah ada — satu kunci tidak menunggu dua kali |
| `approve` / `reject` | `state` terminal + `SELECT … FOR UPDATE`; penjaga empat-mata `ck_param_approval_foureyes` | `409 DECISION_ALREADY_MADE` (55) / `403 SELF_APPROVAL_FORBIDDEN` (56) |
| `revert` | `expectedVersion` + entri riwayat BARU (insert-only, menunjuk entri asal) | `409 CONFLICT` (12) |
| `toggle-active` | `expectedVersion`; `isActive` boolean, jadi replika = keadaan sama | `409 CONFLICT` (12) |
| `register` | `UNIQUE (tenant_id, module_code, parameter_key)` | `409` (`KEY_TAKEN`) — bukan baris ganda |

Konsekuensi yang dinyatakan, bukan disembunyikan: dua klik "Simpan" pada layar yang sama **tidak** menghasilkan dua nilai atau dua draf; ia menghasilkan satu sukses + satu `12`/`55`, dan layar menampilkannya sebagai "nilaimu sudah tersimpan oleh perubahan lain — baca ulang" (`admin.param.stale.*`, `UI_UX §14.11`). Header `Idempotency-Key` **tetap wajib** untuk mutasi tanpa penjaga natural (contoh yang sudah berjalan: `POST /platform/tenants`, `0012 idempotency_keys`) dan **tidak** dituntut di gugus §4.16 sampai ada rute yang kehilangan penjaga versi/keadaan-nya — bila itu terjadi, rute tersebut wajib ikut `§4.2.14`, bukan dikecualikan diam-diam (`RD-144`). Mutasi **hanya ke Primary**; `history`/`impact`/`?at=` boleh ke Replica.

**`SERVER_ONLY` gugus ini** (tambahan di atas daftar kanonik `DATA_MODEL §14.9`, tidak menggandakannya): `master_system_parameters.id`/`tenant_id`/`module_code`/`parameter_key`/`data_type`/`default_value`/`min_value`/`max_value`/`enum_kind`/`risk_class`/`is_editable`/`is_secret` (terkunci `false`)/`requires_restart`/`source_of_truth` (terkunci `'PARAM'`)/`version`/`requested_by`/`approved_by`/`approved_at`, seluruh `master_system_parameter_history.*` (insert-only), `menu_items.is_visible` hanya untuk peran grant (§4.17), `parameter_permissions.requires_second_approver` (turunan `risk_class`, bukan pilihan klien).

#### 4.16.7 Kode izin, status jujur, dan sekuensi pengerjaan

**Usulan titik aksi.** Ralat 2026-10-20: tabel ini pertama ditulis ketika register `RBAC_MATRIX §4.5` berhenti di 145; sejak siklus yang sama register itu **memublikasikan baris 146–161** untuk persis nama-nama di bawah, sehingga angka "usulan # 146+" di kolom pertama sudah punya alamat kanonik. Yang **tidak** berubah: statusnya tetap **`usulan`** dan `grep` di `authz.ts` atas semua nama di bawah ini = **0 hasil** (terukur). Promosi ke `PERMISSION_SPECS` tetap wajib lewat §4.5, bukan lewat file ini.

| Usulan # | Permission | resource | verba | Catatan singkat |
|---:|---|---|---|---|
| 146+ | `settings.param.view.technical` · `.ops` · `.academic` · `.financial` · `.regulatory` · `.security` | `admin.parameter` | `READ` | satu izin per **kelas risiko**, bukan per kunci (145 kunci = 145 izin adalah cara katalog meledak); `view.security` **tidak** implikasi hak tulis |
| 146+ | `settings.param.edit.technical` · `.ops` · `.academic` · `.financial` | `admin.parameter` | `UPDATE` | verba untuk `REGULATORY`/`SECURITY` memang ada (baris RBAC 155/157, dengan `CHECK approved_by <> requested_by`), tetapi nilai itu **berlaku** hanya setelah `approve` di baris berikutnya — lulus `UPDATE` tanpa pengesahan tidak mengubah apa pun — nilainya hanya berlaku lewat `approve` |
| 146+ | `settings.param.approve.regulatory` · `.security` | `admin.parameter` | `VALIDATE` | empat-mata + MFA penulis-admin; `approverId != requesterId` ditegakkan `CHECK` di DB |
| 146+ | `settings.param.register` | `admin.parameter` | `INSERT` | membuat kunci baru; wajib `consumerEvidence` (§4.16.4) |
| 146+ | `settings.param.history.view` | `admin.parameter-history` | `READ` | pemegangnya saja yang membaca `ip` + `changed_by` |
| 146+ | `settings.param.impact.view` | `admin.parameter-impact` | `READ` | padanan **izin RBAC §4.5 baris 135** (`master.impact.view`) untuk kunci parameter, bukan kamus |
| 146+ | `settings.param.pattern.manage` | `admin.parameter-grant` | `UPDATE` | tulis `parameter_permissions`; **bukan** izin untuk mengubah nilai |

**Butir jujur yang tidak boleh dihapus dari bagian ini:**

1. **Tidak satu pun rute §4.16 ada hari ini.** Prefix `/api/v1/admin/**` dan `/api/v1/settings/**` belum pernah ada di `apps/web/src`; tidak ada kontrak Zod untuk parameter; tidak ada satu pun konsumen `parameter_key`. Semua baris di atas adalah **target**.
2. **Hari ini angkanya memang konstanta.** Terukur: ambang kehadiran `>= 75` ditulis langsung di `dashboard.service.ts:263`, `ttlSeconds = 30` dan `radius 10..500 default 50` ditulis langsung di `attendance/qr/generate/route.ts:29,65`. Memindahkan kunci ke mesin ini **tanpa** mengubah konstanta itu menjadi pembaca parameter = mendapat layar Admin yang menulis angka yang tidak dibaca siapa pun. Urutan yang benar: kunci lahir di seed → konsumen statis didaftar (`consumerEvidence`) → konstanta diganti pembaca resolver → uji.
3. **Katalog `DATA_MODEL §21.3` punya 25 baris (terukur `grep` baris bernomor) dan enam di antaranya ditolak menjadi key-value** (nomor 4, 13, 16, 17, 20, 21). §4.16.1/§4.16.2 melayani penolakan itu dengan `403 PARAM_READONLY` + `remedyHref` dan **tidak** membuka rute kedua untuk `academic_rules`/`grade_scales`/`fee_tariff_groups`/`tuition_discounts`/`payment_channels`/`tenant_settings.nim_format`.
4. **`0049` dan `0050` belum berberkas.** `ls packages/database/migrations/` = `0001`–`0006`, `0011`. Urutan `AGENTS §3.11` tidak boleh dibalik: PRD (FR-ADM-09/25/26) → DDL + nomor migrasi di DATA_MODEL (**sudah ditulis**) → izin di `RBAC_MATRIX §4.5` (**selesai 2026-10-20**: baris 146–161 terbit dengan status `usulan`) → path + kode error di sini (**selesai 2026-10-20**) → pola layar di `UI_UX_DESIGN` §14/§15/§16 (**selesai 2026-10-20**) → task di `ROADMAP_TASKS` §2.17 (`SPE-*`) → **baru** kode. Yang **belum** dari rantai ini tinggal satu mata: promosi 146–161 ke `PERMISSION_SPECS` (`SPE-3`) — dan itu memang bukan pekerjaan dokumen.
5. **Design-only, dinyatakan eksplisit:** cache resolver dua lapis (Redis), jalur vault untuk kredensial vendor webinar, dan restart-gate `requires_restart` (butuh pipeline rilis `DEPLOYMENT_DEVOPS §4`). Tidak ada satu pun dari ketiganya boleh ditulis sebagai "sudah berjalan".
6. **Nomor 107–118 adalah usulan milik §2.3.** Menambah kode error **tidak** menambah hak apa pun; satu baris izin = satu titik aksi, bukan dua.
7. **Paritas Mobile (`AGENTS §3.4`).** Flutter tidak punya layar tulis parameter; ia **pembaca** `GET /settings/effective` untuk ambang tampilan (mis. % kehadiran yang ditampilkan di kartu presensi) dan **dilarang** memakai angka itu untuk keputusan akses. Konstanta duplikat di Dart = pelanggaran paritas, dan gerbang CI (m) (`AGENTS §3.10`) yang menolaknya.

---

### 4.17 Menu dinamis & grant (pohon yang disaring server, bukan kontrol akses) (M-02) — 2026-10-20

**Status 2026-10-20: `spec-only` seluruh §4.17.** Objek pemilik = `DATA_MODEL §21.7` (`menu_items`, `menu_permissions`, `parameter_permissions`; migrasi `0050_menu_parameter_permissions.sql` — **DDL ditulis, berkas belum ada**). Terukur: `apps/web/src/app/api/v1` hanya berisi `academic`, `attendance`, `auth`, `health`, `tenant` — prefix `/me/**` dan `/admin/platform/**` **belum pernah ada**; `grep -rn "navigation" apps/web/src/locales/id.json` = satu namespace statis (`navigation.*`, 12 kunci) yang hari ini menjadi **satu-satunya** sumber menu, jadi pohon menu hari ini **keras di kode**, bukan data.

**Ralat status 2026-10-24 (`MENU-LOCK-1`, `RD-176`, `PROGRESS_REPORT §5.84`).** Paragraf di atas adalah pengukuran hari penulisannya dan **dibiarkan terbaca sebagai sejarah**; realitanya sudah bergeser sebagian, dan itu harus disebut supaya tidak ada yang mengira §4.17 masih nol:

| Butir | Status baru | Bukti terukur |
|---|---|---|
| Berkas migrasi `0050` | **ADA dan terpasang** | `information_schema.tables` dev → `menu_items`, `menu_permissions`, `parameter_permissions` |
| Padanan Drizzle dua tabel menu | **ADA** | `packages/database/src/schema/menus.ts` (`CHECK`/RLS tetap milik migrasi, pola `parameters.ts`) |
| `GET /api/v1/me/menu` (§4.17.1) | **BERJALAN sebagian** | resolver tiga tahap murni + rute; pohon `demo` **49 baris/32 grant**, `platform` **21/8** (ralat siklus 9, 2026-10-24 — `menu_items` R-2 bertambah enam daun §6.2 dan satu grant platform dipadamkan); `Cache-Control: private, no-store`, `ETag` dari `menuVersion` (terukur `demo`=50, `platform`=22); `registry.unknownRouteKeys = []` |
| Navigasi klien | **DIBACA DARI SERVER** | `top-nav.tsx` memakai `/me/menu`; `PRIMARY_NAV`/`buildNav` dihapus (`RD-32`) |
| `?at=` (rekonstruksi audit) | **DITOLAK, bukan diabaikan** | non-pemegang `audit.log.view` → `403`; pemegang → `422 VALIDATION_FAILED` dengan sebab. Urutan tetap "izin mendahului bentuk" |
| §4.17.2 editor pohon & grant | **TETAP `spec-only`** | `platform.menu.view/manage/grant/revoke` sudah katalog (`permissions`), **nol rute** `/admin/platform/menus/**` |
| `layer=MOBILE` | **MENJAWAB POHON KOSONG** | belum ada baris `MOBILE`/`BOTH`; belum ada konsumen Dart — paritas `AGENTS §3.4` masih terbuka, dan ini dinyatakan, bukan diklaim |
| Drift `role_permissions` DB vs katalog | **DIUJI, bukan diasumsikan** (ralat siklus 9) | pertanyaan kelima `verify:menu`: bandingkan grant tiap peran sistem di DB dengan `SYSTEM_ROLE_GRANTS` — terukur **0 selisih** (1 peran × `platform`, 15 peran × `demo`); sebelum ini `verify:menu` hanya membuktikan pohon = DB sehingga seed `0011` basi bisa lolos selamanya (`RD-180`) |
| Batas §6.8 ditegakkan di HTTP, bukan hanya di pohon | **DIUJI** (ralat siklus 9) | `.tools/e2e-r2-boundary.mjs` **24/24**: dua akun ber-carrier login sama (`tenant_admin`) tetapi beda baris `user_role_assignments` — `admin2` (TENANT_ADMIN murni) ditolak di layar pemilik domain dengan `403` datar atau `404 MODULE_NOT_AVAILABLE` (entitlement memotong lebih dulu, `AGENTS §3.8`), **selalu tanpa `details`**; `admin1` (memegang penugasan `ADMIN_ACADEMIC`) dilayani. Lima rute warisan carrier (`academic/khs/[periodId]`, `academic/transcript`, `academic/krs/open-classes`, `tenant/modules/[code]/activate`, `tenant/modules/[code]/deactivate`) dipindah ke `requireDataPrincipal` |

**Pernyataan norma (baris ini tidak boleh dihapus dari bagian ini).** **Penyaringan menu bukan kontrol akses** (`AGENTS §3.8`, `DATA_MODEL §21.7` keputusan 2). Yang dilakukan §4.17 hanya mengubah **apa yang terlihat**; yang menentukan **apa yang boleh dilakukan** tetap enam lapis L1–L6 di setiap rute (§4.11 butir 1) — L1 transport, L2 identitas dari token, L3 permission berbasis tabel (`requireDataPrincipal`, `SEC-10`), L4 scope (`holdsScoped`, `SEC-11`), L5 state, L6 RLS. Konsekuensi yang mengikat:

1. **Rute tersembunyi tetap 403/404.** Menu yang tidak tampil tidak membuat rutenya boleh ada tanpa gerbang: `POST /api/v1/admin/grades/publish` yang tidak muncul di pohon tetap menolak `403 FORBIDDEN` (3) bila izin tidak dimiliki, dan `404 MODULE_NOT_AVAILABLE` (26) bila modul non-`ACTIVE`/`TRIAL` — **entitlement memotong lebih dulu dari role**, dan helper `withModule` wajib jadi call site nyata (`SEC-09`), bukan hanya fungsi.
2. **Menu yang hilang = tidak dikirim, bukan `visible: false`.** Klien **tidak pernah** menerima pohon lengkap dengan tanda "ini tidak untukmu": itu bocor nama fitur, bentuk hierarki, dan `route_key` milik tenant/peran lain, dan memberi pihak yang tidak berhak peta permukaan untuk diserang. Yang disaring adalah **cabang**, bukan **label**. (Pengecualian terukur dan sadar: layar **editor menu** §4.17.2 untuk peran grant memang melihat seluruh cabang — itu objek kerjanya, dan rutenya di bawah `/admin/platform/**` dengan izin `platform.menu.*` usulan + MFA.)
3. **`menu_permissions` bersifat allowlist per peran dan DENY menang.** Evaluasi deterministik (DATA_MODEL §21.7): DENY atas ALLOW, lalu pola/grant paling spesifik menang, lalu `scope_kind` penugasan membuktikan cakupan (`holdsScoped`), lalu **grant kalah terhadap keputusan servis untuk keadaan state** (periode `LOCKED`, gerbang, cekal). Menu yang **tidak tercantum** = tidak terlihat, bukan terlihat.
4. **Kosakata izin tidak lahir dari layar.** `permission_code` wajib anggota katalog `permissions` (222 kode di `authz.ts`, terukur) → `422 MENU_PERMISSION_UNKNOWN` (116). Kalau ini dilonggarkan, `RBAC_MATRIX.md` berhenti menjadi sumber kebenaran (pola `RD-04`/`G-15`).

#### 4.17.1 Konsumsi pohon — `GET /api/v1/me/menu`

```http
GET /api/v1/me/menu?layer=WEB                      → 200  pohon untuk peminta ini di Web
GET /api/v1/me/menu?layer=MOBILE                   → 200  pohon Mobile (bottom-nav + modul, bisa beda bentuk)
GET /api/v1/me/menu?layer=WEB&at=2026-03-01        → 422  hanya untuk peran audit (rekonstruksi), bukan klien biasa
```

**Server-side filter, tiga input, urutan tetap** (tidak boleh dibalik; tiap tahap memotong cabang yang tersisa):

| Tahap | Saring dengan | Sumber | Bila gagal |
|---:|---|---|---|
| 1 | **Entitlement modul** | `tenant_modules.status ∈ {ACTIVE, TRIAL}` per `menu_items.module_code` | cabang dipotong **diam-diam** (tidak dikirim); rute langsung → `404 MODULE_NOT_AVAILABLE` (26) |
| 2 | **Izin × penugasan ber-scope** | `user_role_assignments` (scope + `valid_to`) → `menu_permissions` (allowlist; DENY menang) → `permissions` | cabang dipotong; rute langsung → `403 FORBIDDEN` (3) atau `403 ADMIN_SCOPE_MISMATCH` (16) untuk scope `SITE` |
| 3 | **Status periode & keadaan** | `academic_periods.status` (`OPEN`/`CLOSED`/`LOCKED`), jendela kalender, flag `requires_mfa` sesi | cabang **tetap tampil** dengan `disabled: true` + `blockedBy[]` (§2.5) — "ada tapi terkunci" adalah informasi sah; "tidak boleh diketahui" bukan |

```typescript
export const MeMenuQuerySchema = z.object({
  layer: z.enum(['WEB', 'MOBILE']).default('WEB')
    .describe("menu_items.layer: WEB|MOBILE|BOTH; BOTH tampil di keduanya. Satu pohon per platform, bukan dua sumber kebenaran"),
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Rekonstruksi pohon pada tanggal itu untuk peran audit; ditolak FORBIDDEN (3) untuk peran lain"),
  depth: z.coerce.number().int().min(1).max(4).default(4).describe("Kedalaman maksimum 4 = uji CI DATA_MODEL §21.8(3)"),
});
```

**Respons `200 OK` (pohon; `route_key`, **bukan** path mentah hasil tempel):**
```json
{
  "success": true,
  "data": {
    "layer": "WEB", "menuVersion": 41, "resolvedAt": "2026-10-20T08:00:00.000Z",
    "tree": [
      { "code": "akademik", "routeKey": "academic.root", "labelKey": "navigation.academic", "label": "Akademik",
        "icon": "ri-graduation-cap-line", "sortOrder": 20, "moduleCode": "academic", "requiresMfa": false, "disabled": false,
        "children": [
          { "code": "akademik.krs", "routeKey": "academic.krs", "labelKey": "navigation.krs", "label": "KRS Online",
            "icon": "ri-draft-line", "sortOrder": 10, "moduleCode": "academic", "requiresMfa": false,
            "disabled": false, "blockedBy": [], "children": [] },
          { "code": "akademik.nilai", "routeKey": "academic.grading", "labelKey": "navigation.khs", "label": "KHS / Nilai",
            "sortOrder": 20, "disabled": true,
            "blockedBy": [ { "code": "PERIOD_CLOSED", "reason": "Periode 2025/2026 Ganjil sedang LOCKED.", "remedyHref": null } ],
            "children": [] }
        ] }
    ],
    "prunedCounts": { "byEntitlement": 3, "byPermission": 11, "byDepthLimit": 0 },
    "registry": { "unknownRouteKeys": [] }
  },
  "meta": { "timestamp": "…", "requestId": "…", "pagination": null }
}
```

| Kontrak | Aturan |
|---|---|
| **`routeKey` adalah kunci registri statis** | Path dibangun dari registri rute aplikasi (`route_keys.ts`, target — hari ini `grep route_key apps/web/src` = 0 hasil). Klien **tidak** merakit URL dari `label`, `code`, atau segmen bebas. `route_key` tak dikenal di tulis admin → `422 MENU_ROUTE_KEY_UNKNOWN` (118); munculnya di respons → `registry.unknownRouteKeys[]` **wajib** kosong, dan itu gerbang CI, bukan hiasan. |
| **Label dua sumber, satu aturan** | `labelKey` menunjuk kunci i18n statis (`navigation.*` di `id.json`/`en.json`) bila ada; `label`/`label_en` DB dipakai bila menu dirawat kampus (`AGENTS §3.5`: string UI di file terpisah — menu custom adalah **data**, bukan string yang di-hardcode di komponen). Klien mendahulukan `labelKey`, fallback `label`. |
| **`prunedCounts`** | Jumlah cabang yang dipotong per tahap — **angka agregat, tanpa nama**. Berguna untuk review RBAC ("kenapa layar saya tinggal 3 menu?") tanpa membocorkan apa yang dipotong. |
| **Urutan deterministik** | `ORDER BY sort_order, code` (sama seperti kamus §4.14.1): `id` UUIDv7 akan mengacak ulang pohon setiap menu baru dibuat, dan menu yang "bergeser" tiap login adalah bug yang terasa di jari pengguna. |
| **Cache** | `Cache-Control: private, no-store` + `Vary: Accept-Language`: pohon adalah turunan (izin × entitlement × state) yang berubah saat penugasan/periode berubah — men-cache-nya 60 dtk berarti menampilkan tombol yang sudah dicabut. Invalidasi event-driven saat `user_role_assignments`/`tenant_modules` berubah (sudah dinormakan `RBAC_MATRIX §4.5` soal cache izin TTL 5 menit; **tree menu tidak boleh memakai TTL itu**). **Ralat implementasi 2026-10-24 (`RD-176`):** `Cache-Control: private, no-store` dan `ETag` TERPASANG, tetapi `Vary: Accept-Language` sengaja TIDAK dikirim — server tidak membaca bahasa sama sekali; respons memuat `labelKey` + `label` + `label_en` sekaligus (baris "Label dua sumber" di atas), sehingga pengalihan bahasa terjadi di klien tanpa refetch. Ini deviasi yang dinyatakan, bukan kelalaian: baris `Vary` tidak berlaku pada objek yang tidak divariasikan. |
| **`requiresMfa`** | Diturunkan dari `menu_items.requires_mfa` (FR-IDT-01: menu tulis-admin) dan **dibuktikan di rute**, bukan di klien. Klien memakai field ini hanya untuk menandai ikon gembok. |
| **Paritas Mobile (`AGENTS §3.4`)** | Web **dan** Flutter memanggil rute yang sama dengan `layer` berbeda. Bottom-nav Mobile adalah subset ber-elasi dari pohon yang sama; **dilarang** punya daftar menu kedua di Dart. Yang berbeda hanya bentuk render, bukan isi. |
| **Read path** | Boleh ke **Replica** (bukan read-your-writes) **kecuali** permintaan datang segera setelah tulis grant — klien mengirim `If-None-Match` yang gagal dan resolver membaca Primary; `menuVersion` dinaikkan pada **setiap** tulis §4.17.2 supaya `ETag` berubah. |

#### 4.17.2 Merawat pohon & grant (admin platform per tenant)

```http
GET    /api/v1/admin/platform/menus?layer=WEB&module=academic&q=nilai   → 200  list §2.4 (seluruh cabang, termasuk tersembunyi)
POST   /api/v1/admin/platform/menus                                     → 201  cabang baru (DRAFT-ish: is_visible=false s/d grant pertama)
GET    /api/v1/admin/platform/menus/{id}                                → 200  detail + grant aktif
PATCH  /api/v1/admin/platform/menus/{id}                                → 200  label/icon/sortOrder/layer/routeKey/isVisible
DELETE /api/v1/admin/platform/menus/{id}                                → 204  hanya bila tidak punya anak & tidak dirujuk grant
PUT    /api/v1/admin/platform/menus/{id}/permissions                    → 200  tulis **seluruh** set grant (allowlist + DENY)
GET    /api/v1/admin/platform/menus/{id}/permissions                    → 200  grant saat ini + peran tersintesis
GET    /api/v1/admin/platform/menus/impact?menuId=…                     → 200  cabang mana yang hilang untuk peran mana
```

```typescript
export const MenuUpsertSchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_.]{1,96}$/).describe("UNIQUE per (tenant, layer, code); titik memisah hierarki, label stabil"),
  parentId: UUIDSchema.nullable().default(null).describe("Diselesaikan ke barisnya di dalam transaksi;anti siklus (115) & kedalaman <= 4"),
  label: z.string().min(1).max(120), labelEn: z.string().max(120).nullable().optional(),
  routeKey: z.string().max(96).nullable().optional().describe("Anggota registri kunci rute (118). NULL sah untuk header/pemisah non-klik"),
  layer: z.enum(['WEB', 'MOBILE', 'BOTH']).default('WEB'),
  moduleCode: z.enum(['identity','academic','teaching','enrollment','attendance','assessment','finance','feeder_pddikti','audit','pmb','cbt','lms','mbkm','thesis','spmi','hr_bkd','parent_portal','graduation','tracer_iku']).nullable().optional()
    .describe("Kosakata 19 modul entitlement (`MODULE_CODES` di packages/contracts/src/entitlement.ts) — bukan string bebas; gerbang entitlement lebih dulu dari role. Ralat 2026-10-24 (`RD-176`): versi pertama daftar ini menulis `feeder`/`parent`/`tracer` yang tidak ada di katalog; nama sebenarnya `feeder_pddikti`/`parent_portal`/`tracer_iku` (satu fisik satu nama, `RD-32`). Izin ber-prefix `settings.*` TIDAK menambah modul baru — `menu_items.module_code` tetap kosong untuk gerbang berbasis peran (`§17.2.6` M-02)"),
  icon: z.string().max(64).nullable().optional().describe("Nama ikon design system (Remix), bukan URL SVG"),
  sortOrder: z.number().int().min(0).max(9999).default(100),
  isVisible: z.boolean().default(false).describe("true hanya boleh setelah grant pertama ada; default false = tidak ada menu tanpa hak"),
  requiresMfa: z.boolean().default(false),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), effectiveTo: z.string().nullable().optional(),
  reason: z.string().min(10).max(500).describe("Wajib untuk setiap tulis grant/menu — audit_logs.before/after"),
  expectedVersion: z.number().int().positive().optional().describe("Optimistic lock; tidak cocok = 409 CONFLICT (12)"),
});
// SERVER_ONLY: id, tenantId, version, createdAt, updatedAt, grantedBy, approvedBy ( bila risk grant butuh VALIDATE )

export const MenuGrantPutSchema = z.object({
  grants: z.array(z.object({
    permissionCode: z.string().max(96).describe("Anggota katalog permissions — kalau tidak, 116"),
    effect: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
    scopeKind: z.enum(['', 'TENANT', 'ORG', 'SITE', 'PROGRAM', 'CLASS']).default('')
      .describe("'' = warisi penugasan peran (bukan 'tanpa batas'): CHECK 0050 memakai '' karena NULL tidak bertabrakan di UNIQUE"),
    note: z.string().min(10).max(500).describe("Wajib untuk DENY; DENY tanpa catatan = temuan review, bukan konfigurasi"),
  })).max(100),
  reason: z.string().min(10).max(500),
});
// PUTwhole-set: grants yang tidak dikirim = dihapus. Tambahan parsial lewat PATCH tidak disediakan
// (satu objek satu bentuk tulis, pola deviasi PUT §4.14.2) karena grant yang "setengah hilang"
// adalah jalan masuk hak tak terduga.
```

| Penjaga | Aturan & baris §2.3 |
|---|---|
| Siklus & kedalaman | `parent_id` membentuk rantai melingkar atau kedalaman > 4 → **`422 MENU_CYCLE` (115)**; `CHECK (parent_id <> id)` (`0050`) hanya menahan siklus satu langkah, sisanya tugas service + resolver rekursif. Server memuat jalur tereduksi (`path[]`) agar klien tidak menelusuri rantai sendiri. |
| Grant menunjuk izin tak dikenal | **`422 MENU_PERMISSION_UNKNOWN` (116)** dengan `details[].permissionCode` + `suggestions[]` (kemiripan lokal atas katalog, **tanpa egress** — hukum zero-API-key `AGENTS §3.9` tetap berlaku di sini). |
| `routeKey` tak dikenal | **`422 MENU_ROUTE_KEY_UNKNOWN` (118)** — registri statis adalah pemilik nama; layar tidak dapat mengarang path. |
| `code` kembar | `409 CONFLICT` (12) atas `UNIQUE (tenant_id, layer, code)`. |
| Hapus | Cabang dengan anak → `409 REFERENCE_IN_USE` (19) dengan `affectedSurfaces[]`; cabang yang masih dirujuk grant → sama; hard delete tidak tersedia untuk node yang punya riwayat — **`isVisible = false`** adalah jalan keluar resmi (mengikuti pola **izin RBAC §4.5 baris 132** `master.item.deactivate`, verba `DELETE` = hapus lunak; bukan baris §2.3). |
| Grant tanpa `reason` | `422 VALIDATION_FAILED` (6) — `reason` wajib; `note` wajib untuk DENY. |
| Hak atas grant | `platform.menu.view` / `.create` / `.update` / `.deactivate` / `.grant.view` / `.grant.manage` — **usulan, nomor 146 ke atas** (penomoran milik `RBAC_MATRIX §4.5` baris **158–161**, terbit 2026-10-20 dengan status `usulan`). `.grant.manage` beraksi **`VALIDATE`** dan menuntut **MFA penulis-admin** (`AGENTS §3.8`: tulis izin/`VALIDATE` untuk peran admin tanpa MFA dilarang). Yang **tidak** diberlakukan di sini, dan itu dinyatakan supaya tidak dikarang kemudian: `approved_by <> requested_by`. Grant menu adalah konfigurasi **satu tenant** milik `TENANT_ADMIN`/`PLATFORM_OPERATOR`, bukan keputusan yang mengubah hak atas gelar atau uang; empat-mata ditegakkan pada **parameter kelas `REGULATORY`/`SECURITY`** (§4.16.3) dan pada izin `parameter_permissions` yang **memang** punya `CHECK` itu di `0050`. Jangan menulis syarat yang tidak ada `CHECK` atau tidak ada baris izinnya. |
| Enam lapis | L1 `strict()` + enum tertutup · L2 identitas dari token (`SEC-07`) · L3 `requireDataPrincipal` · L4 scope `SITE`/`ORG`/`PROGRAM` dibuktikan (`holdsScoped`, `SEC-11`) · L5 `is_visible` + jendela berlaku + grant tersintesis + entitlement modul (26) · L6 RLS `ENABLE`+`FORCE` pada `menu_items`/`menu_permissions` (`DATA_MODEL §21.9`); tidak ada view di gugus ini, jadi tidak ada soal `security_invoker`. |

**Yang tidak disediakan §4.17 (dinyatakan agar tidak ditagih kemudian):** tidak ada rute "publish tree" massal, tidak ada impor menu dari file, tidak ada menu lintas-tenant (template sistem dilayani **seed migrasi**, bukan endpoint), dan **tidak ada** endpoint yang mengembalikan pohon penuh sebuah tenant untuk peran non-grant. Semua itu bukan kelalaian: masing-masing menciptakan sumber kebenaran kedua atau permukaan bocor.

#### 4.17.3 Kode error §4.17: baru vs dipakai ulang

| Baris | Kode | Kapan di gugus ini | Status |
|---:|---|---|---|
| 115 | `MENU_CYCLE` | `parent_id` melingkar atau kedalaman > 4 | `spec` |
| 116 | `MENU_PERMISSION_UNKNOWN` | `permission_code` tidak ada di katalog; dipakai **bersama** grant parameter §4.16.4 | `spec` |
| 118 | `MENU_ROUTE_KEY_UNKNOWN` | `route_key` tidak ada di registri rute statis | `spec` |
| dipakai ulang | 3 (`FORBIDDEN`), 5 (`NOT_FOUND`), 6 (`VALIDATION_FAILED`), 12 (`CONFLICT` — `expectedVersion`, `UNIQUE (tenant, layer, code)`), 16 (`ADMIN_SCOPE_MISMATCH` — scope `SITE`), 19 (`REFERENCE_IN_USE` — cabang/grant dirujuk), 25 (`PERIOD_CLOSED` — cabang periode terkunci, `disabled: true` bukan hilang), 26 (`MODULE_NOT_AVAILABLE` — entitlement memotong lebih dulu), 38 (`GATE_BLOCKED` — `blockedBy[]` §2.5), 46 (`DUPLICATE_SUBMIT`), 55 (`DECISION_ALREADY_MADE` — grant sudah terminal), 56 (`SELF_APPROVAL_FORBIDDEN` — hanya untuk aksi `VALIDATE` yang memakainya) | lihat §2.3 butir 7 | — |
| alias kalah | `MENU_PARENT_NOT_FOUND` → **5** · `MENU_PERMISSION_MISSING` → **116** · `ROUTE_NOT_FOUND` sebagai kode error → **26/5** sesuai sebab (entitlement vs tidak ada) | daftar lengkap §2.3 butir 8 | — |

**Ketergantungan yang harus disebut dengan status benar:** seluruh §4.17 menahan diri pada **Postgres + resolver in-process**. **Tidak ada** yang bergantung Redis/BullMQ di sini, jadi tidak ada klaim antrean. Cache pohon per (tenant, versi) adalah memori worker; kalau nanti diangkat menjadi Redis, itu **design-only** sampai `ioredis` menjadi dependensi nyata (`RD-11`, `P-6`).

---

### 4.18 Presensi multi-modus & rekonsiliasi dua sumber (luring + daring paralel) — 2026-10-20

**Status: `spec-only` seluruh §4.18.** Ini perluasan §4.3 (§4.3.6 Tantangan, §4.3.7 `scan`, §4.3.8 banding, §4.3.9 aturan lintas mekanisme) dan **tidak** menggantikannya — yang diulang di sini hanya **kontrak baru**; vonis lama §4.3 tetap berlaku penuh. Terukur 2026-10-20: (a) rute presensi yang hidup **dua** — `POST /attendance/qr/generate` dan `POST /attendance/qr/scan` (`find apps/web/src/app/api/v1 -name route.ts` = 18 berkas); **`/attendance/events/**`, `/attendance/{sessionId}/reconciliation`, dan `/webhooks/**` tidak ada** (prefix `webhooks` pun belum pernah ada di `apps/web/src/app/api/v1`); (b) `packages/database/migrations/` = 7 berkas (`0001`–`0006`, `0011`) — `attendance_evidence`, `attendance_source` dua nilai baru, dan `master_system_parameters` ada di **`0049`** yang **DDL-nya ditulis** `DATA_MODEL §21.2`/`§21.5` dan **belum berberkas**; (c) `grep -rn "ratio\|evidence" packages/database/src/schema/enrollments.ts` = 0 → **tidak ada satu pun kolom bukti durasi** hari ini; (d) izin `attendance.event.ingest` / `attendance.reconciliation.view` / `attendance.reconciliation.decide` **belum menjadi baris mana pun** di `RBAC_MATRIX §4.5` (register itu mencapai **161** pada saat kalimat ini ditulis (jumlah hari ini dicetak `node .tools/rbac-count.mjs`, tidak disalin ke dokumen), tetapi baris 146–161 adalah gugus parameter & menu, bukan presensi; attendance §4.2 hanya memuat `qr.generate`, `qr.scan`, `record.view/create/update`, `call.view/write`, `summary.view`).

**Pemilik nama (tidak dinegosiasikan di sini).** `attendance_evidence` + kolom + insert-only + perluasan enum `attendance_source` (`LMS_ACTIVITY`, `WEBHOOK_EVENT`) + kosakata `learning_modality`/`session_kind` + `CHECK` = [DATA_MODEL §21.4](file:///c:/SICA/docs/DATA_MODEL.md)/§21.5 (`0049`). Kebijakan otoritatif kanal daring & batas kredensial vendor = `DATA_MODEL §21.6` + `ADR-11` + `AGENTS §3.9` (nol-API-key, nol egress PII). Kode izin = `RBAC_MATRIX §4`. **Path, bentuk respons, skema Zod, urutan rekonsiliasi, dan kode error = bagian ini.**

**Empat hal yang ditetapkan lebih dulu agar tidak diperdebatkan per rute:**

1. **Satu baris `attendances` per (sesi, mahasiswa)** — `uq_attendances_session_student` (`packages/database/src/schema/enrollments.ts:92-94`, nyata hari ini) adalah **invariance akhir** di bawah kebijakan apa pun: `ONSITE_PRIMARY`, `ONLINE_PRIMARY`, `MERGE_ANY`, `REQUIRE_BOTH`, `STRICT_LATEST` hanya mengubah **bagaimana satu baris itu divonis**, tidak pernah berapa barisnya. CI `DATA_MODEL §21.8(6)` menuntut 0 duplikat.
2. **Bukti tambahan tidak pernah menjadi kolom kedua di `attendances`.** Semuanya `attendance_evidence(source, occurred_at, duration_s, ratio, digest, device_digest, vendor, credential_ref, event_digest)` — **insert-only**, satu-satunya permukaan tulis adalah §4.18.2/§4.18.3, tidak ada `PATCH`/`DELETE` untuk bukti.
3. **Rasio dihitung server dari log peristiwa, bukan dari klaim klien.** Angka yang dikirim perangkat/vendor masuk sebagai **klaim diagnostik**; vonis memakai selisih join/leave dan heartbeat 60 detik milik kanal internal (`DATA_MODEL §21.5`).
4. **Vendor bukan oracle tunggal.** Laporan Zoom/Meet/Teams bersifat **pendukung**; kehadirannya **tidak pernah** cukup untuk menandai `PRESENT` (`DATA_MODEL §21.6` butir 3). Kredensial vendor hidup di **vault/ENV** — **design-only** (tidak ada dependensi vault di `package.json` hari ini) dan **tidak pernah** lewat parameter (`111`).

#### 4.18.1 Jalur luring — `POST /api/v1/attendance/scan` (tetap; §4.3.7 adalah kontraknya)

Rute, badan, delapan langkah verifikasi berurutan, dan muatan respons **tidak diubah di sini**; lihat §4.3.7. Yang ditambahkan §4.18 hanya **dua pembacaan server-side**, supaya tidak ada dua cerita tentang satu sesi:

| Aspek | Aturan |
|---|---|
| Modus sesi | `class_sessions.learning_modality` + `session_kind` **dibaca server** saat verifikasi (hasil `0049`); **tidak pernah** diambil dari body. Scan atas sesi `learning_modality = 'ONLINE'` dengan `session_kind = 'SYNC_LIVE'` **sah** (peserta di ruang ujian boleh memindai) — yang ditentukan kebijakan adalah apakah bukti luring **menang**, bukan apakah scan boleh masuk |
| Ambang & flag | `attendance.geofence_default_radius_m` (baku 50, rentang 10–500), `attendance.gps_max_accuracy_m` (baku 50, rentang 5–200), `attendance.challenge_required` (baku `true`), `attendance.totp_rotate_seconds` (5; sah 5/10/15), `attendance.totp_window_steps` (1; 0–2) — semuanya lewat resolver **§4.16.5 di sisi server**. Konstanta hari ini (`ttlSeconds = 30`, `radius min 10 max 500 default 50` di `attendance/qr/generate/route.ts:29,65`) adalah **pengganti sementara yang tercatat**, bukan keadaan final |
| Hasil tulis | Satu baris `attendances` + **satu baris `attendance_evidence(source='QR')`** berisi `digest` (HMAC atas `(sessionId, counter, studentId)`), `device_digest`, `occurred_at` milik server. Scan yang **ditolak** tidak menyentuh keduanya; ia tercatat di `attendance_token_uses` (`0041`, vonis enum tertutup milik DATA_MODEL — lihat §4.3.9 butir 2 dan §6.10.6) |

#### 4.18.2 Peristiwa LMS internal — `POST /api/v1/attendance/events/lms`

Kanal **otoritatif** untuk `SYNC_LIVE`/`ASYNC_MODULE`: peristiwa join/leave/heartbeat dari **SICA Virtual Campus milik sendiri** (BigBlueButton/Jitsi yang di-*self-host*; tanpa kunci API, tanpa egress PII — `ADR-11`, `AGENTS §3.9`).

```http
POST /api/v1/attendance/events/lms                 → 201  bukti diterima (bukan vonis)
POST /api/v1/attendance/events/lms                 → 200  duplikat jendela yang sama: data.replayed = true
```

```typescript
export const LmsAttendanceEventSchema = z.object({
  sessionId: UUIDSchema.describe("Diselesaikan ke class_sessions milik tenant DI DALAM transaksi sebelum INSERT (anti-IDOR §4.11 butir 3)"),
  studentRef: z.string().min(6).max(128)
    .describe("Hanya untuk ingest by-service (principal kanal) / impor oleh peran dengan hak record. Bila dipanggil mahasiswa (SELF), field ini DIBUANG dan studentId diambil dari token — kehadiran dirinya sendiri tidak dapat dititipkan"),
  event: z.enum(['JOIN', 'LEAVE', 'HEARTBEAT', 'SUMMARY']),
  occurredAt: TimestampSchema.describe("Waktu kanal; keputusan memakai waktu server. Selisih > finance.webhook_max_clock_skew_s = tolak (bukan koreksi diam-diam)"),
  durationSec: z.number().int().min(0).max(6 * 3600).optional()
    .describe("Klaims durasi dari kanal (JOIN..LEAVE, atau watch-time ASYNC). DISIMPAN sebagai ratioClaimed untuk diagnostik; TIDAK pernah menjadi dasar vonis sendirian"),
  ratio: z.number().min(0).max(1).optional()
    .describe("Klaim rasio (0..1) — hanya untuk event=SUMMARY. Server MENGHITUNG ULANG dari log join/leave/heartbeat; selisih > 0.05 dikirim sebagai discrepancy, bukan dipakai"),
  channelKind: z.enum(['SELF_HOSTED_ROOM', 'ASYNC_MODULE']),
  channelRef: z.string().max(128).nullable().optional().describe("id ruangan/modul di kanal; TIDAK pernah URL join dan TIDAK pernah nama peserta"),
  deviceDigest: z.string().max(128).nullable().optional().describe("installDigest ter-hash; tidak pernah deviceId polos"),
  eventDigest: z.string().min(16).max(128).describe("HMAC atas (tenant, session, studentRef, event, occurredAt-menit) — kunci dedup kanonis"),
});
// DILARANG di body (kehadiran = 422 VALIDATION_FAILED (6), bukan diabaikan):
//   studentId, tenantId, markedBy, status, attendanceStatus, ratioComputed, secret, joinUrl,
//   participantName, email, transcript, recordingUrl, approvalToken
// reason/decision/vendor TIDAK diterima: vendor hanya lewat §4.18.3 (kanal bertanda tangan)
```

**Kunci idempotensi logis** — empat komponen, satu keadaan: **`(tenant, session, student, source, eventWindow)`** dengan `eventWindow` = `date_trunc('minute', occurred_at_server)` untuk `HEARTBEAT`/`JOIN`/`LEAVE` dan `date_trunc('hour', …)` untuk `SUMMARY` (satu ringkasan per jam per sumber). Ejaan kolom + `UNIQUE` final **milik `DATA_MODEL §21` (`0049`)**; kalau constraint-nya belum ada di sana, permintaan ditutup di dokumen itu lebih dulu — **bukan** ditambal dengan `SELECT … FOR UPDATE` per peristiwa (`AGENTS §3.7` menolak itu di jalur panas). Replay pada jendela yang sama → **`200` dengan `data.replayed: true` dan tanpa baris bukti kedua** (bukan `409`): kanal yang mengirim ulang peristiwa yang sama adalah perilaku normal, bukan kesalahan klien. `Idempotency-Key` (`§4.2.14`) tetap diminta pada `SUMMARY` (payload besar, kemungkinan retry nyata); kunci sama + payload beda → `409 DUPLICATE_SUBMIT` (46).

**Respons `201 Created`** (amplop §2.1; ini **bukan** vonis kehadiran):
```json
{
  "success": true,
  "data": {
    "evidenceId": "0198…", "sessionId": "0197…", "source": "LMS_ACTIVITY", "event": "HEARTBEAT",
    "eventWindow": "2026-10-20T08:14:00Z", "acceptedAt": "2026-10-20T08:14:31Z",
    "replayed": false, "ratioClaimed": null,
    "computation": { "ratioComputed": null, "computedAt": null, "state": "AWAITING_CLOSURE" },
    "modality": { "learningModality": "ONLINE", "sessionKind": "SYNC_LIVE" },
    "threshold": { "key": "attendance.online_min_join_ratio", "value": 0.75, "version": 1, "riskClass": "ACADEMIC" }
  },
  "meta": { "timestamp": "…", "requestId": "…", "auditId": "0198…" }
}
```
> `ratioComputed` **kosong saat peristiwa masuk** dan dihitung saat sesi ditutup/`SUMMARY` tiba — `state: AWAITING_CLOSURE` menyatakan itu apa adanya. `threshold` ikut dikirim supaya layar dapat menyebut ambang + `version`-nya (keputusan harus dapat direproduksi, pola harness §6.2: `parameter_version`). Angka tidak pernah disembunyikan, dan tidak pernah pula dinyatakan lebih dulu.

**Penjaga §4.18.2:**

| Penjaga | Aturan & baris §2.3 |
|---|---|
| Principal | Ingest otomatis hanya oleh **service principal kanal** (peran sistem, `X-Channel-Signature` milik kanal internal + token pendek sekali-pakai, pola §4.2.14 `stream-ticket`), atau oleh peran dengan `attendance.record.create` untuk impor. **Mahasiswa tidak dapat mengirim peristiwa untuk mahasiswa lain** — `studentRef` dibuang bila `SELF` |
| Kepemilikan | `sessionId` → `class_sessions` (tenant) → `enrollments` aktif pada kelas itu. Mahasiswa tak terdaftar → `403 NOT_YOUR_CLASS` (41); sesi punya `studentId` lain di `studentRef` → `403 NOT_YOUR_STUDENT` (48) |
| Periode & jendela | Ingestion bukti **tidak** diikat ke `academic_periods.status = 'OPEN'`: sesi yang periodenya sudah `CLOSED`/`LOCKED` masih menerima peristiwa dengan `occurred_at` di dalam jendela sesi (kewajiban arsip BR-R12 — menolak bukti hanya karena kalender bergeser akan menghilangkan jejak yang justru diminta auditor). Yang **ditolak** pada periode terkunci adalah **vonis manual** §4.18.4 → `423 PERIOD_CLOSED` (25) |
| Tipe & bentuk | `ratio` di luar 0..1, `durationSec` > 6 jam → `422 VALIDATION_FAILED` (6) (field gugus ini, bukan `PARAM_INVALID_TYPE` — 109 milik nilai parameter) |
| Waktu | Selisih jam kanal vs server > `finance.webhook_max_clock_skew_s` (baku 300, maks 300) → **ditolak tanpa penyimpanan** dengan `200 {ignored: "CLOCK_SKEW"}`; mengirim `4xx` membuat kanal retry selamanya (preseden §4.7.3) |
| Skema belum ada | Selama `attendance_evidence` belum ada (`0049` belum berberkas), rute ini **tidak dapat dibuka**; kalau dipaksa dalam keadaan itu, jawabannya **`503` dengan `Retry-After`** dan **tanpa** menyimpan apa pun — **bukan** menerima lalu membuang. Penolakan kehilangan bukti adalah hal yang berbeda dari `422` milik pemanggil: ini kegagalan infrastruktur, dan register §2.3 tidak punya baris khusus untuknya (calon pemakai paling dekat: 88 `ATTENDANCE_TOKEN_STORE_UNAVAILABLE` untuk penahan sekali-pakai, yang **tidak** boleh dipakai untuk alasan berbeda objeknya) |

#### 4.18.3 Kanal webhook vendor — `POST /api/v1/webhooks/lms/{provider}`

Opsional, **pendukung**, dan dibatasi sampai ke kawatnya. Provider sah ∈ `zoom · google_meet · microsoft_teams · bbb · jitsi` (`bbb`/`jitsi` = self-hosted → kanal **internal** §4.18.2 lebih dulu; webhook vendor hanya pelengkap bila kampus berlangganan).
> **Kosakata slug = `lower(conference_provider)`** (`DATA_MODEL §21.10.1`): `builtin_lms · bbb · jitsi · google_meet · microsoft_teams · zoom`. Daftar di kalimat di atas bukan kosakata ketiga — ia turunan enum, dan `0075` memetakan `microsoft_teams` lama yang tertulis `TEAMS` di kolom. 

```http
POST /api/v1/webhooks/lms/zoom        → 200 ACK  (selalu, kecuali pembukti gagal — lihat tabel)
POST /api/v1/webhooks/lms/bbb        → 200 ACK  (peristiwa internal yang datang lewat HTTP, bentuk sama)
```

**Empat penjaga, urutan tetap, semua gagal-closed:**

| # | Penjaga | Aturan | Hasil bila gagal |
|---:|---|---|---|
| 1 | **Signature / HMAC** | Header `X-Webhook-Signature` (HMAC-SHA256 atas **body mentah**, bytes persis seperti diterima — bukan hasil re-serialisasi JSON) dengan secret kanal dari **vault/ENV** (`payment_channels.webhook_secret_ref` adalah pola yang sama, §4.7.1). Perbandingan **constant-time**, guard panjang mengikuti §4.7.2. **Tidak pernah** `===` dan tidak pernah `timingSafeEqual` tanpa cek panjang (itu `RD-26`) | **`401 UNAUTHORIZED`** (1) — preseden **sudah divonis di §4.7.2** ("signature gagal tetap baris 1"); `WEBHOOK_SIGNATURE_INVALID` **kalah** sebagai kode kedua (§2.3 butir 8) |
| 2 | **Umur / skew** | `X-Webhook-Timestamp` diuji terhadap **`finance.webhook_max_clock_skew_s`** (baku 300; kelas `TECHNICAL`, §4.16.5). Nilai **tidak pernah** dibaca dari body dan **tidak pernah** dari config keras per vendor | **`200 {ignored: "CLOCK_SKEW"}`** tanpa mutasi — ACK supaya vendor berhenti retry (§4.7.3 alasan persis sama); sebagai *kode error* keadaan ini **kalah** ke baris 117 di permukaan pembacaan (§2.3 butir 8) |
| 3 | **Allowlist payload** | Klien/vendor **hanya** boleh mengirim `{ event, userRef, duration, sessionId }` (empat kunci; plus `payloadVersion` untuk `bbb`/`jitsi`). Zod `strict()` + **sebelum parsing** kunci luar dihapus: yang tersisa hanya empat field itu. Nama peserta, email, rekaman, transkrip, pertanyaan kuis = **egress PII** bila dikirim kembali ke vendor → **tidak pernah** disimpan, **tidak pernah** diteruskan, **tidak pernah** masuk log | **`200 {ignored: "PAYLOAD_NOT_ALLOWEDLIST"}`** + meter `webhook_rejects_total{provider,reason}`; kunci yang **dibutuhkan** tidak ada → `422 VALIDATION_FAILED` (6). Tidak ada kode error baru: penolakan bentuk payload adalah keadaan ACK, bukan permintaan pengguna |
| 4 | **Resolusi identitas** | `userRef` vendor **tidak pernah** dicocokkan dengan nama atau email (itu oracle PII dan sumber salah vonis). Masalah terukur: **tidak ada satu pun** objek penampung tautan `userRef → student` di skema hari ini **dan** `DATA_MODEL §21` tidak mendefinisikannya (`attendance_evidence` hanya menyimpan `vendor` + `credential_ref` + `event_digest`). Karena itu kontrak ini menetapkan: **selama tautan tidak ada, kanal vendor hanya dapat menyimpan `event_digest` untuk audit transport dan TIDAK dapat menghasilkan baris `attendance_evidence` kehadiran.** Permintaan penutupan (`…_vendor_identity_bindings` atau padanannya, dengan `UNIQUE (tenant, provider, user_ref_hash)` + RLS) adalah tagihan ke `DATA_MODEL`, bukan sesuatu yang boleh dikarang rute ini | **`200 {ignored: "IDENTITY_UNBOUND"}`** + meter; layar admin menawarkan pengikatan. `IDENTITY_UNBOUND` adalah **token `ignored`**, bukan baris §2.3 — dan bukan `403`/`404` karena webhook anonim tidak boleh diberi tahu apakah suatu objek ada |

**Yang dilakukan setelah pembuktian:** satu `INSERT` baris `attendance_evidence` dengan `source = 'WEBHOOK_EVENT'`, `vendor = <provider>`, `credential_ref = <nama kunci vault, BUKAN nilainya>`, `event_digest`, `duration_s`, `occurred_at`, `ratio` **NULL** (vendor tidak memberi denominator durasi sesi yang sah — rasio hanya dihitung dari kanal internal). **Tidak ada** `UPDATE attendances` dari webhook: jalur tulis ke baris presensi hanya lewat service rekonsiliasi §4.18.4 pada penutupan sesi, **atas nama** kebijakan, bukan atas nama payload. `finance.webhook_reconcile_timeout_s` (baku 30) adalah batas waktu **menunggu** rekonsiliasi sebelum sesi dilaporkan apa adanya (`degraded` di layar, bukan angka ditebak).

**Larangan keras gugus ini (satu baris, jangan dinegosiasikan):** menjadikan laporan vendor satu-satunya oracle (`DATA_MODEL §21.6` butir 3) — ditolak **`422 EVIDENCE_INSUFFICIENT`** (117); mengirim transkrip/rekaman/nama lengkap ke vendor untuk "analisis" — **egress PII**, pelanggaran UU PDP (`SECURITY §7`); API kewujudan/wajah berbayar — **sudah ditolak** `DATA_MODEL §21.6` butir 3 & `AGENTS §3.9`; menyimpan secret kanal sebagai baris parameter — `422 PARAM_SECRET_FORBIDDEN` (111).

#### 4.18.4 Rekonsiliasi — `GET /api/v1/attendance/{sessionId}/reconciliation`

```http
GET /api/v1/attendance/0197…/reconciliation                      → 200  keadaan rekonsiliasi satu sesi
GET /api/v1/attendance/0197…/reconciliation?verdict=PENDING_REVIEW   → 200  hanya yang menunggu keputusan
GET /api/v1/attendance/0197…/reconciliation?at=2026-10-20T09:00:00Z  → 200  rekonstruksi (BR-R12)
```

```typescript
export const ReconciliationQuerySchema = z.object({
  verdict: z.enum(['ALL', 'PENDING_REVIEW', 'PRESENT', 'EXCUSED', 'ABSENT', 'ABSENT_LATE', 'SICK']).default('ALL'),
  at: z.string().datetime().optional().describe("Rekonstruksi keputusan pada titik waktu — wajib untuk banding & laporan periode lalu"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
// Tidak ada filter "policy": kebijakan dibaca dari parameter, bukan dipilih pemanggil.
```

**Respons `200 OK`** (list §2.4 — satu baris per (sesi, mahasiswa); `data[]` muat `enrollmentCount` mahasiswa yang berhak hadir):
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "0197…", "studentId": "0196…", "nim": "2024-…",
      "modality": { "learningModality": "BLENDED", "sessionKind": "SYNC_LIVE" },
      "policy": { "key": "attendance.multi_source_policy", "value": "ONSITE_PRIMARY",
                  "enumKind": "kebijakan_rekonsiliasi", "version": 1, "riskClass": "ACADEMIC", "resolvedFrom": "TENANT_PARAM" },
      "decision": { "status": "PRESENT", "decidedBy": "POLICY", "decidedAt": "2026-10-20T09:31:02Z",
                    "attendingRowId": "0196…", "rule": "ONSITE_EVIDENCE_EXISTS" },
      "evidence": [
        { "source": "QR", "occurredAt": "2026-10-20T08:01:12Z", "durationSec": null, "ratio": null,
          "deviceDigest": "9c1f…", "digest": "a7…", "vendor": null, "credentialRef": null, "authoritative": true },
        { "source": "LMS_ACTIVITY", "occurredAt": "2026-10-20T08:03:40Z", "durationSec": 8280, "ratio": "0.9200",
          "ratioClaimed": "0.9100", "discrepancy": "0.0100", "digest": "b3…", "vendor": "SELF_HOSTED_BBB", "authoritative": false },
        { "source": "WEBHOOK_EVENT", "occurredAt": "2026-10-20T08:02:11Z", "durationSec": 8340, "ratio": null,
          "digest": "e1…", "vendor": "ZOOM", "credentialRef": "vault:lms/zoom/tenant-4f19", "authoritative": false,
          "sufficiency": "SUPPORTING_ONLY" }
      ],
      "pendingReview": null
    },
    {
      "sessionId": "0197…", "studentId": "0196…", "nim": "2024-…",
      "modality": { "learningModality": "BLENDED", "sessionKind": "SYNC_LIVE" },
      "policy": { "key": "attendance.multi_source_policy", "value": "REQUIRE_BOTH", "version": 2, "riskClass": "ACADEMIC", "resolvedFrom": "SCOPE_PARAM" },
      "decision": { "status": null, "decidedBy": "POLICY", "rule": "AWAITING_SECOND_SOURCE", "attendingRowId": null },
      "evidence": [
        { "source": "LMS_ACTIVITY", "occurredAt": "2026-10-20T08:03:40Z", "durationSec": 8280, "ratio": "0.9200", "authoritative": true },
        { "source": "WEBHOOK_EVENT", "occurredAt": "2026-10-20T08:02:11Z", "durationSec": 8340, "authoritative": false, "sufficiency": "SUPPORTING_ONLY" }
      ],
      "pendingReview": { "reason": "QR_BSSID_EVIDENCE_MISSING", "appealHref": "/attendance/appeals?sessionId=0197…", "decideHref": null }
    }
  ],
  "meta": { "timestamp": "…", "requestId": "…", "pagination": { "page": 1, "limit": 50, "totalRecords": 38, "totalPages": 1, "hasNextPage": false, "hasPrevPage": true } }
}
```

**Tabel keputusan kanonis — apa yang dilakukan tiap kebijakan, dan apa yang **tidak** pernah dihasilkannya:**

| `attendance.multi_source_policy` | Aturan vonis | Baris `attendances` | Muatan wajib di respons |
|---|---|---|---|
| `ONSITE_PRIMARY` (baku) | Bukti luring (`QR`/`GEOFENCE`) menang; bukti daring **hanya** tercatat sebagai `evidence` | **satu** | `authoritative: true` pada bukti luring; `sufficiency: "SUPPORTING_ONLY"` pada bukti daring |
| `ONLINE_PRIMARY` | `ratioComputed ≥ attendance.online_min_join_ratio` (baku 0.75) menang; QR menjadi bukti tambahan | **satu** | `ratioComputed`, `ratioClaimed`, `discrepancy`, ambang + `version` |
| `MERGE_ANY` | Salah satu bukti cukup; **satu** baris `attendances`, `attendances.source` mencatat `QR+LMS` (gabungan) | **satu** | daftar sumber tergabung + sumber pertama yang diterima |
| `REQUIRE_BOTH` | Dua bukti wajib (luring + kanal internal). Satu bukti saja → **bukan** `ABSENT`, bukan `PRESENT`: status `PENDING_REVIEW` | **satu** (dengan `status` keadaan tunggu) + banding | `pendingReview.reason` + `appealHref` (§4.3.8) |
| `STRICT_LATEST` | Bukti terakhir menang — **hanya** lewat aksi `VALIDATE` dengan alasan (koreksi dosen), tidak pernah otomatis | **satu** | `rule: "MANUAL_OVERRIDE"` + `decidedBy: <actor>` + tautan riwayat; menolak tanpa `VALIDATE` = `403 FORBIDDEN` (3) |

| Kontrak | Aturan |
|---|---|
| **`PENDING_REVIEW` bukan enum baru `attendance_status`** | Ia **keadaan rekonsiliasi**, dikirim sebagai `decision.status: null` + `pendingReview.*`. Kolom `attendances.status` tetap lima nilai `attendance_status` (`packages/database/src/schema/enums.ts:128-134`) — perluasan enum adalah **milik `DATA_MODEL §15`**, bukan keputusan dokumen ini (pola §4.3.9 butir 2 dan baris 102). Kalau keadaan tunggu butuh persistensi, rumahnya `attendance_evidence` + hasil turunan, **bukan** nilai keenam yang dikarang di kontrak API |
| **Vonis = service pada penutupan sesi, bukan pembacaan** | `GET` ini **proyeksi**; yang **menulis** satu baris `attendances` adalah worker penutupan sesi (batch flush per `AGENTS §3.7`, idempoten per (sesi, mahasiswa)). Read-only karena itu boleh ke **Replica**; `?fresh` setelah aksi `decide` wajib Primary |
| **Aksi keputusan** | `POST /api/v1/attendance/{sessionId}/reconciliation/{studentId}/decide` body `{ decision: "PRESENT" \| "EXCUSED" \| "SICK" \| "ABSENT_LATE" \| "ABSENT", reason (10–500), evidenceIds[] }` — verba **`VALIDATE`**, hanya pengampu kelas (scope `CLASS`, `class_assignments`) atau `ADMIN_ACADEMIC` dengan scope, **≠** pemohon banding (56), sudah diputus → (55), periode terkunci → (25). Menulis `marked_by`, `source = 'MANUAL'`, `notes`, riwayat + `audit_logs` + `meta.auditId`; **bukan** `UPDATE` bebas status (§4.3.8 butir "Efek approve") |
| **Anti-oracle** | Respons tidak pernah memuat `joinUrl`, nama peserta versi vendor, email, atau isi pertemuan. `credentialRef` = **nama kunci**, bukan nilai. Tidak ada field yang membocorkan mahasiswa lain pada permintaan `SELF` |
| **Ambang & version selalu ikut** | `policy.version` + `threshold.version` tampil di setiap baris: laporan yang menyebut "0.75" tanpa `parameter_version` tidak dapat direproduksi — dan itu standar yang sudah ditetapkan harness §6.2, diterapkan ke presensi |
| **Kapasitas** | Sesi 200 peserta × 3 sumber = ratusan baris bukti per sesi; daftar **dipaginasi per mahasiswa**, bukan per bukti, dan `evidence[]` dimuat per baris. `EXPLAIN (ANALYZE, BUFFERS)` atas `attendance_evidence(tenant_id, session_id, occurred_at)` adalah gate CI (`AGENTS §3.7`: indeks domain ber-`tenant_id` pertama) |

#### 4.18.5 Kode error §4.18: baru vs dipakai ulang

| Nomor | Kode | Pemakaian di §4.18 | Status |
|---:|---|---|---|
| 117 | `EVIDENCE_INSUFFICIENT` | Permintaan konversi bukti vendor-only menjadi hadir; rasio di bawah ambang saat vonis dipaksa; `REQUIRE_BOTH` dengan satu bukti yang diajukan sebagai "sudah hadir" | `spec` — objek `0049` (`attendance_evidence` + dua nilai `attendance_source`), berkas belum ada |
| tetangga | 115 (`MENU_CYCLE`), 116 (`MENU_PERMISSION_UNKNOWN`), 118 (`MENU_ROUTE_KEY_UNKNOWN`) | **milik §4.17**, dijelaskan di **§4.17.3** — tidak diulang di sini agar satu baris punya satu rumah penjelasan | `spec` |
| dipakai ulang | 1 (`UNAUTHORIZED` — signature webhook LMS gagal, preseden §4.7.2) · 3 · 5 (provider/`sessionId` tak dikenal) · 6 (field di luar allowlist payload, `ratio` di luar 0..1) · 7 (`ACADEMIC_RULE_VIOLATION` — aturan lintas field modus × kebijakan; juga calon rumah `POLICY_CONFLICT` yang **kalah**) · 9 (rate limit per kanal) · 12 (`CONFLICT` — `event_digest` kembar beda payload) · 25 (`PERIOD_CLOSED` — vonis manual pada periode terkunci) · 26 (`MODULE_NOT_AVAILABLE` — modul `lms` non-`ACTIVE`) · 29 (`APPEAL_WINDOW_CLOSED`) · 41/48 (`NOT_YOUR_CLASS`/`NOT_YOUR_STUDENT`) · 46 (`DUPLICATE_SUBMIT`) · 55 (`DECISION_ALREADY_MADE`) · 56 (`SELF_APPROVAL_FORBIDDEN`) · 60/61/62/63/64 (vonis scan luring, §4.3.7) · 84/85/86/87/102/103 (ALG-12, §6.10.6) · 88 (`ATTENDANCE_TOKEN_STORE_UNAVAILABLE`, design-only) · 107–114 dan 116 (ambang dibaca sebagai parameter & grant-nya, §4.16) · 111 (secret kanal dicoba menjadi parameter) · 113 (`PARAM_APPROVAL_REQUIRED` — mengubah `attendance.multi_source_policy` butuh persetujuan sebelum berlaku) | lihat §2.3 butir 7 | — |
| alias kalah | `WEBHOOK_SIGNATURE_INVALID` → **1** · `WEBHOOK_CLOCK_SKEW` (sebagai kode) → **pola ACK §4.7.3** + 117 di permukaan pembacaan · `ATTENDANCE_DUPLICATE_EVIDENCE` → **62/12** (satu keadaan, satu kode) · `POLICY_CONFLICT` → **7** · `ONLINE_RATIO_BELOW_THRESHOLD` sebagai kode kedua → **117** (yang membedakan: muatan `details[].ratio`/`threshold` yang membedakan, bukan kode baru) | §2.3 butir 8 | — |

#### 4.18.6 Butir jujur, i18n, dan paritas Mobile

1. **Tidak ada satu pun rute §4.18 ada hari ini**, kecuali §4.18.1 yang menunjuk §4.3.7 yang **juga belum ada** (`/attendance/scan` adalah path final; yang hidup `qr/scan`). Semua baris adalah target.
2. **Penampung belum ada.** Tanpa `attendance_evidence` (`0049` belum berberkas) tidak ada tempat menyimpan rasio/durasi/digest; karena itu §4.18.2 **wajib** menolak dengan `503`, bukan menerima-atau-membuang. Ini bukan formalitas: ingestion yang sukses di layar dan hilang di DB adalah cara sistem kehilangan bukti saat banding dibuka.
3. **`attendances` belum punya kolom token** (§4.3.9 butir 2) — dan kolom usulan itu **bukti**, bukan penahan sekali-pakai; penahan tetap `attendance_token_uses` (`0041`).
4. **Kunci idempotensi logis §4.18.2 menuntut `UNIQUE` nyata di `0049`.** Kalau constraint itu belum ada di sana, **permintaan penutupannya milik `DATA_MODEL`**, dan sampai ada, klaim "idempoten per (session, student, source, eventWindow)" adalah **kontrak yang belum ditegakkan** — bukan sifat sistem. Ditulis di sini supaya tidak dibaca sebagai sudah jadi.
5. **Design-only, dinyatakan tanpa ambigu:** `bullmq`/`ioredis` (worker penutupan sesi, batch flush, rate limit kanal) — **bukan** dependensi hari ini (`RD-11`, `P-6`); **vault** untuk secret kanal vendor — belum ada; **egress** ke vendor untuk mengambil laporan peserta = **dilarang** membawa PII (`SECURITY §7`) dan kalau diaktifkan hanya lewat kanal berbendera tenant + `INTEGRATIONS` sebagai pemilik mekanika kontrak vendor (dokumen ini tidak menetapkan nomor API/field vendor — `[TIDAK-TERVERIFIKASI]`, mengikuti §4.7.1).
6. **Kebijakan adalah data, bukan string.** Nilai `attendance.multi_source_policy` **wajib** anggota kamus `kebijakan_rekonsiliasi` (`enum_kind`, `0049`); kalau `REQUIRE_ALL` dikirim, jawabannya `422 PARAM_ENUM_UNKNOWN` (110), dan **server tidak menambah item kamus** agar nilai lolos (`AGENTS §3.10`: kelas A-prime `session_kind`/`learning_modality` tetap enum tertutup; kamus yang dapat dirawat kampus hanya untuk nilai kelas C).
7. **i18n (`AGENTS §3.5`).** Label kebijakan & sebab `pendingReview.reason` dua wujud (`id.json`/`en.json`, `Vary: Accept-Language`); `admin.errors.EVIDENCE_INSUFFICIENT` **wajib** menyebut **sumber bukti yang ada** dan **sumber yang kurang** — pesan generik "data belum lengkap" adalah kegagalan layar banding, bukan kegagalan pengguna. Namespace `admin.errors` belum ada hari ini (RD-12).
8. **Paritas Mobile (`AGENTS §3.4`).** Flutter mengirim peristiwa kanal internal (JOIN/LEAVE/HEARTBEAT) dan **tidak pernah** menerima `ratioComputed` sebagai kebenaran lokal; vonis hanya dibaca. Ambang yang sama, kata kunci yang sama, satu endpoint yang sama — tidak ada "kebijakan versi mobile".
9. **Urutan `AGENTS §3.11` tidak boleh dibalik:** PRD (FR/BR presensi multi-modus) → DDL + `0049`/`0050` di DATA_MODEL (**sudah ditulis**) → izin di `RBAC_MATRIX §4.5` (**sejak 2026-10-21 terdaftar**: `attendance.event.ingest` = 301, `attendance.reconciliation.view` = 297, `attendance.reconciliation.decide` = 300, semuanya berstatus `usulan` sampai promosi `gen-rbac-seed.mjs`; `settings.param.*` 146–157 dan `platform.menu.*` 158–161 sudah lebih dulu di katalog) → path + kode error di sini (**selesai 2026-10-20**) → pola layar di `UI_UX_DESIGN §14`/§18.16 (**sudah**) → task `ROADMAP_TASKS` §2.21 → **baru** kode.
10. **Satu keadaan, tiga angka — didaftarkan, tidak dibulatkan di sini.** Batas akurasi GPS ditulis berbeda di tiga tempat dan itu **temuan yang harus ditutup pemilik skema & implementasi**, bukan sesuatu yang boleh diputuskan kontrak API: `attendance.gps_max_accuracy_m` = **50** dengan rentang 5–200 (`DATA_MODEL §21.3`), kontrak scan §4.3.7 membatasi `accuracyMeters` di **100**, dan rute yang hidup mengizinkan sampai **500** (`attendance/qr/scan/route.ts:34`). Vonis §6.10.6 memakai `d − akurasi ≤ radius`, jadi angka ini mengubah hasil keputusan — dan memilih salah satu diam-diam di dokumen ini justru melanggar aturan "satu kondisi, satu norma, satu rumah". Catatan yang sama berlaku untuk `attendance.totp_rotate_seconds` (5 dtk di §4.3.6/§21.3 vs "TTL 30 dtk" di §4.3.1 dan `docs/RBAC_MATRIX.md:249`) yang sudah didaftar sebagai kontradiksi lintas dokumen di **§4.3.9 butir 5**.
11. **`PENDING_REVIEW` tidak boleh dipindah menjadi enum.** Bila produk menuntut keadaan tersimpan, itu **perluasan `attendance_status`/mesin state milik `DATA_MODEL §15`** (pola yang sama dengan baris 102 dan §4.3.9 butir 2/7), bukan sesuatu yang dapat ditetapkan §4.18. Sampai itu ada, kontrak mengirim `decision.status: null` + `pendingReview.*` dan **satu** baris `attendances` tetap tertulis seperti adanya.

---

### 4.19 Kanal vicon terkelola — koneksi tenant, provisioning, dan bukti kehadiran (M-02 · M-15 · M-16 · M-18) — 2026-10-21

> **Status gugus ini: `spec-only` seluruhnya, nol handler.** Terukur 2026-10-21: `ls apps/web/src/app/api/v1` = `academic`, `attendance`, `auth`, `health`, `tenant` (tidak ada `conference`); `find apps/web/src -path "*conference*" -name route.ts` = **0**; dan `ENV_CONTRACT` **belum memuat satu pun variabel kredensial kanal** (`RD-67`). Norma induk: `PRD §5.15` (FR-VIC / BR-VIC / AC-VIC) dan `DATA_MODEL §21.10` (objek `0073`–`0075`).

Rutenya sengaja sedikit: kanal adalah **transport**, dan vonis kehadiran tetap milik M-18. Yang diberi path hanya tiga hal yang tidak bisa dihindari — mengelola koneksi, menyediakan kanal untuk sesi, dan menarik bukti.

| Metode | Path | Izin (`resource × verb`) | Modul | Ringkas dan penjaga |
|---|---|---|---|---|
| GET | `/api/v1/admin/conference/connections` | `settings.conference.view` | M-02 | daftar kanal tenant + status probe; `credential_ref` tidak ikut proyeksi (rahasia `SERVER_ONLY` di `FIELD_RULES`) |
| POST | `/api/v1/admin/conference/connections` | `settings.conference.manage` | M-02 | daftarkan kanal; body hanya `provider` (enum §21.10.1), `api_region`, `external_tenant_ref`; rahasia tidak pernah diterima |
| POST | `/api/v1/admin/conference/connections/:provider/probe` | `settings.conference.validate` | M-02 | uji koneksi nyata (buat sesi percobaan lalu tutup) dan catat `last_probe_*`; MFA diwajibkan karena hasilnya mengubah pemilihan kanal |
| PUT | `/api/v1/admin/conference/settings` | `settings.param.edit.technical` | M-02 | menulis `conference.default_provider`, `conference.fallback_chain`, `conference.attendance_source_priority`, `conference.evidence_max_age_hours` lewat **mesin parameter §4.16** (bukan rute khusus); nilai asing → `422 PARAM_VALUE_NOT_ALLOWED` (145) |
| POST | `/api/v1/conference/sessions/:sessionId/meetings` | `teaching.session.manage` | M-15 · M-16 | provisioning kanal untuk sesi `SYNC_LIVE`/`BLENDED`; join URL ditulis server; kegagalan memicu rantai fallback → `502 CONFERENCE_PROVIDER_UNREACHABLE` (147) setelah rantai habis |
| GET | `/api/v1/conference/sessions/:sessionId/meetings` | `teaching.session.view` | M-15 · M-16 | keadaan kanal + `fallback_of` supaya layar menampilkan `CHANNEL_UNAVAILABLE` apa adanya (`BR-VIC-05`) |
| POST | `/api/v1/webhooks/conference/:provider` | `platform.integration.proof` | M-01 | pintu masuk peristiwa kanal (internal dan vendor) → `conference_channel_events`; empat penjaga §4.18.3 (allowlist field, digest, idempotensi per `(tenant, provider, external_event_id, event_type)`, `received_at` server) berlaku penuh |
| POST | `/api/v1/attendance/sessions/:sessionId/channel-evidence/pull` | `attendance.record.mark` | M-18 | tarik laporan kehadiran pasca sesi → `attendance_channel_evidence` (bukti, bukan vonis); selalu `202 { runId }` dan dihitung worker (ADR-9/ADR-15); laporan basi → `422 CONFERENCE_EVIDENCE_STALE` (148) |
| GET | `/api/v1/attendance/sessions/:sessionId/reconciliation` | `attendance.record.view` | M-18 | proyeksi §21.5 per mahasiswa: daftar bukti, `ratio`, ambang yang berlaku + `parameter_version`, flag `degraded`, `reviewState`, dan **satu vonis** |

**Tiga aturan yang membuatnya penegakan, bukan sekadar tambahan path.**

1. **Klien tidak pernah memilih angka.** `joinSeconds`, `ratio`, `meetsThreshold`, dan provider untuk sesi baru diselesaikan server di dalam transaksi; id sesi dari klien lebih dulu diselesaikan ke barisnya `WHERE tenant_id = ctx.tenantId AND id = $1` (`AGENTS §3.8` anti-IDOR, pola `SEC-02`/`SEC-04`).
2. **Rahasia tidak menyentuh body, log, maupun baris parameter.** `credential_ref` hanya pointer; `DATA_MODEL §21.2` menutup jalur lain lewat `CHECK (is_secret = false)` dan `source_of_truth <> 'ENV'`; yang keluar-masuk kanal adalah pseudonim `external_user_ref`, bukan email/NIM (`BR-VIC-03`, `SECURITY §7` dan §13.1).
3. **Satu vonis, banyak bukti.** Kanal menambah baris bukti, tidak menambah nilai enum kehadiran; `degraded` dan `review_state` adalah kolom penjaga (`RD-70`).

**Bentuk kontrak Microsoft Teams dirinci sekali di `INTEGRATIONS §6.8`** (langganan perubahan Graph, peta laporan kehadiran, penanganan `401/403/429`, dan tanda `[VERIFIKASI-VENDOR]` yang masih terbuka). Dokumen ini tidak menyalin bentuk payload vendor ke dua tempat.


Pohon lama (blok ASCII di versi sebelumnya) **ditinggalkan** karena tiga alasan terukur (RD-33): tidak memuat `/tenant/modules` dan seluruh `/admin/*` padahal §4.5/§4.6 mendefinisikannya, memuat 4 endpoint yang tidak pernah dispesifikasi di §4 mana pun, dan melewatkan endpoint health yang diwajibkan `AGENTS.md` §3.7.

**Cara tabel ini dibuat (diukur, bukan dikutip).** Kolom *Status* untuk baris `implemented` diturunkan dari daftar berkas handler nyata:

```bash
find apps/web/src/app/api/v1 -name route.ts   # → 18 berkas (2026-10-19)
```

Daftar di atas adalah **snapshot historis 18 berkas**, bukan inventaris hidup terkini. Status kini harus dicocokkan dengan `.tools/handler-inventory.mjs`; rute admin/platform bertambah pada 2026-10-23 (§4.20.2). Legenda:

| Penanda | Arti |
|---|---|
| `implemented` | Berkas handler ada. Muatan logikanya boleh masih mock/`TODO` — itu ditulis di catatan. |
| `spec-only` | Didalamii §4 dokumen ini, tetapi belum ada berkasnya. |
| `spesifikasi-hilang` | Muncul di permukaan (pohon lama / `INDEX.md`) **tanpa** pernah ada §4 yang mendefinisikannya. Wajib ditulis spesifikasinya atau dicabut. |

### 4.20 Platform SaaS — provisioning tenant, paket & kuota, dukungan terawasi, break-glass (M-01) — 2026-10-21

**Mengapa bagian ini lahir.** Tujuh menu `RBAC §6.1 Cluster Platform` dan kartu `UI_UX §17.2.6` untuk `M-01` sejak lama menunjuk izin `platform.*` / `entitlement.*`, tetapi **tidak satu pun** barisnya punya path: seluruh permukaan lintas-tenant M-01 tidak berkontrak, dan hanya `GET/POST /tenant/modules` (§4.5) yang nyata. Kajian balik M-01 2026-10-21 menemukan ini sebagai lubang rantai, bukan gaya penulisan: `PRD FR-PLT-01` sudah menormakan provisioning dan kuota sejak Fase 1, `DATA_MODEL §3.1` sudah punya fisik tabelnya, `RBAC §4.5.3` baris 302–318 sekarang menomori izinnya — tinggal path + kode error (urutan `AGENTS §3.11` ditaati, tidak dibalik).

**Penjaga yang berlaku untuk SEMUA rute di bawah** (tidak diulang per baris): identitas peminta **hanya** dari token terverifikasi; `PLATFORM_OPERATOR` ditegakkan lewat tabel (`requireDataPrincipal`, lapis 3 `BLUEPRINT_ROLE_BY_ROLE §0.4`) bukan label peran; `tenant_id` target **diselesaikan dari barisnya di dalam transaksi** sebelum `SET LOCAL app.current_tenant` (`DATA_MODEL §6.2` butir "Tulisan platform lintas tenant"), sehingga `x-tenant-id` dari klien tidak pernah menjadi penentu (ralat `SEC-07`); setiap tulis wajib MFA pada sesi + alasan + satu baris `audit_logs`; dan **read-after-write wajib ke Primary** (`AGENTS §3.7`) — daftar tenant/utilisasi pasca provisioning tidak boleh dibaca dari replica.

| Metode | Path | Izin (`resource × verb`) | Ringkas dan penjaga |
|---|---|---|---|
| GET | `/api/v1/platform/tenants` | `platform.tenant.view` (302) | daftar tenant + `tenant_status` + paket aktif + utilisasi; **agregat, tanpa PII per-record** (`AC-PLT-3`); filter `status`, `planId`; paginasi `cursor` (bukan `OFFSET`, §3.7); boleh Replica |
| GET | `/api/v1/platform/tenants/:tenantId` | `platform.tenant.view` (302) | keadaan satu tenant: domain, paket, kuota terpakai vs batas, bendera rilis aktif. `:tenantId` diselesaikan ke barisnya sebelum proyeksi; tenant tidak ada = `404`, bukan `403` (anti-oracle, pola §4.17.1 butir 2) |
| POST | `/api/v1/platform/tenants` | `platform.tenant.provision` (303) | wizard provisioning: institusi + domain + `plan_id` + admin pertama + seed peran sistem dari katalog terapan (jumlah dicetak `gen-rbac-seed --check`, bukan angka 22 yang dibekukan) + parameter bawaan dalam **satu transaksi** (`DATA_MODEL §9`); `Idempotency-Key` wajib; domain bentrok / seed gagal / `uq_subscriptions_active` → `409 TENANT_PROVISION_FAILED` (150) dan **nol** baris bertahan (`AC-PLT-1`) |
| POST | `/api/v1/platform/tenants/:tenantId/suspend` | `platform.tenant.suspend` (304) | transisi `ACTIVE → SUSPENDED`; body **hanya** `reason` (10–500); `status` tidak pernah diterima dari body (`SERVER_ONLY`); sesudahnya seluruh tulis tenant-level → `403 TENANT_SUSPENDED` (151) sementara `GET` tetap untuk bahan penagihan |
| POST | `/api/v1/platform/tenants/:tenantId/reinstate` | `platform.tenant.suspend` (304) | arah balik `SUSPENDED → ACTIVE` memakai **kode yang sama** (satu gerbang transisi, bukan dua kode — `RBAC §4.5.3` catatan baris 304); alasan wajib; `ARCHIVED` menolak dan itu terminal (`409`, tanpa kode baru: sebabnya terbaca dari status) |
| GET | `/api/v1/platform/plans` | `platform.plan.view` (305) | definisi paket + `plan_modules`; harga dan batas kursi tidak dibaca peran akademik (SoD BAAK↔BAUK) |
| POST | `/api/v1/platform/plans` | `platform.plan.manage` (306) | buat paket baru; **tidak** mengubah kontrak aktif — `subscriptions` menunjuk `plan_id` dan harga historis dibaca dari baris langganan, bukan dari paket |
| PUT | `/api/v1/platform/plans/:planId` | `platform.plan.manage` (306) | ubah isi/keaktifan paket dengan `expectedVersion` (optimistic lock, pola §4.16); menurunkan isi paket yang masih dipakai tenant menolak dengan `409 REFERENCE_IN_USE` (19) + `affectedTenants[]` |
| PUT | `/api/v1/platform/tenants/:tenantId/quotas` | `platform.quota.manage` (307) | seluruh `tenant_quotas` lewat satu rute; kunci di luar `DATA_MODEL §3.1` → `422 PLATFORM_QUOTA_KEY_UNKNOWN` (153); nilai di luar `CHECK` §15 ditolak, **tidak** dipotong diam-diam; read-your-writes ke Primary |
| PUT | `/api/v1/platform/tenants/:tenantId/flags` | `platform.flag.manage` (308) | target penulis key `release` pada kolom `feature_flags` tabel `tenant_settings` saja; key `modules` dimiliki tenant dan tidak dapat menerbitkan lisensi (`DATA_MODEL §12.3`). DTO namespace dan pemisahan penulis belum diimplementasikan; whole-object overwrite dilarang. Pergantian KRS sinkron→antrean hanya sesudah jalur antrean terpasang; bendera bukan pengganti deploy/migrasi |
| PUT | `/api/v1/platform/tenants/:tenantId/seats` | `entitlement.seat.manage` (315) | batas `PER_SEAT` (`LMS`, `thesis`, `hr_bkd`); menurunkan di bawah pemakaian aktif → `409 SEAT_LIMIT_BELOW_ACTIVE_USAGE` (154) dengan angka terpakai, **bukan** memutus pengguna yang sudah ada |
| POST | `/api/v1/platform/tenants/:tenantId/trial` | `entitlement.trial.grant` (316) | buka/perpanjang percobaan; TTL server dari `subscriptions.trial_ends_at`; perpanjangan = baris baru beralasan, bukan ubah senyap; satu langganan aktif per tenant dijaga indeks unik |
| GET | `/api/v1/platform/usage` | `platform.tenant.view` (302) | `tenant_usage` per `bucket_month` untuk noisy-neighbour; hanya agregat + ambang; boleh Replica; **tidak** mengembalikan baris domain |
| POST | `/api/v1/platform/impersonation-grants` | `identity.impersonation.grant` (317) | buka dukungan terawasi: `ticketId` + `reason` + `tenantId` target; TTL ditetapkan server ≤ 30 menit; MFA di sesi; notifikasi ke `TENANT_ADMIN` sasaran; tercatat `grant_kind='PLATFORM_SUPPORT'` |
| DELETE | `/api/v1/platform/impersonation-grants/:grantId` | `identity.impersonation.revoke` (318) | tutup grant = **ubah status**, baris jejak tidak dihapus; boleh dicabut `PLATFORM_OPERATOR` atau `TENANT_ADMIN` atas tenantnya sendiri; memakainya setelah kedaluwarsa → `410 IMPERSONATION_GRANT_EXPIRED` (152) |
| POST | `/api/v1/platform/breakglass` | `platform.breakglass.use` (309) | akses darurat per-record saat insiden; wajib `reason` + objek target + **dua identitas** (yang meminta ≠ yang mengesahkan, SoD); tanpa salah satu → `422`; setiap buka dan tutup menjadi baris audit |
| GET | `/api/v1/platform/tenants/:tenantId/licenses` | `entitlement.license.view` (389) | **design-only.** Isi = proyeksi `LicenseView` (§4.20.1) dari `tenant_modules`: `moduleCode`, `status`, `seats`, `validFrom`, `validTo`, `updatedAt`, `missingDependencies`; identitas aktor aktivasi tidak termasuk DTO baca ini. **Tidak** memuat nominal tagihan (SoD §12.2 butir 6). Nol `route.ts` pemegang sampai hari ini — status baris ini spesifikasi, bukan klaim jalan |
| PATCH | `/api/v1/platform/tenants/:tenantId/licenses/:moduleCode` | `entitlement.license.update` (390) | **design-only.** `LicensePatch` (§4.20.1): `seats?`, `validTo?`, `reason`, `expectedUpdatedAt`; minimal satu nilai berubah. Status tetap server-only, aktivasi/pencabutan platform memerlukan kontrak transisi tersendiri. Batas paket/tanggal → `422 LICENSE_EXCEEDS_PLAN_CEILING` (156); versi tidak cocok → `409 CONFLICT`; prasyarat tidak efektif → `422 MODULE_DEPENDENCY_UNMET`. Jalur tenant §4.5 tidak boleh dijadikan pemberi lisensi |
| GET | `/api/v1/platform/billing/invoices` | `platform.billing.view` (391) | **design-only.** `PlatformInvoiceQuery` (§4.20.1) memilih satu `tenantId` target yang diselesaikan dalam transaksi platform; filter `status`, `from`, `to`, `page`, `limit`; keluaran `PlatformInvoiceView`. Nominal rupiah berupa **string**. Tidak otomatis memberi `COMPLIANCE_OFFICER` akses lintas tenant; jalur baca tagihan kampus sendiri masih menunggu kontrak/izin terpisah |
| POST | `/api/v1/platform/billing/invoices` | `platform.billing.issue` (392) | **design-only.** `PlatformInvoiceCreate` (§4.20.1) menerbitkan `ISSUED` dengan satu deskripsi agregat. `components[]`/`issueNow` tidak diterima karena belum ada kontrak rincian/draf. Nomor, total, status dan penerbit dihitung server; `Idempotency-Key` wajib; replay identik mengembalikan hasil awal |
| POST | `/api/v1/platform/billing/invoices/:invoiceId/settle` | `platform.billing.settle` (393) | **design-only.** `PlatformInvoiceSettle` (§4.20.1): bukti transfer diverifikasi, aktor berbeda dari penerbit, invoice dikunci dalam transaksi; nilai kumulatif kurang dari total → `PARTIAL`, sama → `PAID`, lebih → `422 VALIDATION_FAILED`. `ISSUED/PARTIAL/OVERDUE` dapat dibayar. Tidak menulis tabel M-10. Replay identik bukan konflik; referensi provider dipakai key lain → error 158 |
| POST | `/api/v1/platform/billing/invoices/:invoiceId/void` | `platform.billing.void` (394) | **design-only.** `PlatformInvoiceVoid` (§4.20.1): `reason`, `expectedVersion`; pembatal berbeda dari penerbit (`ck_pi_void_actor`). Hanya `ISSUED/OVERDUE` dengan pembayaran nol. `PAID/VOID` → error 157; `PARTIAL` → `409 CONFLICT`, bukan menghapus pembayaran |
| Jejak audit lintas-tenant — **lihat §4.21** | — | — | **dipindah 2026-10-22 (siklus M-05, `RD-121`)**: baris ini dulu mencetak `GET /platform/audit-events` di dalam tabel milik M-01 sementara kolom izinnya sendiri menulis "pemilik namespace M-05" — satu path tidak boleh punya dua rumah, dan peran pemegang bukan pemilik objek (`RD-116`). Kontrak penuh (gerbang MFA, `reason` wajib, ekspor, kode error) sekarang hanya di §4.21; klaim "retensi 7 tahun" yang ikut terbawa di baris ini **diralat** mengikuti vonis `AUDIT_READINESS K-24` (floor ≥ 5 tahun + `retention_rules` per kelas, angka final keputusan pemilik/VERIFIKASI-LEGAL) |

**Status implementasi, audit ulang 2026-10-23.** Inventaris rekursif menemukan delapan `route.ts` platform dengan sembilan metode: daftar/provision tenant, detail tenant, suspend, reinstate, kuota, buat/cabut support grant, serta baca audit (§4.21). Semuanya terhubung DB. Ini bukan bukti semua field/gerbang spesifikasi sudah dipenuhi: daftar tenant aktual hanya `limit`, detail masih ringkas, provisioning mengembalikan `ONBOARDING`, dan kontrak grant mengizinkan `ticketId` opsional. Izin yang sudah ada tidak perlu dipromosikan ulang; enam izin lisensi/tagihan 389–394 tetap **usulan**. Rute plans/flags/seats/trial/usage/breakglass/lisensi/tagihan belum memiliki handler. Kode 155–158 masih spec-only; jangan menggeneralisasi status itu ke seluruh platform.

**Tiga hal yang sengaja TIDAK dibuat di sini.** (1) Tidak ada `DELETE /platform/tenants/:id`: norma penghapusan SICA adalah transisi keadaan (`suspend`/`archive`), dan tenant adalah akar referensinya — menghapusnya membuat seluruh jejak audit yatim (`BR-R12`). (2) Tidak ada rute tulis `plans` dari sisi tenant. Kebijakan katalog mengikuti tabel masing-masing (`DATA_MODEL §6.2`), bukan asumsi semua katalog RLS OFF. Platform memberi lisensi; tenant hanya dapat menonaktifkan/mengaktifkan preferensi lokal dalam lisensi efektif. Penyimpangan activation warisan pada §4.5 masih harus ditutup di kode. (3) Tidak ada "menu platform" kedua: pohon menu lintas tenant sudah didefinisikan di §4.17 (`/admin/platform/menus`, baris 158–161) dan bagian ini tidak mengulang objeknya (`RD-32`).


#### 4.20.1 DTO lisensi dan billing — fragmen OpenAPI 3.1, design-only

Fragmen berikut menetapkan bentuk DTO, **bukan** klaim generator OpenAPI atau schema Zod runtime sudah dibuat. Semua objek tulis strict; UUID path divalidasi setelah identitas, izin dan MFA. `tenantId` dalam permintaan platform berarti **target**, bukan tenant identitas aktor; pada API tenant ia selalu berasal dari token. `reason` dicatat, bukan ditampilkan dalam log umum. Batas panjang/ukuran dan domain katalog diverifikasi server.

```yaml
components:
  schemas:
    PlatformReason:
      type: string
      minLength: 10
      maxLength: 500
    Rupiah:
      type: string
      pattern: '^(0|[1-9][0-9]{0,18})$'
      description: Integer desimal; validasi server juga membatasi maksimum bigint PostgreSQL.
    PlatformInvoiceStatus:
      type: string
      enum: [DRAFT, ISSUED, PARTIAL, PAID, VOID, OVERDUE]
    LicenseView:
      type: object
      additionalProperties: false
      required: [moduleCode, status, seats, validFrom, validTo, updatedAt, missingDependencies]
      properties:
        moduleCode: {type: string, minLength: 2, maxLength: 40}
        status: {type: string, enum: [ACTIVE, TRIAL, DISABLED, EXPIRED, PENDING_PAYMENT]}
        seats: {type: [integer, 'null'], minimum: 0, maximum: 2147483647}
        validFrom: {type: string, format: date-time}
        validTo: {type: [string, 'null'], format: date-time}
        updatedAt: {type: string, format: date-time}
        missingDependencies:
          type: array
          uniqueItems: true
          items: {type: string, minLength: 2, maxLength: 40}
    LicensePatch:
      type: object
      additionalProperties: false
      required: [reason, expectedUpdatedAt]
      anyOf:
        - required: [seats]
        - required: [validTo]
      properties:
        seats: {type: [integer, 'null'], minimum: 0, maximum: 2147483647}
        validTo: {type: [string, 'null'], format: date-time}
        reason: {$ref: '#/components/schemas/PlatformReason'}
        expectedUpdatedAt: {type: string, format: date-time}
    PlatformInvoiceQuery:
      type: object
      additionalProperties: false
      required: [tenantId]
      properties:
        tenantId: {type: string, format: uuid}
        status: {$ref: '#/components/schemas/PlatformInvoiceStatus'}
        from: {type: string, format: date}
        to: {type: string, format: date}
        page: {type: integer, minimum: 1, default: 1}
        limit: {type: integer, minimum: 1, maximum: 200, default: 50}
    PlatformInvoiceCreate:
      type: object
      additionalProperties: false
      required: [tenantId, subscriptionId, periodStart, periodEnd, description, subtotalRupiah, taxRupiah, discountBp, dueAt, reason]
      properties:
        tenantId: {type: string, format: uuid}
        subscriptionId: {type: string, format: uuid}
        periodStart: {type: string, format: date}
        periodEnd: {type: string, format: date}
        description: {type: string, minLength: 1, maxLength: 500}
        subtotalRupiah: {$ref: '#/components/schemas/Rupiah'}
        taxRupiah: {$ref: '#/components/schemas/Rupiah'}
        discountBp: {type: integer, minimum: 0, maximum: 10000}
        dueAt: {type: string, format: date-time}
        reason: {$ref: '#/components/schemas/PlatformReason'}
    PlatformInvoiceSettle:
      type: object
      additionalProperties: false
      required: [tenantId, amountRupiah, channel, providerRef, expectedVersion, reason]
      properties:
        tenantId: {type: string, format: uuid}
        amountRupiah: {$ref: '#/components/schemas/Rupiah'}
        channel: {type: string, minLength: 1, maxLength: 80}
        providerRef: {type: string, minLength: 1, maxLength: 200}
        expectedVersion: {type: integer, minimum: 1, maximum: 2147483647}
        reason: {$ref: '#/components/schemas/PlatformReason'}
    PlatformInvoiceVoid:
      type: object
      additionalProperties: false
      required: [tenantId, expectedVersion, reason]
      properties:
        tenantId: {type: string, format: uuid}
        expectedVersion: {type: integer, minimum: 1, maximum: 2147483647}
        reason: {$ref: '#/components/schemas/PlatformReason'}
    PlatformInvoiceView:
      type: object
      additionalProperties: false
      required: [id, tenantId, subscriptionId, invoiceNumber, periodStart, periodEnd, description, subtotalRupiah, taxRupiah, discountBp, amountRupiah, paidRupiah, status, version, dueAt, canSettle, canVoid]
      properties:
        id: {type: string, format: uuid}
        tenantId: {type: string, format: uuid}
        subscriptionId: {type: string, format: uuid}
        invoiceNumber: {type: string}
        periodStart: {type: string, format: date}
        periodEnd: {type: string, format: date}
        description: {type: string}
        subtotalRupiah: {$ref: '#/components/schemas/Rupiah'}
        taxRupiah: {$ref: '#/components/schemas/Rupiah'}
        discountBp: {type: integer, minimum: 0, maximum: 10000}
        amountRupiah: {$ref: '#/components/schemas/Rupiah'}
        paidRupiah: {$ref: '#/components/schemas/Rupiah'}
        status: {$ref: '#/components/schemas/PlatformInvoiceStatus'}
        version: {type: integer, minimum: 1}
        dueAt: {type: string, format: date-time}
        canSettle: {type: boolean}
        canVoid: {type: boolean}
```

`canSettle`/`canVoid` adalah kapabilitas proyeksi server per aktor: izin efektif + MFA + scope + keadaan invoice + SoD terhadap penerbit. Penerbit selalu menerima keduanya `false`; void juga mensyaratkan total pembayaran nol. UI tidak memerlukan identitas penerbit untuk menentukannya. Boolean tidak diterima dalam body mutasi dan bukan bukti otorisasi: server memeriksa ulang semuanya dalam transaksi, termasuk versi dan jumlah pembayaran.

| Operasi pada tabel §4.20 | Input | Sukses dalam envelope §2 | Penolakan tambahan |
|---|---|---|---|
| Baca lisensi | `tenantId` UUID path; query kosong | 200 `LicenseView[]`, urut kode | 404 target tidak ada |
| Ubah lisensi | `moduleCode` anggota katalog + `LicensePatch` | 200 `LicenseView` dari Primary | 409 token `updatedAt` berbeda; 422 interval/seats/plafon |
| Daftar invoice | query `PlatformInvoiceQuery` | 200 `PlatformInvoiceView[]` + pagination §2, urut `created_at DESC,id` | 422 tanggal/filter tidak sah |
| Terbit invoice | `PlatformInvoiceCreate` + `Idempotency-Key` | 201 `PlatformInvoiceView` | 404 subscription bukan tenant target; 422 total nol/overflow/periode terbalik |
| Settle invoice | UUID path + `PlatformInvoiceSettle` + `Idempotency-Key` | 200 `PlatformInvoiceView` termasuk `paidRupiah` terkini | 403 penerbit sama; 409 versi/state/duplikasi; 422 bukti/nominal tidak sah |
| Void invoice | UUID path + `PlatformInvoiceVoid` + `Idempotency-Key` | 200 `PlatformInvoiceView` | 403 penerbit sama; 409 sudah dibayar/terminal/versi berbeda |

`Idempotency-Key`: 8–128 karakter ASCII cetak, diikat tenant target + operasi + aktor; TTL replay tidak boleh menjadi alasan memproses ulang transfer yang sudah direkonsiliasi. Replay payload identik mengembalikan status/body awal. Payload berbeda pada key sama → `409 CONFLICT` (12). `expectedUpdatedAt` harus token presisi DB yang diproyeksikan utuh, bukan waktu yang dibulatkan klien; perubahan paralel memakai conditional UPDATE. Nilai NULL lisensi berarti tak berbatas **hanya jika** paket memang mengizinkan, bukan cara melewati plafon. Tanggal, kode modul, channel, batas bigint dan jumlah pembayaran memerlukan refinement lintas field/DB selain validasi schema.

#### 4.20.2 Register kelengkapan kontrak admin

| Gugus | Pemilik kontrak | Hasil audit dan penahan |
|---|---|---|
| Provisioning, status, kuota, dukungan | `packages/contracts/src/platform.ts` | DTO nyata `ProvisionTenantRequestSchema`, `TenantStatusTransitionRequestSchema`, `UpdateTenantQuotasRequestSchema`, `CreateImpersonationGrantRequestSchema`, `CrossTenantAuditQuerySchema`; respons dan parameter tiap handler masih perlu parity review, bukan diasumsikan OpenAPI lengkap |
| Pengguna, peran, penugasan, organisasi/prodi | `packages/contracts/src/admin.ts`, §4.6.9 | DTO nyata; urutan izin-dahulu sudah diperbaiki empat metode organisasi/prodi, rute warisan RD-155 belum seluruhnya |
| Parameter | `packages/contracts/src/system-parameters.ts`, §4.16 | DTO nyata, approval dan history berbeda dari kewenangan mengubah nilai |
| Lisensi, SaaS billing | §4.20.1 | bentuk enam operasi ditulis; Zod/generator/runtime, kontrak draft/refund dan pemberian lisensi platform belum ada |
| Paket, flags, seats, trial, usage, breakglass | §4.20 | path/izin ada, DTO field-level menyeluruh belum selesai; tidak boleh dibuat dari `Record<string, unknown>` bebas |
| DSAR | §4.6.10 dan DATA_MODEL §5.1 | gunakan enum `dsr_kind`/`dsr_status`/`dsr_outcome`; FK, bukti verifikasi, outcome parsial dan DTO keputusan belum lengkap |
| Domain/SSL, SSO, binding konektor, backup/restore, cache, antrean | BLUEPRINT_ROLE_BY_ROLE §11 | target wajib yang belum seluruhnya memiliki permission/DDL/DTO; daftar menu **bukan** kontrak API. Tidak menambahkan rute rekaan sebelum rantai pemilik lengkap |
| Katalog dan tagihan SaaS milik tenant | §4.5 dan DATA_MODEL §12 | baca katalog ada; baca tagihan tenant dan preferensi lokal belum punya kontrak/izin tersendiri, tidak memakai izin platform lintas tenant |

Register ini sengaja membuka kekurangan. Permintaan "seluruh endpoint admin memiliki OpenAPI DTO" **belum terpenuhi** hanya dengan fragmen §4.20.1; penutupnya adalah `ROADMAP §2.35`, bukan label LOCKED.

### 4.21 Jejak audit, partisi, jangkar Merkle & verifier rantai (M-05) — 2026-10-22

**Status: sebagian terimplementasi.** `GET /platform/audit-events` sudah DB-backed; gerbang aktual memakai `audit.log.view`, sehingga gabungan `audit.export` + MFA yang disyaratkan tabel masih perlu pembuktian/perbaikan. Endpoint lain di bagian ini tetap `spec-only`. Bagian ini adalah **satu-satunya rumah kontrak HTTP** untuk objek `audit_logs`, `audit_chain_head`, `audit_chain_anchors`, `audit_verification_runs` (`DATA_MODEL §4.1` & `§18.8`, migrasi `0012`/`0034`/`0043`). Sebelum siklus M-05, rute-rute ini hidup di tiga tempat yang tidak saling mengenal: `GET /platform/audit-events` tercatat di tabel §4.20 milik M-01 (padahal barisnya sendiri menulis "pemilik namespace M-05"), jangkar/verifier hanya berbentuk **kalimat** di §4.6.7 dan **blok ilustrasi** di §6.10.8, dan keduanya tidak terhitung oleh `.tools/crud-matrix.mjs` maupun pemegang izin mana pun. Celah itu didaftarkan sebagai `RD-121`; §6.10.8 tetap pemilik **semantik engine** ALG-14 (kanonisasi, hash, budget), bagian ini tetap pemilik **kontrak** (dilarang dua rumah untuk satu path — `RD-32`).

**Izin yang dipakai bagian ini** — jangan menambah nama baru di sini (`AGENTS §3.8`): `audit.log.view` & `audit.export` (katalog inti `RBAC §4.2`), `audit.anchor.view` (104), `audit.anchor.seal` (105), `audit.verify.run` (106), `audit.verify.view` (107) — keempatnya **usulan** sampai dipromosikan ke `PERMISSION_SPECS` (`G-15`). Norma yang mengikat: **membaca jejak ≠ menjalankan verifier ≠ membaca hasil verifikasi** (`RBAC §4.6c` butir c) dan **tidak ada izin "repair"** — rute yang menghitung ulang hash adalah pemalsuan yang sedang dideteksi, jadi permintaannya dijawab `403 FORBIDDEN` (3) karena izinnya memang tidak ada dan tidak akan pernah dibuat.

| Rute | Aksi | Izin | Gerbang | Catatan kontrak |
|---|---|---|---|---|
| GET /api/v1/admin/audit-events | READ | `audit.log.view` | MFA ya · scope TENANT | list kontrak §2.4 (`occurred_at DESC`, filter `actorUserId`/`targetEntity`/`targetId`/`action`/`from`/`to`/`stream`); boleh ke **Replica** (baca historis, bukan read-your-writes); `before`/`after` dipangkas pada **proyeksi server** untuk peran yang tidak berhak atas objek sumbernya — menyembunyikan sel di UI bukan kontrol akses |
| GET /api/v1/platform/audit-events | READ | `audit.log.view` + `audit.export` | MFA ya · `PLATFORM_OPERATOR` · `reason` wajib | **dipindah dari §4.20** (baris itu kini pointer): lintas tenant hanya lewat jalur platform, `reason` wajib karena ini membaca PII-adjacent di luar tenant peminta (`SECURITY §13`); setiap akses tercatat sebagai baris audit baru; `tenantId` target wajib diselesaikan ke barisnya sebelum proyeksi (anti-IDOR) |
| GET /api/v1/admin/audit/partitions | READ | `audit.log.view` | MFA ya | daftar partisi bulanan + `last_hash`/`updated_at` dari `audit_chain_head` dan status segel; **tidak ada tabel partisi kedua** — partisi adalah properti `audit_logs` (`DATA_MODEL §4.1`), dan penutupan bulan adalah `0012` + job bulanan (`DEPLOYMENT_DEVOPS §4`), bukan objek baru (`RD-32`) |
| GET /api/v1/admin/audit-anchors | READ | `audit.anchor.view` (104) | MFA ya | list jangkar §2.4 per `stream` + `partition_start`; akar Merkle per 1.000 daun |
| GET /api/v1/admin/audit-anchors/{anchorId} | READ | `audit.anchor.view` (104) | MFA ya | `root_hash`, `prev_anchor_root`, `leaf_from`/`leaf_to`, `sealed_at`, `sealed_by`; **`storage_key` tidak pernah diproyeksikan** (`SERVER_ONLY`) — ia alamat WORM milik platform, bukan data kampus |
| POST /api/v1/admin/audit-anchors/{anchorId}/seal | OTHER | `audit.anchor.seal` (105) | MFA ya · `PLATFORM_OPERATOR` saja · empat-mata | segel akar ke object storage WORM sendiri + salinan di luar kendali tenant; **tanpa TSA RFC 3161** (zero-API-key, `ARCHITECTURE §12.9`); `sealed_by` wajib dan menolak bila daun `leaf_from..leaf_to` belum lengkap → `422 VALIDATION_FAILED` (6); menjegal ulang jangkar **tidak** mengubah hash daun |
| POST /api/v1/admin/audit-verifications | OTHER | `audit.verify.run` (106) | MFA ya · `PLATFORM_OPERATOR`/`COMPLIANCE_OFFICER` khusus verifier | badan hanya `{ stream?, partitionStart?, mode }` dengan `mode` ∈ `INCREMENTAL`/`PARTITION_SCAN`/`ANCHOR_PROOF`; jawaban `202 { verificationId }` (verifier berjalan di worker, rute HTTP tidak menghitung — `ADR-9`/`ADR-15`); pemegang `audit.log.view` saja → `403`; `Idempotency-Key` wajib |
| GET /api/v1/admin/audit-verifications | READ | `audit.verify.view` (107) | MFA ya | riwayat run §2.4 dengan `verdict` + `findings_count` + `triggered_by` (tidak pernah NULL) |
| GET /api/v1/admin/audit-verifications/{verificationId} | READ | `audit.verify.view` (107) | MFA ya | `findings[]` per `stream`/`seq`; `CHAIN_GAP`/`CHAIN_BRANCH`/`HASH_MISMATCH` → partisi ditandai beku dan setiap tulis ke stream itu answered `409 AUDIT_CHAIN_COMPROMISED` (90) sampai insiden ditutup — **tidak** ada jalur "tandai aman" |
| GET /api/v1/admin/audit-events/export | OTHER | `audit.export` | MFA ya · `reason` + `from`/`to` wajib · plafon baris | berkas bukti untuk auditor internal; kolom dibatasi + volume dibatasi sehingga jawaban tetap sinkron (tanpa tabel job — tidak ada `audit_export_jobs`, dan menambahnya tanpa kebutuhan adalah `RD-03`); retensi mengikuti **floor yang berlaku** (`AUDIT_READINESS K-24`, angka per kelas disimpan di `retention_rules`), bukan konstanta produk |
| GET /api/v1/platform/audit-events/export | OTHER | `audit.export` | MFA ya · `reason` wajib · `PLATFORM_OPERATOR` saja | bentuk lintas tenant untuk bukti SOC 2/ISO; sama sekali tidak menerima filter yang dapat membocorkan PII peran lain; setiap unduhan menjadi baris audit |

**Yang sengaja TIDAK diulang di sini (`RD-32`, satu path satu pemilik kontrak).** Detail satu baris jejak sudah dikontrak di **§7.29** sebagai `GET /admin/audit-events/{eventId}` dengan izin `audit.event.view` (baris Modul `M-05·M-31·M-32`); penutupan partisi sudah dikontrak di **§7.29** sebagai `POST /admin/audit/partitions/{partition}/seal` dengan `audit.chain.validate`; dan seluruh gugus sumber daya indikator mutu/LKPS tetap di **§7.29**. Bagian ini hanya menambah **sisi jejak audit murni** (list, partisi, jangkar, verifier, ekspor) yang sebelumnya tidak punya rumah. Blok `http` di **§6.10.8** kini hanya memuat bentuk umum *run* engine; empat baris rute objeknya dipindah ke mari, dan §5.14 mengutip §4.21.

**Enam lapis yang mengikat setiap rute tulis di atas.** L1 Zod `strict()` — badan `POST /admin/audit-verifications` tidak punya field lain; `seq`/`prevHash`/`recordHash`/`rootHash`/`verdict`/`findings`/`compromisedAt` **SERVER_ONLY** dan kehadirannya di body = `422` (6). L2 identitas — `tenantId`/`userId` hanya dari token; middleware menghapus `x-tenant-id`/`x-user-id` kiriman klien (`SEC-07`). L3 berbasis tabel — `requireDataPrincipal`, bukan carrier `member_role` (`SEC-10`). L4 scope — `holdsScoped(...)` untuk TENANT (admin) vs lintas-tenant (platform) — inilah yang membedakan baris 2 dari baris 1 (`SEC-11`). L5 state — partisi beku menolak tulis; segel kedua pada partisi yang sama → `409 DECISION_ALREADY_MADE` (55). L6 RLS — `audit_logs` FORCE + `NOBYPASSRLS`; jalur platform adalah satu-satunya pembaca lintas tenant dan ia diaudit sendiri. **Kode error:** tidak ada kode baru — dipakai `3`, `5`, `6`, `9`, `55`, `90` (semuanya sudah berbaris di §2.3; 90 lahir untuk ALG-14).

**Batas yang harus dibaca developer tanpa menebak.** (a) **MFA bukan rute M-05** — enrolmen faktor adalah permukaan identitas milik M-03 (`identity.mfa.manage`, baris 334, §4.6.9); yang dimiliki bagian ini hanyalah **gerbang** "sesi harus ber-MFA", dan ambang/kebijakannya adalah parameter kelas `SECURITY` milik M-02 (`settings.param.view.security` 146, `RBAC §4.7`), bukan konstanta di handler. (b) **Retensi bukan angka dokumen** — `retention_rules` (data, `DATA_MODEL §5.1`) + floor `K-24`; kalimat "7 tahun" yang sempat beredar di katalog `RBAC §4.2` dan di baris lama §4.20 **sudah diralat**. (c) **Ekspor bukan verba** — `audit.export` berpijak pada token `export` yang terdaftar eksplisit sebagai `OTHER` (`RBAC §4.1`), dan ia tidak boleh ditiru menjadi `<modul>.export` baru (`RD-55`). (d) **Satu rantai per tenant** — modul lain tidak membuat rantai sendiri; `grade_change_logs` dan `system_audit_trails` adalah *stream* yang **dibaca** verifier (`0034`) tetapi pemilik faktanya tetap modul sumbernya (M-19/M-03).

## 5. Inventaris Endpoint Lengkap
### 5.1 Otentikasi & sesi — `/api/v1/auth/*`

| Metode | Rute | Status | § | Catatan & bukti |
|---|---|---|---|---|
| POST | `/auth/login` | `implemented` | §4.1.1 | Cookie `sica_access_token` + `sica_refresh_token` disetel (`auth/login/route.ts:120-137`). Payload **belum** memuat `activeAssignment[]` (K-17). |
| POST | `/auth/mfa/verify` | `implemented` | §4.1.2 | **Stub fail-open**: menerima 6 digit apa pun dan mencetak cookie token palsu — `SEC-01` (CRITICAL). Jangan disalin sebagai pola. |
| POST | `/auth/refresh` | `implemented` | §4.1.3 | Rotasi + pesan seragam 401 (`auth/refresh/route.ts:43-46`). TTL refresh 7 hari. |
| POST | `/auth/logout` | `implemented` | **§4 belum ada** | Revokasi sesi + hapus cookie (`auth/logout/route.ts:27-36`). Ada di pohon lama tetapi tidak pernah dispesifikasi → **tulis §4.1.5** atau tandai sebagai implementasi tanpa kontrak. |
| GET | `/auth/me` | `implemented` | §4.1.4 | Tidak ada di pohon lama sama sekali. Mengembalikan carrier `role` saja (belum ber-assignment). |

### 5.2 Akademik & KRS — `/api/v1/academic/*`

| Metode | Rute | Status | § | Catatan & bukti |
|---|---|---|---|---|
| GET | `/academic/krs/open-classes` | `implemented` | §4.2.1 | Data **mock** (`route.ts:46-47` `TODO` ganti Drizzle). Kontrak list-nya **menyimpang dari §2.4**: memakai `search`, tanpa sort (`packages/contracts/src/academic.ts:193-199`). Guard permission belum terpasang (`SEC-05`). |
| POST | `/academic/krs/submit` | `implemented` | §4.2.2 | DB-backed, `pg_advisory_xact_lock` (pengecualian berjangka AGENTS §3.7/RD-11). Body `{periodId, classIds}` — **bukan** `{academicPeriodId, selectedClassIds}` seperti §4.2.2; kontrak yang harus mengikuti kode. |
| POST | `/academic/krs/approve` | `implemented` | **§4 belum ada** | Ada di kode (`academic/krs/approve/route.ts`) tetapi tidak pernah didaftar di §4 maupun pohon lama → **tulis §4.2.7**. Pola `enrollmentIds[]` dari body tanpa pembacaan DB = `SEC-04`. |
| GET | `/academic/khs/:periodId` | `implemented` | §4.2.3 | Rute mengembalikan PII tetap ke semua pemanggil tersesi (`SEC-06`) + tanpa cek permission (`SEC-05`). |
| GET | `/academic/transcript` | `implemented` | §4.2.4 | Sama: `SEC-05` + `SEC-06` (`transcript/route.ts:152-160`). |
| POST | `/academic/grading` | `implemented` | **§4 belum ada** | Input/finalisasi nilai dosen (`academic/grading/route.ts`). Tidak ada di §4 maupun pohon lama → **tulis §4.2.8** (atau pindahkan ke §4.6 gugus nilai). Baris `LOCKED` masih bisa ditimpa (`SEC-02`). |
| GET | `/academic/krs/current` | `spesifikasi-hilang` | §2.5 (contoh) | Ada di pohon lama, tidak pernah dispesifikasi. Sekarang dirujuk sebagai pembawa `stateMachine` di §2.5 → **wajib ditulis §4.2.9** sebelum dipakai UI. |
| POST | `/academic/krs/waitlist/join` | `spec-only` | §4.2.5 | BR-A10; butuh Redis Lua + BullMQ sebelum dibuka (AGENTS §3.7). |
| DELETE | `/academic/krs/waitlist/leave` | `spec-only` | §4.2.6 | — |
| POST | `/academic/krs/withdraw` | `spec-only` | **belum ada** | Izinnya sudah ada (`enrollment.krs.withdraw`, `packages/contracts/src/authz.ts:260`) tetapi tidak ada rutenya di dokumen mana pun (RD-33) → tambahkan §4.2.10 sekaligus menutup gap "KRS tidak punya rute drop". |
| POST | `/academic/krs/submit` **(bentuk target `202`)** | `spec-only` | §4.2.11 | Rute yang sama, **kontrak lain**: `202 + opId` + `Retry-After`, dirilis lewat feature flag per tenant. Yang hidup hari ini tetap `201` final (§5.13). |
| GET | `/ops/:opId` | `spec-only` | §4.2.13 | Pembaca state operasi `QUEUED/PROCESSING/SUCCEEDED/FAILED/EXPIRED`; sumber kebenaran akhir, aman di-poll. |
| GET | `/academic/krs/stream` | `spec-only` | §4.2.12 | SSE; kelas non-envelope **keempat** (§1.1); auth via cookie http-only, tiket sekali-pakai hanya sebagai fallback. |
| POST | `/academic/krs/stream-ticket` | `spec-only` | §4.2.14 | Tiket opaque TTL 30 dtk, sekali-pakai, terikat (user, opId). |
| POST | `/academic/krs/lease` | `spec-only` | §4.2.14 | Pegang kursi (TTL 30 dtk default); idempoten pada lease aktif. |
| DELETE | `/academic/krs/lease/:classId` | `spec-only` | §4.2.14 | Lepas eksplisit; tidak membatalkan `opId` yang sudah `PROCESSING`. |
| GET | `/academic/krs/queue-position` | `spec-only` | §4.2.14 | Estimasi posisi; baca replica hanya bila bukan read-your-writes. |

### 5.3 Presensi — `/api/v1/attendance/*`

| Metode | Rute | Status | § | Catatan & bukti |
|---|---|---|---|---|
| POST | `/attendance/qr/generate` | `implemented` | §4.3.1 | **Signing oracle**: `sessionId`/`classId`/koordinat/radius diambil dari body, tidak ada cek penugasan (`SEC-03`). |
| POST | `/attendance/qr/scan` | `implemented` | §4.3.2 | Petakan hasil ke `QR_TOKEN_INVALID` (baris 8) alih-alih `VALIDATION_FAILED`. |
| GET | `/attendance/sessions/:id/stats` | `spesifikasi-hilang` | **belum ada** | Ada di pohon lama, tidak pernah dispesifikasi, tidak ada di kode. **Cabut atau tulis §4.3.3.** |
| GET | `/attendance/history` | `spesifikasi-hilang` | **belum ada** | Sama: pohon lama saja. **Cabut atau tulis §4.3.4** (kontrak list §2.4) — gugus anti-spoofing sengaja mengambil §4.3.6–§4.3.9 agar §4.3.3/§4.3.4 tetap bebas untuk dua rute ini. |
| POST | `/attendance/sessions/:sessionId/challenge` | `spec-only` | §4.3.6 | Penerbit tantangan 5 dtk; `windowIndex`/`algorithmVersion`/`keyVersion` dihitung server; **wajib** L4 `class_assignments` — inilah yang menutup oracle tanda tangan `SEC-03`. |
| POST | `/attendance/scan` | `spec-only` | §4.3.7 | Path final. Radius dari **koordinat ruang milik server**, ±1 window, BSSID allowlist, device integrity; `/attendance/qr/scan` jadi alias sementara. |
| POST | `/attendance/appeals` | `spec-only` | §4.3.8 | Pemohon = mahasiswa; izin pengajuan **usulan — belum di katalog** (`G-15`). |
| GET | `/attendance/appeals` | `spec-only` | §4.3.8 | List amplop §2.4 (filter `sessionId`, `status`). |
| GET | `/attendance/appeals/:id` | `spec-only` | §4.3.8 | Detail + riwayat keputusan + `sessionState` (bukan `stateMachine`; tidak ada mesin SM untuk presensi — §4.3.9 butir 7). |
| POST | `/attendance/appeals/:id/decision` | `spec-only` | §4.3.8 | `VALIDATE` **hanya** pengampu kelas itu (scope `CLASS`) dan ≠ pencatat presensi; tolak `403 SELF_APPROVAL_FORBIDDEN` (baris 56). |

> **Gugus multi-modus §4.18 tidak didaftar di sini.** `POST /attendance/events/lms`, `POST /webhooks/lms/{provider}`, `GET /attendance/{sessionId}/reconciliation` (+ `…/decide`) dan pembacaan `POST /attendance/scan` untuk kanal daring ditempatkan di **§5.15** bersama gugus §4.16–§4.17, agar satu siklus pengerjaan punya satu rumah inventaris (§4.13 malam, §5.14 penutup). §4.3.6–§4.3.9 tetap pemilik kontrak scan/Tantangan — §4.18 **merujuk**, tidak menduplikasi.

### 5.4 LMS — `/api/v1/lms/*` (semua `spec-only`)

| Metode | Rute | Status | § | Catatan |
|---|---|---|---|---|
| GET | `/lms/classes/:classId/sessions` | `spec-only` | §4.4.1 | Responsnya array murni — saat diimplementasi, ikut amplop `data` + `meta.pagination` §2.4. |
| POST | `/lms/sessions/:sessionId/progress` | `spec-only` | §4.4.2 | BR-A13. |
| POST | `/lms/assignments/:assignmentId/submit` | `spec-only` | §4.4.3 | Ganti `fileUrl` → `attachmentId` (§4.8.5 butir 6). |

### 5.5 Entitlement — `/api/v1/tenant/modules*`

| Metode | Rute | Status | § | Catatan & bukti |
|---|---|---|---|---|
| GET | `/tenant/modules` | `implemented` | §4.5 | Belum berpaginasi (array penuh, sah per §2.4g). Guard permission belum terpasang (`SEC-05`); aktivasi mengabaikan paket/kuota (`SEC-08`). |
| GET | `/tenant/modules/catalog` | `spec-only` | §4.5 | Terdaftar di §4.5, tidak ada berkasnya → tambahkan handler atau coret. |
| POST | `/tenant/modules/:code/activate` | `implemented` | §4.5 | `422 MODULE_DEPENDENCY_UNMET` nyata (`activate/route.ts:65`). |
| POST | `/tenant/modules/:code/deactivate` | `implemented` | §4.5 | `409 MODULE_IN_USE` nyata (`deactivate/route.ts:66`); `force` cascade tersedia. |

### 5.6 Kesehatan & kesiapan layanan — `/api/v1/health*`

| Metode | Rute | Status | § | Catatan & bukti |
|---|---|---|---|---|
| GET | `/health` | `implemented` | **belum dispesifikasi di §4** | Liveness; **tidak** memakai envelope §2.1 (`{status, version, uptimeSec}` — `health/route.ts:11-18`). Wajib dikecualikan secara eksplisit dari §2. Waspada: prober tidak boleh menerima bentuk envelope. |
| GET | `/health/ready` | `implemented` | **belum dispesifikasi di §4** | Readiness; probe `db` (required) + `redis`/`storage` (degradable) → `down` = 503 (`health/ready/route.ts:18-57`, `health.service.ts:24-28`). Deviasi: belum ada cek **replica** & **queue** yang dituntut AGENTS §3.7. |

### 5.7 Pembayaran (webhook) — lihat §4.7

| Metode | Rute | Status | § | Catatan |
|---|---|---|---|---|
| POST | `/payments/webhook/midtrans` | `spec-only` | §4.7 | Signature SHA512 + guard panjang; kontrak anti-duplikasi W-1…W-10 di §4.7.7. |
| POST | `/payments/webhook/xendit` | `spec-only` | §4.7 | `x-callback-token` / `x-signature`; dedup `event_id` (§4.7.7 W-3). |

### 5.8 Berkas — lihat §4.8

| Metode | Rute | Status | § | Catatan |
|---|---|---|---|---|
| POST | `/uploads/presign` | `spec-only` | §4.8.1 | Kategori & batas di §4.8.2. |
| POST | `/uploads/confirm` | `spec-only` | §4.8.5 | Bukti HEAD + digest sebelum `AVAILABLE`. |
| GET | `/uploads/:id` | `spec-only` | §4.8.5 | Metadata saja. |
| GET | `/uploads/:id/url` | `spec-only` | §4.8.5 | Presigned GET TTL 60 dtk, ber-guard. |

### 5.9 Verifikasi publik & state machine

| Metode | Rute | Status | § | Catatan |
|---|---|---|---|---|
| GET | `/public/verify/:digest` | `spec-only` | §4.9 | Tanpa auth, rate-limited, PII minimal; menolak dokumen `REVOKED`/`EXPIRED`. |
| GET | `/state-machine/:type/:id` | `spec-only` | §2.5 | Pembacaan tunggal untuk `StateMachineStrip`. |
| GET | `/documents/print/:type` | `spesifikasi-hilang` | **§4.15 (direzerwasi)** | Muncul **hanya** di `docs/INDEX.md:88` (FR-AKA-14); tidak ada di §4, tidak ada di kode (RD-33). Nomornya pindah dari §4.14 ke §4.15 pada 2026-10-20 karena §4.14 kini memegang gugus master data dinamis & atribut kustom (lihat §4.13 dan §4.15). Tulis **§4.15** atau cabut dari INDEX — jangan biarkan rezerwasi itu hilang diam-diam. |

### 5.10 Administrasi & data master — `/api/v1/admin/*` (seluruhnya `spec-only`)

Ditelusuri dari §4.6. **Tidak satu pun** rute `/admin/**` punya handler: `find apps/web/src/app/api/v1 -name "route.ts"` tidak menghasilkan satu pun berkas di bawah `admin/`. Jangan menyalin rute ini sebagai "sudah ada".

| Gugus | Rute | Status | § |
|---|---|---|---|
| Pola CRUD (32 objek) | `GET/POST /admin/<objek>`, `GET/PATCH/DELETE /admin/<objek>/:id`, `POST …/deactivate`, `POST …/impact` | `spec-only` | §4.6 (pola), §4.6.1 (contoh list) |
| Status periode | `POST /admin/periods/:id/status` | `spec-only` | §4.6.2 |
| Reopen | `POST /admin/periods/:id/reopen` | `spec-only` | §4.6.6 |
| Aksi massal | `POST /admin/classes/generate`, `/sessions/generate`, `/schedules/validate`, `/class-assignments`, `/student-status/bulk`, `/grades/lock`, `/grades/publish`, `/grades/unlock`, `/grades/recompute` | `spec-only` | §4.6.3, §4.6.6 |
| KRS admin | `POST /admin/krs/dispense`, `/krs/amendments`, `/krs/amendments/:id/approve` | `spec-only` | §4.6.6 |
| Presensi admin | `POST /admin/attendance/appeals`, `/appeals/:id/decision` | `spec-only` | §4.6.6 |
| Kartu ujian | `POST /admin/exam-cards/generate`, `GET /admin/exam-cards/:id/pdf` | `spec-only` | §4.6.6 |
| Nilai per komponen | `GET/POST /admin/grade-components/:classId/scores` | `spec-only` | §4.6.6 |
| MBKM | `POST /admin/mbkm/contracts`, `/contracts/:id/approve`, `/approve-mitra`, `/logs/:id/validate`, `/conversions` | `spec-only` | §4.6.6 |
| Clearance | `POST /admin/clearances/:studentId/dimensions`, `/clearances/:id/close` | `spec-only` | §4.6.6 |
| Kelulusan | `POST /admin/graduation/eligibility-check`, `/graduation/:id/yudisium`, `/sign`, `/pisn` | `spec-only` | §4.6.6 |
| Feeder PDDikti | `POST /admin/feeder/validate`, `/push`, `/corrections`, `GET /admin/feeder/runs/:id` | `spec-only` | §4.6.6 |
| Impor | `POST /admin/imports/validate`, `/commit`, `GET /admin/imports/:id` | `spec-only` | §4.6.4 |
| Hak akses & identitas (M-03) | 34 rute §4.6.9: pengguna, peran, penugasan, permintaan hak, `/me/**` | `spec-only` | §4.6.9 |
| Audit | `GET /admin/audit-logs` | `spec-only` | §4.6 (baris 21) — **READ-only**, tidak ada rute tulis (AC-AUD-1) |
| Kamus dinamis (baca) | `GET /master/lookups`, `GET /master/lookups/groups` | `spec-only` | §4.14.1 — prefix `/master/**` **belum pernah ada** di `apps/web/src/app/api/v1`; `0047` belum berberkas |
| Kamus dinamis (tulis admin) | `GET /admin/master/lookups/groups`, `GET/POST/PUT/DELETE /admin/master/lookups`, `POST /admin/master/lookups/items/{id}/merge`, `GET /admin/master/lookups/impact?kind=` | `spec-only` | §4.14.2 — `DELETE`/`VALIDATE` belum berkatalog (`G-14`); dasar dampak = `reference_kind_usage` |
| Atribut kustom | `GET/POST /admin/master/custom-attributes`, `GET/PATCH /{id}`, `PUT /{id}/activate`, `PUT /{id}/retire`, `POST /{id}/validate-values`, `GET/PATCH /{entity}/{id}/attributes`, `GET /{entity}/{id}/attributes/history` | `spec-only` | §4.14.3–§4.14.4 — `0048` belum berberkas; izin `settings.customattr.*` **belum menjadi baris** `RBAC_MATRIX §4.5` |
| Objek institusi gelombang 2 & engine | `admin/sites`, `admin/final-project-kinds`, `admin/final-project-outputs`, `admin/fee-tariff-groups`, `admin/tuition-tariff-matrix` (+ `POST /preview`, §4.6.8), `admin/timetabling-constraints`, `admin/lecturer-availability`, `admin/assessment-indicators/{id}/rubric-bands`, `admin/cpl-targets`, `admin/obe-closing-actions`, `admin/feeder-autofix-*`, `admin/feeder-identity-matches`, `admin/feeder-sync-watermarks`, `admin/attendance-network-allowlists`, `admin/attendance-device-bindings`, `admin/advisor-notes`, `admin/ml-models`, `admin/audit-anchors`, `admin/audit-verifications`, `admin/engine/**` | `spec-only` | §4.6.7, §4.6.8, §6.10 — daftar per gugus + DDL + status izin ada di **§5.14**; jangan menambah baris inventaris di luar itu |
| Mesin parameter sistem dinamis | `admin/system-parameters` (+ `/{key}`, `/register`, `/patterns`, `/{key}/request-approval`, `/{key}/revert`, `/{key}/history`, `/{key}/impact`, `PATCH /{key}/toggle-active`), `admin/system-parameter-approvals` (+ `/{id}/approve`, `/{id}/reject`), `settings/effective` | **`implemented` — 11/11 rute `DB`** (terukur `.tools/handler-inventory.mjs --json`, 2026-10-23; `/patterns` masih `spec-only`) | §4.16 — DDL `0049`+`0086`+`0088`+`0090` sudah diterapkan di dev; izin `settings.param.*` **lahir** ke `PERMISSION_SPECS` + seed (`0089`, katalog 262 izin); sisa yang belum: rute `/patterns` (`SPE-7`) dan 19 kunci modul yang nilainya belum punya pembaca (`SYSTEM_PARAMETER_DEFERRED`, `RD-138`) |
| Menu dinamis & grant | `me/menu`, `admin/platform/menus` (+ `/{id}`, `/{id}/permissions`, `/impact`) | `spec-only` | §4.17 — **§5.15**; `0050`; **penyaringan menu bukan kontrol akses** (§4.17 norma 1–4); izin `platform.menu.*` **belum lahir** |
| Presensi multi-modus & rekonsiliasi | `attendance/events/lms`, `webhooks/lms/{provider}`, `attendance/{sessionId}/reconciliation` (+ `…/{studentId}/decide`) | `spec-only` | §4.18 — **§5.15**; `0049` (`attendance_evidence`, `attendance_source` `LMS_ACTIVITY`/`WEBHOOK_EVENT`); ingest **wajib `503`** sebelum `0049` dieksekusi; vault & batch flush = **design-only** |

### 5.11 Keuangan enterprise, VA, MBKM & OBE — `/api/v1/finance/*`, `/api/v1/mbkm/*`, `/api/v1/curricula/*`, `/api/v1/reports/obe/*` (seluruhnya `spec-only`)

Tidak ada satu pun berkas handler di bawah `finance/`, `mbkm/`, `curricula/`, `reports/` (diukur: `ls apps/web/src/app/api/v1` = `academic`, `attendance`, `auth`, `health`, `tenant`). Semua baris di bawah adalah kontrak target; sebagian bahkan **tidak dapat dibuka** sebelum izinnya dipromosikan (`G-15`).

| Gugus | Rute | Status | § | Gerbang yang belum ada |
|---|---|---|---|---|
| Dispensasi | `POST/GET /finance/dispensations`, `GET /finance/dispensations/:id`, `POST …/:id/approve`, `…/academic-ok`, `…/reject`, `…/cancel` | `spec-only` | §4.10.1 | izin `finance.dispensation.*` usulan; `DEKAN` tanpa scope (`G-13`) |
| Keringanan | `POST/GET /finance/waivers`, `POST …/:id/approve`, `…/reject` | `spec-only` | §4.10.2 | `.approve` **terdaftar** (`authz.ts:320`); `.reject` usulan (`K-3`) |
| Virtual Account | `POST/GET /finance/virtual-accounts`, `GET …/:id`, `POST …/:id/cancel`, `DELETE …/:id` | `spec-only` | §4.10.3 | `finance.va.*` usulan; tabel `virtual_accounts` tanpa DDL |
| Cicilan & jadwal | `GET /finance/invoices/:id/schedule`, `POST …/:id/installments` | `spec-only` | §4.10.4 | `installment.create/.view` **terdaftar**; denda = baris ledger, bukan sunting nominal |
| Batal bayar | `POST /finance/payments/:id/cancel` | `spec-only` | §4.7.8(b) | `payment.confirm` (`VALIDATE`) terdaftar; jendela `tenant_settings.payment_cancellation_window_days` belum ada |
| Ekspor | `POST /finance/dispensations/export`, `GET /finance/exports/:jobId` | `spec-only` | §4.10.5 | `OTHER` dengan resource; `finance.export.run` usulan |
| MBKM konversi | `GET/POST /mbkm/conversions`, `POST …/:id/evaluate`, `…/approve`, `…/approve-mitra`, `…/reject` | `spec-only` | §4.12.1 | `mbkm.*` **NON-NORMATIF** (`RBAC §4.3`, `G-15`); DDL `0033_mbkm_conversion.sql` **sudah ditulis**, berkas migrasi belum ada |
| OBE matriks | `GET/POST /curricula/:id/outcome-matrix`, `POST …/outcome-matrix/validate` | `spec-only` | §4.12.2 | penyetuju kurikulum `VALIDATE` usulan; rantai outcome = `0032` |
| OBE capaian | `GET /reports/obe/attainment` | `spec-only` | §4.12.2, §6.10.7 | snapshot `calculatedAt` + baca Replica; `coverage` wajib tampil |

### 5.12 Rekap terukur

| Kelas | Jumlah | Rincian |
|---|---:|---|
| `implemented` | **18** | 5 auth · 6 academic · 2 attendance · 3 tenant/modules · 2 health — sama persis dengan 18 berkas `route.ts` hasil `find` di atas |
| `spec-only` | **28 daun non-admin + 14 gugus admin + 9 gugus keuangan/MBKM/OBE + 21 gugus §5.14 + 13 baris §5.15** | Non-admin: 3 rute KRS lama (waitlist ×2, withdraw) · **7 baris gugus war §4.2.11–§4.2.14** (`submit` bentuk `202`, `/ops/:opId`, `stream`, `stream-ticket`, `lease` POST, `lease/:classId` DELETE, `queue-position`) · **6 baris anti-spoofing §4.3.6–§4.3.8** (`challenge`, `/attendance/scan`, `appeals` ×4) · 3 LMS · 1 katalog modul · 2 webhook · 4 unggah · 2 publik/state-machine. Admin (§5.10): 14 gugus — gugus pertama saja berupa pola 7 metode × 32 objek (~224 daun potensial) **plus 3 gugus baru §4.16–§4.18 yang menunjuk §5.15**. §5.11: 9 gugus keuangan/VA/MBKM/OBE. §5.14 (disusun 2026-10-20): **21 gugus / ±80 daun** tambahan dari objek institusi `DATA_MODEL §19`, engine gelombang 2 `§18`, dan master data dinamis `§20`. §5.15 (disusun 2026-10-20, malam): **13 baris / ±27 daun** untuk mesin parameter §4.16, menu dinamis & grant §4.17, dan presensi multi-modus §4.18 — **nol** di antaranya `implemented`. Jumlah daun **tidak dinyatakan pasti** karena §4.6, §5.11, §5.14 dan §5.15 mendefinisikannya sebagai pola/gugus, bukan daftar rute satu per satu |
| `spesifikasi-hilang` | **4** | `GET /academic/krs/current` · `GET /attendance/sessions/:id/stats` · `GET /attendance/history` · `GET /documents/print/:type` (nomornya kini **§4.15**, lihat §4.13) |
| Kode error terdaftar di §2.3 | **149** | 65 lama + 13 engine gelombang 1 (66–78) + 13 engine gelombang 2 & objek institusi (79–91) + **15** kamus/atribut kustom dan sisa keadaan gelombang 2 (92–106) + **12** mesin parameter, menu dinamis & presensi multi-modus (§4.16–§4.18) = 107–118 + **26** gugus 47 modul (§7.22) dan `MFA_NOT_IMPLEMENTED` = 119–144 + **5** kanal vicon (§4.19) = 145–149. Terukur `node .tools/error-dup.mjs` (2026-10-21): **149 baris bernomor, 149 unik, tanpa lubang**, dan 58 baris tabel turunan cocok nama↔nomor dengan register (gerbang `error-dup: HIJAU`). Yang **benar-benar dikirim** sebagai `error.code` hari ini tetap **12** (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28); 137 sisanya adalah kontrak yang belum pernah dipancarkan |
| `implemented` **tetapi tanpa** §4 | **3** | `POST /auth/logout` · `POST /academic/krs/approve` · `POST /academic/grading` — handler hidup, kontrak tidak ada |
| `implemented` **dengan kontrak ganda** | **1** | `POST /academic/krs/submit` — hidup sebagai `201` final (§4.2.2) **dan** dispesifikasi sebagai `202 Accepted` (§4.2.11); keduanya sah selama transisi feature flag, dan **hanya satu** yang aktif per tenant per waktu |

### 5.13 Δ implementasi gugus enterprise — nyata vs spesifikasi (diukur 2026-10-19, baris bertanggal 2026-10-20 diukur ulang pada hari itu juga, bukan diasumsikan)

Mengikuti gaya §2.4f: kolom pertama adalah **fakta terukur di repo**, kolom kedua konsekuensi yang mengikat pengerjaan. Tidak ada baris yang boleh dibaca sebagai "sudah aman".

| Fakta di kode | Konsekuensi terhadap spesifikasi di dokumen ini |
|---|---|
| `bullmq` dan `ioredis` **bukan** dependensi; `grep -r "text/event-stream" apps/web/src` = 0; `grep -r "Idempotency-Key"` = 0 | Seluruh §4.2.11–§4.2.14 adalah target. Yang berjalan hari ini = §4.2.2 `201` final + `pg_advisory_xact_lock` (`krs.service.ts:371`), pengecualian berjangka `AGENTS §3.8`/`RD-11`/`P-6`. **Dilarang** membalik jalur sebelum antrean + idempotensi + DLQ terpasang |
| `krs/submit/route.ts:90` menjawab `result.created.length > 0 ? 201 : 200` | Migrasi ke `202` **wajib** lewat feature flag per tenant dan klien membaca `data.mode`, bukan status code saja (§4.2.11) |
| `CLASS_FULL` hanya hidup sebagai `kind` service (`krs.service.ts:74,417`) dan **diratakan** menjadi `409 CONFLICT` oleh `krs/submit/route.ts:74-78` | Baris 36 §2.3 tetap berstatus `kind` sampai transport mengirim `errorCode` langsung (aturan pemeliharaan §2.3 butir 2). Gugus war tidak boleh mengklaim `CLASS_FULL` terkirim |
| `MODULE_NOT_AVAILABLE` = konstanta kontrak (`entitlement.ts:70`) dengan **nol** call site `withModule` (`SEC-09`) | Semua rute baru (§4.2.11–§4.12) menuntut gerbang entitlement **nyata** lebih dulu; role tidak memotong sebelum modul (`AGENTS §3.8`) |
| `holdsScoped()` tersedia tetapi **tidak pernah dipanggil**; `requireDataPrincipal` belum terhubung rute (`SEC-10`, `SEC-11`) | L3/L4 pada setiap rute baru adalah pekerjaan yang belum dimulai — bukan formalitas. Empat titik kegagalan (§4.11 butir 8) adalah gate CI |
| `qr/generate` menerima `sessionId`/`classId`/`latitude`/`longitude`/`radiusMeters` dari body dengan guard hanya `requirePermission(PERM.attendanceQrGenerate)` | Inilah **oracle tanda tangan** `SEC-03` yang dihapus oleh §4.3.6. Rute lama tidak boleh dipertahankan sebagai "alternatif" setelah §4.3.6 hidup |
| `attendances` **tidak punya kolom token** mana pun (`packages/database/src/schema/enrollments.ts:66-99`) | Anti-replay §4.3.7 butir 3 tidak dapat ditegakkan permanen tanpa perluasan skema; kolom diusulkan di §4.3.9 butir 2, **DDL & ejaan final milik `DATA_MODEL.md`** |
| Rute scan mengirim `VALIDATION_FAILED` (`qr/scan/route.ts:200-207`), bukan `QR_TOKEN_INVALID` | Baris 8, 60, 61, 62 §2.3 semuanya `spec`; pemetaan per-sebab (token vs geofence vs perangkat) adalah kerja transport yang belum ada |
| Tidak ada rute `/api/v1/finance/**`, `/api/v1/uploads/**`, `/api/v1/ops/**`, `/api/v1/admin/**`, `/api/v1/mbkm/**`, `/api/v1/reports/**` | Seluruh §4.7.7–§4.7.8, §4.8, §4.10, §4.12 dan §5.10/§5.11 = **nol implementasi**. Nama rute di §5.11 tidak boleh dikutip sebagai bukti keberadaan handler |
| `virtual_accounts`, `reconciliation_runs`, `payment_windows`, `attachments`, `documents` **belum punya DDL** (`docs/AUDIT_READINESS.md:179`, `RD-27`) | §4.10.3 dan §4.7.8 hanya boleh digarap **setelah** migrasi `0020/0022` ada; jangan menulis query pada tabel yang belum ada |
| Enum `payment_status` (5 nilai) dan `invoice_status` (7 nilai) **tidak memuat** `SUSPENSE`/`CANCELLED` (`docs/DATA_MODEL.md:2108-2109`) | Kontrak §4.7.8 menahan keadaan itu di `reconciliation_runs`/entri pembalik sampai `DATA_MODEL.md` memperluas enum — bukan memaksakan string baru ke enum |
| Katalog izin = **222** entri `{ key:` di `packages/contracts/src/authz.ts` (terukur); `mbkm.*` hanya ada di `RBAC_MATRIX §4.3` berlabel **NON-NORMATIF** (`G-15`) | Setiap rute §4.10/§4.12 berlabel "usulan — belum di katalog" **tidak dapat** dibuka kodenya sebelum promosi per modul (`P-10`). Ini alasan §5.11 punya kolom "Gerbang yang belum ada" |
| 12 kode benar-benar dipancarkan sebagai `error.code` hari ini (baris 1, 3, 5, 6, 10, 11, 12, 13, 14, 15, 27, 28) | Baris **42–118** yang didaftarkan **tidak** boleh dianggap sudah ada; register §2.3 adalah **target**, dan status per baris terukur pada kolom terakhir tabel itu. 107–118 lahir 2026-10-20 dan seluruhnya `spec` |
| Harness engine **tidak** pernah bernama `0013_engine_algorithms.sql`: nomor `0013` milik `0013_institution_gaps.sql`. Registrasi final ada di `DATA_MODEL §18.1`/`§14.7` = **`0036_engine_algorithms.sql`** | Seluruh rujukan harness di §6 dan §6.10 menunjuk `0036`. Menyalin `0013` sebagai nomor harness melahirkan dua migrasi untuk satu objek — pola `RD-20` yang sudah diperangi; jangan |
| DDL gelombang 2 **sudah ditulis** di `DATA_MODEL §18.2`–`§18.8` (migrasi `0037`–`0043`) dan `§19.1`–`§19.4` (`0044`–`0046`) per 2026-10-20, **tetapi** `packages/database/migrations/` tidak memuat satu pun berkas itu, dan generator RLS §6.2 belum menghasilkan policy untuk tabel-tabel baru | Semua baris §4.6.7, §6.10 dan §5.14 = **`spec-only`**. Klaim "DDL sudah ada" **tidak** sama dengan "sudah berjalan". Urutan yang diizinkan: migrasi ada di repo → policy RLS ter-generator → izin dipromosikan ke `PERMISSION_SPECS` → baru rute ditulis |
| DDL mesin kamus & atribut kustom **sudah ditulis** di `DATA_MODEL §20.3`/`§20.5` sebagai `0047_master_lookup_engine.sql` + `0048_custom_attributes.sql` (2026-10-20), **tetapi** berkasnya tidak ada (`ls packages/database/migrations/` = `0001`, `0002`, `0003`, `0004`, `0005`, `0006`, `0011` — tujuh berkas, diukur) dan **izinnya masih `usulan`** (register `RBAC_MATRIX §4.5` kini mencapai **161** dan memuat baris 127–145 untuk gugus ini (`master.kind.view/.manage`, `master.item.view/.create/.update/.deactivate/.reorder/.merge`, `master.impact.view`, `master.usage.view`, `master.lookup.consume`, `settings.customattr.*`) — sementara `authz.ts` tetap **222** kode, jadi belum ada yang dipromosikan; ralat lengkap §4.14.6 butir 2) | Seluruh §4.14 dan §5.14 = **`spec-only`**. Yang hari ini nyata hanyalah `reference_kinds`/`reference_items` dasar (§14.2) **tanpa** kolom mesin (`api_group_code`, `input_kind`, `max_selections`, `validation_regex`, `merged_into_id`, `points`, …) — jadi `GET /master/lookups?group=` belum dapat membaca satu pun kolom yang kontraknya tulis di sini. Ini alasan §5.14 punya kolom "DDL" dan bukan hanya "§" |
| `virtual_accounts`, `reconciliation_runs`, `payment_windows`, `attachments`, `documents`, `pmb_paths`, `pmb_waves`, `idempotency_keys`, `queue_operations` **masih tanpa DDL** (`docs/AUDIT_READINESS.md:179`, `RD-27`) | Gugus §4.7.7–§4.7.8, §4.8, §4.9, §4.10 dan baris tarif §4.6.7/§4.6.8 yang bergantung padanya **tidak dapat** dibuka sebelum migrasinya ada; `tuition_tariff_matrix` (`0046`) menunjuk `pmb_paths`/`pmb_waves` (`0021`) yang **juga** belum dieksekusi — rantai tunggu, bukan rantai parallel |
| `bullmq`/`ioredis` masih **bukan** dependensi; `POST …/runs` membutuhkan worker; penahan sekali-pakai `attendance_token_uses` (`UNIQUE (tenant, session, counter)`) adalah DB-backed tetapi laju 3.000 scan/menit pada puncak menuntut Redis | Seluruh §6.10.1 (run/status/batal/hasil) dan §6.10.6 (ALG-12) memikul pengecualian berjangka yang sama dengan §4.2.11–§4.2.14 (`RD-11`, `P-6`). Mode turun ALG-12 adalah **tolak presensi** (`503`, baris 88), bukan terima tanpa sekali-pakai |
| Nama yang **sudah divonis kalah** dan tidak boleh lahir sebagai rute kembar: `grade_audit_logs` (yang ada `grade_change_logs`, `0034`), `program_types` (yang ada `reference_items(kind='jenis_program')`, `0044`), `pddikti_validation_runs` (**view** atas `pddikti_sync_runs`, §16.4.4 — bukan tabel), `assessment_items`/`outcome_items` (yang ada `grade_components`, `0032`) | §4.6.7, §6.10.4 dan §6.10.8 hanya boleh menunjuk pemenang. Menambahkan endpoint untuk nama yang kalah = membuat sumber kebenaran kedua (`RD-32`), dan itu temuan review, bukan fitur |
| Berkas rujukan integrasi yang nyata adalah `docs/INTEGRATIONS.md`; `docs/INTEGRATION_SPEC.md` **tidak pernah ada** di repo | Semua rujukan kanal Feeder/payment di §4.7, §6.10.4 dan §4.6.7 menunjuk `INTEGRATIONS.md`. Perbaikan dilakukan pada kalimat dokumen ini, bukan pada asumsi agen yang membaca nama file fiktif |
| **Diukur 2026-10-20 untuk §4.16–§4.18:** `ls apps/web/src/app/api/v1` = `academic`, `attendance`, `auth`, `health`, `tenant` — **tidak ada** `admin/`, `settings/`, `me/`, `master/`, `webhooks/`; `grep -rniE` dengan pola `master_system_parameters`/`system-parameters`/`settings/effective`/`menu_items`/`attendance_evidence`/`route_key`/`routeKey` atas `apps/web/src`, `packages/contracts/src`, `packages/database/src` = **0** hasil | Seluruh §4.16, §4.17, §4.18 = **`spec-only`**; tidak satu pun rute boleh ditulis seolah ada. Prefix `/me/**` (menu konsumsi) dan `/webhooks/lms/**` (kanal vendor) **belum pernah ada bentuknya sama sekali** di dokumen ini sebelum siklus ini, sehingga tidak ada rujukan lama yang patah |
| **Ambang yang akan dipindah ke mesin parameter hari ini adalah konstanta keras:** `attPct >= 75` (`apps/web/src/modules/academic/services/dashboard.service.ts:263`), `const ttlSeconds = 30` dan `radiusMeters: z.number().min(10).max(500).default(50)` (`apps/web/src/app/api/v1/attendance/qr/generate/route.ts:29,65`), `accuracyMeters: z.number().min(0).max(500)` (`attendance/qr/scan/route.ts:34`) | §4.16 tanpa langkah "ganti konstanta dengan pembaca resolver" = layar Admin yang menulis angka tak bersaksi. **Temuan lintas dokumen yang harus diputuskan pemilik skema (bukan wewenang dokumen ini):** `attendance.gps_max_accuracy_m` dibakukan **50** dengan rentang 5–200 (`DATA_MODEL §21.3`), kontrak scan §4.3.7 membatasi akurasi di **100**, dan rute hari ini mengizinkan sampai **500** — tiga angka untuk satu keadaan. Dokumen ini **tidak** membulatkan salah satunya; ia mendaftarkan selisihnya (`§4.18.6 butir 10`), dan `DATA_MODEL` + implementasi yang menutup |
| `attendance_evidence`, `menu_items`, `menu_permissions`, `parameter_permissions`, `master_system_parameters`, `master_system_parameter_history` **tanpa DDL di repo** (`DATA_MODEL §21.2`/`§21.7` menulisnya sebagai **`0049_system_parameters.sql`** dan **`0050_menu_parameter_permissions.sql`**, `ls packages/database/migrations/` = 7 berkas) | §4.18.2 **wajib** `503` sebelum `0049` ada (menerima-atau-membuang bukti = menghilangkan dasar banding); §4.17 tidak dapat dibaca sebelum `0050` ada (tidak ada tabel = tidak ada pohon); §4.16 tidak dapat membuka layar sebelum `0049` + seed katalog §21.3. Rantai tunggu, bukan paralel: `0049` mendahului `0050` (`DATA_MODEL §14.7`) |
| Tidak ada tautan `user_ref vendor → mahasiswa` di skema mana pun | §4.18.3 penjaga 4: kanal **vendor** hanya dapat menyimpan `event_digest` audit transport dan **tidak** dapat menghasilkan bukti kehadiran sampai penampungnya ditulis di `DATA_MODEL §21`. Ini tagihan ke dokumen skema, bukan sesuatu yang boleh ditambal rute |

Tuduhan RD-33 "pohon lama memuat 4 endpoint yang tidak pernah dispesifikasi" terverifikasi dan sekarang **semuanya berlabel**: `POST /auth/logout` (masuk daftar `implemented` tanpa §4), `GET /academic/krs/current`, `GET /attendance/sessions/:id/stats`, `GET /attendance/history` (masuk `spesifikasi-hilang`). Satu tambahan ditemukan selama regenerasi: `GET /documents/print/:type` hanya hidup di `docs/INDEX.md:88`.

**Aturan perawatan §5 (agar tidak basi lagi)**

1. Tabel ini **dihasilkan**, bukan ditulis tangan: generator memuat daftar `route.ts` (`apps/web/src/app/api/v1/**`) + daftar operasi OpenAPI hasil compile Zod, lalu menandai `implemented`/`spec-only` otomatis. Sampai generator itu ada (RD-33/`ROADMAP` DOC-0), setiap PR yang menambah/menghapus rute **wajib** mengubah baris tabel ini — reviewer menolak PR yang menambah handler tanpa baris §5.
2. Baris `spesifikasi-hilang` **tidak boleh** dibiarkan lebih dari satu iterasi: tulis §4-nya, atau cabut rutenya dari dokumen/`INDEX.md`.
3. Nama rute di tabel memakai **path final** (`study-programs`, bukan `prodi`) konsisten dengan §4.6.
4. Setiap baris `implemented` membawa bukti `file:line` pada catatannya; klaim status tanpa bukti dihapus (aturan `[KODE]` di `AUDIT_READINESS.md` §0).

### 5.14 Inventaris rute gelombang 2, objek institusi §19, dan master data dinamis §4.14 (seluruhnya `spec-only`) — disusun 2026-10-20

**Tidak satu pun baris di bawah punya handler.** Diukur: `apps/web/src/app/api/v1` hanya berisi `academic`, `attendance`, `auth`, `health`, `tenant` (18 `route.ts`, nol di bawah `admin/`), dan `packages/database/migrations/` hanya berisi `0001`–`0006` + `0011`. Kolom **DDL** menyebut nomor migrasi milik `DATA_MODEL` — "ditulis" berarti teks DDL-nya ada di dokumen itu, **belum** berarti berkasnya ada di repo atau policy RLS-nya terpasang. Kolom **Antre** menandai rute yang bergantung `bullmq`/`ioredis`: seluruhnya **design-only** (`RD-11`, `P-6`) dan **tidak boleh** diklaim berjalan sampai kedua paket itu menjadi dependensi nyata di `package.json` + lockfile.

| Gugus | Rute | § | DDL (`DATA_MODEL`) | Antre | Izin |
|---|---|---|---|:---:|---|
| **Kamus: baca terdinamis** | `GET /master/lookups`, `GET /master/lookups/groups` | §4.14.1 | `0047` (ALTER `reference_kinds`, view `security_invoker`) | Tidak | `academic.reference.view` **terdaftar** (`authz.ts:185`), nol call site |
| **Kamus: tulis admin** | `GET /admin/master/lookups/groups`, `GET/POST/PUT/DELETE /admin/master/lookups`, `POST /admin/master/lookups/items/{id}/merge`, `GET /admin/master/lookups/impact?kind=` | §4.14.2 | `0047` + `reference_kind_usage` (global, pengecualian RLS tercatat) | Tidak | tulis = `academic.reference.manage` (`authz.ts:186`, `UPDATE`); **`DELETE` dan `VALIDATE` belum ada di katalog mana pun** (`G-14`); `academic.impact.view` (`authz.ts:228`) terdaftar untuk `impact` |
| **Atribut kustom: definisi** | `GET/POST /admin/master/custom-attributes`, `GET/PATCH /{id}`, `PUT /{id}/activate`, `PUT /{id}/retire`, `POST /{id}/validate-values` | §4.14.3 | `0048` | Tidak | terdekat yang nyata = `settings.meta.view`/`.update` (`authz.ts:362-363`); `settings.customattr.*` **belum menjadi baris** `RBAC_MATRIX §4.5` |
| **Atribut kustom: nilai** | `GET/PATCH /{entity}/{id}/attributes`, `GET /{entity}/{id}/attributes/history` (`{entity}` ∈ students, lecturers, staff, rooms, courses, invoices) | §4.14.4 | `0048` (ALTER `attributes jsonb` + GIN) | Tidak | hak objek per entitas (`academic.student.*`, `finance.invoice.*`) + **hak tingkat field** `role_view`/`role_edit` (belum ber-`FIELD_RULES`) |
| Multi-site | `GET/POST/PATCH/DELETE /admin/sites`, `POST /admin/sites/{id}/deactivate`, `POST /admin/sites/{id}/impact`, `PATCH /admin/role-assignments/{id}/scope-site` | §4.6.7 | `0044` | Tidak | 108–112 **usulan** |
| Jenis program | `GET/POST/PATCH /admin/reference-kinds/jenis_program/items` (kamus + kolom `program_type`/`delivery_mode`) | §4.6.7 | `0044` (ALTER) | Tidak | 113–114 **usulan**; tabel `program_types` **kalah** |
| Tugas Akhir 53/2023 | `GET/POST/PATCH/DELETE /admin/final-project-kinds`, `POST /{id}/approve`, `GET/POST /admin/final-project-outputs`, `POST /{id}/validate`, `POST /{id}/retract` | §4.6.7 | `0045` | Tidak | 115–120 **usulan**; modul `thesis` memotong lebih dulu (26) |
| Kelompok tarif & matriks UKT | `GET/POST/PATCH/DELETE /admin/fee-tariff-groups`, `POST /{id}/deactivate`, `GET/POST /admin/tuition-tariff-matrix`, `PATCH /{id}`, `POST /{id}/approve`, `POST /{id}/retire`, `GET /resolve-preview`, **`POST /preview`** | §4.6.7, §4.6.8 | `0046` (tertahan `0021`: `pmb_paths`, `pmb_waves`) | Tidak | 121–126 **usulan** |
| Kendala jadwal | `GET/POST/PATCH /admin/timetabling-constraints`, `POST /{id}/approve`, `GET /{id}/impact` | §4.6.7 | `0037` | Tidak | 51–54 **usulan** |
| Ketersediaan dosen | `GET/POST/PATCH/DELETE /admin/lecturer-availability`, `POST /admin/lecturer-availability/import` | §4.6.7 | `0037` | Tidak | 60–62 **usulan** |
| Rubrik & target OBE | `GET/POST/PATCH/DELETE /admin/assessment-indicators/{indicatorId}/rubric-bands`, `GET/POST/PATCH /admin/cpl-targets`, `POST /{id}/approve`, `GET/POST /admin/obe-closing-actions`, `POST /{id}/approve`, `POST /{id}/complete`, `POST /{id}/drop` | §4.6.7 | `0042` | Tidak | 93–103 **usulan** |
| Auto-fix Feeder | `GET/POST/PATCH /admin/feeder-autofix-rules`, `POST /{id}/approve`, `POST /{id}/test`, `GET /admin/feeder-autofix-suggestions`, `GET /{id}`, `POST /apply`, `POST /{id}/revert`, `GET /admin/feeder-identity-matches`, `POST /{id}/confirm`, `POST /{id}/reject` | §4.6.7, §6.10.4 | `0040` | Tidak | 76–84 **usulan** |
| Airmen sinkron Feeder | `GET /admin/feeder-sync-watermarks`, `GET /{id}`, `POST /{id}/force-full`, `POST /{id}/reset` | §4.6.7, §6.10.4 | `0040` | Tidak | 85–86 **usulan** |
| Allowlist jaringan presensi | `GET/POST/PATCH/DELETE /admin/attendance-network-allowlists` | §4.6.7, §6.10.6 | `0041` | Tidak | 87–88 **usulan**; BSSID plaintext tidak pernah dari body |
| Perangkat presensi | `GET /admin/attendance-device-bindings`, `GET /attendance/token-uses` | §6.10.6 | `0041` | Ya (penahan sekali-pakai) | 89–90 **usulan** |
| Temuan kecurangan presensi | `GET /attendance/fraud-findings`, `POST /{id}/review` | §6.10.6 | `0041` | Ya | 91–92 **usulan** |
| Catatan wali | `GET/POST/PATCH /admin/advisor-notes`, `GET /academic/advisor-notes?studentId=` | §4.6.7 | `0038` | Tidak | 65–67 **usulan**; `visibility` `SERVER_ONLY` |
| Model ML EWS | `GET /admin/ml-models`, `GET /{id}`, `POST /train`, `POST /{id}/approve`, `POST /{id}/retire` | §4.6.7, §6.10.3 | `0039` | Ya (worker latih) | 69–72 **usulan** |
| Skor risiko & tindak lanjut | `GET /academic/risk-scores`, `GET /academic/risk-scores/my`, `POST /academic/study-warnings/{id}/follow-up` | §4.6.7, §6.10.3 | `0039` | Tidak | 68, 73–75 **usulan**; **tidak ada rute yang mengubah `status_akademik`** |
| Jangkar & verifier audit | `GET /admin/audit-anchors`, `GET /{id}`, `POST /{id}/seal`, `POST /admin/audit-verifications`, `GET /admin/audit-verifications/{id}`, `GET /admin/audit-verifications` | **§4.21** (kontrak), §6.10.8 (semantik engine) | `0043` | Tidak | 104–107 **usulan**; **tidak ada izin "repair"** dan tidak akan ada. Rumah kontrak dipindah dari §4.6.7 ke §4.21 pada siklus M-05 (`RD-121`) — baris ini tetap rekap, bukan pemilik kontrak |
| Engine (satu bentuk harness) | `POST /admin/engine/{engineCode}/runs`, `GET /admin/engine/runs/{runId}`, `/explain`, `/results`, `POST /results/export`, `POST /apply`, `POST /cancel`, `GET /academic/engine/runs/{runId}/stream` | §6.2, §6.10.1 | `0036`–`0043` | **Ya** | 57–59, 64, 74, 76–79, 100, 106 **usulan** |
| Timetabling (permintaan sesi) | `GET/POST /admin/teaching/timetabling-requests` | §6.10.2 | `0037` | Ya | 55–56 **usulan** |

**Rekap §5.14 (terukur dari tabel di atas, bukan dari taksiran):** 21 gugus / ±80 daun rute **baru**, **nol** di antaranya `implemented`; **6 gugus** menuntut `bullmq`/`ioredis` nyata (baris "Antre = Ya") dan karena itu **design-only** (`RD-11`, `P-6`); **13 gugus** bergantung pada migrasi `0037`–`0048` yang **DDL-nya sudah ditulis tetapi berkasnya belum ada**; gugus kamus & atribut kustom mengikuti **ralat §4.14.6 butir 2** — izinnya sudah menjadi baris 127–145 `RBAC_MATRIX §4.5` tetapi tetap `usulan` karena `authz.ts` masih 222 kode. **§5.15 melanjutkan penomoran ini untuk `0049`/`0050`** (mesin parameter, menu dinamis & grant, presensi multi-modus) agar satu migrasi tidak punya dua rumah inventaris.

### 5.15 Inventaris rute §4.16–§4.18 — mesin parameter, menu dinamis & grant, presensi multi-modus (seluruhnya `spec-only`) — disusun 2026-10-20

Gaya tabel mengikuti §5.9 (satu baris per rute/gugus dengan status), **bukan** daftar per daun: `spec-only` di sini = **`spec`** pada register §2.3. Kolom **DDL/gerbang** menyebut nomor migrasi milik `DATA_MODEL §21` dan syarat yang menahan rutenya dibuka. Tidak ada satu pun baris di bawah yang boleh dikutip sebagai bukti keberadaan handler: `find apps/web/src/app/api/v1 -name route.ts` = 18 berkas, dan tidak satu pun berada di bawah `admin/`, `settings/`, `me/`, `master/`, atau `webhooks/` (diukur ulang 2026-10-20).

| Metode | Rute | Status | § | DDL/gerbang & catatan |
|---|---|---|---|---|
| GET | `/admin/system-parameters`, `/admin/system-parameters/{key}` | **`implemented` (DB)** | §4.16.1 | `0049` + seed katalog §2.3. **Daftar + detail; `meta.pagination` wajib (§2.4)**; `?at=` boleh Replica |
| PUT | `/admin/system-parameters/{key}` | **`implemented` (DB)** | §4.16.2 | `0049`; **bukan** `POST` bebas untuk kunci terdaftar; sembilan penjaga transport (107–112); `If-Match`/`expectedVersion` → 12 |
| POST | `/admin/system-parameters/{key}/request-approval`, `/admin/system-parameter-approvals/{id}/approve`, `…/reject` | **`implemented` (DB)** | §4.16.3 | `0049` `CHECK approved_by <> requested_by`; izin `VALIDATE` **belum lahir** di `RBAC_MATRIX §4.5`; MFA kelas SECURITY/REGULATORY; 56/55/113 |
| POST · GET · PATCH | `/admin/system-parameters/{key}/revert`, `…/history`, `…/impact`, `PATCH …/toggle-active` | **`implemented` (DB)** | §4.16.3 | `0049` riwayat **insert-only** (`REVOKE UPDATE, DELETE`); `impact` menggabungkan `parameter_permissions` + `reference_kind_usage` + registri call site statis; **tidak ada rute tulis riwayat** |
| POST | `/admin/system-parameters/register` | **`implemented` (DB)** | §4.16.4 | `0049` + `0050`; register menuntut `consumerEvidence` (penangkal parameter hantu); pola grant dievaluasi **DENY > ALLOW**, terspesifik menang, kalah dari servis untuk `SECURITY`; 114/116/92 |
| GET | `/settings/effective?keys=a,b,c` | **`implemented` (DB)** | §4.16.5 | `0049` + **resolusi server-side** (`applies_to` → jendela → fallback `default_value`); `X-Parameter-Version`, `ETag`, `Cache-Control: private, max-age=60`, **304 = kelas pengecualian keenam (§1.1)**; klien **tidak pernah** menulis; ambang keamanan dibaca **server-side** |
| GET | `/me/menu?layer=WEB\|MOBILE` | `spec-only` | §4.17.1 | `0050`; pohon difilter server (izin × entitlement modul × status periode); respons memakai **`routeKey`**, bukan path mentah; **tidak ada `visible:false`** untuk hal yang tidak boleh diketahui; `prunedCounts` agregat; `Cache-Control: private, no-store` |
| GET · POST · PATCH · DELETE | `/admin/platform/menus`, `/admin/platform/menus/{id}` | `spec-only` | §4.17.2 | `0050`; hard delete tidak tersedia untuk node berriwayat → `isVisible=false` + 19; `UNIQUE (tenant, layer, code)` → 12; 115/118 |
| GET · PUT | `/admin/platform/menus/{id}/permissions`, `/admin/platform/menus/impact?menuId=` | `spec-only` | §4.17.2 | `0050`; grant = **allowlist + DENY**, `permission_code` wajib anggota katalog 222 → 116; `reason`/`note` wajib; **penyaringan menu bukan kontrol akses** — L1–L6 (§4.11) tetap wajib, rute tersembunyi tetap 403/404/26 |
| POST | `/attendance/events/lms` | `spec-only` | §4.18.2 | `0049` (`attendance_evidence` + `attendance_source` `LMS_ACTIVITY`); idempoten per `(tenant, session, student, source, eventWindow)` — **`UNIQUE` final belum ada di `0049`**, permintaan penutupan milik DATA_MODEL; `ratio` dihitung server, klaim klien jadi `ratioClaimed`; **wajib `503`** sebelum `0049` dieksekusi; **Antre = Ya** (batch flush worker, `RD-11`/`P-6`) |
| POST | `/webhooks/lms/{provider}` | `spec-only` | §4.18.3 | `0049` (`WEBHOOK_EVENT`) + **vault/ENV design-only**; signature HMAC atas body mentah → gagal = `401` (1, preseden §4.7.2); `X-Webhook-Timestamp` di luar `finance.webhook_max_clock_skew_s` → **ACK `200 {ignored:"CLOCK_SKEW"}` tanpa mutasi** (§4.7.3); payload di luar `{event, userRef, duration, sessionId}` ditolak sebelum parsing; **vendor tidak pernah jadi oracle tunggal** (117) |
| GET · POST | `/attendance/{sessionId}/reconciliation`, `…/reconciliation/{studentId}/decide` | `spec-only` | §4.18.4 | `0049`; menampilkan `policy` (`attendance.multi_source_policy`, kamus `kebijakan_rekonsiliasi`) + `evidence[]` per sumber + `PENDING_REVIEW` untuk `REQUIRE_BOTH`; `decide` = `VALIDATE` pengampu kelas (56/55/25); **satu baris `attendances` per (sesi, mahasiswa)** di bawah semua kebijakan (`uq_attendances_session_student`, CI §21.8(6)) |
| POST | `/attendance/scan` | `spec-only` | §4.18.1 → §4.3.7 | Path final §4.3.7 **belum ada** (yang hidup `qr/scan`); modus (`learningModality`/`session_kind`) & ambang dibaca server dari `0049`/`0050`; **tidak** menerima modus dari body |

**Rekap §5.15 (terukur dari tabel di atas, bukan dari taksiran):** **13 baris / ±27 daun** rute baru, **nol** `implemented`. **Seluruh 13 baris** bergantung pada migrasi yang DDL-nya **sudah ditulis** di `DATA_MODEL §21` pada 2026-10-20 dan **belum ada berkasnya**: baris 1–6 = `0049` (mesin parameter), baris 7–9 = `0050` (`menu_items`/`menu_permissions`), baris 10–12 = `0049` (`attendance_evidence` + dua nilai `attendance_source`), baris 13 = `0049` untuk ambang **dan** `0041`/perluasan kolom §4.3.9 untuk bukti scan. **Tiga baris** (10 ingest, 11 webhook vendor, 12 worker penutupan sesi + rekonsiliasi) menahan dependensi yang **belum ada** di `package.json` — **Redis/BullMQ** untuk batch flush & antrean penutupan, **vault** untuk secret kanal — jadi ketiganya **design-only** (`RD-11`, `P-6`) dan tidak boleh ditulis sebagai jalur yang berjalan. **Seluruh gugus** menahan izin yang belum lahir (`settings.param.*`, `platform.menu.*`, `attendance.event.ingest`, `attendance.reconcile.*`) — usulan nomor **146–161** di `RBAC_MATRIX §4.5` (barisnya sudah dipublikasikan 2026-10-20 dengan status `usulan`; `authz.ts` tetap **222** kode, terukur — jadi belum ada yang dipromosikan).

---

## 6. Engine Algoritma Deterministik — Kontrak Endpoint (ALG-1…ALG-14) — 2026-10-20

Norma: [ARCHITECTURE §11](file:///c:/SICA/docs/ARCHITECTURE.md) (algoritma, kompleksitas, budget) dan [ARCHITECTURE §12](file:///c:/SICA/docs/ARCHITECTURE.md) (gelombang 2, ALG-8…ALG-14), [DATA_MODEL §17](file:///c:/SICA/docs/DATA_MODEL.md) + [§18/§19](file:///c:/SICA/docs/DATA_MODEL.md) (tabel, constraint & nomor migrasi `0036`–`0046`), [SECURITY §10](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md) (postur zero-key), [RBAC_MATRIX §4.5](file:///c:/SICA/docs/RBAC_MATRIX.md) (izin). **Status seluruh §6 = `spec`** — tidak ada satu pun rute ini di `apps/web/src` hari ini (terukur: `grep -r "engine" apps/web/src/app/api = 0`), jadi tidak ada klaim `implemented`. **§6.1–§6.9 = gelombang 1 (ALG-1…ALG-7); §6.10 = gelombang 2 (ALG-8…ALG-14)** dan memakai harness, empat hukum, serta bentuk `202 { runId }` yang sama persis — bab §6.10 **melanjutkan**, tidak menggantikan.

### 6.1 Empat hukum yang berlaku untuk semua rute engine

1. **4 lapis penegakan** sama persis dengan `/admin/**` (§4.6.1): JWT terverifikasi → `tenant_id` & `user_id` **hanya** dari token (middleware menghapus header kiriman klien) → izin berbasis tabel (`requireDataPrincipal`, bukan carrier) → gerbang modul (`withModule`) → state (periode `OPEN`, gerbang, cekal) → RLS. Menampilkan tombol engine di UI **bukan** kontrol akses.
2. **Asinkron selalu.** `POST …/runs` menjawab `202` + `runId`; tidak ada engine yang dihitung di dalam request (ADR-9/ADR-15). Pemantau memakai `GET …/runs/:id` (atau `ETag`/long-poll), hasil akhir di `GET …/runs/:id/explain`.
3. **Mesin mengusulkan, manusia menyetujui.** Rute `apply` **wajib** membawa izin `VALIDATE`-nya sendiri, memverifikasi `input_snapshot_hash` (`409 ENGINE_STALE_SNAPSHOT`), menegakkan `Idempotency-Key`, dan menulis melalui **service domain yang sudah ada** — engine tidak pernah punya jalur INSERT/UPDATE langsung.
4. **Zero API key, zero egress.** Payload permintaan tidak memuat kredensial pihak ketiga; dokumen diproses di infrastruktur SICA sendiri. Permintaan yang mencoba mem-forward berkas ke domain luar ditolak oleh network policy (SECURITY §10.1), bukan hanya oleh kode.

Header yang diterima: `Idempotency-Key` (wajib untuk `run` & `apply`), `X-Engine-Budget-Ms` (opsional, dipangkas ke ceiling tenant di `tenant_quotas`), `X-Request-Id` (diteruskan ke `audit_logs`).

### 6.2 Kontrak harness (satu bentuk untuk tujuh engine)

> **Penomoran silang.** Permintaan pengerjaan menyebut gugus gelombang 2 sebagai "§6.2". Di dokumen ini kontrak **harness** sudah lebih dulu menempati §6.2 dan kontrak **ALG-8…ALG-14** menempati **§6.10** (keputusan penomoran 2026-10-20, §6.10 pembuka). Yang tidak boleh terjadi adalah dua induk untuk satu bentuk harness — jadi §6.10 **melanjutkan** §6.2, dan §6.2 inilah satu-satunya pemilik bentuk `POST …/runs → 202 { runId }`, `…/explain`, `…/results`, `…/apply`, `…/cancel`. Gugus yang diminta ("papan jadwal, rekomendasi wali, EWS, auto-fix Feeder, presensi, OBE, verifier audit") seluruhnya termuat di **§6.10.1–§6.10.8**; delta harness yang belum ada di §6.2 (batal `202`, hasil berpaginasi + ekspor, `Location`/`Retry-After`, mode turun) ada di **§6.10.1** dan **§6.10.5**.

```
POST   /api/v1/admin/engine/{engineCode}/runs        → 202 { runId, status:"QUEUED", engineVersion, parameterVersion }
GET    /api/v1/admin/engine/runs/{runId}             → 200 { status, stats, degraded, errorCode? }
GET    /api/v1/admin/engine/runs/{runId}/explain     → 200 { criticalPath|conflictCore|firedRules|cutSide|fields }
GET    /api/v1/admin/engine/runs/{runId}/results     → 200 (paginasi) baris draf dari tabel *_items/*_placements/*_nodes
POST   /api/v1/admin/engine/runs/{runId}/apply       → 200 { applied: [...], skipped: [...] }  (VALIDATE + Idempotency-Key)
POST   /api/v1/admin/engine/runs/{runId}/cancel      → 204
```

`engineCode ∈ {graduation-path, lab-allocator, concentration, cumlaude-rete, room-rerouter, grade-ast, doc-extract}` — divalidasi dengan enum kontrak, bukan string bebas. **Tujuh nilai gelombang 2** (`timetabling-csp`, `advisor-scorer`, `ews-risk`, `feeder-autofix`, `obe-attainment`, `audit-chain-verify`, `attendance-antifraud`) ditambahkan di §6.10.1 dengan harness yang sama; `attendance-antifraud` adalah **pengecualian sadar** (verifikasinya `O(1)` di rute, bukan di worker — lihat §6.10.6).

```jsonc
// POST /admin/engine/lab-allocator/runs — respons 202
{
  "success": true,
  "data": {
    "runId": "0196e2b7-…",            // UUIDv7 dari aplikasi (ADR-6)
    "engineCode": "lab-allocator",
    "engineVersion": "1.0.0",
    "parameterVersion": "academic_rules#lab-shift/2026.02",
    "inputSnapshotHash": "sha256:9f1c…",
    "budget": { "maxSeconds": 20, "maxBacktrack": 50000 },
    "status": "QUEUED",
    "pollAfterMs": 1200
  },
  "meta": { "requestId": "req_…", "timestamp": "2026-10-19T08:00:00Z" }
}
```

| Kode error yang dapat muncul di seluruh §6.2 (nomor register §2.3 ikut disebut agar tidak ada kode kedua) | Kapan |
|---|---|
| `503 ENGINE_BUDGET_EXCEEDED` (**73**) | budget `maxSeconds`/`maxNodes`/`maxBacktrack` habis; `stats.nodesVisited` tetap dikirim supaya operator tahu skala masalahnya. **Bukan** `422` — bentuk lama baris ini menulis `422 …(503)` dan itu salah baca HTTP; yang terkirim adalah 503 retryable dengan `Retry-After` |
| `422 ENGINE_DATA_INSUFFICIENT` (**99**) | data prasyarat tidak ada sehingga hasil **tidak terdefinisi**: `course_prerequisites` kosong (ALG-1/ALG-9), `lab_resource_capabilities` kosong (ALG-2), `rooms`/`lecturer_availability` kosong (ALG-8), belum ada model `ACTIVE` (ALG-10), `grade_components`/`assessment_indicators` kosong (ALG-13). Timbul hanya bila peminta memaksa angka final (`requireComplete` pada run, atau `apply` atas hasil ber-`degraded`). **Dipakai bersama semua engine**, bukan satu gugus — inilah jawaban atas "satu keadaan, satu kode" untuk seluruh mode turun |
| `409 ENGINE_STALE_SNAPSHOT` (**74**) | ada tulis-menulis domain setelah run selesai; `apply` ditolak |
| `409 ENGINE_RUN_NOT_APPLICABLE` (**75**) | run belum sukses, atau periode/gerbang menolak penerapan |
| `403 FORBIDDEN` (**3**) | izin tidak ada di **penugasan aktif** (bukan label peran) |
| `403 ADMIN_SCOPE_MISMATCH` (**16**) | izin ada, objek di luar scope — termasuk `SITE` (`0044`); run lintas prodi/site wajib membuktikan **setiap** simpul masuk scope pemanggil |
| `404 MODULE_NOT_AVAILABLE` (**26**) | modul induk engine non-`ACTIVE`/`TRIAL` (mis. `teaching` untuk ALG-2) |
| `422 VALIDATION_FAILED` (**6**) | payload/query/path gagal skema Zod di `packages/contracts` |
| `422 EXPORT_LIMIT_EXCEEDED` (**59**) | proyeksi hasil melewati ambang HTTP (§6.10.1) — pindah ke job ekspor |
| `409 DUPLICATE_SUBMIT` (**46**) | `Idempotency-Key` `apply` dipakai ulang dengan payload berbeda |
| `423 PERIOD_CLOSED` (**25**) / `403 GATE_BLOCKED` (**38**) | gerbang L5 menolak penerapan pada periode terkunci atau tagihan/cekal belum bersih |
| `503 ENROLLMENT_ENGINE_UNAVAILABLE` (**42**) | worker/queue engine tidak sehat. **Semua** §6.2 bergantung `bullmq`/`ioredis` yang belum menjadi dependensi nyata (`RD-11`, `P-6`) — status gugus ini **design-only**, bukan "sudah jalan" |

### 6.3 ALG-1 · Simulan jalur kritis kelulusan (modul `academic`)

```
POST /api/v1/admin/academic/graduation-sim/runs          body: { studentIds[]|cohortFilter, targetTerm, whatIf[]? }
GET  /api/v1/academic/graduation-sim/runs/{runId}        (mahasiswa boleh membaca hasilnya sendiri — scope SELF)
```
- Izin: `academic.graduation.sim.run` (OTHER) untuk menjalankan; `academic.graduation.path.view` (READ) untuk membaca; **tidak ada** `apply` — hasilnya rekomendasi, bukan perubahan record.
- `whatIf[]`: `{ courseId, planTerm | failTerm }` — dihitung sebagai delta atas tabel DP, bukan simulasi ulang.
- Respons `explain`: `{ estimatedTerm, lowerBoundTerm, deficitSks, criticalPath:[courseId…], blockers:[{courseId,reason}] }` + `degraded:"NO_PREREQ_DATA"` bila `course_prerequisites` kosong (wajib ditampilkan apa adanya di UI).
- Kode khusus: `422 PREREQ_CYCLE`.

### 6.4 ALG-2 · Alokator lab & fasilitas multi-sumber (modul `teaching`)

```
POST /api/v1/admin/teaching/lab-allocation/runs          body: { periodId, programIds[], sessionGroups[], resourceSnapshot? }
POST /api/v1/admin/teaching/lab-allocation/runs/{runId}/apply   → tulis draf ke `class_schedules` lewat service + VALIDATE
```
- Izin: `teaching.laballocation.run` (OTHER), `teaching.laballocation.apply` (VALIDATE), `teaching.labcapacity.view` (READ).
- Bentrok dibaca dari `int4range && ` (indeks GiST §17.3), bukan `BETWEEN` per baris.
- Respons `explain` saat tidak layak: `conflictCore` = himpunan batas minimal + `objectiveGapVsLowerBound`; UI wajib menampilkannya (FR-ADM-11), bukan "tidak ada slot".
- Kode khusus: `422 LAB_ALLOCATION_INFEASIBLE`.

### 6.5 ALG-3 · Alokasi konsentrasi/peminatan (modul `academic`)

```
GET  /api/v1/admin/academic/concentration/weights?programId=&entryYear=&version=
POST /api/v1/admin/academic/concentration/weights        body: { criterion, kind, weightBp, pairwise? , version }
POST /api/v1/admin/academic/concentration/weights/{version}/approve   ← empat-mata; pemohon ≠ penyetuju
POST /api/v1/admin/academic/concentration/runs           body: { programId, entryYear, weightsVersion, preferenceWindowId }
GET  /api/v1/admin/academic/concentration/runs/{runId}/stability-certificate   → verifikasi ulang tiadanya blocking pair
POST /api/v1/admin/academic/concentration/runs/{runId}/publish     (VALIDATE Kaprodi; sekaligus memicu notifikasi)
```
- Izin: `academic.concentration.weight.view/.insert/.update/.approve`, `academic.concentration.run` (OTHER), `academic.concentration.publish` (VALIDATE), `academic.concentration.preference.insert/.view` (mahasiswa, scope SELF).
- **Kriteria & nilainya wajib dapat dibaca mahasiswa yang bersangkutan** (hak atas alasan; UU PDP). Endpoint `GET /academic/concentration/my-result` mengembalikan skor TOPSIS + bobot + posisi, bukan hanya "diterima/ditolak".
- Kode khusus: `422 AHP_INCONSISTENT_MATRIX`, `422 CONCENTRATION_QUOTA_UNFEASIBLE`.

### 6.6 ALG-4 · RETE predikat & clearance (modul `academic` + `audit`)

```
GET  /api/v1/admin/academic/clearance-rules?scopeKind=&cohort=&status=
POST /api/v1/admin/academic/clearance-rules              body: { ruleCode, scopeKind, scopeRef, cohort, whenTree, thenActions, salience, version }
POST /api/v1/admin/academic/clearance-rules/{id}/test    body: { subjectIds[] } → 200 { fired:[…], matched:[…] }   (dry-run, tidak menulis)
POST /api/v1/admin/academic/clearance-rules/{id}/activate            ← VALIDATE + penyetuju ≠ pembuat
POST /api/v1/admin/academic/cumlaude/runs                body: { programId?, cohort, studentIds[]?, fullRebuild:boolean }
GET  /api/v1/academic/cumlaude/my-evaluation             (mahasiswa; hanya predikat + sebab yang menyala)
```
- Izin: `academic.clearancerule.view/.insert/.update/.delete`, `academic.clearancerule.activate` (VALIDATE), `academic.cumlaude.run` (OTHER), `academic.cumlaude.view` (READ), `academic.cumlaude.publish` (VALIDATE).
- Aturan yang menunjuk `fact_key` tak dikenal atau membentuk siklus **ditolak saat kompilasi**: `422 RETE_UNKNOWN_FACT`, `422 RETE_RULE_CYCLE`. Tidak ada jalur "simpan dulu, gagal saat produksi".
- Fakta ber-`pii` tidak boleh muncul di `explain` yang dikirim ke log atau ke peran tanpa hak (masking, SECURITY §7).

### 6.7 ALG-5 · Re-router ruang darurat (modul `academic`)

```
POST /api/v1/admin/academic/room-incidents               body: { scope, roomId|building, kind, slot:[startMin,endMin) }
POST /api/v1/admin/academic/room-reroute/runs            body: { incidentId, allowRelaxations:[…], horizon:"D+3" }
GET  /api/v1/admin/academic/room-reroute/runs/{runId}/explain   → { flowTotal, demand, cutSide, relaxationsOrdered:[{kind,penalty}] }
POST /api/v1/admin/academic/room-reroute/runs/{runId}/apply      → pindah jadwal lewat service (lock per kelas) + notifikasi
```
- Izin: `academic.roomincident.declare` (INSERT), `academic.roomincident.approve` (VALIDATE — insiden lintas gedung perlu orang kedua), `academic.roomreroute.run` (OTHER), `academic.roomreroute.apply` (VALIDATE).
- Penerapan **parsial** adalah hasil yang sah (`stats.flowTotal < demand`) selama `explain.cutSide` menjelaskan sisanya; sistem tidak pernah memaksa "semua sesi tertampung" dengan meloloskan pelanggaran kapasitas.
- Kode khusus: `422 REROUTE_INFEASIBLE_MINCUT`.

### 6.8 ALG-6 & ALG-7 · Normalizer nilai & ekstraksi dokumen

```
POST /api/v1/admin/assessment/grade-formula/parse        body: { sourceText, courseId, periodId } → 200 { ast[], formulaHash, weightSumBp, issues[] }
POST /api/v1/admin/assessment/grade-formula/verify-mass  body: { periodId, programIds[] } → 202 { runId } (diff RPS vs KHS)
POST /api/v1/admin/assessment/grade-formula/{id}/approve ← VALIDATE Kaprodi sebelum penguncian
```
- `parse` **tidak** memakai `eval()`/`new Function()`; ia mengembalikan pohon simpul (§17.8). Bobot ≠ 100% memakai kode lama `422 WEIGHT_SUM_NOT_100` — **tidak** dibuat kode baru untuk kondisi yang sama.

```
POST /api/v1/documents/extract            multipart { file, purpose:"mbkm-conversion|pmb-doc|transcript" } → 202 { runId, extractionId }
GET  /api/v1/documents/extractions/{id}  → 200 { layersUsed, avgConfidence, fields:[{fieldKey,raw,norm,method,score,margin,candidateRef,sourceSpan,verdict}] }
PATCH /api/v1/documents/extractions/{id} body: { corrections:[{fieldKey, candidateRef|manualValue}] }   (menandai manusia)
POST /api/v1/documents/extractions/{id}/apply  → memanggil service tujuan (konversi MBKM / pengisian berkas PMB) dengan gerbang aslinya
```
- Batas intake: tipe `application/pdf|image/jpeg|image/png` (sisanya `415`), ukuran & jumlah halaman melebihi batas → **kode lama** `FILE_TOO_LARGE` (baris 4x register) dan `422 DOC_ENCRYPTED_OR_SCRIPTED` untuk PDF terenkripsi/ber-skrip.
- `verdict` tiap field: `AUTO` (≥ `auto_fill_min` **dan** margin ≥ 0.15), `REVIEW` (0.75–0.92), `EMPTY`, `REJECTED`. `apply` dengan field wajib masih `REVIEW`/`EMPTY` → `422 EXTRACTION_REVIEW_REQUIRED`.
- **Tulisan tangan tidak didukung** dan tidak boleh dijanjikan di UI: jalur yang tersedia adalah entri manual berbantuan. Template tak dikenal → `422 DOC_TEMPLATE_UNRECOGNIZED`.
- Berkas mentah & citra hasil render punya `expires_at` (default 30 hari); teks hasil ekstraksi tidak pernah dieksekusi/diinterpretasikan sebagai instruksi (SECURITY §10.4).

### 6.9 Kunci i18n & paritas Mobile

Setiap kode error §6.6–§6.8 wajib punya `admin.errors.<CODE>` di `id.json` **dan** `en.json` dengan bentuk kunci identik (AGENTS §3.5), disertai pesan yang menyebut **sebab dan langkah perbaikan** — bukan "terjadi kesalahan". Paritas Mobile (§3.4): dari tujuh engine, yang punya permukaan di Flutter adalah **ALG-1** (`/pengembangan` mahasiswa: lihat jalur lulus sendiri) dan **ALG-7** (unggah → draf → konfirmasi). Engine lain tetap Web/admin-only, dan itu dinyatakan eksplisit agar "parity" tidak diartikan "semua layar ada di ponsel". Paritas gelombang 2 diputuskan di §6.10.10.

### 6.10 Kontrak endpoint engine gelombang 2 (ALG-8…ALG-14) — 2026-10-20

**Status: `spec` seluruh §6.10.** Tidak ada satu pun rute engine gelombang 2 di `apps/web/src` hari ini, dan tidak ada satu pun migrasi `0037`–`0046` yang dieksekusi. Yang **sudah ditulis** adalah DDL-nya (`DATA_MODEL §18.2`–`§18.8`, `§19.1`–`§19.4`); yang **belum** adalah berkas migrasi, policy RLS hasil generator, izin di `PERMISSION_SPECS`, dan handler. Menulis kode rute sebelum tiga pertama ada = temuan audit, bukan percepatan.

**Pemilik nama (tidak dinegosiasikan di sini):** engine & mekanika = [ARCHITECTURE §12.3–§12.11](file:///c:/SICA/docs/ARCHITECTURE.md); objek, kolom & nomor migrasi = [DATA_MODEL §18/§19 + §14.7](file:///c:/SICA/docs/DATA_MODEL.md); kode izin = [RBAC_MATRIX §4.5 nomor 51–126](file:///c:/SICA/docs/RBAC_MATRIX.md) (semuanya masih **usulan**); path, skema Zod & kode error = bagian ini. **Empat hukum §6.1 dan bentuk harness §6.2 berlaku penuh dan tidak diulang di sini** — §6.10 hanya menambahkan delta yang belum ada di §6.2, kontrak per engine, dan mode turun.

**Vonis yang sudah dijatuhkan dan tidak dibalik oleh bagian ini:** `grade_audit_logs` kalah oleh `grade_change_logs` (`0034`, `DATA_MODEL §14.8`); `program_types` kalah oleh `reference_items(kind='jenis_program')` (§19.2, lihat §4.6.7); `pddikti_validation_runs` adalah **view** atas `pddikti_sync_runs` (§16.4.4), bukan tabel, dan auto-fix **tidak** membuatnya jadi tabel; harness engine adalah `0036_engine_algorithms.sql` — **`0013` bukan harness** (nomor itu dipakai `0013_institution_gaps.sql`); berkas integrasi yang nyata adalah `docs/INTEGRATIONS.md`, bukan `docs/INTEGRATION_SPEC.md` yang tidak pernah ada.

#### 6.10.1 Delta harness: batal, hasil panjang, dan header `Location`

§6.2 adalah induk bentuknya (`POST …/runs` → `202 { runId }`, `GET …/runs/{runId}`, `…/explain`, `…/results`, `…/apply`, `…/cancel`). Yang **ditambah** untuk gelombang 2, dan hanya itu:

```http
POST   /api/v1/admin/engine/{engineCode}/runs          → 202 + Location + Retry-After          (§6.2 + delta ini)
POST   /api/v1/admin/engine/runs/{runId}/cancel        → 202 { runId, state:"CANCEL_REQUESTED" } (bukan 204)
GET    /api/v1/admin/engine/runs/{runId}               → 200 { state, stats, degraded, findingsCount }
GET    /api/v1/admin/engine/runs/{runId}/results       → 200 paginasi §2.4  ATAU  422 EXPORT_LIMIT_EXCEEDED
POST   /api/v1/admin/engine/runs/{runId}/results/export → 202 { jobId }   (hasil panjang)
GET    /api/v1/academic/engine/runs/{runId}/stream     → SSE, accelerator bukan sumber kebenaran
```

| Delta | Aturan |
|---|---|
| `engineCode` gelombang 2 | `timetabling-csp`, `advisor-scorer`, `ews-risk`, `feeder-autofix`, `obe-attainment`, `audit-chain-verify`, `attendance-antifraud` — enum kontrak yang sama dengan tujuh nilai §6.2, bukan string bebas. Nilai terakhir adalah **pengecualian sadar**: ALG-12 diverifikasi `O(1)` **di rute** (`ARCHITECTURE §12.11`), jadi ia **tidak punya** `runs`; kode enum itu dipakai hanya sebagai `engine_code` pada baris `attendance_token_uses`/`attendance_fraud_findings` dan pada run verifikasi kecurangan massal (`attendance.fraud.review`, 92). |
| **Pembatalan** | Hanya run `QUEUED` dan `RUNNING` yang dapat dibatalkan; run terminal menolak dengan `409 ENGINE_RUN_NOT_APPLICABLE` (75). Jawabannya `202`, **bukan** `204`: pembatalan adalah permintaan yang diterima worker, dan keadaan akhirnya dibaca lewat `GET …/runs/{runId}`. `Idempotency-Key` **tidak** wajib di sini (pembatalan dua kali = keadaan yang sama), tapi `Retry-After: 1` dikirim. Draf hasil run yang dibatalkan **tidak** mendapat keadaan baru: kolom status draf hanya `DRAFT`, `APPLIED`, `REJECTED` (`0037`) — draf `DRAFT` yang tidak pernah di-`apply` dihapus job retensi bersama run-nya. Tidak ada `LOCK TABLE`, tidak ada pembatalan parsial yang diam-diam. |
| **Hasil panjang tidak lewat HTTP** | `GET …/results` memakai paginasi §2.4 (`limit ≤ 100`) dan **hanya** untuk draf yang akan ditinjau. Proyeksi hasil melewati **5.000 baris** atau **1 MiB** → `422 EXPORT_LIMIT_EXCEEDED` (59) dengan `details[].nextStep` menunjuk `POST …/results/export`; job menulis berkas ke object storage lewat §4.8 dan hasilnya diambil dengan `GET /uploads/{id}/url` (presigned, TTL pendek) — **bukan** URL langsung di respons, dan bukan array raksasa di dalam JSON. Angka ini satu threshold dengan plafon ekspor §4.10.5; tidak ada ambang kedua. |
| **`Location` wajib** | Setiap `202` engine mengirim `Location: /api/v1/admin/engine/runs/{runId}` **dan** `Retry-After` (1..30 detik, = estimasi selesai p50 + margin). `data.statusUrl` di body tetap ada agar klien yang hanya membaca body tidak tersesat (corak §4.2.11). Rute `POST /academic/krs/submit` bentuk `202` (§4.2.11) **ikut** norma ini saat diimplementasi: header sama, satu aturan, bukan dua kontrak. |
| Polling vs SSE | `GET …/runs/{runId}` adalah sumber kebenaran; SSE hanya accelerator dan **tidak** mengubah keadaan apa pun di klien. Koneksi SSE putus = lanjut polling. Badan `text/event-stream` tetap kelas non-envelope keempat (§1.1). |
| Enam lapis (§4.11) | L1 `strict()` + enum `engineCode` + `budget` dipangkas ke ceiling `tenant_quotas` · L2 identitas hanya dari token, `x-tenant-id`/`x-user-id` kiriman klien dihapus middleware (`SEC-07`) · L3 `requireDataPrincipal` (`SEC-10`) · L4 `holdsScoped` dengan scope **PROGRAM/PERIOD/SITE** (SITE baru, `0044`) — `SEC-11` · L5 periode `OPEN`/`LOCKED`, gerbang, modul aktif (`404 MODULE_NOT_AVAILABLE`, 26), `input_snapshot_hash` utuh · L6 RLS. `apply` menambah `Idempotency-Key` + izin `VALIDATE` sendiri + writes lewat service domain, **tidak pernah** INSERT langsung ke tabel domain. |

**Contoh yang paling sering salah dibuat (1): `202` + `Location` + `Retry-After` untuk run engine.** Kesalahan yang umum: menjawab `200` dengan hasil parsial di body (menyembunyikan bahwa pekerjaan belum selesai), menjawab `202` tanpa `Location` sehingga klien menebak URL, atau mengirim `runId` tanpa `engineVersion`/`parameterVersion` sehingga hasil tidak dapat direproduksi. Bentuk benar:

```http
HTTP/1.1 202 Accepted
Location: /api/v1/admin/engine/runs/0196e2b7-9c31-7a82-9f05-112233445566
Retry-After: 4
Content-Type: application/json
X-Request-Id: req_8f1d2c3e4a5b6789
```

```json
{
  "success": true,
  "data": {
    "runId": "0196e2b7-9c31-7a82-9f05-112233445566",
    "engineCode": "timetabling-csp",
    "engineVersion": "1.0.0",
    "parameterVersion": "timetabling_constraint_defs#2026.02-genap",
    "inputSnapshotHash": "sha256:9f1c2a…",
    "budget": { "maxSeconds": 30, "maxBacktrack": 200000, "seed": 20261020 },
    "state": "QUEUED",
    "idempotent": false,
    "statusUrl": "/api/v1/admin/engine/runs/0196e2b7-9c31-7a82-9f05-112233445566",
    "resultsUrl": "/api/v1/admin/engine/runs/0196e2b7-9c31-7a82-9f05-112233445566/results",
    "explainUrl": "/api/v1/admin/engine/runs/0196e2b7-9c31-7a82-9f05-112233445566/explain"
  },
  "meta": { "timestamp": "2026-10-20T08:00:00.000Z", "requestId": "req_8f1d2c3e4a5b6789" }
}
```
`seed` ikut dikirim karena hasil harus dapat direproduksi (`ARCHITECTURE §12.12` butir h): tanpa seed, dua run atas snapshot yang sama menghasilkan jadwal berbeda dan golden vector tidak berarti apa-apa. `idempotent: true` menandai replay `Idempotency-Key` yang sama (`200`, bukan `202` kedua) — pola §4.2.14.

#### 6.10.2 ALG-8 · Smart timetabling (`timetabling-csp`, modul `teaching`)

```http
POST   /api/v1/admin/engine/timetabling-csp/runs                     → 202 (lihat 6.10.1)
GET    /api/v1/admin/engine/runs/{runId}/results                      draf `timetabling_assignments` ber-`DRAFT`
GET    /api/v1/admin/engine/runs/{runId}/explain                      conflictCore + lowerBoundSoftCostBp
POST   /api/v1/admin/engine/runs/{runId}/apply                        → 200 { applied[], skipped[] }
POST   /api/v1/admin/teaching/timetabling-requests                   buat permintaan sesi (INSERT, 56)
GET    /api/v1/admin/teaching/timetabling-requests                   list §2.4 (55)
```

**Badan run (Zod `strict()`):**
```typescript
export const TimetablingRunRequestSchema = z.object({
  periodId: UUIDSchema.describe("Diselesaikan ke barisnya; sumber rentang operasional"),
  programIds: z.array(UUIDSchema).min(1).max(24).describe("Satu run satu prodi; fakultas dipecah per prodi"),
  siteId: UUIDSchema.optional().describe("Scope SITE (0044); kosong = seluruh site yang pemanggil kuasai"),
  requestIds: z.array(UUIDSchema).max(1200).optional(),
  mode: z.enum(['BUILD', 'REPAIR']).default('BUILD').describe("REPAIR memperbaiki jadwal yang sudah ada dengan biaya stabilisasi"),
  allowRelaxations: z.array(z.enum(['SOFT_ONLY', 'EXTRA_SLOT', 'CROSS_SITE'])).max(3).default([]),
  budget: z.object({ maxSeconds: z.number().int().min(5).max(30), maxBacktrack: z.number().int().min(1000).max(200000) }),
  explain: z.boolean().default(true),
});
// SERVER_ONLY / ditolak dari body: engine_code, engine_version, parameter_version,
//   input_snapshot_hash, seed (dibuat server), status draf, applied_by, applied_at, soft_cost_bp
```

| Aspek | Aturan |
|---|---|
| Kendala yang dieksekusi | H-1…H-8 (`ARCHITECTURE §12.3`), dipakai ulang dari `time_slots`, `rooms`, `lab_resource_capabilities`, `room_distance_penalties`, `class_distributions` — **tidak ada tabel kendala kedua**; definisinya ada di `timetabling_constraint_defs` (`0037`) dan CRUD-nya di §4.6.7 |
| Bentrok | Dibaca `int4range &&` atas indeks GiST, **bukan** `BETWEEN` per baris; draf yang bentrok **mustahil tersimpan** karena `EXCLUDE USING gist` per `(run, room, day, slot)` dan `(run, lecturer, day, slot)` |
| Hasil parsial | `state:"SUCCEEDED"` hanya bila kendala keras nol pelanggaran. Parsial karena budget habis = `degraded:"PARTIAL_BUDGET_EXHAUSTED"` dan **tidak pernah** ditampilkan sebagai "selesai" |
| apply | `teaching.timetable.apply` (59, `VALIDATE`) + `Idempotency-Key`; penulis wajib `HEAD_OF_PROGRAM` **≠** penjalur run; tulis ke `class_schedules` **lewat service domain** dengan `pg_advisory_xact_lock` per kelas + `audit_logs` + outbox; menolak bila `input_snapshot_hash` berbeda (`409 ENGINE_STALE_SNAPSHOT`, 74); lintas gedung butuh orang kedua |
| Kode | `422 TIMETABLING_INFEASIBLE` (79) — inti konflik ada di `explain.conflictCore` + `lowerBoundSoftCostBp`, bukan di pesan "gagal" · `422 ENGINE_BUDGET_EXCEEDED` (73) · `422 ENGINE_DATA_INSUFFICIENT` (99) bila `rooms`/`lecturer_availability`/`lab_resource_capabilities` sedemikian kosong sehingga **kendala keras tidak dapat dinilai sama sekali** (mode `NO_LECTURER_AVAILABILITY`/`NO_ROOM_FACILITIES` tetap `degraded` dan berjalan; 99 timbul hanya bila pemanggil menuntut jadwal final) · `409 ENGINE_STALE_SNAPSHOT` (74) · `409 ENGINE_RUN_NOT_APPLICABLE` (75) · `422 LECTURER_WORKLOAD_EXCEEDED` (24) · `422 MAX_PARALLEL_CLASSES_EXCEEDED` (20) dipakai ulang untuk H-6/H-7 — **tidak** dibuat kode baru, dan nama `TIMETABLE_UNFEASIBLE_CORE` **kalah** terhadap baris 79 (§2.3 butir 8) |
| Penahan kapasitas | `participants` dibanding `rooms.capacity` **tidak dapat** ditegakkan `CHECK` lintas tabel: ditegakkan di service (L5) dan di tes CI (`DATA_MODEL §18.9` butir 2). Jangan menulis pemicu yang membaca `rooms` di dalam INSERT massal engine — itu serialisasi yang dilarang `AGENTS §3.7` |

#### 6.10.3 ALG-9 rekomendasi penasihat (`advisor-scorer`) & ALG-10 EWS (`ews-risk`, modul `academic`)

```http
POST /api/v1/admin/engine/advisor-scorer/runs        body { periodId, programId, entryYears[], studentIds[]?, budget }  → 202
GET  /api/v1/enrollment/advisor-recommendations       list §2.4 untuk wali/Kaprodi (63, READ)
GET  /api/v1/academic/advisor-recommendations/my      mahasiswa membaca miliknya sendiri + seluruh `reasons` (63, SELF)
GET  /api/v1/academic/advisor-recommendations/my/explain   komponen skor (crit/termfit/pathdelta/hist/passrate/workload) + n per komponen
POST /api/v1/admin/engine/ews-risk/runs               body { periodId, programIds[], modelVersion, fullRebuild }  → 202
GET  /api/v1/academic/risk-scores                     list §2.4 (73) — filter `band`, `periodId`, `studentId`
GET  /api/v1/academic/risk-scores/my                  mahasiswa melihat risiko + faktor penyebabnya sendiri (73, SELF)
POST /api/v1/academic/study-warnings/{id}/follow-up   tutup temuan: { ownerMembershipId, dueAt, resolvedOutcome } (75)
```

- **ALG-9 tidak punya `apply`.** Rekomendasi bukan pendaftaran: tombol "Terapkan" di layar mahasiswa memanggil `POST /api/v1/academic/krs/submit` dengan **seluruh** gerbang aslinya (periode `OPEN`, gerbang tagihan, kuota SKS, kursi). Invariance (c) `ARCHITECTURE §12.4` ditegakkan di kontrak: **tidak ada** rute engine yang menulis `enrollments`.
- Kelayakan keras **menyaring**, bukan memberi skor rendah: matakuliah yang gugur tidak muncul dengan skor kecil — ia tidak ditawarkan, dan `denialReason`-nya dikembalikan (FR-ADM-11). Kodenya dipakai ulang: `422 ACADEMIC_CREDIT_QUOTA_EXCEEDED` (37), `409 CLASS_FULL` (36), `423 PERIOD_CLOSED` (25), `403 GATE_BLOCKED` (38), `422 PREREQ_CYCLE` (66).
- **Skor = basis poin integer** (`score_bp` 0..10000), bukan float; Web dan Dart wajib menghasilkan angka yang sama (gerbang CI `ARCHITECTURE §12.12` butir i). `passrate` dengan `n < 30` wajib membawa `LOW_SAMPLE` — angka yang baru diajarkan dua kali tidak boleh tampak meyakinkan.
- **ALG-10 adalah prediksi, bukan keputusan.** Tidak satu pun rute §6.10.3 mengubah `students.status_akademik`, membuka gerbang, atau menyentuh tagihan. Tindak lanjut selalu aksi manusia lewat `…/follow-up` (75).
- Proyeksi server: `advisor_notes.visibility = 'ADVISOR_ONLY'` tidak pernah sampai ke peran `STUDENT` (§4.6.7); `risk_scores.top_factors` dan `hard_triggers` boleh dibaca mahasiswa yang bersangkutan (hak atas alasan, UU PDP), tetapi **tidak** oleh peran tanpa scope.
- Kode baru gugus ini: `422 MODEL_QUALITY_GATE_UNMET` (80), `422 MODEL_FEATURE_DENYLISTED` (81), `422 ADVISOR_QUOTA_EXCEEDED` (100), `422 MODEL_STALE` (101). Ambang mutu dan denylist atribut **ditegakkan di DB** (`0039`, `DATA_MODEL §18.9` butir 4 dan 6); rute hanya memetakan sebab. `MODEL_NOT_QUALIFIED` **kalah** sebagai sinonim baris 80 (§2.3 butir 8) — satu ambang mutu, satu kode. Baris 100 timbul bila run ALG-9 melewati rasio mahasiswa-per-wali di `academic_rules` atau penugasan wali menembus kuota: ini kuota **bimbingan**, bukan beban SKS mengajar (24) dan bukan kuota kursi (36/37). Baris 101 timbul hanya saat pemanggil memaksa skor prediktif (`scoring:"MODEL_ONLY"`) atas model yang `psi`-nya lewat ambang drift; tanpa paksaan itu, hasilnya tetap dikirim dengan `degraded:"MODEL_STALE"` + aturan keras (§6.10.5). `POST /api/v1/admin/ml-models/{id}/approve` (71, `VALIDATE`) menolak `trainedBy == approverId` dengan `403 SELF_APPROVAL_FORBIDDEN` (56).
- Pelatihan model dijalankan di worker **di luar jendela puncak** dan bukan sebagai `runs` biasa: permintaannya `POST /api/v1/admin/ml-models/train` (§4.6.7, 70, `INSERT`) yang mengembalikan `202 { runId }` dengan bentuk §6.10.1 — satu bentuk untuk "jalankan perhitungan", tidak ada kontrak kedua.

#### 6.10.4 ALG-11 · Pra-validasi & auto-fix Feeder (`feeder-autofix`, modul `feeder_pddikti`)

```http
POST /api/v1/admin/feeder/validate                    run ALG-11; verba OTHER yang sudah ada di §4.6.6 — tidak menambah izin baru  → 202
GET  /api/v1/admin/feeder-autofix-suggestions         list §2.4 (80) + filter runId, verdict, domain, columnName
GET  /api/v1/admin/feeder-autofix-suggestions/{id}    before/after, score, margin, bukti kandidat (80)
POST /api/v1/admin/feeder-autofix-suggestions/apply   { items:[{ suggestionId, decision:"ACCEPT"|"REJECT", note }] }  → 200 (81)
POST /api/v1/admin/feeder-autofix-suggestions/{id}/revert                                                → 200 (82)
GET  /api/v1/admin/feeder-identity-matches            skor + margin + blockedBy, TANPA hak menulis feeder_id (83)
POST /api/v1/admin/feeder-identity-matches/{id}/confirm                                → 200 (84, VALIDATE)
GET  /api/v1/admin/feeder-sync-watermarks              lihat airmen (85)
POST /api/v1/admin/feeder-sync-watermarks/{id}/force-full · /reset                                     → 200 (86)
```

| Aspek | Aturan |
|---|---|
| Mesin | **Bukan mesin kedua.** Aturan Feeder dieksekusi jaringan RETE ALG-4 (`0036`) dengan `fact_types` domain Feeder; `checkExpr` adalah pohon kondisi yang sama (`DATA_MODEL §18.5`) |
| Hak bertindak per `kind` | `FORMAT` dan `ENRICH` boleh diperbaiki otomatis **di salinan staging**; `IDENTITY` hanya mengusulkan pasangan; `SEMANTIC` dan `BLOCKING` **hanya** usulkan/tolak — `fix_expr` terisi pada ketiganya → `422 AUTOFIX_EXPR_FORBIDDEN` (83) |
| Tidak pernah menyentuh sumber | Auto-fix **tidak pernah** menulis `students`, `enrollments`, `grades`. Koreksi data sumber = permintaan + `VALIDATE` (BR-R10, tanpa hard delete). Invariance (a) `ARCHITECTURE §12.6` |
| `feeder_id` | Hanya dari respons *bridge* ke `feeder_identities` (I-14). `feeder_identity_matches` **tidak punya kolom `feeder_id`** — bentuk skema adalah penegaknya, bukan kalimat larangan |
| Idempotensi | Kunci `(runId, stagingTable, stagingId, columnName, ruleId)`: run ulang tidak menggandakan perbaikan; `apply` dua kali pada usulan yang sama = `200` dengan `data.replayed: true` (pola §4.2.14), bukan dua baris |
| Gerbang kirim | `POST /admin/feeder/push` tetap `409 FEEDER_BLOCKING_FINDINGS` (32) selama ada temuan `BLOCK`; sisa `REVIEW` pada kolom wajib → `422 AUTOFIX_REVIEW_REQUIRED` (82). Dua orang berbeda: `validatedBy <> decidedBy` |
| Airmen | Hanya baris run `SUCCEEDED` yang menggeser `lastCommittedAt`; baris gagal **tidak** menggeser airmen (kalau tidak, satu kegagalan membuat barisnya tidak pernah terkirim lagi — kehilangan data senyap). `force-full` = `forcedFullAt` + audit ganda + konfirmasi tersurat |
| Hasil run | Tertulis ke `pddikti_sync_runs` + temuan di `pddikti_validation_findings`; `pddikti_validation_runs` **tetap view** (`DATA_MODEL §16.4.4`) dan tidak dirubah menjadi tabel oleh kontrak ini |

**Contoh yang paling sering dibuat (2): `422` dengan daftar temuan `REVIEW` dari auto-fix.** Kesalahan yang umum: satu `message` global ("data belum layak kirim") tanpa daftar, atau daftar tanpa `recordKey` sehingga operator tidak tahu baris mana yang harus dibuka. Yang benar: **satu entri `details[]` per record**, masing-masing dengan tautan perbaikan.

```json
{
  "success": false,
  "error": {
    "code": "AUTOFIX_REVIEW_REQUIRED",
    "message": "3 usulan pada kolom wajib masih berstatus REVIEW dan harus diputuskan per record sebelum apply/push.",
    "details": [
      { "recordKey": "STM: mahasiswa:8f2c…", "stagingTable": "pddikti_staging_mahasiswa", "stagingId": "8f2c…", "columnName": "nisn", "ruleCode": "NISN_CHECKDIGIT", "verdict": "REVIEW", "score": "0.88120", "margin": "0.03100", "remedyHref": "/admin/feeder-autofix-suggestions?runId=0196e2b7&stagingId=8f2c" },
      { "recordKey": "STM: mahasiswa:1a7d…", "stagingTable": "pddikti_staging_mahasiswa", "stagingId": "1a7d…", "columnName": "nama", "ruleCode": "NAME_GelarStrip", "verdict": "REVIEW", "score": "0.91400", "margin": "0.00800", "remedyHref": "/admin/feeder-autofix-suggestions?runId=0196e2b7&stagingId=1a7d" },
      { "recordKey": "STM: nilai:44be…", "stagingTable": "pddikti_staging_nilai", "stagingId": "44be…", "columnName": "sks", "ruleCode": "SKS_RANGE", "verdict": "NO_MATCH", "score": null, "margin": null, "remedyHref": "/admin/feeder-autofix-suggestions?runId=0196e2b7&stagingId=44be" }
    ]
  },
  "meta": { "timestamp": "2026-10-20T08:20:00.000Z", "requestId": "req_1c9b…", "auditId": null }
}
```
HTTP **422**. `margin` **harus** ikut: verdict tidak lahir dari skor mentah tetapi dari skor **dan** selisih peringkat terhadap kandidat kedua (`ARCHITECTURE §12.6` butir 4) — menyembunyikannya membuat layar "yakin" tanpa dasar. Nilai numerik dikirim sebagai **string** agar `numeric(6,5)` tidak berubah bentuk di JS (`float` dilarang, ADR-5). `auditId` `null`: penolakan tidak menulis baris.

#### 6.10.5 Mode turun (`degraded`): ditampilkan apa adanya

Kondisi pra-syarat yang belum terpenuhi **tidak boleh** berubah menjadi angka yang tampak meyakinkan. Server mengirim token `degraded` pada **setiap** respons run/result/apply gelombang 2 (field yang sama dengan §6.3 untuk ALG-1), dan UI **wajib** menampilkannya — bukan memfilternya. Token di bawah adalah kosakata; menambah token baru = menambah baris di sini lebih dulu.

**Hubungan token `degraded` dengan kode error (satu keadaan, dua permukaan — jangan dinegosiasikan ulang):** token adalah **label keadaan** pada respons yang **sukses secara HTTP** (`200`/`201`/`202`): sistem tetap bekerja dan melaporkan bahwa hasilnya tidak lengkap. Kode error adalah **penolakan** ketika pemanggil menuntut lebih dari yang dapat diberikan keadaan itu. Peta yang mengikat: `NO_PREREQ_DATA` / `NO_LECTURER_AVAILABILITY` / `NO_ROOM_FACILITIES` / `NO_INDICATOR_DATA` / `NO_RULE_VERSION_ACTIVE` / `CHAIN_UNSEALED` → **`422 ENGINE_DATA_INSUFFICIENT` (99)** bila run diminta `requireComplete: true` atau hasil `degraded` hendak di-`apply`; `MODEL_STALE` (token) → **`422 MODEL_STALE` (101)** bila diminta `scoring:"MODEL_ONLY"`; `LOW_COVERAGE` → **`422 ATTAINMENT_COVERAGE_LOW` (104)** saat capaian hendak diterbitkan/di-`approve`; `PARTIAL_BUDGET_EXHAUSTED` → **`503 ENGINE_BUDGET_EXCEEDED` (73)** bila klien meminta jadwal final; `GEOFENCE_NOT_APPLICABLE` → **bukan** error sama sekali (kanal `LMS_ACTIVITY`, §6.10.6). Tidak ada pasangan token↔kode di luar daftar ini; kalau sebuah token tidak punya padanan, itu berarti keadaannya **tidak pernah** menolak permintaan.

| Engine | Token `degraded` | Sebab | Yang **tidak** boleh diklaim |
|---|---|---|---|
| ALG-8 | `NO_LECTURER_AVAILABILITY` | `lecturer_availability` (`0037`) kosong untuk pengampu terkait | "hari yang diizinkan sudah dijaga" — H-3 hanya menegakkan bentrok antar-sesi |
| ALG-8 | `NO_ROOM_FACILITIES` | `rooms.facilities` belum terisi | H-4/H-5 ditegakkan; hasilnya **dilaporkan sebagai kendala yang tidak ditegakkan**, bukan "lolos" |
| ALG-8 | `PARTIAL_BUDGET_EXHAUSTED` | `maxSeconds`/`maxBacktrack` habis | Jadwal selesai; `stats.nodesVisited` tetap dikirim supaya operator tahu skalanya |
| ALG-9 | `NO_PREREQ_DATA` | `course_prerequisites` (`0008`) kosong | rekomendasi berbasis jalur lulus; hasilnya hanya sisa SKS + ketersediaan term |
| ALG-9 | `LOW_SAMPLE` per komponen | `n < 30` pada `passrate`/`hist` | angka komponen itu meyakinkan; pembilang dan penyebut wajib tampil |
| ALG-10 | `HARD_RULES_ONLY` | AUC < 0.70 atau Brier > 0.18 di tenant ini (`80`) | kata "prediksi" atau skor probabilitas; yang tampil hanya aturan deterministik |
| ALG-10 | `NO_ATTENDANCE_FEED` | fitur kehadiran kosong | aturan kehadiran < 75 % menyala |
| ALG-10 | `MODEL_STALE` | `psi > 0.25` per fitur | model masih layak; usulan latih ulang butuh `VALIDATE`, tidak pernah otomatis |
| ALG-11 | `NO_RULE_VERSION_ACTIVE` | tidak ada `feeder_autofix_rules` `ACTIVE` untuk periode kamus itu | ada auto-fix; hasilnya kosong + tautan bukti |
| ALG-11 | `NO_MATCH` per record | kemiripan di bawah 0.80 atau multi-kandidat setara | kosong berarti "tidak ada masalah" |
| ALG-12 | `GEOFENCE_NOT_APPLICABLE` | `program_type='PJJ'` / `delivery_mode='ONLINE'` (`0044`) | jarak membuktikan kehadiran; kanal ganti `method='LMS_ACTIVITY'` |
| ALG-12 | `SIGNALED_NOT_VERDICTED` | sinyal perangkat/jaringan ada tapi di bawah ambang vonis | presensi curang; ia hanya bobot `fraud_score_bp` |
| ALG-13 | `NO_INDICATOR_DATA` | `grade_components`/`assessment_indicators` (`0032`) belum terisi | "belum ada rubrik" sama dengan capaian nol |
| ALG-13 | `LOW_COVERAGE` | `coverage < min_coverage` dari `cpl_targets` (`0042`) | capaian tanpa `n_missing_evidence` di sampingnya |
| ALG-14 | `CHAIN_UNSEALED` | jangkar belum disegel / `seq` tidak tersedia | jejak terverifikasi; jalur tulis **wajib gagal**, bukan menulis tanpa jejak |

#### 6.10.6 ALG-12 · Presensi anti-pemalsuan (`attendance-antifraud`) — kontrak final §4.3

Gugus ini **melanjutkan** §4.3.6–§4.3.9 dan menutup oracle tanda tangan `SEC-03`. Keputusan penamaan yang mengikat di sini, supaya tidak ada dua kontrak untuk satu hal: **nama kawat final adalah `counter` dan `mac9`** (`ARCHITECTURE §12.7.1`, kolom `attendance_token_uses.counter`/`mac9` di `0041`); `windowIndex` dan `challengeToken` di §4.3.6/§4.3.7 adalah nama sebelum keputusan ini dan **diganti saat implementasi**, bukan dipertahankan sebagai varian kedua. `windowSeconds`/`qr_rotate_seconds` keduanya 5 detik dan tetap satu arti; kolom DB yang benar adalah `class_sessions.qr_rotate_seconds` (`0041`).

```http
POST   /api/v1/attendance/sessions/{sessionId}/challenge              terbitkan stream tantangan sesi  → 201 (§4.3.6 + delta 6.10.6)
GET    /api/v1/attendance/challenges/{challengeId}/current            rotasi untuk layar dosen, tiap 5 dtk → 200
POST   /api/v1/attendance/sessions/{sessionId}/challenge              rotasi eksplisit (idempoten dalam jendela) → 200
POST   /api/v1/attendance/scan                                        pemindaian mahasiswa  → 201 / 4xx (§4.3.7, path final)
GET    /api/v1/attendance/token-uses                                  vonis per (sesi, counter) — READ-only (90)
POST   /api/v1/attendance/fraud-findings/{id}/review                  vonis PENDING_REVIEW → ACCEPTED/REJECTED (92, VALIDATE)
```

**Badan `POST /api/v1/attendance/scan` (Zod `strict()`):**
```typescript
export const AttendanceScanSchemaV2 = z.object({
  sessionId: UUIDSchema.describe("Diselesaikan ke baris class_sessions milik tenant DI DALAM transaksi"),
  counter: z.number().int().positive().describe("Counter yang tampil di QR dosen; server menghitung C = floor(unix_server/qr_rotate_seconds)"),
  mac9: z.string().length(9).regex(/^[0-9]{9}$/).describe("9 digit hasil truncation RFC 4226; dibandingkan timingSafeEqual, bukan ==="),
  challengeResponse: z.string().length(6).regex(/^[0-9]{6}$/).optional()
    .describe("Wajib bila class_sessions.challenge_required = true; umur 5 dtk, sekali pakai"),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0).max(2000).describe("Akurasi perangkat; TIDAK pernah menjadi pusat lingkaran"),
  }).nullable().describe("null = tidak ada izin lokasi → NO_LOCATION (85), bukan lolos"),
  installDigest: z.string().length(64).regex(/^[0-9a-f]{64}$/)
    .describe("HMAC atas install id LOKAL (Keychain/Keystore). Firebase Installation ID / Play Integrity DILARANG: itu egress ber-kredensial (ADR-14)"),
  wifiBssid: z.string().max(35).nullable().optional().describe("Server yang meng-HMAC-nya lalu membandingkan hash; plaintext tidak pernah disimpan"),
  platform: z.enum(['android', 'ios']),
  appVersion: z.string().max(32),
  clientTimestamp: TimestampSchema.describe("Diagnostik selisih jam saja; keputusan memakai waktu server"),
});
// SERVER_ONLY — ditolak bila muncul di body: allowedRadiusMeters, latitude/longitude RUANG,
//   secret sesi, mac9 hasil render orang lain, fraud_score_bp, result, status attendances
```

**Verifikasi, berurutan, gagal-closed (menambah butir 2–4 & 8 dari §4.3.7):**
1. **Kepemilikan & scope** — seperti §4.3.7 butir 1; `sessionId` → baris `class_sessions` (`WHERE tenant_id = ctx.tenantId AND id = $1`), mahasiswa terdaftar di kelas itu → kalau tidak `403 NOT_YOUR_CLASS` (41). **Anti-IDOR**: tanpa pembacaan ini tidak ada `INSERT`.
2. **Waktu & jendela** — `counter` hanya sah di `{C−1, C, C+1}`; jam klien tidak pernah dipercaya. `algorithmVersion`/`keyVersion` tak dikenal → `422 QR_TOKEN_INVALID` (8).
3. **Kecocokan `mac9`** — HMAC dihitung server atas `counter(8 B BE) || session_short(8 B) || room_seq(2 B)` dengan `secret = HKDF-Expand-SHA256(IK_attendance[tenant], session_id || period_id)`; perbandingan `timingSafeEqual`. Rahasia **tidak pernah** dikirim ke klien, tidak pernah muncul di URL/log, dan **tidak pernah disimpan** di `attendance_token_uses`.
4. **Sekali-pakai di DB, bukan hanya Redis** — `UNIQUE (tenant_id, session_id, counter)` pada `attendance_token_uses` (`0041`) adalah penahan replay; penggunaan kedua → vonis `REJECTED_REPLAY` → **`409 SCAN_REPLAY_DETECTED` (62)**, dipakai ulang dari gugus §4.3, bukan kode baru.
5. **Rate limit** — maks 3 upaya per `(student, session, 60 s)` → `429 RATE_LIMIT_EXCEEDED` (9) + `Retry-After`. Ruang tebakan 10^9 tidak ditawar.
6. **Geofence sadar-akurasi** — titik acuan **koordinat ruang milik server** (`rooms.longitude`/`latitude`, `allowed_radius_m`, `max_accuracy_m`). Terima hanya bila `accuracy ≤ max_accuracy_m` **dan** `d − accuracy ≤ allowed_radius_m` (bukan `d ≤ radius`).
7. **Tantangan-balas** — bila `challenge_required`, klien menjawab tantangan 6 digit dalam 15 detik; gagal → `CHALLENGED_FAILED` → **`422 CHALLENGE_FAILED` (87)**.
8. **Skor kecurangan** — `fraud_score_bp = Σ(bobot_bp_sinyal × hadir_sinyal)` dengan bobot dari `academic_rules`; ambang `≤ 1500` terima, `1500–5000` → `PENDING_REVIEW` (antrean banding §4.3.8, respons `201` dengan `data.pendingReview: true` — **bukan** error), `> 5000` → `REJECTED_FRAUD_SUSPECT` → **`422 FRAUD_SUSPECT_REJECTED` (86)**. Sinyal (IP dibaca server dari *request* yang sudah dibersihkan, BSSID hash, `install_digest`, pergerakan mustahil `> 5 km` dalam `< 10 menit`, N mahasiswa satu digest) **boleh** menyumbang skor, **tidak** menjadi vonis otomatis kecuali gerbang keras.

**Peta vonis `attendance_token_uses.result` ke HTTP (kolom vonisnya milik `DATA_MODEL §18.6`; HTTP & kodenya milik bagian ini):**

| Vonis DB | HTTP | Kode `error.code` | Catatan |
|---|---:|---|---|
| `ACCEPTED` | 201 | — | `attendances.status` `PRESENT` atau `ABSENT_LATE`; dua-duanya hasil scan (§4.3.9 butir 4) |
| `REJECTED_REPLAY` | 409 | `SCAN_REPLAY_DETECTED` (62) | dipakai ulang; baris `attendances` tetap satu (`uq_attendances_session_student`) |
| `OUT_OF_FENCE` | 422 | `OUT_OF_GEOFENCE` (60) | dipakai ulang; `details[]` memuat `distanceMeters` + `radiusMeters` milik server |
| `GPS_LOW_ACCURACY` | 422 | `GPS_ACCURACY_TOO_LOW` (84) | baru; bukan `OUT_OF_GEOFENCE` — penyebabnya kualitas sinyal, bukan posisi |
| `NO_LOCATION` | 422 | `LOCATION_UNAVAILABLE` (85) | baru; perangkat tanpa izin lokasi. Beda dengan `ROOM_GEO_UNAVAILABLE` (63) yang adalah **ruang** tanpa koordinat |
| `REJECTED_FRAUD_SUSPECT` | 422 | `FRAUD_SUSPECT_REJECTED` (86) | baru; selalu bersama `signals[]` + hak banding §4.3.8 |
| `CHALLENGED_FAILED` | 422 | `CHALLENGE_FAILED` (87) | baru; tantangan tidak dijawab/salah/kedaluwarsa. Alias `ATTENDANCE_CHALLENGED_FAILED` **kalah** — vonisnya `CHALLENGED_FAILED`, kodenya baris ini |
| `REJECTED_FRAUD_SUSPECT` + sinyal `impossible_travel_m` | 422 | `ATTENDANCE_IMPOSSIBLE_TRAVEL` (102) | **gerbang keras dua titik** (`> 5 km` dalam `< 10 menit`), bukan soal skor: 86 menolak karena `fraud_score_bp` lewat ambang, 102 menolak karena perjalanan itu sendiri mustahil. **Catatan kejujuran enum:** `attendance_token_uses.result` (`0041`) **tidak punya** nilai `IMPOSSIBLE_TRAVEL` dan enum itu milik `DATA_MODEL §18.6`, jadi vonis yang tersimpan tetap `REJECTED_FRAUD_SUSPECT` dengan sinyal `impossible_travel_m` di `attendance_fraud_findings.signals`; HTTP yang dikirim tetap 102. Bila vonis tersendiri dianggap perlu, itu **perluasan enum milik DATA_MODEL**, bukan keputusan dokumen ini |
| *(kanal registrasi perangkat)* | 409 | `DEVICE_BINDING_CONFLICT` (103) | `install_digest` sudah terikat ke keanggotaan lain pada tenant ini (`attendance_device_bindings`, `UNIQUE (tenant_id, membership_id, install_digest)`). **Bukan** 61 (integritas perangkat: mock/rooted/attestation) dan **bukan** 86 (skor): identitas perangkatnya yang bertabrakan. `share_count` naik sebagai **sinyal**; respons **tidak pernah** memuat daftar mahasiswa lain yang memakai digest yang sama (anti-oracle) |
| *(bukan kolom vonis)* | 422 | `WIFI_NOT_ALLOWED` (64) | BSSID hash tidak ada di allowlist ruang (§4.6.7, 87–88) |
| *(bukan kolom vonis)* | 422 | `DEVICE_INTEGRITY_FAILED` (61) | mock location/rooted/device binding tidak cocok — **temuan**, bukan penolakan tunggal bila kanal QA sah |
| *(bukan kolom vonis)* | 422 | `QR_TOKEN_INVALID` (8) | cacat token itu sendiri setelah §4.3.9 butir 1 dipersempit |
| *(keadaan turunan)* | 422 | `ROOM_GEO_UNAVAILABLE` (63) | fail-closed: ruang tanpa koordinat valid, scan ditolak bukan diloloskan |
| *(keadaan turunan)* | 422 | `PJJ_GEOFENCE_NOT_APPLICABLE` — **tidak dibuat**: jenis `PJJ`/`ONLINE` memakai `degraded:"GEOFENCE_NOT_APPLICABLE"` + kanal `LMS_ACTIVITY`, bukan kode error | lihat §6.10.5 |
| (`token store` mati) | 503 | `ATTENDANCE_TOKEN_STORE_UNAVAILABLE` (88) | **tidak pernah** menerima presensi tanpa penahan sekali-pakai; bergantung `ioredis` nyata (`RD-11`, `P-6`) |

**Aturan tambahan yang tidak boleh hilang:** (a) **satu-satunya penahan sekali-pakai adalah `attendance_token_uses`** dengan `UNIQUE (tenant_id, session_id, counter)` (`0041`) — kolom usulan di `attendances` (`window_index`, `key_version`, `token_hash`, `challenge_id`, `device_profile`, `observed_bssid`) adalah **bukti pada baris yang diterima**, bukan pengunci konsumsi (§4.3.9 butir 2); menahan replay dengan membaca `attendances` akan menghapus jejak upaya yang **ditolak**, padahal justru upaya itulah yang dibaca auditor. (b) Allowlist BSSID tinggal di **`attendance_network_allowlists`** (`bssid_hash` HMAC, per `room_id`, ikut `site` — `DATA_MODEL §18.6`; ejaan `room_wifi_allowlist` yang lama **kalah**), sedangkan kanal IP tetap `tenant_settings.attendance_ip_allowlist`; keduanya tidak digabung menjadi tabel ketiga. (c) `POST /attendance/qr/generate` (§4.3.1, yang hari ini hidup) adalah **oracle tanda tangan** `SEC-03` dan **diganti** oleh `POST …/sessions/{id}/challenge` — bukan dipertahankan sebagai "alternatif". Presensi massal tetap di-*batch flush* worker (`AGENTS §3.7`), rate limit per kelas di Redis, idempoten per `(studentId, sessionId)`. `attendance_fraud_findings.appeal_id` menunjuk `attendance_appeals` (`0017`); tidak ada tabel banding kedua.

#### 6.10.7 ALG-13 · Capaian OBE (`obe-attainment`, modul `academic`)

```http
POST /api/v1/admin/engine/obe-attainment/runs      body { scope:"course|program|institution", periodId, curriculumId, fullRebuild:boolean, requireComplete:boolean } → 202
POST /api/v1/admin/engine/obe-attainment/recompute body { outcomeLevel, outcomeId, periodId }  → 202 (satu bentuk harness, bukan kontrak kedua)
GET  /api/v1/admin/engine/runs/{runId}/results      draf capaian per (mk, CPL, periode) — paginasi §2.4
GET  /api/v1/reports/obe/attainment                 agregat resmi §4.12.2 (list §2.4) — `coverage` SELALU berdampingan
GET  /api/v1/reports/obe/attainment/drilldown       universitas → prodi → matakuliah → CPL/indikator → item → sampel mahasiswa
POST /api/v1/admin/obe-closing-actions              usul tindak lanjut (102) — `gapBp > 0` wajib
POST /api/v1/admin/obe-closing-actions/{id}/approve VALIDATE Kaprodi (103)
GET  /api/v1/admin/cpl-targets · POST · PUT /{id}/approve  target capaian (§4.6.7, 96–98)
```
- **`coverage` wajib ada di SETIAP respons** gugus ini — list, drilldown, `explain`, dan body `apply` — berdampingan dengan `nMissingEvidence` dan `attainmentBySks`/`attainmentByClass`. Angka capaian tanpa cakupan di sampingnya adalah angka yang menipu; respons yang kehilangan field itu dihitung **cacat kontrak** (`AGENTS §3.4` paritas: Dart tidak boleh menambahkannya sendiri). Publikasi/`approve` capaian dengan `coverage < cpl_targets.min_coverage` (baku `0.800`) → **`422 ATTAINMENT_COVERAGE_LOW` (104)**, dan **angka tetap dikembalikan** apa adanya — yang ditahan adalah penerbitannya, bukan realitasnya. Baris ini **bukan** 65 (tidak ada jalur pengukuran sama sekali) dan **bukan** 89 (target belum ditetapkan, `gapBp` tak terdefinisi).
- **Hierarki baca satu jalur, empat tingkat.** universitas → prodi → matakuliah → **indikator** (`assessment_indicators`) lalu item (`grade_components`): `drilldown` memakai `parentOutcomeId` + `level` + `indicatorId` dan **tidak** membuat tabel agregasi kedua. Setiap tingkat membawa `rollupMethod`-nya sendiri, jadi ketidakcocokan antara angka daun dan angka cabang terlihat di layar, bukan tersembunyi di belakang satu angka.
- **`recompute` adalah run, bukan tombol UPDATE.** Ia memakai bentuk harness §6.2/§6.10.1 (`202 { runId }` + `Location` + `Retry-After`), verba `OTHER` (`academic.obe.attainment.recompute`, 100), dan **tidak pernah** menerima angka dari body; koreksi = hitung ulang, bukan ketik ulang (`outcome_attainments.*` `SERVER_ONLY`, §4.6.7).
- **Rantai objek tidak dibuat ulang:** `program_outcomes` → `course_outcomes` → `outcome_sub_components` → `assessment_indicators` → `grade_components` → `outcome_matrix` → `outcome_attainments` semuanya `0032` (`DATA_MODEL §16.2`); `0042` hanya **menambah** rubrik, target, kolom `coverage`/`n_*`, dan tindak lanjut. Membuat tabel capaian kedua = temuan `RD-32`.
- **Aritmetika:** semua `numeric`/basis poin, pembulatan *half-up* per langkah, **tanpa float**; `Σ bobot_item per Sub-CPMK = 10000` dan `Σ bobot_outcome_matrix per CPL per kurikulum = 10000` → kalau tidak menutup, **`422 WEIGHT_SUM_NOT_100` (23)** dipakai ulang; tidak ada kode baru (pernyataan eksplisit `ARCHITECTURE §12.8`).
- **Dua penyebut disimpan keduanya:** `attainmentBySks` dan `attainmentByClass` + `coverage` + `nMissingEvidence`; mahasiswa tanpa bukti **tidak** dihitung nol dan **tidak** dibuang diam-diam. `rollupMethod` eksplisit (`SKS_WEIGHTED`/`STUDENT_MEAN`/`CLASS_MEAN`).
- **Distributif sebagai tes CI**, bukan keyakinan: hasil rollup prodi → universitas wajib sama dengan hitung ulang dari daun, toleransi `0 bp`.
- **Pemicu:** `grades` pindah `EFFECTIVE` menerbitkan transactional outbox → worker memperbarui **inkremental**; perhitungan **penuh** hanya saat `grading.lock` (snapshot resmi + `inputsDigest`). Baca agregat boleh ke **Replica** (laporan, bukan read-your-writes), nilai tersimpan sebagai snapshot per `calculatedAt`.
- **Tanpa target tidak ada selisih:** `422 OBE_TARGET_MISSING` (89). Angka turunan tidak dapat diedit manual (`outcome_attainments` `SERVER_ONLY`, §4.6.7) — koreksi = hitung ulang. Konversi MBKM ikut dengan penanda `weight_source='MBKM'` dan **tidak boleh** menghasilkan hitung ganda.

#### 6.10.8 ALG-14 · Verifier rantai audit (M-05) (`audit-chain-verify`)

```http
POST /api/v1/admin/engine/audit-chain-verify/runs   body { stream, partitionStart, mode } → 202 { verificationId }
```

**Kontrak HTTP objek jangkar & verifikasi pindah ke §4.21** (`RD-121`, siklus M-05). Yang tersisa di bagian ini adalah **semantik engine**: bentuk `mode` (`INCREMENTAL` / `PARTITION_SCAN` / `ANCHOR_PROOF`), kanonisasi, dan budget. `mode` tidak lagi diketik ulang di sini supaya tidak ada dua sumber kosakata (`RD-55`).
- Nama tabel jejak yang dipakai: `grade_change_logs` dan `system_audit_trails` (`0034`) — **bukan** `grade_audit_logs` yang kalah di `DATA_MODEL §14.8`; keduanya sudah punya `seq`/`prev_hash`/`hash` dan **tidak** di-ALTER ulang oleh `0043`.
- Kanonisasi & hash milik `ARCHITECTURE §12.9`; yang menjadi kontrak API: **tidak ada satu pun rute** yang menerima `seq`, `prevHash`, `recordHash`, `rootHash`, `verdict`, `findings`, atau `compromisedAt` dari body (semuanya `SERVER_ONLY`), dan **tidak ada rute "repair"** — permintaannya akan dijawab `403 FORBIDDEN` (3) karena izinnya tidak ada dan tidak akan dibuat.
- `COMPROMISED` pada objek yang hendak di-`apply`/dijangkar ulang → **`409 AUDIT_CHAIN_COMPROMISED` (90)** + partisi beku + alarm CRITICAL. Verifier dijalankan oleh `PLATFORM_OPERATOR`/`COMPLIANCE_OFFICER` **khusus verifier** (106); pembaca `audit-logs` tidak otomatis boleh menjalankan.
- Zero-API-key: RFC 3161 TSA dan certificate transparency **ditolak** sebagai jalur wajib (`ARCHITECTURE §12.9`); ekspor jangkar memakai object storage WORM milik sendiri (`storageKey`) dan salinan di tenant-platform terpisah.

#### 6.10.9 Kode error §6.10: yang baru dan yang dipakai ulang

| Nomor | Kode | Pemakaian | Status |
|---:|---|---|---|
| 79 | `TIMETABLING_INFEASIBLE` | ALG-8 (§6.10.2) | `spec` |
| 80 | `MODEL_QUALITY_GATE_UNMET` | ALG-10 (§6.10.3, §4.6.7) | `spec` |
| 81 | `MODEL_FEATURE_DENYLISTED` | ALG-10 (§6.10.3, §4.6.7) | `spec` |
| 82 | `AUTOFIX_REVIEW_REQUIRED` | ALG-11 (§6.10.4) | `spec` |
| 83 | `AUTOFIX_EXPR_FORBIDDEN` | ALG-11 (§6.10.4, §4.6.7) | `spec` |
| 84 | `GPS_ACCURACY_TOO_LOW` | ALG-12 (§6.10.6) | `spec` |
| 85 | `LOCATION_UNAVAILABLE` | ALG-12 (§6.10.6) | `spec` |
| 86 | `FRAUD_SUSPECT_REJECTED` | ALG-12 (§6.10.6) | `spec` |
| 87 | `CHALLENGE_FAILED` | ALG-12 (§6.10.6) | `spec` |
| 88 | `ATTENDANCE_TOKEN_STORE_UNAVAILABLE` | ALG-12 (§6.10.6) | `spec` — butuh `ioredis` nyata (`RD-11`, `P-6`) |
| 89 | `OBE_TARGET_MISSING` | ALG-13 (§6.10.7, §4.6.7) | `spec` |
| 90 | `AUDIT_CHAIN_COMPROMISED` | ALG-14 (§6.10.8) | `spec` |
| 91 | `PROJECT_OUTPUT_REQUIRED` | Tugas Akhir 53/2023 (§4.6.7) | `spec` |
| 99 | `ENGINE_DATA_INSUFFICIENT` | **seluruh engine** (§6.2, §6.10.2, §6.10.3, §6.10.4, §6.10.5, §6.10.7) — dipakai bersama, satu kode untuk semua mode turun yang dituntut menjadi angka final | `spec` |
| 100 | `ADVISOR_QUOTA_EXCEEDED` | ALG-9 (§6.10.3) — kuota bimbingan wali | `spec` |
| 101 | `MODEL_STALE` | ALG-10 (§6.10.3, §6.10.5) — drift `psi > 0.25` saat skor prediktif dipaksa | `spec` |
| 102 | `ATTENDANCE_IMPOSSIBLE_TRAVEL` | ALG-12 (§6.10.6) — gerbang keras dua titik; vonis DB tetap `REJECTED_FRAUD_SUSPECT` | `spec` |
| 103 | `DEVICE_BINDING_CONFLICT` | ALG-12 (§6.10.6) — `install_digest` terikat ke keanggotaan lain | `spec` |
| 104 | `ATTAINMENT_COVERAGE_LOW` | ALG-13 (§6.10.7, §4.12.2) — publikasi/approve capaian di bawah `min_coverage` | `spec` |
| 105 | `TARIFF_RULE_AMBIGUOUS` | §4.6.7/§4.6.8 — dua baris `ACTIVE` sama-spesifik | `spec` (objek `0046`, tertahan `0021`) |
| 106 | `TARIFF_NO_MATCH` | §4.6.7/§4.6.8 — nol baris menutup; generator dilarang menebak | `spec` (objek `0046`) |
| 92–98 | `LOOKUP_*`, `CUSTOM_ATTR_*` | **milik gugus §4.14**, didaftar dan dijelaskan di **§4.14.6** — tidak diulang di sini agar satu baris punya satu rumah penjelasan | `spec` |
| 107–118 | `PARAM_*`, `MENU_*`, `EVIDENCE_INSUFFICIENT` | **milik gugus §4.16–§4.18** (mesin parameter, menu dinamis & grant, presensi multi-modus), dijelaskan di **§4.16.7**, **§4.17.3**, **§4.18.5**. Bukan kode engine — tapi §4.16 **menyediakan ambang** yang dibekukan dalam `parameter_version` harness §6.2, jadi run engine yang membaca `attendance.min_presence_pct` wajib mencatat versinya | `spec` |
| 107–118 | `PARAM_*`, `MENU_*`, `EVIDENCE_INSUFFICIENT` | **milik gugus §4.16–§4.18** (mesin parameter, menu dinamis & grant, presensi multi-modus) — dijelaskan di **§4.16.7**, **§4.17.3**, **§4.18.5**. Bukan kode engine: tidak ada satu pun rute §6 yang memancarnya, dan §4.16 justru **menyediakan ambang** yang dibaca engine lewat harness-nya (`parameter_version`, §6.2) | `spec` |

**Dipakai ulang, bukan diduplikasi:** 6 (`VALIDATION_FAILED`), 7 (`ACADEMIC_RULE_VIOLATION` — aturan lintas field `program_type`/`delivery_mode`), 9 (rate limit scan), 12 (`CONFLICT` — slot ketersediaan, kunci tarif, `UNIQUE (tenant, kind, code)` kamus §4.14), 16 (`ADMIN_SCOPE_MISMATCH` — scope `SITE`, termasuk penolakan pratinjau tarif; nama `SITE_SCOPE_VIOLATION` kalah, §2.3 butir 8), 19 (`REFERENCE_IN_USE` — site dengan ruang aktif, kendala/aturan yang dirujuk, **item kamus yang masih dipakai**; nama `LOOKUP_ITEM_IN_USE` kalah dan muatan dampaknya pindah ke baris ini), 20, 22 (`BAND_OVERLAP` — pita rubrik), 23 (`WEIGHT_SUM_NOT_100` — bobot indikator), 24 (`LECTURER_WORKLOAD_EXCEEDED` — H-6), 25 (`PERIOD_CLOSED`), 26 (`MODULE_NOT_AVAILABLE`), 32 (`FEEDER_BLOCKING_FINDINGS`), 36 (`CLASS_FULL`), 37 (`ACADEMIC_CREDIT_QUOTA_EXCEEDED`), 38 (`GATE_BLOCKED`), 41 (`NOT_YOUR_CLASS`), 42 (`ENROLLMENT_ENGINE_UNAVAILABLE` — antrean ALG di luar kapasitas), 46 (`DUPLICATE_SUBMIT` — replay `Idempotency-Key` pada `apply`, auto-fix, **dan seluruh tulis §4.14**), 48 (`NOT_YOUR_STUDENT` — wali membaca catatan mahasiswanya), 55 (`DECISION_ALREADY_MADE` — juga aktivasi atribut yang sudah `ACTIVE`), 56 (`SELF_APPROVAL_FORBIDDEN` — **setiap** `VALIDATE` gugus ini, termasuk `PUT …/custom-attributes/{id}/activate`), 59 (`EXPORT_LIMIT_EXCEEDED` — hasil engine terlalu panjang, `override` tarif melewati plafon baris), 60 (`OUT_OF_GEOFENCE` — vonis `OUT_OF_FENCE`), 61, 62 (`SCAN_REPLAY_DETECTED` — vonis `REJECTED_REPLAY`), 63, 64, 66 (`PREREQ_CYCLE`), 73, 74, 75 (harness). Daftar nama yang **kalah** dan baris pemenangnya ada di **§2.3 butir 8**; daftar pakai ulang gugus §4.14 ada di **§4.14.6**.

#### 6.10.10 Dependensi nyata, i18n, dan paritas Mobile

1. **Tidak ada satu pun baris §6.10 yang boleh di-merge** sebelum: migrasi `0036`–`0046` ada di `packages/database/migrations/` **dan** generator RLS menghasilkan policy untuk tiap tabel baru **dan** izin 51–126 dipromosikan ke `PERMISSION_SPECS` (`gen-rbac-seed.mjs` dijalankan ulang) — urutan `AGENTS §3.8` dan `DATA_MODEL §19.6`. Gugus §4.14 memikul syarat yang **lebih berat** dari itu: `0047_master_lookup_engine.sql` dan `0048_custom_attributes.sql` juga belum ada berkasnya, **dan** izin `master.lookup.*`/`settings.customattr.*` belum menjadi baris mana pun di `RBAC_MATRIX §4.5` (lihat §4.14.6 butir 2) — jadi tidak ada satu pun rute kamus/atribut yang boleh dikode sebelum keduanya selesai.
2. **Dependensi yang belum ada di `package.json` dan tidak boleh diklaim berjalan:** `bullmq`, `ioredis` (`RD-11`, `P-6` — seluruh `runs`/antrean/SSE dan penahan sekali-pakai ALG-12), `or-tools` (opsi solver ALG-8, worker terpisah), runtime ONNX/worker Python (`P-11`, pelatihan ALG-10), `pgcrypto` untuk `digest()` sisi DB (`ARCHITECTURE §12.12`).
3. **Nol egress tetap berlaku:** tidak ada `fetch(`/`axios`/`https.request` di direktori engine; CI menolak. Tidak ada kredensial pihak ketiga di badan permintaan.
4. **i18n:** tiap baris **79–118** wajib punya `admin.errors.<CODE>` di `id.json` **dan** `en.json` dengan bentuk kunci identik dan pesan yang menyebut **sebab + langkah perbaikan** (`AGENTS §3.5`, `UI_UX_DESIGN §12.4`) — termasuk 107–118 yang lahir di siklus §4.16–§4.18 dan **tidak** dimiliki gugus engine. Namespace `admin.errors` **belum ada** di `apps/web/src/locales/id.json` hari ini — penambahannya bagian dari penutupan RD-12, dan menuliskan kodenya di register §2.3 tidak menambah satu pun kunci. Token `degraded` di §6.10.5 **tidak** diberi nama yang sama dengan kode error — yang pertama label keadaan, yang kedua penolakan; keduanya tampil apa adanya.
5. **Paritas Mobile (§3.4):** yang punya permukaan di Flutter adalah **ALG-9** (mahasiswa: rekomendasi + alasan, layar `/krs/rekomendasi`), **ALG-10** (mahasiswa: risiko sendiri; wali: tindak lanjut), **ALG-12** (scan `counter`/`mac9`/`coordinates`/`accuracyMeters`/`installDigest` — **hanya** pemindai; `secret` tidak pernah menyentuh perangkat), dan **ALG-13** sebagai pembacaan laporan (`drill-down`), bukan sebagai penulis. ALG-8, ALG-11, ALG-14 tetap Web/admin-only dan itu dinyatakan eksplisit. Paritas numerik TS ↔ Dart diuji per vektor fixtured, bukan diasumsikan. **Gugus §4.14 punya permukaan di kedua platform** (formulir biodata PMB, KRS, pengisian data mahasiswa): Web dan Flutter membaca `GET /master/lookups` dan `GET/PATCH /{entity}/{id}/attributes` yang **sama**, merender dari `inputKind`/`minSelections`/`maxSelections`/`validationRegex` yang **sama**, dan menyimpan `ETag`/`X-Lookup-Version` yang **sama** — kamus per-platform, regex per-platform, atau pengurutan `id` di salah satu klien adalah pelanggaran paritas, bukan variasi yang sah.

---

## 7. Kontrak endpoint 47 modul (2026-10-20)

Bab ini menagih satu hal yang pemilik produk tuntut dan dokumen lain belum jawab: **permukaan REST untuk modul-modul yang di `PRD §5.12.1` berstatus `NOL` dan `SEBAGIAN`**. Ia **tidak** menambah norma baru. Ia menerjemahkan tiga norma yang sudah ada dan mengikat menjadi path:

1. **Kepemilikan objek** — empat belas vonis `PRD §5.13.1`: hanya pemilik objek yang punya rute tulis; modul lain memancarkan **sinyal**. Setiap baris di bawah yang berstatus "sinyal" menunjuk vonis nomor berapa.
2. **Kosakata peristiwa** — katalog `ARCHITECTURE §13.1` (42 peristiwa kanonik `modul.entitas.aksi`). Bab ini **tidak** menciptakan `event_type` baru; bila sebuah rute memancarkan peristiwa, namanya diambil dari katalog itu apa adanya.
3. **Jalur real-time** — vonis `ARCHITECTURE §13.2`: **SSE** untuk semua satu-arah, **WebSocket hanya** untuk M-17 *incident feed* dan M-43 *gate check-in*, `queue_operations` (DB) sebagai *spine*, dan **BullMQ/Redis design-only**. Setiap baris `stream` di bawah tunduk pada vonis itu, tanpa pengecualian lain.

**Hasil ukur sebelum menulis (diukur 2026-10-20, bukan dikutip dari bab lain).**

| Yang diukur | Cara | Hasil |
|---|---|---|
| Rute nyata hari ini | cacah berkas `route.ts` di bawah `apps/web/src/app/api/v1` | **18** berkas, seluruhnya di bawah `academic`, `attendance`, `auth`, `health`, `tenant` |
| Handler di bawah prefix §7 | `ls apps/web/src/app/api/v1` | **nol** — tidak ada `helpdesk`, `hr`, `sister`, `library`, `asset`, `clinic`, `residence`, `event`, `crm`, `procurement`, `ppks`, `career`, `mobility`, `lms`, `public` |
| Baris register §2.3 | cacah baris bernomor dengan kode HTTP 4xx/5xx | **118** baris **sebelum §7** — nomor tertinggi yang terbit saat itu adalah **118**; setelah 25 baris §7.22 dimasukkan menjadi **143** |
| Nomor baru yang dipakai §7 | kelanjutan register | **119–143** (25 kode); lihat §7.22 |
| Handler SSE dan WebSocket | cari tiga token `websocket`, `EventSource`, `text/event-stream` di `apps/web/src` | **0** berkas |
| Dependensi jalur antrean | cari `bullmq`, `ioredis`, `ws`, `socket.io` di `package.json` akar, `apps/web`, `packages/contracts`, `packages/database` | **0** kemunculan keempatnya → seluruh rute `202`, `stream`, dan sinyal di bab ini **design-only** (`RD-11`, `P-6`) |
| Namespace i18n error | cari kunci `admin.errors` di `apps/web/src/locales/id.json` | **0** — tidak satu pun kunci `admin.errors.*` ada |

**Konvensi yang berlaku khusus untuk bab ini.**

- **Path ditulis tanpa prefix.** Semua kolom *Path* di §7 relatif terhadap `/api/v1`; contoh barisnya `GET /helpdesk/tickets` berarti `GET /api/v1/helpdesk/tickets`. Prefix tidak pernah ditulis dua kali — ini aturan yang sama dengan inventaris §5.14 dan §5.15.
- **Izin ditulis `resource.verb` dan selalu berstatus `usulan`.** Nomor baris **bukan** milik bab ini: penomoran titik aksi adalah milik [`RBAC_MATRIX §4.5`](file:///c:/SICA/docs/RBAC_MATRIX.md) (terukur berhenti di **161** saat bab ini disusun). Verba akhir dipetakan ke enam verba kanonik `FR-IDT-04`: `view` → READ, `create` → INSERT, `update` → UPDATE, `delete` → DELETE, `approve`/`review`/`validate` → VALIDATE, aksi named (`convert`, `checkin`, `push`, `seal`, …) → OTHER. Tidak ada satu pun kode di bawah yang boleh dikode sebelum menjadi baris `RBAC_MATRIX §4.5` lalu dipromosikan ke `PERMISSION_SPECS` (`packages/contracts/src/authz.ts`) dan `gen-rbac-seed.mjs` dijalankan ulang — urutan `AGENTS §3.8` dan `AGENTS §3.11`.
- **Status, tiga nilai, tidak ada yang keempat.** `implemented` = ada `route.ts` dan dipanggil; `spec-only` = rutenya sudah terikat objek yang **punya DDL tertulis** di `DATA_MODEL §22` (terukur: nomor **0051–0057** sudah terbit untuk M-04, M-35, gugus pihak ketiga, M-06, M-08, M-11, M-47), tetapi handler-nya nol dan izinnya masih `usulan`; `blocker` = objeknya **belum** bernama di `DATA_MODEL §22` **atau** rutenya menahan dependensi yang belum ada (`bullmq`/`ioredis`/`ws`/`TENANT_ENCRYPTION_MASTER_KEY`). Sebuah baris `blocker` dapat naik menjadi `spec-only` **hanya** ketika pemilik objeknya menerbitkan nomor — penetapan itu milik `DATA_MODEL`, bukan bab ini, dan bab ini tidak menulis nomor yang belum ada.
- **Nomor migrasi tidak dikarang di sini.** Untuk gugus yang belum punya objek, bab ini menulis "objek diminta ke `DATA_MODEL §22`" beserta daftar field yang wajib ada, bukan nomor.

**Yang tidak akan ada di bab ini, dan itu disengaja:** tidak ada rute tulis kedua ke objek yang sudah punya pemilik (`enrollments`, `grades`, `invoices`, `ledger`, `attendances`, `student_clearance`, `class_schedules`, `pmb_applications`, `assets`, `mbkm conversions`); tidak ada endpoint pembayaran kedua; tidak ada field `SERVER_ONLY` yang diterima dari body; tidak ada satu pun klaim "sudah berjalan". Alasan penolakan per titik tumpang tindih didaftar di **§7.23 butir penolakan**.

### 7.1 M-04 · IT Helpdesk

`entitlement: —` (gerbang peran, **bukan** SKU — `PRD §5.12.3`); objek: `0051_helpdesk_ticketing.sql` (DDL tertulis di `DATA_MODEL §22.1.1`). Ruang lingkupnya **dukungan operasional**, dan vonis batasnya ada di dua arah:

1. **Tiket bukan banding akademik.** Banding presensi tetap hidup di `POST /attendance/appeals` (§4.3.8) dengan `VALIDATE` pengampu kelas dan keputusan `ACCEPTED`/`REJECTED`. Helpdesk **tidak** punya rute yang menyentuh `attendances`, `grades`, `enrollments`, maupun clearance. Upaya membuat "tiket banding nilai" di sini = `403 CROSS_MODULE_WRITE_FORBIDDEN` (119) dengan rujukan pemilik objek, sesuai `PRD §5.13.2` butir 5.
2. **Tiket bukan laporan PPKS.** Kasus kekerasan seksual hanya lewat M-36 (§7.10): isinya terenkripsi dan nol visibilitas bagi `TENANT_ADMIN`. Kategori tiket yang mengarah ke sana **ditolak saat validasi** dan klien diarahkan ke `POST /ppks/reports` — bukan dibuat "tiket prioritas khusus" yang isinya tertahan di helpdesk.

Keadaan tiket dicabangi penjaga transisi, karena itu `tickets.state` adalah enum kelas A (`AGENTS §3.10`) dan **bukan** kamus; yang menjadi kamus kelas C hanyalah `jenis_tiket`, `tingkat_dampak`, dan `hari_kerja` (dibaca lewat `GET /master/lookups?group=…`, §4.14.1), sedangkan `prioritas_tiket` adalah label kelas A′ untuk enum `ticket_priority` (`LOW/NORMAL/HIGH/URGENT`) yang dicabangi aturan eskalasi. Transisi yang sah: `OPEN → IN_PROGRESS|CANCELLED`; `IN_PROGRESS → PENDING_USER|RESOLVED|CANCELLED`; `PENDING_USER → IN_PROGRESS|RESOLVED|CANCELLED`; `RESOLVED → CLOSED|IN_PROGRESS`; `CLOSED → IN_PROGRESS` (reopen dalam jendela retensi, `resolved_at`/`closed_at` dikosongkan); `CANCELLED` terminal.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/helpdesk/tickets` | usulan `helpdesk.ticket.view` | M-04 | spec-only | List amplop §2.4; filter `state`, `categoryId`, `slaState`, `assigneeId`; `?at=` boleh Replica, daftar milik sendiri **read-your-writes ke Primary** |
| POST | `/helpdesk/tickets` | usulan `helpdesk.ticket.create` | M-04 | spec-only | `201` + `ticketNumber`; wajib `Idempotency-Key` (46 saat replay); lampiran lewat presign §4.8, **bukan** multipart; body tidak memuat `state`, `priority`, maupun `assignedToId` — prioritas awal `NORMAL` diturunkan server dari kategori × dampak; SLA disalin dari versi `ACTIVE` saat itu |
| GET | `/helpdesk/tickets/{id}` | usulan `helpdesk.ticket.view` | M-04 | spec-only | Anti-IDOR: `WHERE tenant_id = ctx.tenantId AND id = $1` dalam transaksi (§4.11 L2/L6); `slaState` dihitung server, tidak pernah dari body |
| PATCH | `/helpdesk/tickets/{id}` | usulan `helpdesk.ticket.update` | M-04 | spec-only | Hanya `title`, `description`, `categoryId`, `impactCode`, `attachmentIds[]`; `priority` hanya untuk agen scope `ORG` (pemohon yang mengirimnya → `422 VALIDATION_FAILED`); `SERVER_ONLY`: `state`, `ticketNumber`, `resolvedAt`, `slaDeadline`, `priority` bagi pemohon — transisi hanya lewat aksi di bawah |
| POST | `/helpdesk/tickets/{id}/comment` | usulan `helpdesk.ticket.comment` | M-04 | spec-only | Append-only; komentar dari pemohon membuka kembali timer SLA **hanya** bila state mengizinkan, itu keputusan service (L5), bukan klien |
| POST | `/helpdesk/tickets/{id}/claim` | usulan `helpdesk.ticket.claim` | M-04 | spec-only | `OTHER`; klaim hanya untuk agen ber-scope; sudah terklaim → `409 CONFLICT` (12) dengan `currentAssigneeId` |
| POST | `/helpdesk/tickets/{id}/resolve` | usulan `helpdesk.ticket.resolve` | M-04 | spec-only | Menaikkan state ke `RESOLVED`; transisi tidak sah → `409 TICKET_STATE_TRANSITION_INVALID` (122); `resolutionNote` wajib |
| POST | `/helpdesk/tickets/{id}/close` | usulan `helpdesk.ticket.close` | M-04 | spec-only | **VALIDATE**; penutup oleh pemohon atau penyelia, actor yang sama dengan resolver → `403 SELF_APPROVAL_FORBIDDEN` (56); penulis-peran-admin wajib MFA (`AGENTS §3.8`) |
| POST | `/helpdesk/tickets/{id}/reopen` | usulan `helpdesk.ticket.reopen` | M-04 | spec-only | `UPDATE` keadaan; hanya dari `RESOLVED`/`CLOSED` dalam jendela retensi; `reason` wajib dan ikut `audit_logs` |
| POST | `/helpdesk/tickets/{id}/cancel` | usulan `helpdesk.ticket.cancel` | M-04 | spec-only | `OTHER` (aksi bernama terdaftar); hanya pemohon scope `SELF` atau agen scope `ORG`, dan hanya dari `OPEN`/`IN_PROGRESS`/`PENDING_USER`; `reason` wajib; `CANCELLED` terminal dan membalik janji SLA |
| GET | `/helpdesk/categories` | usulan `helpdesk.category.view` | M-04 | spec-only | Kategori = **kebijakan** yang menunjuk `reference_items(kind='jenis_tiket')`; label/urutan/`isActive` dibaca dari kamus join, bukan kolom kembar; urutan `sort_order, code`, bukan `id`; item nonaktif tetap terbaca lewat `?at=` (BR-R12) |
| POST | `/helpdesk/categories` | usulan `helpdesk.category.create` | M-04 | spec-only | Membuat satu nilai kamus `jenis_tiket` **lewat service M-02** + satu baris kebijakan (`defaultOrgId`, `requiresAsset`, `requiresSite`) dalam satu transaksi; `code` unik per tenant; tidak ada `z.enum` di kontrak (`AGENTS §3.10`) |
| PATCH | `/helpdesk/categories/{id}` | usulan `helpdesk.category.update` | M-04 | spec-only | Label/urutan/`isActive` diubah lewat service M-02 (bukan tulis langsung ke `reference_items`); kolom kebijakan diubah di baris M-04; item yang masih dipakai tiket **tidak dihapus** → `409 REFERENCE_IN_USE` (19); label baru tidak mengubah tiket lama |
| GET | `/helpdesk/sla-policies` | usulan `helpdesk.sla.view` | M-04 | spec-only | Objek `helpdesk_sla_policies`; versi `DRAFT`/`ACTIVE`/`RETIRED`; `effectiveFrom`/`effectiveTo` wajib; tidak ada edit in-place saat `ACTIVE` |
| POST | `/helpdesk/sla-policies` | usulan `helpdesk.sla.create` | M-04 | spec-only | Membuat **versi baru** `DRAFT` untuk satu `categoryId`; target tanggapan/penyelesaian + jam kerja kampus (`workCalendarItemId`, kamus `hari_kerja`) dibaca dari data; nomor versi diterbitkan server |
| GET | `/helpdesk/sla-policies/{id}` | usulan `helpdesk.sla.view` | M-04 | spec-only | Satu versi + riwayat perubahan; angka SLA adalah metrik layanan, bukan gerbang akademik |
| PATCH | `/helpdesk/sla-policies/{id}` | usulan `helpdesk.sla.update` | M-04 | spec-only | Hanya versi `DRAFT`; versi `ACTIVE` ditutup lewat `effectiveTo` dan diganti versi baru, bukan ditimpa |
| POST | `/helpdesk/sla-policies/{id}/approve` | usulan `helpdesk.sla.approve` | M-04 | spec-only | **VALIDATE**; approver ≠ pembuat versi (`requested_by <> approved_by`) ditegakkan `CHECK`; MFA; satu `ACTIVE` per kategori (partial unique index), sehingga persetujuan menutup versi lama dalam transaksi yang sama |
| GET | `/helpdesk/sla-policies/{id}/impact` | usulan `helpdesk.impact.view` | M-04 | spec-only | Membaca proyeksi tiket aktif yang terkena; **tidak** ada rute tulis; pola sama dengan `GET /admin/master/lookups/impact` (§4.14.2) |
| GET | `/helpdesk/escalations` | usulan `helpdesk.escalation.view` | M-04 | spec-only | Eskalasi **hasil aturan server** (`priorityCode`, keterlambatan SLA, hierarki tim); bukan nilai yang dikirim klien |
| POST | `/helpdesk/tickets/{id}/escalate` | usulan `helpdesk.escalation.create` | M-04 | spec-only | Klien hanya meminta eskalasi; `escalationLevel` dihitung service; alasan wajib dan tercatat di `audit_logs` |
| GET | `/helpdesk/knowledge-base` | usulan `helpdesk.kb.view` | M-04 | spec-only | Pemohon hanya melihat artikel `PUBLISHED` dua bahasa; `DRAFT`/`REVIEW` hanya penulis/penyunting |
| POST | `/helpdesk/knowledge-base` | usulan `helpdesk.kb.create` | M-04 | spec-only | Draft terpisah dari terbitan; `title`/`bodyMarkdown` + `titleEn`/`bodyMarkdownEn` wajib **sebelum** `publish` (`CHECK` menolak `PUBLISHED` bila kosong); tidak ada `options={[` untuk kategori |
| GET | `/helpdesk/knowledge-base/{id}` | usulan `helpdesk.kb.view` | M-04 | spec-only | Artikel terbit bersifat append-only lewat versi baru; tautan balik ke tiket yang memecahkan masalah tercatat |
| PATCH | `/helpdesk/knowledge-base/{id}` | usulan `helpdesk.kb.update` | M-04 | spec-only | Hanya `DRAFT`/`REVIEW`; artikel `PUBLISHED` tidak diedit in-place — terbitkan versi baru |
| POST | `/helpdesk/knowledge-base/{id}/publish` | usulan `helpdesk.kb.publish` | M-04 | spec-only | **VALIDATE**; actor ≠ penulis; dua bahasa lengkap; jenis tiket yang menandai kanal PPKS/banding akademik ditolak saat registrasi (FR-HLP-03) |

**Peristiwa yang dipancarkan:** gugus ini **tidak** menambahkan satu pun nama ke katalog `ARCHITECTURE §13.1`. Tiket adalah objek leaf yang tidak dikonsumsi modul akademik, sehingga seluruh transisinya tercatat di `audit_logs` (M-05) tanpa peristiwa outbox. Ini keputusan sadar: menambah `helpdesk.ticket.resolved` ke katalog akan menciptakan kosakata peristiwa yang tidak punya konsumen, dan §13.1 hanya memuat peristiwa dengan konsumen tercantum.

**Real-time:** tidak ada. Daftar tiket penyelia memakai `GET` dengan `pollAfterMs` pada respons list (amplop §2.4) — **bukan** SSE, karena vonis §13.2 membatasi WebSocket dan plafon stream hanya untuk kasus satu-arah bernilai tinggi. Ini dinyatakan agar tidak bertambah satu jalur dorong tanpa kebutuhan.

### 7.2 M-06 · HRIS & Payroll

`entitlement: usulan: hris`; objek: `0054_hris_payroll.sql` (DDL tertulis di `DATA_MODEL §22.2.2`). Tiga vonis mengikat gugus ini:

1. **Gaji tidak pernah menjadi ledger kedua.** Pembayaran pegawai adalah domain M-06; tagihan mahasiswa tetap `finance/invoices` milik M-10. Tidak ada rute di sini yang menulis `ledger` — posting jurnal payroll dilakukan oleh **service M-10** atas run yang sudah disetujui, dan `ALG-19` dilarang menulis `ledger` (gerbang (j) `ARCHITECTURE §13.5.1`).
2. **PPh 21 dihitung lewat pola engine, bukan angka diketik.** Kalkulasi yang menuntut snapshot (rekap setahun, koreksi periode lalu) masuk harness §6.2: `POST /admin/engine/pph21-bracket/runs` → `202 { runId }`, hasil di `payroll_calc_results`/`payroll_calc_lines` dengan `proposal_only = true`. **Tidak** ada rute yang menerima `taxAmountRupiah` dari body.
3. **Tarif dibaca dari data berversi, bukan konstanta.** Lapisan PPh 21 dan PTKP adalah **kelas B** (`reference_dictionary_entries` berversi): tenant hanya memetakan label dan **tidak dapat** mengubah angka yang ditetapkan negara (`AGENTS §3.10`). `version` aturan tarif ikut tercatat di `parameter_version` run sehingga hasil dapat direproduksi; versi non-`ACTIVE` pada tanggal periode → `422 TAX_RULE_VERSION_INACTIVE` (124). Bila kamus kelas B belum di-*seed*, engine **menolak menghitung** (`degraded: "NO_TARIF_DICT"`), bukan memakai angka hafalan.

BKD tridharma **bukan** milik gugus ini: `hr.bkd.*` adalah M-07 (ALG-17) dan M-06 hanya membaca penugasan, tidak menghitung 12 sks.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/hr/employees` | `hris.employee.view` (162) | M-06 | spec-only | List §2.4; **proyeksi server**: NIK, tanggal lahir, dan rekening diblokir kecuali peran berhak (`FIELD_RULES['kepegawaian.payroll']`); peran non-kepegawaian menerima boolean "ada" tanpa nominal |
| POST | `/hr/employees` | `hris.employee.insert` (163) | M-06 | spec-only | `201`; `employeeNumber` diterbitkan server; `SERVER_ONLY`: `status`, `effectiveDate`; `Idempotency-Key` wajib; **tidak ada satu pun kolom peran** di body — hak dibaca dari `user_role_assignments` milik M-03 (`AC-HRS-2`) |
| GET | `/hr/employees/{id}` | `hris.employee.view` (162) | M-06 | spec-only | Drawer + tab riwayat penugasan berversi; id milik tenant lain → `404 NOT_FOUND` (5), bukan 403 |
| PATCH | `/hr/employees/{id}` | `hris.employee.update` (164) | M-06 | spec-only | Whitelist field; NIP/NIK/gelar nasional **ditolak** bila dikirim (kelas B, tenant hanya memetakan label); perubahan ber-effectif-date, bukan penimpaan |
| POST | `/hr/employees/{id}/deactivate` | `hris.employee.deactivate` (165) | M-06 | spec-only | **Transisi terminal = verba DELETE yang dituntut partisi `hris`**; wajib `reason` + `separationType` (kamus `jenis_pemberhentian`, kelas C) + `effectiveDate` + bukti untuk PHK (`VERIFIKASI-LEGAL` UU 13/2003); pemroses ≠ pengusul (SoD 165); **kartu, slip, dan riwayat tetap terbaca** — tidak pernah `DELETE /hr/employees/...` |
| GET | `/hr/leave-types` | `hris.leavepolicy.view` (353) | M-06 | spec-only | Jenis cuti = kamus kelas C `reference_items(kind='jenis_cuti')`; **bukan** enum dan bukan array di kode |
| GET | `/hr/leave-policies` | `hris.leavepolicy.view` (353) | M-06 | spec-only | Pita hak cuti (jenis × golongan × masa kerja) berversi; `?at=YYYY-MM-DD` membaca versi yang berlaku pada tanggal itu (BR-R12) |
| POST | `/hr/leave-policies` | `hris.leavepolicy.insert` (354) | M-06 | spec-only | `201` versi `DRAFT`; tumpang tindih pita untuk (jenis, golongan) yang sama dan sama-sama aktif → `409` dari `EXCLUDE USING gist` (`DATA_MODEL §22.2.2`) |
| PATCH | `/hr/leave-policies/{id}` | `hris.leavepolicy.update` (355) | M-06 | spec-only | **Versi `ACTIVE` tidak dapat ditimpa** — respons menolak dengan sebab "buat versi baru"; pola sama dengan `0037` constraints |
| POST | `/hr/leave-policies/{id}/approve` | `hris.leavepolicy.approve` (356) | M-06 | spec-only | **VALIDATE** empat-mata + MFA; penyetuju ≠ pengusul ditegakkan `CHECK`; kebijakan tanpa penyetuju tidak dapat menjadi `ACTIVE` |
| GET | `/hr/leave-requests` | `hris.leave.view` (357) | M-06 | spec-only | Filter `status`, `period`, `approverId`; `SELF` untuk pegawai tanpa izin manajerial; saldo datang sebagai **kolom jadi** dari server, tidak dihitung di klien |
| GET | `/hr/leave-requests/{id}` | `hris.leave.view` (357) | M-06 | spec-only | Drawer: rantai `leave_approvals` (satu baris = satu keputusan satu orang) + versi kebijakan yang dipakai saat pengajuan |
| POST | `/hr/leave-requests` | `hris.leave.request` (166) | M-06 | spec-only | Pengajuan; `status` dan `approvedBy` `SERVER_ONLY`; tumpang tindih jadwal mengajar **dibaca** dari fakta M-14/M-18, tidak dihitung ulang di sini |
| POST | `/hr/leave-requests/{id}/approve` | `hris.leave.approve` (167) | M-06 | spec-only | **VALIDATE**; atasan ber-scope; actor == pemohon → `403 SELF_APPROVAL_FORBIDDEN` (56); sudah diputus → `409 DECISION_ALREADY_MADE` (55) |
| POST | `/hr/leave-requests/{id}/reject` | `hris.leave.approve` (167) | M-06 | spec-only | Satu verba untuk dua arah keputusan (pola §4.16.3 `approve`/`reject`); `reason` wajib dan insert-only |
| GET | `/hr/payroll-runs` | `hris.payroll.view` (168) | M-06 | spec-only | Satu run per `(tenant, pay_period, scope)` — keunikan dijaga **indeks ekspresi** `0054` karena `NULL` tidak pernah bertabrakan dengan `NULL`; `status ∈ payroll_run_status` = `DRAFT CALCULATED REVIEWED APPROVED POSTED PAID VOID` (enum kelas A, register `DATA_MODEL §22.11`; **kosakata lima/empat keadaan yang beredar di dokumen lain sudah diralat ke sini**) |
| GET | `/hr/payroll-runs/{id}` | `hris.payroll.view` (168) | M-06 | spec-only | Drawer run + `parameter_version`, `input_snapshot_hash`, `tax_rule_version`, flag `degraded`; nominal dipotong pada proyeksi server untuk peran non-keuangan |
| POST | `/hr/payroll-runs` | `hris.payroll.insert` (358) | M-06 | spec-only | `201` draf kosong (komponen, periode, `policyVersion`); **tidak** menghitung — menghitung adalah tugas run engine di bawah; run kedua pada periode+scope yang sama → `409 CONFLICT` (12) |
| PATCH | `/hr/payroll-runs/{id}` | `hris.payroll.update` (359) | M-06 | spec-only | **Hanya pada `DRAFT`**; setelah `CALCULATED` penolakan berbunyi "gunakan penyesuaian atau jalankan run baru", bukan sunting diam-diam; `amount` per baris **tidak pernah** diterima dari body |
| POST | `/admin/engine/pph21-bracket/runs` | `hris.payroll.run` (169) | M-06 | spec-only | Harness §6.2 penuh → `202 { runId }`; body `{ payrollRunId, taxRuleVersion, scope }`; `budget` + `explain` wajib; **Antre = Ya** → design-only (`RD-11`, `P-6`) |
| POST | `/hr/payroll-runs/{id}/approve` | `hris.payroll.release` (170) | M-06 | spec-only | **VALIDATE** empat-mata + MFA; menolak bila run `degraded` atau `input_snapshot_hash` berbeda → `409 ENGINE_STALE_SNAPSHOT` (74); actor == penghitung → 56; tarif kelas B kosong → `422 TAX_RULE_VERSION_INACTIVE` (124) dan run **tidak** disahkan (`AC-HRS-5`) |
| POST | `/hr/payroll-runs/{id}/post` | `hris.payroll.post` (360) | M-06 | spec-only | **OTHER** — posting **hanya** lewat service M-10 (`finance.ledger.insert` milik BAUK); **tidak ada** rute tulis `ledger` di prefix `/hr`; tolak bila belum `APPROVED` → `409 PAYROLL_RUN_NOT_FINAL` (123) |
| POST | `/hr/payroll-runs/{id}/void` | `hris.payroll.void` (361) | M-06 | spec-only | **Transisi terminal `VOID` — verba `UPDATE`, mengikuti `finance.invoice.void` (§4.2 "U pembatalan via reversing entry"), bukan hapus lunak**; wajib `reverse_reason ≥ 15 char` + MFA + penyetuju kedua yang ≠ penyetuju 170; menghasilkan baris pembalik, **tidak menghapus** `payslip_lines`; slip periode lama tetap tersaji apa adanya (`AC-HRS-6`). Verba DELETE gugus ini ada pada `hris.employee.deactivate` (165) |
| GET | `/hr/payroll-adjustments` | `hris.adjustment.view` (364) | M-06 | spec-only | Antrean penyesuaian `PENDING/APPROVED/APPLIED/REJECTED`; peran non-keuangan hanya menerima boolean "ada penyesuaian" + sebab, bukan nominal |
| POST | `/hr/payroll-adjustments` | `hris.adjustment.insert` (362) | M-06 | spec-only | Koreksi retroaktif atas run `PAID`: baris baru pada **periode berjalan** yang menunjuk `sourceRunId`; `amountRupiah` integer rupiah penuh (`numeric(18,0)`), **nol `float`** (paritas §3.4) |
| POST | `/hr/payroll-adjustments/{id}/approve` | `hris.adjustment.approve` (363) | M-06 | spec-only | **VALIDATE** empat-mata + MFA; menjadi `APPLIED` hanya ketika run berikutnya benar-benar membawanya (`applied_run_id` diisi server) |
| GET | `/hr/payslips` | `hris.payslip.view` (365) | M-06 | spec-only | Pegawai hanya melihat slip sendiri (`SELF`); nominal pegawai **bukan** PII akademik tetapi tetap `Cache-Control: private, no-store` |
| GET | `/hr/payslips/{id}` | `hris.payslip.view` (365) | M-06 | spec-only | Slip dirender dari **versi yang dibekukan** (`parameter_version` + potret tarif), bukan dihitung ulang hari ini; 404 seragam untuk id milik orang lain |
| GET | `/hr/tax-brackets` | `hris.tax.view` (366) | M-06 | spec-only | **Read-only**: pembacaan `pph21_brackets` / `reference_dictionary_entries` kelas B lewat resolver §4.14; **tidak ada** `POST`/`PATCH`/`DELETE` — tenant tidak dapat mengubah angka negara, dan rute tulis di sini tidak akan pernah ada |
| GET | `/hr/employees/{id}/tax-profile` | `hris.taxprofile.view` (367) | M-06 | spec-only | Status PTKP per orang + versi yang berlaku; `ptkp_code` divalidasi **bentuknya** (`^[A-Z]{2}/[0-3]$`), nilainya dari kamus nasional |
| PUT | `/hr/employees/{id}/tax-profile` | `hris.taxprofile.update` (368) | M-06 | spec-only | Pengajuan oleh `HR_BKD_OFFICER`, persetujuan `ADMIN_FINANCE` yang ≠ pengusul (`CHECK`); berlaku **prospektif** lewat `valid_from` — slip yang sudah terbit tidak ditata ulang |
| GET | `/hr/kpi-components` | `hris.kpi.view` (369) | M-06 | spec-only | Definisi bobot KPI pegawai non-dosen per jabatan, berversi; `weight_bp` integer basis-poin (10.000 = 100 %) |
| POST | `/hr/kpi-components` | `hris.kpi.insert` (370) | M-06 | spec-only | Versi baru (bukan menimpa); jumlah bobot satu jabatan ≠ 10.000 → `422 VALIDATION_FAILED` (6) dengan `details.totalBp` — **tidak** dinormalisasi diam-diam |
| POST | `/hr/kpi-components/{id}/approve` | `hris.kpi.approve` (371) | M-06 | spec-only | **VALIDATE** empat-mata + MFA; mengubah bobot = mengubah kewenangan penilaian orang → wajib jejak audit (`BR-Z4`) |
| GET | `/hr/kpi-results` | `hris.kpi.result.view` (372) | M-06 | spec-only | Skor per (pegawai, komponen, periode); pegawai hanya melihat miliknya; **tidak ada kolom BKD** di respons mana pun (M-07 pemilik tridharma, vonis no 7) |
| POST | `/hr/kpi-results` | `hris.kpi.assess` (374) | M-06 | spec-only | Penilaian oleh atasan yang tercatat di struktur organisasi (L4 `ORG`); `score` `numeric(9,3)`, bukti lampiran dari §4.8 (`attachmentId`), bukan URL body |
| POST | `/hr/kpi-results/{id}/review` | `hris.kpi.review` (373) | M-06 | spec-only | **VALIDATE**; penyetuju ≠ penilai (`CHECK approved_by <> assessed_by`); hasil yang belum disetuju tidak masuk promosi/kenaikan grade |

**Hasil perhitungan engine tidak punya rute keduanya.** Run `pph21-bracket` dibaca melalui **rute harness umum di §6.10.1** (satu bentuk untuk semua ALG — `proposal_only = true`, `explain`, `degraded`); gugus ini **tidak** mendeklarasikan ulang path harness, karena satu path hanya boleh punya satu pemilik kontrak (`RD-32`, dan ini pelajaran `RD-124`: baris "penunjuk" yang mengulang `METHOD /path` membuat rute umum terhitung sebagai milik modul).

**Peristiwa yang dipancarkan:** `hr.bkd.recap.approved` adalah milik M-07 (§13.1) dan **tidak** dipancarkan gugus ini. M-06 mengonsumsi fakta kepegawaian untuk menghitung gaji; ia tidak menjadi penerbit peristiwa BKD. Tidak ada nama peristiwa baru.

**Real-time:** tidak ada jalur dorong. Kemajuan run `pph21-bracket` dibaca lewat `GET /admin/engine/runs/{runId}` dan SSE hasil engine **milik §6.10.1** (`GET /academic/engine/runs/{runId}/stream`) — gugus ini tidak membuka stream keduanya.

### 7.3 M-08 · SISTER Sync

`entitlement: usulan: sister`; objek: `0055_sister_sync.sql` (DDL tertulis di `DATA_MODEL §22.2.3`). Vonis yang mengikat, dua-duanya tegas:

- **`ARCHITECTURE §13.1`:** peristiwa kanonik gugus ini adalah **`sister.portfolio.pushed`** (penerbit M-08; konsumen M-05, M-32; payload `batch_id, lecturer_count, pushed_items, failed_items_ref, watermark_before/after`; transaksi `TX-OUTBOX + IDEM`; **boleh diabaikan = ya** karena kirim ulang idempoten dan watermark hanya maju atas baris sukses, §12.10).
- **`PRD §5.13.1` vonis 7:** M-08 adalah **transport**, tidak memiliki angka. Skor BKD milik M-07 (ALG-17), fakta tridharma tetap di M-44/M-21/M-19. Konsekuensi keras untuk bab ini: **tidak ada satu pun rute `/sister/**` yang menerima nilai portofolio sebagai angka**. Body yang sah hanya berisi **rujukan** (`lecturerMembershipId`, `outputId`, `periodId`) dan **status kiriman** (`QUEUED`/`ACKED`/`FAILED`). Upaya mengirim `bkdScore`, `creditValue`, atau angka luaran apa pun = `403 CROSS_MODULE_WRITE_FORBIDDEN` (119), karena kolom itu `SERVER_ONLY` di objek pemiliknya.

Nol egress tetap berlaku (`AGENTS §3.9`): SISTER adalah sistem eksternal, sehingga seluruh rute di bawah adalah **perintah ke worker adapter**, bukan panggilan sinkron dari rute HTTP. Rute mencatat intent + mengembalikan `202`/`201 { batchId }`; worker yang berbicara ke endpoint pihak ketiga. Tidak ada kredensial vendor di badan permintaan dan `credential_ref` menunjuk vault/ENV, bukan baris parameter (`AGENTS §3.10`: rahasia tidak pernah menjadi nilai parameter).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/sister/endpoints` | usulan `sister.endpoint.view` | M-08 | spec-only | Katalog endpoint/target SISTER per tenant (base URL **tanpa** kredensial, domain, `enabled`, `timeoutS`, `maxSkewS`); timeout & skew dibaca dari `master_system_parameters` (§4.16), bukan konstanta kode |
| POST | `/sister/endpoints` | usulan `sister.endpoint.create` | M-08 | spec-only | `201`; **kreditensial ditolak di body** — hanya `credentialRef` bergaya `env:`/`vault:`; nilai `secret`, token, atau DSN ber-password → `422 PARAM_SECRET_FORBIDDEN` (111) |
| PATCH | `/sister/endpoints/{id}` | usulan `sister.endpoint.update` | M-08 | spec-only | Berversi dengan `effectiveFrom`; `If-Match`/`expectedVersion` → `409 CONFLICT` (12) |
| GET | `/sister/queue` | usulan `sister.push.view` | M-08 | spec-only | Isi `queue_operations` untuk `kind ∈ {sister_push, sister_reconcile}` (spine §13.2); state `QUEUED PROCESSING SUCCEEDED FAILED EXPIRED`; baris terminal **tidak pernah** di-UPDATE |
| POST | `/sister/queue` | usulan `sister.push.create` | M-08 | spec-only | `202 { opId }`; body **hanya** `{ batchWindow, lecturerMembershipIds[] \| cohortFilter }`; wajib `Idempotency-Key` (46); **Antre = Ya** → design-only (`RD-11`, `P-6`) |
| POST | `/sister/queue/{opId}/cancel` | usulan `sister.push.cancel` | M-08 | spec-only | `OTHER`; hanya `QUEUED` yang dapat dibatalkan; `PROCESSING` → `409 CONFLICT` (12) supaya tidak ada dua penulis state untuk satu opId |
| GET | `/sister/delta` | usulan `sister.delta.view` | M-08 | spec-only | Proyeksi `record_digest` SHA-256 per baris tujuan + `watermark` per `(tenant, objek)` (§12.10); **read-only**; boleh `?at=` untuk rekonstruksi; **tidak** mengembalikan isi portofolio, hanya digest |
| POST | `/sister/delta/sync` | usulan `sister.delta.sync` | M-08 | spec-only | `202 { batchId }`; membandingkan watermark tersimpan vs keadaan sumber **di worker**; menolak `watermarkBefore` lebih baru dari tersimpan → `409 SISTER_WATERMARK_REGRESSION` (125); watermark hanya maju atas baris sukses |
| GET | `/sister/reconcile` | usulan `sister.reconcile.view` | M-08 | spec-only | Daftar perbedaan `pushed_items` vs ack mitra; **tidak** ada rute yang menandai "cocok" dari klien — kecocokan adalah hasil |
| POST | `/sister/reconcile/runs` | usulan `sister.reconcile.validate` | M-08 | spec-only | `202 { runId }`; rekonsiliasi = pekerjaan batch beralasan; **VALIDATE** manusia untuk menutup temuan, bukan auto-resolve; memancarkan `sister.portfolio.pushed` hanya atas batch yang benar-benar terkirim |
| GET | `/sister/reconcile/runs/{runId}` | usulan `sister.reconcile.view` | M-08 | spec-only | Muat hasil `degraded` apa adanya (`PARTIAL_BUDGET_EXHAUSTED`, `NO_BASELINE`); **read-your-writes ke Primary** |
| GET | `/sister/batches/{batchId}/explain` | usulan `sister.push.view` | M-08 | spec-only | Jejak reproducibility: `engine` bukan mesin — di sini isinya `watermark_before/after`, `attempt`, `dlqReason`, `credentialRef`; **tanpa** isi respons mitra mentah di log |

**Yang ditolak menjadi rute:** `POST /sister/lecturers/{id}/bkd` dan padanannya. M-08 **tidak punya** rute tulis ke `lecturers`, `bkd_recaps`, maupun tabel luaran; ia hanya mengirim digest milik orang lain. Uji penolakannya wajib ada (`PRD §5.13.2` butir 5) dan jawabannya `403`, bukan `201`.

**Real-time:** tidak ada. Kemajuan batch dibaca lewat polling `GET /ops/{opId}` (§4.2.13) — jalur `queue_operations` adalah spine dan vonis §13.2 tidak memberi M-08 hak atas stream maupun socket.

### 7.4 M-11 · KIP-K & Beasiswa

`entitlement: usulan: scholarship`; objek: `0056_scholarship.sql` (DDL tertulis di `DATA_MODEL §22.3.1`). Vonis yang mengikat:

- **`PRD §5.13.1` vonis 5:** M-10 satu-satunya penerbit jurnal/tagihan. Beasiswa **tidak** menerbitkan invoice dan **tidak** mem-posting ledger; ia memberi efek pada tagihan lewat **service M-10** (`finance.waiver.*`, §4.10.2) atas keputusan yang sudah `VALIDATE`. Tidak ada `POST /scholarship/invoices`.
- **`PRD §5.13.1` vonis 7 & 5, sisi M-47:** alokasi dana abadi masuk sebagai **sumber dana berversi** (`sourceFundId`), bukan sebagai angka yang diketik petugas beasiswa.
- **Syarat nasional adalah kelas B.** Kelayakan KIP-K yang ditetapkan negara dibaca dari `reference_dictionary_entries` berversi; tenant hanya memetakan label. Pelanggarannya berkode `422 STATUTORY_PRECONDITION_UNMET` (142), bukan `VALIDATION_FAILED` (6), supaya uji penolakannya dapat menunjuk sebab regulernya.
- **Kriteria ekonomi = AHP yang sudah ada, bukan mesin baru.** `ARCHITECTURE §13.6` memutus lapisan AHP **ALG-3** dipakai ulang untuk kelayakan ekonomi; membuat "mesin kedelapan belas" adalah temuan `RD-32`. Karena itu skor kelayakan lahir dari run engine berversi, dan ambang serta bobotnya ikut `parameter_version`.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/scholarship/schemes` | usulan `scholarship.scheme.view` | M-11 | spec-only | Skema (KIP-K, bantuan daerah, dana abadi kampus) + `fundingSourceId`; label dari kamus `sumber_dana_bantuan` (kelas C), syarat nasional dari kelas B |
| POST · PATCH | `/scholarship/schemes` · `/scholarship/schemes/{id}` | usulan `scholarship.scheme.create` · `.update` | M-11 | spec-only | Berversi dengan `effectiveFrom`/`effectiveTo`; ubah skema aktif = buat versi baru (pola §4.6.7); item yang masih dipakai award → `409 REFERENCE_IN_USE` (19) |
| POST | `/scholarship/schemes/{id}/approve` | usulan `scholarship.scheme.approve` | M-11 | spec-only | **VALIDATE** empat-mata (56) + MFA penulis-admin; skema belum disetujui tidak dapat dipakai menerima pelamar |
| GET | `/scholarship/applications` | usulan `scholarship.application.view` | M-11 | spec-only | List §2.4; **proyeksi server** atas data ekonomi ortu: peran non-kelayakan menerima `eligible: boolean` + `blockedBy[]`, **bukan** nominal penghasilan (SoD, `AGENTS §3.8`) |
| POST | `/scholarship/applications` | usulan `scholarship.application.create` | M-11 | spec-only | Pengajuan oleh mahasiswa/ortu wali (scope `SELF`); berkas lewat presign §4.8; `status` dan `eligibilityScore` `SERVER_ONLY` |
| POST | `/scholarship/applications/{id}/score-runs` | usulan `scholarship.application.score` | M-11 | spec-only | `202 { runId }`; meneruskan ke harness ALG-3 §6.5 dengan `engineCode = concentration` yang **dipakai ulang** sebagai lapis AHP — tidak ada rute engine kedua untuk beasiswa; **Antre = Ya** → design-only |
| POST | `/scholarship/applications/{id}/verify` | usulan `scholarship.application.validate` | M-11 | spec-only | **VALIDATE** verifikasi berkas oleh admin beasiswa; menolak dokumen kedaluwarsa (`expires_at` baku 30 hari, §4.8); bukti tidak lengkap → `422 EVIDENCE_INSUFFICIENT` (117) |
| GET | `/scholarship/awards` | usulan `scholarship.award.view` | M-11 | spec-only | Penerima aktif per periode; `?at=` untuk rekonstruksi historis (BR-R12); filter `schemeId`, `periodId`, `ipkState` |
| POST | `/scholarship/awards` | usulan `scholarship.award.create` | M-11 | spec-only | `201` dari aplikasi yang sudah `VERIFIED`; **menolak** bila snapshot kelayakan berubah setelah scoring → `409 AWARD_SNAPSHOT_STALE` (143); wajib `Idempotency-Key` (46) |
| POST | `/scholarship/awards/{id}/grant` | usulan `scholarship.award.grant` | M-11 | spec-only | **VALIDATE**; **satu-satunya** titik yang memancarkan `scholarship.award.granted` (§13.1); efek ke tagihan dieksekusi service M-10, bukan oleh rute ini |
| POST | `/scholarship/awards/{id}/suspend` | usulan `scholarship.award.suspend` | M-11 | spec-only | `OTHER`; IPK di bawah ikatan → suspensi diusulkan sistem, **diputuskan manusia** dengan `reason`; tidak pernah mengubah `students.status_akademik` (milik M-19/M-30) |
| GET | `/scholarship/recipients/{studentId}/monitoring` | usulan `scholarship.award.view` | M-11 | spec-only | Baca proyeksi IPK & SKS dari M-19/M-13 (`academic.khs.published`, `enrollment.krs.approved` sebagai sumber); **tidak** ada tulis ke objek akademik |
| POST | `/scholarship/disbursements` | usulan `scholarship.disbursement.create` | M-11 | spec-only | Permintaan pencairan bantuan → **202 { opId }** ke service M-10; **tidak ada** `ledger` di prefix ini; empat-mata BAUK pada nominal (56) |

**Batas yang dinyatakan eksplisit:** tidak ada rute `/scholarship/payments`, tidak ada `POST /scholarship/…/refund`, dan tidak ada kolom nominal yang dapat dikirim klien selain `requestedAmountRupiah` pada pengajuan pencairan — yang terakhir pun tetap **usulan** sampai `DATA_MODEL §22` menamai kolomnya.

### 7.5 M-21 & M-22 · Jurnal, Publikasi & HKI

`entitlement: usulan: publication` (satu kode untuk kedua modul bisnis — `PRD §5.12.1` memetakannya sama); objek: **belum bernama** di `DATA_MODEL §22` → seluruh baris gugus ini **`blocker`**, dan perintah penamaannya ada di §7.23 butir permintaan. Dua vonis menentukan bentuk rutenya:

- **APC menagih lewat M-10.** Article Processing Charge adalah tagihan. Rutenya di sini **hanya** mengusulkan biaya; penerbitan invoice hidup di `POST /finance/invoices` (§4.10) milik M-10. **Tidak akan pernah ada** `POST /publication/apc/pay`, tidak ada kanal VA kedua, dan tidak ada `webhook` APC sendiri — §4.7 adalah satu-satunya jalur masuk dana.
- **Nomor yang terbit dari otoritas luar tidak dapat diketik.** DOI, status indexing, nomor permohonan HKI, dan tanggal hanya boleh terisi dari **respons** otoritas (pola `pddikti_*_id` yang `SERVER_ONLY`). Upaya mengirimnya dari body → `409 EXTERNAL_SOURCE_FIELD_READONLY` (126). Ini berlaku juga untuk vonis 7 (`PRD §5.13.1`): luaran memberi makan BKD **lewat M-07** yang membacanya, tidak lewat salinan angka di tabel publikasi.
- **Luaran tidak diduplikasi.** `PRD §5.12.1` baris M-22: "Luaran dihitung ke BKD lewat M-07, tidak diduplikasi di sini". Karena itu gugus ini tidak punya kolom `bkd_credit` dan tidak punya rute rekap.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/publication/journals` | usulan `publication.journal.view` | M-21 | blocker | Daftar jurnal kelolaan berikut ISSN; ISSN dan nama penerbit **hanya** dari respons verifikasi → 126 |
| POST · PATCH | `/publication/journals` · `/publication/journals/{id}` | usulan `publication.journal.create` · `.update` | M-21 | blocker | Permintaan objek ke `DATA_MODEL §22`; `apcTariffGroup` menunjuk `fee_tariff_groups` milik M-02/M-10 (§4.6.7), **tidak** menyalin nominal |
| GET | `/publication/articles` | usulan `publication.article.view` | M-21 | blocker | List §2.4; filter `journalId`, `year`, `doiState`, `authorMembershipId` |
| POST | `/publication/articles` | usulan `publication.article.create` | M-21 | blocker | Naskah + penulis sebagai **rujukan** `lecturerMembershipId`; similarities dihitung **ALG-21** (`winnowing-similarity`) lewat run, bukan angka yang dikirim |
| POST | `/publication/articles/{id}/similarity-runs` | usulan `publication.article.screen` | M-21 | blocker | `202 { runId }` harness §6.2; mode turun `NO_BASELINE` ditampilkan apa adanya; **Antre = Ya** → design-only |
| POST | `/publication/articles/{id}/approve` | usulan `publication.article.approve` | M-21 | blocker | **VALIDATE** editor; penulis ≠ editor (56); menolak run similarity yang belum `SUCCEEDED` → `409 ENGINE_RUN_NOT_APPLICABLE` (75) |
| POST | `/publication/articles/{id}/apc-request` | usulan `publication.apc.request` | M-21 | blocker | **Mengusulkan** biaya ke service M-10; respons berisi `invoiceId` milik M-10, bukan status bayar lokal; tidak ada `paymentStatus` di objek ini |
| GET | `/publication/issues` · `/publication/issues/{id}/toc` | usulan `publication.issue.view` | M-21 | blocker | Terbitan + daftar isi; **serialis OAI-PMH bukan engine** (`ARCHITECTURE §13.5.1`) dan keluarannya adalah proyeksi baca-saja, tidak pernah rute tulis |
| GET · POST | `/publication/indexing-claims` | usulan `publication.indexing.view` · `.create` | M-21 | blocker | Klaim indexing **bukti-saja** (tautan + tanggal verifikasi); keadaan akhir hanya dari respons, dan `layanan_indexing` adalah kamus C |
| GET | `/ipr/applications` | usulan `iprs.application.view` | M-22 | blocker | Permohonan HKI; `program_haki` kamus C, **jenis HKI kelas B**; nomor permohonan hanya dari kantor HKI → 126 |
| POST | `/ipr/applications` | usulan `iprs.application.create` | M-22 | blocker | `201` dengan `applicationNumber` **kosong**; pengisian nomor adalah hasil `POST …/register-response` di bawah, bukan ketikan |
| POST | `/ipr/applications/{id}/register-response` | usulan `iprs.application.validate` | M-22 | blocker | **VALIDATE**: merekam respons otoritas + digest berkas respons; dua arah dalam satu transaksi outbox (TX-OUTBOX + IDEM) |
| POST | `/ipr/applications/{id}/grant` | usulan `iprs.application.grant` | M-22 | blocker | **VALIDATE** HKI terbit; nomor Paten/Desain hanya dari respons → 126; penanda "terdaftar" memicu pembacaan luaran oleh M-07, **bukan** tulis ke BKD |
| GET · POST · PATCH | `/ipr/license-agreements` · `/ipr/license-agreements/{id}` | usulan `iprs.license.view` · `.create` · `.update` | M-22 | blocker | Perjanjian lisensi bersama pihak ketiga dari `0053_external_parties.sql` (gugus silang pihak ketiga); **nominal royalti dibaca M-10**, tidak diposting di sini |
| GET · POST | `/ipr/incubation-stages` · `/ipr/ventures` | usulan `iprs.venture.view` · `.create` | M-22 | blocker | `tahap_inkubasi` kamus C (label dapat diganti kampus); keadaan teknis wirausaha tetap enum kelas A di register `DATA_MODEL §15` |

### 7.6 M-24 · Kemahasiswaan & SKKM

`entitlement: usulan: student_affairs` (kode registri `PRD §5.12.1` baris M-24); objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Satu kalimat menentukan seluruh bentuk gugus ini (`PRD §5.12.1` baris M-24): **"Tidak boleh menciptakan keadaan mesin akademik."** Konsekuensi yang dapat diuji:

- Poin SKKM, prestasi, dan sanksi adalah **dimensi kemahasiswaan**. Yang boleh keluar ke sistem lain hanyalah sinyal `student_affairs.points.cleared` (§13.1, konsumen M-30 + APP, **boleh diabaikan = ya**) — dan **hanya** itu. Tidak ada rute yang menulis `students.status_akademik`, `enrollments.status`, atau clearance.
- Poin bersifat **usulan sampai divalidasi**: `event.registration.checkin` dari M-43 dan verifikasi prestasi sama-sama masuk sebagai proposal dengan bukti, lalu `VALIDATE` oleh peran kemahasiswaan. Ini mengikuti kolom VALIDATE baris `event.registration.checked_in` di §13.1.
- Poin tanpa bukti terverifikasi ditolak `422 POINTS_EVIDENCE_REQUIRED` (127); bukti vendor-lokal yang tidak cukup untuk membalik keadaan → `422 EVIDENCE_INSUFFICIENT` (117).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST | `/student-affairs/activities` · `/student-affairs/activities/{id}` | usulan `kbm.activity.view` · `.create` · `.update` | M-24 | blocker | Kegiatan + jadwal; **tidak** membuat sesi kelas (milik M-14) dan **tidak** memakai jalur presensi M-18 |
| POST | `/student-affairs/activities/{id}/approve` | usulan `kbm.activity.approve` | M-24 | blocker | **VALIDATE**; penyetuju ≠ pengusul (56); kegiatan yang sudah berjalan tanpa persetujuan → poinnya tidak terbit |
| GET | `/student-affairs/organizations` | usulan `kbm.organization.view` | M-24 | blocker | BEM/BLM/UKM + kepengurusan; anggota adalah **rujukan** membership, bukan salinan nama |
| POST · DELETE | `/student-affairs/organizations/{id}/members` | usulan `kbm.membership.create` · `.delete` | M-24 | blocker | Penulisan ke `user_role_assignments` **bukan** di sini (M-03 pemilik); yang hidup di sini hanya keanggotaan organisasi non-peran |
| GET | `/student-affairs/points` | usulan `kbm.points.view` | M-24 | blocker | Rekap per mahasiswa/angkatan; `Cache-Control: private`; scope `SELF` untuk mahasiswa |
| POST | `/student-affairs/points/proposals` | usulan `kbm.points.propose` | M-24 | blocker | Usulan poin + bukti (prestasi, kepanitiaan, check-in M-43); **tidak** mengubah saldo — saldo hanya hasil `VALIDATE` |
| POST | `/student-affairs/points/{id}/validate` | usulan `kbm.points.validate` | M-24 | blocker | **VALIDATE**; bukti kurang → 127 atau 117; dua pengesahan atas usulan yang sama → 55; pemohon ≠ pengesah → 56 |
| GET · POST | `/student-affairs/achievements` · `/student-affairs/achievements/{id}/verify` | usulan `kbm.achievement.view` · `.create` · `.validate` | M-24 | blocker | Prestasi + verifikasi jenjang; nomor sertifikat eksternal → 126 bila dikirim sebagai nilai |
| GET · POST · PATCH | `/student-affairs/sanctions` · `/student-affairs/sanctions/{id}/lift` | usulan `kbm.sanction.view` · `.create` · `.validate` | M-24 | blocker | Sanksi **dimensi kemahasiswaan**; **tidak** menurunkan status akademik; pelepasan sanksi = `VALIDATE` beralasan, tercatat `audit_logs`; pemancar `student_affairs.points.cleared` hanya ketika seluruh dimensi bersih |
| GET · POST | `/student-affairs/skm-categories` · `/student-affairs/skm-rules` | usulan `kbm.rule.view` · `.update` | M-24 | blocker | Aturan poin = **kewenangan berversi** (`effectiveFrom`/`effectiveTo`) + empat-mata; ambang tunggal (mis. plafon poin per semester) masuk `master_system_parameters` (§4.16), **bukan** konstanta kode (`AGENTS §3.10`) |

### 7.7 M-25 · KKN, PKL & Magang

`entitlement: usulan: fieldwork`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Gugus ini adalah tempat vonis paling terang di seluruh bab: **`PRD §5.13.1` vonis 1** (dua-duanya menyetarakan kredit luar; **hanya ALG-16 + tabel konversi M-38** yang memutuskan SKS; M-25 mengirim *usulan* konversi + logbook bergeofence sebagai bukti). Ditambah vonis 9 (satu vonis kehadiran milik M-18) dan vonis 2 (nilai hanya di `grades` M-19).

Aturan yang mengikat rute:

- `POST /fieldwork/placements/{id}/conversion-proposal` **mengusulkan**. Ia menulis ke tabel hasil miliknya sendiri dengan `proposal_only = true`, dan konversi resmi tetap lahir di `POST /mbkm/conversions` + `/evaluate` + dua `approve` (§4.12.1, ALG-16). Rute ini **tidak pernah** mengembalikan `convertedSks`; yang dikembalikan hanya `proposalId` + `status: "PROPOSED"`.
- Logbook adalah **bukti, bukan nilai** (`ARCHITECTURE §13.3` rantai "TA → logbook → sidang → RAMA → clearance"). Karena itu tidak ada `POST …/logbook/grade`; angka mitra masuk sebagai komponen lewat **service M-19**.
- Logbook bergeofence memakai ambang yang sama dengan presensi: `attendance.geofence_radius_m` dan `attendance.gps_max_accuracy_m` dibaca dari `master_system_parameters` (§4.16.5) **di server**; akurasi di bawah ambang → `422 GPS_ACCURACY_TOO_LOW` (84), di luar radius → `403 OUT_OF_GEOFENCE` (60). Koordinat klien tidak pernah menjadi vonis.
- Logbook retrospektif di luar jendela toleransi → `422 FIELDWORK_LOGBOOK_BACKDATED` (128); toleransi sendiri adalah parameter berversi, bukan angka di kode.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/fieldwork/placements` | usulan `fieldwork.placement.view` | M-25 | blocker | Penempatan KKN/PKL/Magang; filter `periodId`, `partnerId` (rujukan `0053`), `programId`, `dplMembershipId`; `jenis_kerja_praktik` kamus C |
| POST | `/fieldwork/placements` | usulan `fieldwork.placement.create` | M-25 | blocker | `201` + `Idempotency-Key` (46); `status` dan `startDate`/`endDate` versi kebijakan; **tidak** menerbitkan `nim` yang `SERVER_ONLY` milik M-09 |
| PATCH | `/fieldwork/placements/{id}` | usulan `fieldwork.placement.update` | M-25 | blocker | Whitelist; perubahan mitra setelah penempatan aktif butuh `VALIDATE` (logistik sudah bergerak) |
| POST | `/fieldwork/placements/{id}/approve` | usulan `fieldwork.placement.approve` | M-25 | blocker | **VALIDATE** kaprodi/DPL; pengusul ≠ penyetuju (56); periode non-`OPEN` → `423 PERIOD_CLOSED` (25) |
| GET · POST | `/fieldwork/logbook` · `/fieldwork/logbook/entries` | usulan `fieldwork.logbook.view` · `.create` | M-25 | blocker | Entri harian dengan `occurredAt`, `minutes`, `coordinates` + `accuracyMeters`; server menghitung vonis lokasi; **tidak** menerima `status` maupun `sks` dari body |
| POST | `/fieldwork/logbook/entries/{id}/endorse` | usulan `fieldwork.logbook.endorse` | M-25 | blocker | **VALIDATE** DPL; memancarkan `thesis.logbook.entry_logged` hanya bila objek pemiliknya memang logbook tugas akhir — untuk KKN/PKL peristiwa kanoniknya **tidak ada** di §13.1, jadi transaksinya tercatat `audit_logs` saja |
| GET | `/fieldwork/logbook/entries/export` | usulan `fieldwork.logbook.view` | M-25 | blocker | Verba `OTHER` (§4.10.5); `59 EXPORT_LIMIT_EXCEEDED` saat melewati plafon → pindah job ekspor |
| GET | `/fieldwork/partner-evaluations` | usulan `fieldwork.partner.view` | M-25 | blocker | Nilai mitra sebagai **proyeksi**; angka resmi hanya terbaca dari `grades` M-19, jadi layar ini tidak pernah menampilkan nilai yang tidak ada di M-19 |
| POST | `/fieldwork/partner-evaluations` | usulan `fieldwork.partner.submit` | M-25 | blocker | Mitra mengirim penilaian lewat kanal terverifikasi; nilainya **usulan komponen** yang diambil service M-19 (vonis 2); tidak ada kolom `letter`/`numericValue` yang tersimpan di objek M-25 |
| POST | `/fieldwork/placements/{id}/conversion-proposal` | usulan `fieldwork.conversion.propose` | M-25 | blocker | **MENGUSULKAN** — inilah baris yang dilarang menjadi penulis kedua; `201 { proposalId, status: "PROPOSED" }`; menolak bila penempatan belum `COMPLETED` → `409 CONFLICT` (12); tidak mengembalikan SKS final |
| GET | `/fieldwork/conversion-proposals` | usulan `fieldwork.conversion.view` | M-25 | blocker | Daftar usulan berikut tautan `conversionId` milik M-38 setelah resmi; **tidak** ada `approve` di sini — `403 CROSS_MODULE_WRITE_FORBIDDEN` (119) bila dipanggil |
| POST | `/fieldwork/conversion-proposals/{id}/withdraw` | usulan `fieldwork.conversion.update` | M-25 | blocker | Penarikan **usulan sendiri** sah (bukan keputusan kredit); usulan yang sudah menjadi konversi resmi tidak dapat ditarik dari sini |
| GET · POST | `/fieldwork/dpl-assignments` | usulan `fieldwork.dpl.view` · `.create` | M-25 | blocker | Penugasan DPL ber-scope; beban pembimbing **dibaca** M-07 dari fakta, tidak diketik di sini (vonis 7) |

### 7.8 M-28 · Career Center

`entitlement: usulan: career`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Vonis 13 (`PRD §5.13.1`): **M-27 pemilik respons survei, M-28 pemilik lowongan/lamaran**, dan keduanya memberi makan IKU 1/2 di M-32 sebagai **proyeksi**. Karena itu:

- Tidak ada rute `/career/…` yang menulis angka IKU; M-32 menghitung sendiri dari fakta (vonis 4).
- Pencocokan bipartit adalah **usulan**: `ARCHITECTURE §13.5` memakainya "pencocokan bipartit usulan; persetujuan oleh peran karir", dan lapis bipartite **sudah punya dua alamat** (ALG-11 §12.6 butir 5, ALG-16 §12.15 butir 4) — membuat "Hungarian ketiga" adalah temuan `RD-32`. Untuk pemeringkatan lowongan, yang dipakai adalah **ALG-20 `local-retrieval`** (BM25/TF-IDF atas korpus lowongan tenant) dan **ALG-24 `prob-scorer`** sebagai proposal, keduanya lewat harness §6.2 → `202 { runId }`.
- CV dan consent adalah **objek terpisah berversi** (`PRD §5.14.6`), bukan kamus dan bukan atribut JSONB. Lamaran tanpa consent aktif → `403 CONSENT_MISSING` (129); consent pernah ada lalu ditarik → `409 CONSENT_WITHDRAWN` (130).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST · PATCH | `/career/employers` · `/career/employers/{id}` | usulan `career.employer.view` · `.create` · `.update` | M-28 | blocker | Mitra dari gugus pihak ketiga `0053`; akun vendor **tidak** dapat menulis lamaran atas nama mahasiswa |
| GET | `/career/jobs` | usulan `career.job.view` | M-28 | blocker | List §2.4; filter `sectorCode` (kamus `sektor_usaha`), `jobTypeCode` (`jenis_lowongan`), `locationCode`; **bukan** `z.enum` di kontrak (`AGENTS §3.10`) |
| POST | `/career/jobs` | usulan `career.job.create` | M-28 | blocker | Hanya peran karir/mitra terverifikasi; `moderationStatus` `SERVER_ONLY`; publikasi lewat `…/publish` ber-`VALIDATE` |
| POST | `/career/jobs/{id}/publish` | usulan `career.job.publish` | M-28 | blocker | **VALIDATE** moderasi; penyetuju ≠ penulis (56); job kedaluwarsa tidak dapat dipublikasikan ulang tanpa versi baru |
| GET | `/career/jobs/{id}/matches` | usulan `career.match.view` | M-28 | blocker | Proyeksi hasil run ALG-20/ALG-24 dengan `score_bp`, `method`, `explain`; label "prediksi" **dilarang** di layar (§13.5.1 gerbang l) |
| POST | `/career/jobs/{id}/match-runs` | usulan `career.match.run` | M-28 | blocker | `202 { runId }` harness §6.2; `degraded: "NO_CORPUS"` bila korpus kosong → hasil kosong + tautan, **bukan** saran dari tenant lain; **Antre = Ya** → design-only |
| GET · POST | `/career/applications` · `/career/applications/{id}/withdraw` | usulan `career.application.view` · `.create` · `.update` | M-28 | blocker | Scope `SELF` untuk alumni; melamar tanpa consent aktif → 129; lampiran CV = versi bertanda tangan §4.8 |
| GET · POST | `/career/cv-profiles` · `/career/cv-profiles/{id}/consent` | usulan `career.cv.view` · `.update` · `career.consent.grant` | M-28 | blocker | Consent berversi + tarik-consent (130); **hanya** alumni yang dapat memberi/menarik consent atas datanya sendiri |
| GET · POST | `/career/job-fairs` · `/career/job-fairs/{id}/booths` | usulan `career.fair.view` · `.create` | M-28 | blocker | Pameran kerja virtual; **check-in peserta bukan** milik M-28 — pintu acara memakai M-43 (§7.15), supaya tidak ada dua jalur check-in |
| POST | `/career/job-fairs/{id}/open` | usulan `career.fair.validate` | M-28 | blocker | **VALIDATE** pembukaan; jendela penutupan & kuota booth dibaca dari parameter §4.16, tidak dari konstanta |
| GET | `/career/statistics` | usulan `career.statistics.view` | M-28 | blocker | **Proyeksi baca-saja** milik M-27/M-32; seluruh kolomnya `SERVER_ONLY` (`PRD §5.13.2` butir 3) dan **tidak** ada rute tulis di gugus ini |

### 7.9 M-29 · KUI & Mobilitas

`entitlement: usulan: mobility`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Dua vonis: **penyetaraan kredit tetap lewat M-38/ALG-16** (`PRD §5.12.1` baris M-29) — jadi mobilitas **tidak** memiliki konverter sendiri; dan **nomor paspor/ITAS bukan kamus maupun atribut kustom** (`PRD §5.14.6`): kolom terenkripsi berkelas PII spesifik, dengan blind index bila perlu pencarian. `ARCHITECTURE §13.6` menolak ECTS sebagai enum: matriks konversi adalah **kelas B** berversi, tenant hanya memetakan label.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST · PATCH | `/mobility/partnerships` · `/mobility/partnerships/{id}` | usulan `mobility.partnership.view` · `.create` · `.update` | M-29 | blocker | MoU/mitra luar dari `0053`; masa berlaku MoU → penolakan penempatan setelahnya adalah keputusan service (L5), bukan filter UI |
| GET | `/mobility/exchanges` | usulan `mobility.exchange.view` | M-29 | blocker | Masuk/keluar per periode; filter `direction` (`INBOUND`/`OUTBOUND` kelas A), `countryCode`, `partnershipId` |
| POST | `/mobility/exchanges` | usulan `mobility.exchange.create` | M-29 | blocker | Pengajuan; `status` `SERVER_ONLY`; plafon SKS konversi **tidak** diketik di sini — `mobility.outbound_max_convertible_sks` adalah parameter (§4.16.5) dan pelanggarannya sudah punya kode milik M-38 (`MBKM_SKS_CAP_EXCEEDED`, baris 30) |
| POST | `/mobility/exchanges/{id}/approve` | usulan `mobility.exchange.approve` | M-29 | blocker | **VALIDATE** empat-mata + MFA; pengusul ≠ penyetuju (56); dokumen izin tinggal kedaluwarsa sebelum keberangkatan → `422 MOBILITY_DOCUMENT_EXPIRED` (131) |
| GET · PATCH | `/mobility/exchanges/{id}/travel-documents` | usulan `mobility.document.view` · `.update` | M-29 | blocker | **Tulis terbatas pada lampiran berikut tanggal berlaku**; nomor paspor/ITAS **tidak pernah** terbaca oleh peran tanpa hak (`FIELD_RULES`), `pii_level = 'SPECIFIC'` menolak isi-mandiri klien (§3.10); pengingat **tidak pernah** memuat nomor dokumen di judul pesan (parameter `mobility.permit_expiry_warn_days`) |
| GET | `/mobility/ects` | usulan `mobility.ects.view` | M-29 | blocker | Isi = `reference_dictionary_entries` kelas B berversi + label tenant |
| POST | `/mobility/ects/mappings` | usulan `mobility.ects.map` | M-29 | blocker | **Pemetaan label** oleh kampus; **menolak** setiap upaya mengubah kode/angka mitra (126). Konversi SKS-nya sendiri **tidak** terjadi di sini |
| GET · POST | `/mobility/international-students` | usulan `mobility.inbound.view` · `.create` | M-29 | blocker | Mahasiswa asing sebagai membership ber-scope; **registrasi akademik tetap M-13** dan **KRS tetap §4.2** — tidak ada jalur khusus mobilitas yang menulis `enrollments` |
| GET | `/mobility/support-services` | usulan `mobility.service.view` | M-29 | blocker | `layanan_pendukung_mobilitas` kamus C; penjadwalan layanan memakai kalender **milik modul induk**, bukan salinan kalender baru |
| POST | `/mobility/exchanges/{id}/learning-agreement` | usulan `mobility.agreement.create` | M-29 | blocker | Rencana studi luar berikut matakuliah pemetaan sebagai **rujukan**; sah hanya setelah `approve` M-29 **dan** dua `approve` M-38 (§4.12.1) — dokumen tunggal tidak cukup |
| GET | `/mobility/exchanges/{id}/conversion-status` | usulan `mobility.agreement.view` | M-29 | blocker | **Baca-saja** proyeksi dari `mbkm_conversions` M-38; tidak ada `PATCH` yang menyentuh `convertedCredits` (119) |

### 7.10 M-36 · Portal PPKS

`entitlement: usulan: ppks`; objek: **belum bernama** di `DATA_MODEL §22` → seluruh baris **`blocker`**, dan dua di antaranya juga tertahan dependensi kunci enkripsi. Gugus ini adalah satu-satunya di bab ini yang **norma pembukanya adalah apa yang tidak boleh ada**. Vonis 14 (`PRD §5.13.1`): **M-36 pemilik kasus dan timeline; isinya tidak terbaca oleh `TENANT_ADMIN`**; M-05 menyimpan jejak akses **tanpa** isi; M-41 dan M-24 hanya menerima rujukan anonim. Dasar regulatorinya Permendikbudristek 30/2021 dan UU PDP.

Tujuh aturan yang mengikat rute, semuanya dapat diuji:

1. **Lapor anonim tanpa identitas pelapor yang tersimpan terbaca.** Identitas (bila pelapor memilih memberitahu) disimpan dalam amplop terenkripsi; `reporterIdentityState` menandakan "ada tetapi tidak terbuka", bukan "tidak ada".
2. **Isi terenkripsi beramplop dengan dua kunci berbeda.** Pola `ARCHITECTURE §13.6`: DEK untuk AES-256-GCM dan kunci HMAC terpisah untuk blind index; `wrapped_key` dari KMS/HSM; master key tidak pernah masuk DB. **Kejujuran yang wajib tertulis:** server tetap dapat membuka plaintext untuk pemegang hak sah — ini **bukan** *zero-knowledge* dalam arti kriptografis, dan tidak ada satu pun baris di bawah yang boleh menjualnya demikian.
3. **`TENANT_ADMIN` tidak punya rute pembaca isi.** Yang ada hanya READ atas **metadata** dan **statistik agregat**. Permintaan isi → `403 SPECIAL_PII_ACCESS_DENIED` (132), dicatat sebagai penolakan, bukan disenyapkan.
4. **Access-log terpisah dari objek kasus.** `ppks/access-logs` adalah append-only milik M-36 dengan rujukan `audit_logs` M-05: siapa, kapan, dari IP ter-hash, atas kasus mana, **tanpa** memuat potongan isi. Vonis 11 melarang tabel jejak per modul, jadi **tidak ada** rantai hash kedua — yang ada adalah stream rantai tunggal per tenant (`audit.chain.sealed`, §13.1) plus baris akses.
5. **Peristiwa berpayload kosong oleh desain.** `ppks.case.registered` hanya membawa `case_id, tenant_id, created_at` (`ARCHITECTURE §13.1` catatan 2). Tidak ada judul, nama, atau terlapor di outbox.
6. **Blocker nyata dinyatakan.** `TENANT_ENCRYPTION_MASTER_KEY` belum ada di `apps/web/src/config/env.ts` (dicatat `ENV_CONTRACT §6.3`); hari ini hanya `mfa_factors.credential_encrypted` yang terenkripsi di kode. Karena itu setiap rute yang menulis plaintext-terenkripsi **wajib** menjawab `503 ENVELOPE_ENCRYPTION_UNAVAILABLE` (133) sebelum kunci itu tersedia — bukan menulis teks polos "sambil menunggu".
7. **Retensi & penghancuran adalah keadaan regulasi.** `ppks.read_session_minutes` (baku 15, sah 5–60) dan `ppks.case_retention_years` (sah 5–20) adalah parameter kelas `SECURITY`/`REGULATORY` (`PRD §5.14.5`); lantai penghancuran **ditolak**, bukan diperingatkan, dan MFA wajib serta tidak dapat dimatikan oleh kunci mana pun.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| POST | `/ppks/reports` | usulan `ppks.report.create` | M-36 | blocker | Publik/kampus, **tanpa** memerlukan JWT untuk kanal anonim; `Idempotency-Key` wajib (46); body hanya `reportTypeCode` (kamus `jenis_laporan_ppks`) + narasi + lampiran presign §4.8; **tidak** menerima `status`, `assignedSatgasId`, `caseNumber` |
| GET | `/ppks/reports/{token}` | usulan `ppks.report.view.self` | M-36 | blocker | Status pelapor lewat token sekali-pakai yang dikembalikan saat lapor; **bukan** daftar; **bukan** pencarian; token salah → `404 NOT_FOUND` (5) seragam |
| GET | `/ppks/cases` | usulan `ppks.case.view` | M-36 | blocker | **Metadata saja** untuk Satgas ber-scope: `caseNumber`, `stageCode`, `openedAt`, `assignedSatgasId`; proyeksi server menolak satu kolom isi; `TENANT_ADMIN` **tidak** punya izin ini dan permintaannya menjadi 132 |
| POST | `/ppks/cases` | usulan `ppks.case.create` | M-36 | blocker | Kasus lahir dari laporan terverifikasi Satgas; **satu-satunya** penerbit `ppks.case.registered` (§13.1, payload kosong) |
| GET | `/ppks/cases/{id}/timeline` | usulan `ppks.timeline.view` | M-36 | blocker | Timeline append-only (tanggal, jenis tindakan, peran pelaksana) — deskripsi langkah disimpan **terenkripsi**, jadi pembacaan tanpa DEK menghasilkan baris keadaan, bukan teks |
| POST | `/ppks/cases/{id}/assign` | usulan `ppks.case.assign` | M-36 | blocker | **VALIDATE** penunjukan Satgas; hanya anggota Satgas ber-scope; **tidak** menulis `user_role_assignments` (milik M-03) — ini penugasan kasus, bukan peran |
| POST | `/ppks/cases/{id}/stage` | usulan `ppks.case.validate` | M-36 | blocker | Transisi tahap (enum kelas A di register `DATA_MODEL §15`); MFA wajib; actor yang sama dengan pemuka tahap sebelumnya → `403 SELF_APPROVAL_FORBIDDEN` (56) |
| POST | `/ppks/cases/{id}/referral` | usulan `ppks.referral.create` | M-36 | blocker | Rujukan **anonim** ke M-41 (kesehatan) atau M-24 (sanksi): hanya token + jenis layanan yang lewat, **tidak ada** isi kasus (`PRD §5.13.1` vonis 14) |
| GET | `/ppks/access-logs` | usulan `ppks.accesslog.view` | M-36 | blocker | **Rumah terpisah** dari objek kasus; filter `caseId`, `actorId`, `from`/`to`; memuat `ip_hash` bukan IP mentah (preseden §4.9 butir 5); **tidak ada** rute tulis dari klien dan **tidak ada** rute hapus |
| POST | `/ppks/access-logs/self-check` | usulan `ppks.accesslog.review` | M-36 | blocker | `OTHER`; Satgas/Auditor meminta daftar "siapa membuka kasus apa" sebagai prosedur pengawasan; hasilnya tetap tanpa isi |
| GET | `/ppks/statistics` | usulan `ppks.statistics.view` | M-36 | blocker | Agregat **ber-`k` kecil** dengan penekanan ambang (mis. "kurang dari 5") supaya tidak dapat mengidentifikasi; agregat di bawah plafon **tidak pernah** dirinci — ini keadaan kode 132 yang sama di sisi bentuk keluaran |
| DELETE | `/ppks/cases/{id}` | — | M-36 | blocker | **Tidak tersedia.** Penghancuran hanya lewat job regulasi berversi setelah `ppks.case_retention_years`, dengan persetujuan dua orang; **tidak akan pernah** menjadi rute DELETE |

### 7.11 M-39 · e-Library

`entitlement: usulan: library`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Vonis 3 (`PRD §5.13.1`) menentukan segalanya: **M-30 `student_clearance` pemilik keadaan "boleh lulus"; M-23/M-39/M-10 hanya memancarkan sinyal, tidak pernah menulis status kelulusan.** Untuk gugus ini bentuknya konkret dan hanya satu:

- **Bebas pustaka = sinyal.** `POST /library/patrons/{id}/clearance-signal` memancarkan `library.loan.cleared` (§13.1: penerbit M-39, konsumen M-30 dan APP, payload `student_id, dimension LIBRARY, outstanding_items 0, cleared_at`, transaksi `TX-OUTBOX`, **boleh diabaikan = ya** karena M-30 dapat menghitung ulang dari `clearances`). Rute ini **tidak** menulis `student_clearance`, tidak menulis `students.status_akademik`, dan **tidak** mengembalikan "boleh lulus".
- Sinyal hanya **boleh** dipancarkan bila keadaan sumbernya nol: tidak ada pinjaman aktif, tidak ada denda tertunggak, tidak ada deposit yang belum disahkan. Kondisi tidak terpenuhi → `403 GATE_BLOCKED` (38) dengan `blockedBy[]`; tidak ada rute yang "memaksa bersih".
- **Deposit RAMA** adalah objek M-20 (`thesis.rama.deposited`, §13.1) yang **disahkan pustakawan**; M-39 tidak membuat objek deposit kedua — ia menerima baris tersebut dan menyediakan katalog.
- Denda memakai ambang parameter (`library.fine_per_day_idr`, plafon per eksemplar) dan penolakan plafon punya kodenya sendiri, `409 FINE_CAP_REACHED` (134), supaya perhitungan ulang tidak pernah menambah saldo di atas batas yang diizinkan kebijakan.
- **Pencarian lokal, nol egress:** `ALG-20` (`local-retrieval`, BM25/TF-IDF atas korpus MARC21 tenant) dengan harness §6.2 → `202 { runId }`. Tidak ada mesin cari pihak ketiga.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/library/catalog` | usulan `library.catalog.view` | M-39 | blocker | List §2.4; filter `collectionTypeCode` (kamus `jenis_koleksi`), `shelfLocationCode` (`lokasi_rak`, menunjuk situs/ruang yang ada, bukan tabel baru), `isbn`, `year` |
| GET · POST · PATCH | `/library/items` · `/library/items/{id}` | usulan `library.item.view` · `.create` · `.update` | M-39 | blocker | Eksemplar + status fisik; klasifikasi nasional (DDC/UDC) **hanya dari kamus kelas B** → 126 bila dikirim sebagai nilai bebas |
| GET | `/library/patrons/{id}/loans` | usulan `library.loan.view` | M-39 | blocker | Scope: patron membaca miliknya sendiri tanpa izin manajerial; `Cache-Control: private` |
| POST | `/library/loans` | usulan `library.loan.create` | M-39 | blocker | `201` + `Idempotency-Key` (46); jangka pinjam per jenis koleksi dari **tabel aturan berversi** `loan_policies` — secara sadar **ditolak** menjadi key-value (`PRD §5.14.5`); penolakan anggota aktif → `409 CONFLICT` (12) |
| POST | `/library/loans/{id}/return` | usulan `library.loan.return` | M-39 | blocker | `OTHER`; denda dihitung **server** dari tanggal kembali vs tenggat; tidak ada `fineAmountRupiah` dari body |
| GET · POST | `/library/holds` · `/library/holds/{id}/cancel` | usulan `library.hold.view` · `.create` · `.update` | M-39 | blocker | Reservasi rak; `library.hold_shelf_days` (baku 5, sah 1–30) dibaca dari parameter §4.16, bukan konstanta |
| GET | `/library/fines` | usulan `library.fine.view` | M-39 | blocker | Tagihan denda sebagai **proyeksi**; pemungutan uang adalah M-10 → `POST /finance/invoices`, tidak ada `POST /library/fines/pay` |
| POST | `/library/fines/{id}/waive` | usulan `library.fine.waive` | M-39 | blocker | **VALIDATE** penghapusbukuan denda; EFFECT finansial dieksekusi service M-10 (`finance.waiver.*`, §4.10.2), empat-mata + MFA, pengusul ≠ penyetuju (56) |
| POST | `/library/patrons/{id}/clearance-signal` | usulan `library.clearance.signal` | M-39 | blocker | **Inilah satu-satunya jalur keluar** ke M-30: memancarkan `library.loan.cleared`; `202 { opId }` (TX-OUTBOX); keadaan sumber belum bersih → 38; **tidak** menulis clearance dan **tidak** mengembalikan keputusan lulus |
| GET | `/library/patrons/{id}/clearance-state` | usulan `library.clearance.view` | M-39 | blocker | **Baca-saja**: menampilkan **keadaan dimensi pustaka** (`outstandingItems`, `openFines`) dan boolean `signalSent`; kolom "boleh lulus" **tidak** ada di respons ini (119 bila ditanyakan lewat rute tulis) |
| POST | `/admin/engine/local-retrieval/runs` | usulan `library.search.run` | M-39 | blocker | `202 { runId }` harness §6.2 atas korpus katalog; `degraded: "STEMMING_OFF"` ditampilkan apa adanya; **Antre = Ya** → design-only |
| GET | `/library/collections/{id}/oai-pmh` | usulan `library.oai.view` | M-39 | blocker | **Serialis** OAI-PMH (bukan engine, `ARCHITECTURE §13.5.1`) dengan `resumptionToken` berversi; keluaran **proyeksi baca-saja**, tidak ada mutasi, `Cache-Control` pendek |
| GET · POST · PATCH | `/library/deposits` · `/library/deposits/{id}/endorse` | usulan `library.deposit.view` · `.validate` | M-39 | blocker | Pengesahan deposit RAMA oleh pustakawan; objek tetap milik M-20, rute ini hanya **mengesahkan keadaan** dan memancarkan `thesis.rama.deposited` atas nama pemiliknya |

### 7.12 M-40 · Aset & Inventaris

`entitlement: usulan: asset`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Dua vonis: **6** (`PRD §5.13.1`) — M-40 pemilik kartu aset, M-46 **tidak** INSERT sendiri melainkan memicu service M-40; dan larangan **zero re-entry** (`ARCHITECTURE §13.3` rantai "PBJ → anggaran → aset") — kartu aset, harga perolehan, dan akun anggaran tidak boleh diketik ulang di hilir.

- **Aset lahir dari penerimaan M-46**, bukan dari form kosong. Rute `POST /asset/cards` **ditolak** oleh desain: yang ada adalah `POST /asset/registrations` yang hanya menerima `acceptanceId` dan menyelesaikan sendiri nilainya lewat service, lalu memancarkan `asset.card.created` (payload §13.1: `asset_id, acceptance_id, class_reference_code, location_room_id, acquisition_rupiah`). Upaya mengirim `acquisitionRupiah`/`acquisitionDate` dari klien → `409 ASSET_ACQUISITION_IMMUTABLE` (135).
- **Depresiasi adalah run, bukan angka diketik.** `ALG-23` (`fin-schedule`, penyusutan garis lurus `(cost − salvage) / usefulLifePeriods` dengan penyesuaian periode pertama/terakhir) menghasilkan `depreciation_schedules` + `depreciation_postings` **draf**; posting resmi lewat **service M-10** setelah `VALIDATE` BAUK, dan memancarkan `asset.depreciation.posted` (BATCH, VALIDATE ya). Run ganda untuk `(asset, period)` → `409 DEPRECIATION_PERIOD_ALREADY_POSTED` (136). Metode & masa manfaat per kelas aset adalah **tabel aturan berversi** `asset_depreciation_policies` — secara sadar ditolak menjadi key-value (`PRD §5.14.5`).
- **Klasifikasi BMN nasional = kelas B**; `kelas_aset` kampus = kamus C (`PRD §5.14.6`).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/asset/cards` | usulan `asset.card.view` | M-40 | blocker | List §2.4; filter `classCode` (kamus C), `nationalClassCode` (kelas B), `siteId`/`roomId` (§4.6.7), `custodyMembershipId`, `stateCode`; `?at=` boleh Replica |
| POST | `/asset/registrations` | usulan `asset.card.create` | M-40 | blocker | Hanya `{ acceptanceId, lineItemRefs[] }`; nilai & tanggal **diselesaikan server** dari dokumen M-46; 135 bila nominal dikirim; `201 { assetId }` |
| PATCH | `/asset/cards/{id}` | usulan `asset.card.update` | M-40 | blocker | Whitelist `custodyMembershipId`, `roomId`, `conditionCode`, `labelQrState`; `SERVER_ONLY`: `acquisitionRupiah`, `acquisitionDate`, `bookValueRupiah`, `state` |
| GET · POST | `/asset/qr-labels` · `/asset/qr-labels/{assetId}/print-batch` | usulan `asset.label.view` · `.create` | M-40 | blocker | Penanda QR per kartu; cetak massal = job, bukan respons sinkron; **tidak** mengubah keadaan aset |
| POST | `/asset/transfers` | usulan `asset.transfer.create` | M-40 | blocker | Pemindahan penyimpanan/penanggung jawab; `VALIDATE` oleh **kedua** unit (serah dan terima) → dua actor berbeda (56); memicu `asset.card.created` **tidak**, ia hanya memicu baris riwayat |
| GET · POST | `/asset/stocktakes` · `/asset/stocktakes/{id}/counts` | usulan `asset.stocktake.view` · `.create` | M-40 | blocker | Sensus fisik; selisih diuji terhadap `asset.stocktake_variance_tolerance_pct` (baku 5, sah 0–20, §4.16) — ambang di **parameter**, bukan konstanta kode |
| POST | `/asset/stocktakes/{id}/close` | usulan `asset.stocktake.validate` | M-40 | blocker | **VALIDATE** penutupan sensus; `reason` wajib untuk setiap selisih; hasil akhir tidak dapat disunting — koreksi = sensus baru |
| GET | `/asset/depreciation-schedules` | usulan `asset.depreciation.view` | M-40 | blocker | Proyeksi jadwal per aset/kelas dari hasil `ALG-23`; **seluruh kolom `SERVER_ONLY`** (`PRD §5.13.2` butir 3) dan tidak ada rute tulis angka di bawah prefix ini |
| POST | `/admin/engine/fin-schedule/runs` | usulan `asset.depreciation.run` | M-40 | blocker | `202 { runId }` harness §6.2, `engineCode = fin-schedule`, badan `{ scope: byClass \| bySite \| selected, asOfPeriod }`; mode turun `NO_ACQUISITION_DATE`/`NO_SALVAGE` **menolak baris itu**, bukan memakai asumsi; **Antre = Ya** → design-only |
| POST | `/asset/depreciation-postings` | usulan `asset.depreciation.post` | M-40 | blocker | Hanya `{ runId, lineRefs[] }`; memposting **lewat service M-10** (tidak ada `ledger` di prefix `/asset`); 136 untuk periode yang sudah terposting; `VALIDATE` BAUK + MFA |
| GET · POST | `/asset/disposals` · `/asset/disposals/{id}/approve` | usulan `asset.disposal.view` · `.create` · `.approve` | M-40 | blocker | Penghapusan dari daftar; **VALIDATE** empat-mata; nilai buku saat penghapusan diambil dari run, **tidak** diketik; aset yang menjadi ruang/kendala jadwal → `409 REFERENCE_IN_USE` (19) |
| POST | `/asset/cards/{id}/decommission-signal` | usulan `asset.state.update` | M-40 | blocker | Mengubah **keadaan aset** dan memancarkan sinyal ke M-14 (ruang) / M-32 (IKU sarana); **tidak** menghapus baris dan **tidak** menyentuh modul lain |

### 7.13 M-41 · Klinik Kampus

`entitlement: usulan: clinic`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**, ditambah blocker kunci enkripsi (`ENV_CONTRACT §6.3`). Gugus ini memakai **kelas data khusus UU PDP**: rekam medis harus bisa dibuka **tanpa** membuka modul akademik, dan sebaliknya — itulah alasan `PRD §5.12.1` menolaknya menumpang kode entitlement mana pun. Tiga vonis menekan rute:

- **Vonis 14** (`PRD §5.13.1`): M-41 dan M-24 hanya menerima **rujukan anonim** dari M-36. Karena itu tidak ada `GET /clinic/records?ppksCaseId=`.
- **Vonis dari `AGENTS §3.8`:** hak tingkat field ditegakkan pada **proyeksi server**, bukan dengan menyembunyikan sel. Diagnosis, obat, dan catatan konseling **tidak pernah** keluar ke peran non-klinis; yang mereka terima adalah boolean "ada kunjungan pada tanggal X" beserta kelas layanan.
- **Ringkasan tagihan ke M-10 tanpa isi klinis** (`PRD §5.12.1` baris M-41). Sebuah tagihan layanan klinik tidak boleh memuat diagnosis pada `invoice.description` — penguraiannya ada di objek klinis, bukan di M-10.
- **Consent adalah gerbang, bukan field.** Tindakan di luar keadaan darurat butuh consent terekam berversi; consent ditarik → `409 CONSENT_WITHDRAWN` (130); belum pernah ada → `403 CONSENT_MISSING` (129).
- Retensi rekam medis (`clinic.record_retention_years`, sah 5–25, lantai tidak dapat diturunkan) dan pengingat kedaluwarsa obat (`clinic.expiry_alert_days`) hidup di **parameter** §4.16; tarif layanan klinik tetap **tabel** `clinic_service_tariffs` dan secara sadar ditolak menjadi key-value (`PRD §5.14.5`).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/clinic/patients/{id}/records` | usulan `clinic.record.view` | M-41 | blocker | **Hanya** dokter/konselu pemeran & peran regulasi ber-scope; isi dikembalikan **terdekripsi hanya bila DEK tersedia**, selain itu `503 ENVELOPE_ENCRYPTION_UNAVAILABLE` (133); `TENANT_ADMIN` → 132 |
| POST | `/clinic/patients/{id}/records` | usulan `clinic.record.create` | M-41 | blocker | Tulis klinis oleh pemeran berlisensi; `recordNumber` dan `createdAt` `SERVER_ONLY`; **wajib** `Idempotency-Key` (46); isi tidak pernah masuk log aplikasi (§3.9: raw text tidak masuk log) |
| GET | `/clinic/visits` | usulan `clinic.visit.view` | M-41 | blocker | Kunjungan sebagai **keadaan administratif** (tanggal, poli, status bayar) untuk peran non-klinis; **proyeksi tanpa satu pun kolom klinis** |
| POST | `/clinic/appointments` | usulan `clinic.appointment.create` | M-41 | blocker | Janji temu; slot dari kalender milik modul induk, bukan salinan; `status` transisi lewat aksi, bukan PATCH bebas |
| POST | `/clinic/appointments/{id}/cancel` | usulan `clinic.appointment.update` | M-41 | blocker | Pembatalan dua sisi (pasien/ klinik); jendela pembatalan dari parameter §4.16 |
| GET · POST | `/clinic/consent` · `/clinic/consent/{id}/withdraw` | usulan `clinic.consent.view` · `.grant` · `.update` | M-41 | blocker | Consent berversi per tindakan; penarikan berlaku **ke depan**, rekaman historis tidak dihapus; setiap pembacaan berikutnya wajib menguji consent terkini → 129/130 |
| GET · POST | `/clinic/referrals` · `/clinic/referrals/{id}/ack` | usulan `clinic.referral.view` · `.create` · `.validate` | M-41 | blocker | Rujukan eksternal maupun internal; untuk rujukan dari M-36 yang terbaca hanya **token anonim** (vonis 14) |
| GET · POST · PATCH | `/clinic/inventory/medicines` · `/clinic/inventory/medicines/{id}` | usulan `clinic.inventory.view` · `.create` · `.update` | M-41 | blocker | Persediaan obat + batch + `expiresAt`; pengingat memakai `clinic.expiry_alert_days`; **stok tidak pernah** menjadi angka keuangan — nilai stok dihitung M-40/M-10 |
| POST | `/clinic/inventory/{id}/dispense` | usulan `clinic.inventory.dispense` | M-41 | blocker | Pelepasan batch dengan **FIFO server-side**; `quantityIssued` boleh diminta, saldo akhir tidak pernah diterima dari klien; batch kedaluwarsa → `409 CONFLICT` (12) |
| GET | `/clinic/billable-events` | usulan `clinic.billing.view` | M-41 | blocker | Daftar layanan yang **menagih ke M-10**; respons berisi `serviceCode`, `tariffVersion`, `invoiceId` — **tidak** ada diagnosis, **tidak** ada nominal yang dikirim klien |
| POST | `/clinic/billable-events/{id}/invoice-request` | usulan `clinic.billing.request` | M-41 | blocker | Mengusulkan tagihan; penerbitan tetap `POST /finance/invoices` (M-10) dan tarif dibaca `clinic_service_tariffs` berversi; **tidak ada** rute bayar di gugus ini |
| GET · POST | `/clinic/counseling-sessions` · `/clinic/counseling-sessions/{id}/notes` | usulan `clinic.counseling.view` · `.create` | M-41 | blocker | Catatan konseling = **kelas data paling ketat**: hanya konselu; bahkan peran klinis lain menerima boolean "ada sesi"; lampiran terenkripsi, `expires_at` mengikuti retensi |
| POST | `/clinic/reports/anonymized` | usulan `clinic.report.generate` | M-41 | blocker | Laporan kesakitan agregat; **k-anonimitas wajib**, sel di bawah plafon digabung, bukan ditampilkan mentah; keluaran **proyeksi**, tidak pernah menjadi fakta baru |

### 7.14 M-42 · Asrama & Kantin

`entitlement: usulan: residence`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Tiga vonis membentuk gugus ini:

- **Alokasi adalah engine, bukan form.** Penempatan memakai **ALG-2** (`lab-allocator`, FFD multi-dimensi atas vektor kapasitas, dipakai ulang untuk asrama per `ARCHITECTURE §13.6`: "3D bin packing asrama diterima dengan bentuk lain: ALG-2"). Rute hanya `POST /admin/engine/lab-allocator/runs` → `202 { runId }` dan apply lewat **service pemilik** setelah `VALIDATE`. FFD **tidak** dijamin optimum — deviasi terhadap batas bawah `maks_d Σreq_d / Σcap_d` **wajib** ikut dilaporkan (§11.4), dan hasil parsial tidak boleh tampil sebagai angka final.
- **Dompet bukan piutang akademik** (`PRD §5.12.1` baris M-42). Saldo M-42 tidak dapat melunasi invoice UKT; upaya itu `422 WALLET_NOT_ACADEMIC_RECEIVABLE` (137). Plafon saldo (`residence.wallet_max_balance_idr`, baku 1.000.000, sah 0–10.000.000) adalah plafon **saldo layanan**, bukan plafon piutang.
- **Uang masuk tetap satu jalur.** Top-up dananya lewat §4.7 (webhook gateway) dan §4.7.7 (kontrak anti-duplikasi) — **tidak ada** webhook kedua untuk kantin, dan `payments.status` tidak dapat ditulis dari klien.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST | `/residence/buildings` · `/residence/buildings/{id}` | usulan `residence.building.view` · `.create` · `.update` | M-42 | blocker | Bangunan + blok; menunjuk `sites`/`rooms` §4.6.7, **bukan** tabel ruang kembar (`RD-32`) |
| GET · POST · PATCH | `/residence/rooms` · `/residence/rooms/{id}` | usulan `residence.room.view` · `.create` · `.update` | M-42 | blocker | Kamar + kapasitas + lisensi (listrik/air) + `roomTypeCode` kamus C `tipe_kamar`; kebutuhan penghuni = **atribut kustom kelas D** `kebutuhan_khusus_penghuni`, bukan kolom baru |
| GET | `/residence/occupants` | usulan `residence.occupancy.view` | M-42 | blocker | Penghuni aktif per kamar; kapasitas **dibaca** dari aturan, tidak dihitung di klien |
| POST | `/residence/assignments` | usulan `residence.assignment.create` | M-42 | blocker | **Hanya** `{ proposalRunId, lineRefs[] }`; menolak apply tanpa run sukses → `409 ENGINE_RUN_NOT_APPLICABLE` (75) dan snapshot berubah → `409 ENGINE_STALE_SNAPSHOT` (74); `Idempotency-Key` wajib (46) |
| POST | `/admin/engine/lab-allocator/runs` | usulan `residence.assignment.run` | M-42 | blocker | Harness §6.2 dengan `scope = residence`; **wajib** melaporkan `deviationVsLowerBound` + `degraded: "NO_PREREQ_DATA"` bila `residence_capacity_rules` kosong; **Antre = Ya** → design-only |
| POST | `/residence/assignments/{id}/approve` | usulan `residence.assignment.approve` | M-42 | blocker | **VALIDATE** pengelola asrama; pemohon ≠ penyetuju (56); kunci periode penghunian → `423 PERIOD_CLOSED` (25) |
| POST | `/residence/assignments/{id}/release` | usulan `residence.assignment.update` | M-42 | blocker | Pelepasan kamar; memicu sinyal **bebas asrama** ke M-30 sebagai dimensi `ADMINISTRATIVE`, bukan sebagai status lulus |
| GET · POST | `/residence/canteen/outlets` · `/residence/canteen/menu` | usulan `residence.canteen.view` · `.create` | M-42 | blocker | Outlet & menu; harga per item adalah data berversi, **bukan** `z.enum` dan bukan konstanta (§3.10) |
| GET | `/residence/wallet` | usulan `residence.wallet.view` | M-42 | blocker | Saldo pemilik (scope `SELF`); `Cache-Control: private, no-store`; nominal hanya terbaca oleh pemilik dan peran keuangan yang berhak (`FIELD_RULES`) |
| POST | `/residence/wallet/topup-request` | usulan `residence.wallet.topup` | M-42 | blocker | **Mengusulkan** kanal top-up; penyelesaian dana **hanya** lewat §4.7/§4.7.7; tidak ada `balance` dari body; melewati plafon → `409 CONFLICT` (12) dengan nilai plafon |
| POST | `/residence/wallet/spend` | usulan `residence.wallet.spend` | M-42 | blocker | Transaksi konsumsi; **server** memotong saldo (atomic), klien mengirim `{ outletId, items[], requestId }`; saldo kurang → `409 CONFLICT` (12); replay → 46 |
| GET · POST | `/residence/wallet/refund-request` · `/residence/wallet/refunds/{id}/approve` | usulan `residence.wallet.refund` · `.validate` | M-42 | blocker | Pengembalian saldo **bukan** piutang akademik; `VALIDATE` empat-mata + MFA; jurnal penutup ditulis service M-10, tidak ada `ledger` di prefix ini |
| POST | `/residence/transactions/{id}/dispute` | usulan `residence.transaction.dispute` | M-42 | blocker | Keberatan transaksi dengan bukti; tidak menghapus baris — koreksi selalu baris lawan beralasan (insert-only, pola §4.10.6) |

### 7.15 M-43 · Humas & Event

`entitlement: usulan: event`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Gugus ini memegang **satu-satunya calon WebSocket kedua** di seluruh SICA, sehingga vonis `ARCHITECTURE §13.2` harus dikutip apa adanya: WebSocket dipakai **hanya** untuk *gate check-in* M-43 (dan *incident feed* M-17 §7.21), karena inilah satu-satunya lalu-lintas klien→server terus-menerus dengan balasan segera ("silakan masuk / tolak") yang tidak dapat dibawa satu `POST`. Status hari ini: **design-only** — `ws` dan `socket.io` terukur **0** kemunculan di keempat manifest, dan **0** berkas handler; karena itu kanal ini **tidak boleh** muncul di layar mana pun sebagai fitur, dan permintaannya menjawab `503 REALTIME_CHANNEL_UNAVAILABLE` (121).

- Event **tidak memakai jalur presensi kelas M-18** (`PRD §5.12.1` baris M-43): tidak ada rute `/event/…` yang menulis `attendances`; yang ada hanya `event.registration.checked_in` (§13.1, konsumen M-24 dan APP, **boleh diabaikan = ya**, poin SKKM tetap usulan sampai `VALIDATE` kemahasiswaan §7.6).
- Kapasitas & overbook memakai parameter (`event.capacity_overbook_pct`, baku 0, sah 0–10) dan **melebihi kapasitas ruang fisik tetap dilarang norma keselamatan** (`PRD §5.14.5`) — karena itu plafon teknis menang atas nilai parameter.
- Pemindaian ganda atas peserta yang sudah masuk → `409 ALREADY_CHECKED_IN` (138); jendela pendaftaran ditutup `event.registration_close_before_minutes` sebelum mulai.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST · PATCH | `/events` · `/events/{id}` | usulan `event.catalog.view` · `.create` · `.update` | M-43 | blocker | Katalog acara; `jenis_event` kamus C; status publik ≠ keadaan registrasi (dua kolom terpisah, keduanya `SERVER_ONLY` untuk transisi) |
| POST | `/events/{id}/publish` | usulan `event.catalog.validate` | M-43 | blocker | **VALIDATE** humas; penulis ≠ penerbit (56); tanpa kuota & ruang → ditolak di L5, bukan disenyapkan di UI |
| GET · POST | `/events/{id}/registrations` | usulan `event.registration.view` · `.create` | M-43 | blocker | Pendaftaran; `Idempotency-Key` wajib (46); kuota dijaga **atomic server-side** (bukan `UPDATE … FOR UPDATE` per request, `AGENTS §3.7`); penuh → `409 CONFLICT` (12) dengan `positionUrl` antrean dan `capacityReached` |
| POST | `/events/registrations/{id}/cancel` | usulan `event.registration.update` | M-43 | blocker | Pembatalan peserta; promosi antrean dihitung ulang dari DB dengan `ORDER BY queue_number` deterministik — **bukan** dari urutan kedatangan event (vonis §13.2 butir 5) |
| GET · POST | `/events/{id}/gates` · `/events/gates/{id}/operators` | usulan `event.gate.view` · `.create` · `.update` | M-43 | blocker | Titik pintu + operator yang berwenang memindai di pintu itu saja (scope per gate, bukan peran global) |
| POST | `/events/gates/{id}/checkin` | usulan `event.checkin.execute` | M-43 | blocker | Jalur **HTTP tunggal sah** untuk pintu: `200 { decision: "ALLOW", participantId }` / `{ decision: "DENY", reasonCode }`; token peserta **tidak pernah** dikirim balik utuh; replay → `409 ALREADY_CHECKED_IN` (138); **tidak menyentuh `attendances`** |
| WS | `/events/gates/{id}/stream` | usulan `event.checkin.execute` | M-43 | blocker | **Calon WebSocket #2** (vonis §13.2): dua-arah hanya untuk lalu-lintas pemindaian beruntun di satu pintu; **design-only** — `ws` belum menjadi dependensi, jadi rute ini menjawab 121; **tidak ada** keadaan yang berubah hanya karena peristiwa socket (vonis §13.2 butir 3): baris bukti tetap tertulis di DB lebih dulu |
| POST | `/events/checkins/{id}/reverse` | usulan `event.checkin.validate` | M-43 | blocker | **VALIDATE** pembalikan check-in (peserta keluar/salah pintu); actor ≠ operator yang mencatat (56); jejak insert-only |
| GET · POST | `/events/sessions` · `/events/sessions/{id}/rooms` | usulan `event.session.view` · `.create` | M-43 | blocker | Sesi sub-acara + penempatan ruang; ruang **diminta** ke M-14 lewat penjadwalan milik pemiliknya, tidak pernah dialokasi sendiri (vonis 8) |
| GET | `/events/{id}/signage` | usulan `event.signage.view` | M-43 | blocker | Signage digital: keluaran **proyeksi** dari data registrasi; **tidak** ada rute tulis ke objek lain; render di SuperApp memakai sumber yang sama (§3.4 paritas) |
| GET | `/events/{id}/statistics` | usulan `event.statistics.view` | M-43 | blocker | Kedatangan & kanal (`kanal_pendaftaran_event` kamus C); **read-only**; angka kehadiran peserta **bukan** presensi akademik dan tidak pernah masuk M-18 |
| GET | `/events/{id}/registrations/stream` | usulan `event.registration.view` | M-43 | blocker | **SSE** (`text/event-stream`) untuk layar panitia satu-arah: tunduk penuh pada §10.6.3 (`Last-Event-ID` jendela 15 menit, heartbeat 15 s, plafon 2 stream/user dan 2.000 stream/tenant, degradasi wajib ke polling); **nol handler hari ini** → 121 |

### 7.16 M-44 · SIM-LPPM / LITABMAS

`entitlement: usulan: research`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Vonis 5 & 7 (`PRD §5.13.1`): **M-10 satu-satunya penerbit jurnal/tagihan**; pencairan hibah ditulis **sebagai jurnal M-10**; fakta tridharma tetap di M-44 dan **M-07** yang menghitung BKD dengan hanya **membaca** fakta itu. Karena itu:

- `POST /research/grants/{id}/disbursement-requests` **mengusulkan** pencairan ke `/finance/...`; peristiwa kanoniknya `research.grant.disbursed` (§13.1: konsumen M-10, M-47, M-32; transaksi `TX-OUTBOX + IDEM`; **VALIDATE = ya**, "pencairan = jurnal M-10, dua orang"). Tidak ada `ledger` di prefix `/research`.
- Penelaahan **buta** adalah keadaan: reviewer tidak melihat identitas penulis selama fase itu; pembukaannya adalah aksi `VALIDATE` beralasan, bukan filter UI.
- Luarannya memberi makan BKD lewat pembacaan M-07, dan **tidak** punya kolom kredit BKD sendiri (vonis 7).
- Skor/peringatan proposal memakai **ALG-24 `prob-scorer`** sebagai proposal (`proposal_scores`, `proposal_only = true`) dengan gerbang mutu: ambang gagal → hanya aturan keras dan kata "prediksi" dilarang di layar (`ARCHITECTURE §13.5.1`).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST · PATCH | `/research/schemes` · `/research/schemes/{id}` | usulan `research.scheme.view` · `.create` · `.update` | M-44 | blocker | Skema hibah; **plafon dana per skema = tabel aturan berversi** `scheme_funding_limits` dan secara sadar **ditolak** menjadi key-value (`PRD §5.14.5`) |
| POST | `/research/schemes/{id}/approve` | usulan `research.scheme.validate` | M-44 | blocker | **VALIDATE** + MFA penulis-admin; plafon yang berubah menuntut `effectiveFrom` baru, tidak menimpa skema aktif |
| GET | `/research/proposals` | usulan `research.proposal.view` | M-44 | blocker | List §2.4; filter `schemeId`, `stageCode`, `leadMembershipId`; selama fase buta, identitas penulis **tidak dikirim** sama sekali (bukan disunting) |
| POST | `/research/proposals` | usulan `research.proposal.create` | M-44 | blocker | `201` + `Idempotency-Key` (46); berkas lewat presign §4.8; `stage` & `score` `SERVER_ONLY` |
| POST | `/admin/engine/prob-scorer/runs` | usulan `research.proposal.score` | M-44 | blocker | `202 { runId }` harness §6.2, `engineCode = prob-scorer`, model Naive Bayes atas teks proposal; **wajib** menyimpan `model_version`, `seed`, `iterations`; ambang mutu gagal → hanya aturan keras; **Antre = Ya** → design-only |
| POST | `/research/proposals/{id}/assign-reviewers` | usulan `research.review.assign` | M-44 | blocker | Penugasan reviewer **buta**; penarikan diri wajib `reason`; reviewer ≠ penulis (56 di sisi kepentingan) |
| POST | `/research/reviews/{id}/submit` | usulan `research.review.submit` | M-44 | blocker | Telaah dengan rubrik berversi; rubrik = kewenangan → versi + empat-mata; skor tersimpan sebagai basis-poin `numeric`, **bukan** float (§3.4 paritas) |
| POST | `/research/proposals/{id}/fund` | usulan `research.proposal.validate` | M-44 | blocker | **VALIDATE** penetapan pendanaan; dua orang (56); tanpa skor reviewer sah → `422 EVIDENCE_INSUFFICIENT` (117) |
| GET · POST | `/research/contracts` · `/research/contracts/{id}/amend` | usulan `research.contract.view` · `.create` · `.update` | M-44 | blocker | Kontrak penelitian; pihak ketiga dari `0053`; amendment **berversi**, tidak menimpa; nominal kontrak dibaca M-10 sebagai komitmen |
| GET · POST | `/research/monitoring` · `/research/contracts/{id}/monev` | usulan `research.monev.view` · `.create` | M-44 | blocker | Monev per tahap; temuan membuka `PENDING_REVIEW`, tidak pernah memblokir diam-diam |
| POST | `/research/grants/{id}/disbursement-requests` | usulan `research.disbursement.request` | M-44 | blocker | **MENGUSULKAN** pencairan ke service `/finance/...`; `202 { opId }` + `Idempotency-Key` (46); tahap berikutnya sebelum tahap ini tercatat → `409 RESEARCH_DISBURSEMENT_STAGE_INCOMPLETE` (139); **tidak** ada `ledger`/`invoice` yang ditulis di sini |
| POST | `/research/grants/{id}/approve` | usulan `research.disbursement.approve` | M-44 | blocker | **VALIDATE** dua orang (penerima manfaat ≠ penyetuju); memancarkan `research.grant.disbursed`; MFA penulis-admin; sudah diputus → 55 |
| GET · POST | `/research/outputs` · `/research/outputs/{id}/validate` | usulan `research.output.view` · `.create` · `.validate` | M-44 | blocker | Luaran tridharma; **satu-satunya penerbit `research.output.recorded`** (§13.1, konsumen M-07, M-22, M-31, M-32, M-34); pengesahan sebelum masuk BKD; **tidak** menyimpan angka BKD |
| GET | `/research/lecturer-portfolio` | usulan `research.portfolio.view` | M-44 | blocker | Proyeksi luaran per dosen untuk M-07/M-08; **read-only** dan **tanpa** skor — M-07 yang menghitung (vonis 7) |

### 7.17 M-45 · CRM PMB & Marketing

`entitlement: usulan: crm`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Vonis 12 (`PRD §5.13.1`) adalah vonis yang paling tegas soal bentuk rute: **M-09 pemilik pendaftaran dan seleksi; M-45 pemilik lead dan kampanye; konversi lead hanya lewat service PMB, tidak membuat tabel pendaftar kedua.** Vonis 13 menahan sisi IKU. Konsekuensi yang langsung terukur di bab ini:

- `POST /crm/leads/{id}/convert` **memanggil service PMB** dan mengembalikan `applicationId` **milik M-09**. Tidak ada satu pun rute `/crm/**` yang menulis `pmb_applications`, `pmb_documents`, atau menerbitkan nomor pendaftaran. Uji penolakannya wajib ada (`PRD §5.13.2` butir 5): percobaan tulis langsung ke objek PMB dari konteks CRM → `403 CROSS_MODULE_WRITE_FORBIDDEN` (119), bukan `201`.
- Peristiwa kanoniknya `crm.lead.converted` (§13.1: penerbit M-45, konsumen M-09 dan M-32, payload `lead_id, application_id, campaign_id, channel_ref, cac_rupiah`, transaksi `TX-OUTBOX + IDEM`, **boleh diabaikan = tidak**).
- Consent pemasaran adalah gerbang dua arah: belum memberi → `403 CONSENT_MISSING` (129); pernah memberi lalu menarik → `409 CONSENT_WITHDRAWN` (130), dan **consent yang ditarik mengalahkan nilai parameter** `crm.max_messages_per_contact_week` (`PRD §5.14.5`) — penyetel parameter tidak dapat membeli kembali hak mengirim.
- Pemeringkatan lead memakai **ALG-24 `prob-scorer`** (Naive Bayes `lead_funnel_scores` + K-Means `geo_cluster_assignments`, semuanya `proposal_only = true`, seed tersimpan). Daftar terlarang atribut diuji statis: wilayah domisili **boleh**, agama/suku/kewarganegaraan/jenis kelamin/disabilitas **tidak** (`ARCHITECTURE §13.5.1` gerbang (l)). Kata "prediksi" dilarang di layar saat ambang mutu gagal.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/crm/leads` | usulan `crm.lead.view` | M-45 | blocker | List §2.4; filter `stageCode` (kamus `tahap_pipeline_crm`), `sourceCode` (`sumber_lead`), `campaignId`, `ownerMembershipId`; keadaan teknis lead tetap enum kelas A |
| POST | `/crm/leads` | usulan `crm.lead.create` | M-45 | blocker | `201` + `Idempotency-Key` (46); salinan (duplikat kontak) → `409 CONFLICT` (12) dengan `matchedLeadId`; PII minimal: **tidak** menyimpan nilai rapor/NUPTK |
| PATCH | `/crm/leads/{id}` | usulan `crm.lead.update` | M-45 | blocker | Whitelist; **tidak** menerima `stage` sebagai nilai — perpindahan tahap hanya lewat aksi ber-`VALIDATE` di bawah |
| POST | `/crm/leads/{id}/advance-stage` | usulan `crm.lead.validate` | M-45 | blocker | **VALIDATE** perpindahan pipeline dengan alasan; tahap yang dilompati → `409 CONFLICT` (12) dengan `allowedNextStages[]`. Kode 122 **tidak** dipakai di sini: itu penjaga mesin keadaan tiket M-04, dan satu keadaan hanya punya satu kode |
| POST | `/crm/leads/{id}/convert` | usulan `crm.lead.convert` | M-45 | blocker | **Titik tunggal ke M-09**: `201 { applicationId }` hasil service PMB; lead sudah dikonversi → `409 DECISION_ALREADY_MADE` (55); tanpa consent → 129; memancarkan `crm.lead.converted`; **tidak** menulis `pmb_applications` sendiri |
| GET · POST · PATCH | `/crm/campaigns` · `/crm/campaigns/{id}` | usulan `crm.campaign.view` · `.create` · `.update` | M-45 | blocker | Kampanye + kanal + jendela; **kredensial kanal tidak pernah** di body (vault/ENV, §3.9); `crm.lead_stale_days` dari parameter §4.16 |
| POST | `/crm/campaigns/{id}/launch` | usulan `crm.campaign.validate` | M-45 | blocker | **VALIDATE** sebelum kirim; menolak kampanye tanpa consent tercatat; MFA penulis-admin |
| POST | `/crm/campaigns/{id}/messages` | usulan `crm.message.send` | M-45 | blocker | Pengiriman massal = **job** → `202 { opId }` melalui `queue_operations` (spine §13.2); plafon per kontak per minggu dari parameter dan **kalah** oleh consent ditarik (130); **Antre = Ya** → design-only |
| GET · POST | `/crm/contacts/{id}/consent` · `/crm/consent/{id}/withdraw` | usulan `crm.consent.view` · `.grant` · `.update` | M-45 | blocker | Consent per kanal berversi, menarik berlaku ke depan; setiap pembacaan berikutnya menguji consent **terkini**; riwayat tidak pernah dihapus (append-only) |
| GET · POST | `/crm/referrals` · `/crm/referrals/{id}/reward` | usulan `crm.referral.view` · `.create` · `.validate` | M-45 | blocker | Hadiah rujukan **hanya** setelah daftar ulang lunas dan butuh penyetuju kedua (`PRD §5.14.5`); nominal hadiah dieksekusi service M-10, bukan ditulis di objek CRM |
| POST | `/admin/engine/prob-scorer/runs` | usulan `crm.lead.score` | M-45 | blocker | `202 { runId }` harness §6.2 untuk `lead_funnel_scores` dan `geo_cluster_assignments`; **wajib** menyimpan `model_version`, `seed`, `iterations`; gerbang mutu gagal → hanya aturan keras; **Antre = Ya** → design-only |
| GET | `/crm/funnel` | usulan `crm.funnel.view` | M-45 | blocker | Konversi corong + CAC sebagai **proyeksi**; `cac_rupiah` hanya untuk peran keuangan yang berhak (`FIELD_RULES`); **tidak** ada rute tulis |
| GET | `/crm/prospects/geo-clusters` | usulan `crm.funnel.view` | M-45 | blocker | Hasil klaster geografis ALG-24 dengan `margin` dan `candidate_ref`; akurasi spasial kurang → `NO_GEO_ACCURACY`, **bukan** klaster asal; tidak pernah menjadi dasar penolakan calon mahasiswa |

### 7.18 M-46 · E-Procurement PBJ

`entitlement: usulan: procurement`; objek: **belum bernama** di `DATA_MODEL §22` → **`blocker`**. Vonis 6 (`PRD §5.13.1`) menentukan arah panah: **M-40 pemilik kartu aset; M-10 pemilik komitmen & pembayaran; M-46 menghasilkan "terima-aset" yang memicu pembuatan baris aset lewat service M-40, bukan INSERT sendiri.** Ditambah vonis 5: komitmen anggaran **dibaca** M-10 dan M-46 **tidak memposting jurnal sendiri**.

- Peristiwa kanonik `procurement.goods.received` (§13.1: konsumen M-40, M-10, M-32; payload `po_id, acceptance_id, line_items_ref, committed_budget_id, vendor_id`; transaksi `TX-OUTBOX + IDEM`; **VALIDATE = ya**, "BAST adalah aksi VALIDATE PPK").
- Harga Perkiraan Sendiri (HPS) punya masa berlaku terukur: `procurement.hps_validity_days` (baku 30, sah 7–180) dari parameter §4.16; bila masa berlakunya lewat → `422 PROCUREMENT_HPS_EXPIRED` (140). **Pita nilai metode pengadaan** (`procurement_method_limits`, FR-PBJ-01) dan **kuorum panitia** (`procurement.committee_min_members`, sah 3–21, nilai di bawah 3 **ditolak `min_value`**) adalah tabel aturan berversi dan `CHECK` parameter — bukan konstanta di kode.
- Vendor adalah pihak ketiga dari `0053_external_parties.sql`; **kredensial akses vendor tidak pernah** menjadi body atau baris parameter (`AGENTS §3.10`: rahasia bukan parameter).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST | `/procurement/requests` · `/procurement/requests/{id}` | usulan `procurement.request.view` · `.create` · `.update` | M-46 | blocker | Permintaan pengadaan dari unit pengusul; `status` `SERVER_ONLY`; `kategori_pengadaan` kamus C |
| POST | `/procurement/requests/{id}/approve-budget` | usulan `procurement.request.validate` | M-46 | blocker | **VALIDATE** komitmen anggaran; komitmen dicatat **service M-10** (vonis 5), rute ini hanya memancarkan permintaan; pagu tidak cukup → `403 GATE_BLOCKED` (38) dengan `blockedBy[]` |
| GET · POST | `/procurement/packages` · `/procurement/packages/{id}/hps` | usulan `procurement.package.view` · `.create` | M-46 | blocker | Paket pengadaan + HPS berversi; **pita metode pengadaan = tabel aturan**, bukan key-value (`PRD §5.14.5`); `metode_pengadaan` kamus C yang **satu kind dipakai vendor dan panitia** (FR-PBJ-04, dilarang kembar) |
| POST | `/procurement/packages/{id}/publish-tender` | usulan `procurement.tender.publish` | M-46 | blocker | Pengumuman; menolak bila HPS di luar `procurement.hps_validity_days` → 140; kuorum panitia < `committee_min_members` → `422 VALIDATION_FAILED` (6) dengan `details.requiredMin` |
| GET · POST | `/procurement/vendors/{vendorId}/bids` | usulan `procurement.bid.view` · `.create` | M-46 | blocker | Penawaran vendor; **hanya vendor terautentikasi atas paketnya sendiri**; pembukaan penawaran terkunci sampai `bidOpeningAt` (L5 server, bukan tombol disabled) |
| POST | `/procurement/packages/{id}/open-bids` | usulan `procurement.bid.open` | M-46 | blocker | `OTHER`; **VALIDATE** oleh panitia ber-kuorum; empat-mata: tidak seorang diri; hasil pembukaan append-only dan tidak dapat diulang (55) |
| POST | `/procurement/packages/{id}/award` | usulan `procurement.award.validate` | M-46 | blocker | **VALIDATE** penetapan pemenang + alasan; MFA penulis-admin; menolak tanpa Berita Acara; penolak kalah tender hanya melihat status, **bukan** skor rinci lawan |
| GET · POST · PATCH | `/procurement/contracts` · `/procurement/contracts/{id}` | usulan `procurement.contract.view` · `.create` · `.update` | M-46 | blocker | Kontrak PBJ; pihak ketiga `0053`; `contractNumber` terbit server; nominal **tidak pernah** diubah tanpa adendum berversi |
| POST | `/procurement/receipts` | usulan `procurement.receipt.create` | M-46 | blocker | **BAST / terima-aset**: `{ contractId, lineItemRefs[], conditionCode }`; **tidak** INSERT ke `assets`; memicu **service M-40** (`asset.registrations`, §7.12) dan memancarkan `procurement.goods.received`; transaksi TX-OUTBOX + IDEM, wajib `Idempotency-Key` (46) |
| POST | `/procurement/receipts/{id}/validate` | usulan `procurement.receipt.validate` | M-46 | blocker | **VALIDATE** PPK atas penerimaan; penerima barang ≠ panitia penetapan (56); aset lahir **hanya setelah** baris ini sah |
| GET · POST | `/procurement/invoices-request` | usulan `procurement.payment.request` | M-46 | blocker | Tagihan vendor **diusulkan** ke `/finance/invoices` M-10; respons hanya `invoiceId`; **tidak ada** `POST /procurement/payments` dan tidak akan ada |
| GET | `/procurement/vendor-portal/evaluations` | usulan `procurement.evaluation.view` | M-46 | blocker | Evaluasi kinerja vendor; proyeksi dari penerimaan & keterlambatan; **tidak** ada rute yang mengirim skor dari klien |
| POST | `/procurement/vendors/{id}/blacklist` | usulan `procurement.vendor.validate` | M-46 | blocker | **VALIDATE** empat-mata + `reason` wajib + masa berlaku; kontrak aktif yang belum selesai → `409 REFERENCE_IN_USE` (19); klasifikasi BMN untuk barang terkait tetap kelas B milik M-40 |

### 7.19 M-47 · Endowment Fund

`entitlement: usulan: endowment`; objek: `0057_endowment_fund.sql` (DDL tertulis di `DATA_MODEL §22.3.2`). Vonis 5 (`PRD §5.13.1`): **M-47 menyatakan porsi imbal hasil yang boleh dialokasikan sebagai sumber dana berversi; M-10 satu-satunya penerbit jurnal/tagihan.** Jadi M-47 adalah **pemodal**, bukan penagih: tidak ada invoice, tidak ada pembayaran donatur di dalam gugus ini — penerimaan donasi masuk lewat jalur dana §4.7 dan menjadi baris `payments` M-10.

- Peristiwa kanonik `endowment.yield.allocated` (§13.1: konsumen M-11, M-44, M-10, M-32; payload `portfolio_id, fiscal_year, allocated_rupiah, purpose_scholarship-hibah, policy_version`; transaksi `TX-OUTBOX + IDEM`; **VALIDATE = ya**, "alokasi dana = keputusan empat-mata").
- Imbal hasil dihitung **ALG-23 `fin-schedule`** (imbal hasil majemuk per periode alokasi, `value_{n+1} = value_n × (1 + r_bp/10000)`, `r_bp` dari parameter berversi; seluruhnya `bigint` rupiah utuh dan `numeric` basis-poin, ADR-5). Rute tidak menghitung (§3.9) — hanya `202 { runId }`.
- Plafon alokasi **tidak dapat dilonggarkan melewati `max_value`**: `endowment.allocation_max_pct_of_yield_bp` (basis-poin, sah 0–10000) dan `endowment.valuation_frequency_months` (baku 6, sah 1–12) adalah kelas `REGULATORY` (`PRD §5.14.5`) → penyetuju kedua + MFA. Pelanggaran plafon saat alokasi → `422 ENDOWMENT_ALLOCATION_EXCEEDS_POLICY` (141).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET · POST | `/endowment/donations` | usulan `endowment.donation.view` · `.create` | M-47 | spec-only | Pencatatan **niat** donasi + donatur (`0053`); `jenis_donasi` dan `peruntukan_donasi` kamus C; **tidak** ada rute terima-dana di sini → §4.7; `receiptNumber` `SERVER_ONLY` |
| POST | `/endowment/donations/{id}/confirm` | usulan `endowment.donation.validate` | M-47 | spec-only | **VALIDATE** hanya bila baris `payments` M-10 sudah `SETTLED`; penyetuju berbeda dari pencatat (56); MFA penulis-admin |
| GET | `/endowment/donors/{id}/acknowledgements` | usulan `endowment.donation.view` | M-47 | spec-only | Tanda terima & laporan dampak per donatur; **proyeksi**; nominal donatur lain tidak pernah ikut terproyeksi (scope `SELF` bagi donatur) |
| GET · POST · PATCH | `/endowment/portfolios` · `/endowment/portfolios/{id}` | usulan `endowment.portfolio.view` · `.create` · `.update` | M-47 | spec-only | Portofolio dana abadi + kebijakan penempatan; `policyVersion` wajib di setiap mutasi; **tidak** ada kolom yang menerima angka hasil |
| POST | `/admin/engine/fin-schedule/runs` | usulan `endowment.yield.run` | M-47 | spec-only | `202 { runId }` harness §6.2, `engineCode = fin-schedule`, tujuan `yield_projections`; **wajib** `r_bp` menunjuk versi parameter dan seed/`iterations` tersimpan; gerbang (h) golden vector; **Antre = Ya** → design-only |
| GET | `/endowment/portfolios/{id}/valuation` | usulan `endowment.portfolio.view` | M-47 | spec-only | Nilai wajar per `fiscal_year` **dari hasil run**; frekuensi penilaian mengikuti `valuation_frequency_months`; run belum ada → `422 ENGINE_DATA_INSUFFICIENT` (99), bukan angka taksiran |
| POST | `/endowment/allocations` | usulan `endowment.allocation.request` | M-47 | spec-only | Usulan alokasi ke beasiswa (M-11) atau hibah (M-44): hanya `{ portfolioId, fiscalYear, purposeCode, requestedRupiah }`; melewati plafon porsi → 141; `Idempotency-Key` wajib (46) |
| POST | `/endowment/allocations/{id}/approve` | usulan `endowment.allocation.approve` | M-47 | spec-only | **VALIDATE empat-mata** (`ARCHITECTURE §13.1`): pengaju ≠ penyetuju (56) + MFA; memancarkan `endowment.yield.allocated`; **tidak** membuat tagihan dan **tidak** menulis `ledger` |
| GET | `/endowment/allocations` | usulan `endowment.allocation.view` | M-47 | spec-only | Daftar alokasi + `sourceFundId` yang dipakai M-11/M-44 sebagai payung biaya; `?at=` untuk rekonstruksi historis |
| GET | `/endowment/reports` | usulan `endowment.report.view` | M-47 | spec-only | Laporan dana abadi (porsi terpakai vs plafon kebijakan, sisa imbal hasil); **read-only** dan seluruh kolomnya `SERVER_ONLY`; ekspor melewati plafon → 59 |

### 7.20 M-35 · PIN & SIVIL

`entitlement: —` (gerbang peran, bukan SKU — `PRD §5.12.1`); objek: `0052_credential_pin_sivil.sql` (DDL tertulis di `DATA_MODEL §22.1.2`). Vonis yang mengikat: M-35 **menolak terbit bila clearance M-30 belum lengkap**, nomor ijazah/PIN/status lulus adalah miliknya, dan **verifikasi publik tanpa auth sudah punya rumah** di §4.9 (`GET /api/v1/public/verify/{digest}`) — bab ini **tidak** membuat rute verifikasi kedua, ia hanya menambah permukaan PIN/SIVIL di sekitarnya.

- Clearance adalah milik M-30; karena itu `POST /credentials/pin/reservations` **membaca** keadaan clearance dan menolak dengan `403 GATE_BLOCKED` (38) + `blockedBy[]`, bukan dengan menulis "clearance paksa".
- Peristiwa kanonik: `graduation.clearance.evaluated` (penerbit M-30, konsumen M-23, M-35, M-34, M-27, APP) dan `graduation.diploma.signed` (penerbit M-35, payload `diploma_id, pin_id, signature_alg, signature_digest, sivil_ref`, transaksi `TX-OUTBOX + IDEM`, VALIDATE: "penerbitan PIN/SIVIL berhenti bila clearance belum lengkap").
- **Batas rate limit publik adalah lantai keamanan**, bukan pilihan petugas: `credential.public_verify_rate_limit_per_minute` (bawaan 20, sah 5–100) berkelas `SECURITY` dengan **lantai anti-penyalinan massal yang tidak dapat diturunkan Admin IT** (`PRD §5.14.5`). Penolakan berulangnya memakai kode yang sudah ada: `429 RATE_LIMIT_EXCEEDED` (9).
- **Tidak ada TSA pihak ketiga.** `ARCHITECTURE §12.12`/ADR-14 menolak *timestamping* RFC 3161 berbayar; jangkar waktu adalah **jangkar WORM milik sendiri** dengan rantai hash ALG-14. Karena itu tidak ada rute `/credentials/timestamp/**`.

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/credentials/pin/reservations` | usulan `graduation.pin.view` | M-35 | spec-only | Daftar reservasi PIN per periode/angkatan; `?at=` boleh Replica; **nomor PIN terenkripsi saat transit dan hanya terisi penuh pada respons peran berhak** |
| POST | `/credentials/pin/reservations` | usulan `graduation.pin.reserve` | M-35 | spec-only | Reservasi sebelum SIVIL; `201` dengan `reservationId`; clearance belum lengkap → `403 GATE_BLOCKED` (38) dengan `blockedBy[]`; **tidak** menerima `pin` dari body |
| POST | `/credentials/pin/reservations/{id}/issue` | usulan `graduation.pin.issue` | M-35 | spec-only | **VALIDATE** BAAK; MFA penulis-admin; penerbit berbeda dari pengaju reservasi (56); yang terbit di sini adalah PIN ijazah, **bukan** `nim` (NIM milik M-09 dan ALG-18) |
| GET · POST | `/credentials/diplomas` · `/credentials/diplomas/{id}/sign` | usulan `graduation.diploma.view` · `.validate` | M-35 | spec-only | Penandatanganan ijazah elektronik; **jangkar waktu = jangkar WORM sendiri + rantai ALG-14**, bukan TSA eksternal; memancarkan `graduation.diploma.signed`; digest tak dapat dihitung ulang → 90 `AUDIT_CHAIN_COMPROMISED` |
| POST | `/credentials/diplomas/{id}/revoke` | usulan `graduation.diploma.revoke` | M-35 | spec-only | **VALIDATE** penarikan + `reason` wajib; setelah ini §4.9 mengembalikan `valid: false, status: "REVOKED"` dengan `subject` di-`null` (aturan §4.9 butir 2); append-only, tidak pernah menghapus baris |
| GET | `/credentials/sivil/submissions` | usulan `graduation.sivil.view` | M-35 | spec-only | Kiriman ke SIVIL (Kemendikdasmen/PDDikti) per batch; status kiriman **bukan** milik M-34 Feeder: dua objek terpisah dengan satu pemilik masing-masing, jangan disatukan |
| POST | `/credentials/sivil/push` | usulan `graduation.sivil.push` | M-35 | spec-only | **Transport saja**: `202 { opId }` ke worker adapter; nilai ijazah **dibaca** dari objek M-35, tidak dikirim ulang; watermark hanya maju atas baris sukses (pola §12.10) → 125 untuk regresi |
| POST | `/credentials/sivil/reconcile` | usulan `graduation.sivil.validate` | M-35 | spec-only | Rekonsiliasi respons SIVIL; temuan **tidak** auto-resolve — manusia yang menutup dengan `VALIDATE`; MFA penulis-admin |
| GET | `/public/verify/{digest}` | — (tanpa auth) | M-35 | spec-only | **Rute §4.9 apa adanya — tidak diduplikasi di sini.** Ditulis ulang di tabel ini hanya sebagai penunjuk: tanpa JWT, tanpa `X-Tenant-ID`, digest 64 heksa (anti-enumeration), PII minimal empat field, `ip_hash` bukan IP mentah, rate limit publik agresif (9), `Cache-Control: private, no-store`, **tidak ada daftar/pencarian** |
| GET | `/public/pin/verify` | — (tanpa auth) | M-35 | spec-only | Verifikasi **berdasarkan PIN + tanggal terbit** untuk kampus yang mencetak PIN teks (bukan hanya QR): input **selalu** dua faktor (tidak dapat enumerasi dari PIN saja), hasil mengikuti aturan PII §4.9 butir 1–2, dicatat ke baris verifikasi yang sama, rate limit kelas `SECURITY` dengan lantai yang tidak dapat diturunkan |

### 7.21 M-16 & M-17 · LMS dan Proctoring

`entitlement: lms` dan `cbt` (dua-duanya nyata di `packages/contracts/src/entitlement.ts`); objek LMS **sudah punya DDL** (`lms_materials`, `lms_submissions` di `DATA_MODEL §5`; `lms_sessions` **kalah sebagai tabel** dan hanya ada sebagai view proyeksi `class_sessions` × `enrollments` × `class_assignments`) → baris LMS di bawah **`spec-only`**. Sebaliknya **SCORM/xAPI dan proctoring belum punya objek mana pun** di `DATA_MODEL` → **`blocker`**. Tiga vonis mengikat:

- **Vonis 9** (`PRD §5.13.1`): M-18 pemilik satu vonis per `(sesi, mahasiswa)`; LMS dan proctoring **mengirim bukti** ke `attendance_evidence` lewat **satu jalur ingest** — dan jalur itu sudah ada: `POST /attendance/events/lms` (§4.18.2). Bab ini **tidak** membuka jalur ingest kedua, ia hanya menunjukkan tautannya.
- **Vonis 16** (`ARCHITECTURE §13.6`): *local OpenCV face mesh WASM* **ditolak sebagai vonis**; yang diterima adalah **ALG-22 design-only** yang mengusulkan **anomali**, bukan identitas — tanpa basis data biometrik, tanpa pengenalan 1:N, tanpa raw frame di log, `expires_at` 30 hari. Server **hanya** menerima vektor metrik + digest bingkai. Hari ini `opencv` terukur **0** → layar yang tersedia hanyalah daftar sinyal manual pengawas.
- **Peristiwa kanonik**: `lms.activity.progressed` (BATCH, konsumen M-18/M-19/M-12/M-10, **boleh diabaikan = ya** karena ia bukti bukan vonis) dan `cbt.incident.detected` (EPHEMERAL dua-arah, VALIDATE **ya**, dan **tidak pernah membatalkan ujian otomatis** — vonis `ARCHITECTURE §13.6`).

| Metode | Path | Izin | M | Status | Catatan |
|---|---|---|---|---|---|
| GET | `/lms/classes/{classId}/sessions` | usulan `lms.session.view` | M-16 | spec-only | **Rute §4.4.1 apa adanya**; roster = proyeksi view, **bukan** tabel `lms_sessions` (kalah nama di `DATA_MODEL §14.8`) |
| GET · POST · PATCH | `/lms/courses/{courseId}/materials` · `/lms/materials/{id}` | usulan `lms.material.view` · `.create` · `.update` | M-16 | spec-only | Materi; berkas lewat presign §4.8 (kategori & MIME §4.8.2); penghapusan → `409 REFERENCE_IN_USE` (19) bila sudah dirujuk tugas |
| POST | `/lms/sessions/{sessionId}/progress` | usulan `lms.activity.record` | M-16 | spec-only | **Rute §4.4.2 apa adanya**; yang dikirim adalah **bukti** (`joined_s`, `watch_ratio`, `event_digest`), bukan vonis; rasio dihitung **server** (pola §4.18.2) |
| POST | `/attendance/events/lms` | usulan `attendance.event.ingest` | M-16 | blocker | **Satu-satunya jalur ingest** (vonis 9): kontraknya §4.18.2, idempoten per `(tenant, session, student, source, eventWindow)`, batch flush → **Antre = Ya** dan **wajib `503`** sebelum objek `0049` dieksekusi; tidak ada rute ingest LMS kedua |
| POST | `/lms/scorm/packages` | usulan `lms.scorm.upload` | M-16 | blocker | Unggah paket SCORM: presign §4.8 + **unzip aman di worker** (batas ukuran, `zip-slip` ditolak, path keluar root ditolak); objek diminta ke `DATA_MODEL §22`; **nol egress** — tidak ada LMS cloud |
| GET | `/lms/scorm/packages/{id}/manifest` | usulan `lms.scorm.view` | M-16 | blocker | Baca `imsmanifest.xml` sebagai **data**, bukan instruksi (§3.9: input tak-tepercaya tidak pernah menjadi instruksi); anchornya terdaftar, nilai hanya mengisi field yang dikenal |
| POST | `/lms/scorm/launch` | usulan `lms.scorm.launch` | M-16 | blocker | Peluncuran dengan **token sekali-pakai berversi** + `lease` gaya §4.2.14; tidak menerima `completion` dari klien sebagai keadaan akhir |
| POST | `/lms/xapi/statements` | usulan `lms.statement.ingest` | M-16 | blocker | Ingest xAPI **milik tenant sendiri** (bukan LRS cloud): pernyataan disimpan sebagai **bukti** ber-`event_digest`, dan vonis kehadiran tetap lewat satu jalur §4.18.2; payload di luar allowlist ditolak sebelum parsing (pola §4.18.3 butir 3) |
| GET | `/lms/xapi/statements` | usulan `lms.statement.view` | M-16 | blocker | Proyeksi untuk M-19 (komponen) dan M-12 (capaian); **tidak** ada rute yang menyatakan "hadir" dari sini |
| POST | `/lms/assignments/{id}/submit` | usulan `lms.submission.create` | M-16 | spec-only | **Rute §4.4.3 apa adanya**; nilai akhir tetap `grades` M-19 (vonis 2) — LMS menyimpan lampiran & waktu, bukan angka |
| GET | `/lms/courses/{courseId}/search` | usulan `lms.search.view` | M-16 | spec-only | **ALG-20 `local-retrieval`** atas korpus materi: `POST /admin/engine/local-retrieval/runs` → `202 { runId }`; `degraded: "STEMMING_OFF"` dan `NO_CORPUS` apa adanya; tidak ada embedding cloud (gerbang (g)) |
| POST | `/lms/exam-sessions` | usulan `cbt.exam.create` | M-17 | spec-only | Sesi ujian dari bank soal CBT (`cbt` entitlement nyata); jendela & `lockdown` dari aturan berversi; `status` `SERVER_ONLY` |
| POST | `/lms/exam-sessions/{id}/lockdown-event` | usulan `cbt.lockdown.record` | M-17 | blocker | Kejadian lockdown dari klien **hanya** sebagai peristiwa ter-sign dengan `sessionId` + `eventCode` + digest; **tidak ada** nama kandidat/rekaman/transkrip di payload (PII, §4.18.3 butir 3) |
| POST | `/lms/exam-sessions/{id}/proctoring-signals` | usulan `cbt.signal.record` | M-17 | blocker | Vektor **metrik** (geometri + temporal) dari ALG-22 di perangkat/kontainer sendiri + `frameDigest`; **raw frame tidak pernah** diunggah; `proctoring_frames_digest.expires_at` baku 30 hari; sinyal **tidak pernah** mengubah `exam_session.status` (gerbang (j)) |
| GET | `/lms/exam-sessions/{id}/incidents` | usulan `cbt.incident.view` | M-17 | blocker | Daftar anomali untuk pengawas; **mode desain penuh**: `opencv` 0 → yang tersedia hari ini hanya daftar sinyal manual; ambang penanda adalah parameter, bukan konstanta |
| WS | `/lms/exam-sessions/{id}/incidents/stream` | usulan `cbt.incident.view` | M-17 | blocker | **Calon WebSocket #1** (vonis §13.2): dua-arah karena pengawas memberi tanda tangan/aksi selama ujian berjalan; **design-only**, `ws` belum ada → 121; setiap sinyal **wajib mendarat di tabel bukti** lebih dulu (kolom VALIDATE §13.1 baris `cbt.incident.detected`) dan **tidak pernah** membatalkan ujian otomatis |
| POST | `/lms/exam-sessions/{id}/incidents/{incidentId}/decision` | usulan `cbt.incident.validate` | M-17 | spec-only | **VALIDATE** pengawas: lanjutkan / catat / periksa manual; actor ≠ peserta; keputusan append-only; hasil ujian masuk M-19 sebagai **komponen**, bukan nilai akhir (vonis `PRD §5.12.1` baris M-17) |

**Yang ditolak menjadi rute di gugus ini:** `POST /lms/exam-sessions/{id}/face-verify`, `POST /lms/exam-sessions/{id}/liveness`, dan setiap varian "pengenalan wajah". Ketiganya memerlukan layanan berbayar atau basis data biometrik — ditolak `ADR-14` dan `ARCHITECTURE §12.7.1`, dan biometrik keluar dari infrastruktur adalah pelanggaran UU PDP.

### 7.22 Kode error baru §7 — baris tambahan register §2.3

Register §2.3 terukur berhenti di **118** saat bab ini disusun (cacah baris tabel yang berformat "pipa — nomor — pipa HTTP 4xx/5xx" dengan `grep -c` = **118**). Karena itu §7 memakai **119 sampai 143**: **25 kode baru**, semuanya `spec` — tidak ada satu pun yang dikirim handler hari ini. Kedua puluh lima baris itu **sudah dimasukkan ke register §2.3** (jumlahnya kini terukur **143**, dan komposisinya bertambah satu baris penjelasan gugus §7); tabel di bawah adalah **rekap gugus** yang memantulkan baris-baris tersebut, dengan pola yang sama dipakai §4.14.6, §4.16.7, §4.17.3, §4.18.5 dan §6.10.9 — satu nomor tetap punya **satu** rumah penjelasan normatif (§2.3), sementara tabel ini menjelaskan **keadaan mana yang membedakannya dari baris yang sudah ada**. Kolom `HTTP` sengaja berada di posisi ketiga agar cacah register tidak menghitung baris tabel ini dua kali.

| Nomor | Kode | HTTP | Sebab dan keadaan yang membedaannya dari baris yang sudah ada | Status |
|---:|---|---:|---|---|
| 119 | `CROSS_MODULE_WRITE_FORBIDDEN` | 403 | Rute tulis dijalankan terhadap objek milik vonis lain, atau payload mencoba menulis kolom milik pemilik objek (`PRD §5.13.2` butir 2 dan 5). Beda dari 3 (`FORBIDDEN`): di sini **izin bisa saja ada**, yang tidak ada adalah hak menulis objek orang lain — `details.ownerModule` wajib terisi | `spec` |
| 120 | `SIGNAL_DELIVERY_UNAVAILABLE` | 503 | Permintaan memancarkan sinyal lintas modul sedangkan `outbox`/`queue_operations` belum ada (`RD-11`, `P-6`). Menolak **tanpa diam-diam menulis keadaan lokal**; baris domain tidak berubah | `spec` |
| 121 | `REALTIME_CHANNEL_UNAVAILABLE` | 503 | Kanal SSE atau WebSocket diminta sedangkan handler dan dependensinya nol (`ws`/`socket.io` 0 kemunculan). Termasuk seluruh baris `stream` §7.15 dan §7.21 | `spec` |
| 122 | `TICKET_STATE_TRANSITION_INVALID` | 409 | Transisi keadaan tiket di luar penjaga SM helpdesk. Keadaan tiket adalah enum kelas A, jadi kodenya bukan `VALIDATION_FAILED` (6): bentuk payload benar, **transisinya** yang tidak sah | `spec` |
| 123 | `PAYROLL_RUN_NOT_FINAL` | 409 | Slip/payroll diminta sebelum run `APPROVED`, atau posting diminta saat run masih `DRAFT`/`CALCULATED`. Keadaan mesin M-06, bukan gerbang periode (25) | `spec` |
| 124 | `TAX_RULE_VERSION_INACTIVE` | 422 | Run PPh 21 menunjuk `taxRuleVersion` yang tidak `ACTIVE` pada tanggal periode gaji (kelas B berversi). Beda dari 105/106: di sini **satu versi diminta secara eksplisit dan ia tidak berlaku**, bukan aturan tarif yang ambigu atau tidak menutup | `spec` |
| 125 | `SISTER_WATERMARK_REGRESSION` | 409 | Delta push membawa `watermarkBefore` lebih baru dari yang tersimpan (§12.10: watermark hanya maju atas baris sukses). Mencegah mata air kedua memundurkan titik sinkron | `spec` |
| 126 | `EXTERNAL_SOURCE_FIELD_READONLY` | 409 | Klien mengirim nilai yang hanya boleh terisi dari **respons otoritas luar** (DOI, status indexing, nomor permohonan/keputusan HKI, klasifikasi BMN nasional, ISSN, nomor sertifikat prestasi). Beda dari 6: bentuknya sah, tetapi kolomnya bukan milik pengirim | `spec` |
| 127 | `POINTS_EVIDENCE_REQUIRED` | 422 | Usulan poin SKKM tanpa bukti terverifikasi (M-24). Beda dari 117: 117 = bukti ada tetapi **tidak cukup**; 127 = **tidak ada** bukti yang dilampirkan | `spec` |
| 128 | `FIELDWORK_LOGBOOK_BACKDATED` | 422 | Entri logbook KKN/PKL mundur melewati jendela toleransi; toleransinya sendiri adalah parameter berversi, bukan angka di kode | `spec` |
| 129 | `CONSENT_MISSING` | 403 | Aksi menuntut consent yang **belum pernah** diberikan (lamaran M-28, tindakan M-41, pesan pemasaran M-45). Beda dari 3: hak peran sudah ada, yang belum ada adalah **izin subjek data** | `spec` |
| 130 | `CONSENT_WITHDRAWN` | 409 | Consent pernah ada lalu **ditarik**; penolakan berlaku ke depan dan tidak menghapus rekaman historis. Konsent yang ditarik **mengalahkan** nilai parameter (§7.17) | `spec` |
| 131 | `MOBILITY_DOCUMENT_EXPIRED` | 422 | Dokumen izin tinggal/paspor kedaluwarsa sebelum keberangkatan mobilitas. Nomor dokumennya sendiri tidak pernah ikut dibaca maupun di-log (§7.9) | `spec` |
| 132 | `SPECIAL_PII_ACCESS_DENIED` | 403 | Permintaan **isi** kelas data khusus UU PDP (kasus M-36, rekam medis dan catatan konseling M-41) oleh peran yang tidak berhak — termasuk `TENANT_ADMIN` untuk kasus PPKS (vonis 14). Berbeda dari 3 karena permintaannya **wajib dicatat** di access-log dan kodenya menunjuk kelas data, bukan tabel izin | `spec` |
| 133 | `ENVELOPE_ENCRYPTION_UNAVAILABLE` | 503 | Rute yang menulis/membaca plaintext terenkripsi beramplop (DEK AES-256-GCM + kunci HMAC blind index) ketika `TENANT_ENCRYPTION_MASTER_KEY` belum tersedia (`ENV_CONTRACT §6.3`). **Menolak menulis teks polos**, bukan degradasi senyap | `spec` |
| 134 | `FINE_CAP_REACHED` | 409 | Perhitungan ulang denda pustaka melewati plafon per eksemplar (`library.fine_per_day_idr` + `max_value` plafon). Menahan akumulasi tak-berbatas, bukan menolak permintaan | `spec` |
| 135 | `ASSET_ACQUISITION_IMMUTABLE` | 409 | Klien mencoba mengirim `acquisitionRupiah`/`acquisitionDate`/`bookValueRupiah` padahal aset lahir dari penerimaan M-46 (vonis 6, `ARCHITECTURE §13.3` zero re-entry) | `spec` |
| 136 | `DEPRECIATION_PERIOD_ALREADY_POSTED` | 409 | Run/posting penyusutan ganda untuk pasangan `(aset, periode)`; idempoten level baris, bukan hanya level `Idempotency-Key` (46) | `spec` |
| 137 | `WALLET_NOT_ACADEMIC_RECEIVABLE` | 422 | Upaya memakai saldo dompet elektronik M-42 untuk melunasi piutang akademik M-10. Dua objek sadar dipisah (`PRD §5.12.1` baris M-42), jadi ini bukan 38 (gerbang tagihan) melainkan **salah instrumen** | `spec` |
| 138 | `ALREADY_CHECKED_IN` | 409 | Pemindaian ulang peserta yang sudah berstatus masuk di gate yang sama. Beda dari 46 (`DUPLICATE_SUBMIT`): 46 adalah replay `Idempotency-Key` satu permintaan; 138 adalah keadaan peserta yang memang sudah masuk | `spec` |
| 139 | `RESEARCH_DISBURSEMENT_STAGE_INCOMPLETE` | 409 | Pencairan tahap berikutnya ditolak karena keluaran/monev tahap berjalan belum tervalidasi (gerbang L5 M-44), bukan karena periode tertutup (25) | `spec` |
| 140 | `PROCUREMENT_HPS_EXPIRED` | 422 | Paket/penetapan memakai HPS di luar `procurement.hps_validity_days` — nilai ambang dari parameter §4.16, pelanggaran tetap punya kode sendiri | `spec` |
| 141 | `ENDOWMENT_ALLOCATION_EXCEEDS_POLICY` | 422 | Alokasi dana abadi melewati porsi imbal hasil yang diizinkan `endowment.allocation_max_pct_of_yield_bp` (kelas `REGULATORY`, plafon tidak dapat dilonggarkan melewati `max_value`) | `spec` |
| 142 | `STATUTORY_PRECONDITION_UNMET` | 422 | Syarat nasional yang ditetapkan regulasi tidak terpenuhi (kelayakan KIP-K kelas B, plafon SKS nasional). Beda dari 7 (`ACADEMIC_RULE_VIOLATION`, aturan kampus): di sini penyebabnya **regulasi negara**, sehingga uji penolakannya dapat menunjuk dasar yang benar | `spec` |
| 143 | `AWARD_SNAPSHOT_STALE` | 409 | Keputusan beasiswa/keringanan merujuk snapshot kelayakan (nilai + data ekonomi) yang sudah berubah sejak run skor selesai. Padanan non-engine dari 74 (`ENGINE_STALE_SNAPSHOT`), karena award bukan hasil `apply` engine tetapi tetap wajib reproducible | `spec` |

**Dipakai ulang dari §2.3, bukan diduplikasi** — inilah alasan sebagian besar gugus tidak menambah kode baru: 3 (`FORBIDDEN`), 5 (`NOT_FOUND`, termasuk 404 seragam §4.9), 6 (`VALIDATION_FAILED`), 9 (`RATE_LIMIT_EXCEEDED` untuk dua rute publik §7.20), 12 (`CONFLICT` untuk klaim tiket, saldo, slot, kunci unik), 16 (`ADMIN_SCOPE_MISMATCH` untuk scope `SITE` di aset/kepegawaian), 19 (`REFERENCE_IN_USE` untuk kamus/ruang/kontrak aktif), 25 (`PERIOD_CLOSED`), 26 (`MODULE_NOT_AVAILABLE` untuk seluruh prefix ber-entitlement usulan), 30 (`MBKM_SKS_CAP_EXCEEDED` untuk plafon SKS mobilitas), 38 (`GATE_BLOCKED` untuk clearance dan komitmen anggaran), 46 (`DUPLICATE_SUBMIT` untuk **setiap** tulis berbiaya), 55 (`DECISION_ALREADY_MADE`), 56 (`SELF_APPROVAL_FORBIDDEN` untuk **setiap** `VALIDATE` gugus ini), 59 (`EXPORT_LIMIT_EXCEEDED`), 60 (`OUT_OF_GEOFENCE` dan vonis `OUT_OF_FENCE` logbook), 74/75/99/105/106 (harness engine), 84 (`GPS_ACCURACY_TOO_LOW`), 90 (`AUDIT_CHAIN_COMPROMISED`), 107–112 (parameter), 111 (`PARAM_SECRET_FORBIDDEN` untuk kredensial vendor/kanal), 115–118 (menu, `route_key` modul baru), 117 (`EVIDENCE_INSUFFICIENT`).

**Syarat sebelum satu baris pun boleh di-merge** (berlaku penuh untuk 119–143, sama beratnya dengan §4.14.6 butir 1): (1) izin `resource × verb` yang dirujuk tiap baris §7 menjadi **baris ternomor** di `RBAC_MATRIX §4.5` — hari ini seluruh kode §7 adalah `usulan` dan penomoran bukan milik bab ini; (2) dipromosikan ke `PERMISSION_SPECS` (`packages/contracts/src/authz.ts`) dan `gen-rbac-seed.mjs` dijalankan ulang sehingga seed `permissions` ikut bertambah; (3) objek DB-nya punya DDL + nomor migrasi di `DATA_MODEL §22` (terukur baru **0051–0057** terbit; sisanya diminta di §7.23); (4) tiap kode punya `admin.errors.<CODE>` di `id.json` **dan** `en.json` dengan bentuk kunci identik dan pesan sebab + langkah perbaikan — namespace itu hari ini **nol** kemunculan; (5) `bullmq`/`ioredis`/`ws` menjadi dependensi nyata + lockfile dan tercatat di `TECH_CONVENTIONS §6` sebelum satu pun baris `202`/`stream`/sinyal disebut berjalan; (6) uji penolakan vonis §5.13 (butir 5 `PRD §5.13.2`) ada sebelum rute tulis digabung.

### 7.23 Rekap dan status jujur

**Jumlah baris rute per gugus (diukur dari tabel-tabel di atas pada berkas ini, bukan dari taksiran tangan).** Cara ukur yang berlaku: `node .tools/route-count.mjs` (pemindaian seluruh isi `## 7`, batas bawah ditentukan **judul** bagian, bukan posisi blok — lihat `RD-86`). Keluaran terbaru: **318** baris tabel · 133 `spec-only` · 185 `blocker` · **0** implemented · 29 gugus. Uraian lama di bawah ini dibiarkan terbaca sebagai riwayat metode, dan angkanya tidak lagi jadi rujukan. Satu baris dengan metode gabungan (mis. `GET · POST · PATCH`) dihitung **satu baris**, bukan tiga — aturan ini ditulis karena penghitung yang hanya mencocokkan sel pertama yang persis satu verba menghasilkan **208** dan bukan **267**; yang benar adalah 267 baris tabel. Daun rute sesungguhnya lebih banyak dari jumlah baris (satu baris dapat memuat tiga metode pada path berbeda), dan angka daun tidak diklaim di sini.

| Gugus | Modul | Baris | `spec-only` | `blocker` | `implemented` |
|---|---|---:|---:|---:|---:|
| §7.1 | M-04 helpdesk | 26 | 26 | 0 | 0 |
| §7.2 | M-06 HRIS dan payroll | 16 | 16 | 0 | 0 |
| §7.3 | M-08 SISTER | 12 | 12 | 0 | 0 |
| §7.4 | M-11 beasiswa | 13 | 13 | 0 | 0 |
| §7.5 | M-21 dan M-22 publikasi serta HKI | 15 | 0 | 15 | 0 |
| §7.6 | M-24 kemahasiswaan | 10 | 0 | 10 | 0 |
| §7.7 | M-25 fieldwork | 13 | 0 | 13 | 0 |
| §7.8 | M-28 career | 11 | 0 | 11 | 0 |
| §7.9 | M-29 mobilitas | 11 | 0 | 11 | 0 |
| §7.10 | M-36 PPKS | 12 | 0 | 12 | 0 |
| §7.11 | M-39 perpustakaan | 13 | 0 | 13 | 0 |
| §7.12 | M-40 aset | 12 | 0 | 12 | 0 |
| §7.13 | M-41 klinik | 13 | 0 | 13 | 0 |
| §7.14 | M-42 asrama dan kantin | 13 | 0 | 13 | 0 |
| §7.15 | M-43 humas dan event | 12 | 0 | 12 | 0 |
| §7.16 | M-44 LPPM | 14 | 0 | 14 | 0 |
| §7.17 | M-45 CRM | 13 | 0 | 13 | 0 |
| §7.18 | M-46 procurement | 13 | 0 | 13 | 0 |
| §7.19 | M-47 dana abadi | 10 | 10 | 0 | 0 |
| §7.20 | M-35 PIN dan SIVIL | 10 | 10 | 0 | 0 |
| §7.21 | M-16 dan M-17 LMS serta proctoring | 17 | 7 | 10 | 0 |
| **Total** | **21 gugus** | **267** | **82** | **185** | **0** |

**Bukti `implemented` = 0 untuk seluruh 267 baris.** `find apps/web/src/app/api/v1 -name route.ts` mengembalikan **18** berkas dan `ls apps/web/src/app/api/v1` hanya menghasilkan `academic`, `attendance`, `auth`, `health`, `tenant`. Tidak ada satu pun direktori `helpdesk`, `hr`, `sister`, `scholarship`, `publication`, `ipr`, `student-affairs`, `fieldwork`, `career`, `mobility`, `ppks`, `library`, `asset`, `clinic`, `residence`, `events`, `research`, `crm`, `procurement`, `endowment`, `credentials`, atau `admin/engine`. Jadi **nol** baris §7 yang punya handler, dan **tidak satu pun** boleh dikutip sebagai bukti fitur berjalan.

**Yang memisahkan `spec-only` dari `blocker`** (satu kalimat, supaya tidak dibaca sebagai optimisme): `spec-only` = objeknya **sudah punya DDL tertulis** di `DATA_MODEL §22` pada saat bab ini disusun, terukur nomor **0051** (M-04), **0052** (M-35), **0053** (gugus pihak ketiga silang), **0054** (M-06), **0055** (M-08), **0056** (M-11), **0057** (M-47). `blocker` = objeknya **belum bernama** di `DATA_MODEL §22` **atau** rutenya menahan dependensi yang belum ada (`bullmq`/`ioredis`/`ws`/`TENANT_ENCRYPTION_MASTER_KEY`). Bab ini **tidak** memberi nomor untuk gugus `blocker` — nomor adalah milik `DATA_MODEL §22`, dan menebaknya adalah persis pola yang dikecam `AGENTS §3.11`.

**Permintaan objek ke `DATA_MODEL §22` (14 gugus, didaftar supaya tidak hilang, bukan ditutup dengan klaim):** M-21/M-22 (jurnal, artikel, terbitan, klaim indexing, permohonan HKI, lisensi, wadah inkubasi), M-24 (kegiatan, organisasi, poin dan usulannya, sanksi, aturan SKKM), M-25 (penempatan, entri logbook bergeofence, penilaian mitra, usulan konversi), M-28 (lowongan, lamaran, profil CV dan consent, pameran kerja), M-29 (kemitraan, pertukaran, dokumen perjalanan, pemetaan ECTS, mahasiswa masuk), M-36 (laporan, kasus, timeline, perujukan, **access-log terpisah**), M-39 (katalog dan eksemplar, peminjaman, reservasi, denda, sinyal clearance), M-40 (kartu aset, riwayat penyimpanan, sensus, jadwal serta posting penyusutan, penghapusan), M-41 (rekam medis, kunjungan, janji, consent, rujukan, persediaan obat, peristiwa tertagih), M-42 (bangunan, kamar, aturan kapasitas, penugasan penghuni, **dompet sebagai objek terpisah dari piutang**), M-43 (acara, registrasi, pintu, check-in, sesi), M-44 (skema, plafon per skema, proposal, telaah buta, kontrak, monev, pencairan, luaran), M-45 (lead, pipeline, kampanye, pesan, consent, rujukan, skor prospek), M-46 (permintaan, paket, HPS, penawaran, penerimaan BAST, kontrak vendor), serta M-16/M-17 (**paket SCORM, pernyataan xAPI, sesi ujian, sinyal dan kejadian proctoring dengan `expires_at`**). Dua nama yang **sudah pasti ditolak** bentuknya: tabel jejak-per-modul (vonis 11, satu rantai per tenant) dan tabel pendamping `pmb_applications`/`assets`/`mbkm_conversions` (vonis 1, 6, 12).

**Permintaan izin ke `RBAC_MATRIX §4.5` (penomoran bukan milik bab ini):** seluruh kode `resource × verb` di §7 berstatus **`usulan`** tanpa nomor. Register §4.5 terukur berhenti di **161** ketika bab ini disusun. Keluarga yang ditagih: `helpdesk.*`, `hr.*`, `sister.*`, `scholarship.*`, `publication.*`, `iprs.*`, `kbm.*`, `fieldwork.*`, `career.*`, `mobility.*`, `ppks.*`, `library.*`, `asset.*`, `clinic.*`, `residence.*`, `event.*`, `research.*`, `crm.*`, `procurement.*`, `endowment.*`, `graduation.*` (bukan `credential.*` — namespace itu ditolak `RBAC §4.5.1`), `lms.*`, `cbt.*`. **Status 2026-10-21:** seluruh nama yang dikutip bab ini kini **terdaftar sebagai usulan** di `RBAC §4.5.6` — dibuktikan `node .tools/perm-phantom.mjs` yang mencetak `HANTU = 0`; yang belum adalah **nomor katalog dan grant peran**, dan keduanya keputusan manusia (`CRD-5`). Setiap baris wajib dinyatakan **ber-scope** (`TENANT`/`PROGRAM`/`SITE`/`SELF`) dan, untuk setiap aksi `VALIDATE` pada peran admin, **ber-MFA** — jika tidak, rutenya tidak boleh dikode (`AGENTS §3.8`). Kode engine yang dipakai ulang di §7 (`ALG-19` `pph21-bracket`, `ALG-20` `local-retrieval`, `ALG-21` `winnowing-similarity`, `ALG-22` `face-mesh-anomaly`, `ALG-23` `fin-schedule`, `ALG-24` `prob-scorer`) **juga belum punya titik aksi** — keenamnya lahir 2026-10-20 di `ARCHITECTURE §13.5.1` dan belum menjadi baris §4.5.

**Tiga dependensi yang menahan seluruh jalur `202`, `stream`, dan sinyal — dinyatakan sebagai angka, bukan sebagai niat:** `bullmq` dan `ioredis` **0** kemunculan di `package.json` akar, `apps/web`, `packages/contracts`, `packages/database`; `ws` dan `socket.io` **0**; `TENANT_ENCRYPTION_MASTER_KEY` belum ada di `apps/web/src/config/env.ts`. Karena itu **seluruh** rute engine §7 (ALG-19/20/21/22/23/24), **seluruh** endpoint sinyal (`…/clearance-signal`, `…/conversion-proposal`, `…/disbursement-requests`, `…/invoice-request`, `…/apc-request`, `…/topup-request`, `POST /procurement/receipts`, `POST /asset/registrations`), **kedua** calon WebSocket (§7.15 gate, §7.21 incident feed) dan **semua** SSE §7 menjawab `120`/`121` dan **design-only** sampai dependensinya nyata — persis pengecualian tercatat `AGENTS §3.8` (butir "pengecualian sementara") dan keputusan `P-6`/`RD-11`.

**Endpoint yang saya TOLAK buat, dan alasannya (setiap baris menunjuk satu vonis `PRD §5.13.1`; semuanya akan menjadi penulis kedua):**

| Path yang diminta bentuknya tetapi **tidak** dibuat | Vonis | Pemilik tunggal yang sebenarnya | Pengganti yang benar |
|---|---|---|---|
| `POST /helpdesk/tickets/{id}/grade-appeal` dan varian banding nilai/presensi | `PRD §5.12.1` baris M-04 dan vonis 9 | **M-18** lewat `attendance_appeals` | `POST /attendance/appeals` (§4.3.8) + `VALIDATE` pengampu kelas |
| `PUT /library/patrons/{id}/graduation-status`, `POST /ppks/cases/{id}/clear`, varian "bebas = lulus" | **3** | **M-30** `student_clearance` | `POST /library/patrons/{id}/clearance-signal` (pancar `library.loan.cleared`) + baca `GET …/clearance-state` |
| `POST /student-affairs/sanctions/{id}/academic-status` | **3** dan kolom tanggung-jawab-tunggal M-24 | **M-19/M-30** untuk keadaan akademik | Sinyal `student_affairs.points.cleared`; keadaan akademik tidak tersentuh |
| `POST /fieldwork/placements/{id}/convert` (keputusan SKS) dan `POST /mobility/exchanges/{id}/convert` | **1** | **M-38 + ALG-16** | `POST /mbkm/conversions` + `/evaluate` + dua `approve` (§4.12.1); usulan lewat `…/conversion-proposal` |
| `POST /publication/apc/pay`, `POST /webhook/apc`, `POST /library/fines/pay`, `POST /clinic/billing/pay`, `POST /scholarship/refund`, `POST /endowment/donations/{id}/receive` | **5** | **M-10** (invoice, pembayaran, VA) dan **§4.7** sebagai satu-satunya jalur masuk dana | `…/apc-request`, `…/invoice-request`, `…/disbursement-requests`, `…/topup-request` yang mengembalikan `invoiceId`/`opId` milik M-10 |
| `POST /hr/ledger`, `POST /hr/payroll-runs/{id}/journal`, `POST /research/…/journal`, `POST /asset/depreciation-postings` menulis `ledger` | **5** | **M-10** pemilik jurnal | `POST …/post` yang memanggil service M-10; `finance.ledger.insert` bukan izin gugus ini |
| `INSERT` aset dari M-46: `POST /procurement/receipts/{id}/create-asset` | **6** | **M-40** `assets` | `POST /procurement/receipts` memicu **service** M-40 (`POST /asset/registrations`); `asset.card.created` penerbitnya M-40 |
| `POST /crm/leads/{id}/application` dan `PATCH /crm/applications/{id}` | **12** | **M-09** `pmb_applications` | `POST /crm/leads/{id}/convert` yang **memanggil service PMB** dan mengembalikan `applicationId` |
| `POST /sister/lecturers/{id}/bkd`, `PATCH /publication/articles/{id}/bkd-credit`, `POST /research/outputs/{id}/bkd-points` | **7** | **M-07** perhitungan 12 sks (ALG-17) | M-07 **membaca** fakta; luaran hanya memicu `research.output.recorded` |
| `POST /lms/exam-sessions/{id}/attendance`, `POST /events/gates/{id}/attendance`, `POST /webhooks/lms/{provider}` sebagai jalur kedua | **9** | **M-18** satu vonis per `(sesi, mahasiswa)` | **Satu** jalur ingest `POST /attendance/events/lms` (§4.18.2) dan kanal webhook vendor §4.18.3 |
| `POST /lms/exam-sessions/{id}/auto-cancel`, `POST …/face-verify`, `POST …/liveness` | vonis `ARCHITECTURE §13.6` (ALG-22) + ADR-14 | keputusan **manusia** pengawas | `POST …/incidents/{id}/decision` (VALIDATE); sinyal geometri saja, tanpa biometrik |
| `POST /ppks/cases/{id}/content` untuk `TENANT_ADMIN` dan `GET /ppks/cases/{id}/content` | **14** | **M-36** dengan nol visibilitas isi | Metadata + statistik ber-k + `GET /ppks/access-logs`; isi hanya lewat peran sah dengan DEK |
| `POST /mobility/ects/mappings` yang mengubah angka ECTS mitra | vonis 10 dan `AGENTS §3.10` kelas B | kamus nasional berversi | pemetaan **label** saja; `POST /mobility/ects` tetap `GET` |
| `WS /notifications`, `WS /admin/iku/stream`, `WS /attendance/sessions/{id}/stream` | vonis `ARCHITECTURE §13.2` | SSE untuk satu-arah | `GET …/stream` bertipe `text/event-stream` (§10.6.3) atau polling ber-`pollAfterMs` |
| `GET /public/verify?studentId=` (varian berautentikasi/dapat dicari) | §4.9 (satu rumah verifikasi) | `GET /api/v1/public/verify/{digest}` | **Tidak dibuat**: daftar/pencarian publik = enumerasi; satu rute, satu amplop, satu access-log |

**Kode error baru §7 = 25 baris (119–143), nomor register terakhir yang dipakai = 143.** Register §2.3 sebelum bab ini terukur **118** baris; setelah pemindahan §7.22 jumlahnya menjadi **143**. Tidak ada nomor yang dilewatkan dan tidak ada nomor yang dipakai dua kali; 122, 126, 127, 130, 133, 135 dan 138 secara sadar dipakai **lintas-gugus** (satu keadaan, satu kode, rumah penjelasan tetap satu baris).

### 7.24 Aturan pakai untuk seluruh §7

1. **Satu objek, satu penulis.** Untuk setiap objek yang dimiliki vonis `PRD §5.13.1`, hanya modul pemilik yang punya rute tulis. Gugus lain **tidak** boleh menambah `POST`/`PATCH`/`DELETE` atas objek itu, **tidak** boleh menambah kolom yang menyalin nilainya, dan **tidak** boleh membuat tabel proyeksi yang dapat disunting. Yang tersedia bagi konsumen hanya dua bentuk: satu endpoint pemancar sinyal `POST /{objek}/{id}/signal-*` atau padanannya yang bernama (`…/clearance-signal`, `…/conversion-proposal`, `…/apc-request`, `…/invoice-request`, `…/disbursement-requests`, `…/topup-request`, `POST /procurement/receipts`), dan satu endpoint pembaca proyeksi. Pelanggarannya berkode `403 CROSS_MODULE_WRITE_FORBIDDEN` (119) dengan `details.ownerModule` terisi, dan **uji penolakannya wajib ada** dengan harapan `403` — bukan `201` (`PRD §5.13.2` butir 5).
2. **Nomor izin tidak dikarang di sini.** Setiap rute tulis menyebut `resource.verb` dan seluruhnya **`usulan`**. Pemilik nomor adalah `RBAC_MATRIX §4.5`; pemilik konstanta kode adalah `packages/contracts/src/authz.ts` (`PERMISSION_SPECS`). Sekuensinya tidak dapat dibalik: baris RBAC → promosi ke `PERMISSION_SPECS` → `gen-rbac-seed.mjs` → baru handler (`AGENTS §3.8`, `AGENTS §3.11`). Menulis rute dengan string izin yang belum menjadi baris = temuan, bukan gaya kode.
3. **Tidak ada rute yang menerima kolom `SERVER_ONLY` dari body.** Yang tertutup untuk §7: `status` dan `state` di seluruh objek (tiket, gaji, award, lead, kontrak, penerimaan, kasus, rekam medis, peminjaman, check-in), `bookValueRupiah`, `acquisitionRupiah`, `acquisitionDate`, `taxAmountRupiah`, `netSalaryRupiah`, `fineAmountRupiah`, `balance`, `convertedSks`, `bkdCredit`, `score`, `decision`, `assignedSatgasId`, `nim`, `pin`, `documentNumber`, `applicationNumber`, `doi`, `issn`, `indexingStatus`, `hkiRegistrationNumber`, `signatureDigest`, `slaDeadline`, `watermark*`, `modelVersion`, `seed`, `iterations`, `ratio`, `verdict`, `ipHash`. Klien mengirim **rujukan** (`id`, `code`, `kind`, `acceptanceId`, `runId`) — bukan **nilai**. Whitelist Zod di layer transport (L1), `FIELD_RULES` pada proyeksi server (L3), dan penegakan `AGENTS §3.10` (nol-hardcoding, nol-konstanta untuk nilai yang dapat diganti kampus) adalah tiga lapis yang semuanya harus ada dalam satu PR.
4. **`Idempotency-Key` wajib untuk setiap tulis berbiaya.** Berbiaya = menimbulkan baris keuangan, mengubah kapasitas, menerbitkan nomor, memancarkan peristiwa lintas modul, atau memicu run engine. Untuk seluruh §7 ini artinya: **semua** `POST` tanpa kecuali praktis, dan **semua** `POST …/runs`. Penyimpanan mengikuti `UNIQUE (tenant_id, kind, idempotency_key)` pada `queue_operations` (`DATA_MODEL §16.1.4`); replay kunci yang sama dengan payload berbeda → `409 DUPLICATE_SUBMIT` (46); replay dengan payload sama → hasil yang sama, bukan baris kedua.
5. **Read-your-writes selalu ke Primary.** Proyeksi yang dibaca **sesudah** tulis — saldo dompet pasca-`spend`, keadaan clearance pasca-`clearance-signal`, status konversi pasca-konversi resmi, keadaan pencairan pasca-`approve`, `queue_operations` pasca-`202`, hasil run pasca-`SUCCEEDED`, `GET /ppks/access-logs` pasca-pembukaan kasus — **WAJIB** ke Primary (`AGENTS §3.7`). Yang boleh ke Replica hanyalah pembacaan historis ber-`?at=` dan katalog kamus/parameter yang tidak bergantung pada tulis terbaru. Daftar dan layar milik sendiri (tiket, lamaran, peminjaman, kasus) ikut Primary.
6. **Antrean adalah tulang punggungnya, bukan opsi.** Semua mutasi berat berjalan sebagai intent ke `queue_operations` dengan `opId`, state `QUEUED/PROCESSING/SUCCEEDED/FAILED/EXPIRED`, baris terminal tidak pernah di-UPDATE, `attempts` + DLQ sebagai register, dan `queue_operations.kind` yang terdaftar sebagai enum kelas A — menambah nilai baru lewat `ALTER TYPE … ADD VALUE` di migrasi tersendiri, **bukan** lewat UI (`ARCHITECTURE §13.2` butir 6). Rute HTTP tidak menghitung (§3.9): ia mencatat job dan mengembalikan `202 { runId }`.
7. **Jalur real-time tidak dapat dinegosiasikan ulang di level rute.** SSE untuk semua satu-arah dengan kontrak §10.6.3 (`Last-Event-ID` 15 menit, heartbeat 15 s, plafon 2 stream/user dan 2.000 stream/tenant, degradasi wajib ke polling). WebSocket **hanya** dua baris di seluruh bab ini: §7.15 `POST`-alternatif gate M-43 dan §7.21 incident feed M-17 — keduanya **design-only** sampai `ws` nyata. **Tidak ada** keadaan yang berubah hanya karena peristiwa UI: baris DB adalah bukti, stream adalah sinyal (vonis §13.2 butir 3), dan setiap terminal `SUCCEEDED`/`verdict`/`published` wajib diikuti satu `GET` read-your-writes (butir 4). Urutan pengiriman tidak ditanggung stream; konsumen yang bergantung urutan menghitung ulang dari DB dengan `ORDER BY` deterministik (butir 5).
8. **Mesin mengusulkan, manusia menyetujui — tanpa pengecualian di §7.** Keluaran engine hanya masuk tabel `*_results` miliknya sendiri dengan `proposal_only = true`, dan resmi hanya setelah `VALIDATE` lewat **service domain yang sudah ada**. Tidak ada rute §7 yang menulis `enrollments`, `grades`, `class_schedules`, `invoices`, `ledger`, `attendances`, `student_clearance`, `pmb_applications`, maupun `mbkm_conversions` dari dalam engine. Harness lengkap di setiap run: `engine_code`, `engine_version`, `parameter_version`, `input_snapshot_hash`, `Idempotency-Key`, `budget`, `explain`, `seed`. `apply` menolak snapshot berbeda (74); data prasyarat belum ada menolak angka final (99); mode turun (`NO_PREREQ_DATA`, `PARTIAL_BUDGET_EXHAUSTED`, `NO_TARIF_DICT`, `NO_CORPUS`, `NO_BASELINE`, `SELF_COMPARISON_ONLY_BULK`, `STEMMING_OFF`, `NO_GEO_ACCURACY`, deviasi FFD terhadap batas bawah) **ditampilkan apa adanya**, bukan ditutup.
9. **Nominal tidak mengalir ke peran yang tidak berhak.** Kolom uang (`amountRupiah`, `payrollRupiah`, `royaltyRupiah`, `allocatedRupiah`, `cacRupiah`, `fineAmountRupiah`, penghasilan ortu, saldo) terbaca hanya oleh peran yang `FIELD_RULES`-nya mengizinkan (SoD BAAK/BAUK, `AGENTS §3.8`); peran lain menerima boolean tertahan/tidak **beserta sebab**, bukan jumlahnya. Peristiwa lintas modul **wajib diproyeksikan server-side** sebelum masuk stream apa pun (`ARCHITECTURE §13.1` catatan 1). Kelas data khusus (isi kasus M-36, rekam medis dan catatan konseling M-41, dokumen perjalanan M-29) memakai enkripsi beramplop dua kunci, access-log terpisah append-only, dan menolak dengan 132 **secara tercatat**, bukan senyap.
10. **Nol egress dan nol kredensial di body.** §7 tidak menambah satu pun panggilan keluar di rute HTTP: SISTER (§7.3), SIVIL (§7.20), kanal pemasaran (§7.17), dan xAPI/SCORM (§7.21) adalah **worker adapter** milik infrastruktur sendiri, dengan `credential_ref` menunjuk vault/ENV — bukan body, bukan baris parameter (`AGENTS §3.9`, `AGENTS §3.10`). CI menolak `fetch(`, `axios`, `https.request` di direktori engine; percobaan mengirim token/DSN/secret → `422 PARAM_SECRET_FORBIDDEN` (111).
11. **Zod di `packages/contracts`, satu skema untuk kedua platform.** Skema §7 tinggal di `packages/contracts` (sumber kebenaran tunggal, `AGENTS §3.3`), di-compile ke OpenAPI 3.1 dan di-generate ke Dart untuk SuperApp. **Tidak ada** `any`; `strict`, `noImplicitAny`, `strictNullChecks` tetap menyala. Aritmetika kanonik `bigint` rupiah utuh dan `numeric`/basis-poin — `float`/`double` dilarang lintas platform (ADR-5, `AGENTS §3.4`). Paritas Mobile berlaku pada **proyeksi server**: tidak ada angka akademik, vonis presensi, tarif, BKD, atau skor mesin yang dihitung di perangkat, termasuk saat SuperApp berjalan luring (`PRD §5.12.2`).
12. **i18n dan amplop respons.** Setiap kode 119–143 wajib punya `admin.errors.<CODE>` di `id.json` **dan** `en.json` dengan pesan **sebab + langkah perbaikan** (`AGENTS §3.5`) — namespace itu hari ini **nol** kemunculan, jadi keberadaannya di register §2.3 tidak menambah satu pun kunci. Seluruh list §7 memakai amplop §2.4 (satu set parameter sort/filter/paginasi) dan seluruh state machine §7 memakai kontrak tampilan §2.5 (`disabled: true` + `blockedBy[]` untuk "ada tapi terkunci").
13. **Status tidak boleh dinaikkan sendiri.** Baris §7 tetap `blocker`/`spec-only` sampai **keenam** syarat §7.22 (izin ber-nomor, promosi `PERMISSION_SPECS` + seed, DDL bernomor di `DATA_MODEL §22`, kunci, dependensi antrean, uji penolakan) terbukti dengan **perintah pengukuran**, bukan dengan PR yang menyatakan selesai. Entitlement usulan (`hris`, `sister`, `scholarship`, `publication`, `student_affairs`, `fieldwork`, `career`, `mobility`, `ppks`, `library`, `asset`, `clinic`, `residence`, `event`, `research`, `crm`, `procurement`, `endowment`) juga tidak boleh dijual sebelum modulnya punya objek nyata — `P-10`: jangan jual modul tanpa tabel. Modul non-`ACTIVE` memotong lebih dulu dari peran: `404 MODULE_NOT_AVAILABLE` (26) walau izin ada.
14. **Empat titik kegagalan RBAC diuji untuk setiap gugus §7, bukan diasumsikan aman** (`AGENTS §3.8`): izin cukup tetapi data prodi/site lain (relevan di §7.2 kepegawaian lintas `SITE`, §7.12 aset lintas lokasi, §7.11 patron lintas kampus) · izin ter-cache tetapi sudah dicabut (relevan di §7.10 akses kasus dan §7.13 rekam medis, di mana jendela baca `ppks.read_session_minutes` menutup sesi) · `tenant_id` benar tetapi periode salah (relevan di §7.4 award per periode, §7.16 pencairan bertahap, §7.14 penghunian) · filter ada di query tetapi RLS tidak aktif (CI menolak). Ditambah satu titik khusus §7: **peran benar tetapi subjek datanya bukan miliknya** — pelaporan anonim M-36, consent M-41/M-45, dompet dan lamaran scope `SELF`.

### 7.25–7.31 Penutup celah CRUD wajib per modul (audit dewan 2026-10-21) — M-05, M-07, M-20, M-23/M-30, M-27, M-31/M-32, M-33/M-34, APP

**Cara membaca kolom "Izin acuan" (ralat 2026-10-21, dan ini berlaku untuk seluruh §7).** Pemindai `node .tools/perm-phantom.mjs` membandingkan setiap kode izin yang dikutip API_SPEC dengan tiga keadaan yang berbeda dan tidak boleh dicampur: **ber-nomor** di katalog `RBAC §4.5` (titik aksi yang bisa diagran dan di-seed), **usulan** di `§4.5.4`/`§4.5.5`/`§4.5.6` (nama terdaftar, tanpa nomor dan tanpa grant), dan **hantu** (tidak pernah dinamai di mana pun). Tidak ada satu pun angka keempat itu ditulis di bab ini: jumlah masing-masing dibaca dari keluaran alat, karena dalam satu hari yang sama definisinya berubah tiga kali dan angkanya bergerak `257 → 348 → 0` tanpa satu pun kebutuhan hilang (`RD-98` slug menu berhenti dihitung sebagai kode; `RD-99` shorthand rute — satu kode penuh diikuti singkatan verba berpisahkan `·` (bentuk yang selama ini tidak diperiksa: daftar izin pada satu baris tabel) — akhirnya ikut diperiksa, sehingga kandidat naik dari 396 ke 532; `RD-99` keadaan "terdaftar" dipisahkan dari "bernomor"). Yang tersisa sebagai temuan sungguhan dan **bukan** gaya penulisan: namespace `admin.*`, `iprs.*`, `kbm.*`, `credential.*`, `hr.bkd.*` adalah salah tulis dan sudah dikoreksi menjadi `identity`/`iprs`/`kbm`/`graduation`/`hr`, serta verba `.reject`/`.export` dikembalikan ke vonis `RBAC §4.5.1`. Konsekuensinya keras dan tidak bisa dinegosiasi ulang di level rute: tidak satu pun baris di bawah boleh dikode sebelum namanya menjadi baris `§4.5.x` dengan peran sasaran yang diputus manusia (`CRD-5b`), dan **dilarang** menutup backlog itu dengan generator — generator yang sama (`crud-completer.mjs`) sudah menghasilkan pasangan izin-objek yang salah dan dibuang pada 2026-10-21 (`RD-83`); `perm-usulan.mjs` hanya boleh **memindahkan** nama yang sudah dikutip rute, tidak pernah menciptakan nama.

**Mengapa gugus ini ada.** Pemindaian `node .tools/crud-matrix.mjs` atas 48 baris registri menemukan bahwa tujuh keluarga modul **tidak punya satu baris rute pun** dan 30 modul lainnya tidak menuliskan jalan **UPDATE**/**DELETE** untuk objek induknya. Itu bukan pilihan desain: norma tulis SICA memakai transisi state untuk penghapusan, tetapi transisi itu sendiri tetap butuh baris rute yang disebut. Bagian ini menutup keduanya; status seluruh barisnya `spec-only · blocker` sampai objek `00xx` masing-masing berberkas.

#### 7.25 M-07 · BKD & Beban Kerja Dosen

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/lecturer/workload/:lecturerId` | `hr.bkd.view` | M-07 | `spec-only` · READ · belum pernah diimplementasikan |
| POST | `/lecturer/workload/:lecturerId/items` | `hr.bkd.insert` | M-07 | `spec-only` · INSERT · belum pernah diimplementasikan |
| PUT | `/admin/bkd/recap/:recapId` | `hr.bkd.update` | M-07 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| POST | `/admin/bkd/recap/:recapId/validate` | `hr.bkd.approve` | M-07 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| GET | `/admin/bkd/recap/:recapId/export` | `hr.bkd.view` | M-07 | `spec-only` · OTHER · belum pernah diimplementasikan |
| DELETE | `/lecturer/workload/:lecturerId/items/:itemId` | `hr.bkd.delete` | M-07 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.26 M-20 · Tugas Akhir, sidang & RAMA

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/thesis/projects/:projectId` | `academic.thesis.view` | M-20 | `spec-only` · READ · belum pernah diimplementasikan |
| POST | `/thesis/projects` | `academic.thesis.insert` | M-20 | `spec-only` · INSERT · belum pernah diimplementasikan |
| PUT | `/thesis/projects/:projectId` | `academic.thesis.update` | M-20 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| POST | `/thesis/defenses/:defenseId/decision` | `academic.thesis.validate` | M-20 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| POST | `/thesis/rama/deposit/:projectId` | `document.rama.submit` | M-20 | `spec-only` · OTHER · belum pernah diimplementasikan |
| DELETE | `/thesis/proposals/:proposalId` | `academic.thesis.delete` | M-20 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.27 M-23 · Wisuda & M-30 · Yudisium/SKPI/dokumen

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/graduation/candidates/:studentId` | `academic.graduation.view` | M-23·M-30 | `spec-only` · READ · belum pernah diimplementasikan |
| PUT | `/graduation/yudisium/:studentId` | `academic.graduation.update` | M-23·M-30 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| POST | `/graduation/yudisium/:studentId/decide` | `academic.graduation.validate` | M-23·M-30 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| POST | `/graduation/commencements/:batchId/register` | `academic.graduation.insert` | M-23·M-30 | `spec-only` · INSERT · belum pernah diimplementasikan — **nama jalur diralat 2026-10-21**: objeknya `commencement_batches` ([DATA_MODEL §23.4](file:///c:/SICA/docs/DATA_MODEL.md)), bukan "convocation"; pemilik nama objek adalah DATA_MODEL (`AGENTS §3.11`) |
| GET | `/documents/{docType}/:docId` | `document.verification.view` | M-23·M-30 | `spec-only` · READ · belum pernah diimplementasikan |
| PUT | `/documents/skpi/:studentId` | `document.skpi.update` | M-23·M-30 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| DELETE | `/documents/:docId/void` | `document.record.delete` | M-23·M-30 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.28 M-27 · Tracer study & Portal alumni

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/alumni/profiles/:graduateId` | `career.alumni.view` | M-27 | `spec-only` · READ · belum pernah diimplementasikan |
| POST | `/alumni/tracer-surveys/:waveId/responses` | `career.tracer.insert` | M-27 | `spec-only` · INSERT · belum pernah diimplementasikan |
| PUT | `/alumni/profiles/:graduateId` | `career.alumni.update` | M-27 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| POST | `/alumni/competency-standards/:standardId/approve` | `career.competency.validate` | M-27 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| DELETE | `/alumni/contacts/:contactId` | `career.alumni.delete` | M-27 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.29 M-05 · Audit trail & M-31/M-32 · Akreditasi dan IKU

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/admin/audit-events/:eventId` | `audit.event.view` | M-05·M-31·M-32 | `spec-only` · sudah ada — tidak menambah izin · belum pernah diimplementasikan |
| POST | `/admin/audit/partitions/:partition/seal` | `audit.chain.validate` | M-05·M-31·M-32 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| GET | `/quality/indicator-sources/:indicatorCode` | `audit.quality.view` | M-05·M-31·M-32 | `spec-only` · READ · belum pernah diimplementasikan |
| PUT | `/quality/indicator-sources/:indicatorCode/mapping` | `audit.quality.update` | M-05·M-31·M-32 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| POST | `/admin/lkps/submissions/:submissionId/validate` | `audit.lkps.validate` | M-05·M-31·M-32 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| DELETE | `/quality/indicator-sources/:indicatorCode/mapping/:itemId` | `audit.quality.delete` | M-05·M-31·M-32 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.30 M-33 · Jadwal darurat & M-34 · Feeder PDDikti (sisi tulis)

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| POST | `/ops/emergency-reschedules` | `teaching.schedule.insert` | M-33·M-34 | `spec-only` · INSERT · belum pernah diimplementasikan |
| PUT | `/ops/emergency-reschedules/:rescheduleId` | `teaching.schedule.update` | M-33·M-34 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| GET | `/ops/emergency-reschedules/:rescheduleId` | `teaching.schedule.view` | M-33·M-34 | `spec-only` · READ · belum pernah diimplementasikan |
| POST | `/feeder/checkpoints/:checkpointId/publish` | `feeder_pddikti.checkpoint.validate` | M-33·M-34 | `spec-only` · VALIDATE · belum pernah diimplementasikan |
| PUT | `/admin/feeder/mappings/:mappingId` | `feeder_pddikti.mapping.update` | M-33·M-34 | `spec-only` · UPDATE · belum pernah diimplementasikan |
| DELETE | `/ops/emergency-reschedules/:rescheduleId` | `teaching.schedule.delete` | M-33·M-34 | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.31 APP · SuperApp Mobile (sinkronisasi & perangkat)

| METHOD | Jalur | Izin acuan | Modul | Status |
|---|---|---|---|---|
| GET | `/mobile/sync/delta` | `enrollment.krs.view` | APP | `spec-only` · sudah ada — read model sync · belum pernah diimplementasikan |
| POST | `/mobile/devices/register` | `identity.device.insert` | APP | `spec-only` · INSERT · belum pernah diimplementasikan |
| PUT | `/mobile/devices/:deviceId` | `identity.device.update` | APP | `spec-only` · UPDATE · belum pernah diimplementasikan |
| GET | `/mobile/push-token/:userId/state` | `identity.notification.view` | APP | `spec-only` · READ · belum pernah diimplementasikan |
| DELETE | `/mobile/devices/:deviceId` | `identity.device.delete` | APP | `spec-only` · DELETE · belum pernah diimplementasikan |

#### 7.32 Pelengkap CRUD yang MASIH BOLONG — dinyatakan sebagai tagihan, bukan diisi otomatis

**Kenapa bagian ini kosong dan itu disengaja.** Percobaan pertama mengisi kekosongan ini dengan generator (`.tools/crud-completer.mjs`) menghasilkan 321 baris rute dan 204 izin "baru" dalam satu detik. Ketika keluarannya dibaca — bukan dipercaya — generator itu terbukti **memasangkan izin dengan objek yang salah**: izin `helpdesk.impact` dengan aksi `update` ditempel ke `/helpdesk/sla-policies/:id`, izin payroll lama ber-verba `UPDATE` (nama itu kini dipensiunkan di `RBAC §4.5.9`) ditempel ke `/admin/engine/pph21-bracket/runs/:id`, dan `DELETE /helpdesk/tickets/:id` tercetak dua kali. Angka besar yang salah lebih berbahaya daripada lubang yang ditandai, karena yang pertama terbaca seperti selesai. Seluruh keluaran generator itu **dihapus** pada 2026-10-21 dan kebutuhan yang sebenarnya didaftarkan sebagai tiket di `ROADMAP §2.22` (`CRD-1`…`CRD-4`) dengan pemilik dokumen yang jelas.

**Kebutuhan terukur yang tersisa (dari `node .tools/crud-matrix.mjs`).**

| Kebutuhan | Jumlah modul | Rumah yang berhak | Tiket |
|---|---:|---|---|
| jalur UPDATE (`PUT`/`PATCH`) untuk objek induk belum ditulis | 30 | `API_SPEC §7` per modul + izin di `RBAC §4.5` | `CRD-1` |
| jalur transisi berhenti (soft-delete/`void`/`withdrawn`) belum ditulis per modul | 35 | `API_SPEC §7` + norma `BR-G1` di `DATA_MODEL` | `CRD-2` |
| keluarga yang baru punya baris sejak §7.25 (M-05, M-07, M-20, M-23/M-30, M-27, M-31/M-32, M-33/M-34, APP) belum punya DDL milik sendiri | 8 | `DATA_MODEL §22` (pemilik nama objek) | `CRD-3` |
| kode `career.*` **tidak** menuntut nilai baru — kolom `Modul`-nya sudah benar `academic` mengikuti baris 257–260; yang menuntut penjagaan justru kebalikannya: jangan pernah menulis `career` ke kolom `Modul` | 1 penjaga | `.tools/rbac-module-union.mjs` + `authz.ts` (13 nilai) | `CRD-4` |
| kode izin dikutip API_SPEC tetapi **tidak pernah** dinamai RBAC/authz (terukur `node .tools/perm-phantom.mjs`; 250 sebelum §7.33, **257** sesudahnya) | 257 kode | `RBAC_MATRIX §4.5` adalah pemilik nama & nomor; API_SPEC hanya memakai | `CRD-5` |
| nama objek jalur wisuda sempat salah (`convocations` vs `commencement_batches`) dan `documents` sempat terdaftar di dua berkas migrasi | 2 ralat | `DATA_MODEL §23` + `MIGRATION_SOP §5/§6` | ditutup 2026-10-21 |

**Ralat 2026-10-21 (diri sendiri).** Baris keempat tabel di atas semula saya tulis sebagai "`career.*` menuntut satu nilai `PermissionModule` baru". Itu **salah**: `RBAC_MATRIX` baris 257–260 sudah memakai kode `career.*` dengan kolom `Modul = academic`, dan itulah norma yang benar (nama resource bebas, Modul terbatas 13 nilai). Saya menuliskan klaim itu tanpa membuka `authz.ts` lebih dulu — persis kelas kesalahan `RD-61`. Yang benar adalah sebaliknya: yang perlu dijaga adalah **jangan** mengisi kolom `Modul` dengan nama resource.

**Larangan untuk tiket ini.** Baris rute tidak boleh ditulis dengan menebak nama izin dari pola string; satu baris rute = satu objek yang namanya sudah dimiliki `DATA_MODEL` + satu kode izin yang sudah ada di katalog ATAU naik sebagai baris `§4.5.x` dengan peran sasaran yang diputus manusia. Melanggar aturan ini adalah `RD-73`/`RD-83`, dan generator yang mengulanginya harus dibuang, bukan dibenahi dengan prompt.

#### 7.33 Peta sebaran sesi, jaminan sosial, dan EWMP — `spec-only`, izin = **usulan nama** (`RBAC §4.5.4`)

**Cara membaca tabel ini.** Kolom "Izin acuan" di bawah memuat nama yang **belum punya baris katalog** (terukur `node .tools/perm-phantom.mjs`; gugus ini masuk hitungan 250). Nama itu usulan `§4.5.4`, bukan izin. Tidak satu pun baris boleh dikode sebelum menjadi baris `§4.5` ber-nomor + promosi `PERMISSION_SPECS` + seed (`CRD-5`). Kode error yang dipakai adalah **yang sudah ada** di register §2.3 (149 baris); bagian ini **tidak** menambah nomor error baru.

| METHOD | Jalur | Izin acuan (usulan) | Status |
|---|---|---|---|
| GET | `/admin/session-map/buckets` | `attendance.summary.view` (izin sumber — **bukan** izin `analytics.*`) | `spec-only` · READ · sumber = view `session_geo_live_buckets` (`0078`) · hanya agregat menit×kota · `degraded` wajib saat GeoIP/Redis tidak tersedia · vonis `RBAC §4.5.1`: read-model `analytics` tidak dijual dan tidak punya izin sendiri, jadi gerbangnya READ milik `attendance` dengan scope `RECTOR`/`TENANT_ADMIN` |
| GET | `/admin/session-map/stream` (SSE) | `attendance.summary.view` (izin sumber) | `spec-only` · READ (stream = baca berkelanjutan, bukan aksi tulis) · kontrak §10.6.3: `Last-Event-ID` 15 m, heartbeat 15 s, plafon 2/300 per-user/tenant, degradasi polling 30 s · **bukan** WebSocket ketiga |
| POST | `/admin/session-map/consent` | `identity.profile.update` (sudah ada) | `spec-only` · UPDATE · consent `CLIENT_GEO` per subjek; pencabutan berhenti mencatat observasi berikutnya (`BR-G11`) |
| GET | `/hris/staff/:staffId/insurance` | `hris.insurance.view` | `spec-only` · READ · nomor peserta terproyeksi 4 digit terakhir |
| POST | `/hris/staff/:staffId/insurance` | `hris.insurance.insert` | `spec-only` · INSERT · `Idempotency-Key` wajib; tarif dari data berversi, ditolak bila tanpa `effectiveFrom` (`BR-G13`) |
| PUT | `/hris/insurance/participations/:participationId` | `hris.insurance.update` | `spec-only` · UPDATE · `expectedVersion`/`If-Match`; `member_number` **SERVER_ONLY** (tidak pernah dari body) |
| POST | `/hris/insurance/contributions/:contributionId/remit` | `hris.insurance.validate` | `spec-only` · VALIDATE · MFA + `approved_by <> requested_by`; `voucher_number` wajib sebelum state `REMITTED`; berkas bukti lewat `attachments` (`0020`) |
| POST | `/hris/insurance/periods/:periodMonth/reconcile` | `hris.insurance.reconcile` | `spec-only` · OTHER · intent ke `queue_operations` (`0030`), balas `202 { runId }`; koreksi = baris baru berantai, bukan `UPDATE` |
| POST | `/admin/sister/ewmp/batches` | `sister.ewmp.push` | `spec-only` · INSERT · payload hanya `{ staffRef, digest }`; muatan `[VERIFIKASI-VENDOR]` — rute menolak bila skema belum terverifikasi (`38 GATE_BLOCKED` dengan sebab), bukan mengirim tebakan |
| GET | `/admin/sister/ewmp/batches/:batchId` | `sister.ewmp.view` | `spec-only` · READ · state antrean + `failed_reason`; read-your-writes ke Primary |

**Penolakan yang wajib diuji.** `403` saat peran di bawah `RECTOR`/`TENANT_ADMIN` meminta bucket peta; `403` saat peran akademik membaca nominal iuran (`FIELD_RULES`, bukan filter UI); `429` saat plafon stream terlampaui (9); `422 VALIDATION_FAILED` (6) saat klien mengirim titik koordinat sintetis; `409 GATE_BLOCKED` (38) saat `EWMP` belum tervalidasi atau `0028` belum terbit sementara tarif diminta; `404 MODULE_NOT_AVAILABLE` (26) saat entitlement `hris`/`sister` non-`ACTIVE` walau izin ada. Empat titik kegagalan RBAC (`AGENTS §3.8`) diuji untuk gugus ini, dengan titik kelima yang khas: **peran benar tetapi datanya lintas tenant** (peta adalah tempat paling mudah membocorkan agregat).

#### 7.34 Dashboard analitik lokal (ALG-25) — `spec-only`, izin = **usulan nama** (`RBAC §4.5.4`/`§4.5.5`)

| METHOD | Jalur | Izin acuan (usulan) | Status |
|---|---|---|---|
| GET | `/admin/anomaly/findings` | `settings.anomaly.view` | `spec-only` · READ · filter `domain`/`severity`/`agreement`/`?at=`; proyeksi **tanpa** PII mentah; read-your-writes ke Primary setelah run |
| GET | `/admin/anomaly/findings/:findingId/explain` | `settings.anomaly.view` | `spec-only` · READ · `explain` + `model_version` + `parameter_version` + `degraded_mode` |
| POST | `/admin/anomaly/runs` | `settings.anomaly.run` | `spec-only` · OTHER · body hanya `{domain, periodId?, budget?}` + `Idempotency-Key`; balas **`202 { runId }`**; tidak menghitung di handler |
| POST | `/admin/anomaly/findings/:findingId/label` | `attendance.anomaly.review` / `finance.anomaly.review` | `spec-only` · UPDATE · verdict manusia; `reason` 10–1000; satu verdict per pemeriksa |
| PUT | `/admin/anomaly/domains/:domain` | `settings.anomaly.toggle` | `spec-only` · UPDATE · inilah `TOGGLE_ACTIVE`: `is_active` + `contamination_bp` + `minScoreBp` dengan `expectedVersion`; `approvedBy` **SERVER_ONLY** |
| GET | `/dashboard/insights/anomaly-cards` | `settings.anomaly.view` | `spec-only` · READ · kartu per peran (Rektorat agregat; BAAK `ATTENDANCE`; BAUK `FINANCE`); **tidak** mengembalikan temuan untuk peran mahasiswa/dosen atas orang lain |

**Penolakan yang wajib diuji.** `422 VALIDATION_FAILED` (6) bila klien mengirim `ifScore`/`lofScore`/`explain` dari perangkat (semuanya `SERVER_ONLY`); `409 CONFLICT` (12) saat `expectedVersion` basi; `403 FORBIDDEN` (3) saat peran akademik mencoba membaca temuan `FINANCE` dan sebaliknya (SoD, bukan filter UI); `429 RATE_LIMIT_EXCEEDED` (9) untuk `POST /runs` yang melebihi jatah tenant; `409 GATE_BLOCKED` (38) saat domain `is_active=false` atau `NO_PREREQ_DATA` belum selesai; `404 MODULE_NOT_AVAILABLE` (26) untuk tenant tanpa entitlement modul pemilik domain. Angka parsial **tidak pernah** dijawab `200` dengan `degraded` disembunyikan (`BR-AI-3`).
