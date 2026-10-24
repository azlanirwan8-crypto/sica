# SICA Bug Resolution, Root-Cause Analysis (RCA) & Log Sanitization SOP
**Status:** Mandatory Engineering Standard  
**Audience:** Software Engineers, AI Coding Agents, SRE & DevOps Team  
**Objective:** Standar baku resolusi bug, analisis akar masalah (RCA), dan pencegahan kebocoran data sensitif (PII/Security Credentials)  

---

## 1. SOP Alur Kerja Perbaikan Bug untuk AI Agent & Engineer

Setiap agen AI atau engineer yang menangani tiket *incident report* atau kegagalan sistem wajib mengikuti 5 langkah berurutan di bawah ini. Penyelesaian pintas (*quick-and-dirty hack*) yang melanggar arsitektur dasar akan ditolak otomatis oleh review pipeline.

```
[1. Analisis Log Terstruktur] 
           │
           ▼
[2. Lokalisasi Akar Masalah (RCA)] 
           │
           ▼
[3. Pembuatan Regression Test (Red)] 
           │
           ▼
[4. Implementasi Perbaikan Minimal (Green)] 
           │
           ▼
[5. Audit Dampak & Sanitasi Dokumen]
```

### 1.1 Larangan Keras (Strict Constraints)
- **Insiden admin tidak diselesaikan dengan memperluas peran.** Bedakan lisensi platform, release flag, preferensi tenant, permission, scope, state, dan RLS. Admin IT yang tidak dapat menyetujui KRS/nilai/pembayaran bukan otomatis bug; uji peran operasional yang memang berhak.
- **Bekukan perubahan bila audit tidak cocok.** `HASH_MISMATCH` atau celah rantai ditriase terhadap stream/tenant asli dan jangkar tepercaya; jangan menghitung ulang hash agar terlihat hijau. Keberhasilan fixture verifier baru tidak memverifikasi tenant lama.
- **Pemulihan harus terbatas tenant dan berizin.** Backup/restore melalui dry-run terisolasi, approval, quiesce, rekonsiliasi FK/audit/outbox dan catatan hasil. Tidak memakai `FLUSHALL`, purge antrean global, SQL bebas, atau cleanup akun berdasarkan prefix sebagai jalan pintas. Penolakan hanya `NODE_ENV=production` tidak membuktikan lingkungan aman.
- **Bukti harus lengkap.** Simpan exit code asli, perintah, revision, lingkungan dan artefak tersanitasi; rerun hijau tidak menutup kegagalan fluktuatif tanpa RCA. Log admin tidak menampilkan kredensial, payload dokumen, NIK, isi DSAR atau koordinat individu di telemetry umum.
- **Dilarang memotong/bypass PostgreSQL Row-Level Security (RLS)** untuk menyelesaikan kendala data tidak tampil. Jika data tidak muncul, periksa sesi `app.current_tenant` dan *tenant isolation claim* pada token JWT.
- **Dilarang melakukan koreksi saldo atau data tagihan langsung pada tabel snapshot/summary.** Koreksi keuangan WAJIB berupa penambahan baris entri jurnal penyesuaian (*Adjustment Journal Entry*) pada *Double-Entry Ledger*.
- **Dilarang mengubah kontrak public API yang sudah rilis** tanpa mekanisme *backward compatibility* dan *deprecation warning header*.

---

## 2. Format Pelaporan Log Standar

Untuk mempercepat debugging secara deterministik, seluruh pelaporan log issue wajib mematuhi format terstruktur JSON berikut.

### 2.1 Format Log Server (Next.js / Node.js Backend Trace via Pino)

```json
{
  "level": "error",
  "time": "2026-10-18T08:20:15.892Z",
  "pid": 1042,
  "hostname": "sica-web-core-prod-01",
  "reqId": "req_019183ab-45cd-7def-89ab-0123456789ab",
  "tenantId": "c0182b8e-3d12-4e89-a213-911234567890",
  "userId": "usr_99887766-5544-3322-1100-aabbccddeeff",
  "role": "mahasiswa",
  "endpoint": "POST /api/v1/academic/krs/submit",
  "ip": "202.67.40.12",
  "userAgent": "SicaMobile/1.2.0 (Android 14; Pixel 8 Pro)",
  "error": {
    "name": "AcademicRuleException",
    "code": "ACADEMIC_CREDIT_QUOTA_EXCEEDED",
    "message": "Pengajuan KRS melebihi batas kuota IPK semester berjalan. Diambil: 22 SKS, Maksimal: 18 SKS.",
    "stack": "AcademicRuleException: Pengajuan KRS melebihi batas kuota...\n    at validateKrsQuota (webpack-internal:///./modules/academic/services/krs.service.ts:84:15)\n    at submitKrsHandler (webpack-internal:///./app/api/v1/academic/krs/submit/route.ts:42:26)"
  },
  "context": {
    "academicPeriodId": "prd_2026_ganjil",
    "requestedCredits": 22,
    "maxAllowedCredits": 18,
    "previousGpa": 2.45
  }
}
```

