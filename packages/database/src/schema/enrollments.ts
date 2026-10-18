import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { enrollmentStatusEnum, gradeStatusEnum } from './enums';
import { courses, academicPeriods } from './academic-master';
import { students, classes, classSessions } from './classes';

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => academicPeriods.id),
    status: enrollmentStatusEnum('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'),
    rejectionReason: text('rejection_reason'),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    studentClassUnique: uniqueIndex('uq_enrollments_student_class').on(
      table.tenantId,
      table.studentId,
      table.classId
    ),
    periodStudentIdx: index('idx_enroll_period').on(
      table.tenantId,
      table.periodId,
      table.studentId
    ),
    classStatusIdx: index('idx_enroll_class_slot').on(table.classId, table.status),
  })
);

export const attendances = pgTable(
  'attendances',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    present: boolean('present').notNull(),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionStudentUnique: uniqueIndex('uq_attendances_session_student').on(
      table.sessionId,
      table.studentId
    ),
  })
);

export const gradeComponents = pgTable(
  'grade_components',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id),
    classId: uuid('class_id').references(() => classes.id),
    code: text('code').notNull(), // TUGAS | PRAKTIKUM | UTS | UAS | PROYEK
    name: text('name').notNull(),
    weightPct: numeric('weight_pct', { precision: 5, scale: 2 }).notNull(), // Bobot total wajib 100%
    isMandatory: boolean('is_mandatory').notNull().default(true),
    position: integer('position').notNull().default(1),
  },
  (table) => ({
    classCodeUnique: uniqueIndex('uq_grade_comp_class_code').on(table.classId, table.code),
    courseCodeUnique: uniqueIndex('uq_grade_comp_course_code').on(table.courseId, table.code),
  })
);

export const grades = pgTable(
  'grades',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    periodId: uuid('period_id')
      .notNull()
      .references(() => academicPeriods.id),
    rawScore: numeric('raw_score', { precision: 5, scale: 2 }), // 0 - 100
    letterCode: text('letter_code'), // A, B+, B, C, D, E
    pointValue: numeric('point_value', { precision: 3, scale: 2 }), // 4.00, 3.50, dll.
    status: gradeStatusEnum('status').notNull().default('DRAFT'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: uuid('locked_by'),
    version: integer('version').notNull().default(0),
  },
  (table) => ({
    enrollmentUnique: uniqueIndex('uq_grades_enrollment').on(table.tenantId, table.enrollmentId),
    periodStatusIdx: index('idx_grades_period').on(table.tenantId, table.periodId, table.status),
  })
);

export const gradeCorrections = pgTable(
  'grade_corrections',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => grades.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by').notNull(),
    reason: text('reason').notNull(), // Minimal 15 karakter
    oldLetter: text('old_letter'),
    newLetter: text('new_letter'),
    oldPoint: numeric('old_point', { precision: 3, scale: 2 }),
    newPoint: numeric('new_point', { precision: 3, scale: 2 }),
    status: text('status').notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | APPLIED
  },
  (table) => ({
    gradeIdx: index('idx_grade_corrections_grade').on(table.gradeId),
  })
);
