/**
 * KRS Submit Service — jalur TULIS nyata ke PostgreSQL (bukan mock) lewat
 * `withTenantContext` sehingga Row-Level Security `tenant_id` tetap ditegakkan
 * dan seluruh operasi berjalan dalam SATU transaksi pada Primary (read-your-writes).
 *
 * Menutup stub `Math.random()` pada rute `POST /academic/krs/submit`:
 *  1. Kuota SKS dihitung dari data nyata (status, semester berjalan, IPS periode
 *     sebelumnya, SKS sudah diambil) memakai engine `sks-quota-validator`.
 *  2. Kapasitas kelas dijaga ATOMIK: `pg_advisory_xact_lock(hashtext(classId))`
 *     per kelas + `UPDATE ... WHERE enrolled_count < capacity` (anti row-lock panas,
 *     all-or-nothing). Gagal kursi → rollback total → CLASS_FULL.
 *  3. Bentrok jadwal mahasiswa dideteksi via `schedule-conflict-detector` (nyata).
 *  4. Idempoten: enrollment yang sudah ada dilewati (`onConflictDoNothing`).
 *
 * Rujukan: docs/API_SPEC.md §4, docs/DATA_MODEL.md §11, AGENTS.md §3.7.
 */
import {
  withTenantContext,
  sql,
  eq,
  and,
  inArray,
  students,
  tenantMemberships,
  studyPrograms,
  academicPeriods,
  academicYears,
  courses,
  classes,
  classSchedules,
  rooms,
  enrollments,
  grades,
  type TenantTx,
} from '@sica/database';
import {
  validateBatchEnrollment,
  calculateCurrentSemester,
  type StudentContext,
  type ProgramSksConfig,
} from './sks-quota-validator.service';
import { roundHalfUp } from './gpa-calculator.service';
import { detectAllConflicts, type ScheduleSlot } from './schedule-conflict-detector.service';

export interface KrsSubmitInput {
  readonly periodId: string;
  readonly classIds: readonly string[];
}

export interface KrsEnrollmentRow {
  readonly enrollmentId: string;
  readonly classId: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: number;
  readonly status: 'SUBMITTED';
  readonly submittedAt: string;
}

export interface KrsQuotaSummary {
  readonly maxAllowedSks: number;
  readonly usedSks: number;
  readonly remainingSks: number;
}

export type KrsOutcome =
  | { ok: true; created: KrsEnrollmentRow[]; alreadyEnrolled: string[]; quota: KrsQuotaSummary }
  | { ok: false; kind: 'STUDENT_NOT_FOUND' }
  | { ok: false; kind: 'PERIOD_NOT_OPEN' }
  | { ok: false; kind: 'CLASS_INVALID'; message: string }
  | { ok: false; kind: 'QUOTA_EXCEEDED'; message: string; quota: KrsQuotaSummary }
  | { ok: false; kind: 'SCHEDULE_CONFLICT'; message: string }
  | { ok: false; kind: 'CLASS_FULL'; fullClassIds: string[] };

/** Sentinel internal — memicu rollback transaksi saat kursi habis. */
class ClassFullError extends Error {
  constructor(readonly classId: string) {
    super(`Kelas penuh: ${classId}`);
    this.name = 'ClassFullError';
  }
}

// ── Proyeksi baris DB (kolom numerik Drizzle datang sebagai string) ──────────
interface StudentRow {
  readonly id: string;
  readonly programId: string;
  readonly entryYear: number;
  readonly status: string;
}
interface ProgramCapRow {
  readonly lower: string;
  readonly upper: string;
  readonly between: string;
}
interface PeriodRow {
  readonly id: string;
  readonly status: string;
  readonly term: string;
  readonly yearLabel: string;
}
interface GradeAggRow {
  readonly periodId: string;
  readonly endsOn: string;
  readonly sks: string;
  readonly point: string | null;
}
interface SksRow {
  readonly sks: string;
}
interface ClassRow {
  readonly classId: string;
  readonly className: string;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly status: string;
  readonly periodId: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly sks: string;
}
interface IdRow {
  readonly classId: string;
}
interface SchedRow {
  readonly scheduleId: string;
  readonly classId: string;
  readonly className: string;
  readonly courseName: string;
  readonly roomId: string | null;
  readonly roomCode: string | null;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}

