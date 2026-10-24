/**
 * KRS Open Classes Service — jalur BACA nyata (PostgreSQL) untuk rute
 * `GET /api/v1/academic/krs/open-classes` dan layar `/academic/krs`.
 *
 * Menutup G-7/RD-154: daftar kelas terbuka pernah disajikan dari fixture
 * (`generateMockOpenClasses` di rute + `DEMO_CLASSES` di komponen), sehingga
 * `tenant_admin` melihat delapan baris kelas palsu dengan tombol "Kirim KRS".
 * Berkas ini HANYA MEMBACA: tidak menulis `enrollments`, tidak menyentuh kursi
 * kelas, dan tidak mengubah jalur tulis — `krs.service.ts` tetap satu-satunya
 * pemilik submit + `pg_advisory_xact_lock`.
 *
 * Keputusan skema yang diverifikasi dari sumber (bukan asumsi):
 *  - Tidak ada tabel distribusi/penawaran kelas terpisah. `classes` sudah memuat
 *    `period_id`, `program_id`, `course_id`, `capacity`, `status`
 *    (packages/database/src/schema/classes.ts:69; DDL 0002_academic_core.sql:154).
 *    "Kelas terbuka untuk mahasiswa ini" = `classes` pada periode terpilih ×
 *    `program_id` mahasiswa × `status = 'OPEN'`. Konsekuensi jujur: MKU lintas
 *    prodi (kelas dimiliki prodi pengampunya) tidak tampak di daftar ini —
 *    relasi prodi↔kelas lintas program belum ada di model.
 *  - `students` tidak punya `user_id`; identitas mahasiswa diselesaikan lewat
 *    `students.membership_id → tenant_memberships.user_id` (classes.ts:33,
 *    auth.ts:47) — sama seperti `resolveStudent()` pada jalur tulis.
 *  - Nama pengampu hidup di `users.full_name` (auth.ts:20). `lecturers`
 *    (people.ts:31) hanya memuat atribut feeder (NIDN/gelar) dan TIDAK punya
 *    kolom nama, jadi proyeksinya `class_assignments → lecturers` (memastikan
 *    membership itu memang seorang dosen) `→ tenant_memberships → users`.
 *  - `courses.sks` bertipe `numeric(4,1)` → datang sebagai string; dikonversi
 *    sekali di sini (ADR-5: tidak ada float di dua tempat).
 *  - Kursi terpakai dihitung ulang dari `enrollments` keadaan
 *    SUBMITTED/APPROVED/EFFECTIVE — himpunan yang sama yang dipakai
 *    `krs.service.ts` menghitung `usedSks`. Kolom denormal
 *    `classes.enrolled_count` TIDAK dipakai untuk tampil; ia yang dijaga
 *    `UPDATE ... WHERE enrolled_count < capacity` saat tulis. Drift keduanya
 *    dilaporkan sebagai keterbatasan, bukan disembunyikan.
 *  - `class_schedules.day_of_week` = 1 Senin … 7 Minggu; `start_time`/`end_time`
 *    bertipe `time` ('HH:MM:SS' → dipotong ke 'HH:MM' agar cocok kontrak API).
 *  - `class_schedules.room_id` nullable → `roomCode: null` (kelas daring/lab
 *    tanpa ruang terdaftar).
 *
 * Semua baca berjalan di dalam `withTenantContext` sehingga policy
 * `tenant_isolation` (ENABLE + FORCE, 0002_academic_core.sql:328) berlaku, dan
 * di Primary — jalur ini read-your-writes (setelah submit, daftar harus
 * memperlihatkan barisnya), jadi replica dilarang melayani layar ini
 * (AGENTS §3.7). Tidak ada `select *`: hanya kolom yang dibutuhkan UI.
 */
import {
  withTenantContext,
  sql,
  eq,
  and,
  or,
  asc,
  desc,
  ilike,
  inArray,
  type TenantTx,
  academicPeriods,
  academicYears,
  classAssignments,
  classSchedules,
  classes,
  courses,
  enrollments,
  grades,
  lecturers,
  rooms,
  students,
  studyPrograms,
  tenantMemberships,
  users,
} from '@sica/database';
import {
  calculateCurrentSemester,
  validateSksQuota,
  type ProgramSksConfig,
  type StudentContext,
} from './sks-quota-validator.service';
import { roundHalfUp } from './gpa-calculator.service';
import {
  getOverlapRange,
  intervalsOverlap,
  minutesToTime,
  timeToMinutes,
} from './schedule-conflict-detector.service';

