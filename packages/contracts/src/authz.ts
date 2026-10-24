/**
 * Authorization & RBAC contracts — satu sumber kebenaran untuk peran, izin, dan aksi.
 *
 * Dirujuk dari docs/RBAC_MATRIX.md §2 (peran), §4 + §4.4 (katalog izin), §1.2 (6 aksi
 * kanonik / FR-IDT-04). Kode string TIDAK BOLEH ditulis langsung di controller/route —
 * import konstanta `PERM` dari sini (guardrail AGENTS.md §3.8).
 *
 * Lapis yang dipisahkan di file ini:
 *  - `CARRIER_ROLES`  = nilai enum `member_role` (lapis login, 5 nilai, sudah ada di DB).
 *  - `ROLE_CODES`     = `roles.code` (lapis RBAC ber-scope, 17 peran sistem).
 *  - `CLASS_ROLES`    = nilai `class_assignments.role_in_class` (atribut, bukan peran).
 */
import { z } from 'zod';

// =============================================================================
// 1. Peran
// =============================================================================

/** Carrier login — identik enum PG `member_role` dan `AuthUserRoleSchema`. */
export const CARRIER_ROLES = ['super_admin', 'tenant_admin', 'dosen', 'mahasiswa', 'staff'] as const;
export type CarrierRole = (typeof CARRIER_ROLES)[number];

export const CarrierRoleSchema = z.enum(CARRIER_ROLES);