async function resolveStudent(tx: TenantTx, tenantId: string, userId: string): Promise<StudentRow | null> {
  const rows = await tx
    .select({
      id: students.id,
      programId: students.programId,
      entryYear: students.entryYear,
      status: students.status,
    })
    .from(students)
    .innerJoin(tenantMemberships, eq(tenantMemberships.id, students.membershipId))
    .where(and(eq(students.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  return (rows[0] as StudentRow | undefined) ?? null;
}

/** IPS periode lampau terakhir (EFFECTIVE + dinilai) → null bila belum ada. */
async function lastPeriodIps(tx: TenantTx, tenantId: string, studentId: string, currentPeriodId: string): Promise<number | null> {
  const rows = await tx
    .select({
      periodId: enrollments.periodId,
      endsOn: academicPeriods.endsOn,
      sks: courses.sks,
      point: grades.pointValue,
    })
    .from(grades)
    .innerJoin(enrollments, eq(enrollments.id, grades.enrollmentId))
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .innerJoin(academicPeriods, eq(academicPeriods.id, enrollments.periodId))
    .where(
      and(
        eq(grades.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, 'EFFECTIVE'),
        inArray(grades.status, ['LOCKED', 'SUBMITTED', 'CORRECTED']),
      ),
    );

  const byPeriod = new Map<string, { endsOn: string; weighted: number; sks: number }>();
  for (const r of rows as unknown as GradeAggRow[]) {
    if (r.periodId === currentPeriodId || r.point == null) continue;
    const sks = Number(r.sks);
    const point = Number(r.point);
    const acc = byPeriod.get(r.periodId) ?? { endsOn: r.endsOn, weighted: 0, sks: 0 };
    acc.weighted += sks * point;
    acc.sks += sks;
    if (r.endsOn > acc.endsOn) acc.endsOn = r.endsOn;
    byPeriod.set(r.periodId, acc);
  }

  let chosen: { endsOn: string; weighted: number; sks: number } | null = null;
  for (const g of byPeriod.values()) {
    if (!chosen || g.endsOn > chosen.endsOn) chosen = g;
  }
  return chosen && chosen.sks > 0 ? roundHalfUp(chosen.weighted / chosen.sks) : null;
}

async function activeClassIds(tx: TenantTx, tenantId: string, studentId: string, periodId: string): Promise<string[]> {
  const rows = await tx
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.periodId, periodId),
        inArray(enrollments.status, ['SUBMITTED', 'APPROVED', 'EFFECTIVE']),
      ),
    );
  return (rows as unknown as IdRow[]).map((r) => r.classId);
}

async function periodSks(tx: TenantTx, tenantId: string, studentId: string, periodId: string): Promise<number> {
  const rows = await tx
    .select({ sks: courses.sks })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.periodId, periodId),
        inArray(enrollments.status, ['SUBMITTED', 'APPROVED', 'EFFECTIVE']),
      ),
    );
  return (rows as unknown as SksRow[]).reduce((acc, r) => acc + Number(r.sks), 0);
}