/** Status enrollment yang dihitung "sudah memegang kursi" (identik jalur tulis). */
const ACTIVE_ENROLLMENT_STATUSES = ['SUBMITTED', 'APPROVED', 'EFFECTIVE'] as const;

/** Nilai `classes.status` yang boleh diambil (schema/classes.ts:88 — kolom text). */
const OPEN_CLASS_STATUS = 'OPEN';

/** Plafon `limit` kontrak `OpenClassesQuerySchema` — layar memuat satu halaman penuh. */
export const KRS_SCREEN_CLASS_LIMIT = 100;

/** Label hari Indonesia untuk pesan bentrok yang dihasilkan server (bukan enum DB). */
const DAY_NAME: Readonly<Record<number, string>> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

// =============================================================================
// Bentuk respons (kontrak `KrsClassItemSchema` — nama field tidak boleh berubah)
// =============================================================================

export interface KrsClassScheduleView {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomCode: string | null;
}

/** Satu baris daftar kelas terbuka; sama persis dengan item respons API. */
export interface KrsOpenClassView {
  readonly classId: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: number;
  readonly capacity: number;
  readonly enrolledCount: number;
  readonly lecturerNames: readonly string[];
  readonly schedules: readonly KrsClassScheduleView[];
  readonly hasConflict: boolean;
  readonly conflictDescription: string | null;
}

