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

Batas ambang (*thresholds*) ini diuji secara ketat dalam pipeline CI/CD GitHub Actions. Pipeline akan berstatus gagal (*exit code 1*) jika cakupan berada di bawah standar berikut:

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
File: `apps/web/tests/integration/tenant-rls.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

describe('PostgreSQL Multi-Tenant Row-Level Security (RLS)', () => {
  let pool: Pool;
  const tenantA = uuidv4();
  const tenantB = uuidv4();

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sica_test'
    });

    // Inisialisasi data dummy 2 tenant
    await pool.query(`
      INSERT INTO tenants (id, name, subdomain) VALUES 
        ('${tenantA}', 'Universitas Prima A', 'prima-a'),
        ('${tenantB}', 'Institut Teknologi B', 'it-b')
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tenants WHERE id IN ('${tenantA}', '${tenantB}')`);
    await pool.end();
  });

  it('Tenant A TIDAK BOLEH membaca atau mengubah data mahasiswa Tenant B', async () => {
    const client = await pool.connect();
    try {
      // 1. Insert data mahasiswa atas nama Tenant B
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantB}';`);
      const studentBId = uuidv4();
      await client.query(`
        INSERT INTO students (id, tenant_id, nim, full_name, email)
        VALUES ('${studentBId}', '${tenantB}', 'NIM-B-001', 'Budi Tenant B', 'budi@itb.ac.id');
      `);
      await client.query('COMMIT');

      // 2. Sekarang beralih sesi koneksi menjadi Tenant A
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.current_tenant_id = '${tenantA}';`);

      // 3. Query semua mahasiswa: Data Mahasiswa B HARUS TIDAK MUNCUL (0 baris)
      const queryResult = await client.query('SELECT * FROM students WHERE id = $1', [studentBId]);
      expect(queryResult.rows.length).toBe(0);

      // 4. Coba melakukan manipulasi langsung (UPDATE) data Mahasiswa B
      const updateResult = await client.query(
        "UPDATE students SET full_name = 'Hacked Name' WHERE id = $1", 
        [studentBId]
      );
      expect(updateResult.rowCount).toBe(0); // RLS menyembunyikan row sehingga rowCount = 0

      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('Kueri tanpa pengaturan sesi app.current_tenant_id harus menghasilkan 0 baris (Default Deny)', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('RESET app.current_tenant_id;');
      const result = await client.query('SELECT * FROM students;');
      expect(result.rows.length).toBe(0);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
});
```

---

### 3.3 Security Test Stub: Pengujian HTTP 401, 403, dan 422
File: `apps/web/tests/security/api-security-guards.test.ts`

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
# 1. Jalankan Unit & Integration Tests Web (Vitest)
cd apps/web
pnpm test:unit
pnpm test:integration --coverage

# 2. Jalankan Widget & Notifier Tests Mobile (Flutter)
cd apps/mobile
flutter test --coverage
genhtml coverage/lcov.info -o coverage/html
```

## 6. Pengujian Enterprise 47 Modul (2026-10-20)

Kasus uji kanonik tidak disalin di sini; sumbernya: rantai I-1…I-10 & simulasi S-1…S-6 ([PRD.md §10.4–10.5](file:///c:/SICA/docs/PRD.md)), acceptance criteria [PRD §10.6](file:///c:/SICA/docs/PRD.md), deny-by-default per sel matriks [SECURITY_COMPLIANCE §10.4](file:///c:/SICA/docs/SECURITY_COMPLIANCE.md), golden dataset engine [ARCHITECTURE §11.4](file:///c:/SICA/docs/ARCHITECTURE.md). Lapisan wajib per modul: unit engine (deterministik), integrasi RLS lintas-tenant (0 baris bocor), kontrak event Zod (versi), E2E rantai lintas modul, beban WebSocket (p95 ≤ 2 s).