async function buildSlots(tx: TenantTx, tenantId: string, studentId: string, periodId: string, classIds: string[]): Promise<ScheduleSlot[]> {
  if (classIds.length === 0) return [];
  const rows = await tx
    .select({
      scheduleId: classSchedules.id,
      classId: classSchedules.classId,
      className: classes.name,
      courseName: courses.name,
      roomId: classSchedules.roomId,
      roomCode: rooms.code,
      dayOfWeek: classSchedules.dayOfWeek,
      startTime: classSchedules.startTime,
      endTime: classSchedules.endTime,
    })
    .from(classSchedules)
    .innerJoin(classes, eq(classes.id, classSchedules.classId))
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .leftJoin(rooms, eq(rooms.id, classSchedules.roomId))
    .where(and(eq(classSchedules.tenantId, tenantId), inArray(classSchedules.classId, classIds)));

  return (rows as unknown as SchedRow[]).map((r) => ({
    scheduleId: r.scheduleId,
    classId: r.classId,
    className: `${r.courseName} — ${r.className}`,
    roomId: r.roomId,
    roomCode: r.roomCode,
    dayOfWeek: r.dayOfWeek,
    startTime: String(r.startTime).slice(0, 5),
    endTime: String(r.endTime).slice(0, 5),
    lecturerIds: [],
    studentIds: [studentId],
    periodId,
  }));
}

