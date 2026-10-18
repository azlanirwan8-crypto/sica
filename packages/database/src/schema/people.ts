/**
 * Master Data Personel & Pelengkap Biodata Mahasiswa
 * Menutup celah field data Sevima/PDDikti Neo Feeder — lihat docs/DATA_MODEL.md §11.2–11.3.
 *
 * Catatan desain: `users` tetap identitas GLOBAL; `lecturers`/`staff` MENAMBAH atribut
 * feeder per-tenant (NIDN/NUPTK/jabatan fungsional/homebase/rumpun), bukan menggantikan users.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { tenantMemberships } from './auth';
import { studyPrograms, organizations } from './academic-master';
import { students } from './classes';
import {
  sexEnum,
  incomeBandEnum,
  lecturerJobRankEnum,
  employmentTypeEnum,
} from './enums';

export const lecturers = pgTable(
  'lecturers',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').references(() => studyPrograms.id),
    nidn: text('nidn'),
    nuptk: text('nuptk'),
    pddiktiIdDosen: uuid('pddikti_id_dosen'),
    code: text('code'),
    titlePrefix: text('title_prefix'),
    titleSuffix: text('title_suffix'),
    specialization: text('specialization'),
    academicRank: lecturerJobRankEnum('academic_rank').notNull().default('NONE'),
    employmentType: employmentTypeEnum('employment_type')
      .notNull()
      .default('DOSEN_TETAP_YAYASAN'),
    isPrimaryLecturer: boolean('is_primary_lecturer').notNull().default(true),
    homebaseOrgId: uuid('homebase_org_id').references(() => organizations.id),
    scienceCluster: text('science_cluster'),
    lastDegreeCountry: text('last_degree_country'),
    lastDegreeUniversity: text('last_degree_university'),
    lastDegreeYear: integer('last_degree_year'),
    startServiceDate: date('start_service_date'),
    gender: sexEnum('gender'),
    birthPlace: text('birth_place'),
    birthDate: date('birth_date'),
    religion: text('religion'),
    nationality: text('nationality').notNull().default('WNI'),
    disabilityType: text('disability_type'),
    mobilePhone: text('mobile_phone'),
    officialEmail: text('official_email'),
    address: text('address'),
    certifierNumber: text('certifier_number'),
    certificationDate: date('certification_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantMembershipUnique: uniqueIndex('uq_lecturers_membership').on(
      table.tenantId,
      table.membershipId
    ),
    nidnIdx: index('idx_lecturer_nidn').on(table.tenantId, table.nidn),
    homebaseIdx: index('idx_lecturer_homebase').on(table.tenantId, table.homebaseOrgId)
  })
);

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id),
    nip: text('nip'),
    code: text('code'),
    fullName: text('full_name').notNull(),
    positionType: text('position_type').notNull().default('TERTENTU'),
    structuralTitle: text('structural_title'),
    functionalTitle: text('functional_title'),
    employmentType: employmentTypeEnum('employment_type').notNull().default('TENAGA_HONORER'),
    educationLast: text('education_last'),
    startDate: date('start_date'),
    gender: sexEnum('gender'),
    birthDate: date('birth_date'),
    mobilePhone: text('mobile_phone'),
    officialEmail: text('official_email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantMembershipUnique: uniqueIndex('uq_staff_membership').on(table.tenantId, table.membershipId),
    orgIdx: index('idx_staff_org').on(table.tenantId, table.orgId)
  })
);

export const studentAddresses = pgTable(
  'student_addresses',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('DOMICILE'), // DOMICILE | ORIGIN | INVOICE
    address: text('address'),
    postalCode: text('postal_code'),
    provinceCode: text('province_code'),
    regencyCode: text('regency_code'),
    districtCode: text('district_code'),
    villageCode: text('village_code'),
    isPreferred: boolean('is_preferred').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStudentKindUnique: uniqueIndex('uq_student_addr_kind').on(
      table.tenantId,
      table.studentId,
      table.kind
    ),
  })
);

export const studentGuardians = pgTable(
  'student_guardians',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(), // AYAH | IBU | WALI
    fullName: text('full_name').notNull(),
    birthDate: date('birth_date'),
    education: text('education'),
    occupationCode: text('occupation_code'),
    occupationName: text('occupation_name'),
    incomeBand: incomeBandEnum('income_band'),
    incomeRupiah: bigint('income_rupiah', { mode: 'number' }),
    phone: text('phone'),
    email: text('email'),
    isFinancialGuarantor: boolean('is_financial_guarantor').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStudentRelationUnique: uniqueIndex('uq_student_guardian_rel').on(
      table.tenantId,
      table.studentId,
      table.relation
    ),
  })
);

// Re-export untuk kenyamanan tipe; kolom geofencing presensi didefinisikan di ./enrollments.
export type LecturerRow = typeof lecturers.$inferSelect;
export type StaffRow = typeof staff.$inferSelect;