/** `roles.code` kanonik (UPPER_SNAKE). Lihat RBAC_MATRIX §2.1. */
export const ROLE_CODES = [
  'PLATFORM_OPERATOR',
  'TENANT_ADMIN',
  'ADMIN_ACADEMIC',
  'HEAD_OF_PROGRAM',
  'LECTURER',
  'ADVISER',
  'FEEDER_OPERATOR',
  'ADMIN_FINANCE',
  'TREASURER',
  'LEADER',
  'STAFF',
  'STUDENT',
  'APPLICANT',
  'GUARDIAN',
  'ALUMNI',
  'QUALITY_OFFICER',
  'COMPLIANCE_OFFICER',
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const RoleCodeSchema = z.enum(ROLE_CODES);

/** Atribut penugasan kelas — BUKAN `roles.code` (RBAC_MATRIX §2.2). */
export const CLASS_ROLES = ['COORDINATOR', 'LECTURER', 'LAB_ASSIST', 'EXAMINER', 'ADVISER'] as const;
export type ClassRole = (typeof CLASS_ROLES)[number];

export const ClassRoleSchema = z.enum(CLASS_ROLES);

/** Ruang lingkup penugasan (`roles.scope_kind` + CHECK di DDL). */
export const SCOPE_KINDS = ['TENANT', 'ORG', 'PROGRAM', 'CLASS', 'PERIOD', 'SELF'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const ScopeKindSchema = z.enum(SCOPE_KINDS);

/**
 * Peta transisi carrier → peran (RBAC_MATRIX §2.4). Selama tabel `roles` &
 * `user_role_assignments` belum ada (celah G-02), ini satu-satunya perluasan yang
 * sah. Nilai tak dikenal → array kosong (fail-closed, menutup celah G-01).
 *
 * `ADMIN_FINANCE` / `TREASURER` sengaja TIDAK dipetakan ke carrier
 * `tenant_admin`: keduanya adalah pasangan SoD (BR-K2) dan hanya boleh datang dari
 * penugasan eksplisit. Menyalakan `violatesSoD()` di atas hasil perluasan akan
 * membuat satu orang bisa mengajukan sekaligus menyetujui pembatalan tagihan.
 *
 * `HEAD_OF_PROGRAM` juga TIDAK dipetakan ke carrier `dosen` — uji regresi menangkap
 * bahwa perluasan itu memberi `grading.unlock` ke SEMUA dosen, padahal hak itu
 * khusus kaprodi (BR-G4). Kaum dosen baru bisa naik jadi kaprodi lewat assignment.
 */
export const CARRIER_TO_ROLES: Readonly<Record<CarrierRole, readonly RoleCode[]>> = {
  super_admin: ['PLATFORM_OPERATOR'],
  tenant_admin: ['TENANT_ADMIN', 'ADMIN_ACADEMIC', 'LEADER'],
  dosen: ['LECTURER', 'ADVISER'],
  mahasiswa: ['STUDENT'],
  staff: ['STAFF', 'FEEDER_OPERATOR', 'QUALITY_OFFICER', 'COMPLIANCE_OFFICER'],
};

// =============================================================================
// 2. Aksi kanonik (FR-IDT-04 / DATA_MODEL §14.4)
// =============================================================================

export const PERMISSION_VERBS = ['READ', 'INSERT', 'UPDATE', 'DELETE', 'VALIDATE', 'OTHER'] as const;
export type PermissionVerb = (typeof PERMISSION_VERBS)[number];

export const PermissionVerbSchema = z.enum(PERMISSION_VERBS);

/** Grup modul: 19 modul katalog + namespace non-katalog yang menunggu keputusan G-10. */
export const PERMISSION_MODULES = [
  'identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment',
  'finance', 'feeder_pddikti', 'audit', 'entitlement', 'platform', 'settings', 'document',
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/**
 * Prefiks warisan yang namanya sengaja beda dari kode modul (RBAC_MATRIX §4.1):
 * `grading.*` milik modul `assessment`, `student.*` milik `academic`,
 * `feeder.*` milik `feeder_pddikti`. Dipakai uji katalog & seeder migrasi,
 * sehingga aturan ini tidak ditulis ulang di dua tempat.
 */
export const MODULE_PREFIX_ALIASES: Readonly<Record<string, PermissionModule>> = {
  grading: 'assessment',
  student: 'academic',
  feeder: 'feeder_pddikti',
  // RBAC_MATRIX §4.5 baris 127–145: titik aksi data master hidup di modul `academic`
  // meski kodenya berprefiks `master.` (nama resource mengikuti layar, bukan modul).
  master: 'academic',
  // Baris 158–161: tata kelola menu adalah permukaan entitlement, tetapi namanya
  // tetap `platform.menu.*` karena yang dirawat adalah pohon lintas tenant.
  platform: 'entitlement',
};

/** Satu baris = satu titik aksi pada satu menu; kolom ini dipetakan ke `permissions`. */
export interface PermissionSpec {
  readonly key: string;
  readonly code: string;
  readonly module: PermissionModule;
  readonly resource: string;
  readonly verb: PermissionVerb;
}

// =============================================================================
// 3. Katalog izin
// =============================================================================

const SPECS = [
  // ── identity ───────────────────────────────────────────────────────────────
  { key: 'identityProfileView', code: 'identity.profile.view', module: 'identity', resource: 'identity.profile', verb: 'READ' },
  { key: 'identityProfileUpdate', code: 'identity.profile.update', module: 'identity', resource: 'identity.profile', verb: 'UPDATE' },
  { key: 'identityPasswordReset', code: 'identity.password.reset', module: 'identity', resource: 'identity.profile', verb: 'UPDATE' },
  { key: 'identitySessionView', code: 'identity.session.view', module: 'identity', resource: 'identity.session', verb: 'READ' },
  { key: 'identitySessionRevoke', code: 'identity.session.revoke', module: 'identity', resource: 'identity.session', verb: 'DELETE' },
  { key: 'identityMfaManage', code: 'identity.mfa.manage', module: 'identity', resource: 'identity.mfa', verb: 'UPDATE' },
  { key: 'identityLoginStatsView', code: 'identity.loginstats.view', module: 'identity', resource: 'admin.monitoring', verb: 'READ' },
  { key: 'identityUserView', code: 'identity.user.view', module: 'identity', resource: 'admin.pengguna', verb: 'READ' },
  { key: 'identityUserCreate', code: 'identity.user.create', module: 'identity', resource: 'admin.pengguna', verb: 'INSERT' },
  { key: 'identityUserUpdate', code: 'identity.user.update', module: 'identity', resource: 'admin.pengguna', verb: 'UPDATE' },
  { key: 'identityUserDeactivate', code: 'identity.user.deactivate', module: 'identity', resource: 'admin.pengguna', verb: 'UPDATE' },
  { key: 'identityMembershipView', code: 'identity.membership.view', module: 'identity', resource: 'admin.pengguna', verb: 'READ' },
  { key: 'identityMembershipCreate', code: 'identity.membership.create', module: 'identity', resource: 'admin.pengguna', verb: 'INSERT' },
  { key: 'identityMembershipUpdate', code: 'identity.membership.update', module: 'identity', resource: 'admin.pengguna', verb: 'UPDATE' },
  { key: 'identityRoleView', code: 'identity.role.view', module: 'identity', resource: 'admin.hak-akses', verb: 'READ' },
  { key: 'identityRoleCreate', code: 'identity.role.create', module: 'identity', resource: 'admin.hak-akses', verb: 'INSERT' },
  { key: 'identityRoleUpdate', code: 'identity.role.update', module: 'identity', resource: 'admin.hak-akses', verb: 'UPDATE' },
  { key: 'identityRoleDelete', code: 'identity.role.delete', module: 'identity', resource: 'admin.hak-akses', verb: 'DELETE' },
  { key: 'identityPermissionView', code: 'identity.permission.view', module: 'identity', resource: 'admin.hak-akses', verb: 'READ' },
  { key: 'identityAssignmentView', code: 'identity.assignment.view', module: 'identity', resource: 'admin.hak-akses', verb: 'READ' },
  { key: 'identityAssignmentGrant', code: 'identity.assignment.grant', module: 'identity', resource: 'admin.hak-akses', verb: 'INSERT' },
  { key: 'identityAssignmentRevoke', code: 'identity.assignment.revoke', module: 'identity', resource: 'admin.hak-akses', verb: 'DELETE' },
  { key: 'identityAccessRequestView', code: 'identity.accessrequest.view', module: 'identity', resource: 'admin.hak-akses', verb: 'READ' },
  { key: 'identityAccessRequestApprove', code: 'identity.accessrequest.approve', module: 'identity', resource: 'admin.hak-akses', verb: 'VALIDATE' },
  { key: 'identityImpersonationGrant', code: 'identity.impersonation.grant', module: 'identity', resource: 'admin.pengguna.impersonate', verb: 'OTHER' },
  { key: 'identityImpersonationRevoke', code: 'identity.impersonation.revoke', module: 'identity', resource: 'admin.pengguna.impersonate', verb: 'OTHER' },

  // ── academic ───────────────────────────────────────────────────────────────
  { key: 'academicOrganizationView', code: 'academic.organization.view', module: 'academic', resource: 'admin.organisasi', verb: 'READ' },
  { key: 'academicOrganizationCreate', code: 'academic.organization.create', module: 'academic', resource: 'admin.organisasi', verb: 'INSERT' },
  { key: 'academicOrganizationUpdate', code: 'academic.organization.update', module: 'academic', resource: 'admin.organisasi', verb: 'UPDATE' },
  { key: 'academicOrganizationDelete', code: 'academic.organization.delete', module: 'academic', resource: 'admin.organisasi', verb: 'DELETE' },
  { key: 'academicPeriodView', code: 'academic.period.view', module: 'academic', resource: 'admin.master.periode', verb: 'READ' },
  { key: 'academicPeriodCreate', code: 'academic.period.create', module: 'academic', resource: 'admin.master.periode', verb: 'INSERT' },
  { key: 'academicPeriodUpdate', code: 'academic.period.update', module: 'academic', resource: 'admin.master.periode', verb: 'UPDATE' },
  { key: 'academicPeriodClose', code: 'academic.period.close', module: 'academic', resource: 'admin.master.periode', verb: 'UPDATE' },
  { key: 'academicPeriodReopenRequest', code: 'academic.periodreopen.request', module: 'academic', resource: 'admin.master.periode', verb: 'INSERT' },
  { key: 'academicPeriodReopenApprove', code: 'academic.periodreopen.approve', module: 'academic', resource: 'admin.master.periode', verb: 'VALIDATE' },
  { key: 'academicCalendarView', code: 'academic.calendar.view', module: 'academic', resource: 'admin.master.kalender', verb: 'READ' },
  { key: 'academicCalendarCreate', code: 'academic.calendar.create', module: 'academic', resource: 'admin.master.kalender', verb: 'INSERT' },
  { key: 'academicCalendarUpdate', code: 'academic.calendar.update', module: 'academic', resource: 'admin.master.kalender', verb: 'UPDATE' },
  { key: 'academicCalendarDelete', code: 'academic.calendar.delete', module: 'academic', resource: 'admin.master.kalender', verb: 'DELETE' },
  { key: 'academicProgramView', code: 'academic.program.view', module: 'academic', resource: 'admin.master.prodi', verb: 'READ' },
  { key: 'academicProgramCreate', code: 'academic.program.create', module: 'academic', resource: 'admin.master.prodi', verb: 'INSERT' },
  { key: 'academicProgramUpdate', code: 'academic.program.update', module: 'academic', resource: 'admin.master.prodi', verb: 'UPDATE' },
  { key: 'academicProgramDelete', code: 'academic.program.delete', module: 'academic', resource: 'admin.master.prodi', verb: 'DELETE' },
  { key: 'academicCurriculumView', code: 'academic.curriculum.view', module: 'academic', resource: 'admin.master.kurikulum', verb: 'READ' },
  { key: 'academicCurriculumCreate', code: 'academic.curriculum.create', module: 'academic', resource: 'admin.master.kurikulum', verb: 'INSERT' },
  { key: 'academicCurriculumUpdate', code: 'academic.curriculum.update', module: 'academic', resource: 'admin.master.kurikulum', verb: 'UPDATE' },
  { key: 'academicCurriculumPublish', code: 'academic.curriculum.publish', module: 'academic', resource: 'admin.master.kurikulum', verb: 'UPDATE' },
  { key: 'academicCourseView', code: 'academic.course.view', module: 'academic', resource: 'admin.master.matakuliah', verb: 'READ' },
  { key: 'academicCourseCreate', code: 'academic.course.create', module: 'academic', resource: 'admin.master.matakuliah', verb: 'INSERT' },
  { key: 'academicCourseUpdate', code: 'academic.course.update', module: 'academic', resource: 'admin.master.matakuliah', verb: 'UPDATE' },
  { key: 'academicCourseDelete', code: 'academic.course.delete', module: 'academic', resource: 'admin.master.matakuliah', verb: 'DELETE' },
  { key: 'academicPrerequisiteView', code: 'academic.prerequisite.view', module: 'academic', resource: 'admin.master.prasyarat', verb: 'READ' },
  { key: 'academicPrerequisiteCreate', code: 'academic.prerequisite.create', module: 'academic', resource: 'admin.master.prasyarat', verb: 'INSERT' },
  { key: 'academicPrerequisiteDelete', code: 'academic.prerequisite.delete', module: 'academic', resource: 'admin.master.prasyarat', verb: 'DELETE' },
  { key: 'academicEquivalencyView', code: 'academic.equivalency.view', module: 'academic', resource: 'admin.master.ekivalensi', verb: 'READ' },
  { key: 'academicEquivalencyManage', code: 'academic.equivalency.manage', module: 'academic', resource: 'admin.master.ekivalensi', verb: 'UPDATE' },
  { key: 'academicReferenceView', code: 'academic.reference.view', module: 'academic', resource: 'admin.master.referensi', verb: 'READ' },
  { key: 'academicReferenceManage', code: 'academic.reference.manage', module: 'academic', resource: 'admin.master.referensi', verb: 'UPDATE' },
  { key: 'academicRoomView', code: 'academic.room.view', module: 'academic', resource: 'admin.master.ruang', verb: 'READ' },
  { key: 'academicRoomCreate', code: 'academic.room.create', module: 'academic', resource: 'admin.master.ruang', verb: 'INSERT' },
  { key: 'academicRoomUpdate', code: 'academic.room.update', module: 'academic', resource: 'admin.master.ruang', verb: 'UPDATE' },
  { key: 'academicRoomDelete', code: 'academic.room.delete', module: 'academic', resource: 'admin.master.ruang', verb: 'DELETE' },
  { key: 'academicRuleView', code: 'academic.rule.view', module: 'academic', resource: 'admin.pengaturan.akademik', verb: 'READ' },
  { key: 'academicRuleCreate', code: 'academic.rule.create', module: 'academic', resource: 'admin.pengaturan.akademik', verb: 'INSERT' },
  { key: 'academicRuleUpdate', code: 'academic.rule.update', module: 'academic', resource: 'admin.pengaturan.akademik', verb: 'UPDATE' },
  { key: 'academicGateView', code: 'academic.gate.view', module: 'academic', resource: 'admin.pengaturan.gerbang', verb: 'READ' },
  { key: 'academicGateConfigure', code: 'academic.gate.configure', module: 'academic', resource: 'admin.pengaturan.gerbang', verb: 'UPDATE' },
  { key: 'academicBlockadeView', code: 'academic.blockade.view', module: 'academic', resource: 'admin.pengaturan.cekal', verb: 'READ' },
  { key: 'academicBlockadeCreate', code: 'academic.blockade.create', module: 'academic', resource: 'admin.pengaturan.cekal', verb: 'INSERT' },
  { key: 'academicBlockadeRelease', code: 'academic.blockade.release', module: 'academic', resource: 'admin.pengaturan.cekal', verb: 'DELETE' },
  { key: 'academicStudentView', code: 'academic.student.view', module: 'academic', resource: 'admin.personel.mahasiswa', verb: 'READ' },
  { key: 'academicStudentCreate', code: 'academic.student.create', module: 'academic', resource: 'admin.personel.mahasiswa', verb: 'INSERT' },
  { key: 'academicStudentUpdate', code: 'academic.student.update', module: 'academic', resource: 'admin.personel.mahasiswa', verb: 'UPDATE' },
  { key: 'academicStudentArchive', code: 'academic.student.archive', module: 'academic', resource: 'admin.personel.mahasiswa', verb: 'DELETE' },
  { key: 'academicStudentStatusView', code: 'academic.studentstatus.view', module: 'academic', resource: 'admin.personel.status', verb: 'READ' },
  { key: 'studentStatusChange', code: 'student.status.change', module: 'academic', resource: 'admin.personel.status', verb: 'UPDATE' },
  { key: 'academicTransferRequest', code: 'academic.transfer.request', module: 'academic', resource: 'admin.personel.status', verb: 'INSERT' },
  { key: 'academicTransferApprove', code: 'academic.transfer.approve', module: 'academic', resource: 'admin.personel.status', verb: 'VALIDATE' },
  { key: 'academicLecturerView', code: 'academic.lecturer.view', module: 'academic', resource: 'admin.personel.dosen', verb: 'READ' },
  { key: 'academicLecturerCreate', code: 'academic.lecturer.create', module: 'academic', resource: 'admin.personel.dosen', verb: 'INSERT' },
  { key: 'academicLecturerUpdate', code: 'academic.lecturer.update', module: 'academic', resource: 'admin.personel.dosen', verb: 'UPDATE' },
  { key: 'academicGuardianView', code: 'academic.guardian.view', module: 'academic', resource: 'admin.personel.ortu', verb: 'READ' },
  { key: 'academicGuardianCreate', code: 'academic.guardian.create', module: 'academic', resource: 'admin.personel.ortu', verb: 'INSERT' },
  { key: 'academicGuardianUpdate', code: 'academic.guardian.update', module: 'academic', resource: 'admin.personel.ortu', verb: 'UPDATE' },
  { key: 'academicClearanceView', code: 'academic.clearance.view', module: 'academic', resource: 'admin.pengaturan.clearance', verb: 'READ' },
  { key: 'academicClearanceUpdate', code: 'academic.clearance.update', module: 'academic', resource: 'admin.pengaturan.clearance', verb: 'VALIDATE' },
  { key: 'academicDocumentView', code: 'academic.document.view', module: 'academic', resource: 'admin.dokumen', verb: 'READ' },
  { key: 'academicDocumentPrint', code: 'academic.document.print', module: 'academic', resource: 'admin.dokumen', verb: 'OTHER' },
  { key: 'academicTranscriptView', code: 'academic.transcript.view', module: 'academic', resource: 'academic.transkrip', verb: 'READ' },
  { key: 'academicTranscriptIssue', code: 'academic.transcript.issue', module: 'academic', resource: 'admin.dokumen.transkrip', verb: 'INSERT' },
  { key: 'academicFeederCodeView', code: 'academic.feedercode.view', module: 'academic', resource: 'admin.feeder', verb: 'READ' },
  { key: 'academicFeederCodeUpdate', code: 'academic.feedercode.update', module: 'academic', resource: 'admin.feeder', verb: 'UPDATE' },
  { key: 'academicExportOwn', code: 'academic.export.own', module: 'academic', resource: 'academic.ekspor', verb: 'OTHER' },
  { key: 'academicExportBulk', code: 'academic.export.bulk', module: 'academic', resource: 'admin.ekspor.massal', verb: 'OTHER' },
  { key: 'academicReportView', code: 'academic.report.view', module: 'academic', resource: 'admin.laporan', verb: 'READ' },
  { key: 'academicMonitoringView', code: 'academic.monitoring.view', module: 'academic', resource: 'admin.monitoring', verb: 'READ' },
  { key: 'academicHealthView', code: 'academic.health.view', module: 'academic', resource: 'admin.kesehatan-data', verb: 'READ' },
  { key: 'academicHealthRun', code: 'academic.health.run', module: 'academic', resource: 'admin.kesehatan-data', verb: 'INSERT' },
  { key: 'academicDenialReasonView', code: 'academic.denialreason.view', module: 'academic', resource: 'admin.diagnostik', verb: 'READ' },
  { key: 'academicImpactView', code: 'academic.impact.view', module: 'academic', resource: 'admin.impact-hapus', verb: 'READ' },

  // ── teaching ───────────────────────────────────────────────────────────────
  { key: 'teachingClassView', code: 'teaching.class.view', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'READ' },
  { key: 'teachingClassCreate', code: 'teaching.class.create', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'INSERT' },
  { key: 'teachingClassUpdate', code: 'teaching.class.update', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'UPDATE' },
  { key: 'teachingClassDelete', code: 'teaching.class.delete', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'DELETE' },
  { key: 'teachingAssignmentView', code: 'teaching.assignment.view', module: 'teaching', resource: 'admin.penyelenggaraan.pengampu', verb: 'READ' },
  { key: 'teachingAssignmentCreate', code: 'teaching.assignment.create', module: 'teaching', resource: 'admin.penyelenggaraan.pengampu', verb: 'INSERT' },
  { key: 'teachingAssignmentUpdate', code: 'teaching.assignment.update', module: 'teaching', resource: 'admin.penyelenggaraan.pengampu', verb: 'UPDATE' },
  { key: 'teachingAssignmentDelete', code: 'teaching.assignment.delete', module: 'teaching', resource: 'admin.penyelenggaraan.pengampu', verb: 'DELETE' },
  { key: 'teachingScheduleView', code: 'teaching.schedule.view', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'READ' },
  { key: 'teachingScheduleCreate', code: 'teaching.schedule.create', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'INSERT' },
  { key: 'teachingScheduleUpdate', code: 'teaching.schedule.update', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'UPDATE' },
  { key: 'teachingScheduleDelete', code: 'teaching.schedule.delete', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'DELETE' },
  { key: 'teachingSessionView', code: 'teaching.session.view', module: 'teaching', resource: 'akademik.jadwal', verb: 'READ' },
  { key: 'teachingSessionGenerate', code: 'teaching.session.generate', module: 'teaching', resource: 'admin.penyelenggaraan.pertemuan', verb: 'INSERT' },
  { key: 'teachingSessionUpdate', code: 'teaching.session.update', module: 'teaching', resource: 'admin.penyelenggaraan.pertemuan', verb: 'UPDATE' },
  { key: 'teachingRosterView', code: 'teaching.roster.view', module: 'teaching', resource: 'dosen.kelas', verb: 'READ' },
  { key: 'teachingWorkloadView', code: 'teaching.workload.view', module: 'teaching', resource: 'admin.penyelenggaraan.pengampu', verb: 'READ' },
  { key: 'teachingWaitlistView', code: 'teaching.waitlist.view', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'READ' },
  { key: 'teachingWaitlistManage', code: 'teaching.waitlist.manage', module: 'teaching', resource: 'admin.penyelenggaraan.kelas', verb: 'UPDATE' },
  { key: 'teachingVirtualRoomView', code: 'teaching.virtualroom.view', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'READ' },
  { key: 'teachingVirtualRoomCreate', code: 'teaching.virtualroom.create', module: 'teaching', resource: 'admin.penyelenggaraan.jadwal', verb: 'INSERT' },
  { key: 'teachingRoomUtilizationView', code: 'teaching.roomutilization.view', module: 'teaching', resource: 'admin.monitoring', verb: 'READ' },

  // ── enrollment ─────────────────────────────────────────────────────────────
  { key: 'enrollmentKrsView', code: 'enrollment.krs.view', module: 'enrollment', resource: 'akademik.krs', verb: 'READ' },
  { key: 'enrollmentKrsSubmit', code: 'enrollment.krs.submit', module: 'enrollment', resource: 'akademik.krs', verb: 'INSERT' },
  { key: 'enrollmentKrsApprove', code: 'enrollment.krs.approve', module: 'enrollment', resource: 'dpa.approval', verb: 'VALIDATE' },
  { key: 'enrollmentKrsReject', code: 'enrollment.krs.reject', module: 'enrollment', resource: 'dpa.approval', verb: 'VALIDATE' },
  { key: 'enrollmentKrsBatchApprove', code: 'enrollment.krs.batchapprove', module: 'enrollment', resource: 'dpa.approval', verb: 'VALIDATE' },
  { key: 'enrollmentKrsWithdraw', code: 'enrollment.krs.withdraw', module: 'enrollment', resource: 'akademik.krs', verb: 'UPDATE' },
  { key: 'enrollmentKrsEditRequest', code: 'enrollment.krsedit.request', module: 'enrollment', resource: 'admin.krs.sunting', verb: 'INSERT' },
  { key: 'enrollmentKrsEditApprove', code: 'enrollment.krsedit.approve', module: 'enrollment', resource: 'admin.krs.sunting', verb: 'VALIDATE' },
  { key: 'enrollmentKrsRecommend', code: 'enrollment.krs.recommend', module: 'enrollment', resource: 'dpa.approval', verb: 'UPDATE' },
  { key: 'enrollmentWaitlistJoin', code: 'enrollment.waitlist.join', module: 'enrollment', resource: 'akademik.krs', verb: 'INSERT' },
  { key: 'enrollmentWaitlistLeave', code: 'enrollment.waitlist.leave', module: 'enrollment', resource: 'akademik.krs', verb: 'DELETE' },
  { key: 'enrollmentEffectiveView', code: 'enrollment.effective.view', module: 'enrollment', resource: 'akademik.krs', verb: 'READ' },
  { key: 'enrollmentSchemeView', code: 'enrollment.scheme.view', module: 'enrollment', resource: 'admin.pengaturan.sistem-kuliah', verb: 'READ' },
  { key: 'enrollmentSchemeManage', code: 'enrollment.scheme.manage', module: 'enrollment', resource: 'admin.pengaturan.sistem-kuliah', verb: 'UPDATE' },
  { key: 'enrollmentPackView', code: 'enrollment.pack.view', module: 'enrollment', resource: 'admin.pengaturan.pemaketan', verb: 'READ' },
  { key: 'enrollmentPackApply', code: 'enrollment.pack.apply', module: 'enrollment', resource: 'admin.pengaturan.pemaketan', verb: 'UPDATE' },

  // ── attendance ─────────────────────────────────────────────────────────────
  { key: 'attendanceQrGenerate', code: 'attendance.qr.generate', module: 'attendance', resource: 'dosen.presensi', verb: 'INSERT' },
  { key: 'attendanceQrScan', code: 'attendance.qr.scan', module: 'attendance', resource: 'akademik.presensi', verb: 'UPDATE' },
  { key: 'attendanceRecordView', code: 'attendance.record.view', module: 'attendance', resource: 'dosen.presensi', verb: 'READ' },
  { key: 'attendanceRecordCreate', code: 'attendance.record.create', module: 'attendance', resource: 'dosen.presensi', verb: 'INSERT' },
  { key: 'attendanceRecordUpdate', code: 'attendance.record.update', module: 'attendance', resource: 'dosen.presensi', verb: 'UPDATE' },
  { key: 'attendanceCallView', code: 'attendance.call.view', module: 'attendance', resource: 'dosen.presensi', verb: 'READ' },
  { key: 'attendanceCallWrite', code: 'attendance.call.write', module: 'attendance', resource: 'dosen.presensi', verb: 'INSERT' },
  { key: 'attendanceSummaryView', code: 'attendance.summary.view', module: 'attendance', resource: 'akademik.presensi', verb: 'READ' },

  // ── assessment ─────────────────────────────────────────────────────────────
  { key: 'assessmentCompositionView', code: 'assessment.composition.view', module: 'assessment', resource: 'admin.master.komposisi-nilai', verb: 'READ' },
  { key: 'assessmentCompositionCreate', code: 'assessment.composition.create', module: 'assessment', resource: 'admin.master.komposisi-nilai', verb: 'INSERT' },
  { key: 'assessmentCompositionUpdate', code: 'assessment.composition.update', module: 'assessment', resource: 'admin.master.komposisi-nilai', verb: 'UPDATE' },
  { key: 'assessmentScaleView', code: 'assessment.scale.view', module: 'assessment', resource: 'admin.master.skala-nilai', verb: 'READ' },
  { key: 'assessmentScaleManage', code: 'assessment.scale.manage', module: 'assessment', resource: 'admin.master.skala-nilai', verb: 'UPDATE' },
  { key: 'assessmentGradeView', code: 'assessment.grade.view', module: 'assessment', resource: 'akademik.khs', verb: 'READ' },
  { key: 'gradingValueWrite', code: 'grading.value.write', module: 'assessment', resource: 'dosen.nilai', verb: 'UPDATE' },
  { key: 'assessmentGradePublish', code: 'assessment.grade.publish', module: 'assessment', resource: 'dosen.nilai', verb: 'UPDATE' },
  { key: 'assessmentGradeLock', code: 'assessment.grade.lock', module: 'assessment', resource: 'dosen.nilai', verb: 'UPDATE' },
  { key: 'assessmentGradeLockBulk', code: 'assessment.grade.lockbulk', module: 'assessment', resource: 'dosen.nilai', verb: 'UPDATE' },
  { key: 'gradingUnlock', code: 'grading.unlock', module: 'assessment', resource: 'kaprodi.koreksi-nilai', verb: 'UPDATE' },
  { key: 'assessmentCorrectionRequest', code: 'assessment.correction.request', module: 'assessment', resource: 'dosen.nilai', verb: 'INSERT' },
  { key: 'assessmentCorrectionApprove', code: 'assessment.correction.approve', module: 'assessment', resource: 'kaprodi.koreksi-nilai', verb: 'VALIDATE' },
  { key: 'assessmentRecompute', code: 'assessment.recompute', module: 'assessment', resource: 'admin.monitoring', verb: 'OTHER' },
  { key: 'assessmentExamCardView', code: 'assessment.examcard.view', module: 'assessment', resource: 'akademik.kartu-ujian', verb: 'READ' },
  { key: 'assessmentExamCardIssue', code: 'assessment.examcard.issue', module: 'assessment', resource: 'admin.dokumen.kartu-ujian', verb: 'INSERT' },
  { key: 'assessmentYudisiumEligibilityView', code: 'assessment.yudisium.eligibility.view', module: 'assessment', resource: 'admin.yudisium', verb: 'READ' },
  { key: 'assessmentExportBulk', code: 'assessment.export.bulk', module: 'assessment', resource: 'admin.ekspor.massal', verb: 'OTHER' },

  // ── finance ────────────────────────────────────────────────────────────────
  { key: 'financeTariffView', code: 'finance.tariff.view', module: 'finance', resource: 'admin.keuangan.tarif', verb: 'READ' },
  { key: 'financeTariffCreate', code: 'finance.tariff.create', module: 'finance', resource: 'admin.keuangan.tarif', verb: 'INSERT' },
  { key: 'financeTariffUpdate', code: 'finance.tariff.update', module: 'finance', resource: 'admin.keuangan.tarif', verb: 'UPDATE' },
  { key: 'financeInvoiceView', code: 'finance.invoice.view', module: 'finance', resource: 'keuangan.tagihan', verb: 'READ' },
  { key: 'financeInvoiceCreate', code: 'finance.invoice.create', module: 'finance', resource: 'admin.keuangan.tagihan', verb: 'INSERT' },
  { key: 'financeInvoiceGenerate', code: 'finance.invoice.generate', module: 'finance', resource: 'admin.keuangan.tagihan', verb: 'INSERT' },
  { key: 'financeInvoiceUpdate', code: 'finance.invoice.update', module: 'finance', resource: 'admin.keuangan.tagihan', verb: 'UPDATE' },
  { key: 'financeInvoiceVoid', code: 'finance.invoice.void', module: 'finance', resource: 'bendahara.persetujuan', verb: 'VALIDATE' },
  { key: 'financeInvoiceVoidRequest', code: 'finance.invoice.voidrequest', module: 'finance', resource: 'admin.keuangan.tagihan', verb: 'INSERT' },
  { key: 'financeInstallmentView', code: 'finance.installment.view', module: 'finance', resource: 'keuangan.tagihan', verb: 'READ' },
  { key: 'financeInstallmentCreate', code: 'finance.installment.create', module: 'finance', resource: 'admin.keuangan.pembayaran', verb: 'INSERT' },
  { key: 'financePaymentView', code: 'finance.payment.view', module: 'finance', resource: 'keuangan.pembayaran', verb: 'READ' },
  { key: 'financePaymentConfirm', code: 'finance.payment.confirm', module: 'finance', resource: 'bendahara.persetujuan', verb: 'VALIDATE' },
  { key: 'financePaymentRecord', code: 'finance.payment.record', module: 'finance', resource: 'admin.keuangan.pembayaran', verb: 'INSERT' },
  { key: 'financeDepositView', code: 'finance.deposit.view', module: 'finance', resource: 'admin.keuangan.pembayaran', verb: 'READ' },
  { key: 'financeDepositManage', code: 'finance.deposit.manage', module: 'finance', resource: 'admin.keuangan.pembayaran', verb: 'UPDATE' },
  { key: 'financeWaiverRequest', code: 'finance.waiver.request', module: 'finance', resource: 'admin.keuangan.keringanan', verb: 'INSERT' },
  { key: 'financeWaiverApprove', code: 'finance.waiver.approve', module: 'finance', resource: 'bendahara.persetujuan', verb: 'VALIDATE' },
  { key: 'financeLedgerView', code: 'finance.ledger.view', module: 'finance', resource: 'admin.keuangan.rekonsiliasi', verb: 'READ' },
  { key: 'financeReconcileRun', code: 'finance.reconcile.run', module: 'finance', resource: 'admin.keuangan.rekonsiliasi', verb: 'UPDATE' },
  { key: 'financeGateView', code: 'finance.gate.view', module: 'finance', resource: 'admin.pengaturan.gerbang', verb: 'READ' },
  { key: 'financeGateOverride', code: 'finance.gate.override', module: 'finance', resource: 'admin.pengaturan.gerbang', verb: 'OTHER' },
  { key: 'financeReportView', code: 'finance.report.view', module: 'finance', resource: 'admin.laporan', verb: 'READ' },

  // ── feeder_pddikti ─────────────────────────────────────────────────────────
  { key: 'feederMappingView', code: 'feeder.mapping.view', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'READ' },
  { key: 'feederMappingManage', code: 'feeder.mapping.manage', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'UPDATE' },
  { key: 'feederValidateRun', code: 'feeder.validate.run', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'UPDATE' },
  { key: 'feederSyncRun', code: 'feeder.sync.run', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'UPDATE' },
  { key: 'feederSyncView', code: 'feeder.sync.view', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'READ' },
  { key: 'feederPeriodSend', code: 'feeder.period.send', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'UPDATE' },
  { key: 'feederCorrectionRequest', code: 'feeder.correction.request', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'INSERT' },
  { key: 'feederCorrectionApprove', code: 'feeder.correction.approve', module: 'feeder_pddikti', resource: 'admin.feeder', verb: 'VALIDATE' },
  { key: 'feederCredentialManage', code: 'feeder.credential.manage', module: 'feeder_pddikti', resource: 'admin.feeder.kredensial', verb: 'UPDATE' },

  // ── audit ──────────────────────────────────────────────────────────────────
  { key: 'auditLogView', code: 'audit.log.view', module: 'audit', resource: 'admin.audit', verb: 'READ' },
  { key: 'auditChainVerify', code: 'audit.chain.verify', module: 'audit', resource: 'admin.audit', verb: 'READ' },
  { key: 'auditExport', code: 'audit.export', module: 'audit', resource: 'admin.audit', verb: 'OTHER' },

  // ── entitlement & platform ─────────────────────────────────────────────────
  { key: 'entitlementModuleView', code: 'entitlement.module.view', module: 'entitlement', resource: 'admin.modul', verb: 'READ' },
  { key: 'entitlementCatalogView', code: 'entitlement.catalog.view', module: 'entitlement', resource: 'admin.modul', verb: 'READ' },
  { key: 'entitlementModuleActivate', code: 'entitlement.module.activate', module: 'entitlement', resource: 'admin.modul', verb: 'UPDATE' },
  { key: 'entitlementModuleDeactivate', code: 'entitlement.module.deactivate', module: 'entitlement', resource: 'admin.modul', verb: 'UPDATE' },
  { key: 'entitlementSeatView', code: 'entitlement.seat.view', module: 'entitlement', resource: 'admin.modul', verb: 'READ' },
  { key: 'entitlementSeatManage', code: 'entitlement.seat.manage', module: 'entitlement', resource: 'admin.modul', verb: 'UPDATE' },
  { key: 'entitlementTrialGrant', code: 'entitlement.trial.grant', module: 'entitlement', resource: 'admin.modul', verb: 'INSERT' },
  { key: 'platformPlanView', code: 'platform.plan.view', module: 'platform', resource: 'platform.paket', verb: 'READ' },
  { key: 'platformPlanManage', code: 'platform.plan.manage', module: 'platform', resource: 'platform.paket', verb: 'UPDATE' },
  { key: 'platformTenantView', code: 'platform.tenant.view', module: 'platform', resource: 'platform.tenant', verb: 'READ' },
  { key: 'platformTenantProvision', code: 'platform.tenant.provision', module: 'platform', resource: 'platform.tenant', verb: 'INSERT' },
  { key: 'platformTenantSuspend', code: 'platform.tenant.suspend', module: 'platform', resource: 'platform.tenant', verb: 'UPDATE' },
  { key: 'platformQuotaManage', code: 'platform.quota.manage', module: 'platform', resource: 'platform.kuota', verb: 'UPDATE' },
  { key: 'platformFlagManage', code: 'platform.flag.manage', module: 'platform', resource: 'platform.kuota', verb: 'UPDATE' },
  { key: 'platformUsageView', code: 'platform.usage.view', module: 'platform', resource: 'platform.utilisasi', verb: 'READ' },
  { key: 'platformBreakglassUse', code: 'platform.breakglass.use', module: 'platform', resource: 'platform.breakglass', verb: 'OTHER' },

  // ── settings & document (menutup FR-ADM-09 / FR-DOC-02, lihat G-10) ────────
  { key: 'settingsMetaView', code: 'settings.meta.view', module: 'settings', resource: 'admin.meta-konfigurasi', verb: 'READ' },
  { key: 'settingsMetaUpdate', code: 'settings.meta.update', module: 'settings', resource: 'admin.meta-konfigurasi', verb: 'UPDATE' },
  { key: 'documentLetterView', code: 'document.letter.view', module: 'document', resource: 'admin.persuratan', verb: 'READ' },
  { key: 'documentLetterCreate', code: 'document.letter.create', module: 'document', resource: 'admin.persuratan', verb: 'INSERT' },
  { key: 'documentNumberingManage', code: 'document.numbering.manage', module: 'document', resource: 'admin.persuratan', verb: 'UPDATE' },
  { key: 'documentTteSign', code: 'document.tte.sign', module: 'document', resource: 'admin.persuratan', verb: 'UPDATE' },

  // ── Master Data Engine (RBAC_MATRIX §4.5 baris 127–136 + 145, pemilik M-02) ──
  { key: 'masterKindView', code: 'master.kind.view', module: 'academic', resource: 'admin.master.kamus', verb: 'READ' },
  { key: 'masterKindManage', code: 'master.kind.manage', module: 'academic', resource: 'admin.master.kamus', verb: 'UPDATE' },
  { key: 'masterItemView', code: 'master.item.view', module: 'academic', resource: 'admin.master.referensi', verb: 'READ' },
  { key: 'masterItemCreate', code: 'master.item.create', module: 'academic', resource: 'admin.master.referensi', verb: 'INSERT' },
  { key: 'masterItemUpdate', code: 'master.item.update', module: 'academic', resource: 'admin.master.referensi', verb: 'UPDATE' },
  { key: 'masterItemDeactivate', code: 'master.item.deactivate', module: 'academic', resource: 'admin.master.referensi', verb: 'DELETE' },
  { key: 'masterItemReorder', code: 'master.item.reorder', module: 'academic', resource: 'admin.master.referensi', verb: 'UPDATE' },
  { key: 'masterItemMerge', code: 'master.item.merge', module: 'academic', resource: 'admin.master.referensi', verb: 'VALIDATE' },
  { key: 'masterImpactView', code: 'master.impact.view', module: 'academic', resource: 'admin.master.dampak', verb: 'READ' },
  { key: 'masterUsageView', code: 'master.usage.view', module: 'academic', resource: 'admin.master.pemakaian', verb: 'READ' },
  // Baris 145 = gerbang BACA klien ke `/master/lookups?group=`; bukan jalur tulis.
  { key: 'masterLookupConsume', code: 'master.lookup.consume', module: 'academic', resource: 'master.lookup', verb: 'READ' },

  // ── Atribut kustom (baris 137–144) ──
  { key: 'settingsCustomattrView', code: 'settings.customattr.view', module: 'settings', resource: 'admin.atribut-kustom', verb: 'READ' },
  { key: 'settingsCustomattrCreate', code: 'settings.customattr.create', module: 'settings', resource: 'admin.atribut-kustom', verb: 'INSERT' },
  { key: 'settingsCustomattrUpdate', code: 'settings.customattr.update', module: 'settings', resource: 'admin.atribut-kustom', verb: 'UPDATE' },
  { key: 'settingsCustomattrActivate', code: 'settings.customattr.activate', module: 'settings', resource: 'admin.atribut-kustom', verb: 'VALIDATE' },
  { key: 'settingsCustomattrRetire', code: 'settings.customattr.retire', module: 'settings', resource: 'admin.atribut-kustom', verb: 'DELETE' },
  { key: 'settingsCustomattrValueView', code: 'settings.customattr.value.view', module: 'settings', resource: 'admin.atribut-nilai', verb: 'READ' },
  { key: 'settingsCustomattrValueUpdate', code: 'settings.customattr.value.update', module: 'settings', resource: 'admin.atribut-nilai', verb: 'UPDATE' },
  { key: 'settingsCustomattrHistoryView', code: 'settings.customattr.history.view', module: 'settings', resource: 'admin.atribut-riwayat', verb: 'READ' },

  // ── Dynamic Parameter Engine (baris 146–157) — kunci dibaca per kelas risiko ──
  { key: 'settingsParamViewTechnical', code: 'settings.param.view.technical', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditTechnical', code: 'settings.param.edit.technical', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },
  { key: 'settingsParamViewOps', code: 'settings.param.view.ops', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditOps', code: 'settings.param.edit.ops', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },
  { key: 'settingsParamViewAcademic', code: 'settings.param.view.academic', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditAcademic', code: 'settings.param.edit.academic', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },
  { key: 'settingsParamViewFinancial', code: 'settings.param.view.financial', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditFinancial', code: 'settings.param.edit.financial', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },
  { key: 'settingsParamViewRegulatory', code: 'settings.param.view.regulatory', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditRegulatory', code: 'settings.param.edit.regulatory', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },
  { key: 'settingsParamViewSecurity', code: 'settings.param.view.security', module: 'settings', resource: 'admin.parameters', verb: 'READ' },
  { key: 'settingsParamEditSecurity', code: 'settings.param.edit.security', module: 'settings', resource: 'admin.parameters', verb: 'UPDATE' },

  // ── Tata kelola nilai parameter (baris 375–379, RBAC_MATRIX §4.5.10) ──
  // Keenamnya TIDAK memberi hak tulis nilai: tulis tetap milik 147/149/151/153/155/157.
  // `approve.*` sengaja terpisah dari `identity.accessrequest.approve` (352) supaya penyetuju
  // perubahan hak tidak otomatis menjadi penyetuju pelonggaran ambang (`G-19`).
  { key: 'settingsParamApproveRegulatory', code: 'settings.param.approve.regulatory', module: 'settings', resource: 'admin.parameters', verb: 'VALIDATE' },
  { key: 'settingsParamApproveSecurity', code: 'settings.param.approve.security', module: 'settings', resource: 'admin.parameters', verb: 'VALIDATE' },
  { key: 'settingsParamRegister', code: 'settings.param.register', module: 'settings', resource: 'admin.parameters', verb: 'INSERT' },
  { key: 'settingsParamHistoryView', code: 'settings.param.history.view', module: 'settings', resource: 'admin.parameter-history', verb: 'READ' },
  { key: 'settingsParamPatternManage', code: 'settings.param.pattern.manage', module: 'settings', resource: 'admin.parameter-grant', verb: 'UPDATE' },

  // ── Tata kelola menu dinamis (baris 158–161) ──
  { key: 'platformMenuView', code: 'platform.menu.view', module: 'entitlement', resource: 'admin.menu', verb: 'READ' },
  { key: 'platformMenuManage', code: 'platform.menu.manage', module: 'entitlement', resource: 'admin.menu', verb: 'UPDATE' },
  { key: 'platformMenuGrant', code: 'platform.menu.grant', module: 'entitlement', resource: 'admin.menu', verb: 'INSERT' },
  { key: 'platformMenuRevoke', code: 'platform.menu.revoke', module: 'entitlement', resource: 'admin.menu', verb: 'DELETE' },
] as const satisfies readonly PermissionSpec[];

type PermissionSpecTuple = (typeof SPECS)[number];

export type PermissionKey = PermissionSpecTuple['key'];
export type PermissionCode = PermissionSpecTuple['code'];

/** Peta kunci → kode. Satu-satunya cara sah menyebut kode izin di aplikasi. */
export const PERM = Object.fromEntries(SPECS.map((s) => [s.key, s.code] as const)) as Readonly<
  Record<PermissionKey, PermissionCode>
>;

/** Baris katalog apa adanya — dipakai seeder migrasi & layar matriks izin. */
export const PERMISSION_SPECS: readonly PermissionSpec[] = SPECS;

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = SPECS.map((s) => s.code);

const SPECS_BY_CODE = new Map<string, PermissionSpecTuple>(SPECS.map((s) => [s.code, s] as const));

/** Modul tempat izin berada — dipakai gerbang entitlement & pengelompokan menu. */
export function permissionModule(code: PermissionCode): PermissionModule {
  const spec = SPECS_BY_CODE.get(code);
  if (!spec) throw new RangeError(`Izin tidak terdaftar: ${code}`);
  return spec.module;
}

/** Titik menu/aksi logis (`permissions.resource`) untuk layar matriks izin. */
export function permissionResource(code: PermissionCode): string {
  const spec = SPECS_BY_CODE.get(code);
  if (!spec) throw new RangeError(`Izin tidak terdaftar: ${code}`);
  return spec.resource;
}

/** Aksi kanonik FR-IDT-04 dari kode izin. */
export function permissionVerb(code: PermissionCode): PermissionVerb {
  const spec = SPECS_BY_CODE.get(code);
  if (!spec) throw new RangeError(`Izin tidak terdaftar: ${code}`);
  return spec.verb;
}

export function isKnownPermission(code: string): code is PermissionCode {
  return SPECS_BY_CODE.has(code);
}

// =============================================================================
// 4. Peta grant default (pengisi sementara `role_permissions` sampai ADM-8)
// =============================================================================

const P = PERM;

/** Izin "diri sendiri" yang dimiliki setiap pemegang akun aktif. */
const SELF_SERVICE: readonly PermissionCode[] = [
  P.identityProfileView, P.identityProfileUpdate, P.identityPasswordReset,
  P.identitySessionView, P.identitySessionRevoke, P.identityMfaManage,
  P.academicDenialReasonView,
  // Membaca daftar modul aktif adalah prasyarat merender navigasi untuk peran mana pun;
  // gerbang tulis tetap `entitlement.module.activate` (RBAC_MATRIX §4.2).
  P.entitlementModuleView,
];

const STUDENT_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.enrollmentKrsView, P.enrollmentKrsSubmit, P.enrollmentKrsWithdraw,
  P.enrollmentWaitlistJoin, P.enrollmentWaitlistLeave, P.enrollmentEffectiveView,
  P.teachingClassView, P.teachingSessionView,
  P.attendanceQrScan, P.attendanceSummaryView,
  P.assessmentGradeView, P.academicTranscriptView,
  // `academic.studentstatus.view` TIDAK di-grant ke mahasiswa: baris §6.4 mana pun tidak
  // menyebutnya, status dirinya sudah terbaca lewat proyeksi `/auth/me`, dan "mengapa terkunci"
  // adalah tugas `academic.denialreason.view` (FR-ADM-11) yang diwarisi dari `SELF_SERVICE`.
  // Tanpa pencabutan ini, daun §6.2 1514 "Status Mahasiswa" — layar daftar se-tenant — muncul
  // di navigasi mahasiswa hanya karena ia memegang izin baca yang sama.
  P.academicBlockadeView,
  P.financeInvoiceView, P.financeInstallmentView, P.financePaymentView, P.financeWaiverRequest,
  P.academicExportOwn, P.academicDocumentView, P.academicDocumentPrint,
];

/** Kurikulum→pengajaran yang dimiliki bersama pengampu/koordinator. */
const LECTURER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.teachingRosterView, P.teachingClassView, P.teachingSessionView, P.teachingSessionUpdate,
  P.teachingWorkloadView, P.teachingScheduleView, P.teachingVirtualRoomView,
  P.attendanceQrGenerate, P.attendanceRecordView, P.attendanceRecordCreate,
  P.attendanceRecordUpdate, P.attendanceCallView, P.attendanceCallWrite, P.attendanceSummaryView,
  P.assessmentCompositionView, P.assessmentScaleView, P.assessmentGradeView,
  P.gradingValueWrite, P.assessmentGradePublish, P.assessmentGradeLock,
  P.assessmentCorrectionRequest, P.assessmentExamCardView,
  P.academicCourseView, P.academicCurriculumView, P.academicGuardianView,
];

/**
 * Wali mahasiswa. `SELF_SERVICE` dipasang penuh karena §4.5 baris 329–334 menuliskan
 * "Semua peran (`SELF`)" untuk profil, sesi, dan MFA — tanpanya peran ini kehilangan
 * `dashboard` dan `more.settings` di pohon menu padahal itu hak baca dirinya sendiri.
 */
const ADVISER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.enrollmentKrsView, P.enrollmentKrsApprove, P.enrollmentKrsReject,
  P.enrollmentKrsBatchApprove, P.enrollmentKrsRecommend,
  P.academicStudentView, P.academicStudentStatusView, P.academicTranscriptView,
  P.assessmentGradeView,
];

const HEAD_OF_PROGRAM_GRANTS: readonly PermissionCode[] = [
  ...LECTURER_GRANTS,
  P.academicCurriculumCreate, P.academicCurriculumUpdate, P.academicCurriculumPublish,
  P.academicCourseCreate, P.academicCourseUpdate, P.academicCourseDelete,
  P.academicPrerequisiteView, P.academicPrerequisiteCreate, P.academicPrerequisiteDelete,
  P.academicEquivalencyView, P.academicEquivalencyManage,
  P.academicProgramView, P.academicRuleView, P.academicRuleUpdate,
  P.assessmentScaleManage, P.assessmentCompositionCreate, P.assessmentCompositionUpdate,
  P.gradingUnlock, P.assessmentCorrectionApprove, P.assessmentRecompute,
  P.assessmentYudisiumEligibilityView,
  P.teachingClassCreate, P.teachingClassUpdate, P.teachingClassDelete,
  P.teachingAssignmentCreate, P.teachingAssignmentUpdate, P.teachingAssignmentDelete,
  P.teachingScheduleCreate, P.teachingScheduleUpdate, P.teachingScheduleDelete,
  P.teachingSessionGenerate, P.teachingWaitlistView, P.teachingWaitlistManage,
  P.teachingVirtualRoomCreate,
  P.enrollmentKrsView, P.enrollmentKrsApprove, P.enrollmentKrsReject,
  P.enrollmentKrsBatchApprove, P.enrollmentKrsEditApprove,
  P.enrollmentPackView, P.enrollmentPackApply,
  P.academicExportBulk, P.academicHealthView, P.academicImpactView,
];

const ADMIN_ACADEMIC_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.academicOrganizationView, P.academicOrganizationCreate, P.academicOrganizationUpdate,
  P.academicOrganizationDelete, P.academicPeriodView, P.academicCalendarView,
  P.academicCalendarCreate, P.academicCalendarUpdate, P.academicCalendarDelete,
  P.academicProgramView, P.academicProgramCreate, P.academicProgramUpdate,
  P.academicCurriculumView, P.academicCourseView, P.academicCourseCreate,
  P.academicCourseUpdate, P.academicCourseDelete,
  P.academicPrerequisiteView, P.academicPrerequisiteCreate, P.academicPrerequisiteDelete,
  P.academicEquivalencyView, P.academicEquivalencyManage,
  P.academicReferenceView, P.academicReferenceManage,
  P.academicRoomView, P.academicRoomCreate, P.academicRoomUpdate, P.academicRoomDelete,
  P.academicRuleView, P.academicRuleCreate, P.academicRuleUpdate,
  P.academicGateView, P.academicBlockadeView, P.academicBlockadeCreate, P.academicBlockadeRelease,
  P.academicClearanceView, P.academicClearanceUpdate,
  P.academicStudentView, P.academicStudentCreate, P.academicStudentUpdate, P.academicStudentArchive,
  P.academicStudentStatusView, P.studentStatusChange,
  P.academicTransferRequest, P.academicTransferApprove,
  P.academicLecturerView, P.academicLecturerCreate, P.academicLecturerUpdate,
  P.academicGuardianView, P.academicGuardianCreate, P.academicGuardianUpdate,
  P.academicDocumentView, P.academicDocumentPrint, P.academicTranscriptView, P.academicTranscriptIssue,
  P.academicFeederCodeView, P.academicFeederCodeUpdate,
  P.academicExportBulk, P.academicReportView, P.academicMonitoringView,
  P.academicHealthView, P.academicHealthRun, P.academicImpactView,
  P.teachingClassView, P.teachingClassCreate, P.teachingClassUpdate, P.teachingClassDelete,
  P.teachingAssignmentView, P.teachingAssignmentCreate, P.teachingAssignmentUpdate,
  P.teachingScheduleView, P.teachingScheduleCreate, P.teachingScheduleUpdate,
  P.teachingSessionView, P.teachingSessionGenerate, P.teachingSessionUpdate,
  P.teachingWorkloadView, P.teachingWaitlistView, P.teachingWaitlistManage,
  P.teachingRoomUtilizationView,
  P.enrollmentKrsView, P.enrollmentKrsEditRequest, P.enrollmentKrsEditApprove,
  P.enrollmentSchemeView, P.enrollmentPackView, P.enrollmentPackApply,
  P.attendanceRecordView, P.attendanceRecordUpdate, P.attendanceSummaryView,
  P.assessmentGradeView, P.assessmentExportBulk, P.assessmentRecompute,
];

const ADMIN_FINANCE_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.financeTariffView, P.financeTariffCreate, P.financeTariffUpdate,
  P.financeInvoiceView, P.financeInvoiceCreate, P.financeInvoiceGenerate, P.financeInvoiceUpdate,
  P.financeInvoiceVoidRequest, P.financeInstallmentView, P.financeInstallmentCreate,
  P.financePaymentView, P.financeDepositView,
  P.financeWaiverRequest, P.financeLedgerView, P.financeReportView,
  P.financeGateView, P.financeGateOverride,
  P.academicStudentView, P.academicStudentStatusView, P.academicFeederCodeView,
  P.academicGateView, P.academicBlockadeView, P.academicBlockadeCreate,
];

const TREASURER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.financeTariffView, P.financeInvoiceView, P.financeInstallmentView,
  P.financePaymentView, P.financePaymentConfirm, P.financePaymentRecord,
  P.financeDepositView, P.financeDepositManage,
  P.financeInvoiceVoid, P.financeWaiverApprove,
  P.financeLedgerView, P.financeReconcileRun, P.financeReportView, P.financeGateView,
];

const FEEDER_OPERATOR_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.feederMappingView, P.feederMappingManage, P.feederValidateRun,
  P.feederSyncRun, P.feederSyncView, P.feederPeriodSend,
  P.feederCorrectionRequest, P.feederCredentialManage,
  P.academicFeederCodeView, P.academicFeederCodeUpdate,
  P.academicStudentView, P.academicLecturerView, P.academicProgramView,
  P.academicCalendarView, P.academicReportView, P.academicExportBulk,
];

/**
 * Pimpinan (`LEADER`). `§5` menandai enrollment/attendance/assessment/teaching sebagai **A**
 * untuk peran ini — "baca agregat/anonim (tidak per-record)" (`§1.2` legenda). Grant lama
 * membawa lima kode baca per-record, dan karena visibilitas menu adalah proyeksi hak, kode
 * itu memunculkan daun `Akademik` di navigasi pimpinan yang tidak satu pun baris `§6.2`
 * tulis untuknya (baris 1539–1543 = dashboard eksekutif, keputusan strategis, SK yudisium,
 * mutu, IKU). Yang dicabut di sini hanya lima kode baca per-record itu; agregat
 * (`academic.report.view`, `finance.report.view`), tagihan (`finance.invoice.view`, §5 = B),
 * jejak audit tenant sendiri, dan keluarga dokumen/TTE tetap utuh.
 */
const LEADER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.academicReportView, P.financeReportView, P.feederSyncView,
  P.academicOrganizationView, P.academicPeriodView, P.academicProgramView,
  P.assessmentYudisiumEligibilityView,
  P.financeInvoiceView, P.financeWaiverApprove, P.financeGateView,
  P.academicDocumentView, P.academicDocumentPrint, P.documentLetterView, P.documentTteSign,
  P.entitlementModuleView, P.enrollmentSchemeView,
  P.academicExportBulk, P.auditLogView,
];

