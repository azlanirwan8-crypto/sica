/**
 * Dashboard Service — baca data akademik NYATA dari DB (bukan mock) lewat
 * `withTenantContext` sehingga Row-Level Security `tenant_id` tetap ditegakkan.
 *
 * Menutup AUD-01 untuk jalur baca dashboard: sebelumnya seluruh kartu statistik &
 * jadwal hardcoded. Kini tiap peran (mahasiswa/dosen/admin) memperoleh ringkasan
 * berbeda yang dihitung dari baris sebenarnya.
 */
import {
  withTenantContext,
  eq,
  and,
  inArray,
  type TenantTx,
  users,
  tenantMemberships,
  students,
  lecturers,
  courses,
  rooms,
  classes,
  classSchedules,
  classAssignments,
  academicPeriods,
  academicYears,
  studyPrograms,
  enrollments,
  grades,
  attendances,
} from '@sica/database';
import { calculateIpk, type GradeEntry } from './gpa-calculator.service';

type MemberRole = 'super_admin' | 'tenant_admin' | 'dosen' | 'mahasiswa' | 'staff';

export interface DashboardStatCard {
  readonly label: string;
  readonly value: string;
  readonly badge: string;
  readonly tone: 'success' | 'info' | 'warning' | 'muted';
}

export interface TodayClassRow {
  readonly time: string;
  readonly code: string;
  readonly name: string;
  readonly room: string;
  readonly lecturer: string;
  readonly status: 'SELESAI' | 'BERLANGSUNG' | 'MENDATANG';
  readonly tone: 'success' | 'info' | 'warning';
}

export interface DashboardView {
  readonly role: MemberRole;
  readonly greetingName: string;
  readonly identityLine: string;
  readonly activePeriodLabel: string;
  readonly cards: DashboardStatCard[];
  readonly todayClasses: TodayClassRow[];
}

/** Proyeksi baris kelas terjadwal dari DB (kolom numerik Drizzle datang sebagai string). */
interface ClassRowDb {
  readonly start: string;
  readonly end: string;
  readonly code: string;
  readonly name: string;
  readonly room: string | null;
  readonly lecturer: string | null;
}

/** Proyeksi baris nilai + enrollment + matakuliah untuk kalkulasi IPK. */
interface GradeRowDb {
  readonly enrollmentId: string;
  readonly classId: string;
  readonly letterCode: string | null;
  readonly pointValue: string | null;
  readonly periodId: string;
  readonly enrollmentStatus: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly courseSks: string;
}

function periodLabel(term: string, yearLabel: string): string {
  const id = term === 'GANJIL' ? 'Ganjil' : term === 'GENAP' ? 'Genap' : 'Antara';
  return `Semester ${id} ${yearLabel}`;
}

/** Konversi hari JS (0=Minggu) ke skema (1=Senin … 7=Minggu). */
function todayDayOfWeek(ref: Date): number {
  const d = ref.getDay();
  return d === 0 ? 7 : d;
}

function classStatus(startHour: number, endHour: number, nowHour: number): { label: TodayClassRow['status']; tone: TodayClassRow['tone'] } {
  if (nowHour >= endHour) return { label: 'SELESAI', tone: 'success' };
  if (nowHour >= startHour) return { label: 'BERLANGSUNG', tone: 'info' };
  return { label: 'MENDATANG', tone: 'warning' };
}

async function memberRowId(tx: TenantTx, tenantId: string, userId: string): Promise<string> {
  const rows = await tx
    .select({ id: tenantMemberships.id, role: tenantMemberships.role, memberCode: tenantMemberships.memberCode, userName: users.fullName })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  const r = rows[0] as { id: string; role: MemberRole; memberCode: string | null; userName: string } | undefined;
  return r ? r.id : '';
}

async function resolveRole(tx: TenantTx, tenantId: string, userId: string) {
  const rows = await tx
    .select({ role: tenantMemberships.role, memberCode: tenantMemberships.memberCode, userName: users.fullName })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .limit(1);
  return (rows[0] as { role: MemberRole; memberCode: string | null; userName: string } | undefined) ?? null;
}

async function activePeriod(tx: TenantTx, tenantId: string) {
  const rows = await tx
    .select({ id: academicPeriods.id, term: academicPeriods.term, status: academicPeriods.status, yearLabel: academicYears.label })
    .from(academicPeriods)
    .innerJoin(academicYears, eq(academicYears.id, academicPeriods.academicYearId))
    .where(eq(academicPeriods.tenantId, tenantId));
  const typed = rows as Array<{ id: string; term: string; status: string; yearLabel: string }>;
  return typed.find((p) => p.status === 'OPEN') ?? typed[0] ?? null;
}

async function sumSksForClasses(tx: TenantTx, classIds: string[]): Promise<number> {
  if (classIds.length === 0) return 0;
  const rows = await tx
    .select({ sks: courses.sks })
    .from(courses)
    .innerJoin(classes, eq(classes.courseId, courses.id))
    .where(inArray(classes.id, classIds));
  return (rows as Array<{ sks: string }>).reduce((acc, r) => acc + Number(r.sks), 0);
}

