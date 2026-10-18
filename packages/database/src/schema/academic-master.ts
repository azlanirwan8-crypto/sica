import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { academicYearTermEnum, periodStatusEnum, courseTypeEnum } from './enums';

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    kind: text('kind').notNull(), // FACULTY | DEPARTMENT | UNIT | LIBRARY | HQ
    name: text('name').notNull(),
    code: text('code'),
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex('uq_orgs_tenant_code').on(table.tenantId, table.code),
    tenantIdx: index('idx_orgs_tenant').on(table.tenantId),
  })
);

export const academicYears = pgTable(
  'academic_years',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // '2025/2026'
  },
  (table) => ({
    tenantLabelUnique: uniqueIndex('uq_academic_years_label').on(table.tenantId, table.label),
  })
);

export const academicPeriods = pgTable(
  'academic_periods',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    academicYearId: uuid('academic_year_id')
      .notNull()
      .references(() => academicYears.id, { onDelete: 'cascade' }),
    term: academicYearTermEnum('term').notNull(), // GANJIL | GENAP | ANTAR
    status: periodStatusEnum('status').notNull().default('DRAFT'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
  },
  (table) => ({
    tenantPeriodUnique: uniqueIndex('uq_academic_periods_term').on(
      table.tenantId,
      table.academicYearId,
      table.term
    ),
    tenantIdx: index('idx_academic_periods_tenant').on(table.tenantId),
  })
);

export const studyPrograms = pgTable(
  'study_programs',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id),
    name: text('name').notNull(),
    code: text('code'),
    pddiktiCode: text('pddikti_code'),
    level: text('level').notNull(), // D1 | D2 | D3 | D4 | S1 | S2 | S3 | PROFESI | SPESIALIS
    minTotalSks: numeric('min_total_sks', { precision: 5, scale: 1 }).notNull(),
    nominalStudySemesters: integer('nominal_study_semesters').notNull(),
    maxStudySemesters: integer('max_study_semesters').notNull(),
    sksCapLowerSemesters: numeric('sks_cap_lower_semesters', { precision: 4, scale: 1 })
      .notNull()
      .default('20.0'),
    sksCapUpperSemesters: numeric('sks_cap_upper_semesters', { precision: 4, scale: 1 })
      .notNull()
      .default('24.0'),
    sksCapBetweenTerm: numeric('sks_cap_between_term', { precision: 4, scale: 1 })
      .notNull()
      .default('9.0'),
    graduationMinIpk: numeric('graduation_min_ipk', { precision: 3, scale: 2 })
      .notNull()
      .default('2.00'),
    accreditationStatus: text('accreditation_status'),
    accreditationExpiresOn: date('accreditation_expires_on'),
    deliveryMode: text('delivery_mode').notNull().default('ONSITE'), // ONSITE | ONLINE | HYBRID
    allowAutoClass: boolean('allow_auto_class').notNull().default(true),
    waitlistThresholdMin: integer('waitlist_threshold_min').notNull().default(15),
    maxParallelClasses: integer('max_parallel_classes').notNull().default(4),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex('uq_study_programs_code').on(table.tenantId, table.code),
    tenantIdx: index('idx_study_programs_tenant').on(table.tenantId),
  })
);

export const gradeScales = pgTable(
  'grade_scales',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    scaleType: text('scale_type').notNull(), // POINT4 | POINT4_WITH_MINUS | PASS_FAIL | NUMERIC_100
    isNationalBaseline: boolean('is_national_baseline').notNull().default(false),
  },
  (table) => ({
    tenantScaleUnique: uniqueIndex('uq_grade_scales_name').on(table.tenantId, table.name),
  })
);

export const gradeScaleBands = pgTable(
  'grade_scale_bands',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    scaleId: uuid('scale_id')
      .notNull()
      .references(() => gradeScales.id, { onDelete: 'cascade' }),
    minScore: numeric('min_score', { precision: 5, scale: 2 }).notNull(),
    letterCode: text('letter_code').notNull(), // A, B+, B, C, D, E
    pointValue: numeric('point_value', { precision: 3, scale: 2 }).notNull(), // 4.00, 3.50, dll.
    isPassing: boolean('is_passing').notNull(),
    isDefaultWhenBlank: boolean('is_default_when_blank').notNull().default(false),
  },
  (table) => ({
    scaleLetterUnique: uniqueIndex('uq_scale_letter').on(table.scaleId, table.letterCode),
    scaleIdx: index('idx_scale_bands_scale').on(table.scaleId),
  })
);

export const curricula = pgTable(
  'curricula',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    programId: uuid('program_id')
      .notNull()
      .references(() => studyPrograms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    effectiveFrom: date('effective_from').notNull(),
    gradeScaleId: uuid('grade_scale_id').references(() => gradeScales.id),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    programVersionUnique: uniqueIndex('uq_curricula_version').on(
      table.tenantId,
      table.programId,
      table.version
    ),
    programIdx: index('idx_curricula_program').on(table.programId),
  })
);

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    curriculumId: uuid('curriculum_id')
      .notNull()
      .references(() => curricula.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sks: numeric('sks', { precision: 4, scale: 1 }).notNull(), // total (otoritatif, kompatibel)
    sksTeori: numeric('sks_teori', { precision: 4, scale: 1 }), // pemecahan ala PDDikti/Sevima
    sksPraktik: numeric('sks_praktik', { precision: 4, scale: 1 }),
    courseType: courseTypeEnum('course_type'),
    semesterIdeal: integer('semester_ideal'),
  },
  (table) => ({
    curriculumCodeUnique: uniqueIndex('uq_courses_curriculum_code').on(
      table.tenantId,
      table.curriculumId,
      table.code
    ),
    curriculumIdx: index('idx_courses_curriculum').on(table.curriculumId),
  })
);

export const rooms = pgTable(
  'rooms',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    building: text('building').notNull(),
    floor: integer('floor').notNull().default(1),
    capacity: integer('capacity').notNull(),
    roomType: text('room_type').notNull(), // CLASSROOM | LAB | AUDITORIUM | STUDIO
    facilities: jsonb('facilities').notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => ({
    tenantCodeUnique: uniqueIndex('uq_rooms_code').on(table.tenantId, table.code),
    buildingIdx: index('idx_rooms_building').on(table.tenantId, table.building, table.isActive),
  })
);