### 2.2 Format Log Client Mobile (Flutter Logcat / Sentry Crashlytics)

```json
{
  "timestamp": "2026-10-18T08:20:15.910Z",
  "platform": "flutter_android",
  "app_version": "1.2.0+14",
  "device": {
    "brand": "Google",
    "model": "Pixel 8 Pro",
    "os_version": "Android 14 (API 34)",
    "is_rooted": false
  },
  "session": {
    "tenant_id": "c0182b8e-3d12-4e89-a213-911234567890",
    "network_status": "wifi_connected",
    "correlation_id": "req_019183ab-45cd-7def-89ab-0123456789ab"
  },
  "breadcrumbs": [
    { "category": "navigation", "message": "Navigated to /academic/krs/form" },
    { "category": "ui_click", "message": "Button Tap: #btn-submit-krs" },
    { "category": "http_request", "message": "POST https://api.sica.ac.id/api/v1/academic/krs/submit" }
  ],
  "exception": {
    "type": "DioException [bad response: 422]",
    "message": "VALIDATION_FAILED: Pengajuan KRS melebihi batas kuota IPK.",
    "stackTrace": "package:sica_mobile/features/krs/data/krs_repository.dart 64:9\npackage:sica_mobile/features/krs/presentation/krs_notifier.dart 112:13"
  }
}
```

---

## 3. Kebijakan Sanitasi Log & Privasi Data (Data Redaction Policy)

Sistem pencatatan log (Pino, Console, Sentry, CloudWatch) harus bersih dari informasi kredensial keamanan dan Data Pribadi Sensitif (*Personally Identifiable Information - PII*) mahasiswa sesuai amanat UU Perlindungan Data Pribadi (UU PDP No. 27/2022).

### 3.1 Daftar Kata Kunci Terlarang (Blacklist Keys)

Setiap nilai dari key berikut WAJIB disamarkan (*redacted*) menjadi `[REDACTED]` secara otomatis sebelum ditulis ke media log:

| Kategori Data | Key Terlarang | Masking / Redaction Rule |
| :--- | :--- | :--- |
| **Kredensial Keamanan** | `password`, `oldPassword`, `confirmPassword`, `pin` | Wajib `[REDACTED]` (100% dibuang) |
| **Token & Signature** | `authorization`, `accessToken`, `refreshToken`, `jwt`, `apiKey`, `secret` | Masking token (contoh: `eyJh...[TRUNCATED]`) |
| **Kredensial Finansial** | `bankAccount`, `cvv`, `cardNumber`, `vaNumber` | Masking digit tengah (contoh: `8801****1234`) |
| **Data Pribadi (PII)** | `nik`, `motherMaidenName`, `phoneNumber`, `email` | Masking NIK (contoh: `320101******0001`) |

### 3.2 Implementasi Serializer Redaksi Data (Pino Redact Config)

File: `packages/logger/src/index.ts`

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'refreshToken',
      '*.refreshToken',
      'nik',
      '*.nik',
      'qrPayload',
      '*.qrPayload'
    ],
    censor: '[CONFIDENTIAL_REDACTED]'
  },
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  }
});
```

---

## 4. Format Dokumen Root-Cause Analysis (RCA) Post-Mortem

Untuk setiap insiden berstatus Severity 1 (Layanan mati / kegagalan KRS massal) atau Severity 2 (Fitur utama gagal), tim insinyur wajib membuat file dokumen `docs/rca/RCA-YYYYMMDD-<issue-slug>.md` dengan struktur berikut:

```markdown
# Incident RCA Report: [Judul Insiden Singkat]
- **Tanggal Insiden:** YYYY-MM-DD
- **Durasi Downtime/Disrupsi:** XX Menit
- **Tingkat Keparahan:** Severity 1 / Severity 2
- **Lead Investigator:** [Nama Engineer / Agent ID]

### 1. Ringkasan Eksekutif
Deskripsi ringkas dalam 2-3 kalimat mengenai apa yang terjadi dan dampaknya bagi mahasiswa atau dosen.

