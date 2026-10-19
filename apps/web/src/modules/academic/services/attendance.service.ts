/**
 * Attendance Record Service — jalur TULIS presensi nyata lewat `withTenantContext`
 * (RLS `tenant_id` + transaksi pada Primary).
 *
 * Dipanggil SETELAH rute `attendance/qr/scan` menuntaskan seluruh lapisan keamanan
 * (anti mock-GPS, kecocokan tenant, HMAC, TTL, geofence). Di sini:
 *  1. Petakan user terautentikasi → profil mahasiswa (harus ada).
 *  2. Validasi sesi: milik tenant, kelas sesuai QR, dan presensi SEDANG DIBUKA.
 *  3. Validasi mahasiswa memang terdaftar di kelas tersebut (enrollment aktif).
 *  4. INSERT `attendances` idempoten (unique session_id+student_id) — scan ulang
 *     tidak membuat baris baru (dikembalikan sebagai "sudah tercatat").
 *
 * Rujukan: docs/API_SPEC.md §4 (attendance), docs/DATA_MODEL.md §11.4.
 */
import {
  withTenantContext,
  eq,
  and,
  inArray,
  type TenantTx,
  students,
  tenantMemberships,
  classSessions,
  enrollments,
  attendances,
} from '@sica/database';

export interface AttendanceRecordInput {
  readonly sessionId: string;
  readonly classId: string;
  readonly distanceMeters: number;
  readonly latitude: number;
  readonly longitude: number;
}

export type AttendanceOutcome =
  | { ok: true; attendanceId: string; alreadyPresent: boolean }
  | { ok: false; kind: 'STUDENT_NOT_FOUND' }
  | { ok: false; kind: 'SESSION_INVALID' }
  | { ok: false; kind: 'NOT_ENROLLED' };

async function studentOf(tx: TenantTx, tenantId: string, userId: string): Promise<string | null> {
  const rows = await tx
    .select({ id: students.id })
    .from(students)
    .innerJoin(tenantMemberships, eq(tenantMemberships.id, students.membershipId))
    .where(and(eq(students.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

export async function recordAttendance(
  tenantId: string,
  userId: string,
  input: AttendanceRecordInput,
): Promise<AttendanceOutcome> {
  return withTenantContext(tenantId, async (tx) => {
    const studentId = await studentOf(tx, tenantId, userId);
    if (!studentId) return { ok: false, kind: 'STUDENT_NOT_FOUND' };

    const sessionRows = await tx
      .select({ id: classSessions.id, isAttendanceOpen: classSessions.isAttendanceOpen })
      .from(classSessions)
      .where(
        and(
          eq(classSessions.tenantId, tenantId),
          eq(classSessions.id, input.sessionId),
          eq(classSessions.classId, input.classId),
        ),
      )
      .limit(1);
    const session = sessionRows[0] as { id: string; isAttendanceOpen: boolean } | undefined;
    if (!session || !session.isAttendanceOpen) return { ok: false, kind: 'SESSION_INVALID' };

    const enrRows = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.tenantId, tenantId),
          eq(enrollments.studentId, studentId),
          eq(enrollments.classId, input.classId),
          inArray(enrollments.status, ['SUBMITTED', 'APPROVED', 'EFFECTIVE']),
        ),
      )
      .limit(1);
    if (enrRows.length === 0) return { ok: false, kind: 'NOT_ENROLLED' };

    const attendanceId = crypto.randomUUID();
    const inserted = await tx
      .insert(attendances)
      .values({
        id: attendanceId,
        tenantId,
        sessionId: input.sessionId,
        studentId,
        status: 'PRESENT',
        present: true,
        source: 'QR',
        markedAt: new Date(),
        latitude: input.latitude,
        longitude: input.longitude,
        distanceMeters: input.distanceMeters,
        isMockLocation: false,
      })
      .onConflictDoNothing()
      .returning({ id: attendances.id });

    if (inserted.length === 0) {
      const existing = await tx
        .select({ id: attendances.id })
        .from(attendances)
        .where(and(eq(attendances.sessionId, input.sessionId), eq(attendances.studentId, studentId)))
        .limit(1);
      return { ok: true, attendanceId: (existing[0] as { id: string } | undefined)?.id ?? attendanceId, alreadyPresent: true };
    }

    return { ok: true, attendanceId, alreadyPresent: false };
  });
}