export interface KrsOpenClassQuery {
  readonly periodId: string;
  readonly search?: string | undefined;
  readonly dayOfWeek?: number | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface KrsOpenClassPage {
  readonly items: readonly KrsOpenClassView[];
  readonly totalRecords: number;
}

const EMPTY_PAGE: KrsOpenClassPage = { items: [], totalRecords: 0 };

// =============================================================================
// Bentrok jadwal — murni, tanpa DB (diuji di tests/unit/krs-open-classes.test.ts)
// =============================================================================

export interface ConflictSlot {
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
}

/** Slot milik mahasiswa sendiri; `label` dipakai menyusun sebab bentrok. */
export interface OwnConflictSlot extends ConflictSlot {
  readonly label: string;
}

export interface ScheduleOverlap {
  readonly withLabel: string;
  readonly dayOfWeek: number;
  readonly overlapStart: string;
  readonly overlapEnd: string;
}

/**
 * Overlap pertama antara jadwal kelas kandidat dan jadwal yang sudah dipegang
 * mahasiswa. Interval setengah-terbuka ([mulai, selesai)): kelas 08:00–09:40 dan
 * 09:40–11:20 TIDAK bentrok — aturan yang sama dipakai `krs.service.ts` saat
 * menulis, jadi peringatan UI dan vonis server tidak bisa berbeda.
 *
 * Deterministik: kedua daftar dibaca sudah terurut (hari, jam mulai) dan fungsi
 * ini berhenti pada overlap pertama.
 */
export function findScheduleOverlap(
  candidate: readonly ConflictSlot[],
  own: readonly OwnConflictSlot[],
): ScheduleOverlap | null {
  for (const c of candidate) {
    const cStart = timeToMinutes(c.startTime);
    const cEnd = timeToMinutes(c.endTime);
    for (const o of own) {
      if (o.dayOfWeek !== c.dayOfWeek) continue;
      const oStart = timeToMinutes(o.startTime);
      const oEnd = timeToMinutes(o.endTime);
      if (!intervalsOverlap(cStart, cEnd, oStart, oEnd)) continue;
      const range = getOverlapRange(cStart, cEnd, oStart, oEnd);
      return {
        withLabel: o.label,
        dayOfWeek: c.dayOfWeek,
        overlapStart: minutesToTime(range.start),
        overlapEnd: minutesToTime(range.end),
      };
    }
  }
  return null;
}

/** Sebab bentrok untuk `conflictDescription` (pesan server, bukan kunci UI). */
export function formatConflictDescription(overlap: ScheduleOverlap): string {
  const day = DAY_NAME[overlap.dayOfWeek] ?? `Hari ${overlap.dayOfWeek}`;
  return (
    `Bentrok dengan "${overlap.withLabel}" pada ${day} ` +
    `${overlap.overlapStart}-${overlap.overlapEnd}`
  );
}

// =============================================================================
// Proyeksi baris DB
// =============================================================================

interface StudentRow {
  readonly id: string;
  readonly programId: string;
  readonly programName: string;
  readonly nim: string;
  readonly fullName: string;
  readonly entryYear: number;
  readonly status: string;
}

interface PeriodRow {
  readonly id: string;
  readonly status: string;
  readonly term: string;
  readonly yearLabel: string;
  readonly endsOn: string;
}

interface ClassPageRow {
  readonly classId: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: string;
  readonly capacity: number;
}

interface ScheduleRow {
  readonly classId: string;
  readonly dayOfWeek: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomCode: string | null;
}

interface LecturerRow {
  readonly classId: string;
  readonly fullName: string;
}

interface EnrolledRow {
  readonly classId: string;
  readonly status: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: string;
}

interface GradeAggRow {
  readonly periodId: string;
  readonly endsOn: string;
  readonly sks: string;
  readonly point: string | null;
}

// =============================================================================
// Pembaca dasar (semua di dalam transaksi ber-RLS)
// =============================================================================

/** Baris `students` milik subjek; `null` bila akun tidak tertaut mahasiswa. */
async function studentOf(
  tx: TenantTx,
  tenantId: string,
  userId: string,
): Promise<StudentRow | null> {
  const rows = await tx
    .select({
      id: students.id,
      programId: students.programId,
      programName: studyPrograms.name,
      nim: students.nim,
      fullName: students.fullName,
      entryYear: students.entryYear,
      status: students.status,
    })
    .from(students)
    .innerJoin(tenantMemberships, eq(tenantMemberships.id, students.membershipId))
    .innerJoin(studyPrograms, eq(studyPrograms.id, students.programId))
    .where(and(eq(students.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
    .orderBy(asc(students.nim))
    .limit(1);
  return rows[0] ?? null;
}

/** Periode milik tenant terpilih; `null` bila tidak ada (bukan tenant ini / UUID lain). */
async function periodById(
  tx: TenantTx,
  tenantId: string,
  periodId: string,
): Promise<PeriodRow | null> {
  const rows = await tx
    .select({
      id: academicPeriods.id,
      status: academicPeriods.status,
      term: academicPeriods.term,
      yearLabel: academicYears.label,
      endsOn: academicPeriods.endsOn,
    })
    .from(academicPeriods)
    .innerJoin(academicYears, eq(academicYears.id, academicPeriods.academicYearId))
    .where(and(eq(academicPeriods.tenantId, tenantId), eq(academicPeriods.id, periodId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Periode yang dipakai layar: status OPEN lebih dulu, lalu periode yang paling akhir berakhir. */
async function openPeriod(tx: TenantTx, tenantId: string): Promise<PeriodRow | null> {
  const rows = await tx
    .select({
      id: academicPeriods.id,
      status: academicPeriods.status,
      term: academicPeriods.term,
      yearLabel: academicYears.label,
      endsOn: academicPeriods.endsOn,
    })
    .from(academicPeriods)
    .innerJoin(academicYears, eq(academicYears.id, academicPeriods.academicYearId))
    .where(eq(academicPeriods.tenantId, tenantId))
    .orderBy(desc(academicPeriods.endsOn), asc(academicPeriods.id));
  return rows.find((row) => row.status === 'OPEN') ?? rows[0] ?? null;
}

/** Enrollment aktif mahasiswa pada satu periode — ikut menandai baris daftar. */
async function enrolledRowsOf(
  tx: TenantTx,
  tenantId: string,
  studentId: string,
  periodId: string,
): Promise<readonly EnrolledRow[]> {
  const rows = await tx
    .select({
      classId: enrollments.classId,
      status: enrollments.status,
      courseCode: courses.code,
      courseName: courses.name,
      className: classes.name,
      sks: courses.sks,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.periodId, periodId),
        inArray(enrollments.status, [...ACTIVE_ENROLLMENT_STATUSES]),
      ),
    )
    .orderBy(asc(courses.code), asc(classes.name));
  return rows;
}

async function schedulesOf(
  tx: TenantTx,
  tenantId: string,
  classIds: readonly string[],
): Promise<readonly ScheduleRow[]> {
  if (classIds.length === 0) return [];
  const rows = await tx
    .select({
      classId: classSchedules.classId,
      dayOfWeek: classSchedules.dayOfWeek,
      startTime: classSchedules.startTime,
      endTime: classSchedules.endTime,
      roomCode: rooms.code,
    })
    .from(classSchedules)
    .leftJoin(rooms, eq(rooms.id, classSchedules.roomId))
    .where(
      and(
        eq(classSchedules.tenantId, tenantId),
        inArray(classSchedules.classId, [...classIds]),
      ),
    )
    .orderBy(
      asc(classSchedules.dayOfWeek),
      asc(classSchedules.startTime),
      asc(classSchedules.id),
    );
  return rows;
}

/**
 * Nama pengampu per kelas. `role_in_class` TIDAK difilter: kolom
 * `lecturer_membership_id` sudah menuntut sebuah membership dosen, dan
 * `innerJoin(lecturers)` membuang penugasan yang tidak resolve ke baris
 * `lecturers`. Urutan nama mengikuti alphabet agar daftar stabil.
 */
async function lecturersOf(
  tx: TenantTx,
  tenantId: string,
  classIds: readonly string[],
): Promise<readonly LecturerRow[]> {
  if (classIds.length === 0) return [];
  const rows = await tx
    .select({
      classId: classAssignments.classId,
      fullName: users.fullName,
    })
    .from(classAssignments)
    .innerJoin(lecturers, eq(lecturers.membershipId, classAssignments.lecturerMembershipId))
    .innerJoin(tenantMemberships, eq(tenantMemberships.id, classAssignments.lecturerMembershipId))
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(classAssignments.tenantId, tenantId),
        inArray(classAssignments.classId, [...classIds]),
      ),
    )
    .orderBy(asc(classAssignments.classId), asc(users.fullName), asc(classAssignments.id));
  return rows;
}

/** Kursi terpakai = jumlah enrollment aktif per kelas (lihat catatan kepala berkas). */
async function seatsOf(
  tx: TenantTx,
  tenantId: string,
  classIds: readonly string[],
): Promise<ReadonlyMap<string, number>> {
  if (classIds.length === 0) return new Map<string, number>();
  const rows = await tx
    .select({ classId: enrollments.classId, taken: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.tenantId, tenantId),
        inArray(enrollments.classId, [...classIds]),
        inArray(enrollments.status, [...ACTIVE_ENROLLMENT_STATUSES]),
      ),
    )
    .groupBy(enrollments.classId);
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.classId, row.taken);
  return map;
}

/** IPS periode lampau terakhir — cermin `lastPeriodIps()` pada jalur tulis. */
async function lastPeriodIps(
  tx: TenantTx,
  tenantId: string,
  studentId: string,
  currentPeriodId: string,
): Promise<number | null> {
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
  for (const row of rows as readonly GradeAggRow[]) {
    if (row.periodId === currentPeriodId || row.point === null) continue;
    const sks = Number(row.sks);
    const point = Number(row.point);
    const acc = byPeriod.get(row.periodId) ?? { endsOn: row.endsOn, weighted: 0, sks: 0 };
    acc.weighted += sks * point;
    acc.sks += sks;
    if (row.endsOn > acc.endsOn) acc.endsOn = row.endsOn;
    byPeriod.set(row.periodId, acc);
  }

  let chosen: { endsOn: string; weighted: number; sks: number } | null = null;
  for (const value of byPeriod.values()) {
    if (chosen === null || value.endsOn > chosen.endsOn) chosen = value;
  }
  return chosen !== null && chosen.sks > 0 ? roundHalfUp(chosen.weighted / chosen.sks) : null;
}

// =============================================================================
// Perakit halaman kelas terbuka
// =============================================================================

function groupByClass<T extends { readonly classId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.classId);
    if (list) list.push(row);
    else map.set(row.classId, [row]);
  }
  return map;
}

/** Kolom `time` PostgreSQL datang sebagai 'HH:MM:SS' — kontrak API minta 'HH:MM'. */
function trimTime(value: string): string {
  return value.slice(0, 5);
}

function toScheduleViews(rows: readonly ScheduleRow[]): readonly KrsClassScheduleView[] {
  return rows.map((row) => ({
    dayOfWeek: row.dayOfWeek,
    startTime: trimTime(row.startTime),
    endTime: trimTime(row.endTime),
    roomCode: row.roomCode,
  }));
}

/**
 * Rakit item respons. `ownSlots` berisi jadwal kelas mahasiswa sendiri pada
 * periode yang sama, dikelompokkan per kelas; slot kelas yang sedang diperiksa
 * dikecualikan agar enrollment yang sudah ada tidak dihitung bentrok dengan
 * dirinya sendiri.
 */
function buildClassViews(
  pageRows: readonly ClassPageRow[],
  scheduleRows: readonly ScheduleRow[],
  lecturerRows: readonly LecturerRow[],
  seats: ReadonlyMap<string, number>,
  ownSlots: ReadonlyMap<string, readonly OwnConflictSlot[]>,
): readonly KrsOpenClassView[] {
  const schedulesByClass = groupByClass(scheduleRows);
  const lecturersByClass = groupByClass(lecturerRows);

  return pageRows.map((row) => {
    const schedules = toScheduleViews(schedulesByClass.get(row.classId) ?? []);

    const lecturerNames: string[] = [];
    for (const item of lecturersByClass.get(row.classId) ?? []) {
      if (!lecturerNames.includes(item.fullName)) lecturerNames.push(item.fullName);
    }

    const own: OwnConflictSlot[] = [];
    for (const [classId, slots] of ownSlots) {
      if (classId === row.classId) continue;
      own.push(...slots);
    }

    const overlap = findScheduleOverlap(schedules, own);

    return {
      classId: row.classId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      className: row.className,
      sks: Number(row.sks),
      capacity: row.capacity,
      enrolledCount: seats.get(row.classId) ?? 0,
      lecturerNames,
      schedules,
      hasConflict: overlap !== null,
      conflictDescription: overlap === null ? null : formatConflictDescription(overlap),
    } satisfies KrsOpenClassView;
  });
}

export interface AssembledClasses {
  readonly items: readonly KrsOpenClassView[];
  readonly totalRecords: number;
}

/**
 * Satu query berhalaman + tiga query pengayaan (jadwal, pengampu, kursi) untuk
 * id pada halaman ini saja — tidak ada N+1, tidak ada borong kolom PII.
 *
 * Kueri dijalankan berurutan, bukan `Promise.all`: satu transaksi postgres.js
 * memegang satu koneksi, jadi kueri yang bertumpuk akan saling memotong.
 */
async function assembleOpenClasses(
  tx: TenantTx,
  tenantId: string,
  student: StudentRow,
  periodId: string,
  query: KrsOpenClassQuery,
): Promise<AssembledClasses> {
  const needle = query.search ? `%${query.search}%` : null;

  const where = and(
    eq(classes.tenantId, tenantId),
    eq(classes.periodId, periodId),
    eq(classes.programId, student.programId),
    eq(classes.status, OPEN_CLASS_STATUS),
    ...(needle
      ? [or(ilike(courses.code, needle), ilike(courses.name, needle), ilike(classes.name, needle))]
      : []),
    ...(query.dayOfWeek
      ? [
          // EXISTS ditulis eksplisit karena `exists()` tidak diekspor
          // `@sica/database`; nilainya terikat sebagai parameter dan predicate
          // tenant ikut dipasang agar tidak mengandalkan policy saja.
          sql`EXISTS (SELECT 1 FROM public.class_schedules cs WHERE cs.class_id = ${classes.id} AND cs.tenant_id = ${tenantId} AND cs.day_of_week = ${query.dayOfWeek})`,
        ]
      : []),
  );

  const counted = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(classes)
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .where(where);
  const totalRecords = counted[0]?.total ?? 0;

  const pageRows = await tx
    .select({
      classId: classes.id,
      courseCode: courses.code,
      courseName: courses.name,
      className: classes.name,
      sks: courses.sks,
      capacity: classes.capacity,
    })
    .from(classes)
    .innerJoin(courses, eq(courses.id, classes.courseId))
    .where(where)
    // Urutan deterministik mengikuti kunci unik (tenant, periode, kuliah, nama
    // kelas) — bukan `id`, yang berubah posisi saat tenant menambah baris.
    .orderBy(asc(courses.code), asc(classes.name))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit);

