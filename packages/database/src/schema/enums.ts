import { pgEnum } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', [
  'ONBOARDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
]);

export const memberStatusEnum = pgEnum('member_status', [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'LEFT',
]);

/**
 * Peran pengguna DALAM satu tenant (RBAC per-tenant). Nilainya identik dgn
 * `AuthUserRoleSchema` di @sica/contracts (superadmin lintas-tenant di level platform).
 */
export const memberRoleEnum = pgEnum('member_role', [
  'super_admin',
  'tenant_admin',
  'dosen',
  'mahasiswa',
  'staff',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
]);

export const studentStatusEnum = pgEnum('student_status', [
  'CANDIDATE',
  'ACTIVE',
  'ON_LEAVE',
  'GRADUATED',
  'DROPPED',
  'STOPPED',
  'TRANSFERRED',
  'EXPELLED',
]);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'EFFECTIVE',
  'WITHDRAWN',
  'CANCELLED',
]);

export const gradeStatusEnum = pgEnum('grade_status', [
  'EMPTY',
  'DRAFT',
  'SUBMITTED',
  'LOCKED',
  'CORRECTING',
  'CORRECTED',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'DRAFT',
  'ISSUED',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'WAIVED',
  'VOID',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'INITIATED',
  'PENDING',
  'SETTLED',
  'FAILED',
  'REFUNDED',
]);

export const periodStatusEnum = pgEnum('period_status', [
  'DRAFT',
  'OPEN',
  'CLOSING',
  'CLOSED',
]);

export const academicYearTermEnum = pgEnum('academic_year_term', [
  'GANJIL',
  'GENAP',
  'ANTAR',
]);

// ── Field-data completeness (DATA_MODEL §11 — Sevima/PDDikti Neo Feeder) ──
export const sexEnum = pgEnum('sex_type', ['M', 'F']);

export const incomeBandEnum = pgEnum('income_band', [
  'LEB_300',
  'L300_500',
  'L500_1JT',
  'L1_2JT',
  'GT_2JT',
  'TIDAK_BEKERJA',
]);

export const lecturerJobRankEnum = pgEnum('lecturer_job_rank', [
  'GURU_BESAR',
  'LEKTOR_KEPALA',
  'LEKTOR',
  'ASISTEN_AHLI',
  'TENAGA_PENGAJAR',
  'NONE',
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'PNS',
  'PPPK_PENUH',
  'PPPK_PARUH',
  'DOSEN_TETAP_YAYASAN',
  'DOSEN_LUAR_BIASA',
  'DOSEN_TIDAK_TETAP',
  'TENAGA_HONORER',
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'PRESENT',
  'EXCUSED',
  'SICK',
  'ABSENT_LATE',
  'ABSENT',
]);

/** Sumber pencatatan presensi (audit trail anti-pemalsuan + analitik kepatuhan). */
export const attendanceSourceEnum = pgEnum('attendance_source', [
  'QR',
  'GEOFENCE',
  'MANUAL',
  'APP_BULK',
  'FEEDER_SYNC',
]);

/** Jenis pembelajaran matakuliah — pemecahan SKS ala PDDikti/Sevima. (DATA_MODEL §11.3) */
export const courseTypeEnum = pgEnum('course_type', [
  'TEORI',
  'PRAKTIKUM',
  'LABORATORIUM',
  'LAPANGAN',
  'KULIAH_MANDIRI',
]);

// ── Modular SaaS entitlement / add-on gating (DATA_MODEL §12) ──
export const moduleCategoryEnum = pgEnum('module_category', ['CORE', 'ADDON']);
export const moduleLicenseMetricEnum = pgEnum('module_license_metric', [
  'INCLUDED',
  'PER_SEAT',
  'FLAT',
]);
export const tenantModuleStatusEnum = pgEnum('tenant_module_status', [
  'ACTIVE',
  'TRIAL',
  'DISABLED',
  'EXPIRED',
  'PENDING_PAYMENT',
]);

// ── RBAC ber-scope (DATA_MODEL §3 / §14.4, migrasi 0011) ──
/** 6 aksi kanonik FR-IDT-04; identik `PERMISSION_VERBS` di @sica/contracts. */
export const permissionVerbEnum = pgEnum('permission_verb', [
  'READ',
  'INSERT',
  'UPDATE',
  'DELETE',
  'VALIDATE',
  'OTHER',
]);

/** Lingkup tempat sebuah peran dirancang; identik `SCOPE_KINDS` di @sica/contracts. */
export const roleScopeKindEnum = pgEnum('role_scope_kind', [
  'TENANT',
  'ORG',
  'PROGRAM',
  'CLASS',
  'PERIOD',
  'SELF',
]);

export const accessRequestStatusEnum = pgEnum('access_request_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

/** Jenis perubahan hak yang diminta — kosakata tertutup (kelas A): ia memilih mesin
 *  state persetujuan, bukan label yang dapat dirawat kampus. Lihat migrasi `0082`. */
export const accessRequestKindEnum = pgEnum('access_request_kind', [
  'GRANT',
  'REVOKE',
  'SCOPE_CHANGE',
  'ROLE_PERMISSION_CHANGE',
]);