### 2. Garis Waktu Kronologis (Timeline UTC+7)
- **08:00:** Beban transaksi KRS melonjak 5x lipat saat pembukaan jam 08.00.
- **08:05:** Latensi database PostgreSQL mencapai 12.000ms; connection pool PgBouncer habis.
- **08:12:** Tim SRE mendeteksi kueri bentrok jadwal tidak menggunakan indeks komposit.
- **08:25:** Penambahan indeks non-blocking selesai; latensi kembali normal (<100ms).

### 3. Analisis Akar Masalah (5 Whys Technique)
1. *Mengapa layanan KRS mengalami timeout?* Database gagal menyelesaikan evaluasi tabrakan jadwal antarkelas tepat waktu.
2. *Mengapa database lambat?* Terjadi Full Table Scan pada tabel `class_schedules`.
3. *Mengapa terjadi Full Table Scan?* Indeks komposit `(academic_period_id, day_of_week, start_time)` belum dibuat pada migrasi terakhir.
4. *Mengapa indeks terlewatkan?* Pengujian beban (*load testing*) sebelumnya hanya menguji endpoint login tanpa menyertakan simulasi query jadwal kelas.
5. *Akar Masalah Utama (Root Cause):* Pipeline validasi performa belum mencakup checklist indexing query rencana studi.

