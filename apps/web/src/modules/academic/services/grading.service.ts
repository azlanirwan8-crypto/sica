/**
 * Grading Service — jalur TULIS nilai nyata (bukan mock) lewat `withTenantContext`
 * (RLS `tenant_id` + transaksi tunggal pada Primary).
 *
 * Menutup stub `POST /academic/grading`:
 *  1. Otorisasi: hanya dosen pengampu (class_assignments LECTURER/COORDINATOR) atau
 *     admin tenant yang dapat menyimpan nilai kelas.
 *  2. Validasi: tiap enrollmentId harus benar-benar milik kelas + tenant ini.
 *  3. Konversi skor↔huruf memakai skala penilaian kelas (grade_scale_bands) via
 *     `resolveLetterGrade`; huruf eksplisit dipetakan balik ke pointValue.
 *  4. Persist: UPSERT `grades` (unique tenant_id+enrollment_id) — idempoten;
 *     SAVE_DRAFT → status DRAFT, SUBMIT_FINAL → status SUBMITTED.
 *
 * Rujukan: docs/API_SPEC.md §4 (grading), docs/DATA_MODEL.md §11 (grades/scales).
 */
import {
  withTenantContext,
  eq,
  and,
  inArray,
  type TenantTx,
  classes,
  classAssignments,
  tenantMemberships,
  courses,
  curricula,
  gradeScaleBands,
  enrollments,
  grades,
} from '@sica/database';
import { resolveLetterGrade } from './gpa-calculator.service';
import type { GradeInputEntry } from '@sica/contracts';

export interface GradingInput {
  readonly classId: string;
  readonly periodId: string;
  readonly entries: readonly GradeInputEntry[];
  readonly action: 'SAVE_DRAFT' | 'SUBMIT_FINAL';
}

export type GradingOutcome =
  | { ok: true; processedCount: number; status: 'DRAFT' | 'SUBMITTED' }
  | { ok: false; kind: 'FORBIDDEN_NOT_ASSIGNED' }
  | { ok: false; kind: 'CLASS_NOT_FOUND' }
  | { ok: false; kind: 'ENROLLMENT_MISMATCH'; invalidEnrollmentIds: string[] };

interface BandRow {
  readonly minScore: string;
  readonly letterCode: string;
  readonly pointValue: string;
  readonly isPassing: boolean;
}

const ADMIN_ROLES: ReadonlySet<string> = new Set(['tenant_admin', 'super_admin']);

async function membershipOf(tx: TenantTx, tenantId: string, userId: string) {
  const rows = await tx
    .select({ id: tenantMemberships.id, role: tenantMemberships.role })
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  return (rows[0] as { id: string; role: string } | undefined) ?? null;
}

/** Band skala penilaian untuk kelas (via course→curriculum→gradeScaleId). Kosong bila tak ada skala. */
async function bandsForClass(tx: TenantTx, tenantId: string, courseId: string): Promise<BandRow[]> {
  const rows = await tx
    .select({
      minScore: gradeScaleBands.minScore,
      letterCode: gradeScaleBands.letterCode,
      pointValue: gradeScaleBands.pointValue,
      isPassing: gradeScaleBands.isPassing,
    })
    .from(courses)
    .innerJoin(curricula, eq(curricula.id, courses.curriculumId))
    .innerJoin(gradeScaleBands, eq(gradeScaleBands.scaleId, curricula.gradeScaleId))
    .where(and(eq(courses.tenantId, tenantId), eq(courses.id, courseId)));
  return rows as unknown as BandRow[];
}

export async function submitGrading(tenantId: string, userId: string, input: GradingInput): Promise<GradingOutcome> {
  return withTenantContext(tenantId, async (tx) => {
    const mem = await membershipOf(tx, tenantId, userId);
    if (!mem) return { ok: false, kind: 'FORBIDDEN_NOT_ASSIGNED' };

    const classRows = await tx
      .select({ id: classes.id, courseId: classes.courseId })
      .from(classes)
      .where(and(eq(classes.tenantId, tenantId), eq(classes.id, input.classId)))
      .limit(1);
    const cls = classRows[0] as { id: string; courseId: string } | undefined;
    if (!cls) return { ok: false, kind: 'CLASS_NOT_FOUND' };

    // Otorisasi: admin lolos; selain itu wajib assignment LECTURER/COORDINATOR di kelas ini.
    if (!ADMIN_ROLES.has(mem.role)) {
      const assign = await tx
        .select({ id: classAssignments.id })
        .from(classAssignments)
        .where(
          and(
            eq(classAssignments.tenantId, tenantId),
            eq(classAssignments.classId, input.classId),
            eq(classAssignments.lecturerMembershipId, mem.id),
            inArray(classAssignments.roleInClass, ['LECTURER', 'COORDINATOR']),
          ),
        )
        .limit(1);
      if (assign.length === 0) return { ok: false, kind: 'FORBIDDEN_NOT_ASSIGNED' };
    }

    // Semua enrollment harus milik kelas + tenant ini.
    const entryIds = input.entries.map((e) => e.enrollmentId);
    const validEnr = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.classId, input.classId), inArray(enrollments.id, entryIds)));
    const validSet = new Set((validEnr as unknown as Array<{ id: string }>).map((r) => r.id));
    const invalid = entryIds.filter((id) => !validSet.has(id));
    if (invalid.length > 0) return { ok: false, kind: 'ENROLLMENT_MISMATCH', invalidEnrollmentIds: invalid };

    const bands = await bandsForClass(tx, tenantId, cls.courseId);
    const bandPoints = bands.map((b) => ({
      minScore: Number(b.minScore),
      letterCode: b.letterCode,
      pointValue: Number(b.pointValue),
      isPassing: b.isPassing,
    }));

    const status: 'DRAFT' | 'SUBMITTED' = input.action === 'SUBMIT_FINAL' ? 'SUBMITTED' : 'DRAFT';
    let processedCount = 0;

    for (const e of input.entries) {
      // SERVER_ONLY (SEC-02): grades.letterCode/pointValue hanya diturunkan server
      // dari band skala kelas — tidak pernah diterima dari body klien.
      let letter: string | null = null;
      let point: number | null = null;
      const raw = e.rawScore ?? null;

      if (raw !== null && bandPoints.length > 0) {
        const resolved = resolveLetterGrade(raw, bandPoints);
        if (resolved) {
          letter = resolved.letterCode;
          point = resolved.pointValue;
        }
      }

      const rawStr = raw !== null ? raw.toFixed(2) : null;
      const pointStr = point !== null ? point.toFixed(2) : null;

      await tx
        .insert(grades)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          enrollmentId: e.enrollmentId,
          periodId: input.periodId,
          rawScore: rawStr,
          letterCode: letter,
          pointValue: pointStr,
          status,
        })
        .onConflictDoUpdate({
          target: [grades.tenantId, grades.enrollmentId],
          set: { rawScore: rawStr, letterCode: letter, pointValue: pointStr, status },
        });
      processedCount += 1;
    }

    return { ok: true, processedCount, status };
  });
}