const STAFF_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.academicDocumentView, P.academicDocumentPrint, P.documentLetterView, P.documentLetterCreate,
  P.enrollmentKrsView, P.enrollmentKrsEditRequest,
  P.attendanceRecordView, P.attendanceRecordUpdate,
  P.academicStudentView, P.academicGuardianView,
];

const ALUMNI_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.academicTranscriptView, P.academicDocumentView, P.academicDocumentPrint,
];

/** Pendaftar pra-NIM: self-service lengkap (§4.5 baris 329–334) + tagihan biaya seleksi. */
const APPLICANT_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.financeInvoiceView, P.financePaymentView,
];

/**
 * Orang tua/wali. Baca data anak (`§5` baris GUARDIAN: enrollment/attendance/assessment/
 * finance = B) plus self-service penuh (`§4.5` baris 329–334 "Semua peran (`SELF`)").
 * Sengaja TIDAK memegang `academic.guardian.*`: hak itu ada pada jalur data induk
 * (`ADMIN_ACADEMIC`, `§6.2` baris 1525), bukan pada peran subjek data.
 */
const GUARDIAN_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.enrollmentKrsView, P.teachingSessionView, P.attendanceSummaryView,
  P.assessmentGradeView, P.academicTranscriptView, P.financeInvoiceView, P.financePaymentView,
];