### 4. Tindakan Korektif & Pencegahan (Action Items)
| No | Tindakan Korektif | Penanggung Jawab | Deadline | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | Tambahkan indeks `CONCURRENTLY` pada tabel jadwal | Lead DBA | Selesai | [Done] |
| 2 | Buat automated regression test benchmark query | Backend Eng | +2 Hari | [In Progress] |
| 3 | Tambahkan skenario k6 load testing KRS massal di CI | DevOps | +1 Minggu | [Planned] |
```

---

## 5. Register RCA Audit Arsitek (2026-10-18)

RCA ringkas hasil "Full-Spectrum Audit" saat pengambilalihan proyek. Format mengikuti §4.

### RCA-AUD-04 — Suite Uji Tidak Pernah Terkumpul (Test Suite Never Compiled)
- **Ringkasan:** `academic-calculation.test.ts` & `api-security-guards.test.ts` mengimpor simbol yang tidak ada di service (`determineMaxSksByIps`, `detectScheduleConflicts`, `ScheduleItem`, field `RequestContext.userRole`/`traceId`), sehingga `tsc`/`vitest` gagal sejak tahap compile. Klaim roadmap "Coverage 95%+" menyesatkan.
- **5 Whys:** (1) test gagal → (2) API test ≠ API service → (3) service direfactor tanpa memutakhirkan test → (4) tidak ada CI yang menjalankan `tsc`/`vitest` → (5) roadmap ditandai `[x]` tanpa gerbang kualitas (DoD longgar).
- **Tindakan:**
  | No | Tindakan | PIC | Status |
  | :--: | :--- | :--- | :--: |
  | 1 | Realign seluruh impor & assertion ke API service nyata; samarkan band SKS ke BR-A2 aktual (≥3.0/2.5/2.0). | Architect | [Done] |
  | 2 | Jalankan `vitest run` → 16/16 lulus (terverifikasi). | Architect | [Done] |
  | 3 | Wajibkan `tsc --noEmit` + `vitest run` sebagai pre-merge gate di CI. | DevOps | [Planned] |

### RCA-AUD-05 — Fallback Kunci HMAC Hard-coded
- **Ringkasan:** route generate/scan memakai `|| 'sica_attendance_secure_salt_2026'` bila `ATTENDANCE_HMAC_SECRET` unset → QR dapat dipalsukan pihak yang tahu salt publik.
- **Tindakan:** hapus fallback; kedua route kini **fail-secure** (500 bila secret belum dikonfigurasi). Terverifikasi `tsc`. [Done]

### RCA-AUD-06 — Pelanggaran Strict TypeScript
- **Ringkasan:** 16×`TS4111` (dot-access index signature), `TS2698` (spread `undefined` saat env server gagal validasi), 10×`TS18048` (null-unsafe di halaman KHS), `TS6133` (unused: `validateSksQuota`, `selectedStudent`), `TS2783` (`periodId` dobel).
- **Tindakan:** semua pelanggaran non-dependensi dibersihkan; `tsc` kini **0 error** kecuali yang disebabkan instalasi dependensi belum lengkap. [Done]

### RCA-AUD-01/02/03 — Backend Mock & Auth Belum Memverifikasi JWT *(OPEN — Prioritas)*
- **Ringkasan:** route akademik/presensi/auth merupakan stub (tanpa `withTenantContext`, `Math.random()` untuk kuota, login tanpa Argon2id/JWT RS256, middleware hanya cek keberadaan cookie). **RLS tidak ditegakkan saat runtime** → melanggar Guardrail §3.2.
- **Tindakan pencegahan:** menjadi backlog Tahap 5 (lihat §6 roadmap eksekusi). [In Progress]

### RCA-AUD-07 — Dependensi Belum Ter-install *(OPEN)*
- **Ringkasan:** `lucide-react`, `class-variance-authority`, `sonner`, `clsx`, `tailwind-merge` absen di `node_modules` → 14 error `tsc` tersisa; `next build` akan gagal.
- **Tindakan:** jalankan `pnpm install` pada lingkungan pengembangan. Belum dieksekusi oleh agent (aksi berdampak luas/jaringan — perlu konfirmasi operator). [Blocked]

## 6. Klasifikasi insiden kanal vicon (audit dewan 2026-10-21)

Kanal konferensi punya bentuk kegagalan yang tidak tercakup taksonomi §1–§3: ia **aset eksternal yang tidak mengubah fakta tetapi dapat menghentikan perhitungan kehadiran**. Tabel ini mengikat gejala ke kelas, SLA, dan — yang paling penting — ke **apa yang tidak boleh terjadi selama insiden** (angka akademik ditampilkan apa adanya).

| Gejala | Kelas (`§1`) | Sevir | SLA tangani | Yang dilarang selama insiden | Tindakan penahan |
|---|---|---|---|---|---|
| Semua kanal mati saat sesi `SYNC_LIVE` berjalan | Kapasitas/layanan | **HIGH** | 30 menit | dilarang membuat sesi "hadir" tanpa bukti; dilarang menampilkan rasio parsial sebagai angka final | `BR-VIC-05`: `CHANNEL_UNAVAILABLE` di layar; vonis tertahan; notifikasi pengampu + Admin IT |
| Kredensial kedaluwarsa / `401` berulang ke Graph | Keamanan-integrasi | **HIGH** | 1 jam (rotasi) | dilarang menyimpan token di log atau mengirimnya sebagai `credential_ref` | rotasi vault; `last_probe_state = FAILED`; kanal ditarik dari rantai |
| Laporan kehadiran vendor tidak cocok dengan bukti internal | Mutu data | **MEDIUM** | 1 × 24 jam | dilarang menimpa vonis dengan laporan vendor (`§6.2 INTEGRATIONS`, vonis 4 `ARCHITECTURE §13.3`) | selisih masuk antrean telaah `NEEDS_REVIEW`; bukti ditandai `degraded` |
| Satu peserta terhitung dua identitas (upn berubah) | Mutu data/PII | **MEDIUM** | 1 × 24 jam | dilarang mencocokkan lewat pencarian nama bebas | pencocokan ulang lewat blind index salt tenant (`SECURITY §3.7.2`) |
| `payload_digest` tidak cocok / muatan ditolak | Keamanan | **HIGH** | 30 menit | dilarang memproses muatan yang gagal pembuktian meski bentuknya benar | tolak + alarm; tidak ada baris peristiwa yang ditulis |
| Ambang 75 % diubah tanpa persetujuan kedua | Tata kelola | **HIGH** (kepatuhan) | 4 jam | dilarang menerapkan versi baru ke sesi berjalan | `parameter_history` dibekukan; rollback ke `parameter_version` sebelumnya |

**Satu kalimat RCA yang wajib ada (format §4).** Untuk insiden kanal, bagian "penyebab akar" harus menyebut **salah satu** dari: konfigurasi kredensial, kontrak vendor yang berubah, kegagalan *fallback chain*, atau ketergantungan pada laporan vendor sebagai sumber tunggal. Empat hal itu adalah satu-satunya penyebab yang pernah terbukti di dokumen ini; kalau RCA menyebut "kode presensi salah", itu artinya kelas lain dan harus di-*route* ulang.

**Daftar periksa pasca-insiden.** (1) vonis akhir tidak memakai `degraded = true`; (2) `conference_channel_events` tidak mengandung PII telanjang; (3) rantai fallback yang dipakai tercatat di `last_probe_*`; (4) tidak ada baris `attendances` ganda per `(sesi, mahasiswa)` (query `(t)` `DATA_MODEL §21.10.5`).
