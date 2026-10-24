# SICA Comprehensive Testing Strategy
**Status:** Mandatory Engineering Standard  
**Target Coverage:** Minimal 80% pada Service Layer, Domain Engine, dan API Route Handlers  
**Testing Frameworks:** Vitest + React Testing Library (Web/Backend) & `flutter_test` + `mocktail` (Mobile)  

---

## 1. Piramida & Filosofi Pengujian

Sistem SICA menerapkan prinsip *Test Automation Pyramid* dengan fokus utama pada keandalan kalkulasi akademik (IPK/SKS), integritas isolasi multi-tenant (PostgreSQL Row-Level Security), dan proteksi keamanan endpoint.

```
          / \
         / E2E \         ~10% (Playwright Web & Patrol Mobile)
        /-------\
       / Integr. \       ~30% (RLS Postgres, Redis, API Handlers, Drift DB)
      /-----------\
     /  Unit Tests \     ~60% (Kalkulasi IPK/SKS, Geofencing, Zod Schemas, Blocs)
    /---------------\
```

### 1.1 Matriks Sasaran Cakupan Kode (Code Coverage Thresholds)

Batas ambang (*thresholds*) berikut adalah target kebijakan, **belum dapat diklaim ditegakkan CI**. Pada audit 2026-10-22, `.github/workflows/main-pipeline.yml` menjalankan `pnpm --filter @sica/web test --coverage` yang gagal dengan `Unknown option: 'coverage'`; `apps/web/package.json` belum memuat `@vitest/coverage-v8`, dan `apps/web/vitest.config.ts` belum menetapkan `coverage.thresholds`. Sampai perintah pipeline, provider, dan threshold dikonfigurasi serta dibuktikan hijau, angka di tabel adalah sasaran, bukan gate aktif.

| Lapisan Kode (*Layer*) | Target Min. Line Coverage | Target Min. Branch Coverage |
| :--- | :---: | :---: |
| **Academic Calculation Engine** (`services/academic-engine/*`) | **95%** | **90%** |
| **PostgreSQL RLS Policies & Database Triggers** | **90%** | **85%** |
| **API Route Handlers & Middlewares** (`app/api/*`) | **80%** | **80%** |
| **Web UI Components & State Stores** | **70%** | **65%** |
| **Flutter Features (Riverpod Notifiers & Services)** | **80%** | **75%** |

---

## 2. Testing Stack & Perkakas