export async function submitKrs(tenantId: string, userId: string, input: KrsSubmitInput): Promise<KrsOutcome> {
  try {
    return await withTenantContext(tenantId, async (tx) => {
      const student = await resolveStudent(tx, tenantId, userId);
      if (!student) return { ok: false, kind: 'STUDENT_NOT_FOUND' };

      const progRows = await tx
        .select({
          lower: studyPrograms.sksCapLowerSemesters,
          upper: studyPrograms.sksCapUpperSemesters,
          between: studyPrograms.sksCapBetweenTerm,
        })
        .from(studyPrograms)
        .where(eq(studyPrograms.id, student.programId))
        .limit(1);
      const prog = progRows[0] as ProgramCapRow | undefined;
      const programConfig: ProgramSksConfig = {
        sksCapLowerSemesters: prog ? Number(prog.lower) : 20,
        sksCapUpperSemesters: prog ? Number(prog.upper) : 24,
        sksCapBetweenTerm: prog ? Number(prog.between) : 9,
      };

      const periodRows = await tx
        .select({
          id: academicPeriods.id,
          status: academicPeriods.status,
          term: academicPeriods.term,
          yearLabel: academicYears.label,
        })
        .from(academicPeriods)
        .innerJoin(academicYears, eq(academicYears.id, academicPeriods.academicYearId))
        .where(and(eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.id, input.periodId)))
        .limit(1);
      const period = periodRows[0] as PeriodRow | undefined;
      if (!period || period.status !== 'OPEN') return { ok: false, kind: 'PERIOD_NOT_OPEN' };

      // Validasi kelas kandidat: ada di tenant, periode cocok, status OPEN.
      const candRows = await tx
        .select({
          classId: classes.id,
          className: classes.name,
          capacity: classes.capacity,
          enrolledCount: classes.enrolledCount,
          status: classes.status,
          periodId: classes.periodId,
          courseCode: courses.code,
          courseName: courses.name,
          sks: courses.sks,
        })
        .from(classes)
        .innerJoin(courses, eq(courses.id, classes.courseId))
        .where(and(eq(classes.tenantId, tenantId), inArray(classes.id, [...input.classIds])));
      const candById = new Map<string, ClassRow>((candRows as unknown as ClassRow[]).map((c) => [c.classId, c]));

      const candidates: ClassRow[] = [];
      for (const id of input.classIds) {
        const c = candById.get(id);
        if (!c) return { ok: false, kind: 'CLASS_INVALID', message: `Kelas ${id} tidak ditemukan pada institusi ini.` };
        if (c.periodId !== input.periodId) return { ok: false, kind: 'CLASS_INVALID', message: `"${c.courseName} ${c.className}" bukan kelas pada periode terpilih.` };
        if (c.status !== 'OPEN') return { ok: false, kind: 'CLASS_INVALID', message: `"${c.courseName} ${c.className}" sedang ditutup (status ${c.status}).` };
        candidates.push(c);
      }

      // Idempotensi: pisahkan yang baru vs sudah diambil.
      const existingInCands = await tx
        .select({ classId: enrollments.classId })
        .from(enrollments)
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, student.id), inArray(enrollments.classId, [...input.classIds])));
      const alreadySet = new Set((existingInCands as unknown as IdRow[]).map((r) => r.classId));
      const newClasses = candidates.filter((c) => !alreadySet.has(c.classId));
      const alreadyEnrolled = candidates.filter((c) => alreadySet.has(c.classId)).map((c) => c.classId);

      // Kuota SKS (nyata).
      const currentPeriodSks = await periodSks(tx, tenantId, student.id, input.periodId);
      const lastIps = await lastPeriodIps(tx, tenantId, student.id, input.periodId);
      const currentYear = parseInt(period.yearLabel.slice(0, 4), 10) || new Date().getFullYear();
      const currentSemester = calculateCurrentSemester(student.entryYear, currentYear, period.term);
      const studentCtx: StudentContext = {
        status: student.status,
        currentSemester,
        lastIps,
        periodTerm: period.term,
        currentPeriodSks,
      };
      const newSksArray = newClasses.map((c) => Number(c.sks));
      const quota = validateBatchEnrollment(studentCtx, programConfig, newSksArray);
      if (!quota.isValid) {
        return {
          ok: false,
          kind: 'QUOTA_EXCEEDED',
          message: quota.message,
          quota: { maxAllowedSks: quota.maxAllowedSks, usedSks: quota.usedSks, remainingSks: quota.remainingSks },
        };
      }

      // Bentrok jadwal mahasiswa (kandidat vs aktif).
      const activeIds = await activeClassIds(tx, tenantId, student.id, input.periodId);
      const slotIds = [...new Set([...activeIds, ...input.classIds])];
      const slots = await buildSlots(tx, tenantId, student.id, input.periodId, slotIds);
      const conflictResult = detectAllConflicts(slots, { checkRoom: false, checkLecturer: false, checkStudent: true });
      const newIdSet = new Set(newClasses.map((c) => c.classId));
      const relevant = conflictResult.allConflicts.filter((c) => newIdSet.has(c.slotA.classId) || newIdSet.has(c.slotB.classId));
      if (relevant.length > 0) {
        const first = relevant[0];
        return { ok: false, kind: 'SCHEDULE_CONFLICT', message: first ? first.description : 'Jadwal bentrok.' };
      }

      // Tulis enrollment + decrement kursi atomik (advisory lock per kelas).
      const created: KrsEnrollmentRow[] = [];
      for (const c of newClasses) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${c.classId}))`);
        const enrollmentId = crypto.randomUUID();
        const inserted = await tx
          .insert(enrollments)
          .values({
            id: enrollmentId,
            tenantId,
            studentId: student.id,
            classId: c.classId,
            periodId: input.periodId,
            status: 'SUBMITTED',
            submittedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ id: enrollments.id });
        if (inserted.length === 0) continue; // sudah terdaftar (idempoten) — tanpa increment
        const bumped = await tx
          .update(classes)
          .set({ enrolledCount: sql`${classes.enrolledCount} + 1` })
          .where(and(eq(classes.id, c.classId), sql`${classes.enrolledCount} < ${c.capacity}`))
          .returning({ id: classes.id });
        if (bumped.length === 0) throw new ClassFullError(c.classId);
        created.push({
          enrollmentId,
          classId: c.classId,
          courseCode: c.courseCode,
          courseName: c.courseName,
          className: c.className,
          sks: Number(c.sks),
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
        });
      }

      return {
        ok: true,
        created,
        alreadyEnrolled,
        quota: {
          maxAllowedSks: quota.maxAllowedSks,
          usedSks: quota.usedSks + newSksArray.reduce((a, b) => a + b, 0),
          remainingSks: quota.remainingSks,
        },
      };
    });
  } catch (e) {
    if (e instanceof ClassFullError) return { ok: false, kind: 'CLASS_FULL', fullClassIds: [e.classId] };
    throw e;
  }
}
