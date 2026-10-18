import { z } from 'zod';
import { UUIDSchema } from './envelope';

// =============================================================================
// 1. Skema Enum Akademik
// =============================================================================

export const AcademicTermSchema = z.enum(['GANJIL', 'GENAP', 'ANTAR']);
export type AcademicTerm = z.infer<typeof AcademicTermSchema>;

export const PeriodStatusSchema = z.enum(['DRAFT', 'OPEN', 'CLOSING', 'CLOSED']);
export type PeriodStatus = z.infer<typeof PeriodStatusSchema>;

export const EnrollmentStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EFFECTIVE',
  'WITHDRAWN',
  'CANCELLED',
]);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatusSchema>;

export const GradeStatusSchema = z.enum([
  'EMPTY',
  'DRAFT',
  'SUBMITTED',
  'LOCKED',
  'CORRECTING',
  'CORRECTED',
]);
export type GradeStatus = z.infer<typeof GradeStatusSchema>;

export const StudentStatusSchema = z.enum([
  'CANDIDATE',
  'ACTIVE',
  'ON_LEAVE',
  'GRADUATED',
  'DROPPED',
  'STOPPED',
  'TRANSFERRED',
  'EXPELLED',
]);
export type StudentStatus = z.infer<typeof StudentStatusSchema>;

export const ClassStatusSchema = z.enum(['OPEN', 'CLOSED', 'CANCELLED']);
export type ClassStatus = z.infer<typeof ClassStatusSchema>;

// =============================================================================
// 2. Skema Input KRS (Pengisian KRS Mahasiswa)
// =============================================================================

/** Payload submit KRS — satu atau banyak kelas sekaligus */
export const KrsSubmitRequestSchema = z.object({
  periodId: UUIDSchema,
  classIds: z
    .array(UUIDSchema)
    .min(1, 'Minimal satu kelas harus dipilih.')
    .max(10, 'Maksimal 10 kelas per submit.'),
});
export type KrsSubmitRequest = z.infer<typeof KrsSubmitRequestSchema>;

/** Payload approval/rejection KRS oleh DPA */
export const KrsApprovalRequestSchema = z.object({
  enrollmentIds: z
    .array(UUIDSchema)
    .min(1, 'Minimal satu enrollment harus dipilih.'),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z
    .string()
    .min(10, 'Alasan penolakan minimal 10 karakter.')
    .optional(),
});
export type KrsApprovalRequest = z.infer<typeof KrsApprovalRequestSchema>;

// =============================================================================
// 3. Skema Input Nilai (Grading)
// =============================================================================

/** Satu entry input nilai dosen */
export const GradeInputEntrySchema = z.object({
  enrollmentId: UUIDSchema,
  rawScore: z
    .number()
    .min(0, 'Skor minimal 0.')
    .max(100, 'Skor maksimal 100.')
    .optional(),
  letterCode: z
    .string()
    .max(3, 'Kode huruf maksimal 3 karakter.')
    .optional(),
});
export type GradeInputEntry = z.infer<typeof GradeInputEntrySchema>;

/** Payload batch input nilai oleh dosen */
export const GradingSubmitRequestSchema = z.object({
  classId: UUIDSchema,
  periodId: UUIDSchema,
  entries: z
    .array(GradeInputEntrySchema)
    .min(1, 'Minimal satu nilai harus diinput.'),
  action: z.enum(['SAVE_DRAFT', 'SUBMIT_FINAL']),
});
export type GradingSubmitRequest = z.infer<typeof GradingSubmitRequestSchema>;

/** Payload koreksi nilai */
export const GradeCorrectionRequestSchema = z.object({
  gradeId: UUIDSchema,
  reason: z.string().min(15, 'Alasan koreksi minimal 15 karakter.'),
  newLetterCode: z.string().max(3).optional(),
  newRawScore: z.number().min(0).max(100).optional(),
});
export type GradeCorrectionRequest = z.infer<typeof GradeCorrectionRequestSchema>;

// =============================================================================
// 4. Skema Response Akademik
// =============================================================================

/** Response IPS semester */
export const SemesterGpaResponseSchema = z.object({
  periodId: UUIDSchema,
  periodLabel: z.string(),
  ips: z.number(),
  totalSks: z.number(),
  passedSks: z.number(),
  courseCount: z.number(),
  passedCourseCount: z.number(),
});
export type SemesterGpaResponse = z.infer<typeof SemesterGpaResponseSchema>;

/** Response IPK kumulatif + daftar IPS semester */
export const CumulativeGpaResponseSchema = z.object({
  ipk: z.number(),
  totalSks: z.number(),
  passedSks: z.number(),
  totalCourseCount: z.number(),
  passedCourseCount: z.number(),
  semesters: z.array(SemesterGpaResponseSchema),
});
export type CumulativeGpaResponse = z.infer<typeof CumulativeGpaResponseSchema>;

/** Response kuota SKS */
export const SksQuotaResponseSchema = z.object({
  maxAllowedSks: z.number(),
  usedSks: z.number(),
  remainingSks: z.number(),
  ipsLastSemester: z.number().nullable(),
  thresholdLabel: z.string().nullable(),
});
export type SksQuotaResponse = z.infer<typeof SksQuotaResponseSchema>;

/** Response satu item kelas KRS */
export const KrsClassItemSchema = z.object({
  classId: UUIDSchema,
  courseCode: z.string(),
  courseName: z.string(),
  className: z.string(),
  sks: z.number(),
  capacity: z.number(),
  enrolledCount: z.number(),
  lecturerNames: z.array(z.string()),
  schedules: z.array(
    z.object({
      dayOfWeek: z.number().min(1).max(7),
      startTime: z.string(),
      endTime: z.string(),
      roomCode: z.string().nullable(),
    })
  ),
  hasConflict: z.boolean(),
  conflictDescription: z.string().nullable(),
});
export type KrsClassItem = z.infer<typeof KrsClassItemSchema>;

/** Response daftar jadwal yang bentrok */
export const ScheduleConflictResponseSchema = z.object({
  type: z.enum(['ROOM', 'LECTURER', 'STUDENT']),
  classNameA: z.string(),
  classNameB: z.string(),
  resourceLabel: z.string(),
  dayLabel: z.string(),
  overlapRange: z.string(),
  description: z.string(),
});
export type ScheduleConflictResponse = z.infer<typeof ScheduleConflictResponseSchema>;

// =============================================================================
// 5. Query Params
// =============================================================================

/** Query parameter untuk fetch kelas KRS yang tersedia */
export const OpenClassesQuerySchema = z.object({
  periodId: UUIDSchema,
  search: z.string().trim().optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type OpenClassesQuery = z.infer<typeof OpenClassesQuerySchema>;

/** Query parameter untuk KHS */
export const KhsQuerySchema = z.object({
  periodId: UUIDSchema,
});
export type KhsQuery = z.infer<typeof KhsQuerySchema>;