async function loadTodayClasses(tx: TenantTx, tenantId: string, classIds: string[], dow: number, nowHour: number): Promise<TodayClassRow[]> {
  if (classIds.length === 0) return [];
  const rows = await tx
    .select({
      start: classSchedules.startTime,
      end: classSchedules.endTime,
      code: courses.code,
      name: courses.name,
      room: rooms.name,
      lecturer: users.fullName,
    })
    .from(classSchedules)
    .innerJoin(classes, eq(classes.id, classSchedules.classId))
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .leftJoin(rooms, eq(rooms.id, classSchedules.roomId))
    .leftJoin(classAssignments, eq(classAssignments.classId, classes.id))
    .leftJoin(tenantMemberships, eq(tenantMemberships.id, classAssignments.lecturerMembershipId))
    .leftJoin(users, eq(users.id, tenantMemberships.userId))
    .where(and(eq(classSchedules.tenantId, tenantId), eq(classSchedules.dayOfWeek, dow), inArray(classes.id, classIds)));

  return (rows as unknown as ClassRowDb[])
    .map((r) => {
      const start = String(r.start ?? '00:00').slice(0, 5);
      const end = String(r.end ?? '00:00').slice(0, 5);
      const sh = parseInt(start.slice(0, 2), 10) || 0;
      const eh = parseInt(end.slice(0, 2), 10) || 0;
      const st = classStatus(sh, eh, nowHour);
      return {
        sortKey: sh,
        time: `${start} - ${end}`,
        code: String(r.code ?? '—'),
        name: String(r.name ?? '—'),
        room: String(r.room ?? 'Ruang belum ditentukan'),
        lecturer: String(r.lecturer ?? 'Belum ditentukan'),
        status: st.label,
        tone: st.tone,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ time, code, name, room, lecturer, status, tone }) => ({ time, code, name, room, lecturer, status, tone }));
}