const QUALITY_OFFICER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.academicProgramView, P.academicCurriculumView, P.academicRuleView,
  P.assessmentGradeView, P.assessmentYudisiumEligibilityView,
  P.teachingClassView, P.attendanceSummaryView,
  P.feederMappingView, P.feederSyncView,
  P.academicReportView, P.academicExportBulk,
];

/**
 * DPO / Officer Kepatuhan (`§9.5` vonis: role terpisah, "tidak boleh punya hak tulis").
 *
 * `identity.accessrequest.view/.approve` DIHAPUS siklus ini. Keduanya punya pemegang
 * tertulis di `§4.5` baris 351–352 (`TENANT_ADMIN`; pemohon hanya atas miliknya sendiri),
 * dan `§6.1` baris peran ini menyebut pencabutannya sebagai penutup jalur eskalasi `G-31`:
 * yang menyiapkan bukti audit tidak boleh menjadi bagian dari antrean yang mengubah hak.
 * Yang tetap terbaca adalah keluarga yang memang menyebut perannya: `identity.role.view`
 * dan `identity.assignment.view` (baris 348).
 */
const COMPLIANCE_OFFICER_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.auditLogView, P.auditChainVerify, P.auditExport,
  P.identityAssignmentView, P.identityRoleView, P.identityPermissionView,
  P.academicReportView, P.financeReportView, P.feederSyncView,
  P.academicRuleView, P.academicPeriodView, P.academicBlockadeView, P.academicClearanceView,
];

