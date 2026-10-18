import { z } from 'zod';
import { UUIDSchema } from './envelope';

// =============================================================================
// Presensi & Matakuliah — kontrak sejalan schema Drizzle (DATA_MODEL §11.3–11.4).
// Sumber kebenaran tipe bersama Web (TS) & Mobile (Dart via OpenAPI). Guardrail §3.4.
// =============================================================================

export const AttendanceStatusSchema = z.enum([
  'PRESENT',
  'EXCUSED',
  'SICK',
  'ABSENT_LATE',
  'ABSENT',
]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const AttendanceSourceSchema = z.enum([
  'QR',
  'GEOFENCE',
  'MANUAL',
  'APP_BULK',
  'FEEDER_SYNC',
]);
export type AttendanceSource = z.infer<typeof AttendanceSourceSchema>;

export const CourseTypeSchema = z.enum([
  'TEORI',
  'PRAKTIKUM',
  'LABORATORIUM',
  'LAPANGAN',
  'KULIAH_MANDIRI',
]);
export type CourseType = z.infer<typeof CourseTypeSchema>;

/** Proyeksi baris presensi utk respons API. */
export const AttendanceRecordSchema = z.object({
  id: UUIDSchema,
  tenantId: UUIDSchema,
  sessionId: UUIDSchema,
  studentId: UUIDSchema,
  status: AttendanceStatusSchema,
  present: z.boolean(),
  source: AttendanceSourceSchema,
  markedAt: z.string().datetime(),
  markedBy: UUIDSchema.nullable().optional(),
  distanceMeters: z.number().int().nonnegative().nullable().optional(),
  isMockLocation: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;

/** Penandaan manual/bulk oleh dosen/admin (di luar self-scan QR). */
export const MarkAttendanceSchema = z.object({
  sessionId: UUIDSchema,
  studentId: UUIDSchema,
  status: AttendanceStatusSchema,
  notes: z.string().max(500).optional(),
});
export type MarkAttendanceRequest = z.infer<typeof MarkAttendanceSchema>;

/** Pemecahan SKS matakuliah (total = teori + praktik; total tetap otoritatif). */
export const CourseSksSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sks: z.number().positive(),
  sksTeori: z.number().nonnegative().nullable().optional(),
  sksPraktik: z.number().nonnegative().nullable().optional(),
  courseType: CourseTypeSchema.nullable().optional(),
}).refine(
  (c) =>
    c.sksTeori == null ||
    c.sksPraktik == null ||
    Math.abs(c.sksTeori + c.sksPraktik - c.sks) < 0.05,
  { message: 'sksTeori + sksPraktik harus ≈ sks total.', path: ['sksPraktik'] }
);
export type CourseSks = z.infer<typeof CourseSksSchema>;
