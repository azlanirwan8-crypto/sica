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

### 2.3 Standar Error Codes

| Error Code | HTTP Status | Keterangan & Trigger Penyebab |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | 401 | JWT expired, token signature mismatch, atau header Authorization kosong. |
| `MFA_REQUIRED` | 401 | Kredensial username/password valid tetapi akun mewajibkan verifikasi OTP/MFA. |
| `FORBIDDEN` | 403 | RBAC ditolak (e.g. Mahasiswa memanggil endpoint pembukaan kelas). |
| `TENANT_ACCESS_DENIED` | 403 | Tenant ID pada token tidak cocok dengan subdomain/header request. |
| `NOT_FOUND` | 404 | Entitas data tidak ditemukan dalam scope tenant aktif. |
| `VALIDATION_FAILED` | 422 | Format payload salah, pelanggaran tipe data Zod, atau field wajib kosong. |
| `ACADEMIC_RULE_VIOLATION` | 422 | Pelanggaran aturan bisnis akademik (e.g. KRS bentrok jadwal, kuota SKS lebih). |
| `QR_TOKEN_INVALID` | 422 | Dynamic QR presensi kadaluarsa (>30 detik), signature HMAC salah, atau device di luar radius geofence. |
| `RATE_LIMIT_EXCEEDED` | 429 | Melebihi kuota 100 req/menit per IP/User. |
| `INTERNAL_SERVER_ERROR` | 500 | Kesalahan internal backend unhandled. Detail error dirahasiakan dari publik. |

---

## 3. Skema Validasi & Tipe Data Global (Zod Core)

Berikut adalah definisi pustaka validasi Zod TypeScript yang digunakan bersama oleh Next.js Server Action / Route Handlers:

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
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

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

### 4.1 Modul Otentikasi & Sesi (`/api/v1/auth/*`)

#### 4.1.1 POST `/api/v1/auth/login`
Autentikasi akun pengguna menggunakan identifier (NIM/NIDN/Email) dan password.

**Request Body Schema (Zod):**
```typescript
export const LoginRequestSchema = z.object({
  tenantIdentifier: z.string().min(3).max(64).describe("Subdomain institusi (e.g. unpad)"),
  username: z.string().min(3).max(100).describe("NIM, NIDN, atau Email Pengguna"),
  password: z.string().min(8).max(128),
  deviceId: z.string().max(128).optional().describe("Wajib dikirimkan oleh Flutter Mobile"),
  deviceInfo: z.object({
    os: z.enum(['ios', 'android', 'web']),
    model: z.string().optional(),
    appVersion: z.string()
  }).optional()
});
```

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const LoginResponseDataSchema = z.object({
  requireMfa: z.boolean(),
  mfaToken: z.string().optional().describe("Diberikan jika requireMfa=true"),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().optional().describe("Masa berlaku token dalam detik (900 = 15m)"),
  user: z.object({
    id: UUIDSchema,
    tenantId: UUIDSchema,
    username: z.string(),
    fullName: z.string(),
    role: z.enum(['super_admin', 'tenant_admin', 'dosen', 'mahasiswa', 'staff']),
    avatarUrl: z.string().url().nullable()
  }).optional()
});
```

---

#### 4.1.2 POST `/api/v1/auth/mfa/verify`
Memverifikasi 6 digit kode Time-based One-Time Password (TOTP) atau SMS OTP.

**Request Body Schema (Zod):**
```typescript
export const MfaVerifyRequestSchema = z.object({
  mfaToken: z.string().min(32),
  totpCode: z.string().length(6, { message: "Kode OTP harus tepat 6 digit angka." }).regex(/^\d+$/)
});
```

---

#### 4.1.3 POST `/api/v1/auth/refresh`
Memperbarui access token yang telah kadaluarsa menggunakan refresh token rotasi (7 hari).

**Request Body Schema (Zod):**
```typescript
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(32)
});
```

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const RefreshTokenResponseDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().describe("Refresh token rotasi baru (token lama di-revoke)"),
  expiresIn: z.number().int().default(900)
});
```

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
  deliveryMode: z.enum(['ONSITE', 'ONLINE_SYNC', 'ONLINE_ASYNC']).default('ONSITE'),
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
  status: z.enum(['present', 'late', 'absent']),
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

### 4.4 Modul Pembelajaran Daring & SICA Virtual Campus (`/api/v1/lms/*`)

Modul ini mengadopsi arsitektur terintegrasi ala **SEVIMA EdLink** yang menyatukan alur perkuliahan daring (live webinar Zoom & modul asinkron), forum diskusi, kuis CBT, dan auto-rekap nilai ke SIAKAD.

#### 4.4.1 GET `/api/v1/lms/classes/:classId/sessions`
Mengambil daftar 16 sesi pertemuan terstruktur untuk kelas tertentu, lengkap dengan modul materi, tugas, dan link sesi live.

**Response Payload Schema (Zod) - Status 200 OK:**
```typescript
export const LmsSessionListResponseDataSchema = z.array(z.object({
  sessionId: UUIDSchema,
  sequenceNumber: z.number().int().min(1).max(16),
  topic: z.string(),
  deliveryType: z.enum(['ONSITE', 'SYNC_LIVE', 'ASYNC_MODULE']),
  heldOn: z.string(),
  virtualRoom: z.object({
    provider: z.enum(['ZOOM', 'GOOGLE_MEET', 'BUILTIN']),
    joinUrl: z.string().url().nullable(),
    isLiveNow: z.boolean()
  }).nullable(),
  materialsCount: z.number().int(),
  assignmentsCount: z.number().int(),
  attendanceStatus: z.enum(['NOT_RECORDED', 'PRESENT', 'ABSENT', 'LATE'])
}));
```

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
Gerbang paket: tenant hanya dapat mengakses modul yang `ACTIVE`/`TRIAL`. Endpoint ini melayani daftar modul, aktivasi/deaktivasi add-on, dan cek entitlement untuk nav/permission.

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
export const ActivateModuleRequestSchema = z.object({
  seats: z.number().int().positive().optional(),
  trial: z.boolean().default(false),
});
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

**Aturan HTTP:** 401 tanpa sesi; 403 bila actor bukan `ADMIN_ACADEMIC`/`LEADER`/platform; 422 `MODULE_DEPENDENCY_UNMET`; 409 `MODULE_IN_USE` (deaktivasi modul yang jadi prasyarat addon lain). Tiap perubahan → `audit_logs` (`tenant.module.activate|deactivate`). Guard endpoint domain memakai HOF `withModule('lms', handler)` (lihat TECH_CONVENTIONS) yang memanggil resolver §12.4 dan mengembalikan 404 `MODULE_NOT_AVAILABLE` bila OFF.

---