  if (pageRows.length === 0) return { items: [], totalRecords };

  const pageIds = pageRows.map((row) => row.classId);
  const enrolled = await enrolledRowsOf(tx, tenantId, student.id, periodId);
  const enrolledIds = new Set(enrolled.map((row) => row.classId));
  // Jadwal kelas sendiri yang TIDAK ada di halaman ini tetap dibutuhkan untuk
  // deteksi bentrok; yang ada di halaman dikecualikan (bukan bentrok dengan diri sendiri).
  const otherOwnIds = [...enrolledIds].filter((id) => !pageIds.includes(id));

  const scheduleRows = await schedulesOf(tx, tenantId, pageIds);
  const lecturerRows = await lecturersOf(tx, tenantId, pageIds);
  const seats = await seatsOf(tx, tenantId, pageIds);
  const ownScheduleRows = await schedulesOf(tx, tenantId, otherOwnIds);

  const ownLabelByClass = new Map<string, string>(
    enrolled.map((row) => [row.classId, `${row.courseName} — ${row.className}`]),
  );
  const ownSlots = new Map<string, OwnConflictSlot[]>();
  for (const row of ownScheduleRows) {
    const list = ownSlots.get(row.classId) ?? [];
    list.push({
      dayOfWeek: row.dayOfWeek,
      startTime: trimTime(row.startTime),
      endTime: trimTime(row.endTime),
      label: ownLabelByClass.get(row.classId) ?? row.classId,
    });
    ownSlots.set(row.classId, list);
  }