/**
 * R-2 — target kewenangan, bukan warisan.
 *
 * SEBELUMNYA peran ini menulis `...ADMIN_ACADEMIC_GRANTS`, sehingga ia ikut memegang
 * KRS, nilai, presensi, jadwal, data induk mahasiswa/dosen, ruang, dan transkrip. `AGENTS §3.8`
 * dan `RBAC_MATRIX §2` baris 78 menyatakan sebaliknya: "NIM/SKS/presensi memerlukan pemilik
 * domain, KRS/nilai/pembayaran tidak diwariskan", dan `§6.8` baris 1790 menyebut grant lama
 * itu sebagai gap migrasi yang harus ditutup — bukan sebagai hak yang sudah sah.
 *
 * Daftar di bawah adalah union dari baris §6.2 milik peran ini (1509–1524) + keluarga yang
 * §6.8 tunjuk sebagai target R-2 (1798 katalog/on-off, 1800 statistik login, 1804 directory/
 * RBAC/audit, 1805 binding Feeder) + §4.5.3 baris 318 (menutup grant impersonation tenant
 * sendiri; memberi = 317 milik R-1). Tidak ada satu pun kode di luar sitasi itu.
 * Inventaris pencabutan tercetak di `PROGRESS_REPORT §5.85` dan dimigrasikan
 * `0093_rbac_revoke_it_business_grants.sql`.
 */