### 2.1 Web & Node.js Backend Stack
- **Test Runner:** [Vitest](https://vitest.dev/) v2.0+ (Sangat cepat dengan native ESM & TypeScript support).
- **DOM & Component Testing:** `@testing-library/react` + `@testing-library/user-event` + `jsdom`.
- **Database Fixtures & Containers:** `testcontainers-node` (PostgreSQL 16 instance sementara untuk isolasi integration test RLS).
- **HTTP Mocking:** `msw` (Mock Service Worker) v2.

### 2.2 Flutter Mobile Stack
- **Unit & Widget Testing:** `flutter_test` (Bawaan Flutter SDK).
- **Mocking Library:** `mocktail` (Modern, type-safe, tanpa *code generation* `build_runner`).
- **In-Memory SQLite:** `drift` native in-memory sqlite3 untuk pengujian DAO dan offline cache repository.

---

## 3. Implementasi Kode Pengujian Konkret (Web & Backend)

### 3.1 Unit Test: Kalkulasi IPK dan Validasi Batas Kuota SKS (Vitest)
File: `apps/web/tests/unit/academic-calculation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  calculateSemesterGpa, 
  calculateCumulativeGpa, 
  determineMaxCreditsAllowed 
} from '@/modules/academic/services/gpa-calculator';

describe('Academic Calculation Engine (SK Dirjen Dikti Compliance)', () => {
  describe('calculateSemesterGpa (IPS)', () => {
    it('harus menghitung IPS secara deterministik dengan pembulatan 2 desimal half-up', () => {
      // Skenario: 3 Matakuliah
      // IF101: 3 SKS, Nilai A (4.0) -> Bobot 12.0
      // IF102: 4 SKS, Nilai B+ (3.5) -> Bobot 14.0
      // IF103: 2 SKS, Nilai C (2.0) -> Bobot 4.0
      // Total SKS = 9, Total Bobot = 30.0 -> IPS = 30 / 9 = 3.3333... -> 3.33
      const gradeRecords = [
        { courseCode: 'IF101', credits: 3, gradePoint: 4.0 },
        { courseCode: 'IF102', credits: 4, gradePoint: 3.5 },
        { courseCode: 'IF103', credits: 2, gradePoint: 2.0 },
      ];

      const result = calculateSemesterGpa(gradeRecords);
      expect(result.totalCredits).toBe(9);
      expect(result.gpa).toBe(3.33);
    });

    it('harus mengembalikan IPK 0.00 jika total SKS adalah 0 (mencegah pembagian nol)', () => {
      const result = calculateSemesterGpa([]);
      expect(result.totalCredits).toBe(0);
      expect(result.gpa).toBe(0.00);
    });
  });

  describe('determineMaxCreditsAllowed (Aturan Kuota SKS KRS)', () => {
    it('harus memberikan batas maksimal 24 SKS untuk IPS >= 3.00', () => {
      expect(determineMaxCreditsAllowed(3.00)).toBe(24);
      expect(determineMaxCreditsAllowed(3.75)).toBe(24);
      expect(determineMaxCreditsAllowed(4.00)).toBe(24);
    });

    it('harus memberikan batas maksimal 21 SKS untuk 2.50 <= IPS < 3.00', () => {
      expect(determineMaxCreditsAllowed(2.50)).toBe(21);
      expect(determineMaxCreditsAllowed(2.99)).toBe(21);
    });

    it('harus memberikan batas maksimal 18 SKS untuk 2.00 <= IPS < 2.50', () => {
      expect(determineMaxCreditsAllowed(2.00)).toBe(18);
      expect(determineMaxCreditsAllowed(2.49)).toBe(18);
    });

    it('harus membatasi maksimal 15 SKS jika IPS < 2.00 (Masa Peringatan Akademik)', () => {
      expect(determineMaxCreditsAllowed(1.99)).toBe(15);
      expect(determineMaxCreditsAllowed(1.20)).toBe(15);
      expect(determineMaxCreditsAllowed(0.00)).toBe(15);
    });
  });
});
```

---

### 3.2 Integration Test: PostgreSQL Row-Level Security (RLS) Tenant Isolation

Assertion isolasi RLS harus menyentuh PostgreSQL sungguhan melalui `SET LOCAL ROLE sica_app`, dengan role bukan superuser serta `NOBYPASSRLS`; **bukan seluruh harness berjalan sebagai `sica_app`**. Wajib gunakan **database uji terisolasi dan sekali pakai (disposable)**, bukan produksi. Database bersama tidak boleh dipakai tanpa izin eksplisit pemilik lingkungan, snapshot sebelum run dan persetujuan dampak fixture/cleanup. Harness berjalan eksplisit, bukan bagian dari unit suite yang dapat terlihat hijau saat database tidak tersedia:

```powershell
$env:TEST_DATABASE_URL = "postgresql://<user>:<password>@localhost:5432/sica_test"
pnpm --filter @sica/database db:test:rls
```

**Prasyarat bukan hanya `0001`.** Perintah menjalankan `packages/database/scripts/test-rls.ts` (bukan `.mjs`). Pemeriksaan awal registry menyebut `0001_init_rls_policies.sql`, tetapi seluruh migrasi prasyarat skema, partisi dan seed katalog wajib sudah diterapkan: gugus `0012` audit/outbox/idempotensi/login events (baris 158–176), R-2 `0007/0010/0047/0048/0049/0050` (235–247), RBAC `0011/0085`, serta migrasi lanjutan yang dipakai assertion, termasuk `0082`, perbaikan CHECK `0086`, policy katalog `0087`, dan tata kelola parameter `0088/0090` (533–538). Daftar gugus ini bukan pengganti seluruh rantai dependensi migrasi. Lulus pemeriksaan awal `0001` tidak membuktikan kesiapan keseluruhan harness.

**Pisahkan kewenangan assertion dari fixture/cleanup.** `TEST_DATABASE_URL` adalah koneksi langsung berprivilege untuk membuat fixture, mengakses katalog dan membersihkannya, serta harus dapat beralih ke `sica_app` dalam transaksi assertion. Isolasi baca/default-deny/insert lintas-tenant, RLS, grant dan CHECK diuji melalui role aplikasi; probe append-only sebagai owner berjalan terpisah (`rejectedAsOwner`, baris 624–649). Cleanup (715–723) menjalankan `DISABLE TRIGGER` pada `trg_ca_hist_immutable` dan `trg_sysparam_hist_immutable`, menghapus tenant fixture, lalu mencoba `ENABLE TRIGGER` kembali. Ini mutasi berprivilege, **bukan operasi read-only atau bukti bahwa role aplikasi boleh melepas kontrol**; blok `finally` bukan jaminan pemulihan bila proses terputus. Izin pada database bersama harus mencakup perubahan trigger tingkat tabel dan pemulihannya, bukan hanya hak insert/delete fixture.

Tanpa `TEST_DATABASE_URL`, dengan prasyarat belum lengkap, atau bila `sica_app` melewati RLS, run gagal dan bukan status lulus. Sinkronisasi docs-only ini hanya membaca harness; tidak menjalankannya maupun melakukan cleanup.

### 3.2.1 Realita kode uji & pemetaan AC → berkas (diralat 2026-10-22)
Dasar: [AUDIT_READINESS.md `RD-23`](file:///c:/SICA/docs/AUDIT_READINESS.md). Contoh di §3.1 adalah **ilustrasi target**, bukan kode yang bisa disalin: ia mengimpor `@/modules/academic/services/gpa-calculator` dengan simbol `calculateSemesterGpa`/`calculateCumulativeGpa`/`determineMaxCreditsAllowed` yang **tidak ada**. Harness RLS nyata berada di `packages/database/scripts/test-rls.ts`; skrip lama di `apps/web/tests/integration/tenant-rls.test.ts` yang hanya memfilter array in-memory telah dihapus. Uji RLS nyata **belum lulus** sampai perintah §3.2 dijalankan terhadap PostgreSQL.

**Nama nyata yang harus dipakai penulis test:**

| Yang dimaksud dokumen | Simbol nyata | Lokasi |
|---|---|---|
| Hitung IPS | `calculateIps(...)` | [gpa-calculator.service.ts:143](file:///c:/SICA/apps/web/src/modules/academic/services/gpa-calculator.service.ts#L143) |
| Hitung IPK | `calculateIpk(...)` | [gpa-calculator.service.ts:208](file:///c:/SICA/apps/web/src/modules/academic/services/gpa-calculator.service.ts#L208) |
| Pembulatan half-up 2 desimal | `roundHalfUp(value, precision)` | [gpa-calculator.service.ts:104](file:///c:/SICA/apps/web/src/modules/academic/services/gpa-calculator.service.ts#L104) |
| Saring entri layak (nilai `K`/`E`) | `filterEligibleEntries(...)` | `gpa-calculator.service.ts:124` |
| Predikat kelulusan | `getGraduationPredicate(ipk)` | `gpa-calculator.service.ts:274` |
| Konversi skor → huruf | `resolveLetterGrade(...)` | `gpa-calculator.service.ts:304` |
| Plafon SKS per band IPS | `resolveIpsThreshold(...)`, `validateSksQuota(...)` | [sks-quota-validator.service.ts:110](file:///c:/SICA/apps/web/src/modules/academic/services/sks-quota-validator.service.ts#L110), `:156` |
| Semester berjalan / validasi batch | `calculateCurrentSemester(...)`, `validateBatchEnrollment(...)` | `sks-quota-validator.service.ts:236`, `:272` |
| Deteksi bentrok jadwal | `ConflictType = 'ROOM' \| 'LECTURER' \| 'STUDENT'`, `timeToMinutes`, `minutesToTime` | [schedule-conflict-detector.service.ts:44](file:///c:/SICA/apps/web/src/modules/academic/services/schedule-conflict-detector.service.ts#L44) |

**Inventaris uji historis 2026-10-19:** 13 berkas unit, 1 berkas integration, dan 1 berkas security; angka 128 tes adalah snapshot historis dan bukan bukti kondisi saat ini. Harness RLS sekarang berada di paket database dan memerlukan PostgreSQL eksplisit.

**Matriks AC → berkas uji baseline historis 2026-10-19.** Tanda kosong/angka di bawah merekam audit saat itu, bukan inventaris terkini atau bukti bahwa pengujian sekarang lulus/gagal. Bukti baru harus ditautkan per AC; matriks penerimaan tambahan ada di §3.4.

| AC | Skenario kunci | Berkas uji hari ini | Status |
|---|---|---|---|
| `AC-KRS-1` 🔒 | tolak KRS melebihi band/plafon | `academic-calculation.test.ts` (parsial: kuota) | ◐ |
| `AC-KRS-2` | tolak MK tanpa prasyarat lulus | — | ❌ (penegakan prasyarat juga belum ada di service — `BENCH-46`) |
| `AC-KRS-3` 🔒 | 150 request, kursi 1 → tepat 1 lolos | — | ❌ (butuh `pg`/testcontainers, `RD-11`) |
| `AC-KRS-4` / `AC-KRS-5` | gerbang tagihan; KRS terkunci pasca-submit | — | ❌ |
| `AC-NIL-1` | koreksi pasca-`LOCKED` wajib approval + alasan | — | ❌ (dan `grading.unlock` masih berverb `UPDATE` — `K-5`) |
| `AC-NIL-2` 🔒 | determinisme IPK/IPK Lulus + pengulangan dihitung sekali | `academic-calculation.test.ts` ◐ (belum dua angka `BR-G6`) | ◐ |
| `AC-NIL-3` / `AC-NIL-4` 🔒 | konversi band; bobot komposisi = 100 | ◐ (`resolveLetterGrade` teruji, komposisi belum) | ◐ |
| `AC-KEU-1` 🔒 | 3 callback → 1 baris ledger | — | ❌ |
| `AC-KEU-3` | void = reversing entry, bukan DELETE | — | ❌ |
| `AC-KEU-5` | cicilan mewarisi gerbang induk (kebijakan per-tenant) | — | ❌ |
| `AC-ADM-1` / `AC-ADM-2` | reopen butuh persetujuan kedua; impor `BLOCK` → nol tulis | — | ❌ |
| `AC-AKA-1` / `AC-AKA-2` | dispensasi beralasan; `reject` wajib `reason` | — | ❌ (`K-1`/`K-3` belum tertutup) |
| `AC-AUD-1` 🔒 | `UPDATE/DELETE audit_logs` ditolak DB | — | ❌ (butuh DB nyata) |
| `AC-FDR-1` / `AC-FDR-2` 🔒 | 11 cek di titik input | — | ❌ |
| `AC-JDW-1` / `AC-JDW-2` | bentrok ruang/dosen; constraint `EXCLUDE` | ◐ detektor (unit), ❌ constraint | ◐ |
| `AC-MIG-1` / `AC-YUD-1` 🔒 / `AC-DOC-1` | rekonsiliasi impor; gerbang kelulusan; digest QR | — | ❌ |
| `AC-PMB-1` / `AC-TRN-1` / `AC-KBM-1` | daur ulang NIM; baris transkrip persist; clearance kemahasiswaan | — | ❌ (objeknya pun belum ada) |
| RBAC (bukan AC) | resolver scope & katalog & menu | `authz-rbac-resolver` (15 kasus), `authz-catalog`, `authz-guard`, `authz-menu` | ✅ |

**Empat titik kegagalan AGENTS §3.8 wajib teruji:** izin cukup tetapi data prodi lain; izin ter-cache tetapi dicabut; tenant benar tetapi periode salah; filter query tetapi RLS tidak aktif. Status historis tidak menjadi vonis terkini. Bukti penegakan membutuhkan pengujian integrasi eksplisit terhadap PostgreSQL nyata serta cache/guard terkait; mock saja tidak menutupnya.

**Aturan penulisan test berikutnya:** (1) satu baris W-x.y di ROADMAP = minimal satu fixture hak akses (peran boleh vs peran ditolak); (2) nama file test mengikuti berkas sumber, bukan mengikuti AC; (3) ambang cakupan tidak boleh dinyatakan sebelum provider coverage terpasang di `vitest.config.ts`; (4) pengujian database dijalankan sebagai perintah integrasi eksplisit dan wajib gagal bila koneksi, migrasi, atau role tidak tersedia—tidak memakai skip untuk mengubah ketiadaan database menjadi status lulus.

---

### 3.3 Ilustrasi Security Test Stub: HTTP 401, 403, dan 422
Contoh di bawah bukan suite runnable/bukti lulus: `@/server`, token dan runner adalah stub. Target pengujian nyata mengikuti §3.4; jangan menganggap nama `apps/web/tests/security/api-security-guards.test.ts` membuktikan seluruh skenario contoh sudah diterapkan.

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { nextApiApp } from '@/server'; // Dummy/Stub Next HTTP Runner

describe('API Security Enforcement Guards', () => {
  it('harus merespons 401 UNAUTHORIZED jika header Authorization tidak disertakan', async () => {
    const res = await request(createServer(nextApiApp))
      .get('/api/v1/academic/krs/open-classes')
      .set('X-Tenant-ID', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('harus merespons 403 FORBIDDEN jika mahasiswa mencoba mengakses endpoint khusus dosen', async () => {
    const mockStudentJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.student_token_payload...';

    const res = await request(createServer(nextApiApp))
      .post('/api/v1/attendance/qr/generate')
      .set('Authorization', `Bearer ${mockStudentJwt}`)
      .set('X-Tenant-ID', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .send({ classScheduleId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('harus merespons 422 VALIDATION_FAILED jika format UUID atau payload Zod tidak valid', async () => {
    const mockLecturerJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.lecturer_token_payload...';

    const res = await request(createServer(nextApiApp))
      .post('/api/v1/attendance/qr/generate')
      .set('Authorization', `Bearer ${mockLecturerJwt}`)
      .set('X-Tenant-ID', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
      .send({
        classScheduleId: 'bukan-format-uuid-yang-benar', // Invalid UUID
        meetingNumber: 99 // Melebihi batas max(16)
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 3.4 Matriks negatif admin Fase 1 (target penerimaan)

Tabel ini adalah **kewajiban uji, bukan laporan lulus**. Gunakan izin yang sudah terdaftar di RBAC_MATRIX/katalog; izin atau rute yang belum ada tetap pending. Jalankan kombinasi entitlement × assignment aktif/expired/revoked × scope benar/salah × MFA × SoD × payload sah/rusak, tidak hanya happy-path. Buktikan respons **dan nol mutasi/PII bocor** pada penolakan.

| Skenario | Fixture dan asersi minimum |
|---|---|
| Otorisasi sebelum bentuk | Tanpa sesi + body rusak → 401; sesi tanpa hak + body rusak → 403, bukan 422. Domain modular tanpa entitlement `ACTIVE/TRIAL` → `404 MODULE_NOT_AVAILABLE` sebelum pemeriksaan izin. Baru setelah guard sah bentuk salah → 422. Empat `POST/PATCH` organisasi/prodi telah diperbaiki; regresi rute warisan tetap `RD-155`. |
| Expiry/revocation | Waktu tepat sebelum, pada dan sesudah `valid_to`/akhir entitlement sesuai kontrak; baca **Primary** pascaperubahan, termasuk koneksi baru dan cache yang telah dipanaskan. Grant/revoke/expiry/opt-out harus menginvalidasi namespace terkait; tidak menunggu TTL, tidak memengaruhi tenant lain. |
| IT ≠ operasi | Platform dan `TENANT_ADMIN` tanpa assignment operasional ditolak submit/approve KRS, tulis/koreksi nilai dan settle VA. Mahasiswa SELF, dosen/wali kelas terkait, dan pemegang izin keuangan operasional yang sah boleh hanya dalam scope/approval-nya. Dua assignment pada satu orang tidak boleh melanggar SoD. |
| Lisensi vs opt-out | Tenant boleh menonaktifkan modul berhak, tidak menerbitkan atau memperluas lisensi. Matriks ACTIVE/TRIAL vs expired/suspended/absent dan opt-out on/off menghasilkan keputusan sama di API/menu/job. Addon off menolak operasi modul, **tidak menghapus arsip**; jalur arsip yang berwenang tetap diuji. |
| Billing sendiri + IDOR | Admin IT/pemegang izin billing tenant hanya membaca tagihan **lisensi tenant sendiri**, bukan invoice kampus lain; tidak otomatis berhak settle VA mahasiswa. Mahasiswa hanya membaca tagihan dirinya. Ganti tenant/student/subscription/invoice ID di path/query/body tetap ditolak lintas subjek/tenant; proyeksi tidak membocorkan PII/secret. Platform support tanpa grant aktif ditolak. |
| Idempotensi | Key + payload sama → replay hasil sama, satu efek/ledger/audit; key sama + payload berbeda → **409**, nol efek tambahan. Uji request paralel, timeout setelah commit, restart worker dan expiry sesuai kontrak. |
| FK invoice | PostgreSQL menolak relasi invoice lintas tenant walau UUID tujuan valid, melalui FK komposit `(tenant_id, invoice_id)` ke invoice tenant yang sama; uji INSERT dan UPDATE tanpa mengandalkan filter service. |
| Empat-mata | Pemohon/penyetuju/target sama atau assignment konflik ditolak oleh guard **dan** constraint terkait; MFA sukses tidak meniadakan SoD. Penguji memakai dua identitas sah, bukan menganggap dua sesi otomatis dua orang. |
| RLS non-bypass | PostgreSQL nyata memakai `sica_app`, non-owner/non-superuser, `NOBYPASSRLS`; buktikan ENABLE + FORCE, tenant kosong deny, baca/tulis tenant lain ditolak. Filter query bukan pengganti policy; test gagal bila DB/role/migrasi tidak tersedia. |
| Infrastruktur + audit | Custom domain tanpa ownership/SSRF aman ditolak; backup tanpa approval/quiesce/reconciliation ditolak; Redis tidak menyediakan FLUSHALL dan BullMQ tidak menyediakan purge bebas. Audit hanya teredaksi, hash valid pada segmen tenant sama; fixture sintetis bukan bukti audit historis pascacleanup. |

**Batas UI:** UI KRS mock tetap `RD-154`. Menekan elemen tersembunyi atau memanggil handler secara langsung bukan audit UI end-to-end penuh; uji alur terlihat, guard API, persistence dan reload Primary secara terpisah. Lulus doc gates membuktikan konsistensi yang diperiksa gate, **bukan** kepatuhan hukum atau seluruh fitur.

---

## 4. Implementasi Kode Pengujian Konkret (Flutter Mobile)

### 4.1 Unit Test: State Notifier Presensi QR & Validasi Geofencing (flutter_test)
File: `apps/mobile/test/features/attendance/attendance_notifier_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:sica_mobile/features/attendance/presentation/controllers/attendance_notifier.dart';
import 'package:sica_mobile/features/attendance/data/attendance_repository.dart';
import 'package:sica_mobile/features/attendance/domain/attendance_session_model.dart';
import 'package:sica_mobile/core/errors/exceptions.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}

void main() {
  late MockAttendanceRepository mockRepository;
  late AttendanceNotifier notifier;

  setUp(() {
    mockRepository = MockAttendanceRepository();
    notifier = AttendanceNotifier(repository: mockRepository);
  });

  group('AttendanceNotifier QR Submission Tests', () {
    const testSessionId = '019183ab-45cd-7def-89ab-0123456789ab';
    const testQrToken = 'jwe_signed_payload_string_sample';
    const validLat = -6.914744;
    const validLng = 107.609810;

    test('Harus memancarkan status Sukses ketika presensi memenuhi syarat lokasi & token', () async {
      // Arrange
      final mockSuccessResult = AttendanceRecord(
        id: 'rec_123',
        status: AttendanceStatus.present,
        timestamp: DateTime.now(),
        distanceMeters: 14.5,
      );

      when(() => mockRepository.submitAttendance(
            sessionId: any(named: 'sessionId'),
            qrPayload: any(named: 'qrPayload'),
            latitude: any(named: 'latitude'),
            longitude: any(named: 'longitude'),
            accuracyMeters: any(named: 'accuracyMeters'),
          )).thenAnswer((_) async => mockSuccessResult);

      // Act
      await notifier.processQrScan(
        sessionId: testSessionId,
        qrPayload: testQrToken,
        latitude: validLat,
        longitude: validLng,
        accuracyMeters: 5.0,
      );

      // Assert
      expect(notifier.state.isLoading, false);
      expect(notifier.state.hasError, false);
      expect(notifier.state.record?.status, AttendanceStatus.present);
      expect(notifier.state.record?.distanceMeters, 14.5);
      verify(() => mockRepository.submitAttendance(
            sessionId: testSessionId,
            qrPayload: testQrToken,
            latitude: validLat,
            longitude: validLng,
            accuracyMeters: 5.0,
          )).called(1);
    });

    test('Harus menghasilkan Exception saat Geofencing mendeteksi radius melebihi batas 50m', () async {
      // Arrange
      when(() => mockRepository.submitAttendance(
            sessionId: any(named: 'sessionId'),
            qrPayload: any(named: 'qrPayload'),
            latitude: any(named: 'latitude'),
            longitude: any(named: 'longitude'),
            accuracyMeters: any(named: 'accuracyMeters'),
          )).thenThrow(GeofenceOutOfBoundsException(
        message: 'Jarak Anda (142m) berada di luar batas ruangan kelas.',
      ));

      // Act
      await notifier.processQrScan(
        sessionId: testSessionId,
        qrPayload: testQrToken,
        latitude: -6.950000, // Di luar radius kelas
        longitude: 107.650000,
        accuracyMeters: 8.0,
      );

      // Assert
      expect(notifier.state.isLoading, false);
      expect(notifier.state.hasError, true);
      expect(notifier.state.errorMessage, contains('di luar batas ruangan'));
    });
  });
}
```

---

## 5. Perintah Eksekusi Pengujian Lokal

```bash
# Unit web; tidak mengklaim coverage/integrasi DB
pnpm --dir C:/SICA/apps/web test:unit
```

`test:integration --coverage` bukan script yang tersedia di manifest web. Uji PostgreSQL mengikuti perintah eksplisit dan prasyarat §3.2; coverage menunggu provider/threshold (`RD-129`). Uji Flutter mengikuti paket/platform dan prasyarat tooling yang benar-benar tersedia. Perintah di sini **tidak dijalankan** dalam sinkronisasi docs-only ini.

### 5.1 Target beban, failover dan HA/ZDD — belum terbukti

| Profil/drill | Target dan bukti yang ditagih |
|---|---|
| **10k** dan **100k** mahasiswa | Dua dataset target, bukan janji pengguna simultan. Manifest uji menetapkan tenant, jumlah akun aktif, concurrency, arrival rate, proporsi baca/tulis, hot-class dan durasi spike/soak. Ukur p50/p95/p99, error, throughput, koneksi DB, lock wait, memory, queue lag dan fairness antar-tenant; ambang disetujui sebelum run. Tidak ada klaim O(1), Redlock cukup, atau kapasitas tercapai tanpa hasil. |
| Lua/fencing/BullMQ | Target failover pada reservasi kursi: duplicate delivery, lease expired, worker mati sebelum/sesudah commit, Redis primary gagal dan DB timeout. Fencing menolak writer basi; idempotensi + constraint memastikan **exactly-once effect**, bukan exactly-once delivery. Buktikan kursi tidak oversell, ledger/audit tidak ganda, retry/DLQ dapat direkonsiliasi. BullMQ/ioredis belum ada di manifest; desain tidak dianggap deployed. |
| Baseline KRS | Advisory lock sinkron DB adalah pengecualian sementara `RD-11/P-6`, bukan target final Lua/BullMQ. Ukur contention dan rollback baseline sendiri; jangan memindahkan hasil ke desain target. |
| Sesi dan HA | Sesi saat ini berbasis **DB**, bukan Redis. Drill staging harus mencakup login/refresh/revoke saat failover, Primary read-your-writes, replica lag, expiry, cache invalidation dan pemulihan tanpa menghidupkan kembali sesi/grant yang dicabut. |
| ZDD/migrasi/restore | Staging berizin: expand-compatible schema, campuran versi lama/baru, drain worker, bounded `lock_timeout`/`statement_timeout`, batas durasi quiesce dan abort. Dry-run + approval + snapshot, rekonsiliasi DB/outbox/ledger/audit sebelum resume; ukur RPO/RTO, jangan mengklaim zero downtime atau restore aman dari diagram. |

Semua drill memerlukan lingkungan staging terisolasi, runbook, metrik dan artefak bertanggal/commit. Tidak ada load test, failover, restore atau perubahan database yang dilakukan oleh pembaruan dokumen ini.

## 6. Uji kanal vicon dan kosakata tunggal (audit dewan 2026-10-21)

Bagian ini tidak menambah klaim "sudah diuji" — semuanya **belum** karena `0073`–`0075` belum ada berkasnya. Yang ditetapkan di sini adalah bentuk uji yang harus ada sebelum satu baris pun di `PRD §5.15` boleh disebut berjalan.

| Uji | Jenis | Yang dibuktikan | Perintah/gerbang |
|---|---|---|---|
| **Kontrak kanal tiruan** (Graph, BBB, Zoom) | target integrasi, tanpa egress nyata | denominator sesi valid > 0; dedup event, irisan interval dengan jadwal lalu union lintas perangkat; bukan `lastLeave − firstJoin`. Uji overlap, span melintasi batas, gap, timezone, laporan parsial/stale/absen → degraded, bukan vonis final; O/M menunggu aturan kanonik dan mapping terverifikasi | rencana Vitest dengan fixture, bukan hasil run |
| **Idempotensi peristiwa** | integrasi | peristiwa ganda → satu baris + `processing_state = DUPLICATE`; tidak ada duplikat `attendances` per `(sesi, mahasiswa)` | query `(t)` `DATA_MODEL §21.10.5` sebagai asersi |
| **Ambang berversi** | unit + golden | laporan periode lalu menghasilkan angka identik dengan `parameter_version` yang sama; ambang baru tidak mengubah vonis lama | golden vector + perbandingan byte |
| **Daftar-terlarang PII** | statis | `conference_channel_events` dan log tidak mengandung email/NIM/nama lengkap | scanner atribut (pola `AGENTS §3.9` gerbang l) |
| **Tolakan alias** | unit | tulis `HYBRID`/`OFFLINE`/`TEAMS`/`BUILTIN`/`MEET` ditolak; baca masih dipetakan lewat satu mapper | `422 PARAM_VALUE_NOT_ALLOWED` (baris 145) sebagai ekspektasi |
| **Turun-mutu berantai** | integrasi | kanal utama mati → rantai dicoba berurutan; hasil akhir `degraded` terlihat di layar, tidak ada kunci nilai | uji penolakan, bukan uji happy-path |

**Paritas Web ↔ Flutter (`AGENTS §3.4`).** Proyeksi `HADIR_ONLINE`/`HADIR_MIXED` dihitung **server**; klien hanya merender label. Uji paritas membandingkan *proyeksi server* yang sama untuk dua platform, bukan dua implementasi perhitungan. Angka ambang dan pembulatan memakai `numeric`, bukan `float` (ADR-5).

**Gerbang yang sudah ada hari ini dan bisa dijalankan.** `node .tools/vocab-audit.mjs` (satu kosakata per konsep), `.tools/chain-audit.mjs` (rantai pemilik punya peristiwa penerbit), `.tools/event-cite-audit.mjs` (rujukan peristiwa tanpa katalog), `.tools/error-dup.mjs` (nomor↔nama kode error konsisten), `.tools/rbac-count.mjs` (nomor izin tanpa lubang), `.tools/ddl-owner.mjs` (satu nama satu `CREATE TABLE`), `.tools/seed-count.mjs` (**belum dibuat** — bagian dari `RD-68`).

### 6.2 Paket KRS cohort M-13/M-14 (`FR-AKA-16`, `AC-AKA-16`)

Seluruh skenario di bawah adalah **rencana tes**, belum bukti implementasi. Migration `0023` belum tersedia sebagai berkas; test PostgreSQL harus menunggu prasyarat itu dan database test provider yang disetujui. Tidak boleh melaporkan tes DB sebagai lulus jika diskip atau diganti mock in-memory.

| Uji | Jenis | Yang dibuktikan | Status/perintah |
|---|---|---|---|
| DRAFT cohort & version | unit/service | paket hanya dapat diubah pada `DRAFT`; `If-Match` stale mengembalikan conflict tanpa menulis perubahan; rentang angkatan invalid ditolak | rencana Vitest; belum ada test khusus |
| Konsistensi package lines | PostgreSQL integration | tiap kelas berada dalam prodi/periode/cohort, distribusinya `PUBLISHED`, jadwal ada; total `sks_snapshot` sama dengan `packed_sks`; pelanggaran membatalkan seluruh transaksi | butuh migration `0023` + PostgreSQL nyata; belum dapat dijalankan |
| Plafon BR-R2 | property/unit + DB integration | sem 1–2 ≤ 20, sem ≥ 3 ≤ 24, semester antara ≤ 9; nilai kolom struktural `packed_sks ≤ 24` tidak pernah dianggap sebagai pengganti plafon efektif | properti di domain; database gate belum ada |
| Empat-mata publish | PostgreSQL integration | `requested_by = approved_by` ditolak oleh CHECK; `PUBLISHED` selalu memiliki approval/timestamp dan baris package positif; paket terbit tidak dapat ditimpa | DDL dirancang di `DATA_MODEL §26.8`; belum diterapkan |
| Preview SELF | route integration + RLS | package dipilih dari tenant/program/angkatan/periode principal; perubahan `studentId`/`tenantId` di query tidak memengaruhi principal; tidak ada mutasi `krs_baskets`/`enrollments` saat preview | `API_SPEC §4.2.17`, `SEC-02/03/07`; route/test belum ada |
| Submit memakai gerbang existing | service integration | prapilih paket tetap tunduk pada I-12, prasyarat, tagihan, kuota/kursi, periode, dan approval; package tidak membuat enrollment otomatis | gunakan jalur `POST /academic/krs/submit`; tes semua gerbang belum lengkap (`BENCH-46`) |
| Tanpa paket cocok | UI/component + route | `package: null` menghasilkan empty state bersebab dan daftar kelas reguler tetap tersedia; tidak dirender sebagai total SKS nol yang tampak sah | rencana test dua platform; belum ada fixture package yang dijalankan |
| Uji jadwal dosen AC-JDW-2 | PostgreSQL concurrency | bentrok dosen pada jadwal **terbit** harus ditolak oleh constraint DB, bukan hanya oleh solver draft | **terblokir `RD-135`**: schema `class_schedules` belum memuat pengampu/rentang yang diperlukan; jangan tulis tes seolah constraint ada |

**Kriteria release paket:** tidak ada suite paket yang boleh disebut lulus sampai migration `0023` dieksekusi, role/RLS dan SoD terbukti di PostgreSQL nyata, serta coverage CI provider/threshold berfungsi (`RD-129`).