  return {
    items: buildClassViews(pageRows, scheduleRows, lecturerRows, seats, ownSlots),
    totalRecords,
  };
}

// =============================================================================
// API publik
// =============================================================================

/**
 * Daftar kelas terbuka untuk mahasiswa milik `userId`. Kontrak daftar: bila akun
 * tidak tertaut `students`, atau periode bukan milik tenant ini, hasilnya
 * KOSONG — rute menjawab 200, bukan 500.
 */
export async function listOpenClasses(
  tenantId: string,
  userId: string,
  query: KrsOpenClassQuery,
): Promise<KrsOpenClassPage> {
  return withTenantContext(tenantId, async (tx) => {
    const student = await studentOf(tx, tenantId, userId);
    if (!student) return EMPTY_PAGE;
    const period = await periodById(tx, tenantId, query.periodId);
    if (!period) return EMPTY_PAGE;
    const assembled = await assembleOpenClasses(tx, tenantId, student, query.periodId, query);
    return { items: assembled.items, totalRecords: assembled.totalRecords };
  });
}

export interface KrsScreenIdentity {
  readonly nim: string;
  readonly fullName: string;
  readonly programName: string;
  readonly status: string;
}

export interface KrsScreenPeriod {
  readonly id: string;
  readonly label: string;
  readonly status: string;
  readonly endsOn: string;
}