const TENANT_ADMIN_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  // §6.2 1509 + §6.8 1804 — directory, RBAC, dan antrean permintaan hak
  P.identityUserView, P.identityUserCreate, P.identityUserUpdate, P.identityUserDeactivate,
  P.identityMembershipView, P.identityMembershipCreate, P.identityMembershipUpdate,
  P.identityRoleView, P.identityRoleCreate, P.identityRoleUpdate, P.identityRoleDelete,
  P.identityPermissionView, P.identityAssignmentView, P.identityAssignmentGrant, P.identityAssignmentRevoke,
  P.identityAccessRequestView, P.identityAccessRequestApprove,
  P.identityImpersonationRevoke, P.identityLoginStatsView,
  // §6.2 1511–1512 — konfigurasi institusi, periode, kalender, aturan, gerbang
  P.academicOrganizationView, P.academicOrganizationCreate, P.academicOrganizationUpdate,
  P.academicOrganizationDelete, P.academicProgramView, P.academicProgramCreate, P.academicProgramUpdate,
  P.academicPeriodView, P.academicPeriodCreate, P.academicPeriodUpdate, P.academicPeriodClose,
  P.academicPeriodReopenRequest, P.academicCalendarView, P.academicCalendarCreate,
  P.academicCalendarUpdate, P.academicCalendarDelete,
  P.academicRuleView, P.academicRuleCreate, P.academicRuleUpdate, P.academicGateConfigure,
  // §6.2 1514 — status mahasiswa: R-2 menyiapkan jalur dan riwayatnya, pemilik domain yang memutus
  P.academicStudentStatusView, P.studentStatusChange,
  // §6.2 1513 + §6.8 1798 — katalog & on-off di bawah lisensi; seats/expiry BUKAN hak tenant
  P.entitlementModuleView, P.entitlementCatalogView,
  P.entitlementModuleActivate, P.entitlementModuleDeactivate,
  // §6.2 1515 + §12.2 daun 4.5 — audit tenant sendiri: baca dan ekspor bukti
  P.auditLogView, P.auditExport,
  // §6.8 1805 + §12.2 daun 5.1/6.4 — binding teknis Feeder; kirim periode & koreksi bukan R-2
  P.feederCredentialManage, P.feederSyncView,
  // §6.2 1522 — meta konfigurasi form/laporan/tanda tangan per tenant
  P.settingsMetaView, P.settingsMetaUpdate,
];

