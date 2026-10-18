import { z } from 'zod';
import { UUIDSchema } from './envelope';
import { StudentStatusSchema } from './academic';

// =============================================================================
// Personel & Biodata (feeder) — kontrak sejalan schema Drizzle (DATA_MODEL §11.2–11.3).
// Dipakai form registrasi Web & Mobile; field wajib feeder ditegakkan di sini (§3.3).
// =============================================================================

export const SexSchema = z.enum(['M', 'F']);
export type Sex = z.infer<typeof SexSchema>;

export const LecturerJobRankSchema = z.enum([
  'GURU_BESAR',
  'LEKTOR_KEPALA',
  'LEKTOR',
  'ASISTEN_AHLI',
  'TENAGA_PENGAJAR',
  'NONE',
]);
export type LecturerJobRank = z.infer<typeof LecturerJobRankSchema>;

export const EmploymentTypeSchema = z.enum([
  'PNS',
  'PPPK_PENUH',
  'PPPK_PARUH',
  'DOSEN_TETAP_YAYASAN',
  'DOSEN_LUAR_BIASA',
  'DOSEN_TIDAK_TETAP',
  'TENAGA_HONORER',
]);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const IncomeBandSchema = z.enum([
  'LEB_300',
  'L300_500',
  'L500_1JT',
  'L1_2JT',
  'GT_2JT',
  'TIDAK_BEKERJA',
]);
export type IncomeBand = z.infer<typeof IncomeBandSchema>;

/** Sumber pendanaan studi mahasiswa (feeder). */
export const FundingSourceSchema = z.enum([
  'MANDIRI',
  'BEASISWA',
  'BIA_ADIK',
  'KERJA_SAMA',
  'LAIN',
]);

/** Biodata mahasiswa (kolom wajib feeder + pelengkap). Id tenant/session dari konteks, bukan body. */
export const StudentBiodataSchema = z.object({
  nim: z.string().min(4).max(30),
  fullName: z.string().min(2).max(150),
  programId: UUIDSchema,
  curriculumId: UUIDSchema.nullish(),
  entryYear: z.number().int().min(1900).max(2999),
  entryRoute: z.string().max(60).nullish(),
  status: StudentStatusSchema.default('ACTIVE'),
  sex: SexSchema.nullish(),
  birthPlace: z.string().max(120).nullish(),
  birthDate: z.string().date().nullish(),
  citizenship: z.string().min(2).max(60).default('WNI'),
  religion: z.string().max(40).nullish(),
  childOrder: z.number().int().positive().nullish(),
  mobilePhone: z.string().max(30).nullish(),
  personalEmail: z.string().email().nullish(),
  fundingSource: FundingSourceSchema.nullish(),
  photoUrl: z.string().url().nullish(),
  pddiktiIdPpd: UUIDSchema.nullish(),
  nisn: z.string().max(20).nullish(),
  feederStatusCode: z.string().min(1).max(4).default('1'), // 1 AKTIF..5 LULUS (PDDikti)
});
export type StudentBiodata = z.infer<typeof StudentBiodataSchema>;

/** Wali/penjamin mahasiswa (feeder §11.2). */
export const StudentGuardianSchema = z.object({
  name: z.string().min(2).max(150),
  relationship: z.string().min(2).max(40),
  phone: z.string().max(30).nullish(),
  incomeBand: IncomeBandSchema.nullish(),
});
export type StudentGuardian = z.infer<typeof StudentGuardianSchema>;

/** Data dosen (identitas feeder per-tenant; akun global direferensi via membershipId). */
export const LecturerSchema = z.object({
  membershipId: UUIDSchema,
  programId: UUIDSchema.nullish(),
  nidn: z.string().max(30).nullish(),
  nuptk: z.string().max(30).nullish(),
  pddiktiIdDosen: UUIDSchema.nullish(),
  code: z.string().max(40).nullish(),
  specialization: z.string().max(160).nullish(),
  academicRank: LecturerJobRankSchema.default('NONE'),
  employmentType: EmploymentTypeSchema.default('DOSEN_TETAP_YAYASAN'),
  isPrimaryLecturer: z.boolean().default(true),
  scienceCluster: z.string().max(120).nullish(),
  gender: SexSchema.nullish(),
  birthPlace: z.string().max(120).nullish(),
  birthDate: z.string().date().nullish(),
  nationality: z.string().min(2).max(60).default('WNI'),
  mobilePhone: z.string().max(30).nullish(),
  officialEmail: z.string().email().nullish(),
  startServiceDate: z.string().date().nullish(),
});
export type Lecturer = z.infer<typeof LecturerSchema>;