### 4.6 Modul Administrasi & Data Master (`/api/v1/admin/*`)
> Rujukan kebutuhan: [PRD §5.8](file:///c:/SICA/docs/PRD.md) · objek & DDL: [DATA_MODEL §14](file:///c:/SICA/docs/DATA_MODEL.md) · struktur menu: [BENCHMARK_SEVIMA.md §4.1](file:///c:/SICA/docs/BENCHMARK_SEVIMA.md) · padanan layar Sevima: §2.3/§2.4. **Status: dispesifikasi, belum diimplementasi.**

**Kontrak silang yang berlaku untuk SEMUA rute `/admin/*` (tidak boleh dilanggar):**
1. **4 lapis penegakan** di tiap handler: (a) verifikasi JWT RS256 (`extractRequestContext`), (b) role + **scope** (`user_role_assignments`), (c) `withModule(code)` gerbang entitlement, (d) `withTenantContext` → `set_config('app.current_tenant', …)` sebelum query apa pun. Menambah data tanpa keempatnya = temuan audit.
2. **Envelope standar** §2.1/§2.2; list memakai `PaginationQuery` (`page`, `pageSize`, `sort`, `q`) + `meta.total`.
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
| `POST /api/v1/admin/<objek>/:id/toggle-active` | nonaktif/aktif-soft (preferensi alih-alih hapus; menggantikan `/deactivate`, §6.1) | `…:TOGGLE_ACTIVE` (bit OTHER) | `academic` |
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
| 13 | `referensi` (`reference-kinds`, `reference-items`) | kamus §14.2; `isSystem` tak boleh hapus |
| 14 | `skema-enrollment` (`enrollment-schemes`) | padanan "Sistem Kuliah" Sevima |
| 15 | `mahasiswa` (`students`) | + `student-biodata` ( alamat/ortu ) — PII, respons ter-masking sesuai peran |
| 16 | `dosen` (`lecturers`), `tendik` (`staff`) | NIDN/NUPTK unik per tenant (bukan global) |
| 17 | `status-mahasiswa` (`student-status`) | `POST …/change` (alasan wajib + approval) & `POST …/bulk` (set semester) |
| 18 | `pengaturan-akademik` (`academic-rules`) | `PUT /admin/pengaturan-akademik` body = `{programId, periodId, params}`; simpan versi baru, jangan `UPDATE` in-place |
| 19 | `pengaturan-tenant` (`tenant-settings`) | format NIM, penomoran, blok tanda tangan, allowlist IP presensi |
| 20 | `pengguna` (`users`), `hak-akses` (`role-assignments`), `sesi` (`sessions`) | perubahan izin → `access_change_requests` (empat-mata) |
| 21 | `audit` (`audit-logs`) | **READ-only**; tak ada rute tulis/ubah (AC-AUD-1) |
| 22 | `impor` (`imports`) | §4.6.4 |
| 23 | `kelas` (`classes`), `pengampu` (`class-assignments`), `jadwal` (`schedules`), `pertemuan` (`sessions-generation`) | §4.6.3, domain `teaching` |

#### 4.6.1 Contoh — list data master (seragam untuk 23 objek)
`GET /api/v1/admin/prodi?page=1&pageSize=25&q=si&jenjang=S1`
```json
{ "success": true,
  "data": [ { "id":"…","code":"IF","name":"S1 Teknik Informatika","level":"S1",
              "pddiktiCode":"12345","accreditationStatus":"UNGGUL","accreditationExpiresOn":"2028-12-01",
              "minTotalSks":"144.0","maxStudySemesters":16,"deliveryMode":"ONSITE","isActive":true } ],
  "meta": { "page":1, "pageSize":25, "total":61, "auditId":null } }
```

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
POST /api/v1/admin/impor/validate     (multipart: file, objek, dryRun=true)
POST /api/v1/admin/impor/commit       (body: {importId, mode:"CREATE|UPSERT"})
GET  /api/v1/admin/impor/:id          → { barisSumber, terimpor, ditolak, alasan[] , deviasiIpk }
```
- Urutan dependensi dipaksakan server: prodi → kurikulum → matakuliah → prasyarat → dosen → mahasiswa → kelas → jadwal.
- Batas: ≤ 20.000 baris/berkas; prosess per-batch 500 baris dalam transaksi terpisah; gagal total tidak meninggalkan state setengah-jadi (NFR-U1).
- File disimpan di object storage dengan akses sementara; **PII tidak pernah masuk log** (Pino redaction, AGENTS/SECURITY).

#### 4.6.5 Kode error baru khas administrasi (melengkapi §2.3)
| HTTP | Kode | Makna |
|---|---|---|
| 403 | `ADMIN_SCOPE_MISMATCH` | role ada, tapi scope (prodi/periode/kelas) tidak mencakup objek |
| 403 | `CALENDAR_REGULATORY_EVENT` | mencoba menghapus agenda wajib BR-R9 |
| 403 | `REOPEN_REQUIRES_APPROVAL` | membuka kembali periode tertutup tanpa persetujuan |
| 409 | `REFERENCE_IN_USE` | master dirujuk transaksi; tawarkan `deactivate` |
| 409 | `MAX_PARALLEL_CLASSES_EXCEEDED` | melebihi plafon kelas paralel prodi |
| 422 | `NATIONAL_CAP_TIGHTEN_ONLY` | mencoba melonggarkan plafon SKS/masa studi nasional (NFR-R2) |
| 422 | `BAND_OVERLAP` | band skala nilai tumpang tindih |
| 422 | `WEIGHT_SUM_NOT_100` | komposisi bobot bukan 100% (AC-NIL-4) |
| 422 | `LECTURER_WORKLOAD_EXCEEDED` | penugasan melewati beban mengajar maks (BR-A11) |
| 423 | `PERIOD_CLOSED` | operasi tulis pada periode terkunci (BR-A9) |
| 424 | `MODULE_INACTIVE` | modul entitlement belum aktif (padanan `MODULE_DEPENDENCY_UNMET` §4.5) |

---

## 5. Ringkasan Koleksi Endpoint Lengkap

```
/api/v1
│
├── /auth
│   ├── POST   /login              (Autentikasi kredensial pengguna)
│   ├── POST   /mfa/verify         (Validasi TOTP MFA 6 digit)
│   ├── POST   /refresh            (Rotasi Refresh Token)
│   └── POST   /logout             (Revokasi sesi & blacklist JWT)
│
├── /academic
│   ├── GET    /krs/open-classes   (Daftar kelas dibuka + status waitlist)
│   ├── POST   /krs/submit         (Pengajuan draf KRS ke DPA)
│   ├── POST   /krs/waitlist/join  (Ambil antrean saat kelas penuh)
│   ├── DELETE /krs/waitlist/leave (Batal antre & lepas kuota SKS)
│   ├── GET    /krs/current        (Rincian KRS aktif semester ini)
│   ├── GET    /khs/:periodId      (Kartu Hasil Studi per semester)
│   └── GET    /transcript         (Transkrip nilai kumulatif lengkap)
│
├── /attendance
│   ├── POST   /qr/generate        (Generate QR dinamis dosen - TTL 30s)
│   ├── POST   /qr/scan            (Scan presensi mahasiswa + Geofence GPS)
│   ├── GET    /sessions/:id/stats (Live monitor kehadiran kelas dosen)
│   └── GET    /history            (Riwayat presensi mahasiswa)
│
└── /lms
    ├── GET    /classes/:id/sessions   (Timeline sesi pertemuan 1-16)
    ├── POST   /sessions/:id/progress  (Tracking video -> auto-presensi)
    └── POST   /assignments/:id/submit (Kumpul tugas -> auto-sync KHS)
```

---

<!-- SICA-47:BEGIN enterprise-47 -->

## 6. Endpoint Enterprise 47 Modul + SuperApp (dikunci 2026-10-20)

### 6.1 Konvensi Mengikat

- **Base:** `/api/v1`; envelope §2; header §1 (`Authorization`, `X-Tenant-ID`, `X-Request-ID`, `X-Device-ID`, `X-App-Version`).
- **Enam endpoint standar per resource:** list/detail (`READ`), `POST` (`CREATE`), `PATCH` (`UPDATE`, wajib `If-Match: <row_version>`), `POST /:id/toggle-active` (`TOGGLE_ACTIVE`), `DELETE` (`DELETE`, hanya bila `GET /:id/impact` = 0), `GET /export` (`EXPORT`, job asinkron → `202` + `jobId`). Pola ini menggeneralisasi §4.6.
- **Aksi alur kerja** = `POST /<resource>/:id/<verb>`: `approve`/`reject` (wajib `reason` untuk reject), `lock`/`unlock` (wajib `reason`; `unlock` memerlukan empat-mata bila parameter `*.four_eyes` aktif), `submit`, `compute`, `publish`.
- **Parameter modul:** `GET /<prefix>/parameters` dan `POST /<prefix>/parameters/:key/versions` (`PARAM_EDIT`; body `{value, scope, effectiveFrom, reason}`; divalidasi `json_schema`, `regulatory_floor`, `parameter_restrictions`).
- **Lookup generik:** endpoint `lookup-categories`/`lookup-values` didefinisikan sekali di §6.5.2 (M-02).
- **Anti-duplikasi:** fungsi yang sudah punya endpoint di §4 (auth, KRS submit, KHS/transkrip, QR presensi, LMS submit/progress, entitlement, objek master `/admin/<objek>` §4.6, aksi massal §4.6.3) **tetap kanonik di §4**; §6.5 hanya merujuk (`→`). Setiap pasangan method+path muncul tepat satu kali di seluruh dokumen.
- **Nonaktif-soft** seluruh resource (termasuk §4.6) memakai `POST …/:id/toggle-active` (menggantikan `…/deactivate`).
- **Idempotensi:** semua `POST` mutasi wajib `Idempotency-Key` (tabel `idempotency_keys`, §4 DATA_MODEL); webhook memakai `external_ref`.
- **Audit:** setiap mutasi mengembalikan `meta.auditId`; perubahan memancarkan event outbox (ARCHITECTURE §11.5).
- **Permission code:** `<entitlement>.<resource>.<aksi>` (huruf kecil, `snake_case`), aksi ∈ 11 aksi kanonik SECURITY_COMPLIANCE §10.1.

### 6.2 Kode Error Tambahan

| HTTP | Kode | Kapan |
|---|---|---|
| 402 | `MODULE_NOT_ENTITLED` | modul tidak aktif untuk tenant |
| 403 | `FOUR_EYES_REQUIRED` | pemohon = penyetuju, atau aksi butuh penyetuju kedua |
| 403 | `SCOPE_DENIED` | izin ada tetapi di luar scope assignment |
| 404 | `NOT_FOUND` | termasuk akses lintas tenant (tidak membocorkan eksistensi) |
| 409 | `REFERENCED` | `DELETE` pada data yang dirujuk; gunakan `TOGGLE_ACTIVE` |
| 409 | `VERSION_CONFLICT` | `If-Match` tidak cocok |
| 409 | `SEAT_UNAVAILABLE` | kursi KRS habis/terkunci |
| 422 | `PARAM_OUT_OF_RANGE` · `PARAM_REGULATORY_FLOOR` | nilai parameter melanggar batas |
| 422 | `WORKFLOW_STATE_INVALID` | transisi tidak sah (mis. approve dokumen yang sudah ditolak) |
| 422 | `GEOFENCE_OUT_OF_RANGE` · `QR_TOKEN_EXPIRED` | presensi di luar radius / token di luar jendela TOTP |
| 423 | `RESOURCE_LOCKED` | resource/periode terkunci (`LOCK`) |

### 6.3 Kontrak Real-Time (WebSocket)

`wss://<host>/realtime` (layanan `apps/realtime`, ARCHITECTURE §11.2). Pesan JSON:

| Arah | `type` | Isi |
|---|---|---|
| C→S | `auth` | `{token}` (JWT akses) — wajib pesan pertama, ≤ 5 s |
| C→S | `subscribe` / `unsubscribe` | `{topics:["tenant:{tid}:lms", "tenant:{tid}:class:{id}"]}` — ditolak per topik bila tidak berizin |
| S→C | `event` | `{eventId, type, version, aggregate, aggregateId, aggregateSeq, occurredAt, changed}` (tanpa PII) |
| S→C | `resync` | klien tertinggal (> parameter `realtime.max_gap`) → refetch penuh |
| S↔C | `ping`/`pong` | 25 s |

Fallback: `GET /api/v1/realtime/sse?topics=...`.

### 6.4 Endpoint Publik & Webhook

Didefinisikan di tabel modul pemiliknya (tidak diulang di sini): OAI-PMH repositori → §6.5.20; webhook VA → §6.5.10; verifikasi QR SIVIL publik → §6.5.35; pelaporan PPKS anonim → §6.5.36. Aturan umum endpoint publik: tanpa cookie, rate-limit per IP (parameter `security.public_rate_limit`), CORS dibatasi, payload sensitif terenkripsi di klien.

### 6.5 Endpoint per Modul

Tabel berikut mencantumkan, untuk setiap resource, enam endpoint standar dan aksi alur kerja khusus beserta permission code. Role yang memegang permission → SECURITY_COMPLIANCE §10.4.


#### 6.5.1 M-01 — SaaS Foundation

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /platform/tenants` | READ | `platform_saas.tenants.read` | list (filter/sort/cursor); detail `GET /platform/tenants/:id` — `tenants` |
| `POST /platform/tenants` | CREATE | `platform_saas.tenants.create` | wajib `Idempotency-Key` |
| `PATCH /platform/tenants/:id` | UPDATE | `platform_saas.tenants.update` | wajib `If-Match` (versi baris) |
| `POST /platform/tenants/:id/toggle-active` | TOGGLE_ACTIVE | `platform_saas.tenants.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /platform/tenants/:id` | DELETE | `platform_saas.tenants.delete` | hanya jika `GET /platform/tenants/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /platform/tenants/export` | EXPORT | `platform_saas.tenants.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /platform/subscriptions` | READ | `platform_saas.subscriptions.read` | list (filter/sort/cursor); detail `GET /platform/subscriptions/:id` — `tenant_subscriptions` |
| `POST /platform/subscriptions` | CREATE | `platform_saas.subscriptions.create` | wajib `Idempotency-Key` |
| `PATCH /platform/subscriptions/:id` | UPDATE | `platform_saas.subscriptions.update` | wajib `If-Match` (versi baris) |
| `POST /platform/subscriptions/:id/toggle-active` | TOGGLE_ACTIVE | `platform_saas.subscriptions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /platform/subscriptions/:id` | DELETE | `platform_saas.subscriptions.delete` | hanya jika `GET /platform/subscriptions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /platform/subscriptions/export` | EXPORT | `platform_saas.subscriptions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /platform/sla-policies` | READ | `platform_saas.sla_policies.read` | list (filter/sort/cursor); detail `GET /platform/sla-policies/:id` — `sla_policies` |
| `POST /platform/sla-policies` | CREATE | `platform_saas.sla_policies.create` | wajib `Idempotency-Key` |
| `PATCH /platform/sla-policies/:id` | UPDATE | `platform_saas.sla_policies.update` | wajib `If-Match` (versi baris) |
| `POST /platform/sla-policies/:id/toggle-active` | TOGGLE_ACTIVE | `platform_saas.sla_policies.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /platform/sla-policies/:id` | DELETE | `platform_saas.sla_policies.delete` | hanya jika `GET /platform/sla-policies/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /platform/sla-policies/export` | EXPORT | `platform_saas.sla_policies.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /platform/tenants/:id/provision` | CREATE | `platform_saas.tenants.create` | provisioning tenant transaksional: seed lookup, role sistem, modul core |
| `POST /platform/tenants/:id/suspend` | LOCK | `platform_saas.tenants.lock` | suspend tenant (423 TENANT_LOCKED) |
| `POST /platform/tenants/:id/resume` | UNLOCK | `platform_saas.tenants.unlock` | aktifkan kembali |
| `GET /platform/sla/report` | EXPORT | `platform_saas.sla.export` | laporan SLA per tenant |
| `GET /platform/parameters` · `POST /platform/parameters/:key/versions` | READ · PARAM_EDIT | `platform_saas.parameters.read` · `platform_saas.parameters.param_edit` | parameter modul: `platform.ring.virtual_nodes`, `platform.sla.availability_target`, `platform.provision.default_modules` |

#### 6.5.2 M-02 — Master Parameter

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /admin/lookup-categories` | READ | `identity.lookup_categories.read` | list (filter/sort/cursor); detail `GET /admin/lookup-categories/:id` — `lookup_categories` |
| `POST /admin/lookup-categories` | CREATE | `identity.lookup_categories.create` | wajib `Idempotency-Key` |
| `PATCH /admin/lookup-categories/:id` | UPDATE | `identity.lookup_categories.update` | wajib `If-Match` (versi baris) |
| `POST /admin/lookup-categories/:id/toggle-active` | TOGGLE_ACTIVE | `identity.lookup_categories.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/lookup-categories/:id` | DELETE | `identity.lookup_categories.delete` | hanya jika `GET /admin/lookup-categories/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/lookup-categories/export` | EXPORT | `identity.lookup_categories.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /admin/lookup-values` | READ | `identity.lookup_values.read` | list (filter/sort/cursor); detail `GET /admin/lookup-values/:id` — `lookup_values` |
| `POST /admin/lookup-values` | CREATE | `identity.lookup_values.create` | wajib `Idempotency-Key` |
| `PATCH /admin/lookup-values/:id` | UPDATE | `identity.lookup_values.update` | wajib `If-Match` (versi baris) |
| `POST /admin/lookup-values/:id/toggle-active` | TOGGLE_ACTIVE | `identity.lookup_values.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/lookup-values/:id` | DELETE | `identity.lookup_values.delete` | hanya jika `GET /admin/lookup-values/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/lookup-values/export` | EXPORT | `identity.lookup_values.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /admin/parameters` | READ | `identity.parameters.read` | list (filter/sort/cursor); detail `GET /admin/parameters/:id` — `system_parameters` |
| `POST /admin/parameters` | CREATE | `identity.parameters.create` | wajib `Idempotency-Key` |
| `PATCH /admin/parameters/:id` | UPDATE | `identity.parameters.update` | wajib `If-Match` (versi baris) |
| `POST /admin/parameters/:id/toggle-active` | TOGGLE_ACTIVE | `identity.parameters.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/parameters/:id` | DELETE | `identity.parameters.delete` | hanya jika `GET /admin/parameters/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/parameters/export` | EXPORT | `identity.parameters.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /admin/eav-attributes` | READ | `identity.eav_attributes.read` | list (filter/sort/cursor); detail `GET /admin/eav-attributes/:id` — `eav_attributes` |
| `POST /admin/eav-attributes` | CREATE | `identity.eav_attributes.create` | wajib `Idempotency-Key` |
| `PATCH /admin/eav-attributes/:id` | UPDATE | `identity.eav_attributes.update` | wajib `If-Match` (versi baris) |
| `POST /admin/eav-attributes/:id/toggle-active` | TOGGLE_ACTIVE | `identity.eav_attributes.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/eav-attributes/:id` | DELETE | `identity.eav_attributes.delete` | hanya jika `GET /admin/eav-attributes/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/eav-attributes/export` | EXPORT | `identity.eav_attributes.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /admin/lookup-values/:id/toggle` | TOGGLE_ACTIVE | `identity.lookup_values.toggle_active` | aktif/nonaktif nilai lookup |
| `POST /admin/parameters/:key/versions` | PARAM_EDIT | `identity.parameters.param_edit` | buat versi parameter baru (bukan UPDATE in-place) |
| `POST /admin/nim/preview` | READ | `identity.nim.read` | pratinjau NIM dari pola |
| `POST /admin/nim/generate` | CREATE | `identity.nim.create` | generate NIM untuk camaba ber-status REGISTERED (dipicu event) |
| `POST /admin/students/:id/status` | UPDATE | `identity.students.update` | student.status.change — ubah status mahasiswa (aktif/cuti/non-aktif) berbasis lookup |
| (parameter) | READ · PARAM_EDIT | `identity.parameters.*` | memakai endpoint parameter `/admin/parameters` yang sudah tercantum di atas: `nim.pattern`, `nim.reset_scope`, `param.cache_ttl_seconds` |

#### 6.5.3 M-03 — Hak Akses & RBAC

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /admin/rbac/roles` | READ | `identity.roles.read` | list (filter/sort/cursor); detail `GET /admin/rbac/roles/:id` — `roles` |
| `POST /admin/rbac/roles` | CREATE | `identity.roles.create` | wajib `Idempotency-Key` |
| `PATCH /admin/rbac/roles/:id` | UPDATE | `identity.roles.update` | wajib `If-Match` (versi baris) |
| `POST /admin/rbac/roles/:id/toggle-active` | TOGGLE_ACTIVE | `identity.roles.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/rbac/roles/:id` | DELETE | `identity.roles.delete` | hanya jika `GET /admin/rbac/roles/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/rbac/roles/export` | EXPORT | `identity.roles.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /admin/rbac/role-permissions` | READ | `identity.role_permissions.read` | list (filter/sort/cursor); detail `GET /admin/rbac/role-permissions/:id` — `role_permissions` |
| `POST /admin/rbac/role-permissions` | CREATE | `identity.role_permissions.create` | wajib `Idempotency-Key` |
| `PATCH /admin/rbac/role-permissions/:id` | UPDATE | `identity.role_permissions.update` | wajib `If-Match` (versi baris) |
| `POST /admin/rbac/role-permissions/:id/toggle-active` | TOGGLE_ACTIVE | `identity.role_permissions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/rbac/role-permissions/:id` | DELETE | `identity.role_permissions.delete` | hanya jika `GET /admin/rbac/role-permissions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/rbac/role-permissions/export` | EXPORT | `identity.role_permissions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| → `/admin/hak-akses` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.hak-akses` | `user_role_assignments` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| `GET /admin/rbac/parameter-restrictions` | READ | `identity.parameter_restrictions.read` | list (filter/sort/cursor); detail `GET /admin/rbac/parameter-restrictions/:id` — `parameter_restrictions` |
| `POST /admin/rbac/parameter-restrictions` | CREATE | `identity.parameter_restrictions.create` | wajib `Idempotency-Key` |
| `PATCH /admin/rbac/parameter-restrictions/:id` | UPDATE | `identity.parameter_restrictions.update` | wajib `If-Match` (versi baris) |
| `POST /admin/rbac/parameter-restrictions/:id/toggle-active` | TOGGLE_ACTIVE | `identity.parameter_restrictions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /admin/rbac/parameter-restrictions/:id` | DELETE | `identity.parameter_restrictions.delete` | hanya jika `GET /admin/rbac/parameter-restrictions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /admin/rbac/parameter-restrictions/export` | EXPORT | `identity.parameter_restrictions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /admin/rbac/matrix` | READ | `identity.rbac.read` | grid role × resource × 10 aksi |
| `POST /admin/rbac/change-requests/:id/approve` | APPROVE | `identity.rbac.approve` | setujui perubahan izin |
| `POST /admin/rbac/change-requests/:id/reject` | REJECT | `identity.rbac.reject` | tolak |
| `GET /admin/rbac/matrix/export` | EXPORT | `identity.rbac.export` | ekspor matriks |
| `GET /admin/rbac/parameters` · `POST /admin/rbac/parameters/:key/versions` | READ · PARAM_EDIT | `identity.parameters.read` · `identity.parameters.param_edit` | parameter modul: `rbac.cache_ttl_seconds`, `rbac.four_eyes_required` |

#### 6.5.4 M-04 — IT Helpdesk

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /helpdesk/tickets` | READ | `helpdesk.tickets.read` | list (filter/sort/cursor); detail `GET /helpdesk/tickets/:id` — `helpdesk_tickets` |
| `POST /helpdesk/tickets` | CREATE | `helpdesk.tickets.create` | wajib `Idempotency-Key` |
| `PATCH /helpdesk/tickets/:id` | UPDATE | `helpdesk.tickets.update` | wajib `If-Match` (versi baris) |
| `POST /helpdesk/tickets/:id/toggle-active` | TOGGLE_ACTIVE | `helpdesk.tickets.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /helpdesk/tickets/:id` | DELETE | `helpdesk.tickets.delete` | hanya jika `GET /helpdesk/tickets/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /helpdesk/tickets/export` | EXPORT | `helpdesk.tickets.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /helpdesk/sla-rules` | READ | `helpdesk.sla_rules.read` | list (filter/sort/cursor); detail `GET /helpdesk/sla-rules/:id` — `helpdesk_sla_rules` |
| `POST /helpdesk/sla-rules` | CREATE | `helpdesk.sla_rules.create` | wajib `Idempotency-Key` |
| `PATCH /helpdesk/sla-rules/:id` | UPDATE | `helpdesk.sla_rules.update` | wajib `If-Match` (versi baris) |
| `POST /helpdesk/sla-rules/:id/toggle-active` | TOGGLE_ACTIVE | `helpdesk.sla_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /helpdesk/sla-rules/:id` | DELETE | `helpdesk.sla_rules.delete` | hanya jika `GET /helpdesk/sla-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /helpdesk/sla-rules/export` | EXPORT | `helpdesk.sla_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /helpdesk/tickets/:id/escalate` | UPDATE | `helpdesk.tickets.update` | eskalasi manual |
| `POST /helpdesk/tickets/:id/resolve` | APPROVE | `helpdesk.tickets.approve` | tandai selesai |
| `POST /helpdesk/tickets/:id/reopen` | UNLOCK | `helpdesk.tickets.unlock` | buka ulang |
| `GET /helpdesk/parameters` · `POST /helpdesk/parameters/:key/versions` | READ · PARAM_EDIT | `helpdesk.parameters.read` · `helpdesk.parameters.param_edit` | parameter modul: `helpdesk.max_tier`, `helpdesk.auto_close_days` |

#### 6.5.5 M-05 — Keamanan & Audit

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /audit/pii-masking-rules` | READ | `audit.pii_masking_rules.read` | list (filter/sort/cursor); detail `GET /audit/pii-masking-rules/:id` — `pii_masking_rules` |
| `POST /audit/pii-masking-rules` | CREATE | `audit.pii_masking_rules.create` | wajib `Idempotency-Key` |
| `PATCH /audit/pii-masking-rules/:id` | UPDATE | `audit.pii_masking_rules.update` | wajib `If-Match` (versi baris) |
| `POST /audit/pii-masking-rules/:id/toggle-active` | TOGGLE_ACTIVE | `audit.pii_masking_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /audit/pii-masking-rules/:id` | DELETE | `audit.pii_masking_rules.delete` | hanya jika `GET /audit/pii-masking-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /audit/pii-masking-rules/export` | EXPORT | `audit.pii_masking_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /audit/security-violations` | READ | `audit.security_violations.read` | list (filter/sort/cursor); detail `GET /audit/security-violations/:id` — `security_violations` |
| `POST /audit/security-violations` | CREATE | `audit.security_violations.create` | wajib `Idempotency-Key` |
| `PATCH /audit/security-violations/:id` | UPDATE | `audit.security_violations.update` | wajib `If-Match` (versi baris) |
| `POST /audit/security-violations/:id/toggle-active` | TOGGLE_ACTIVE | `audit.security_violations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /audit/security-violations/:id` | DELETE | `audit.security_violations.delete` | hanya jika `GET /audit/security-violations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /audit/security-violations/export` | EXPORT | `audit.security_violations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /audit/data-subject-requests` | READ | `audit.data_subject_requests.read` | list (filter/sort/cursor); detail `GET /audit/data-subject-requests/:id` — `data_subject_requests` |
| `POST /audit/data-subject-requests` | CREATE | `audit.data_subject_requests.create` | wajib `Idempotency-Key` |
| `PATCH /audit/data-subject-requests/:id` | UPDATE | `audit.data_subject_requests.update` | wajib `If-Match` (versi baris) |
| `POST /audit/data-subject-requests/:id/toggle-active` | TOGGLE_ACTIVE | `audit.data_subject_requests.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /audit/data-subject-requests/:id` | DELETE | `audit.data_subject_requests.delete` | hanya jika `GET /audit/data-subject-requests/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /audit/data-subject-requests/export` | EXPORT | `audit.data_subject_requests.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /audit/logs` | READ | `audit.logs.read` | viewer hash-chain (read-only mutlak) |
| `POST /audit/verify` | READ | `audit.verify.read` | verifikasi rantai & Merkle proof rentang |
| `GET /audit/logs/export` | EXPORT | `audit.logs.export` | ekspor bukti audit ber-tanda tangan |
| `POST /audit/dsr/:id/approve` | APPROVE | `audit.dsr.approve` | putuskan permintaan subjek data |
| `GET /audit/parameters` · `POST /audit/parameters/:key/versions` | READ · PARAM_EDIT | `audit.parameters.read` · `audit.parameters.param_edit` | parameter modul: `audit.anchor_cron`, `pdp.breach_notify_hours`, `pii.default_mask` |

#### 6.5.6 M-06 — HRIS & Payroll

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /hr/employees` | READ | `hr_bkd.employees.read` | list (filter/sort/cursor); detail `GET /hr/employees/:id` — `employees` |
| `POST /hr/employees` | CREATE | `hr_bkd.employees.create` | wajib `Idempotency-Key` |
| `PATCH /hr/employees/:id` | UPDATE | `hr_bkd.employees.update` | wajib `If-Match` (versi baris) |
| `POST /hr/employees/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.employees.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /hr/employees/:id` | DELETE | `hr_bkd.employees.delete` | hanya jika `GET /hr/employees/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /hr/employees/export` | EXPORT | `hr_bkd.employees.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /hr/leave-requests` | READ | `hr_bkd.leave_requests.read` | list (filter/sort/cursor); detail `GET /hr/leave-requests/:id` — `leave_requests` |
| `POST /hr/leave-requests` | CREATE | `hr_bkd.leave_requests.create` | wajib `Idempotency-Key` |
| `PATCH /hr/leave-requests/:id` | UPDATE | `hr_bkd.leave_requests.update` | wajib `If-Match` (versi baris) |
| `POST /hr/leave-requests/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.leave_requests.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /hr/leave-requests/:id` | DELETE | `hr_bkd.leave_requests.delete` | hanya jika `GET /hr/leave-requests/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /hr/leave-requests/export` | EXPORT | `hr_bkd.leave_requests.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /hr/payroll-runs` | READ | `hr_bkd.payroll_runs.read` | list (filter/sort/cursor); detail `GET /hr/payroll-runs/:id` — `payroll_runs` |
| `POST /hr/payroll-runs` | CREATE | `hr_bkd.payroll_runs.create` | wajib `Idempotency-Key` |
| `PATCH /hr/payroll-runs/:id` | UPDATE | `hr_bkd.payroll_runs.update` | wajib `If-Match` (versi baris) |
| `POST /hr/payroll-runs/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.payroll_runs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /hr/payroll-runs/:id` | DELETE | `hr_bkd.payroll_runs.delete` | hanya jika `GET /hr/payroll-runs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /hr/payroll-runs/export` | EXPORT | `hr_bkd.payroll_runs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /hr/tax-brackets` | READ | `hr_bkd.tax_brackets.read` | list (filter/sort/cursor); detail `GET /hr/tax-brackets/:id` — `tax_brackets` |
| `POST /hr/tax-brackets` | CREATE | `hr_bkd.tax_brackets.create` | wajib `Idempotency-Key` |
| `PATCH /hr/tax-brackets/:id` | UPDATE | `hr_bkd.tax_brackets.update` | wajib `If-Match` (versi baris) |
| `POST /hr/tax-brackets/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.tax_brackets.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /hr/tax-brackets/:id` | DELETE | `hr_bkd.tax_brackets.delete` | hanya jika `GET /hr/tax-brackets/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /hr/tax-brackets/export` | EXPORT | `hr_bkd.tax_brackets.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /hr/kpi-scorecards` | READ | `hr_bkd.kpi_scorecards.read` | list (filter/sort/cursor); detail `GET /hr/kpi-scorecards/:id` — `kpi_scorecards` |
| `POST /hr/kpi-scorecards` | CREATE | `hr_bkd.kpi_scorecards.create` | wajib `Idempotency-Key` |
| `PATCH /hr/kpi-scorecards/:id` | UPDATE | `hr_bkd.kpi_scorecards.update` | wajib `If-Match` (versi baris) |
| `POST /hr/kpi-scorecards/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.kpi_scorecards.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /hr/kpi-scorecards/:id` | DELETE | `hr_bkd.kpi_scorecards.delete` | hanya jika `GET /hr/kpi-scorecards/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /hr/kpi-scorecards/export` | EXPORT | `hr_bkd.kpi_scorecards.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /hr/leave-requests/:id/approve` | APPROVE | `hr_bkd.leave_requests.approve` | setujui cuti |
| `POST /hr/leave-requests/:id/reject` | REJECT | `hr_bkd.leave_requests.reject` | tolak cuti |
| `POST /hr/payroll-runs/:id/calculate` | UPDATE | `hr_bkd.payroll_runs.update` | hitung PPh 21 & komponen |
| `POST /hr/payroll-runs/:id/lock` | LOCK | `hr_bkd.payroll_runs.lock` | kunci payroll → jurnal BAUK |
| `POST /hr/payroll-runs/:id/unlock` | UNLOCK | `hr_bkd.payroll_runs.unlock` | buka kunci (empat-mata) |
| `GET /hr/payroll-runs/:id/export` | EXPORT | `hr_bkd.payroll_runs.export` | slip/e-SPT CSV |
| `GET /hr/parameters` · `POST /hr/parameters/:key/versions` | READ · PARAM_EDIT | `hr_bkd.parameters.read` · `hr_bkd.parameters.param_edit` | parameter modul: `payroll.cutoff_day`, `payroll.rounding`, `leave.annual_quota_days` |

#### 6.5.7 M-07 — BKD Dosen

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /bkd/periods` | READ | `hr_bkd.periods.read` | list (filter/sort/cursor); detail `GET /bkd/periods/:id` — `bkd_periods` |
| `POST /bkd/periods` | CREATE | `hr_bkd.periods.create` | wajib `Idempotency-Key` |
| `PATCH /bkd/periods/:id` | UPDATE | `hr_bkd.periods.update` | wajib `If-Match` (versi baris) |
| `POST /bkd/periods/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.periods.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /bkd/periods/:id` | DELETE | `hr_bkd.periods.delete` | hanya jika `GET /bkd/periods/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /bkd/periods/export` | EXPORT | `hr_bkd.periods.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /bkd/activities` | READ | `hr_bkd.activities.read` | list (filter/sort/cursor); detail `GET /bkd/activities/:id` — `bkd_activities` |
| `POST /bkd/activities` | CREATE | `hr_bkd.activities.create` | wajib `Idempotency-Key` |
| `PATCH /bkd/activities/:id` | UPDATE | `hr_bkd.activities.update` | wajib `If-Match` (versi baris) |
| `POST /bkd/activities/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.activities.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /bkd/activities/:id` | DELETE | `hr_bkd.activities.delete` | hanya jika `GET /bkd/activities/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /bkd/activities/export` | EXPORT | `hr_bkd.activities.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /bkd/assessments` | READ | `hr_bkd.assessments.read` | list (filter/sort/cursor); detail `GET /bkd/assessments/:id` — `bkd_assessments` |
| `POST /bkd/assessments` | CREATE | `hr_bkd.assessments.create` | wajib `Idempotency-Key` |
| `PATCH /bkd/assessments/:id` | UPDATE | `hr_bkd.assessments.update` | wajib `If-Match` (versi baris) |
| `POST /bkd/assessments/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.assessments.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /bkd/assessments/:id` | DELETE | `hr_bkd.assessments.delete` | hanya jika `GET /bkd/assessments/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /bkd/assessments/export` | EXPORT | `hr_bkd.assessments.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /bkd/ewmp-rubrics` | READ | `hr_bkd.ewmp_rubrics.read` | list (filter/sort/cursor); detail `GET /bkd/ewmp-rubrics/:id` — `ewmp_rubrics` |
| `POST /bkd/ewmp-rubrics` | CREATE | `hr_bkd.ewmp_rubrics.create` | wajib `Idempotency-Key` |
| `PATCH /bkd/ewmp-rubrics/:id` | UPDATE | `hr_bkd.ewmp_rubrics.update` | wajib `If-Match` (versi baris) |
| `POST /bkd/ewmp-rubrics/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.ewmp_rubrics.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /bkd/ewmp-rubrics/:id` | DELETE | `hr_bkd.ewmp_rubrics.delete` | hanya jika `GET /bkd/ewmp-rubrics/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /bkd/ewmp-rubrics/export` | EXPORT | `hr_bkd.ewmp_rubrics.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /bkd/activities/overlaps` | READ | `hr_bkd.activities.read` | hasil interval tree |
| `POST /bkd/periods/:id/submit` | UPDATE | `hr_bkd.periods.update` | dosen mengajukan laporan |
| `POST /bkd/assessments/:id/approve` | APPROVE | `hr_bkd.assessments.approve` | asesor setuju |
| `POST /bkd/assessments/:id/reject` | REJECT | `hr_bkd.assessments.reject` | asesor tolak |
| `POST /bkd/periods/:id/lock` | LOCK | `hr_bkd.periods.lock` | kunci periode |
| `GET /bkd/periods/:id/export` | EXPORT | `hr_bkd.periods.export` | format SISTER |
| `GET /bkd/parameters` · `POST /bkd/parameters/:key/versions` | READ · PARAM_EDIT | `hr_bkd.parameters.read` · `hr_bkd.parameters.param_edit` | parameter modul: `bkd.min_sks`, `bkd.max_sks`, `bkd.min_dharma_pendidikan_sks` |

#### 6.5.8 M-08 — SISTER Sync

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /sister/mappings` | READ | `hr_bkd.mappings.read` | list (filter/sort/cursor); detail `GET /sister/mappings/:id` — `sister_mappings` |
| `POST /sister/mappings` | CREATE | `hr_bkd.mappings.create` | wajib `Idempotency-Key` |
| `PATCH /sister/mappings/:id` | UPDATE | `hr_bkd.mappings.update` | wajib `If-Match` (versi baris) |
| `POST /sister/mappings/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.mappings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /sister/mappings/:id` | DELETE | `hr_bkd.mappings.delete` | hanya jika `GET /sister/mappings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /sister/mappings/export` | EXPORT | `hr_bkd.mappings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /sister/sync-items` | READ | `hr_bkd.sync_items.read` | list (filter/sort/cursor); detail `GET /sister/sync-items/:id` — `sister_sync_items` |
| `POST /sister/sync-items` | CREATE | `hr_bkd.sync_items.create` | wajib `Idempotency-Key` |
| `PATCH /sister/sync-items/:id` | UPDATE | `hr_bkd.sync_items.update` | wajib `If-Match` (versi baris) |
| `POST /sister/sync-items/:id/toggle-active` | TOGGLE_ACTIVE | `hr_bkd.sync_items.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /sister/sync-items/:id` | DELETE | `hr_bkd.sync_items.delete` | hanya jika `GET /sister/sync-items/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /sister/sync-items/export` | EXPORT | `hr_bkd.sync_items.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /sister/sync-runs` | CREATE | `hr_bkd.sync_runs.create` | jalankan push delta |
| `GET /sister/sync-items/:id/delta` | READ | `hr_bkd.sync_items.read` | diff lokal vs terakhir terkirim |
| `POST /sister/sync-items/:id/retry` | UPDATE | `hr_bkd.sync_items.update` | retry manual |
| `GET /sister/sync-runs/export` | EXPORT | `hr_bkd.sync_runs.export` | log sinkronisasi |
| `GET /sister/parameters` · `POST /sister/parameters/:key/versions` | READ · PARAM_EDIT | `hr_bkd.parameters.read` · `hr_bkd.parameters.param_edit` | parameter modul: `sister.base_url`, `sister.batch_size`, `sister.retry_max` |

#### 6.5.9 M-09 — PMB & OCR

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /pmb/periods` | READ | `pmb.periods.read` | list (filter/sort/cursor); detail `GET /pmb/periods/:id` — `pmb_periods` |
| `POST /pmb/periods` | CREATE | `pmb.periods.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/periods/:id` | UPDATE | `pmb.periods.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/periods/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.periods.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/periods/:id` | DELETE | `pmb.periods.delete` | hanya jika `GET /pmb/periods/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/periods/export` | EXPORT | `pmb.periods.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/tracks` | READ | `pmb.tracks.read` | list (filter/sort/cursor); detail `GET /pmb/tracks/:id` — `pmb_tracks` |
| `POST /pmb/tracks` | CREATE | `pmb.tracks.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/tracks/:id` | UPDATE | `pmb.tracks.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/tracks/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.tracks.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/tracks/:id` | DELETE | `pmb.tracks.delete` | hanya jika `GET /pmb/tracks/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/tracks/export` | EXPORT | `pmb.tracks.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/form-schemas` | READ | `pmb.form_schemas.read` | list (filter/sort/cursor); detail `GET /pmb/form-schemas/:id` — `form_schemas` |
| `POST /pmb/form-schemas` | CREATE | `pmb.form_schemas.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/form-schemas/:id` | UPDATE | `pmb.form_schemas.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/form-schemas/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.form_schemas.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/form-schemas/:id` | DELETE | `pmb.form_schemas.delete` | hanya jika `GET /pmb/form-schemas/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/form-schemas/export` | EXPORT | `pmb.form_schemas.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/applicants` | READ | `pmb.applicants.read` | list (filter/sort/cursor); detail `GET /pmb/applicants/:id` — `pmb_applicants` |
| `POST /pmb/applicants` | CREATE | `pmb.applicants.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/applicants/:id` | UPDATE | `pmb.applicants.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/applicants/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.applicants.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/applicants/:id` | DELETE | `pmb.applicants.delete` | hanya jika `GET /pmb/applicants/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/applicants/export` | EXPORT | `pmb.applicants.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/documents` | READ | `pmb.documents.read` | list (filter/sort/cursor); detail `GET /pmb/documents/:id` — `pmb_documents` |
| `POST /pmb/documents` | CREATE | `pmb.documents.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/documents/:id` | UPDATE | `pmb.documents.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/documents/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.documents.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/documents/:id` | DELETE | `pmb.documents.delete` | hanya jika `GET /pmb/documents/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/documents/export` | EXPORT | `pmb.documents.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/question-banks` | READ | `pmb.question_banks.read` | list (filter/sort/cursor); detail `GET /pmb/question-banks/:id` — `cbt_question_banks` |
| `POST /pmb/question-banks` | CREATE | `pmb.question_banks.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/question-banks/:id` | UPDATE | `pmb.question_banks.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/question-banks/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.question_banks.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/question-banks/:id` | DELETE | `pmb.question_banks.delete` | hanya jika `GET /pmb/question-banks/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/question-banks/export` | EXPORT | `pmb.question_banks.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pmb/questions` | READ | `pmb.questions.read` | list (filter/sort/cursor); detail `GET /pmb/questions/:id` — `cbt_questions` |
| `POST /pmb/questions` | CREATE | `pmb.questions.create` | wajib `Idempotency-Key` |
| `PATCH /pmb/questions/:id` | UPDATE | `pmb.questions.update` | wajib `If-Match` (versi baris) |
| `POST /pmb/questions/:id/toggle-active` | TOGGLE_ACTIVE | `pmb.questions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pmb/questions/:id` | DELETE | `pmb.questions.delete` | hanya jika `GET /pmb/questions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pmb/questions/export` | EXPORT | `pmb.questions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /pmb/documents/:id/ocr` | UPDATE | `pmb.documents.update` | jalankan OCR lokal (job worker) |
| `POST /pmb/documents/:id/verify` | APPROVE | `pmb.documents.approve` | verifikasi dokumen |
| `POST /pmb/documents/:id/reject` | REJECT | `pmb.documents.reject` | tolak dokumen + alasan |
| `POST /pmb/applicants/:id/decide` | APPROVE | `pmb.applicants.approve` | keputusan seleksi |
| `POST /pmb/applicants/:id/register` | UPDATE | `pmb.applicants.update` | daftar ulang → event registrasi |
| `GET /pmb/parameters` · `POST /pmb/parameters/:key/versions` | READ · PARAM_EDIT | `pmb.parameters.read` · `pmb.parameters.param_edit` | parameter modul: `pmb.ocr.match_threshold`, `pmb.ocr.langs`, `pmb.max_program_choices` |

#### 6.5.10 M-10 — Keuangan & Billing

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /finance/fee-components` | READ | `finance.fee_components.read` | list (filter/sort/cursor); detail `GET /finance/fee-components/:id` — `fee_components` |
| `POST /finance/fee-components` | CREATE | `finance.fee_components.create` | wajib `Idempotency-Key` |
| `PATCH /finance/fee-components/:id` | UPDATE | `finance.fee_components.update` | wajib `If-Match` (versi baris) |
| `POST /finance/fee-components/:id/toggle-active` | TOGGLE_ACTIVE | `finance.fee_components.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/fee-components/:id` | DELETE | `finance.fee_components.delete` | hanya jika `GET /finance/fee-components/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/fee-components/export` | EXPORT | `finance.fee_components.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /finance/tariff-rules` | READ | `finance.tariff_rules.read` | list (filter/sort/cursor); detail `GET /finance/tariff-rules/:id` — `tariff_rules` |
| `POST /finance/tariff-rules` | CREATE | `finance.tariff_rules.create` | wajib `Idempotency-Key` |
| `PATCH /finance/tariff-rules/:id` | UPDATE | `finance.tariff_rules.update` | wajib `If-Match` (versi baris) |
| `POST /finance/tariff-rules/:id/toggle-active` | TOGGLE_ACTIVE | `finance.tariff_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/tariff-rules/:id` | DELETE | `finance.tariff_rules.delete` | hanya jika `GET /finance/tariff-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/tariff-rules/export` | EXPORT | `finance.tariff_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /finance/invoices` | READ | `finance.invoices.read` | list (filter/sort/cursor); detail `GET /finance/invoices/:id` — `invoices` |
| `POST /finance/invoices` | CREATE | `finance.invoices.create` | wajib `Idempotency-Key` |
| `PATCH /finance/invoices/:id` | UPDATE | `finance.invoices.update` | wajib `If-Match` (versi baris) |
| `POST /finance/invoices/:id/toggle-active` | TOGGLE_ACTIVE | `finance.invoices.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/invoices/:id` | DELETE | `finance.invoices.delete` | hanya jika `GET /finance/invoices/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/invoices/export` | EXPORT | `finance.invoices.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /finance/payments` | READ | `finance.payments.read` | list (filter/sort/cursor); detail `GET /finance/payments/:id` — `payments` |
| `POST /finance/payments` | CREATE | `finance.payments.create` | wajib `Idempotency-Key` |
| `PATCH /finance/payments/:id` | UPDATE | `finance.payments.update` | wajib `If-Match` (versi baris) |
| `POST /finance/payments/:id/toggle-active` | TOGGLE_ACTIVE | `finance.payments.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/payments/:id` | DELETE | `finance.payments.delete` | hanya jika `GET /finance/payments/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/payments/export` | EXPORT | `finance.payments.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /finance/journals` | READ | `finance.journals.read` | list (filter/sort/cursor); detail `GET /finance/journals/:id` — `finance_journals` |
| `POST /finance/journals` | CREATE | `finance.journals.create` | wajib `Idempotency-Key` |
| `PATCH /finance/journals/:id` | UPDATE | `finance.journals.update` | wajib `If-Match` (versi baris) |
| `POST /finance/journals/:id/toggle-active` | TOGGLE_ACTIVE | `finance.journals.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/journals/:id` | DELETE | `finance.journals.delete` | hanya jika `GET /finance/journals/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/journals/export` | EXPORT | `finance.journals.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /finance/budget-lines` | READ | `finance.budget_lines.read` | list (filter/sort/cursor); detail `GET /finance/budget-lines/:id` — `budget_lines` |
| `POST /finance/budget-lines` | CREATE | `finance.budget_lines.create` | wajib `Idempotency-Key` |
| `PATCH /finance/budget-lines/:id` | UPDATE | `finance.budget_lines.update` | wajib `If-Match` (versi baris) |
| `POST /finance/budget-lines/:id/toggle-active` | TOGGLE_ACTIVE | `finance.budget_lines.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /finance/budget-lines/:id` | DELETE | `finance.budget_lines.delete` | hanya jika `GET /finance/budget-lines/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /finance/budget-lines/export` | EXPORT | `finance.budget_lines.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /finance/invoices/generate` | CREATE | `finance.invoices.create` | generate massal dari matrix (idempoten per periode) |
| `POST /finance/webhooks/va/:provider` | CREATE | `finance.webhooks.create` | webhook VA (HMAC, idempoten) |
| `POST /finance/invoices/:id/void` | APPROVE | `finance.invoices.approve` | void (empat-mata, BR finance.invoice.void) |
| `POST /finance/payments/:id/confirm` | APPROVE | `finance.payments.approve` | konfirmasi manual |
| `POST /finance/periods/:id/lock` | LOCK | `finance.periods.lock` | tutup buku |
| `POST /finance/periods/:id/unlock` | UNLOCK | `finance.periods.unlock` | buka buku (TREASURER) |
| `GET /finance/reports/aging` | EXPORT | `finance.reports.export` | umur piutang |
| `GET /finance/parameters` · `POST /finance/parameters/:key/versions` | READ · PARAM_EDIT | `finance.parameters.read` · `finance.parameters.param_edit` | parameter modul: `finance.va.expiry_hours`, `finance.hold.krs_block`, `finance.installment.max` |

#### 6.5.11 M-11 — KIP-K & Beasiswa

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /scholarship/programs` | READ | `scholarship.programs.read` | list (filter/sort/cursor); detail `GET /scholarship/programs/:id` — `scholarship_programs` |
| `POST /scholarship/programs` | CREATE | `scholarship.programs.create` | wajib `Idempotency-Key` |
| `PATCH /scholarship/programs/:id` | UPDATE | `scholarship.programs.update` | wajib `If-Match` (versi baris) |
| `POST /scholarship/programs/:id/toggle-active` | TOGGLE_ACTIVE | `scholarship.programs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /scholarship/programs/:id` | DELETE | `scholarship.programs.delete` | hanya jika `GET /scholarship/programs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /scholarship/programs/export` | EXPORT | `scholarship.programs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /scholarship/applications` | READ | `scholarship.applications.read` | list (filter/sort/cursor); detail `GET /scholarship/applications/:id` — `scholarship_applications` |
| `POST /scholarship/applications` | CREATE | `scholarship.applications.create` | wajib `Idempotency-Key` |
| `PATCH /scholarship/applications/:id` | UPDATE | `scholarship.applications.update` | wajib `If-Match` (versi baris) |
| `POST /scholarship/applications/:id/toggle-active` | TOGGLE_ACTIVE | `scholarship.applications.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /scholarship/applications/:id` | DELETE | `scholarship.applications.delete` | hanya jika `GET /scholarship/applications/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /scholarship/applications/export` | EXPORT | `scholarship.applications.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /scholarship/awards` | READ | `scholarship.awards.read` | list (filter/sort/cursor); detail `GET /scholarship/awards/:id` — `scholarship_awards` |
| `POST /scholarship/awards` | CREATE | `scholarship.awards.create` | wajib `Idempotency-Key` |
| `PATCH /scholarship/awards/:id` | UPDATE | `scholarship.awards.update` | wajib `If-Match` (versi baris) |
| `POST /scholarship/awards/:id/toggle-active` | TOGGLE_ACTIVE | `scholarship.awards.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /scholarship/awards/:id` | DELETE | `scholarship.awards.delete` | hanya jika `GET /scholarship/awards/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /scholarship/awards/export` | EXPORT | `scholarship.awards.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /scholarship/disbursements` | READ | `scholarship.disbursements.read` | list (filter/sort/cursor); detail `GET /scholarship/disbursements/:id` — `allowance_disbursements` |
| `POST /scholarship/disbursements` | CREATE | `scholarship.disbursements.create` | wajib `Idempotency-Key` |
| `PATCH /scholarship/disbursements/:id` | UPDATE | `scholarship.disbursements.update` | wajib `If-Match` (versi baris) |
| `POST /scholarship/disbursements/:id/toggle-active` | TOGGLE_ACTIVE | `scholarship.disbursements.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /scholarship/disbursements/:id` | DELETE | `scholarship.disbursements.delete` | hanya jika `GET /scholarship/disbursements/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /scholarship/disbursements/export` | EXPORT | `scholarship.disbursements.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /scholarship/programs/:id/score` | UPDATE | `scholarship.programs.update` | hitung AHP & ranking |
| `POST /scholarship/applications/:id/approve` | APPROVE | `scholarship.applications.approve` | tetapkan penerima → diskon billing M-10 |
| `POST /scholarship/applications/:id/reject` | REJECT | `scholarship.applications.reject` | tolak |
| `POST /scholarship/awards/:id/freeze` | LOCK | `scholarship.awards.lock` | bekukan otomatis/manual |
| `POST /scholarship/awards/:id/unfreeze` | UNLOCK | `scholarship.awards.unlock` | cairkan kembali |
| `GET /scholarship/reports/export` | EXPORT | `scholarship.reports.export` | laporan Puslapdik |
| `GET /scholarship/parameters` · `POST /scholarship/parameters/:key/versions` | READ · PARAM_EDIT | `scholarship.parameters.read` · `scholarship.parameters.param_edit` | parameter modul: `scholarship.min_gpa`, `scholarship.freeze_after_warnings`, `scholarship.cr_max` |

#### 6.5.12 M-12 — Kurikulum OBE

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| → `/admin/kurikulum` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.kurikulum` | `curricula` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| `GET /academic/plos` | READ | `academic.plos.read` | list (filter/sort/cursor); detail `GET /academic/plos/:id` — `plos` |
| `POST /academic/plos` | CREATE | `academic.plos.create` | wajib `Idempotency-Key` |
| `PATCH /academic/plos/:id` | UPDATE | `academic.plos.update` | wajib `If-Match` (versi baris) |
| `POST /academic/plos/:id/toggle-active` | TOGGLE_ACTIVE | `academic.plos.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/plos/:id` | DELETE | `academic.plos.delete` | hanya jika `GET /academic/plos/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/plos/export` | EXPORT | `academic.plos.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| → `/admin/matakuliah` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.matakuliah` | `courses` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| → `/admin/prasyarat` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.prasyarat` | `course_prerequisites` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| `GET /academic/clos` | READ | `academic.clos.read` | list (filter/sort/cursor); detail `GET /academic/clos/:id` — `clos` |
| `POST /academic/clos` | CREATE | `academic.clos.create` | wajib `Idempotency-Key` |
| `PATCH /academic/clos/:id` | UPDATE | `academic.clos.update` | wajib `If-Match` (versi baris) |
| `POST /academic/clos/:id/toggle-active` | TOGGLE_ACTIVE | `academic.clos.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/clos/:id` | DELETE | `academic.clos.delete` | hanya jika `GET /academic/clos/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/clos/export` | EXPORT | `academic.clos.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /academic/clo-plo-maps` | READ | `academic.clo_plo_maps.read` | list (filter/sort/cursor); detail `GET /academic/clo-plo-maps/:id` — `clo_plo_maps` |
| `POST /academic/clo-plo-maps` | CREATE | `academic.clo_plo_maps.create` | wajib `Idempotency-Key` |
| `PATCH /academic/clo-plo-maps/:id` | UPDATE | `academic.clo_plo_maps.update` | wajib `If-Match` (versi baris) |
| `POST /academic/clo-plo-maps/:id/toggle-active` | TOGGLE_ACTIVE | `academic.clo_plo_maps.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/clo-plo-maps/:id` | DELETE | `academic.clo_plo_maps.delete` | hanya jika `GET /academic/clo-plo-maps/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/clo-plo-maps/export` | EXPORT | `academic.clo_plo_maps.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /academic/rps` | READ | `academic.rps.read` | list (filter/sort/cursor); detail `GET /academic/rps/:id` — `rps_documents` |
| `POST /academic/rps` | CREATE | `academic.rps.create` | wajib `Idempotency-Key` |
| `PATCH /academic/rps/:id` | UPDATE | `academic.rps.update` | wajib `If-Match` (versi baris) |
| `POST /academic/rps/:id/toggle-active` | TOGGLE_ACTIVE | `academic.rps.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/rps/:id` | DELETE | `academic.rps.delete` | hanya jika `GET /academic/rps/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/rps/export` | EXPORT | `academic.rps.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /academic/rpl-conversions` | READ | `academic.rpl_conversions.read` | list (filter/sort/cursor); detail `GET /academic/rpl-conversions/:id` — `rpl_conversions` |
| `POST /academic/rpl-conversions` | CREATE | `academic.rpl_conversions.create` | wajib `Idempotency-Key` |
| `PATCH /academic/rpl-conversions/:id` | UPDATE | `academic.rpl_conversions.update` | wajib `If-Match` (versi baris) |
| `POST /academic/rpl-conversions/:id/toggle-active` | TOGGLE_ACTIVE | `academic.rpl_conversions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/rpl-conversions/:id` | DELETE | `academic.rpl_conversions.delete` | hanya jika `GET /academic/rpl-conversions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/rpl-conversions/export` | EXPORT | `academic.rpl_conversions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /academic/curricula/:id/validate-dag` | READ | `academic.curricula.read` | topological sort & deteksi siklus |
| `POST /academic/rps/:id/approve` | APPROVE | `academic.rps.approve` | setujui RPS |
| `POST /academic/rps/:id/reject` | REJECT | `academic.rps.reject` | kembalikan RPS |
| `POST /academic/curricula/:id/lock` | LOCK | `academic.curricula.lock` | kunci kurikulum |
| `POST /academic/curricula/:id/unlock` | UNLOCK | `academic.curricula.unlock` | buka (empat-mata) |
| `GET /academic/plo-attainment/export` | EXPORT | `academic.plo_attainment.export` | matriks CPL |
| `POST /academic/rpl-conversions/:id/approve` | APPROVE | `academic.rpl_conversions.approve` | sahkan ekuivalensi RPL → SKS transfer M-19 & billing matrikulasi M-10 |
| `GET /academic/parameters` · `POST /academic/parameters/:key/versions` | READ · PARAM_EDIT | `academic.parameters.read` · `academic.parameters.param_edit` | parameter modul: `obe.plo_pass_threshold`, `curriculum.min_total_sks` |

#### 6.5.13 M-13 — KRS Online & Perwalian

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /enrollment/advising-sessions` | READ | `enrollment.advising_sessions.read` | list (filter/sort/cursor); detail `GET /enrollment/advising-sessions/:id` — `advising_sessions` |
| `POST /enrollment/advising-sessions` | CREATE | `enrollment.advising_sessions.create` | wajib `Idempotency-Key` |
| `PATCH /enrollment/advising-sessions/:id` | UPDATE | `enrollment.advising_sessions.update` | wajib `If-Match` (versi baris) |
| `POST /enrollment/advising-sessions/:id/toggle-active` | TOGGLE_ACTIVE | `enrollment.advising_sessions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /enrollment/advising-sessions/:id` | DELETE | `enrollment.advising_sessions.delete` | hanya jika `GET /enrollment/advising-sessions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /enrollment/advising-sessions/export` | EXPORT | `enrollment.advising_sessions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /enrollment/krs` | READ | `enrollment.krs.read` | list (filter/sort/cursor); detail `GET /enrollment/krs/:id` — `krs_headers` |
| `POST /enrollment/krs` | CREATE | `enrollment.krs.create` | wajib `Idempotency-Key` |
| `PATCH /enrollment/krs/:id` | UPDATE | `enrollment.krs.update` | wajib `If-Match` (versi baris) |
| `POST /enrollment/krs/:id/toggle-active` | TOGGLE_ACTIVE | `enrollment.krs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /enrollment/krs/:id` | DELETE | `enrollment.krs.delete` | hanya jika `GET /enrollment/krs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /enrollment/krs/export` | EXPORT | `enrollment.krs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /enrollment/krs-items` | READ | `enrollment.krs_items.read` | list (filter/sort/cursor); detail `GET /enrollment/krs-items/:id` — `krs_items` |
| `POST /enrollment/krs-items` | CREATE | `enrollment.krs_items.create` | wajib `Idempotency-Key` |
| `PATCH /enrollment/krs-items/:id` | UPDATE | `enrollment.krs_items.update` | wajib `If-Match` (versi baris) |
| `POST /enrollment/krs-items/:id/toggle-active` | TOGGLE_ACTIVE | `enrollment.krs_items.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /enrollment/krs-items/:id` | DELETE | `enrollment.krs_items.delete` | hanya jika `GET /enrollment/krs-items/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /enrollment/krs-items/export` | EXPORT | `enrollment.krs_items.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /enrollment/war-windows` | READ | `enrollment.war_windows.read` | list (filter/sort/cursor); detail `GET /enrollment/war-windows/:id` — `krs_war_windows` |
| `POST /enrollment/war-windows` | CREATE | `enrollment.war_windows.create` | wajib `Idempotency-Key` |
| `PATCH /enrollment/war-windows/:id` | UPDATE | `enrollment.war_windows.update` | wajib `If-Match` (versi baris) |
| `POST /enrollment/war-windows/:id/toggle-active` | TOGGLE_ACTIVE | `enrollment.war_windows.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /enrollment/war-windows/:id` | DELETE | `enrollment.war_windows.delete` | hanya jika `GET /enrollment/war-windows/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /enrollment/war-windows/export` | EXPORT | `enrollment.war_windows.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /enrollment/sks-limit-rules` | READ | `enrollment.sks_limit_rules.read` | list (filter/sort/cursor); detail `GET /enrollment/sks-limit-rules/:id` — `sks_limit_rules` |
| `POST /enrollment/sks-limit-rules` | CREATE | `enrollment.sks_limit_rules.create` | wajib `Idempotency-Key` |
| `PATCH /enrollment/sks-limit-rules/:id` | UPDATE | `enrollment.sks_limit_rules.update` | wajib `If-Match` (versi baris) |
| `POST /enrollment/sks-limit-rules/:id/toggle-active` | TOGGLE_ACTIVE | `enrollment.sks_limit_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /enrollment/sks-limit-rules/:id` | DELETE | `enrollment.sks_limit_rules.delete` | hanya jika `GET /enrollment/sks-limit-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /enrollment/sks-limit-rules/export` | EXPORT | `enrollment.sks_limit_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /enrollment/krs/:id/items/reserve` | CREATE | `enrollment.krs.create` | reservasi kursi (Redlock, idempoten) |
| → `POST /academic/krs/submit (§4.2.2)` | UPDATE | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| `POST /enrollment/krs/:id/approve` | APPROVE | `enrollment.krs.approve` | enrollment.krs.approve oleh dosen wali |
| `POST /enrollment/krs/:id/reject` | REJECT | `enrollment.krs.reject` | kembalikan dengan catatan |
| `POST /enrollment/periods/:id/krs-lock` | LOCK | `enrollment.periods.lock` | tutup KRS |
| `POST /enrollment/krs/:id/unlock` | UNLOCK | `enrollment.krs.unlock` | buka KRS individual (BAAK) |
| `GET /enrollment/parameters` · `POST /enrollment/parameters/:key/versions` | READ · PARAM_EDIT | `enrollment.parameters.read` · `enrollment.parameters.param_edit` | parameter modul: `krs.reservation_ttl_seconds`, `krs.war.rate_limit_per_min`, `krs.require_adviser_approval` |

#### 6.5.14 M-14 — Jadwal & Ruang

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| → `/admin/ruang` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.ruang` | `rooms` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| `GET /schedule/time-slots` | READ | `scheduling.time_slots.read` | list (filter/sort/cursor); detail `GET /schedule/time-slots/:id` — `time_slots` |
| `POST /schedule/time-slots` | CREATE | `scheduling.time_slots.create` | wajib `Idempotency-Key` |
| `PATCH /schedule/time-slots/:id` | UPDATE | `scheduling.time_slots.update` | wajib `If-Match` (versi baris) |
| `POST /schedule/time-slots/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.time_slots.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /schedule/time-slots/:id` | DELETE | `scheduling.time_slots.delete` | hanya jika `GET /schedule/time-slots/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /schedule/time-slots/export` | EXPORT | `scheduling.time_slots.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /schedule/constraints` | READ | `scheduling.constraints.read` | list (filter/sort/cursor); detail `GET /schedule/constraints/:id` — `schedule_constraints` |
| `POST /schedule/constraints` | CREATE | `scheduling.constraints.create` | wajib `Idempotency-Key` |
| `PATCH /schedule/constraints/:id` | UPDATE | `scheduling.constraints.update` | wajib `If-Match` (versi baris) |
| `POST /schedule/constraints/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.constraints.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /schedule/constraints/:id` | DELETE | `scheduling.constraints.delete` | hanya jika `GET /schedule/constraints/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /schedule/constraints/export` | EXPORT | `scheduling.constraints.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /schedule/runs` | READ | `scheduling.runs.read` | list (filter/sort/cursor); detail `GET /schedule/runs/:id` — `schedule_runs` |
| `POST /schedule/runs` | CREATE | `scheduling.runs.create` | wajib `Idempotency-Key` |
| `PATCH /schedule/runs/:id` | UPDATE | `scheduling.runs.update` | wajib `If-Match` (versi baris) |
| `POST /schedule/runs/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.runs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /schedule/runs/:id` | DELETE | `scheduling.runs.delete` | hanya jika `GET /schedule/runs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /schedule/runs/export` | EXPORT | `scheduling.runs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /schedule/meetings` | READ | `scheduling.meetings.read` | list (filter/sort/cursor); detail `GET /schedule/meetings/:id` — `class_meetings` |
| `POST /schedule/meetings` | CREATE | `scheduling.meetings.create` | wajib `Idempotency-Key` |
| `PATCH /schedule/meetings/:id` | UPDATE | `scheduling.meetings.update` | wajib `If-Match` (versi baris) |
| `POST /schedule/meetings/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.meetings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /schedule/meetings/:id` | DELETE | `scheduling.meetings.delete` | hanya jika `GET /schedule/meetings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /schedule/meetings/export` | EXPORT | `scheduling.meetings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /schedule/room-bookings` | READ | `scheduling.room_bookings.read` | list (filter/sort/cursor); detail `GET /schedule/room-bookings/:id` — `room_bookings` |
| `POST /schedule/room-bookings` | CREATE | `scheduling.room_bookings.create` | wajib `Idempotency-Key` |
| `PATCH /schedule/room-bookings/:id` | UPDATE | `scheduling.room_bookings.update` | wajib `If-Match` (versi baris) |
| `POST /schedule/room-bookings/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.room_bookings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /schedule/room-bookings/:id` | DELETE | `scheduling.room_bookings.delete` | hanya jika `GET /schedule/room-bookings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /schedule/room-bookings/export` | EXPORT | `scheduling.room_bookings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /schedule/runs/:id/publish` | APPROVE | `scheduling.runs.approve` | publikasikan jadwal |
| `POST /schedule/meetings/:id/lock` | LOCK | `scheduling.meetings.lock` | kunci slot |
| `POST /schedule/meetings/:id/unlock` | UNLOCK | `scheduling.meetings.unlock` | buka slot |
| `GET /schedule/export` | EXPORT | `scheduling.export.export` | jadwal PDF/ICS |
| `GET /schedule/parameters` · `POST /schedule/parameters/:key/versions` | READ · PARAM_EDIT | `scheduling.parameters.read` · `scheduling.parameters.param_edit` | parameter modul: `schedule.solver_timeout_seconds`, `schedule.min_break_minutes` |

#### 6.5.15 M-15 — Moda Perkuliahan

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /teaching/sessions` | READ | `teaching.sessions.read` | list (filter/sort/cursor); detail `GET /teaching/sessions/:id` — `lecture_sessions` |
| `POST /teaching/sessions` | CREATE | `teaching.sessions.create` | wajib `Idempotency-Key` |
| `PATCH /teaching/sessions/:id` | UPDATE | `teaching.sessions.update` | wajib `If-Match` (versi baris) |
| `POST /teaching/sessions/:id/toggle-active` | TOGGLE_ACTIVE | `teaching.sessions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /teaching/sessions/:id` | DELETE | `teaching.sessions.delete` | hanya jika `GET /teaching/sessions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /teaching/sessions/export` | EXPORT | `teaching.sessions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /teaching/shift-allocations` | READ | `teaching.shift_allocations.read` | list (filter/sort/cursor); detail `GET /teaching/shift-allocations/:id` — `shift_allocations` |
| `POST /teaching/shift-allocations` | CREATE | `teaching.shift_allocations.create` | wajib `Idempotency-Key` |
| `PATCH /teaching/shift-allocations/:id` | UPDATE | `teaching.shift_allocations.update` | wajib `If-Match` (versi baris) |
| `POST /teaching/shift-allocations/:id/toggle-active` | TOGGLE_ACTIVE | `teaching.shift_allocations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /teaching/shift-allocations/:id` | DELETE | `teaching.shift_allocations.delete` | hanya jika `GET /teaching/shift-allocations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /teaching/shift-allocations/export` | EXPORT | `teaching.shift_allocations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /teaching/reconciliation-rules` | READ | `teaching.reconciliation_rules.read` | list (filter/sort/cursor); detail `GET /teaching/reconciliation-rules/:id` — `reconciliation_rules` |
| `POST /teaching/reconciliation-rules` | CREATE | `teaching.reconciliation_rules.create` | wajib `Idempotency-Key` |
| `PATCH /teaching/reconciliation-rules/:id` | UPDATE | `teaching.reconciliation_rules.update` | wajib `If-Match` (versi baris) |
| `POST /teaching/reconciliation-rules/:id/toggle-active` | TOGGLE_ACTIVE | `teaching.reconciliation_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /teaching/reconciliation-rules/:id` | DELETE | `teaching.reconciliation_rules.delete` | hanya jika `GET /teaching/reconciliation-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /teaching/reconciliation-rules/export` | EXPORT | `teaching.reconciliation_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /teaching/sessions/:id/mode` | UPDATE | `teaching.sessions.update` | ubah moda sesi (event ke M-18, M-34) |
| `POST /teaching/sessions/:id/provision-meeting` | CREATE | `teaching.sessions.create` | auto-provision rapat daring |
| `POST /teaching/sessions/:id/close` | LOCK | `teaching.sessions.lock` | tutup sesi → rekonsiliasi |
| `GET /teaching/parameters` · `POST /teaching/parameters/:key/versions` | READ · PARAM_EDIT | `teaching.parameters.read` · `teaching.parameters.param_edit` | parameter modul: `mode.online_min_join_ratio`, `mode.meeting_provider` |

#### 6.5.16 M-16 — LMS Digital

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /lms/courses` | READ | `lms.courses.read` | list (filter/sort/cursor); detail `GET /lms/courses/:id` — `lms_courses` |
| `POST /lms/courses` | CREATE | `lms.courses.create` | wajib `Idempotency-Key` |
| `PATCH /lms/courses/:id` | UPDATE | `lms.courses.update` | wajib `If-Match` (versi baris) |
| `POST /lms/courses/:id/toggle-active` | TOGGLE_ACTIVE | `lms.courses.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/courses/:id` | DELETE | `lms.courses.delete` | hanya jika `GET /lms/courses/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/courses/export` | EXPORT | `lms.courses.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lms/materials` | READ | `lms.materials.read` | list (filter/sort/cursor); detail `GET /lms/materials/:id` — `lms_materials` |
| `POST /lms/materials` | CREATE | `lms.materials.create` | wajib `Idempotency-Key` |
| `PATCH /lms/materials/:id` | UPDATE | `lms.materials.update` | wajib `If-Match` (versi baris) |
| `POST /lms/materials/:id/toggle-active` | TOGGLE_ACTIVE | `lms.materials.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/materials/:id` | DELETE | `lms.materials.delete` | hanya jika `GET /lms/materials/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/materials/export` | EXPORT | `lms.materials.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lms/assignments` | READ | `lms.assignments.read` | list (filter/sort/cursor); detail `GET /lms/assignments/:id` — `lms_assignments` |
| `POST /lms/assignments` | CREATE | `lms.assignments.create` | wajib `Idempotency-Key` |
| `PATCH /lms/assignments/:id` | UPDATE | `lms.assignments.update` | wajib `If-Match` (versi baris) |
| `POST /lms/assignments/:id/toggle-active` | TOGGLE_ACTIVE | `lms.assignments.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/assignments/:id` | DELETE | `lms.assignments.delete` | hanya jika `GET /lms/assignments/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/assignments/export` | EXPORT | `lms.assignments.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lms/submissions` | READ | `lms.submissions.read` | list (filter/sort/cursor); detail `GET /lms/submissions/:id` — `lms_submissions` |
| → `POST /lms/assignments/:id/submit (§4.4.3)` | CREATE | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| `PATCH /lms/submissions/:id` | UPDATE | `lms.submissions.update` | wajib `If-Match` (versi baris) |
| `POST /lms/submissions/:id/toggle-active` | TOGGLE_ACTIVE | `lms.submissions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/submissions/:id` | DELETE | `lms.submissions.delete` | hanya jika `GET /lms/submissions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/submissions/export` | EXPORT | `lms.submissions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lms/quizzes` | READ | `lms.quizzes.read` | list (filter/sort/cursor); detail `GET /lms/quizzes/:id` — `lms_quizzes` |
| `POST /lms/quizzes` | CREATE | `lms.quizzes.create` | wajib `Idempotency-Key` |
| `PATCH /lms/quizzes/:id` | UPDATE | `lms.quizzes.update` | wajib `If-Match` (versi baris) |
| `POST /lms/quizzes/:id/toggle-active` | TOGGLE_ACTIVE | `lms.quizzes.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/quizzes/:id` | DELETE | `lms.quizzes.delete` | hanya jika `GET /lms/quizzes/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/quizzes/export` | EXPORT | `lms.quizzes.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lms/discussions` | READ | `lms.discussions.read` | list (filter/sort/cursor); detail `GET /lms/discussions/:id` — `lms_discussions` |
| `POST /lms/discussions` | CREATE | `lms.discussions.create` | wajib `Idempotency-Key` |
| `PATCH /lms/discussions/:id` | UPDATE | `lms.discussions.update` | wajib `If-Match` (versi baris) |
| `POST /lms/discussions/:id/toggle-active` | TOGGLE_ACTIVE | `lms.discussions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lms/discussions/:id` | DELETE | `lms.discussions.delete` | hanya jika `GET /lms/discussions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lms/discussions/export` | EXPORT | `lms.discussions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /lms/materials/:id/scorm-import` | CREATE | `lms.materials.create` | parse paket SCORM |
| `POST /lms/xapi/statements` | CREATE | `lms.xapi.create` | endpoint LRS lokal |
| `GET /lms/search` | READ | `lms.search.read` | TF-IDF lokal |
| `POST /lms/submissions/:id/grade` | UPDATE | `lms.submissions.update` | nilai → M-19 |
| `GET /lms/courses/:id/export` | EXPORT | `lms.courses.export` | rekap progres |
| `GET /lms/parameters` · `POST /lms/parameters/:key/versions` | READ · PARAM_EDIT | `lms.parameters.read` · `lms.parameters.param_edit` | parameter modul: `lms.video_complete_ratio`, `lms.max_upload_mb` |

#### 6.5.17 M-17 — Ujian & Proctoring

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /cbt/exams` | READ | `cbt.exams.read` | list (filter/sort/cursor); detail `GET /cbt/exams/:id` — `exams` |
| `POST /cbt/exams` | CREATE | `cbt.exams.create` | wajib `Idempotency-Key` |
| `PATCH /cbt/exams/:id` | UPDATE | `cbt.exams.update` | wajib `If-Match` (versi baris) |
| `POST /cbt/exams/:id/toggle-active` | TOGGLE_ACTIVE | `cbt.exams.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /cbt/exams/:id` | DELETE | `cbt.exams.delete` | hanya jika `GET /cbt/exams/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /cbt/exams/export` | EXPORT | `cbt.exams.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /cbt/attempts` | READ | `cbt.attempts.read` | list (filter/sort/cursor); detail `GET /cbt/attempts/:id` — `exam_attempts` |
| `POST /cbt/attempts` | CREATE | `cbt.attempts.create` | wajib `Idempotency-Key` |
| `PATCH /cbt/attempts/:id` | UPDATE | `cbt.attempts.update` | wajib `If-Match` (versi baris) |
| `POST /cbt/attempts/:id/toggle-active` | TOGGLE_ACTIVE | `cbt.attempts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /cbt/attempts/:id` | DELETE | `cbt.attempts.delete` | hanya jika `GET /cbt/attempts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /cbt/attempts/export` | EXPORT | `cbt.attempts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /cbt/proctoring-profiles` | READ | `cbt.proctoring_profiles.read` | list (filter/sort/cursor); detail `GET /cbt/proctoring-profiles/:id` — `proctoring_profiles` |
| `POST /cbt/proctoring-profiles` | CREATE | `cbt.proctoring_profiles.create` | wajib `Idempotency-Key` |
| `PATCH /cbt/proctoring-profiles/:id` | UPDATE | `cbt.proctoring_profiles.update` | wajib `If-Match` (versi baris) |
| `POST /cbt/proctoring-profiles/:id/toggle-active` | TOGGLE_ACTIVE | `cbt.proctoring_profiles.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /cbt/proctoring-profiles/:id` | DELETE | `cbt.proctoring_profiles.delete` | hanya jika `GET /cbt/proctoring-profiles/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /cbt/proctoring-profiles/export` | EXPORT | `cbt.proctoring_profiles.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /cbt/flags` | READ | `cbt.flags.read` | list (filter/sort/cursor); detail `GET /cbt/flags/:id` — `proctoring_flags` |
| `POST /cbt/flags` | CREATE | `cbt.flags.create` | wajib `Idempotency-Key` |
| `PATCH /cbt/flags/:id` | UPDATE | `cbt.flags.update` | wajib `If-Match` (versi baris) |
| `POST /cbt/flags/:id/toggle-active` | TOGGLE_ACTIVE | `cbt.flags.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /cbt/flags/:id` | DELETE | `cbt.flags.delete` | hanya jika `GET /cbt/flags/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /cbt/flags/export` | EXPORT | `cbt.flags.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /cbt/attempts/:id/flags` | CREATE | `cbt.attempts.create` | kirim flag dari klien |
| `POST /cbt/attempts/:id/lock` | LOCK | `cbt.attempts.lock` | hentikan attempt |
| `POST /cbt/attempts/:id/unlock` | UNLOCK | `cbt.attempts.unlock` | lanjutkan |
| `POST /cbt/attempts/:id/approve` | APPROVE | `cbt.attempts.approve` | sahkan attempt |
| `POST /cbt/attempts/:id/reject` | REJECT | `cbt.attempts.reject` | batalkan karena pelanggaran |
| `GET /cbt/exams/:id/export` | EXPORT | `cbt.exams.export` | berita acara |
| `GET /cbt/parameters` · `POST /cbt/parameters/:key/versions` | READ · PARAM_EDIT | `cbt.parameters.read` · `cbt.parameters.param_edit` | parameter modul: `proctor.flag_threshold`, `proctor.face_check_interval_s` |

#### 6.5.18 M-18 — Presensi Smart

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /attendance/geofences` | READ | `attendance.geofences.read` | list (filter/sort/cursor); detail `GET /attendance/geofences/:id` — `geofences` |
| `POST /attendance/geofences` | CREATE | `attendance.geofences.create` | wajib `Idempotency-Key` |
| `PATCH /attendance/geofences/:id` | UPDATE | `attendance.geofences.update` | wajib `If-Match` (versi baris) |
| `POST /attendance/geofences/:id/toggle-active` | TOGGLE_ACTIVE | `attendance.geofences.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /attendance/geofences/:id` | DELETE | `attendance.geofences.delete` | hanya jika `GET /attendance/geofences/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /attendance/geofences/export` | EXPORT | `attendance.geofences.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /attendance/sessions` | READ | `attendance.sessions.read` | list (filter/sort/cursor); detail `GET /attendance/sessions/:id` — `attendance_sessions` |
| `POST /attendance/sessions` | CREATE | `attendance.sessions.create` | wajib `Idempotency-Key` |
| `PATCH /attendance/sessions/:id` | UPDATE | `attendance.sessions.update` | wajib `If-Match` (versi baris) |
| `POST /attendance/sessions/:id/toggle-active` | TOGGLE_ACTIVE | `attendance.sessions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /attendance/sessions/:id` | DELETE | `attendance.sessions.delete` | hanya jika `GET /attendance/sessions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /attendance/sessions/export` | EXPORT | `attendance.sessions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /attendance/records` | READ | `attendance.records.read` | list (filter/sort/cursor); detail `GET /attendance/records/:id` — `attendance_records` |
| `POST /attendance/records` | CREATE | `attendance.records.create` | wajib `Idempotency-Key` |
| `PATCH /attendance/records/:id` | UPDATE | `attendance.records.update` | wajib `If-Match` (versi baris) |
| `POST /attendance/records/:id/toggle-active` | TOGGLE_ACTIVE | `attendance.records.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /attendance/records/:id` | DELETE | `attendance.records.delete` | hanya jika `GET /attendance/records/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /attendance/records/export` | EXPORT | `attendance.records.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /attendance/corrections` | READ | `attendance.corrections.read` | list (filter/sort/cursor); detail `GET /attendance/corrections/:id` — `attendance_corrections` |
| `POST /attendance/corrections` | CREATE | `attendance.corrections.create` | wajib `Idempotency-Key` |
| `PATCH /attendance/corrections/:id` | UPDATE | `attendance.corrections.update` | wajib `If-Match` (versi baris) |
| `POST /attendance/corrections/:id/toggle-active` | TOGGLE_ACTIVE | `attendance.corrections.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /attendance/corrections/:id` | DELETE | `attendance.corrections.delete` | hanya jika `GET /attendance/corrections/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /attendance/corrections/export` | EXPORT | `attendance.corrections.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /attendance/sessions/:id/open` | CREATE | `attendance.sessions.create` | buka sesi (dosen) |
| → `POST /attendance/qr/generate (§4.3.1)` | READ | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| → `POST /attendance/qr/scan (§4.3.2)` | CREATE | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| `POST /attendance/sessions/:id/close` | LOCK | `attendance.sessions.lock` | tutup & rekonsiliasi hybrid |
| `POST /attendance/corrections/:id/approve` | APPROVE | `attendance.corrections.approve` | koreksi |
| `POST /attendance/corrections/:id/reject` | REJECT | `attendance.corrections.reject` | tolak koreksi |
| `GET /attendance/export` | EXPORT | `attendance.export.export` | rekap |
| `GET /attendance/parameters` · `POST /attendance/parameters/:key/versions` | READ · PARAM_EDIT | `attendance.parameters.read` · `attendance.parameters.param_edit` | parameter modul: `attendance.qr_step_seconds`, `attendance.qr_tolerance_steps`, `attendance.geofence_radius_m`, `attendance.min_presence_ratio` |

#### 6.5.19 M-19 — Nilai & KHS

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| → `/admin/skala-nilai` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.skala-nilai` | `grade_scales` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| → `/admin/komposisi-nilai` (§4.6) | CRUD + TOGGLE_ACTIVE + EXPORT | `admin.komposisi-nilai` | `grade_components` adalah objek master §4.6 — **kanonik di sana**, tidak didefinisikan ulang |
| `GET /grading/formulas` | READ | `assessment.formulas.read` | list (filter/sort/cursor); detail `GET /grading/formulas/:id` — `grade_formulas` |
| `POST /grading/formulas` | CREATE | `assessment.formulas.create` | wajib `Idempotency-Key` |
| `PATCH /grading/formulas/:id` | UPDATE | `assessment.formulas.update` | wajib `If-Match` (versi baris) |
| `POST /grading/formulas/:id/toggle-active` | TOGGLE_ACTIVE | `assessment.formulas.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /grading/formulas/:id` | DELETE | `assessment.formulas.delete` | hanya jika `GET /grading/formulas/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /grading/formulas/export` | EXPORT | `assessment.formulas.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /grading/values` | READ | `assessment.values.read` | list (filter/sort/cursor); detail `GET /grading/values/:id` — `grade_values` |
| `POST /grading/values` | CREATE | `assessment.values.create` | wajib `Idempotency-Key` |
| `PATCH /grading/values/:id` | UPDATE | `assessment.values.update` | wajib `If-Match` (versi baris) |
| `POST /grading/values/:id/toggle-active` | TOGGLE_ACTIVE | `assessment.values.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /grading/values/:id` | DELETE | `assessment.values.delete` | hanya jika `GET /grading/values/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /grading/values/export` | EXPORT | `assessment.values.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /grading/change-requests` | READ | `assessment.change_requests.read` | list (filter/sort/cursor); detail `GET /grading/change-requests/:id` — `grade_change_requests` |
| `POST /grading/change-requests` | CREATE | `assessment.change_requests.create` | wajib `Idempotency-Key` |
| `PATCH /grading/change-requests/:id` | UPDATE | `assessment.change_requests.update` | wajib `If-Match` (versi baris) |
| `POST /grading/change-requests/:id/toggle-active` | TOGGLE_ACTIVE | `assessment.change_requests.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /grading/change-requests/:id` | DELETE | `assessment.change_requests.delete` | hanya jika `GET /grading/change-requests/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /grading/change-requests/export` | EXPORT | `assessment.change_requests.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /grading/formulas/validate` | READ | `assessment.formulas.read` | validasi AST |
| → `POST /admin/nilai/hitung-ulang (§4.6.3)` | UPDATE | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| → `POST /admin/nilai/kunci (§4.6.3)` | LOCK | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| `POST /grading/classes/:id/unlock` | UNLOCK | `assessment.classes.unlock` | grading.unlock (Kaprodi, empat-mata) |
| `POST /grading/change-requests/:id/approve` | APPROVE | `assessment.change_requests.approve` | setujui perubahan |
| `POST /grading/change-requests/:id/reject` | REJECT | `assessment.change_requests.reject` | tolak |
| `POST /grading/periods/:id/publish-khs` | APPROVE | `assessment.periods.approve` | terbitkan KHS |
| → `GET /academic/transcript (§4.2.4)` | EXPORT | — | **kanonik di §4**; tidak didefinisikan ulang (anti-duplikasi) |
| `GET /grading/parameters` · `POST /grading/parameters/:key/versions` | READ · PARAM_EDIT | `assessment.parameters.read` · `assessment.parameters.param_edit` | parameter modul: `grading.publish_requires_lock`, `grading.rounding_digits` |

#### 6.5.20 M-20 — Tugas Akhir & RAMA

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /thesis/theses` | READ | `thesis.theses.read` | list (filter/sort/cursor); detail `GET /thesis/theses/:id` — `theses` |
| `POST /thesis/theses` | CREATE | `thesis.theses.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/theses/:id` | UPDATE | `thesis.theses.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/theses/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.theses.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/theses/:id` | DELETE | `thesis.theses.delete` | hanya jika `GET /thesis/theses/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/theses/export` | EXPORT | `thesis.theses.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/supervisors` | READ | `thesis.supervisors.read` | list (filter/sort/cursor); detail `GET /thesis/supervisors/:id` — `thesis_supervisors` |
| `POST /thesis/supervisors` | CREATE | `thesis.supervisors.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/supervisors/:id` | UPDATE | `thesis.supervisors.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/supervisors/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.supervisors.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/supervisors/:id` | DELETE | `thesis.supervisors.delete` | hanya jika `GET /thesis/supervisors/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/supervisors/export` | EXPORT | `thesis.supervisors.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/logbooks` | READ | `thesis.logbooks.read` | list (filter/sort/cursor); detail `GET /thesis/logbooks/:id` — `thesis_logbooks` |
| `POST /thesis/logbooks` | CREATE | `thesis.logbooks.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/logbooks/:id` | UPDATE | `thesis.logbooks.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/logbooks/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.logbooks.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/logbooks/:id` | DELETE | `thesis.logbooks.delete` | hanya jika `GET /thesis/logbooks/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/logbooks/export` | EXPORT | `thesis.logbooks.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/defenses` | READ | `thesis.defenses.read` | list (filter/sort/cursor); detail `GET /thesis/defenses/:id` — `thesis_defenses` |
| `POST /thesis/defenses` | CREATE | `thesis.defenses.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/defenses/:id` | UPDATE | `thesis.defenses.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/defenses/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.defenses.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/defenses/:id` | DELETE | `thesis.defenses.delete` | hanya jika `GET /thesis/defenses/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/defenses/export` | EXPORT | `thesis.defenses.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/examiners` | READ | `thesis.examiners.read` | list (filter/sort/cursor); detail `GET /thesis/examiners/:id` — `thesis_examiners` |
| `POST /thesis/examiners` | CREATE | `thesis.examiners.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/examiners/:id` | UPDATE | `thesis.examiners.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/examiners/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.examiners.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/examiners/:id` | DELETE | `thesis.examiners.delete` | hanya jika `GET /thesis/examiners/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/examiners/export` | EXPORT | `thesis.examiners.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/scores` | READ | `thesis.scores.read` | list (filter/sort/cursor); detail `GET /thesis/scores/:id` — `thesis_scores` |
| `POST /thesis/scores` | CREATE | `thesis.scores.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/scores/:id` | UPDATE | `thesis.scores.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/scores/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.scores.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/scores/:id` | DELETE | `thesis.scores.delete` | hanya jika `GET /thesis/scores/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/scores/export` | EXPORT | `thesis.scores.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /thesis/repository` | READ | `thesis.repository.read` | list (filter/sort/cursor); detail `GET /thesis/repository/:id` — `repository_items` |
| `POST /thesis/repository` | CREATE | `thesis.repository.create` | wajib `Idempotency-Key` |
| `PATCH /thesis/repository/:id` | UPDATE | `thesis.repository.update` | wajib `If-Match` (versi baris) |
| `POST /thesis/repository/:id/toggle-active` | TOGGLE_ACTIVE | `thesis.repository.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /thesis/repository/:id` | DELETE | `thesis.repository.delete` | hanya jika `GET /thesis/repository/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /thesis/repository/export` | EXPORT | `thesis.repository.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /thesis/theses/:id/approve-proposal` | APPROVE | `thesis.theses.approve` | Kaprodi setujui judul |
| `POST /thesis/theses/:id/reject-proposal` | REJECT | `thesis.theses.reject` | tolak |
| `POST /thesis/theses/:id/similarity-check` | UPDATE | `thesis.theses.update` | jalankan winnowing |
| `POST /thesis/defenses/:id/approve` | APPROVE | `thesis.defenses.approve` | izinkan sidang |
| `POST /thesis/defenses/:id/lock-scores` | LOCK | `thesis.defenses.lock` | kunci nilai → M-19 |
| `GET /oai-pmh` | READ | `thesis.root.read` | endpoint OAI-PMH publik (Identify, ListRecords) |
| `GET /thesis/reports/export` | EXPORT | `thesis.reports.export` | rekap TA |
| `GET /thesis/parameters` · `POST /thesis/parameters/:key/versions` | READ · PARAM_EDIT | `thesis.parameters.read` · `thesis.parameters.param_edit` | parameter modul: `thesis.min_logbook_entries`, `thesis.plagiarism_max`, `thesis.winnow.k` |

#### 6.5.21 M-21 — Jurnal & OJS

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /journal/journals` | READ | `journal.journals.read` | list (filter/sort/cursor); detail `GET /journal/journals/:id` — `journals` |
| `POST /journal/journals` | CREATE | `journal.journals.create` | wajib `Idempotency-Key` |
| `PATCH /journal/journals/:id` | UPDATE | `journal.journals.update` | wajib `If-Match` (versi baris) |
| `POST /journal/journals/:id/toggle-active` | TOGGLE_ACTIVE | `journal.journals.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /journal/journals/:id` | DELETE | `journal.journals.delete` | hanya jika `GET /journal/journals/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /journal/journals/export` | EXPORT | `journal.journals.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /journal/articles` | READ | `journal.articles.read` | list (filter/sort/cursor); detail `GET /journal/articles/:id` — `journal_articles` |
| `POST /journal/articles` | CREATE | `journal.articles.create` | wajib `Idempotency-Key` |
| `PATCH /journal/articles/:id` | UPDATE | `journal.articles.update` | wajib `If-Match` (versi baris) |
| `POST /journal/articles/:id/toggle-active` | TOGGLE_ACTIVE | `journal.articles.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /journal/articles/:id` | DELETE | `journal.articles.delete` | hanya jika `GET /journal/articles/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /journal/articles/export` | EXPORT | `journal.articles.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /journal/apc-invoices` | READ | `journal.apc_invoices.read` | list (filter/sort/cursor); detail `GET /journal/apc-invoices/:id` — `apc_invoices` |
| `POST /journal/apc-invoices` | CREATE | `journal.apc_invoices.create` | wajib `Idempotency-Key` |
| `PATCH /journal/apc-invoices/:id` | UPDATE | `journal.apc_invoices.update` | wajib `If-Match` (versi baris) |
| `POST /journal/apc-invoices/:id/toggle-active` | TOGGLE_ACTIVE | `journal.apc_invoices.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /journal/apc-invoices/:id` | DELETE | `journal.apc_invoices.delete` | hanya jika `GET /journal/apc-invoices/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /journal/apc-invoices/export` | EXPORT | `journal.apc_invoices.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /journal/journals/:id/harvest` | CREATE | `journal.journals.create` | harvest OAI-PMH |
| `POST /journal/articles/:id/approve` | APPROVE | `journal.articles.approve` | verifikasi artikel dosen → BKD |
| `GET /journal/parameters` · `POST /journal/parameters/:key/versions` | READ · PARAM_EDIT | `journal.parameters.read` · `journal.parameters.param_edit` | parameter modul: `journal.harvest_cron`, `journal.apc_default_idr` |

#### 6.5.22 M-22 — Inkubator & HAKI

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /ipr/filings` | READ | `ipr_incubator.filings.read` | list (filter/sort/cursor); detail `GET /ipr/filings/:id` — `ipr_filings` |
| `POST /ipr/filings` | CREATE | `ipr_incubator.filings.create` | wajib `Idempotency-Key` |
| `PATCH /ipr/filings/:id` | UPDATE | `ipr_incubator.filings.update` | wajib `If-Match` (versi baris) |
| `POST /ipr/filings/:id/toggle-active` | TOGGLE_ACTIVE | `ipr_incubator.filings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ipr/filings/:id` | DELETE | `ipr_incubator.filings.delete` | hanya jika `GET /ipr/filings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ipr/filings/export` | EXPORT | `ipr_incubator.filings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /ipr/startups` | READ | `ipr_incubator.startups.read` | list (filter/sort/cursor); detail `GET /ipr/startups/:id` — `startups` |
| `POST /ipr/startups` | CREATE | `ipr_incubator.startups.create` | wajib `Idempotency-Key` |
| `PATCH /ipr/startups/:id` | UPDATE | `ipr_incubator.startups.update` | wajib `If-Match` (versi baris) |
| `POST /ipr/startups/:id/toggle-active` | TOGGLE_ACTIVE | `ipr_incubator.startups.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ipr/startups/:id` | DELETE | `ipr_incubator.startups.delete` | hanya jika `GET /ipr/startups/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ipr/startups/export` | EXPORT | `ipr_incubator.startups.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /ipr/milestones` | READ | `ipr_incubator.milestones.read` | list (filter/sort/cursor); detail `GET /ipr/milestones/:id` — `startup_milestones` |
| `POST /ipr/milestones` | CREATE | `ipr_incubator.milestones.create` | wajib `Idempotency-Key` |
| `PATCH /ipr/milestones/:id` | UPDATE | `ipr_incubator.milestones.update` | wajib `If-Match` (versi baris) |
| `POST /ipr/milestones/:id/toggle-active` | TOGGLE_ACTIVE | `ipr_incubator.milestones.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ipr/milestones/:id` | DELETE | `ipr_incubator.milestones.delete` | hanya jika `GET /ipr/milestones/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ipr/milestones/export` | EXPORT | `ipr_incubator.milestones.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /ipr/seed-fundings` | READ | `ipr_incubator.seed_fundings.read` | list (filter/sort/cursor); detail `GET /ipr/seed-fundings/:id` — `seed_fundings` |
| `POST /ipr/seed-fundings` | CREATE | `ipr_incubator.seed_fundings.create` | wajib `Idempotency-Key` |
| `PATCH /ipr/seed-fundings/:id` | UPDATE | `ipr_incubator.seed_fundings.update` | wajib `If-Match` (versi baris) |
| `POST /ipr/seed-fundings/:id/toggle-active` | TOGGLE_ACTIVE | `ipr_incubator.seed_fundings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ipr/seed-fundings/:id` | DELETE | `ipr_incubator.seed_fundings.delete` | hanya jika `GET /ipr/seed-fundings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ipr/seed-fundings/export` | EXPORT | `ipr_incubator.seed_fundings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /ipr/filings/:id/approve` | APPROVE | `ipr_incubator.filings.approve` | verifikasi sertifikat → M-07/M-32 |
| `POST /ipr/filings/:id/reject` | REJECT | `ipr_incubator.filings.reject` | tolak |
| `POST /ipr/seed-fundings/:id/approve` | APPROVE | `ipr_incubator.seed_fundings.approve` | setujui pendanaan |
| `GET /ipr/reports/export` | EXPORT | `ipr_incubator.reports.export` | rekap HAKI |
| `GET /ipr/parameters` · `POST /ipr/parameters/:key/versions` | READ · PARAM_EDIT | `ipr_incubator.parameters.read` · `ipr_incubator.parameters.param_edit` | parameter modul: `ipr.iku5_counted_types` |

#### 6.5.23 M-23 — Wisuda & Toga

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /graduation/convocations` | READ | `graduation.convocations.read` | list (filter/sort/cursor); detail `GET /graduation/convocations/:id` — `convocations` |
| `POST /graduation/convocations` | CREATE | `graduation.convocations.create` | wajib `Idempotency-Key` |
| `PATCH /graduation/convocations/:id` | UPDATE | `graduation.convocations.update` | wajib `If-Match` (versi baris) |
| `POST /graduation/convocations/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.convocations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /graduation/convocations/:id` | DELETE | `graduation.convocations.delete` | hanya jika `GET /graduation/convocations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /graduation/convocations/export` | EXPORT | `graduation.convocations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /graduation/registrants` | READ | `graduation.registrants.read` | list (filter/sort/cursor); detail `GET /graduation/registrants/:id` — `convocation_registrants` |
| `POST /graduation/registrants` | CREATE | `graduation.registrants.create` | wajib `Idempotency-Key` |
| `PATCH /graduation/registrants/:id` | UPDATE | `graduation.registrants.update` | wajib `If-Match` (versi baris) |
| `POST /graduation/registrants/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.registrants.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /graduation/registrants/:id` | DELETE | `graduation.registrants.delete` | hanya jika `GET /graduation/registrants/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /graduation/registrants/export` | EXPORT | `graduation.registrants.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /graduation/seats` | READ | `graduation.seats.read` | list (filter/sort/cursor); detail `GET /graduation/seats/:id` — `convocation_seats` |
| `POST /graduation/seats` | CREATE | `graduation.seats.create` | wajib `Idempotency-Key` |
| `PATCH /graduation/seats/:id` | UPDATE | `graduation.seats.update` | wajib `If-Match` (versi baris) |
| `POST /graduation/seats/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.seats.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /graduation/seats/:id` | DELETE | `graduation.seats.delete` | hanya jika `GET /graduation/seats/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /graduation/seats/export` | EXPORT | `graduation.seats.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /graduation/gowns` | READ | `graduation.gowns.read` | list (filter/sort/cursor); detail `GET /graduation/gowns/:id` — `gown_inventory` |
| `POST /graduation/gowns` | CREATE | `graduation.gowns.create` | wajib `Idempotency-Key` |
| `PATCH /graduation/gowns/:id` | UPDATE | `graduation.gowns.update` | wajib `If-Match` (versi baris) |
| `POST /graduation/gowns/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.gowns.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /graduation/gowns/:id` | DELETE | `graduation.gowns.delete` | hanya jika `GET /graduation/gowns/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /graduation/gowns/export` | EXPORT | `graduation.gowns.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /graduation/convocations/:id/solve-seating` | UPDATE | `graduation.convocations.update` | Hungarian solver |
| `POST /graduation/convocations/:id/lock-seating` | LOCK | `graduation.convocations.lock` | kunci denah |
| `POST /graduation/stage-call/scan` | CREATE | `graduation.stage_call.create` | scan QR panggung → layar & notifikasi |
| `GET /graduation/convocations/:id/export` | EXPORT | `graduation.convocations.export` | buku wisuda |
| `GET /graduation/parameters` · `POST /graduation/parameters/:key/versions` | READ · PARAM_EDIT | `graduation.parameters.read` · `graduation.parameters.param_edit` | parameter modul: `graduation.guest_max`, `graduation.seating_strategy` |

#### 6.5.24 M-24 — Kemahasiswaan & SKKM

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /student-affairs/rules` | READ | `student_affairs.rules.read` | list (filter/sort/cursor); detail `GET /student-affairs/rules/:id` — `skkm_rules` |
| `POST /student-affairs/rules` | CREATE | `student_affairs.rules.create` | wajib `Idempotency-Key` |
| `PATCH /student-affairs/rules/:id` | UPDATE | `student_affairs.rules.update` | wajib `If-Match` (versi baris) |
| `POST /student-affairs/rules/:id/toggle-active` | TOGGLE_ACTIVE | `student_affairs.rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /student-affairs/rules/:id` | DELETE | `student_affairs.rules.delete` | hanya jika `GET /student-affairs/rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /student-affairs/rules/export` | EXPORT | `student_affairs.rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /student-affairs/claims` | READ | `student_affairs.claims.read` | list (filter/sort/cursor); detail `GET /student-affairs/claims/:id` — `skkm_claims` |
| `POST /student-affairs/claims` | CREATE | `student_affairs.claims.create` | wajib `Idempotency-Key` |
| `PATCH /student-affairs/claims/:id` | UPDATE | `student_affairs.claims.update` | wajib `If-Match` (versi baris) |
| `POST /student-affairs/claims/:id/toggle-active` | TOGGLE_ACTIVE | `student_affairs.claims.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /student-affairs/claims/:id` | DELETE | `student_affairs.claims.delete` | hanya jika `GET /student-affairs/claims/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /student-affairs/claims/export` | EXPORT | `student_affairs.claims.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /student-affairs/achievements` | READ | `student_affairs.achievements.read` | list (filter/sort/cursor); detail `GET /student-affairs/achievements/:id` — `achievements` |
| `POST /student-affairs/achievements` | CREATE | `student_affairs.achievements.create` | wajib `Idempotency-Key` |
| `PATCH /student-affairs/achievements/:id` | UPDATE | `student_affairs.achievements.update` | wajib `If-Match` (versi baris) |
| `POST /student-affairs/achievements/:id/toggle-active` | TOGGLE_ACTIVE | `student_affairs.achievements.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /student-affairs/achievements/:id` | DELETE | `student_affairs.achievements.delete` | hanya jika `GET /student-affairs/achievements/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /student-affairs/achievements/export` | EXPORT | `student_affairs.achievements.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /student-affairs/organizations` | READ | `student_affairs.organizations.read` | list (filter/sort/cursor); detail `GET /student-affairs/organizations/:id` — `student_organizations` |
| `POST /student-affairs/organizations` | CREATE | `student_affairs.organizations.create` | wajib `Idempotency-Key` |
| `PATCH /student-affairs/organizations/:id` | UPDATE | `student_affairs.organizations.update` | wajib `If-Match` (versi baris) |
| `POST /student-affairs/organizations/:id/toggle-active` | TOGGLE_ACTIVE | `student_affairs.organizations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /student-affairs/organizations/:id` | DELETE | `student_affairs.organizations.delete` | hanya jika `GET /student-affairs/organizations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /student-affairs/organizations/export` | EXPORT | `student_affairs.organizations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /student-affairs/claims/:id/approve` | APPROVE | `student_affairs.claims.approve` | verifikasi sertifikat |
| `POST /student-affairs/claims/:id/reject` | REJECT | `student_affairs.claims.reject` | tolak |
| `GET /student-affairs/simkatmawa/export` | EXPORT | `student_affairs.simkatmawa.export` | format SIMKATMAWA |
| `GET /student-affairs/parameters` · `POST /student-affairs/parameters/:key/versions` | READ · PARAM_EDIT | `student_affairs.parameters.read` · `student_affairs.parameters.param_edit` | parameter modul: `skkm.min_points_graduation`, `skkm.duplicate_check` |

#### 6.5.25 M-25 — KKN, PKL & Magang

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /fieldwork/programs` | READ | `fieldwork.programs.read` | list (filter/sort/cursor); detail `GET /fieldwork/programs/:id` — `fieldwork_programs` |
| `POST /fieldwork/programs` | CREATE | `fieldwork.programs.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/programs/:id` | UPDATE | `fieldwork.programs.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/programs/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.programs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/programs/:id` | DELETE | `fieldwork.programs.delete` | hanya jika `GET /fieldwork/programs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/programs/export` | EXPORT | `fieldwork.programs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /fieldwork/sites` | READ | `fieldwork.sites.read` | list (filter/sort/cursor); detail `GET /fieldwork/sites/:id` — `fieldwork_sites` |
| `POST /fieldwork/sites` | CREATE | `fieldwork.sites.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/sites/:id` | UPDATE | `fieldwork.sites.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/sites/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.sites.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/sites/:id` | DELETE | `fieldwork.sites.delete` | hanya jika `GET /fieldwork/sites/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/sites/export` | EXPORT | `fieldwork.sites.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /fieldwork/groups` | READ | `fieldwork.groups.read` | list (filter/sort/cursor); detail `GET /fieldwork/groups/:id` — `fieldwork_groups` |
| `POST /fieldwork/groups` | CREATE | `fieldwork.groups.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/groups/:id` | UPDATE | `fieldwork.groups.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/groups/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.groups.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/groups/:id` | DELETE | `fieldwork.groups.delete` | hanya jika `GET /fieldwork/groups/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/groups/export` | EXPORT | `fieldwork.groups.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /fieldwork/logbooks` | READ | `fieldwork.logbooks.read` | list (filter/sort/cursor); detail `GET /fieldwork/logbooks/:id` — `fieldwork_logbooks` |
| `POST /fieldwork/logbooks` | CREATE | `fieldwork.logbooks.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/logbooks/:id` | UPDATE | `fieldwork.logbooks.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/logbooks/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.logbooks.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/logbooks/:id` | DELETE | `fieldwork.logbooks.delete` | hanya jika `GET /fieldwork/logbooks/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/logbooks/export` | EXPORT | `fieldwork.logbooks.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /fieldwork/scores` | READ | `fieldwork.scores.read` | list (filter/sort/cursor); detail `GET /fieldwork/scores/:id` — `fieldwork_scores` |
| `POST /fieldwork/scores` | CREATE | `fieldwork.scores.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/scores/:id` | UPDATE | `fieldwork.scores.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/scores/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.scores.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/scores/:id` | DELETE | `fieldwork.scores.delete` | hanya jika `GET /fieldwork/scores/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/scores/export` | EXPORT | `fieldwork.scores.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /fieldwork/partners` | READ | `fieldwork.partners.read` | list (filter/sort/cursor); detail `GET /fieldwork/partners/:id` — `partners` |
| `POST /fieldwork/partners` | CREATE | `fieldwork.partners.create` | wajib `Idempotency-Key` |
| `PATCH /fieldwork/partners/:id` | UPDATE | `fieldwork.partners.update` | wajib `If-Match` (versi baris) |
| `POST /fieldwork/partners/:id/toggle-active` | TOGGLE_ACTIVE | `fieldwork.partners.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /fieldwork/partners/:id` | DELETE | `fieldwork.partners.delete` | hanya jika `GET /fieldwork/partners/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /fieldwork/partners/export` | EXPORT | `fieldwork.partners.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /fieldwork/programs/:id/allocate` | UPDATE | `fieldwork.programs.update` | K-means alokasi |
| `POST /fieldwork/logbooks/:id/approve` | APPROVE | `fieldwork.logbooks.approve` | DPL verifikasi logbook |
| `POST /fieldwork/logbooks/:id/reject` | REJECT | `fieldwork.logbooks.reject` | tolak |
| `POST /fieldwork/scores/:id/lock` | LOCK | `fieldwork.scores.lock` | kunci nilai → konversi KHS M-19 |
| `GET /fieldwork/programs/:id/export` | EXPORT | `fieldwork.programs.export` | rekap |
| `GET /fieldwork/parameters` · `POST /fieldwork/parameters/:key/versions` | READ · PARAM_EDIT | `fieldwork.parameters.read` · `fieldwork.parameters.param_edit` | parameter modul: `fieldwork.logbook_geofence_required`, `fieldwork.score_weights` |

#### 6.5.26 M-26 — Simulasi Lulus

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /academic/simulations` | READ | `academic.simulations.read` | list (filter/sort/cursor); detail `GET /academic/simulations/:id` — `graduation_simulations` |
| `POST /academic/simulations` | CREATE | `academic.simulations.create` | wajib `Idempotency-Key` |
| `PATCH /academic/simulations/:id` | UPDATE | `academic.simulations.update` | wajib `If-Match` (versi baris) |
| `POST /academic/simulations/:id/toggle-active` | TOGGLE_ACTIVE | `academic.simulations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /academic/simulations/:id` | DELETE | `academic.simulations.delete` | hanya jika `GET /academic/simulations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /academic/simulations/export` | EXPORT | `academic.simulations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /academic/graduation-simulations` | CREATE | `academic.graduation_simulations.create` | hitung CPM |
| `GET /academic/graduation-simulations/:id/export` | EXPORT | `academic.graduation_simulations.export` | PDF rencana studi |
| (parameter) | READ · PARAM_EDIT | `academic.parameters.*` | memakai endpoint parameter `/academic/parameters` yang sudah tercantum di atas: `study.max_semesters`, `simulation.max_sks_per_term` |

#### 6.5.27 M-27 — Tracer Study

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /tracer/surveys` | READ | `tracer_iku.surveys.read` | list (filter/sort/cursor); detail `GET /tracer/surveys/:id` — `tracer_surveys` |
| `POST /tracer/surveys` | CREATE | `tracer_iku.surveys.create` | wajib `Idempotency-Key` |
| `PATCH /tracer/surveys/:id` | UPDATE | `tracer_iku.surveys.update` | wajib `If-Match` (versi baris) |
| `POST /tracer/surveys/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.surveys.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /tracer/surveys/:id` | DELETE | `tracer_iku.surveys.delete` | hanya jika `GET /tracer/surveys/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /tracer/surveys/export` | EXPORT | `tracer_iku.surveys.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /tracer/responses` | READ | `tracer_iku.responses.read` | list (filter/sort/cursor); detail `GET /tracer/responses/:id` — `tracer_responses` |
| `POST /tracer/responses` | CREATE | `tracer_iku.responses.create` | wajib `Idempotency-Key` |
| `PATCH /tracer/responses/:id` | UPDATE | `tracer_iku.responses.update` | wajib `If-Match` (versi baris) |
| `POST /tracer/responses/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.responses.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /tracer/responses/:id` | DELETE | `tracer_iku.responses.delete` | hanya jika `GET /tracer/responses/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /tracer/responses/export` | EXPORT | `tracer_iku.responses.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /tracer/alumni` | READ | `tracer_iku.alumni.read` | list (filter/sort/cursor); detail `GET /tracer/alumni/:id` — `alumni_profiles` |
| `POST /tracer/alumni` | CREATE | `tracer_iku.alumni.create` | wajib `Idempotency-Key` |
| `PATCH /tracer/alumni/:id` | UPDATE | `tracer_iku.alumni.update` | wajib `If-Match` (versi baris) |
| `POST /tracer/alumni/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.alumni.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /tracer/alumni/:id` | DELETE | `tracer_iku.alumni.delete` | hanya jika `GET /tracer/alumni/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /tracer/alumni/export` | EXPORT | `tracer_iku.alumni.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /tracer/blasts` | READ | `tracer_iku.blasts.read` | list (filter/sort/cursor); detail `GET /tracer/blasts/:id` — `blast_jobs` |
| `POST /tracer/blasts` | CREATE | `tracer_iku.blasts.create` | wajib `Idempotency-Key` |
| `PATCH /tracer/blasts/:id` | UPDATE | `tracer_iku.blasts.update` | wajib `If-Match` (versi baris) |
| `POST /tracer/blasts/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.blasts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /tracer/blasts/:id` | DELETE | `tracer_iku.blasts.delete` | hanya jika `GET /tracer/blasts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /tracer/blasts/export` | EXPORT | `tracer_iku.blasts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /tracer/blasts/:id/start` | UPDATE | `tracer_iku.blasts.update` | mulai blast |
| `GET /tracer/surveys/:id/export` | EXPORT | `tracer_iku.surveys.export` | format pelaporan Kemdikbudristek |
| `GET /tracer/parameters` · `POST /tracer/parameters/:key/versions` | READ · PARAM_EDIT | `tracer_iku.parameters.read` · `tracer_iku.parameters.param_edit` | parameter modul: `tracer.waves_years`, `tracer.blast_rate_per_min` |

#### 6.5.28 M-28 — Career Center

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /career/employers` | READ | `career.employers.read` | list (filter/sort/cursor); detail `GET /career/employers/:id` — `employers` |
| `POST /career/employers` | CREATE | `career.employers.create` | wajib `Idempotency-Key` |
| `PATCH /career/employers/:id` | UPDATE | `career.employers.update` | wajib `If-Match` (versi baris) |
| `POST /career/employers/:id/toggle-active` | TOGGLE_ACTIVE | `career.employers.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /career/employers/:id` | DELETE | `career.employers.delete` | hanya jika `GET /career/employers/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /career/employers/export` | EXPORT | `career.employers.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /career/vacancies` | READ | `career.vacancies.read` | list (filter/sort/cursor); detail `GET /career/vacancies/:id` — `job_vacancies` |
| `POST /career/vacancies` | CREATE | `career.vacancies.create` | wajib `Idempotency-Key` |
| `PATCH /career/vacancies/:id` | UPDATE | `career.vacancies.update` | wajib `If-Match` (versi baris) |
| `POST /career/vacancies/:id/toggle-active` | TOGGLE_ACTIVE | `career.vacancies.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /career/vacancies/:id` | DELETE | `career.vacancies.delete` | hanya jika `GET /career/vacancies/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /career/vacancies/export` | EXPORT | `career.vacancies.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /career/applications` | READ | `career.applications.read` | list (filter/sort/cursor); detail `GET /career/applications/:id` — `job_applications` |
| `POST /career/applications` | CREATE | `career.applications.create` | wajib `Idempotency-Key` |
| `PATCH /career/applications/:id` | UPDATE | `career.applications.update` | wajib `If-Match` (versi baris) |
| `POST /career/applications/:id/toggle-active` | TOGGLE_ACTIVE | `career.applications.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /career/applications/:id` | DELETE | `career.applications.delete` | hanya jika `GET /career/applications/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /career/applications/export` | EXPORT | `career.applications.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /career/fairs` | READ | `career.fairs.read` | list (filter/sort/cursor); detail `GET /career/fairs/:id` — `career_fairs` |
| `POST /career/fairs` | CREATE | `career.fairs.create` | wajib `Idempotency-Key` |
| `PATCH /career/fairs/:id` | UPDATE | `career.fairs.update` | wajib `If-Match` (versi baris) |
| `POST /career/fairs/:id/toggle-active` | TOGGLE_ACTIVE | `career.fairs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /career/fairs/:id` | DELETE | `career.fairs.delete` | hanya jika `GET /career/fairs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /career/fairs/export` | EXPORT | `career.fairs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /career/employers/:id/verify` | APPROVE | `career.employers.approve` | verifikasi mitra |
| `POST /career/vacancies/:id/match` | READ | `career.vacancies.read` | jalankan matcher |
| `GET /career/reports/export` | EXPORT | `career.reports.export` | IKU 1/2 |
| `GET /career/parameters` · `POST /career/parameters/:key/versions` | READ · PARAM_EDIT | `career.parameters.read` · `career.parameters.param_edit` | parameter modul: `career.min_match_score` |

#### 6.5.29 M-29 — KUI & Mobilitas

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /intl/programs` | READ | `international.programs.read` | list (filter/sort/cursor); detail `GET /intl/programs/:id` — `mobility_programs` |
| `POST /intl/programs` | CREATE | `international.programs.create` | wajib `Idempotency-Key` |
| `PATCH /intl/programs/:id` | UPDATE | `international.programs.update` | wajib `If-Match` (versi baris) |
| `POST /intl/programs/:id/toggle-active` | TOGGLE_ACTIVE | `international.programs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /intl/programs/:id` | DELETE | `international.programs.delete` | hanya jika `GET /intl/programs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /intl/programs/export` | EXPORT | `international.programs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /intl/participants` | READ | `international.participants.read` | list (filter/sort/cursor); detail `GET /intl/participants/:id` — `mobility_participants` |
| `POST /intl/participants` | CREATE | `international.participants.create` | wajib `Idempotency-Key` |
| `PATCH /intl/participants/:id` | UPDATE | `international.participants.update` | wajib `If-Match` (versi baris) |
| `POST /intl/participants/:id/toggle-active` | TOGGLE_ACTIVE | `international.participants.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /intl/participants/:id` | DELETE | `international.participants.delete` | hanya jika `GET /intl/participants/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /intl/participants/export` | EXPORT | `international.participants.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /intl/immigration-docs` | READ | `international.immigration_docs.read` | list (filter/sort/cursor); detail `GET /intl/immigration-docs/:id` — `immigration_documents` |
| `POST /intl/immigration-docs` | CREATE | `international.immigration_docs.create` | wajib `Idempotency-Key` |
| `PATCH /intl/immigration-docs/:id` | UPDATE | `international.immigration_docs.update` | wajib `If-Match` (versi baris) |
| `POST /intl/immigration-docs/:id/toggle-active` | TOGGLE_ACTIVE | `international.immigration_docs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /intl/immigration-docs/:id` | DELETE | `international.immigration_docs.delete` | hanya jika `GET /intl/immigration-docs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /intl/immigration-docs/export` | EXPORT | `international.immigration_docs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /intl/conversion-factors` | READ | `international.conversion_factors.read` | list (filter/sort/cursor); detail `GET /intl/conversion-factors/:id` — `credit_conversion_factors` |
| `POST /intl/conversion-factors` | CREATE | `international.conversion_factors.create` | wajib `Idempotency-Key` |
| `PATCH /intl/conversion-factors/:id` | UPDATE | `international.conversion_factors.update` | wajib `If-Match` (versi baris) |
| `POST /intl/conversion-factors/:id/toggle-active` | TOGGLE_ACTIVE | `international.conversion_factors.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /intl/conversion-factors/:id` | DELETE | `international.conversion_factors.delete` | hanya jika `GET /intl/conversion-factors/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /intl/conversion-factors/export` | EXPORT | `international.conversion_factors.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /intl/conversions` | READ | `international.conversions.read` | list (filter/sort/cursor); detail `GET /intl/conversions/:id` — `credit_conversions` |
| `POST /intl/conversions` | CREATE | `international.conversions.create` | wajib `Idempotency-Key` |
| `PATCH /intl/conversions/:id` | UPDATE | `international.conversions.update` | wajib `If-Match` (versi baris) |
| `POST /intl/conversions/:id/toggle-active` | TOGGLE_ACTIVE | `international.conversions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /intl/conversions/:id` | DELETE | `international.conversions.delete` | hanya jika `GET /intl/conversions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /intl/conversions/export` | EXPORT | `international.conversions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /intl/conversions/:id/approve` | APPROVE | `international.conversions.approve` | sahkan konversi → M-19 |
| `POST /intl/conversions/:id/reject` | REJECT | `international.conversions.reject` | tolak |
| `GET /intl/reports/export` | EXPORT | `international.reports.export` | IKU 2/IKU 6 |
| `GET /intl/parameters` · `POST /intl/parameters/:key/versions` | READ · PARAM_EDIT | `international.parameters.read` · `international.parameters.param_edit` | parameter modul: `intl.visa_alert_days` |

#### 6.5.30 M-30 — Yudisium & SKPI

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /yudisium/clearance-rules` | READ | `graduation.clearance_rules.read` | list (filter/sort/cursor); detail `GET /yudisium/clearance-rules/:id` — `clearance_rules` |
| `POST /yudisium/clearance-rules` | CREATE | `graduation.clearance_rules.create` | wajib `Idempotency-Key` |
| `PATCH /yudisium/clearance-rules/:id` | UPDATE | `graduation.clearance_rules.update` | wajib `If-Match` (versi baris) |
| `POST /yudisium/clearance-rules/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.clearance_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /yudisium/clearance-rules/:id` | DELETE | `graduation.clearance_rules.delete` | hanya jika `GET /yudisium/clearance-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /yudisium/clearance-rules/export` | EXPORT | `graduation.clearance_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /yudisium/clearance-states` | READ | `graduation.clearance_states.read` | list (filter/sort/cursor); detail `GET /yudisium/clearance-states/:id` — `clearance_states` |
| `POST /yudisium/clearance-states` | CREATE | `graduation.clearance_states.create` | wajib `Idempotency-Key` |
| `PATCH /yudisium/clearance-states/:id` | UPDATE | `graduation.clearance_states.update` | wajib `If-Match` (versi baris) |
| `POST /yudisium/clearance-states/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.clearance_states.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /yudisium/clearance-states/:id` | DELETE | `graduation.clearance_states.delete` | hanya jika `GET /yudisium/clearance-states/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /yudisium/clearance-states/export` | EXPORT | `graduation.clearance_states.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /yudisium/batches` | READ | `graduation.batches.read` | list (filter/sort/cursor); detail `GET /yudisium/batches/:id` — `yudisium_batches` |
| `POST /yudisium/batches` | CREATE | `graduation.batches.create` | wajib `Idempotency-Key` |
| `PATCH /yudisium/batches/:id` | UPDATE | `graduation.batches.update` | wajib `If-Match` (versi baris) |
| `POST /yudisium/batches/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.batches.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /yudisium/batches/:id` | DELETE | `graduation.batches.delete` | hanya jika `GET /yudisium/batches/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /yudisium/batches/export` | EXPORT | `graduation.batches.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /yudisium/skpi` | READ | `graduation.skpi.read` | list (filter/sort/cursor); detail `GET /yudisium/skpi/:id` — `skpi_documents` |
| `POST /yudisium/skpi` | CREATE | `graduation.skpi.create` | wajib `Idempotency-Key` |
| `PATCH /yudisium/skpi/:id` | UPDATE | `graduation.skpi.update` | wajib `If-Match` (versi baris) |
| `POST /yudisium/skpi/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.skpi.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /yudisium/skpi/:id` | DELETE | `graduation.skpi.delete` | hanya jika `GET /yudisium/skpi/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /yudisium/skpi/export` | EXPORT | `graduation.skpi.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /yudisium/students/:id/clearance` | READ | `graduation.students.read` | status DFA |
| `POST /yudisium/clearance-states/:id/grant` | APPROVE | `graduation.clearance_states.approve` | unit memberi bebas (perpustakaan/lab/keuangan) |
| `POST /yudisium/batches/:id/approve` | APPROVE | `graduation.batches.approve` | Dekan sahkan |
| `POST /yudisium/batches/:id/reject` | REJECT | `graduation.batches.reject` | kembalikan |
| `POST /yudisium/batches/:id/lock` | LOCK | `graduation.batches.lock` | kunci → PIN M-35 |
| `GET /yudisium/batches/:id/export` | EXPORT | `graduation.batches.export` | SK yudisium |
| `GET /yudisium/parameters` · `POST /yudisium/parameters/:key/versions` | READ · PARAM_EDIT | `graduation.parameters.read` · `graduation.parameters.param_edit` | parameter modul: `yudisium.predicate_rules` |

#### 6.5.31 M-31 — Akreditasi LKPS

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /accreditation/templates` | READ | `accreditation.templates.read` | list (filter/sort/cursor); detail `GET /accreditation/templates/:id` — `lkps_templates` |
| `POST /accreditation/templates` | CREATE | `accreditation.templates.create` | wajib `Idempotency-Key` |
| `PATCH /accreditation/templates/:id` | UPDATE | `accreditation.templates.update` | wajib `If-Match` (versi baris) |
| `POST /accreditation/templates/:id/toggle-active` | TOGGLE_ACTIVE | `accreditation.templates.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /accreditation/templates/:id` | DELETE | `accreditation.templates.delete` | hanya jika `GET /accreditation/templates/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /accreditation/templates/export` | EXPORT | `accreditation.templates.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /accreditation/snapshots` | READ | `accreditation.snapshots.read` | list (filter/sort/cursor); detail `GET /accreditation/snapshots/:id` — `lkps_snapshots` |
| `POST /accreditation/snapshots` | CREATE | `accreditation.snapshots.create` | wajib `Idempotency-Key` |
| `PATCH /accreditation/snapshots/:id` | UPDATE | `accreditation.snapshots.update` | wajib `If-Match` (versi baris) |
| `POST /accreditation/snapshots/:id/toggle-active` | TOGGLE_ACTIVE | `accreditation.snapshots.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /accreditation/snapshots/:id` | DELETE | `accreditation.snapshots.delete` | hanya jika `GET /accreditation/snapshots/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /accreditation/snapshots/export` | EXPORT | `accreditation.snapshots.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /accreditation/led` | READ | `accreditation.led.read` | list (filter/sort/cursor); detail `GET /accreditation/led/:id` — `led_documents` |
| `POST /accreditation/led` | CREATE | `accreditation.led.create` | wajib `Idempotency-Key` |
| `PATCH /accreditation/led/:id` | UPDATE | `accreditation.led.update` | wajib `If-Match` (versi baris) |
| `POST /accreditation/led/:id/toggle-active` | TOGGLE_ACTIVE | `accreditation.led.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /accreditation/led/:id` | DELETE | `accreditation.led.delete` | hanya jika `GET /accreditation/led/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /accreditation/led/export` | EXPORT | `accreditation.led.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /accreditation/snapshots/:id/lock` | LOCK | `accreditation.snapshots.lock` | kunci |
| `GET /accreditation/snapshots/:id/export` | EXPORT | `accreditation.snapshots.export` | Word/Excel |
| `GET /accreditation/parameters` · `POST /accreditation/parameters/:key/versions` | READ · PARAM_EDIT | `accreditation.parameters.read` · `accreditation.parameters.param_edit` | parameter modul: `lkps.ts_years` |

#### 6.5.32 M-32 — Dashboard IKU

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /iku/definitions` | READ | `tracer_iku.definitions.read` | list (filter/sort/cursor); detail `GET /iku/definitions/:id` — `iku_definitions` |
| `POST /iku/definitions` | CREATE | `tracer_iku.definitions.create` | wajib `Idempotency-Key` |
| `PATCH /iku/definitions/:id` | UPDATE | `tracer_iku.definitions.update` | wajib `If-Match` (versi baris) |
| `POST /iku/definitions/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.definitions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /iku/definitions/:id` | DELETE | `tracer_iku.definitions.delete` | hanya jika `GET /iku/definitions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /iku/definitions/export` | EXPORT | `tracer_iku.definitions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /iku/targets` | READ | `tracer_iku.targets.read` | list (filter/sort/cursor); detail `GET /iku/targets/:id` — `iku_targets` |
| `POST /iku/targets` | CREATE | `tracer_iku.targets.create` | wajib `Idempotency-Key` |
| `PATCH /iku/targets/:id` | UPDATE | `tracer_iku.targets.update` | wajib `If-Match` (versi baris) |
| `POST /iku/targets/:id/toggle-active` | TOGGLE_ACTIVE | `tracer_iku.targets.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /iku/targets/:id` | DELETE | `tracer_iku.targets.delete` | hanya jika `GET /iku/targets/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /iku/targets/export` | EXPORT | `tracer_iku.targets.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /iku/dashboard` | READ | `tracer_iku.dashboard.read` | nilai real-time (+ WebSocket) |
| `POST /iku/recompute` | UPDATE | `tracer_iku.recompute.update` | rekalkulasi penuh |
| `GET /iku/board/export` | EXPORT | `tracer_iku.board.export` | board report |
| `GET /iku/parameters` · `POST /iku/parameters/:key/versions` | READ · PARAM_EDIT | `tracer_iku.parameters.read` · `tracer_iku.parameters.param_edit` | parameter modul: `iku.full_recompute_cron` |

#### 6.5.33 M-33 — Jadwal Darurat

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /emergency/incidents` | READ | `scheduling.incidents.read` | list (filter/sort/cursor); detail `GET /emergency/incidents/:id` — `incidents` |
| `POST /emergency/incidents` | CREATE | `scheduling.incidents.create` | wajib `Idempotency-Key` |
| `PATCH /emergency/incidents/:id` | UPDATE | `scheduling.incidents.update` | wajib `If-Match` (versi baris) |
| `POST /emergency/incidents/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.incidents.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /emergency/incidents/:id` | DELETE | `scheduling.incidents.delete` | hanya jika `GET /emergency/incidents/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /emergency/incidents/export` | EXPORT | `scheduling.incidents.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /emergency/lockouts` | READ | `scheduling.lockouts.read` | list (filter/sort/cursor); detail `GET /emergency/lockouts/:id` — `room_lockouts` |
| `POST /emergency/lockouts` | CREATE | `scheduling.lockouts.create` | wajib `Idempotency-Key` |
| `PATCH /emergency/lockouts/:id` | UPDATE | `scheduling.lockouts.update` | wajib `If-Match` (versi baris) |
| `POST /emergency/lockouts/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.lockouts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /emergency/lockouts/:id` | DELETE | `scheduling.lockouts.delete` | hanya jika `GET /emergency/lockouts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /emergency/lockouts/export` | EXPORT | `scheduling.lockouts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /emergency/reroute-plans` | READ | `scheduling.reroute_plans.read` | list (filter/sort/cursor); detail `GET /emergency/reroute-plans/:id` — `reroute_plans` |
| `POST /emergency/reroute-plans` | CREATE | `scheduling.reroute_plans.create` | wajib `Idempotency-Key` |
| `PATCH /emergency/reroute-plans/:id` | UPDATE | `scheduling.reroute_plans.update` | wajib `If-Match` (versi baris) |
| `POST /emergency/reroute-plans/:id/toggle-active` | TOGGLE_ACTIVE | `scheduling.reroute_plans.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /emergency/reroute-plans/:id` | DELETE | `scheduling.reroute_plans.delete` | hanya jika `GET /emergency/reroute-plans/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /emergency/reroute-plans/export` | EXPORT | `scheduling.reroute_plans.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /emergency/incidents/:id/lockout` | LOCK | `scheduling.incidents.lock` | kunci ruang |
| `POST /emergency/incidents/:id/solve` | UPDATE | `scheduling.incidents.update` | max-flow re-routing |
| `POST /emergency/reroute-plans/:id/approve` | APPROVE | `scheduling.reroute_plans.approve` | terapkan → M-14/M-15 + push |
| `POST /emergency/lockouts/:id/release` | UNLOCK | `scheduling.lockouts.unlock` | lepas kunci |
| `GET /emergency/parameters` · `POST /emergency/parameters/:key/versions` | READ · PARAM_EDIT | `scheduling.parameters.read` · `scheduling.parameters.param_edit` | parameter modul: `emergency.max_walk_m` |

#### 6.5.34 M-34 — Feeder PDDikti

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /feeder/staging` | READ | `feeder_pddikti.staging.read` | list (filter/sort/cursor); detail `GET /feeder/staging/:id` — `feeder_staging` |
| `POST /feeder/staging` | CREATE | `feeder_pddikti.staging.create` | wajib `Idempotency-Key` |
| `PATCH /feeder/staging/:id` | UPDATE | `feeder_pddikti.staging.update` | wajib `If-Match` (versi baris) |
| `POST /feeder/staging/:id/toggle-active` | TOGGLE_ACTIVE | `feeder_pddikti.staging.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /feeder/staging/:id` | DELETE | `feeder_pddikti.staging.delete` | hanya jika `GET /feeder/staging/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /feeder/staging/export` | EXPORT | `feeder_pddikti.staging.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /feeder/rules` | READ | `feeder_pddikti.rules.read` | list (filter/sort/cursor); detail `GET /feeder/rules/:id` — `feeder_rules` |
| `POST /feeder/rules` | CREATE | `feeder_pddikti.rules.create` | wajib `Idempotency-Key` |
| `PATCH /feeder/rules/:id` | UPDATE | `feeder_pddikti.rules.update` | wajib `If-Match` (versi baris) |
| `POST /feeder/rules/:id/toggle-active` | TOGGLE_ACTIVE | `feeder_pddikti.rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /feeder/rules/:id` | DELETE | `feeder_pddikti.rules.delete` | hanya jika `GET /feeder/rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /feeder/rules/export` | EXPORT | `feeder_pddikti.rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /feeder/jobs` | READ | `feeder_pddikti.jobs.read` | list (filter/sort/cursor); detail `GET /feeder/jobs/:id` — `feeder_sync_jobs` |
| `POST /feeder/jobs` | CREATE | `feeder_pddikti.jobs.create` | wajib `Idempotency-Key` |
| `PATCH /feeder/jobs/:id` | UPDATE | `feeder_pddikti.jobs.update` | wajib `If-Match` (versi baris) |
| `POST /feeder/jobs/:id/toggle-active` | TOGGLE_ACTIVE | `feeder_pddikti.jobs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /feeder/jobs/:id` | DELETE | `feeder_pddikti.jobs.delete` | hanya jika `GET /feeder/jobs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /feeder/jobs/export` | EXPORT | `feeder_pddikti.jobs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /feeder/corrections` | READ | `feeder_pddikti.corrections.read` | list (filter/sort/cursor); detail `GET /feeder/corrections/:id` — `feeder_corrections` |
| `POST /feeder/corrections` | CREATE | `feeder_pddikti.corrections.create` | wajib `Idempotency-Key` |
| `PATCH /feeder/corrections/:id` | UPDATE | `feeder_pddikti.corrections.update` | wajib `If-Match` (versi baris) |
| `POST /feeder/corrections/:id/toggle-active` | TOGGLE_ACTIVE | `feeder_pddikti.corrections.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /feeder/corrections/:id` | DELETE | `feeder_pddikti.corrections.delete` | hanya jika `GET /feeder/corrections/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /feeder/corrections/export` | EXPORT | `feeder_pddikti.corrections.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /feeder/staging/validate` | UPDATE | `feeder_pddikti.staging.update` | jalankan pre-sync rules |
| `POST /feeder/corrections/:id/approve` | APPROVE | `feeder_pddikti.corrections.approve` | sahkan koreksi |
| `POST /feeder/corrections/:id/reject` | REJECT | `feeder_pddikti.corrections.reject` | tolak |
| `POST /feeder/jobs/:id/retry` | UPDATE | `feeder_pddikti.jobs.update` | retry |
| `POST /feeder/periods/:id/lock` | LOCK | `feeder_pddikti.periods.lock` | kunci pelaporan |
| `GET /feeder/parameters` · `POST /feeder/parameters/:key/versions` | READ · PARAM_EDIT | `feeder_pddikti.parameters.read` · `feeder_pddikti.parameters.param_edit` | parameter modul: `feeder.fuzzy_threshold`, `feeder.retry_max` |

#### 6.5.35 M-35 — PIN & SIVIL

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /pin/quotas` | READ | `graduation.quotas.read` | list (filter/sort/cursor); detail `GET /pin/quotas/:id` — `pin_quotas` |
| `POST /pin/quotas` | CREATE | `graduation.quotas.create` | wajib `Idempotency-Key` |
| `PATCH /pin/quotas/:id` | UPDATE | `graduation.quotas.update` | wajib `If-Match` (versi baris) |
| `POST /pin/quotas/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.quotas.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pin/quotas/:id` | DELETE | `graduation.quotas.delete` | hanya jika `GET /pin/quotas/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pin/quotas/export` | EXPORT | `graduation.quotas.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pin/reservations` | READ | `graduation.reservations.read` | list (filter/sort/cursor); detail `GET /pin/reservations/:id` — `pin_reservations` |
| `POST /pin/reservations` | CREATE | `graduation.reservations.create` | wajib `Idempotency-Key` |
| `PATCH /pin/reservations/:id` | UPDATE | `graduation.reservations.update` | wajib `If-Match` (versi baris) |
| `POST /pin/reservations/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.reservations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pin/reservations/:id` | DELETE | `graduation.reservations.delete` | hanya jika `GET /pin/reservations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pin/reservations/export` | EXPORT | `graduation.reservations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /pin/diplomas` | READ | `graduation.diplomas.read` | list (filter/sort/cursor); detail `GET /pin/diplomas/:id` — `diplomas` |
| `POST /pin/diplomas` | CREATE | `graduation.diplomas.create` | wajib `Idempotency-Key` |
| `PATCH /pin/diplomas/:id` | UPDATE | `graduation.diplomas.update` | wajib `If-Match` (versi baris) |
| `POST /pin/diplomas/:id/toggle-active` | TOGGLE_ACTIVE | `graduation.diplomas.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /pin/diplomas/:id` | DELETE | `graduation.diplomas.delete` | hanya jika `GET /pin/diplomas/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /pin/diplomas/export` | EXPORT | `graduation.diplomas.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /pin/reservations/batch` | CREATE | `graduation.reservations.create` | reservasi PIN dari batch yudisium terkunci |
| `POST /pin/diplomas/:id/sign` | APPROVE | `graduation.diplomas.approve` | tanda tangan digital |
| `POST /pin/diplomas/:id/revoke` | LOCK | `graduation.diplomas.lock` | cabut |
| `GET /public/verify/:token` | READ | `publik (tanpa auth, rate-limit)` | verifikasi QR publik (tanpa auth, rate-limited) |
| `GET /pin/reports/export` | EXPORT | `graduation.reports.export` | rekap |
| `GET /pin/parameters` · `POST /pin/parameters/:key/versions` | READ · PARAM_EDIT | `graduation.parameters.read` · `graduation.parameters.param_edit` | parameter modul: `diploma.qr_ttl_days`, `diploma.public_fields` |

#### 6.5.36 M-36 — Portal PPKS

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /ppks/cases` | READ | `ppks.cases.read` | list (filter/sort/cursor); detail `GET /ppks/cases/:id` — `ppks_cases` |
| `POST /ppks/cases` | CREATE | `ppks.cases.create` | wajib `Idempotency-Key` |
| `PATCH /ppks/cases/:id` | UPDATE | `ppks.cases.update` | wajib `If-Match` (versi baris) |
| `POST /ppks/cases/:id/toggle-active` | TOGGLE_ACTIVE | `ppks.cases.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ppks/cases/:id` | DELETE | `ppks.cases.delete` | hanya jika `GET /ppks/cases/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ppks/cases/export` | EXPORT | `ppks.cases.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /ppks/case-events` | READ | `ppks.case_events.read` | list (filter/sort/cursor); detail `GET /ppks/case-events/:id` — `ppks_case_events` |
| `POST /ppks/case-events` | CREATE | `ppks.case_events.create` | wajib `Idempotency-Key` |
| `PATCH /ppks/case-events/:id` | UPDATE | `ppks.case_events.update` | wajib `If-Match` (versi baris) |
| `POST /ppks/case-events/:id/toggle-active` | TOGGLE_ACTIVE | `ppks.case_events.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ppks/case-events/:id` | DELETE | `ppks.case_events.delete` | hanya jika `GET /ppks/case-events/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ppks/case-events/export` | EXPORT | `ppks.case_events.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /ppks/ministry-reports` | READ | `ppks.ministry_reports.read` | list (filter/sort/cursor); detail `GET /ppks/ministry-reports/:id` — `ppks_ministry_reports` |
| `POST /ppks/ministry-reports` | CREATE | `ppks.ministry_reports.create` | wajib `Idempotency-Key` |
| `PATCH /ppks/ministry-reports/:id` | UPDATE | `ppks.ministry_reports.update` | wajib `If-Match` (versi baris) |
| `POST /ppks/ministry-reports/:id/toggle-active` | TOGGLE_ACTIVE | `ppks.ministry_reports.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /ppks/ministry-reports/:id` | DELETE | `ppks.ministry_reports.delete` | hanya jika `GET /ppks/ministry-reports/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /ppks/ministry-reports/export` | EXPORT | `ppks.ministry_reports.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /public/ppks/reports` | CREATE | `publik (tanpa auth, rate-limit)` | kirim laporan terenkripsi (anonim) |
| `GET /public/ppks/reports/status` | READ | `publik (tanpa auth, rate-limit)` | cek status via kode kasus |
| `POST /ppks/cases/:id/close` | LOCK | `ppks.cases.lock` | tutup kasus |
| `GET /ppks/ministry-reports/:id/export` | EXPORT | `ppks.ministry_reports.export` | laporan agregat |
| `GET /ppks/parameters` · `POST /ppks/parameters/:key/versions` | READ · PARAM_EDIT | `ppks.parameters.read` · `ppks.parameters.param_edit` | parameter modul: `ppks.response_days` |

#### 6.5.37 M-37 — SPMI & Quality

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /spmi/standards` | READ | `spmi.standards.read` | list (filter/sort/cursor); detail `GET /spmi/standards/:id` — `quality_standards` |
| `POST /spmi/standards` | CREATE | `spmi.standards.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/standards/:id` | UPDATE | `spmi.standards.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/standards/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.standards.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/standards/:id` | DELETE | `spmi.standards.delete` | hanya jika `GET /spmi/standards/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/standards/export` | EXPORT | `spmi.standards.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /spmi/cycles` | READ | `spmi.cycles.read` | list (filter/sort/cursor); detail `GET /spmi/cycles/:id` — `ami_cycles` |
| `POST /spmi/cycles` | CREATE | `spmi.cycles.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/cycles/:id` | UPDATE | `spmi.cycles.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/cycles/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.cycles.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/cycles/:id` | DELETE | `spmi.cycles.delete` | hanya jika `GET /spmi/cycles/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/cycles/export` | EXPORT | `spmi.cycles.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /spmi/assignments` | READ | `spmi.assignments.read` | list (filter/sort/cursor); detail `GET /spmi/assignments/:id` — `ami_assignments` |
| `POST /spmi/assignments` | CREATE | `spmi.assignments.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/assignments/:id` | UPDATE | `spmi.assignments.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/assignments/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.assignments.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/assignments/:id` | DELETE | `spmi.assignments.delete` | hanya jika `GET /spmi/assignments/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/assignments/export` | EXPORT | `spmi.assignments.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /spmi/checklists` | READ | `spmi.checklists.read` | list (filter/sort/cursor); detail `GET /spmi/checklists/:id` — `ami_checklists` |
| `POST /spmi/checklists` | CREATE | `spmi.checklists.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/checklists/:id` | UPDATE | `spmi.checklists.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/checklists/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.checklists.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/checklists/:id` | DELETE | `spmi.checklists.delete` | hanya jika `GET /spmi/checklists/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/checklists/export` | EXPORT | `spmi.checklists.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /spmi/findings` | READ | `spmi.findings.read` | list (filter/sort/cursor); detail `GET /spmi/findings/:id` — `ami_findings` |
| `POST /spmi/findings` | CREATE | `spmi.findings.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/findings/:id` | UPDATE | `spmi.findings.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/findings/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.findings.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/findings/:id` | DELETE | `spmi.findings.delete` | hanya jika `GET /spmi/findings/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/findings/export` | EXPORT | `spmi.findings.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /spmi/corrective-actions` | READ | `spmi.corrective_actions.read` | list (filter/sort/cursor); detail `GET /spmi/corrective-actions/:id` — `ami_corrective_actions` |
| `POST /spmi/corrective-actions` | CREATE | `spmi.corrective_actions.create` | wajib `Idempotency-Key` |
| `PATCH /spmi/corrective-actions/:id` | UPDATE | `spmi.corrective_actions.update` | wajib `If-Match` (versi baris) |
| `POST /spmi/corrective-actions/:id/toggle-active` | TOGGLE_ACTIVE | `spmi.corrective_actions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /spmi/corrective-actions/:id` | DELETE | `spmi.corrective_actions.delete` | hanya jika `GET /spmi/corrective-actions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /spmi/corrective-actions/export` | EXPORT | `spmi.corrective_actions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /spmi/findings/:id/approve` | APPROVE | `spmi.findings.approve` | verifikasi RTL |
| `POST /spmi/findings/:id/reject` | REJECT | `spmi.findings.reject` | tolak RTL |
| `POST /spmi/cycles/:id/lock` | LOCK | `spmi.cycles.lock` | tutup siklus |
| `GET /spmi/cycles/:id/export` | EXPORT | `spmi.cycles.export` | laporan AMI |
| `GET /spmi/parameters` · `POST /spmi/parameters/:key/versions` | READ · PARAM_EDIT | `spmi.parameters.read` · `spmi.parameters.param_edit` | parameter modul: `ami.rtl_due_days` |

#### 6.5.38 M-38 — Kampus Merdeka / MBKM

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /mbkm/programs` | READ | `mbkm.programs.read` | list (filter/sort/cursor); detail `GET /mbkm/programs/:id` — `mbkm_programs` |
| `POST /mbkm/programs` | CREATE | `mbkm.programs.create` | wajib `Idempotency-Key` |
| `PATCH /mbkm/programs/:id` | UPDATE | `mbkm.programs.update` | wajib `If-Match` (versi baris) |
| `POST /mbkm/programs/:id/toggle-active` | TOGGLE_ACTIVE | `mbkm.programs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /mbkm/programs/:id` | DELETE | `mbkm.programs.delete` | hanya jika `GET /mbkm/programs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /mbkm/programs/export` | EXPORT | `mbkm.programs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /mbkm/participants` | READ | `mbkm.participants.read` | list (filter/sort/cursor); detail `GET /mbkm/participants/:id` — `mbkm_participants` |
| `POST /mbkm/participants` | CREATE | `mbkm.participants.create` | wajib `Idempotency-Key` |
| `PATCH /mbkm/participants/:id` | UPDATE | `mbkm.participants.update` | wajib `If-Match` (versi baris) |
| `POST /mbkm/participants/:id/toggle-active` | TOGGLE_ACTIVE | `mbkm.participants.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /mbkm/participants/:id` | DELETE | `mbkm.participants.delete` | hanya jika `GET /mbkm/participants/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /mbkm/participants/export` | EXPORT | `mbkm.participants.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /mbkm/logbooks` | READ | `mbkm.logbooks.read` | list (filter/sort/cursor); detail `GET /mbkm/logbooks/:id` — `mbkm_logbooks` |
| `POST /mbkm/logbooks` | CREATE | `mbkm.logbooks.create` | wajib `Idempotency-Key` |
| `PATCH /mbkm/logbooks/:id` | UPDATE | `mbkm.logbooks.update` | wajib `If-Match` (versi baris) |
| `POST /mbkm/logbooks/:id/toggle-active` | TOGGLE_ACTIVE | `mbkm.logbooks.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /mbkm/logbooks/:id` | DELETE | `mbkm.logbooks.delete` | hanya jika `GET /mbkm/logbooks/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /mbkm/logbooks/export` | EXPORT | `mbkm.logbooks.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /mbkm/conversions` | READ | `mbkm.conversions.read` | list (filter/sort/cursor); detail `GET /mbkm/conversions/:id` — `mbkm_conversions` |
| `POST /mbkm/conversions` | CREATE | `mbkm.conversions.create` | wajib `Idempotency-Key` |
| `PATCH /mbkm/conversions/:id` | UPDATE | `mbkm.conversions.update` | wajib `If-Match` (versi baris) |
| `POST /mbkm/conversions/:id/toggle-active` | TOGGLE_ACTIVE | `mbkm.conversions.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /mbkm/conversions/:id` | DELETE | `mbkm.conversions.delete` | hanya jika `GET /mbkm/conversions/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /mbkm/conversions/export` | EXPORT | `mbkm.conversions.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /mbkm/logbooks/import` | CREATE | `mbkm.logbooks.create` | impor logbook mingguan |
| `POST /mbkm/conversions/:id/approve` | APPROVE | `mbkm.conversions.approve` | Kaprodi sahkan konversi → M-19 |
| `POST /mbkm/conversions/:id/reject` | REJECT | `mbkm.conversions.reject` | tolak |
| `GET /mbkm/reports/export` | EXPORT | `mbkm.reports.export` | IKU 2 |
| `GET /mbkm/parameters` · `POST /mbkm/parameters/:key/versions` | READ · PARAM_EDIT | `mbkm.parameters.read` · `mbkm.parameters.param_edit` | parameter modul: `mbkm.max_sks_outside` |

#### 6.5.39 M-39 — e-Library

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /library/items` | READ | `library.items.read` | list (filter/sort/cursor); detail `GET /library/items/:id` — `library_items` |
| `POST /library/items` | CREATE | `library.items.create` | wajib `Idempotency-Key` |
| `PATCH /library/items/:id` | UPDATE | `library.items.update` | wajib `If-Match` (versi baris) |
| `POST /library/items/:id/toggle-active` | TOGGLE_ACTIVE | `library.items.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /library/items/:id` | DELETE | `library.items.delete` | hanya jika `GET /library/items/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /library/items/export` | EXPORT | `library.items.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /library/copies` | READ | `library.copies.read` | list (filter/sort/cursor); detail `GET /library/copies/:id` — `library_copies` |
| `POST /library/copies` | CREATE | `library.copies.create` | wajib `Idempotency-Key` |
| `PATCH /library/copies/:id` | UPDATE | `library.copies.update` | wajib `If-Match` (versi baris) |
| `POST /library/copies/:id/toggle-active` | TOGGLE_ACTIVE | `library.copies.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /library/copies/:id` | DELETE | `library.copies.delete` | hanya jika `GET /library/copies/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /library/copies/export` | EXPORT | `library.copies.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /library/loans` | READ | `library.loans.read` | list (filter/sort/cursor); detail `GET /library/loans/:id` — `library_loans` |
| `POST /library/loans` | CREATE | `library.loans.create` | wajib `Idempotency-Key` |
| `PATCH /library/loans/:id` | UPDATE | `library.loans.update` | wajib `If-Match` (versi baris) |
| `POST /library/loans/:id/toggle-active` | TOGGLE_ACTIVE | `library.loans.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /library/loans/:id` | DELETE | `library.loans.delete` | hanya jika `GET /library/loans/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /library/loans/export` | EXPORT | `library.loans.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /library/fines` | READ | `library.fines.read` | list (filter/sort/cursor); detail `GET /library/fines/:id` — `library_fines` |
| `POST /library/fines` | CREATE | `library.fines.create` | wajib `Idempotency-Key` |
| `PATCH /library/fines/:id` | UPDATE | `library.fines.update` | wajib `If-Match` (versi baris) |
| `POST /library/fines/:id/toggle-active` | TOGGLE_ACTIVE | `library.fines.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /library/fines/:id` | DELETE | `library.fines.delete` | hanya jika `GET /library/fines/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /library/fines/export` | EXPORT | `library.fines.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /library/opac/search` | READ | `library.opac.read` | BM25 |
| `POST /library/items/import-marc` | CREATE | `library.items.create` | parse MARC21 |
| `POST /library/clearances` | APPROVE | `library.clearances.approve` | beri bebas pustaka (cek pinjaman & denda nol) |
| `GET /library/reports/export` | EXPORT | `library.reports.export` | sirkulasi |
| `GET /library/parameters` · `POST /library/parameters/:key/versions` | READ · PARAM_EDIT | `library.parameters.read` · `library.parameters.param_edit` | parameter modul: `library.loan_days`, `library.fine_per_day_idr`, `library.bm25_k1` |

#### 6.5.40 M-40 — Aset & Inventaris

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /assets/categories` | READ | `assets.categories.read` | list (filter/sort/cursor); detail `GET /assets/categories/:id` — `asset_categories` |
| `POST /assets/categories` | CREATE | `assets.categories.create` | wajib `Idempotency-Key` |
| `PATCH /assets/categories/:id` | UPDATE | `assets.categories.update` | wajib `If-Match` (versi baris) |
| `POST /assets/categories/:id/toggle-active` | TOGGLE_ACTIVE | `assets.categories.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /assets/categories/:id` | DELETE | `assets.categories.delete` | hanya jika `GET /assets/categories/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /assets/categories/export` | EXPORT | `assets.categories.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /assets/assets` | READ | `assets.assets.read` | list (filter/sort/cursor); detail `GET /assets/assets/:id` — `assets` |
| `POST /assets/assets` | CREATE | `assets.assets.create` | wajib `Idempotency-Key` |
| `PATCH /assets/assets/:id` | UPDATE | `assets.assets.update` | wajib `If-Match` (versi baris) |
| `POST /assets/assets/:id/toggle-active` | TOGGLE_ACTIVE | `assets.assets.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /assets/assets/:id` | DELETE | `assets.assets.delete` | hanya jika `GET /assets/assets/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /assets/assets/export` | EXPORT | `assets.assets.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /assets/movements` | READ | `assets.movements.read` | list (filter/sort/cursor); detail `GET /assets/movements/:id` — `asset_movements` |
| `POST /assets/movements` | CREATE | `assets.movements.create` | wajib `Idempotency-Key` |
| `PATCH /assets/movements/:id` | UPDATE | `assets.movements.update` | wajib `If-Match` (versi baris) |
| `POST /assets/movements/:id/toggle-active` | TOGGLE_ACTIVE | `assets.movements.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /assets/movements/:id` | DELETE | `assets.movements.delete` | hanya jika `GET /assets/movements/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /assets/movements/export` | EXPORT | `assets.movements.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /assets/:id/tag` | UPDATE | `assets.:id.update` | cetak QR tag |
| `POST /assets/depreciation/run` | CREATE | `assets.depreciation.create` | jalankan penyusutan |
| `POST /assets/movements/:id/approve` | APPROVE | `assets.movements.approve` | mutasi |
| `POST /assets/periods/:id/lock` | LOCK | `assets.periods.lock` | kunci periode |
| `GET /assets/reports/export` | EXPORT | `assets.reports.export` | laporan BMN/SIMAK |
| `GET /assets/parameters` · `POST /assets/parameters/:key/versions` | READ · PARAM_EDIT | `assets.parameters.read` · `assets.parameters.param_edit` | parameter modul: `asset.depreciation_cron`, `asset.tag_prefix` |

#### 6.5.41 M-41 — Klinik Kampus

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /clinic/patients` | READ | `clinic.patients.read` | list (filter/sort/cursor); detail `GET /clinic/patients/:id` — `clinic_patients` |
| `POST /clinic/patients` | CREATE | `clinic.patients.create` | wajib `Idempotency-Key` |
| `PATCH /clinic/patients/:id` | UPDATE | `clinic.patients.update` | wajib `If-Match` (versi baris) |
| `POST /clinic/patients/:id/toggle-active` | TOGGLE_ACTIVE | `clinic.patients.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /clinic/patients/:id` | DELETE | `clinic.patients.delete` | hanya jika `GET /clinic/patients/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /clinic/patients/export` | EXPORT | `clinic.patients.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /clinic/records` | READ | `clinic.records.read` | list (filter/sort/cursor); detail `GET /clinic/records/:id` — `medical_records` |
| `POST /clinic/records` | CREATE | `clinic.records.create` | wajib `Idempotency-Key` |
| `PATCH /clinic/records/:id` | UPDATE | `clinic.records.update` | wajib `If-Match` (versi baris) |
| `POST /clinic/records/:id/toggle-active` | TOGGLE_ACTIVE | `clinic.records.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /clinic/records/:id` | DELETE | `clinic.records.delete` | hanya jika `GET /clinic/records/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /clinic/records/export` | EXPORT | `clinic.records.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /clinic/queue` | READ | `clinic.queue.read` | list (filter/sort/cursor); detail `GET /clinic/queue/:id` — `clinic_queue` |
| `POST /clinic/queue` | CREATE | `clinic.queue.create` | wajib `Idempotency-Key` |
| `PATCH /clinic/queue/:id` | UPDATE | `clinic.queue.update` | wajib `If-Match` (versi baris) |
| `POST /clinic/queue/:id/toggle-active` | TOGGLE_ACTIVE | `clinic.queue.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /clinic/queue/:id` | DELETE | `clinic.queue.delete` | hanya jika `GET /clinic/queue/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /clinic/queue/export` | EXPORT | `clinic.queue.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /clinic/counseling` | READ | `clinic.counseling.read` | list (filter/sort/cursor); detail `GET /clinic/counseling/:id` — `counseling_bookings` |
| `POST /clinic/counseling` | CREATE | `clinic.counseling.create` | wajib `Idempotency-Key` |
| `PATCH /clinic/counseling/:id` | UPDATE | `clinic.counseling.update` | wajib `If-Match` (versi baris) |
| `POST /clinic/counseling/:id/toggle-active` | TOGGLE_ACTIVE | `clinic.counseling.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /clinic/counseling/:id` | DELETE | `clinic.counseling.delete` | hanya jika `GET /clinic/counseling/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /clinic/counseling/export` | EXPORT | `clinic.counseling.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /clinic/queue/next` | UPDATE | `clinic.queue.update` | panggil antrean |
| `POST /clinic/records/:id/break-glass` | UNLOCK | `clinic.records.unlock` | akses darurat (audit) |
| `GET /clinic/reports/export` | EXPORT | `clinic.reports.export` | agregat anonim |
| `GET /clinic/parameters` · `POST /clinic/parameters/:key/versions` | READ · PARAM_EDIT | `clinic.parameters.read` · `clinic.parameters.param_edit` | parameter modul: `clinic.record_retention_years` |

#### 6.5.42 M-42 — Asrama & Kantin

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /dorm/rooms` | READ | `dormitory.rooms.read` | list (filter/sort/cursor); detail `GET /dorm/rooms/:id` — `dorm_rooms` |
| `POST /dorm/rooms` | CREATE | `dormitory.rooms.create` | wajib `Idempotency-Key` |
| `PATCH /dorm/rooms/:id` | UPDATE | `dormitory.rooms.update` | wajib `If-Match` (versi baris) |
| `POST /dorm/rooms/:id/toggle-active` | TOGGLE_ACTIVE | `dormitory.rooms.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /dorm/rooms/:id` | DELETE | `dormitory.rooms.delete` | hanya jika `GET /dorm/rooms/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /dorm/rooms/export` | EXPORT | `dormitory.rooms.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /dorm/allocations` | READ | `dormitory.allocations.read` | list (filter/sort/cursor); detail `GET /dorm/allocations/:id` — `dorm_allocations` |
| `POST /dorm/allocations` | CREATE | `dormitory.allocations.create` | wajib `Idempotency-Key` |
| `PATCH /dorm/allocations/:id` | UPDATE | `dormitory.allocations.update` | wajib `If-Match` (versi baris) |
| `POST /dorm/allocations/:id/toggle-active` | TOGGLE_ACTIVE | `dormitory.allocations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /dorm/allocations/:id` | DELETE | `dormitory.allocations.delete` | hanya jika `GET /dorm/allocations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /dorm/allocations/export` | EXPORT | `dormitory.allocations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /dorm/shuttle-routes` | READ | `dormitory.shuttle_routes.read` | list (filter/sort/cursor); detail `GET /dorm/shuttle-routes/:id` — `shuttle_routes` |
| `POST /dorm/shuttle-routes` | CREATE | `dormitory.shuttle_routes.create` | wajib `Idempotency-Key` |
| `PATCH /dorm/shuttle-routes/:id` | UPDATE | `dormitory.shuttle_routes.update` | wajib `If-Match` (versi baris) |
| `POST /dorm/shuttle-routes/:id/toggle-active` | TOGGLE_ACTIVE | `dormitory.shuttle_routes.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /dorm/shuttle-routes/:id` | DELETE | `dormitory.shuttle_routes.delete` | hanya jika `GET /dorm/shuttle-routes/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /dorm/shuttle-routes/export` | EXPORT | `dormitory.shuttle_routes.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /dorm/wallets` | READ | `dormitory.wallets.read` | list (filter/sort/cursor); detail `GET /dorm/wallets/:id` — `wallet_accounts` |
| `POST /dorm/wallets` | CREATE | `dormitory.wallets.create` | wajib `Idempotency-Key` |
| `PATCH /dorm/wallets/:id` | UPDATE | `dormitory.wallets.update` | wajib `If-Match` (versi baris) |
| `POST /dorm/wallets/:id/toggle-active` | TOGGLE_ACTIVE | `dormitory.wallets.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /dorm/wallets/:id` | DELETE | `dormitory.wallets.delete` | hanya jika `GET /dorm/wallets/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /dorm/wallets/export` | EXPORT | `dormitory.wallets.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /dorm/allocations/solve` | UPDATE | `dormitory.allocations.update` | bin packing |
| `POST /dorm/allocations/:id/approve` | APPROVE | `dormitory.allocations.approve` | tetapkan → tagihan M-10 |
| `POST /wallet/topups` | CREATE | `dormitory.topups.create` | top-up via M-10 |
| `POST /wallet/reconcile` | UPDATE | `dormitory.reconcile.update` | rekonsiliasi |
| `GET /dorm/reports/export` | EXPORT | `dormitory.reports.export` | okupansi |
| `GET /dorm/parameters` · `POST /dorm/parameters/:key/versions` | READ · PARAM_EDIT | `dormitory.parameters.read` · `dormitory.parameters.param_edit` | parameter modul: `wallet.max_balance_idr` |

#### 6.5.43 M-43 — Humas & Event

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /events/events` | READ | `events.events.read` | list (filter/sort/cursor); detail `GET /events/events/:id` — `events` |
| `POST /events/events` | CREATE | `events.events.create` | wajib `Idempotency-Key` |
| `PATCH /events/events/:id` | UPDATE | `events.events.update` | wajib `If-Match` (versi baris) |
| `POST /events/events/:id/toggle-active` | TOGGLE_ACTIVE | `events.events.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /events/events/:id` | DELETE | `events.events.delete` | hanya jika `GET /events/events/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /events/events/export` | EXPORT | `events.events.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /events/registrations` | READ | `events.registrations.read` | list (filter/sort/cursor); detail `GET /events/registrations/:id` — `event_registrations` |
| `POST /events/registrations` | CREATE | `events.registrations.create` | wajib `Idempotency-Key` |
| `PATCH /events/registrations/:id` | UPDATE | `events.registrations.update` | wajib `If-Match` (versi baris) |
| `POST /events/registrations/:id/toggle-active` | TOGGLE_ACTIVE | `events.registrations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /events/registrations/:id` | DELETE | `events.registrations.delete` | hanya jika `GET /events/registrations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /events/registrations/export` | EXPORT | `events.registrations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /events/signage` | READ | `events.signage.read` | list (filter/sort/cursor); detail `GET /events/signage/:id` — `signage_schedules` |
| `POST /events/signage` | CREATE | `events.signage.create` | wajib `Idempotency-Key` |
| `PATCH /events/signage/:id` | UPDATE | `events.signage.update` | wajib `If-Match` (versi baris) |
| `POST /events/signage/:id/toggle-active` | TOGGLE_ACTIVE | `events.signage.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /events/signage/:id` | DELETE | `events.signage.delete` | hanya jika `GET /events/signage/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /events/signage/export` | EXPORT | `events.signage.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /events/:id/registrations/approve-batch` | APPROVE | `events.:id.approve` | tetapkan peserta |
| `POST /events/gates/scan` | CREATE | `events.gates.create` | check-in QR |
| `GET /events/:id/export` | EXPORT | `events.:id.export` | daftar hadir |
| `GET /events/parameters` · `POST /events/parameters/:key/versions` | READ · PARAM_EDIT | `events.parameters.read` · `events.parameters.param_edit` | parameter modul: `event.waitlist_enabled` |

#### 6.5.44 M-44 — SIM-LPPM / LITABMAS

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /lppm/schemes` | READ | `litabmas.schemes.read` | list (filter/sort/cursor); detail `GET /lppm/schemes/:id` — `grant_schemes` |
| `POST /lppm/schemes` | CREATE | `litabmas.schemes.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/schemes/:id` | UPDATE | `litabmas.schemes.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/schemes/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.schemes.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/schemes/:id` | DELETE | `litabmas.schemes.delete` | hanya jika `GET /lppm/schemes/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/schemes/export` | EXPORT | `litabmas.schemes.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lppm/proposals` | READ | `litabmas.proposals.read` | list (filter/sort/cursor); detail `GET /lppm/proposals/:id` — `grant_proposals` |
| `POST /lppm/proposals` | CREATE | `litabmas.proposals.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/proposals/:id` | UPDATE | `litabmas.proposals.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/proposals/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.proposals.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/proposals/:id` | DELETE | `litabmas.proposals.delete` | hanya jika `GET /lppm/proposals/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/proposals/export` | EXPORT | `litabmas.proposals.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lppm/reviews` | READ | `litabmas.reviews.read` | list (filter/sort/cursor); detail `GET /lppm/reviews/:id` — `grant_reviews` |
| `POST /lppm/reviews` | CREATE | `litabmas.reviews.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/reviews/:id` | UPDATE | `litabmas.reviews.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/reviews/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.reviews.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/reviews/:id` | DELETE | `litabmas.reviews.delete` | hanya jika `GET /lppm/reviews/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/reviews/export` | EXPORT | `litabmas.reviews.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lppm/contracts` | READ | `litabmas.contracts.read` | list (filter/sort/cursor); detail `GET /lppm/contracts/:id` — `grant_contracts` |
| `POST /lppm/contracts` | CREATE | `litabmas.contracts.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/contracts/:id` | UPDATE | `litabmas.contracts.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/contracts/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.contracts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/contracts/:id` | DELETE | `litabmas.contracts.delete` | hanya jika `GET /lppm/contracts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/contracts/export` | EXPORT | `litabmas.contracts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lppm/disbursements` | READ | `litabmas.disbursements.read` | list (filter/sort/cursor); detail `GET /lppm/disbursements/:id` — `grant_disbursements` |
| `POST /lppm/disbursements` | CREATE | `litabmas.disbursements.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/disbursements/:id` | UPDATE | `litabmas.disbursements.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/disbursements/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.disbursements.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/disbursements/:id` | DELETE | `litabmas.disbursements.delete` | hanya jika `GET /lppm/disbursements/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/disbursements/export` | EXPORT | `litabmas.disbursements.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /lppm/outputs` | READ | `litabmas.outputs.read` | list (filter/sort/cursor); detail `GET /lppm/outputs/:id` — `research_outputs` |
| `POST /lppm/outputs` | CREATE | `litabmas.outputs.create` | wajib `Idempotency-Key` |
| `PATCH /lppm/outputs/:id` | UPDATE | `litabmas.outputs.update` | wajib `If-Match` (versi baris) |
| `POST /lppm/outputs/:id/toggle-active` | TOGGLE_ACTIVE | `litabmas.outputs.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /lppm/outputs/:id` | DELETE | `litabmas.outputs.delete` | hanya jika `GET /lppm/outputs/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /lppm/outputs/export` | EXPORT | `litabmas.outputs.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /lppm/proposals/:id/submit` | UPDATE | `litabmas.proposals.update` | ajukan |
| `POST /lppm/proposals/:id/assign-reviewers` | UPDATE | `litabmas.proposals.update` | plot reviewer buta |
| `POST /lppm/proposals/:id/approve` | APPROVE | `litabmas.proposals.approve` | tetapkan pendanaan |
| `POST /lppm/proposals/:id/reject` | REJECT | `litabmas.proposals.reject` | tolak |
| `POST /lppm/disbursements/:id/approve` | APPROVE | `litabmas.disbursements.approve` | BAUK cairkan termin |
| `POST /lppm/outputs/:id/validate` | APPROVE | `litabmas.outputs.approve` | validasi luaran SINTA/HAKI → BKD/SISTER/IKU5 |
| `GET /lppm/reports/export` | EXPORT | `litabmas.reports.export` | laporan LPPM |
| `GET /lppm/parameters` · `POST /lppm/parameters/:key/versions` | READ · PARAM_EDIT | `litabmas.parameters.read` · `litabmas.parameters.param_edit` | parameter modul: `lppm.reviewers_per_proposal`, `lppm.nb.enabled`, `lppm.tranches` |

#### 6.5.45 M-45 — CRM PMB & Marketing

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /crm/leads` | READ | `crm_marketing.leads.read` | list (filter/sort/cursor); detail `GET /crm/leads/:id` — `crm_leads` |
| `POST /crm/leads` | CREATE | `crm_marketing.leads.create` | wajib `Idempotency-Key` |
| `PATCH /crm/leads/:id` | UPDATE | `crm_marketing.leads.update` | wajib `If-Match` (versi baris) |
| `POST /crm/leads/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.leads.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/leads/:id` | DELETE | `crm_marketing.leads.delete` | hanya jika `GET /crm/leads/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/leads/export` | EXPORT | `crm_marketing.leads.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /crm/campaigns` | READ | `crm_marketing.campaigns.read` | list (filter/sort/cursor); detail `GET /crm/campaigns/:id` — `crm_campaigns` |
| `POST /crm/campaigns` | CREATE | `crm_marketing.campaigns.create` | wajib `Idempotency-Key` |
| `PATCH /crm/campaigns/:id` | UPDATE | `crm_marketing.campaigns.update` | wajib `If-Match` (versi baris) |
| `POST /crm/campaigns/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.campaigns.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/campaigns/:id` | DELETE | `crm_marketing.campaigns.delete` | hanya jika `GET /crm/campaigns/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/campaigns/export` | EXPORT | `crm_marketing.campaigns.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /crm/events` | READ | `crm_marketing.events.read` | list (filter/sort/cursor); detail `GET /crm/events/:id` — `crm_events` |
| `POST /crm/events` | CREATE | `crm_marketing.events.create` | wajib `Idempotency-Key` |
| `PATCH /crm/events/:id` | UPDATE | `crm_marketing.events.update` | wajib `If-Match` (versi baris) |
| `POST /crm/events/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.events.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/events/:id` | DELETE | `crm_marketing.events.delete` | hanya jika `GET /crm/events/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/events/export` | EXPORT | `crm_marketing.events.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /crm/agents` | READ | `crm_marketing.agents.read` | list (filter/sort/cursor); detail `GET /crm/agents/:id` — `crm_agents` |
| `POST /crm/agents` | CREATE | `crm_marketing.agents.create` | wajib `Idempotency-Key` |
| `PATCH /crm/agents/:id` | UPDATE | `crm_marketing.agents.update` | wajib `If-Match` (versi baris) |
| `POST /crm/agents/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.agents.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/agents/:id` | DELETE | `crm_marketing.agents.delete` | hanya jika `GET /crm/agents/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/agents/export` | EXPORT | `crm_marketing.agents.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /crm/funnel-rules` | READ | `crm_marketing.funnel_rules.read` | list (filter/sort/cursor); detail `GET /crm/funnel-rules/:id` — `crm_funnel_rules` |
| `POST /crm/funnel-rules` | CREATE | `crm_marketing.funnel_rules.create` | wajib `Idempotency-Key` |
| `PATCH /crm/funnel-rules/:id` | UPDATE | `crm_marketing.funnel_rules.update` | wajib `If-Match` (versi baris) |
| `POST /crm/funnel-rules/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.funnel_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/funnel-rules/:id` | DELETE | `crm_marketing.funnel_rules.delete` | hanya jika `GET /crm/funnel-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/funnel-rules/export` | EXPORT | `crm_marketing.funnel_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /crm/commission-rules` | READ | `crm_marketing.commission_rules.read` | list (filter/sort/cursor); detail `GET /crm/commission-rules/:id` — `crm_commission_rules` |
| `POST /crm/commission-rules` | CREATE | `crm_marketing.commission_rules.create` | wajib `Idempotency-Key` |
| `PATCH /crm/commission-rules/:id` | UPDATE | `crm_marketing.commission_rules.update` | wajib `If-Match` (versi baris) |
| `POST /crm/commission-rules/:id/toggle-active` | TOGGLE_ACTIVE | `crm_marketing.commission_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /crm/commission-rules/:id` | DELETE | `crm_marketing.commission_rules.delete` | hanya jika `GET /crm/commission-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /crm/commission-rules/export` | EXPORT | `crm_marketing.commission_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /crm/leads/:id/convert` | UPDATE | `crm_marketing.leads.update` | konversi lead → akun camaba M-09 (prefill, zero re-entry) |
| `POST /crm/commissions/:id/approve` | APPROVE | `crm_marketing.commissions.approve` | setujui komisi → jurnal M-10 |
| `POST /crm/commissions/:id/reject` | REJECT | `crm_marketing.commissions.reject` | tolak |
| `GET /crm/analytics/cac` | EXPORT | `crm_marketing.analytics.export` | CAC per kanal |
| `GET /crm/parameters` · `POST /crm/parameters/:key/versions` | READ · PARAM_EDIT | `crm_marketing.parameters.read` · `crm_marketing.parameters.param_edit` | parameter modul: `crm.lead_dedupe_threshold`, `crm.score.retrain_cron`, `crm.consent_required` |

#### 6.5.46 M-46 — E-Procurement PBJ

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /procurement/requests` | READ | `procurement.requests.read` | list (filter/sort/cursor); detail `GET /procurement/requests/:id` — `procurement_requests` |
| `POST /procurement/requests` | CREATE | `procurement.requests.create` | wajib `Idempotency-Key` |
| `PATCH /procurement/requests/:id` | UPDATE | `procurement.requests.update` | wajib `If-Match` (versi baris) |
| `POST /procurement/requests/:id/toggle-active` | TOGGLE_ACTIVE | `procurement.requests.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /procurement/requests/:id` | DELETE | `procurement.requests.delete` | hanya jika `GET /procurement/requests/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /procurement/requests/export` | EXPORT | `procurement.requests.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /procurement/vendors` | READ | `procurement.vendors.read` | list (filter/sort/cursor); detail `GET /procurement/vendors/:id` — `vendors` |
| `POST /procurement/vendors` | CREATE | `procurement.vendors.create` | wajib `Idempotency-Key` |
| `PATCH /procurement/vendors/:id` | UPDATE | `procurement.vendors.update` | wajib `If-Match` (versi baris) |
| `POST /procurement/vendors/:id/toggle-active` | TOGGLE_ACTIVE | `procurement.vendors.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /procurement/vendors/:id` | DELETE | `procurement.vendors.delete` | hanya jika `GET /procurement/vendors/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /procurement/vendors/export` | EXPORT | `procurement.vendors.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /procurement/bids` | READ | `procurement.bids.read` | list (filter/sort/cursor); detail `GET /procurement/bids/:id` — `rfq_bids` |
| `POST /procurement/bids` | CREATE | `procurement.bids.create` | wajib `Idempotency-Key` |
| `PATCH /procurement/bids/:id` | UPDATE | `procurement.bids.update` | wajib `If-Match` (versi baris) |
| `POST /procurement/bids/:id/toggle-active` | TOGGLE_ACTIVE | `procurement.bids.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /procurement/bids/:id` | DELETE | `procurement.bids.delete` | hanya jika `GET /procurement/bids/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /procurement/bids/export` | EXPORT | `procurement.bids.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /procurement/contracts` | READ | `procurement.contracts.read` | list (filter/sort/cursor); detail `GET /procurement/contracts/:id` — `procurement_contracts` |
| `POST /procurement/contracts` | CREATE | `procurement.contracts.create` | wajib `Idempotency-Key` |
| `PATCH /procurement/contracts/:id` | UPDATE | `procurement.contracts.update` | wajib `If-Match` (versi baris) |
| `POST /procurement/contracts/:id/toggle-active` | TOGGLE_ACTIVE | `procurement.contracts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /procurement/contracts/:id` | DELETE | `procurement.contracts.delete` | hanya jika `GET /procurement/contracts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /procurement/contracts/export` | EXPORT | `procurement.contracts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /procurement/goods-receipts` | READ | `procurement.goods_receipts.read` | list (filter/sort/cursor); detail `GET /procurement/goods-receipts/:id` — `goods_receipts` |
| `POST /procurement/goods-receipts` | CREATE | `procurement.goods_receipts.create` | wajib `Idempotency-Key` |
| `PATCH /procurement/goods-receipts/:id` | UPDATE | `procurement.goods_receipts.update` | wajib `If-Match` (versi baris) |
| `POST /procurement/goods-receipts/:id/toggle-active` | TOGGLE_ACTIVE | `procurement.goods_receipts.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /procurement/goods-receipts/:id` | DELETE | `procurement.goods_receipts.delete` | hanya jika `GET /procurement/goods-receipts/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /procurement/goods-receipts/export` | EXPORT | `procurement.goods_receipts.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /procurement/requests/:id/submit` | UPDATE | `procurement.requests.update` | ajukan → komitmen anggaran M-10 |
| `POST /procurement/requests/:id/approve` | APPROVE | `procurement.requests.approve` | approval berjenjang PPK |
| `POST /procurement/requests/:id/reject` | REJECT | `procurement.requests.reject` | tolak |
| `POST /procurement/requests/:id/evaluate` | UPDATE | `procurement.requests.update` | AHP evaluasi vendor |
| `POST /procurement/goods-receipts/:id/confirm` | APPROVE | `procurement.goods_receipts.approve` | BAST → aset M-40 + jurnal |
| `GET /procurement/reports/export` | EXPORT | `procurement.reports.export` | rekap PBJ |
| `GET /procurement/parameters` · `POST /procurement/parameters/:key/versions` | READ · PARAM_EDIT | `procurement.parameters.read` · `procurement.parameters.param_edit` | parameter modul: `pbj.approval_levels`, `pbj.low_price_threshold`, `pbj.direct_procurement_ceiling_idr` |

#### 6.5.47 M-47 — Endowment Fund

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /endowment/donors` | READ | `endowment.donors.read` | list (filter/sort/cursor); detail `GET /endowment/donors/:id` — `donors` |
| `POST /endowment/donors` | CREATE | `endowment.donors.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/donors/:id` | UPDATE | `endowment.donors.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/donors/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.donors.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/donors/:id` | DELETE | `endowment.donors.delete` | hanya jika `GET /endowment/donors/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/donors/export` | EXPORT | `endowment.donors.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/campaigns` | READ | `endowment.campaigns.read` | list (filter/sort/cursor); detail `GET /endowment/campaigns/:id` — `donor_campaigns` |
| `POST /endowment/campaigns` | CREATE | `endowment.campaigns.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/campaigns/:id` | UPDATE | `endowment.campaigns.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/campaigns/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.campaigns.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/campaigns/:id` | DELETE | `endowment.campaigns.delete` | hanya jika `GET /endowment/campaigns/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/campaigns/export` | EXPORT | `endowment.campaigns.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/donations` | READ | `endowment.donations.read` | list (filter/sort/cursor); detail `GET /endowment/donations/:id` — `donations` |
| `POST /endowment/donations` | CREATE | `endowment.donations.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/donations/:id` | UPDATE | `endowment.donations.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/donations/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.donations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/donations/:id` | DELETE | `endowment.donations.delete` | hanya jika `GET /endowment/donations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/donations/export` | EXPORT | `endowment.donations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/instruments` | READ | `endowment.instruments.read` | list (filter/sort/cursor); detail `GET /endowment/instruments/:id` — `fund_instruments` |
| `POST /endowment/instruments` | CREATE | `endowment.instruments.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/instruments/:id` | UPDATE | `endowment.instruments.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/instruments/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.instruments.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/instruments/:id` | DELETE | `endowment.instruments.delete` | hanya jika `GET /endowment/instruments/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/instruments/export` | EXPORT | `endowment.instruments.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/yields` | READ | `endowment.yields.read` | list (filter/sort/cursor); detail `GET /endowment/yields/:id` — `fund_yields` |
| `POST /endowment/yields` | CREATE | `endowment.yields.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/yields/:id` | UPDATE | `endowment.yields.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/yields/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.yields.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/yields/:id` | DELETE | `endowment.yields.delete` | hanya jika `GET /endowment/yields/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/yields/export` | EXPORT | `endowment.yields.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/allocation-rules` | READ | `endowment.allocation_rules.read` | list (filter/sort/cursor); detail `GET /endowment/allocation-rules/:id` — `fund_allocation_rules` |
| `POST /endowment/allocation-rules` | CREATE | `endowment.allocation_rules.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/allocation-rules/:id` | UPDATE | `endowment.allocation_rules.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/allocation-rules/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.allocation_rules.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/allocation-rules/:id` | DELETE | `endowment.allocation_rules.delete` | hanya jika `GET /endowment/allocation-rules/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/allocation-rules/export` | EXPORT | `endowment.allocation_rules.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `GET /endowment/allocations` | READ | `endowment.allocations.read` | list (filter/sort/cursor); detail `GET /endowment/allocations/:id` — `fund_allocations` |
| `POST /endowment/allocations` | CREATE | `endowment.allocations.create` | wajib `Idempotency-Key` |
| `PATCH /endowment/allocations/:id` | UPDATE | `endowment.allocations.update` | wajib `If-Match` (versi baris) |
| `POST /endowment/allocations/:id/toggle-active` | TOGGLE_ACTIVE | `endowment.allocations.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /endowment/allocations/:id` | DELETE | `endowment.allocations.delete` | hanya jika `GET /endowment/allocations/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /endowment/allocations/export` | EXPORT | `endowment.allocations.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /endowment/yields/:id/allocate` | UPDATE | `endowment.yields.update` | hitung alokasi |
| `POST /endowment/allocations/:id/approve` | APPROVE | `endowment.allocations.approve` | setujui → M-11/M-44 |
| `POST /endowment/allocations/:id/reject` | REJECT | `endowment.allocations.reject` | tolak |
| `GET /endowment/reports/export` | EXPORT | `endowment.reports.export` | laporan dana abadi |
| `GET /endowment/parameters` · `POST /endowment/parameters/:key/versions` | READ · PARAM_EDIT | `endowment.parameters.read` · `endowment.parameters.param_edit` | parameter modul: `endowment.spend_rate_max_bp` |

#### 6.5.48 APP — SuperApp Mobile

| Method & Path (`/api/v1`) | Aksi kanonik | Permission | Keterangan |
|---|---|---|---|
| `GET /mobile/devices` | READ | `mobile_superapp.devices.read` | list (filter/sort/cursor); detail `GET /mobile/devices/:id` — `devices` |
| `POST /mobile/devices` | CREATE | `mobile_superapp.devices.create` | wajib `Idempotency-Key` |
| `PATCH /mobile/devices/:id` | UPDATE | `mobile_superapp.devices.update` | wajib `If-Match` (versi baris) |
| `POST /mobile/devices/:id/toggle-active` | TOGGLE_ACTIVE | `mobile_superapp.devices.toggle_active` | soft (`is_active`), tidak menghapus riwayat |
| `DELETE /mobile/devices/:id` | DELETE | `mobile_superapp.devices.delete` | hanya jika `GET /mobile/devices/:id/impact` = 0 referensi; selain itu 409 `REFERENCED` |
| `GET /mobile/devices/export` | EXPORT | `mobile_superapp.devices.export` | CSV/XLSX async job, PII ter-mask sesuai izin |
| `POST /mobile/devices/bind` | CREATE | `mobile_superapp.devices.create` | binding perangkat (attestation) |
| `POST /mobile/devices/:id/revoke` | LOCK | `mobile_superapp.devices.lock` | cabut perangkat |
| `GET /mobile/sync/:stream` | READ | `mobile_superapp.sync.read` | pull delta sejak cursor |
| `POST /mobile/sync/:stream` | CREATE | `mobile_superapp.sync.create` | push mutasi offline (idempoten) |
| `GET /mobile/parameters` · `POST /mobile/parameters/:key/versions` | READ · PARAM_EDIT | `mobile_superapp.parameters.read` · `mobile_superapp.parameters.param_edit` | parameter modul: `mobile.max_devices_per_user`, `mobile.offline_checkin_max_minutes`, `mobile.min_app_version` |

<!-- SICA-47:END enterprise-47 -->