const PLATFORM_OPERATOR_GRANTS: readonly PermissionCode[] = [
  ...SELF_SERVICE,
  P.platformPlanView, P.platformPlanManage,
  P.platformTenantView, P.platformTenantProvision, P.platformTenantSuspend,
  P.platformQuotaManage, P.platformFlagManage, P.platformUsageView, P.platformBreakglassUse,
  P.entitlementModuleView, P.entitlementCatalogView, P.entitlementModuleActivate,
  P.entitlementModuleDeactivate, P.entitlementSeatManage, P.entitlementTrialGrant,
  P.identityImpersonationGrant, P.identityImpersonationRevoke,
  P.auditLogView, P.auditChainVerify, P.auditExport,
  P.academicHealthRun, P.academicHealthView, P.academicReportView,
];

/**
 * Peta peran → izin untuk seed `role_permissions` dan resolusi runtime selama tabel
 * RBAC belum aktif. Sumber: RBAC_MATRIX §5 & §6.
 *
 * `BASE_ROLE_GRANTS` adalah promosi gelombang pertama (baris 1–126 + 162–291 yang
 * sudah lahir); `MDE_SPE_GRANTS` menambahkan hasil promosi baris 127–161 yang
 * dituntut gerbang `R-2` (`ROADMAP §2.5.14`). Keduanya digabung di sini supaya
 * satu-satunya permukaan publik tetap `SYSTEM_ROLE_GRANTS`.
 */
const BASE_ROLE_GRANTS: Readonly<Record<RoleCode, readonly PermissionCode[]>> = {
  PLATFORM_OPERATOR: PLATFORM_OPERATOR_GRANTS,
  TENANT_ADMIN: TENANT_ADMIN_GRANTS,
  ADMIN_ACADEMIC: ADMIN_ACADEMIC_GRANTS,
  HEAD_OF_PROGRAM: HEAD_OF_PROGRAM_GRANTS,
  LECTURER: LECTURER_GRANTS,
  ADVISER: ADVISER_GRANTS,
  FEEDER_OPERATOR: FEEDER_OPERATOR_GRANTS,
  ADMIN_FINANCE: ADMIN_FINANCE_GRANTS,
  TREASURER: TREASURER_GRANTS,
  LEADER: LEADER_GRANTS,
  STAFF: STAFF_GRANTS,
  STUDENT: STUDENT_GRANTS,
  APPLICANT: APPLICANT_GRANTS,
  GUARDIAN: GUARDIAN_GRANTS,
  ALUMNI: ALUMNI_GRANTS,
  QUALITY_OFFICER: QUALITY_OFFICER_GRANTS,
  COMPLIANCE_OFFICER: COMPLIANCE_OFFICER_GRANTS,
};

/**
 * Promosi RBAC_MATRIX §4.5 baris 127–161 (Master Data Engine + atribut kustom +
 * Dynamic Parameter Engine + tata kelola menu) — prasyarat `R-2` di `ROADMAP §2.5.14`
 * dan langkah 3 sekuensi `AGENTS §3.11`.
 *
 * Yang TIDAK dilakukan di sini, dan itu disengaja:
 *  - Peran 🟡/ yang belum dibekukan (`PMB_OPERATOR`, `DEKAN`) tidak diberi grant;
 *    ia belum ada di `ROLE_CODES`, sehingga generator akan menolak barisnya.
 *  - Baris 142/143 (`settings.customattr.value.*`) di dokumen digantungkan pada kolom
 *    `role_view`/`role_edit` definisi atribut. Kode di bawah hanya MEMBUKA pintunya
 *    (L3); penyaringan per-definisi tetap kewajiban L4/L5 di service, bukan sesuatu
 *    yang boleh dipalsukan sebagai grant statis.
 *  - Baris 151/153/155/157 (`edit.academic/financial/regulatory/security`) sengaja
 *    hanya untuk `TENANT_ADMIN` — menolak ADMIN_ACADEMIC/ADMIN_FINANCE/TREASURER
 *    adalah isi norma, bukan kelalaian (SoD BAAK↔BAUK, BR-K2).
 *  - Baris 158 (`platform.menu.view`) untuk semua peran: yang dilihat adalah pohon
 *    mereka sendiri, dan pohon itu disaring `menu_permissions` di query.
 */