export interface KrsScreenQuota {
  readonly maxAllowedSks: number;
  readonly usedSks: number;
  readonly remainingSks: number;
  /** Sebab penolakan dari validator (mis. status ON_LEAVE); null bila boleh mengisi. */
  readonly blockedReason: string | null;
}

export interface KrsEnrolledClassView {
  readonly classId: string;
  readonly courseCode: string;
  readonly courseName: string;
  readonly className: string;
  readonly sks: number;
  readonly status: string;
  readonly schedules: readonly KrsClassScheduleView[];
}

export interface KrsScreenData {
  /** null bila akun tidak tertaut profil mahasiswa (DPA/admin melihat keadaan kosong). */
  readonly identity: KrsScreenIdentity | null;
  readonly period: KrsScreenPeriod | null;
  readonly quota: KrsScreenQuota | null;
  readonly enrolled: readonly KrsEnrolledClassView[];
  readonly usedSks: number;
  readonly classes: readonly KrsOpenClassView[];
  readonly totalClasses: number;
  /** true bila masih ada kelas terbuka di luar `KRS_SCREEN_CLASS_LIMIT` pertama. */
  readonly truncated: boolean;
}

export type KrsScreenResult =
  | { readonly ok: true; readonly data: KrsScreenData }
  | { readonly ok: false; readonly message: string };

function periodLabel(term: string, yearLabel: string): string {
  const id = term === 'GANJIL' ? 'Ganjil' : term === 'GENAP' ? 'Genap' : 'Antara';
  return `Semester ${id} ${yearLabel}`;
}

/**
 * Muat seluruh keadaan layar KRS dalam satu transaksi baca untuk server
 * component `/academic/krs`. Kegagalan DB dikembalikan sebagai `{ ok: false }`
 * supaya layar menampilkan keadaan error, bukan crash.
 */
