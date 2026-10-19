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