const MDE_SPE_GRANTS: Readonly<Partial<Record<RoleCode, readonly PermissionCode[]>>> = {
  TENANT_ADMIN: [
    P.masterKindView, P.masterKindManage, P.masterItemView, P.masterItemCreate, P.masterItemUpdate,
    P.masterItemDeactivate, P.masterItemReorder, P.masterItemMerge, P.masterImpactView, P.masterLookupConsume,
    P.settingsCustomattrView, P.settingsCustomattrCreate, P.settingsCustomattrUpdate,
    P.settingsCustomattrActivate, P.settingsCustomattrRetire, P.settingsCustomattrValueView,
    P.settingsCustomattrValueUpdate, P.settingsCustomattrHistoryView,
    P.settingsParamViewTechnical, P.settingsParamEditTechnical,
    P.settingsParamViewOps, P.settingsParamEditOps,
    P.settingsParamViewAcademic, P.settingsParamEditAcademic,
    P.settingsParamViewFinancial, P.settingsParamEditFinancial,
    P.settingsParamViewRegulatory, P.settingsParamEditRegulatory,
    P.settingsParamViewSecurity, P.settingsParamEditSecurity,
    P.settingsParamApproveRegulatory, P.settingsParamApproveSecurity,
    P.settingsParamRegister, P.settingsParamHistoryView, P.settingsParamPatternManage,
    P.platformMenuView, P.platformMenuManage, P.platformMenuGrant, P.platformMenuRevoke,
  ],
  ADMIN_ACADEMIC: [
    P.masterKindView, P.masterKindManage, P.masterItemView, P.masterItemCreate, P.masterItemUpdate,
    P.masterItemDeactivate, P.masterItemReorder, P.masterItemMerge, P.masterImpactView,
    P.masterUsageView, P.masterLookupConsume,
    P.settingsCustomattrView, P.settingsCustomattrValueView, P.settingsCustomattrValueUpdate,
    P.settingsCustomattrHistoryView,
    P.settingsParamViewOps, P.settingsParamEditOps, P.settingsParamViewAcademic,
    P.settingsParamViewRegulatory, P.platformMenuView,
  ],
  HEAD_OF_PROGRAM: [
    P.masterKindView, P.masterItemView, P.masterItemCreate, P.masterItemUpdate, P.masterItemReorder,
    P.masterImpactView, P.masterUsageView, P.masterLookupConsume,
    P.settingsParamViewAcademic, P.platformMenuView,
  ],
  ADMIN_FINANCE: [
    P.masterKindView, P.masterItemView, P.masterLookupConsume, P.settingsCustomattrView,
    P.settingsCustomattrValueView, P.settingsCustomattrValueUpdate,
    P.settingsParamViewOps, P.settingsParamEditOps, P.settingsParamViewFinancial, P.platformMenuView,
  ],
  TREASURER: [P.settingsParamViewFinancial, P.masterLookupConsume],
  LEADER: [
    P.masterLookupConsume, P.settingsCustomattrActivate,
    P.settingsParamViewOps, P.settingsParamViewFinancial, P.settingsParamViewRegulatory,
    P.platformMenuView,
  ],
  QUALITY_OFFICER: [
    P.masterKindView, P.masterItemView, P.masterUsageView, P.masterLookupConsume,
    P.settingsCustomattrView, P.settingsParamViewAcademic, P.settingsParamViewRegulatory,
    P.platformMenuView,
  ],
  COMPLIANCE_OFFICER: [
    P.masterLookupConsume, P.settingsCustomattrValueView, P.settingsCustomattrHistoryView,
    P.settingsParamViewTechnical, P.settingsParamViewOps, P.settingsParamViewAcademic,
    P.settingsParamViewRegulatory, P.settingsParamViewSecurity, P.platformMenuView,
  ],
  FEEDER_OPERATOR: [
    P.masterLookupConsume, P.settingsParamViewAcademic, P.settingsParamViewRegulatory, P.platformMenuView,
  ],
  STAFF: [P.masterLookupConsume, P.settingsCustomattrValueView, P.settingsCustomattrValueUpdate, P.platformMenuView],
  LECTURER: [P.masterLookupConsume, P.platformMenuView],
  ADVISER: [P.masterLookupConsume, P.platformMenuView],
  STUDENT: [P.masterLookupConsume, P.settingsCustomattrValueView, P.settingsCustomattrValueUpdate, P.platformMenuView],
  APPLICANT: [P.masterLookupConsume, P.platformMenuView],
  GUARDIAN: [P.masterLookupConsume, P.platformMenuView],
  ALUMNI: [P.platformMenuView],
  PLATFORM_OPERATOR: [
    P.masterLookupConsume, P.settingsCustomattrValueView,
    P.settingsParamViewTechnical, P.settingsParamViewSecurity,
    P.platformMenuView, P.platformMenuManage, P.platformMenuGrant, P.platformMenuRevoke,
  ],
};

export const SYSTEM_ROLE_GRANTS: Readonly<Record<RoleCode, readonly PermissionCode[]>> = ROLE_CODES.reduce(
  (acc, role) => {
    acc[role] = [...BASE_ROLE_GRANTS[role], ...(MDE_SPE_GRANTS[role] ?? [])];
    return acc;
  },
  {} as Record<RoleCode, readonly PermissionCode[]>
);

/** Pasangan peran yang tidak boleh dipegang satu orang (SoD — BR-K2). */
export const MUTUALLY_EXCLUSIVE_ROLES: readonly (readonly RoleCode[])[] = [
  ['ADMIN_FINANCE', 'TREASURER'],
];

export function rolesForCarrier(role: string | null | undefined): readonly RoleCode[] {
  if (!role) return [];
  const match = CARRIER_ROLES.find((candidate) => candidate === role);
  return match ? CARRIER_TO_ROLES[match] : [];
}

export function permissionsForRole(role: RoleCode): readonly PermissionCode[] {
  return SYSTEM_ROLE_GRANTS[role];
}

/** Pair yang saling eksklusif — dipakai guard sebelum grant & saat menulis assignment. */
export function violatesSoD(roles: readonly RoleCode[]): readonly RoleCode[] | null {
  for (const pair of MUTUALLY_EXCLUSIVE_ROLES) {
    if (pair.every((role) => roles.includes(role))) return pair;
  }
  return null;
}

// =============================================================================
// 5. Skema kontrak (dipakai endpoint hak akses & validator lintas platform)
// =============================================================================

/**
 * Skema validasi kode izin. Dipakai endpoint hak akses agar string dari klien
 * tidak pernah dipercaya mentah — kode di luar katalog §4 ditolak (AGENTS §3.3).
 */
export const PermissionCodeSchema = z
  .string()
  .refine(isKnownPermission, { message: 'Kode izin tidak ada di katalog RBAC_MATRIX §4' }) as unknown as z.ZodType<PermissionCode>;

/** Penugasan peran ber-scope — bentuk payload `/admin/pengguna/hak-akses`. */
export const RoleAssignmentSchema = z.object({
  userId: z.string().uuid(),
  role: RoleCodeSchema,
  scopeKind: ScopeKindSchema,
  scopeOrgId: z.string().uuid().optional(),
  scopeProgramId: z.string().uuid().optional(),
  scopeClassId: z.string().uuid().optional(),
  scopePeriodId: z.string().uuid().optional(),
  scopeStudentId: z.string().uuid().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable().optional(),
  reason: z.string().min(3).max(500).optional(),
});
export type RoleAssignment = z.infer<typeof RoleAssignmentSchema>;

/** Baris matriks izin `resource × verb` untuk layar hak akses. */
export const AccessMatrixCellSchema = z.object({
  resource: z.string().min(1),
  verb: PermissionVerbSchema,
  permission: PermissionCodeSchema,
});
export type AccessMatrixCell = z.infer<typeof AccessMatrixCellSchema>;

/**
 * Kolom SERVER_ONLY (BLUEPRINT_ROLE_BY_ROLE §0.3, SEC-02): hanya berubah lewat
 * transisi state di server — tidak pernah diterima dari request body. Aturan field
 * ditegakkan pada proyeksi server (skema Zod yang menghilangkan kolom ini), bukan
 * dengan menyembunyikan sel di UI.
 */
export const SERVER_ONLY_FIELDS: Readonly<Record<string, readonly string[]>> = {
  grades: ['status', 'letterCode', 'pointValue'],
  invoices: ['status'],
  payments: ['status'],
  ledger: ['*'],
  enrollments: ['status'],
  students: ['nim', 'status_akademik'],
  mfa_factors: ['secret'],
  pddikti_sync_runs: ['feeder_id_returned'],
};

/** True bila `field` pada `table` berstatus SERVER_ONLY. `'["*"]'` = seluruh kolom tabel. */
export function isServerOnlyField(table: string, field: string): boolean {
  const fields = SERVER_ONLY_FIELDS[table];
  if (!fields) return false;
  return fields.includes('*') || fields.includes(field);
}

/**
 * Katalog peran sistem yang ditanamkan ke SETIAP tenant baru.
 * Sumber cermin: VALUES seed di `packages/database/migrations/0011_rbac_scoped.sql:392-408`
 * (15 peran kampus). `PLATFORM_OPERATOR` ditambahkan terpisah karena ia peran
 * platform dan sengaja TIDAK di-seed `0011` ke tenant kampus.
 * Provisioning membaca daftar ini — bukan baris peran tenant contoh — sebab RLS
 * melarang pembacaan lintas-tenant, sehingga "template dari tenant lain" mustahil sah.
 */
export const SYSTEM_ROLE_SEED: ReadonlyArray<{
  readonly code: RoleCode;
  readonly displayName: string;
  readonly scopeKind: ScopeKind;
}> = [
  { code: 'TENANT_ADMIN', displayName: 'Administrator Kampus', scopeKind: 'TENANT' },
  { code: 'ADMIN_ACADEMIC', displayName: 'Admin Akademik (BAAK)', scopeKind: 'ORG' },
  { code: 'HEAD_OF_PROGRAM', displayName: 'Ketua Program Studi', scopeKind: 'PROGRAM' },
  { code: 'LECTURER', displayName: 'Dosen Pengampu', scopeKind: 'CLASS' },
  { code: 'ADVISER', displayName: 'Dosen Pembimbing Akademik', scopeKind: 'PERIOD' },
  { code: 'ADMIN_FINANCE', displayName: 'Admin Keuangan / UKT', scopeKind: 'TENANT' },
  { code: 'TREASURER', displayName: 'Bendahara (penyetuju void & keringanan)', scopeKind: 'TENANT' },
  { code: 'LEADER', displayName: 'Pimpinan (Rektor/Warek/Dekan)', scopeKind: 'ORG' },
  { code: 'FEEDER_OPERATOR', displayName: 'Operator Feeder PDDIKTI', scopeKind: 'TENANT' },
  { code: 'STAFF', displayName: 'Tenaga Kependidikan', scopeKind: 'ORG' },
  { code: 'QUALITY_OFFICER', displayName: 'Penjaminan Mutu (SPMI/AMI)', scopeKind: 'ORG' },
  { code: 'STUDENT', displayName: 'Mahasiswa', scopeKind: 'SELF' },
  { code: 'APPLICANT', displayName: 'Pendaftar PMB', scopeKind: 'SELF' },
  { code: 'GUARDIAN', displayName: 'Orang Tua/Wali', scopeKind: 'SELF' },
  { code: 'ALUMNI', displayName: 'Alumni', scopeKind: 'SELF' },
  { code: 'PLATFORM_OPERATOR', displayName: 'Operator Platform', scopeKind: 'TENANT' },
];