export async function loadKrsScreen(tenantId: string, userId: string): Promise<KrsScreenResult> {
  try {
    const data = await withTenantContext<KrsScreenData>(tenantId, async (tx) => {
      const period = await openPeriod(tx, tenantId);
      const student = await studentOf(tx, tenantId, userId);

      const periodView: KrsScreenPeriod | null = period
        ? {
            id: period.id,
            label: periodLabel(period.term, period.yearLabel),
            status: period.status,
            endsOn: period.endsOn,
          }
        : null;
      const identityView: KrsScreenIdentity | null = student
        ? {
            nim: student.nim,
            fullName: student.fullName,
            programName: student.programName,
            status: student.status,
          }
        : null;

      // Tanpa periode ATAU tanpa baris mahasiswa tidak ada yang bisa dihitung:
      // layar tetap tampil, kosong, dengan sebab yang dijelaskan di halaman.
      if (!period || !student) {
        return {
          identity: identityView,
          period: periodView,
          quota: null,
          enrolled: [],
          usedSks: 0,
          classes: [],
          totalClasses: 0,
          truncated: false,
        };
      }

      const periodId = period.id;
      const enrolled = await enrolledRowsOf(tx, tenantId, student.id, periodId);
      const enrolledIds = new Set(enrolled.map((row) => row.classId));
      const enrolledScheduleRows = await schedulesOf(tx, tenantId, [...enrolledIds]);
      const enrolledSchedules = groupByClass(enrolledScheduleRows);

      const enrolledViews: KrsEnrolledClassView[] = enrolled.map((row) => ({
        classId: row.classId,
        courseCode: row.courseCode,
        courseName: row.courseName,
        className: row.className,
        sks: Number(row.sks),
        status: row.status,
        schedules: toScheduleViews(enrolledSchedules.get(row.classId) ?? []),
      }));

      // ── Plafon SKS nyata — validator yang sama dengan jalur tulis ──
      const capRows = await tx
        .select({
          lower: studyPrograms.sksCapLowerSemesters,
          upper: studyPrograms.sksCapUpperSemesters,
          between: studyPrograms.sksCapBetweenTerm,
        })
        .from(studyPrograms)
        .where(eq(studyPrograms.id, student.programId))
        .limit(1);
      const cap = capRows[0];
      const programConfig: ProgramSksConfig = {
        sksCapLowerSemesters: cap ? Number(cap.lower) : 20,
        sksCapUpperSemesters: cap ? Number(cap.upper) : 24,
        sksCapBetweenTerm: cap ? Number(cap.between) : 9,
      };

      const usedRows = await tx
        .select({ sks: courses.sks })
        .from(enrollments)
        .innerJoin(classes, eq(classes.id, enrollments.classId))
        .innerJoin(courses, eq(courses.id, classes.courseId))
        .where(
          and(
            eq(enrollments.tenantId, tenantId),
            eq(enrollments.studentId, student.id),
            eq(enrollments.periodId, periodId),
            inArray(enrollments.status, [...ACTIVE_ENROLLMENT_STATUSES]),
          ),
        );
      const usedSks = usedRows.reduce((total, row) => total + Number(row.sks), 0);

      const lastIps = await lastPeriodIps(tx, tenantId, student.id, periodId);
      const yearFromLabel = Number.parseInt(period.yearLabel.slice(0, 4), 10);
      const currentYear = Number.isNaN(yearFromLabel) ? new Date().getFullYear() : yearFromLabel;
      const studentContext: StudentContext = {
        status: student.status,
        currentSemester: calculateCurrentSemester(student.entryYear, currentYear, period.term),
        lastIps,
        periodTerm: period.term,
        currentPeriodSks: usedSks,
      };
      const quotaResult = validateSksQuota(studentContext, programConfig, 0);

      const assembled = await assembleOpenClasses(tx, tenantId, student, periodId, {
        periodId,
        page: 1,
        limit: KRS_SCREEN_CLASS_LIMIT,
      });

      const quota: KrsScreenQuota = {
        maxAllowedSks: quotaResult.maxAllowedSks,
        usedSks: quotaResult.usedSks,
        remainingSks: Math.max(0, quotaResult.remainingSks),
        blockedReason: quotaResult.isValid ? null : quotaResult.message,
      };

      return {
        identity: identityView,
        period: periodView,
        quota,
        enrolled: enrolledViews,
        usedSks,
        classes: assembled.items,
        totalClasses: assembled.totalRecords,
        truncated: assembled.totalRecords > assembled.items.length,
      };
    });

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Basis data tidak dapat dihubungi.',
    };
  }
}