export async function loadDashboard(tenantId: string, userId: string): Promise<DashboardView | null> {
  return withTenantContext(tenantId, async (tx) => {
    const me = await resolveRole(tx, tenantId, userId);
    if (!me) return null;
    const myMembershipId = await memberRowId(tx, tenantId, userId);

    const openPeriod = await activePeriod(tx, tenantId);
    const periodId = openPeriod?.id ?? '';
    const activePeriodLabel = openPeriod ? periodLabel(openPeriod.term, openPeriod.yearLabel) : '—';

    const dow = todayDayOfWeek(new Date());
    const nowHour = new Date().getHours();

    if (me.role === 'mahasiswa') {
      const stRows = await tx.select().from(students).where(and(eq(students.tenantId, tenantId), eq(students.membershipId, myMembershipId))).limit(1);
      const st = stRows[0] as typeof students.$inferSelect | undefined;
      if (!st) return null;

      const progRows = await tx.select({ name: studyPrograms.name, minSks: studyPrograms.minTotalSks }).from(studyPrograms).where(eq(studyPrograms.id, st.programId)).limit(1);
      const prog = progRows[0] as { name: string; minSks: string } | undefined;

      const gradeRows = await tx
        .select({
          enrollmentId: grades.enrollmentId,
          classId: enrollments.classId,
          letterCode: grades.letterCode,
          pointValue: grades.pointValue,
          periodId: grades.periodId,
          enrollmentStatus: enrollments.status,
          courseCode: courses.code,
          courseName: courses.name,
          courseSks: courses.sks,
        })
        .from(grades)
        .innerJoin(enrollments, eq(enrollments.id, grades.enrollmentId))
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .innerJoin(courses, eq(courses.id, classes.courseId))
        .where(and(eq(grades.tenantId, tenantId), eq(enrollments.studentId, st.id)));

      const entries: GradeEntry[] = (gradeRows as unknown as GradeRowDb[]).map((g) => {
        const point = g.pointValue != null ? Number(g.pointValue) : null;
        return {
          enrollmentId: g.enrollmentId,
          courseId: g.classId,
          courseCode: g.courseCode,
          courseName: g.courseName,
          sks: Number(g.courseSks),
          letterCode: g.letterCode,
          pointValue: point,
          isPassing: point !== null && point >= 2.0,
          periodId: g.periodId,
          enrollmentStatus: g.enrollmentStatus,
        };
      });
      const gpa = calculateIpk(entries);

      const activeEnr = await tx
        .select({ classId: enrollments.classId })
        .from(enrollments)
        .where(and(eq(enrollments.tenantId, tenantId), eq(enrollments.studentId, st.id), eq(enrollments.periodId, periodId), inArray(enrollments.status, ['SUBMITTED', 'EFFECTIVE'])));
      const activeClassIds = (activeEnr as Array<{ classId: string }>).map((e) => e.classId);
      const loadSks = await sumSksForClasses(tx, activeClassIds);

      const attRows = await tx.select({ present: attendances.present }).from(attendances).where(and(eq(attendances.tenantId, tenantId), eq(attendances.studentId, st.id)));
      const totalAtt = (attRows as Array<{ present: boolean }>).length;
      const presentAtt = (attRows as Array<{ present: boolean }>).filter((a) => a.present).length;
      const attPct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 1000) / 10 : 0;

      const todayClasses = await loadTodayClasses(tx, tenantId, activeClassIds, dow, nowHour);
      const minSks = prog ? Number(prog.minSks) : 0;

      return {
        role: me.role,
        greetingName: me.userName,
        identityLine: `${prog?.name ?? 'Program Studi'} · NIM: ${st.nim}`,
        activePeriodLabel,
        cards: [
          { label: 'Indeks Prestasi Kumulatif', value: gpa.ipk.toFixed(2), badge: `${gpa.totalCourseCount} matakuliah dinilai`, tone: gpa.ipk >= 2.0 ? 'success' : 'warning' },
          { label: 'Total SKS Lulus', value: `${gpa.passedSks} / ${minSks}`, badge: `Beban SKS semester aktif: ${loadSks} SKS`, tone: 'info' },
          { label: 'Presensi Kehadiran', value: `${attPct.toFixed(1)}%`, badge: totalAtt > 0 ? `${presentAtt} dari ${totalAtt} sesi hadir` : 'Belum ada presensi', tone: attPct >= 75 ? 'success' : 'warning' },
          { label: 'Status Akademik', value: st.status, badge: `Masuk ${st.entryYear} · Feeder ${st.feederStatusCode === '1' ? 'Aktif' : st.feederStatusCode}`, tone: st.status === 'ACTIVE' ? 'success' : 'muted' },
        ],
        todayClasses,
      } satisfies DashboardView;
    }

    if (me.role === 'dosen') {
      const lecRows = await tx.select().from(lecturers).where(and(eq(lecturers.tenantId, tenantId), eq(lecturers.membershipId, myMembershipId))).limit(1);
      const lec = lecRows[0] as typeof lecturers.$inferSelect | undefined;

      const myClassRows = await tx.select({ classId: classAssignments.classId }).from(classAssignments).where(and(eq(classAssignments.tenantId, tenantId), eq(classAssignments.lecturerMembershipId, myMembershipId)));
      const myClassIds = (myClassRows as Array<{ classId: string }>).map((c) => c.classId);
      const todayClasses = await loadTodayClasses(tx, tenantId, myClassIds, dow, nowHour);

      return {
        role: me.role,
        greetingName: me.userName,
        identityLine: `Dosen ${lec?.specialization ?? 'Pengajar'} · NIDN: ${lec?.nidn ?? me.memberCode ?? '—'}`,
        activePeriodLabel,
        cards: [
          { label: 'Kelas Diampu', value: String(myClassIds.length), badge: `Periode ${activePeriodLabel}`, tone: 'info' },
          { label: 'Sesi Hari Ini', value: String(todayClasses.length), badge: todayClasses.length > 0 ? 'Terjadwal hari ini' : 'Tidak ada sesi', tone: todayClasses.length > 0 ? 'warning' : 'muted' },
          { label: 'Jabatan Fungsional', value: lec?.academicRank ?? '—', badge: lec?.employmentType ?? '—', tone: 'success' },
          { label: 'Keahlian', value: lec?.specialization ? 'Tetap' : '—', badge: lec?.lastDegreeUniversity ?? 'Belum terisi', tone: 'muted' },
        ],
        todayClasses,
      } satisfies DashboardView;
    }

    // tenant_admin / super_admin — agregat tenant
    const stCount = await tx.select({ id: students.id }).from(students).where(eq(students.tenantId, tenantId));
    const lecCount = await tx.select({ id: lecturers.id }).from(lecturers).where(eq(lecturers.tenantId, tenantId));
    const classCount = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.tenantId, tenantId), eq(classes.periodId, periodId)));
    const schedRows = await tx
      .select({ classId: classes.id })
      .from(classSchedules)
      .innerJoin(classes, eq(classes.id, classSchedules.classId))
      .where(and(eq(classes.tenantId, tenantId), eq(classSchedules.dayOfWeek, dow)));
    const adminTodayIds = (schedRows as Array<{ classId: string }>).map((r) => r.classId);
    const todayClasses = await loadTodayClasses(tx, tenantId, adminTodayIds, dow, nowHour);

    return {
      role: me.role,
      greetingName: me.userName,
      identityLine: 'Biro Administrasi Akademik',
      activePeriodLabel,
      cards: [
        { label: 'Mahasiswa Aktif', value: String(stCount.length), badge: `Periode ${activePeriodLabel}`, tone: 'success' },
        { label: 'Dosen & Pengajar', value: String(lecCount.length), badge: 'Seluruh homebase aktif', tone: 'info' },
        { label: 'Kelas Dibuka', value: String(classCount.length), badge: 'Periode berjalan', tone: 'info' },
        { label: 'Sesi Hari Ini', value: String(todayClasses.length), badge: 'Total kelas terjadwal', tone: 'warning' },
      ],
      todayClasses,
    } satisfies DashboardView;
  });
}
