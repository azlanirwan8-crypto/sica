/**
 * Seed DEV data akademik untuk tenant 'demo' — menutup dashboard/mock page dengan
 * data nyata supaya alur per-role (mahasiswa/dosen/admin) bisa diuji end-to-end.
 *
 * Idempoten: memakai UUID deterministik (nama → uuidv5) + onConflictDoNothing,
 * aman dijalankan berulang dan menghasilkan baris yang sama di DB mana pun.
 *
 * Cakupan: tahun/periode akademik, prodi + kurikulum, matakuliah (pecah SKS teori/
 * praktik), ruang, kelas + jadwal + sesi (termasuk sesi hari ini), profil mahasiswa &
 * dosen, enrollments periode lampau (EFFECTIVE) dengan nilai LOCKED (basis IPK),
 * KRS periode aktif (SUBMITTED), dan presensi untuk menghitung persentase kehadiran.
 *
 * Jalankan: pnpm --filter @sica/web seed:academic  (setelah seed:dev)
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // uuidv5 namespace DNS

/** Deterministik UUID v4-shaped dari nama (cukup untuk seed; bukan kriptografis). */
function did(name: string): string {
  const h = createHash('sha1').update(NAMESPACE + name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Hari ini yang di-shift ke Senin agar jadwal "hari ini" selalu teruji. */
function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const day = d.getDay(); // 0=Minggu
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

async function main() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    const k = m?.[1];
    const v = m?.[2];
    if (k && v !== undefined && process.env[k] === undefined) process.env[k] = v.replace(/^"|"$/g, '');
  }

  const dbMod = await import('@sica/database');
  const {
    db, withTenantContext, eq,
    tenants, tenantMemberships,
    academicYears, academicPeriods, studyPrograms, curricula, courses, rooms,
    classes, classSessions, classSchedules, classAssignments,
    students, lecturers, enrollments, grades, attendances,
  } = dbMod;

  const TENANT = 'demo';

  const tenantRows = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, TENANT)).limit(1);
  const tenantId = (tenantRows[0] as { id: string } | undefined)?.id;
  if (!tenantId) throw new Error(`Tenant '${TENANT}' belum ada. Jalankan seed:dev lebih dulu.`);

  const membershipIdByCode = async (memberCode: string): Promise<string> => {
    const rows = await withTenantContext(tenantId, async (tx) =>
      tx.select({ id: tenantMemberships.id, userId: tenantMemberships.userId })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.memberCode, memberCode))
        .limit(1),
    );
    const r = rows[0] as { id: string; userId: string } | undefined;
    if (!r) throw new Error(`Membership '${memberCode}' tidak ditemukan (jalankan seed:dev).`);
    return r.id;
  };

  const today = new Date();
  const mon = mondayOfWeek(today);
  const todayIso = iso(today);
  const monIso = iso(mon);

  // ── Tahun & periode akademik ───────────────────────────────────────────────
  const yearPrev = did('year|2025/2026');
  const yearCurr = did('year|2026/2027');
  const pGanjil2526 = did('period|2025/2026|GANJIL');
  const pGenap2526 = did('period|2025/2026|GENAP');
  const pGanjil2627 = did('period|2026/2027|GANJIL');

  // ── Prodi, kurikulum, matakuliah, ruang ────────────────────────────────────
  const progIf = did('program|IF|S1');
  const kur24 = did('curriculum|IF|2024');
  const kur26 = did('curriculum|IF|2026');

  type CourseSeed = { key: string; code: string; name: string; sks: number; teori: number; praktik: number; type: 'TEORI' | 'PRAKTIKUM'; semester: number; curriculum: string };
  const courseSeeds: CourseSeed[] = [
    { key: 'IF1101', code: 'IF1101', name: 'Algoritma & Struktur Data', sks: 3, teori: 2, praktik: 1, type: 'PRAKTIKUM', semester: 1, curriculum: kur24 },
    { key: 'IF1102', code: 'IF1102', name: 'Matematika Diskrit', sks: 3, teori: 3, praktik: 0, type: 'TEORI', semester: 1, curriculum: kur24 },
    { key: 'IF1103', code: 'IF1103', name: 'Pemrograman Dasar', sks: 4, teori: 2, praktik: 2, type: 'PRAKTIKUM', semester: 1, curriculum: kur24 },
    { key: 'IF2201', code: 'IF2201', name: 'Struktur Data Lanjut', sks: 3, teori: 2, praktik: 1, type: 'PRAKTIKUM', semester: 2, curriculum: kur24 },
    { key: 'IF2202', code: 'IF2202', name: 'Sistem Operasi', sks: 3, teori: 3, praktik: 0, type: 'TEORI', semester: 2, curriculum: kur24 },
    { key: 'IF2203', code: 'IF2203', name: 'Pemrograman Web', sks: 3, teori: 1, praktik: 2, type: 'PRAKTIKUM', semester: 2, curriculum: kur24 },
    { key: 'IF3301', code: 'IF3301', name: 'Jaringan Komputer', sks: 3, teori: 2, praktik: 1, type: 'PRAKTIKUM', semester: 3, curriculum: kur24 },
    { key: 'IF3302', code: 'IF3302', name: 'Rekayasa Perangkat Lunak', sks: 3, teori: 3, praktik: 0, type: 'TEORI', semester: 3, curriculum: kur24 },
    { key: 'IF3303', code: 'IF3303', name: 'Basis Data', sks: 4, teori: 2, praktik: 2, type: 'PRAKTIKUM', semester: 3, curriculum: kur24 },
    { key: 'IF3201', code: 'IF3201', name: 'Rekayasa Perangkat Lunak Lanjut', sks: 3, teori: 3, praktik: 0, type: 'TEORI', semester: 5, curriculum: kur26 },
    { key: 'IF3204', code: 'IF3204', name: 'Basis Data Terdistribusi', sks: 3, teori: 1, praktik: 2, type: 'PRAKTIKUM', semester: 5, curriculum: kur26 },
    { key: 'IF3208', code: 'IF3208', name: 'Keamanan Siber & Kriptografi', sks: 3, teori: 3, praktik: 0, type: 'TEORI', semester: 5, curriculum: kur26 },
    { key: 'IF3210', code: 'IF3210', name: 'Machine Learning Terapan', sks: 3, teori: 1, praktik: 2, type: 'PRAKTIKUM', semester: 5, curriculum: kur26 },
  ];

  const roomSeeds = [
    { code: 'RT302', name: 'Ruang Teori 302', building: 'Gedung Fakultas Teknik', capacity: 40, type: 'CLASSROOM' },
    { code: 'LKA', name: 'Lab Komputasi A', building: 'Gedung Laboratorium', capacity: 30, type: 'LAB' },
    { code: 'RS101', name: 'Ruang Seminar 101', building: 'Gedung Fakultas Teknik', capacity: 60, type: 'CLASSROOM' },
  ];

  // ── Kelas periode aktif + periode lampau ───────────────────────────────────
  type ClassSeed = { key: string; courseKey: string; period: string; name: string; capacity: number; roomCode: string; day: number; start: string; end: string };
  const currClassSeeds: ClassSeed[] = [
    { key: 'IF3201-A', courseKey: 'IF3201', period: pGanjil2627, name: 'Kelas A', capacity: 36, roomCode: 'RT302', day: 1, start: '08:00', end: '09:40' },
    { key: 'IF3204-A', courseKey: 'IF3204', period: pGanjil2627, name: 'Kelas A', capacity: 30, roomCode: 'LKA', day: 1, start: '10:00', end: '12:30' },
    { key: 'IF3208-A', courseKey: 'IF3208', period: pGanjil2627, name: 'Kelas A', capacity: 40, roomCode: 'RS101', day: 1, start: '13:30', end: '15:10' },
    { key: 'IF3210-A', courseKey: 'IF3210', period: pGanjil2627, name: 'Kelas A', capacity: 24, roomCode: 'LKA', day: 3, start: '08:00', end: '10:30' },
  ];

  // Nilai periode lampau: (courseKey, letter, point) — 9 matakuliah, total 29 SKS.
  const pastGrades: Array<{ courseKey: string; period: string; letter: string; point: number; raw: number }> = [
    { courseKey: 'IF1101', period: pGanjil2526, letter: 'A', point: 4.0, raw: 88 },
    { courseKey: 'IF1102', period: pGanjil2526, letter: 'B+', point: 3.5, raw: 82 },
    { courseKey: 'IF1103', period: pGanjil2526, letter: 'A', point: 4.0, raw: 86 },
    { courseKey: 'IF2201', period: pGanjil2526, letter: 'A', point: 4.0, raw: 89 },
    { courseKey: 'IF3303', period: pGanjil2526, letter: 'A', point: 4.0, raw: 84 },
    { courseKey: 'IF2202', period: pGenap2526, letter: 'B+', point: 3.5, raw: 81 },
    { courseKey: 'IF2203', period: pGenap2526, letter: 'B', point: 3.0, raw: 78 },
    { courseKey: 'IF3301', period: pGenap2526, letter: 'A', point: 4.0, raw: 87 },
    { courseKey: 'IF3302', period: pGenap2526, letter: 'B+', point: 3.5, raw: 80 },
  ];

  console.log('🌱 Seed DEV akademik (tenant demo)…');

  await withTenantContext(tenantId, async (tx) => {
    // Tahun akademik
    for (const [id, label] of [[yearPrev, '2025/2026'], [yearCurr, '2026/2027']] as const) {
      await tx.insert(academicYears).values({ id, tenantId, label }).onConflictDoNothing();
    }
    // Periode: Ganjil 26/27 OPEN (aktif), dua periode sebelumnya CLOSED
    await tx.insert(academicPeriods)
      .values([
        { id: pGanjil2526, tenantId, academicYearId: yearPrev, term: 'GANJIL', status: 'CLOSED', startsOn: '2025-08-18', endsOn: '2025-12-20' },
        { id: pGenap2526, tenantId, academicYearId: yearPrev, term: 'GENAP', status: 'CLOSED', startsOn: '2026-02-02', endsOn: '2026-06-20' },
        { id: pGanjil2627, tenantId, academicYearId: yearCurr, term: 'GANJIL', status: 'OPEN', startsOn: '2026-08-17', endsOn: '2026-12-19' },
      ])
      .onConflictDoNothing();

    // Program studi
    await tx.insert(studyPrograms)
      .values({
        id: progIf, tenantId, name: 'S1 Teknik Informatika', code: 'IF', pddiktiCode: '20110001',
        level: 'S1', minTotalSks: '144.0', nominalStudySemesters: 8, maxStudySemesters: 14,
        sksCapLowerSemesters: '20.0', sksCapUpperSemesters: '24.0', sksCapBetweenTerm: '9.0',
        accreditationStatus: 'UNGGUL', isActive: true,
      })
      .onConflictDoNothing();

    // Kurikulum
    await tx.insert(curricula)
      .values([
        { id: kur24, tenantId, programId: progIf, name: 'Kurikulum IF 2024', version: 1, effectiveFrom: '2024-08-01', isActive: false },
        { id: kur26, tenantId, programId: progIf, name: 'Kurikulum IF 2026', version: 2, effectiveFrom: '2026-08-01', isActive: true },
      ])
      .onConflictDoNothing();

    // Matakuliah (pecah SKS teori/praktik)
    for (const c of courseSeeds) {
      await tx.insert(courses)
        .values({
          id: did(`course|${c.code}`), tenantId, curriculumId: c.curriculum, code: c.code, name: c.name,
          sks: c.sks.toFixed(1), sksTeori: c.teori.toFixed(1), sksPraktik: c.praktik.toFixed(1),
          courseType: c.type, semesterIdeal: c.semester,
        })
        .onConflictDoNothing();
    }

    // Ruang
    for (const r of roomSeeds) {
      await tx.insert(rooms)
        .values({ id: did(`room|${r.code}`), tenantId, code: r.code, name: r.name, building: r.building, capacity: r.capacity, roomType: r.type, facilities: [], isActive: true })
        .onConflictDoNothing();
    }
  });

  // ── Kelas + jadwal + sesi ──────────────────────────────────────────────────
  const classIdFor = (key: string) => did(`class|${key}`);

  await withTenantContext(tenantId, async (tx) => {
    for (const c of currClassSeeds) {
      const classId = classIdFor(c.key);
      await tx.insert(classes)
        .values({
          id: classId, tenantId, programId: progIf, periodId: c.period,
          courseId: did(`course|${c.courseKey}`), name: c.name, capacity: c.capacity,
          enrolledCount: 0, status: 'OPEN', deliveryMode: 'ONSITE',
        })
        .onConflictDoNothing();

      await tx.insert(classSchedules)
        .values({
          id: did(`sched|${c.key}`), tenantId, classId, roomId: did(`room|${c.roomCode}`),
          dayOfWeek: c.day, startTime: `${c.start}:00`, endTime: `${c.end}:00`,
        })
        .onConflictDoNothing();
    }

    // Sesi kuliah: 4 pertemuan lalu (2 sesi terakhir dipakai utk presensi) + sesi hari ini.
    const sessionRows: Array<{ id: string; classId: string; heldOn: string; seq: number; topic: string; open: boolean }> = [];
    for (const c of currClassSeeds) {
      const classId = classIdFor(c.key);
      for (let seq = 1; seq <= 4; seq++) {
        const d = new Date(mon);
        d.setDate(d.getDate() - 7 * (4 - seq));
        sessionRows.push({ id: did(`session|${c.key}|${seq}`), classId, heldOn: iso(d), seq, topic: `Pertemuan ${seq}`, open: false });
      }
      // Sesi hari ini (pertemuan 5) pada hari Senin — jadi "jadwal hari ini".
      sessionRows.push({ id: did(`session|${c.key}|5`), classId, heldOn: monIso, seq: 5, topic: 'Pertemuan 5', open: true });
    }
    for (const s of sessionRows) {
      await tx.insert(classSessions)
        .values({ id: s.id, tenantId, classId: s.classId, heldOn: s.heldOn, seq: s.seq, topic: s.topic, deliveryType: 'ONSITE', isAttendanceOpen: s.open })
        .onConflictDoNothing();
    }
  });

  // ── Profil mahasiswa & dosen ───────────────────────────────────────────────
  const mhsMembership = await membershipIdByCode('2201010045');
  const dosenMembership = await membershipIdByCode('NIDN9001');
  const studentId = did('student|2201010045');
  const lecturerId = did('lecturer|NIDN9001');

  await withTenantContext(tenantId, async (tx) => {
    await tx.insert(students)
      .values({
        id: studentId, tenantId, membershipId: mhsMembership, programId: progIf, curriculumId: kur24,
        nim: '2201010045', fullName: 'Ahmad Rizky Pratama', entryYear: 2022, entryRoute: 'SNBT',
        status: 'ACTIVE', sex: 'M', birthPlace: 'Bandung', birthDate: '2004-03-14',
        citizenship: 'WNI', religion: 'ISLAM', childOrder: 1, fundingSource: 'MANDIRI',
        personalEmail: 'ahmad.rizky@student.demo.ac.id', mobilePhone: '081200000045', feederStatusCode: '1',
      })
      .onConflictDoNothing();

    await tx.insert(lecturers)
      .values({
        id: lecturerId, tenantId, membershipId: dosenMembership, programId: progIf,
        nidn: '0412088501', code: 'NIDN9001', titlePrefix: 'Dr.Eng., Ir.', titleSuffix: 'M.T.',
        specialization: 'Rekayasa Perangkat Lunak', academicRank: 'LEKTOR_KEPALA',
        employmentType: 'PNS', isPrimaryLecturer: true, gender: 'M', officialEmail: 'dosen@demo.sica.test',
        lastDegreeCountry: 'ID', lastDegreeUniversity: 'ITB', lastDegreeYear: 2012, startServiceDate: '2013-09-01',
      })
      .onConflictDoNothing();

    // Dosen pengampu seluruh kelas aktif
    for (const c of currClassSeeds) {
      await tx.insert(classAssignments)
        .values({ id: did(`assign|${c.key}`), tenantId, classId: classIdFor(c.key), lecturerMembershipId: dosenMembership, roleInClass: 'LECTURER' })
        .onConflictDoNothing();
    }
  });

  // ── Enrollments periode lampau (EFFECTIVE) + nilai LOCKED ──────────────────
  await withTenantContext(tenantId, async (tx) => {
    for (const g of pastGrades) {
      const course = courseSeeds.find((c) => c.key === g.courseKey);
      if (!course) continue;
      const classKey = `${g.courseKey}-P`;
      const classId = did(`class|${classKey}`);
      await tx.insert(classes)
        .values({
          id: classId, tenantId, programId: progIf, periodId: g.period,
          courseId: did(`course|${g.courseKey}`), name: 'Kelas Paralel', capacity: 40,
          enrolledCount: 1, status: 'CLOSED', deliveryMode: 'ONSITE',
        })
        .onConflictDoNothing();

      const enrollmentId = did(`enroll|${studentId}|${classKey}`);
      await tx.insert(enrollments)
        .values({ id: enrollmentId, tenantId, studentId, classId, periodId: g.period, status: 'EFFECTIVE', submittedAt: new Date(), approvedBy: dosenMembership })
        .onConflictDoNothing();

      await tx.insert(grades)
        .values({ id: did(`grade|${enrollmentId}`), tenantId, enrollmentId, periodId: g.period, rawScore: g.raw.toFixed(2), letterCode: g.letter, pointValue: g.point.toFixed(2), status: 'LOCKED' })
        .onConflictDoUpdate({ target: grades.id, set: { rawScore: g.raw.toFixed(2), letterCode: g.letter, pointValue: g.point.toFixed(2) } });
    }
  });

  // ── KRS periode aktif (SUBMITTED) ──────────────────────────────────────────
  await withTenantContext(tenantId, async (tx) => {
    for (const c of currClassSeeds) {
      const enrollmentId = did(`enroll|${studentId}|${c.key}`);
      await tx.insert(enrollments)
        .values({ id: enrollmentId, tenantId, studentId, classId: classIdFor(c.key), periodId: pGanjil2627, status: 'SUBMITTED', submittedAt: new Date() })
        .onConflictDoNothing();
      await tx.update(classes)
        .set({ enrolledCount: 1 })
        .where(eq(classes.id, classIdFor(c.key)));
    }

    // Presensi: 8 sesi lampau (2 kelas terakhir) — 7 HADIR + 1 SAKIT → 87.5%.
    const presensiSeeds: Array<{ classKey: string; seq: number; status: 'PRESENT' | 'SICK' }> = [
      { classKey: 'IF3201-A', seq: 1, status: 'PRESENT' }, { classKey: 'IF3201-A', seq: 2, status: 'PRESENT' },
      { classKey: 'IF3201-A', seq: 3, status: 'PRESENT' }, { classKey: 'IF3201-A', seq: 4, status: 'SICK' },
      { classKey: 'IF3204-A', seq: 1, status: 'PRESENT' }, { classKey: 'IF3204-A', seq: 2, status: 'PRESENT' },
      { classKey: 'IF3204-A', seq: 3, status: 'PRESENT' }, { classKey: 'IF3204-A', seq: 4, status: 'PRESENT' },
    ];
    for (const p of presensiSeeds) {
      const sessionId = did(`session|${p.classKey}|${p.seq}`);
      await tx.insert(attendances)
        .values({
          id: did(`att|${sessionId}|${studentId}`), tenantId, sessionId, studentId,
          status: p.status, present: p.status === 'PRESENT', source: 'QR',
          markedAt: new Date(`${todayIso}T08:00:00Z`), distanceMeters: 12, latitude: -6.9175, longitude: 107.6191,
          notes: p.status === 'SICK' ? 'Surat dokter dilampirkan' : null,
        })
        .onConflictDoNothing();
    }
  });

  // Verifikasi ringkas hasil seed
  const summary = await withTenantContext(tenantId, async (tx) => {
    const enr = await tx.select({ id: enrollments.id }).from(enrollments);
    const grd = await tx.select({ id: grades.id }).from(grades);
    const att = await tx.select({ id: attendances.id }).from(attendances);
    const cls = await tx.select({ id: classes.id }).from(classes);
    return { classes: cls.length, enrollments: enr.length, grades: grd.length, attendances: att.length };
  });

  console.log(`📊 Hasil: ${summary.classes} kelas, ${summary.enrollments} enrollment, ${summary.grades} nilai, ${summary.attendances} presensi`);
  console.log(`   mahasiswa=${studentId} dosen=${lecturerId} periodeAktif=${pGanjil2627} sesiHariIni=${monIso}`);
  console.log('✅ SEED AKADEMIK SELESAI');
}

main().catch((e) => { console.error('❌ SEED AKADEMIK GAGAL:', (e as Error).message); process.exit(1); });
