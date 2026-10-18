/**
 * Automated Unit Tests — SICA Academic Business Rule Engine
 *
 * Menguji determinisme kalkulasi IPK/IPS, penegakan kuota batas SKS (BR-A2),
 * dan matriks deteksi bentrok jadwal perkuliahan (BR-A4).
 *
 * Catatan arsitek: test ini diselaraskan dengan API nyata service yang diekspor
 * (`resolveIpsThreshold`, `validateSksQuota`, `intervalsOverlap`, `detectAllConflicts`).
 * Versi sebelumnya meng-import simbol fiktif (`determineMaxSksByIps`, `detectTimeOverlap`,
 * `detectScheduleConflicts`, `ScheduleItem`) sehingga tidak pernah bisa dikompilasi/dijalankan.
 */
import { describe, it, expect } from 'vitest';
import {
  roundHalfUp,
  calculateIps,
  calculateIpk,
  filterEligibleEntries,
  type GradeEntry,
} from '../../src/modules/academic/services/gpa-calculator.service';
import {
  resolveIpsThreshold,
  validateSksQuota,
  validateBatchEnrollment,
  type ProgramSksConfig,
  type StudentContext,
} from '../../src/modules/academic/services/sks-quota-validator.service';
import {
  timeToMinutes,
  intervalsOverlap,
  detectAllConflicts,
  type ScheduleSlot,
} from '../../src/modules/academic/services/schedule-conflict-detector.service';

describe('GPA Calculator Determinism (BR-A1 & BR-A2)', () => {
  it('harus melakukan pembulatan Half-Up deterministik ke 2 desimal', () => {
    // 2.345 -> 2.35 (bukan 2.34 yang biasa terjadi pada banker's rounding)
    expect(roundHalfUp(2.345)).toBe(2.35);
    expect(roundHalfUp(2.344)).toBe(2.34);
    expect(roundHalfUp(3.999)).toBe(4.0);
    expect(roundHalfUp(0)).toBe(0);
    expect(roundHalfUp(NaN)).toBe(0);
  });

  it('harus mengabaikan enrollment yang tidak berstatus EFFECTIVE atau belum memiliki nilai', () => {
    const rawEntries: GradeEntry[] = [
      {
        enrollmentId: 'e-1',
        courseId: 'c-1',
        courseCode: 'IF-101',
        courseName: 'Dasar Pemrograman',
        sks: 3,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'p-1',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: 'e-2',
        courseId: 'c-2',
        courseCode: 'IF-102',
        courseName: 'Kalkulus 1',
        sks: 3,
        letterCode: null,
        pointValue: null,
        isPassing: false,
        periodId: 'p-1',
        enrollmentStatus: 'EFFECTIVE', // Nilai kosong -> abaikan
      },
      {
        enrollmentId: 'e-3',
        courseId: 'c-3',
        courseCode: 'IF-103',
        courseName: 'Matematika Diskrit',
        sks: 3,
        letterCode: 'B',
        pointValue: 3.0,
        isPassing: true,
        periodId: 'p-1',
        enrollmentStatus: 'WITHDRAWN', // Dibatalkan -> abaikan
      },
    ];

    const eligible = filterEligibleEntries(rawEntries);
    expect(eligible.length).toBe(1);
    expect(eligible[0]?.courseCode).toBe('IF-101');
  });

  it('harus menghitung IPS semester dengan bobot SKS yang benar', () => {
    const periodId = 'period-2025-ganjil';
    const entries: GradeEntry[] = [
      {
        enrollmentId: 'e-1',
        courseId: 'c-1',
        courseCode: 'IF-201',
        courseName: 'Struktur Data',
        sks: 4,
        letterCode: 'A',
        pointValue: 4.0, // mutu = 16
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: 'e-2',
        courseId: 'c-2',
        courseCode: 'IF-202',
        courseName: 'Basis Data',
        sks: 3,
        letterCode: 'B+',
        pointValue: 3.5, // mutu = 10.5
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: 'e-3',
        courseId: 'c-3',
        courseCode: 'IF-203',
        courseName: 'Jaringan Komputer',
        sks: 3,
        letterCode: 'B',
        pointValue: 3.0, // mutu = 9.0
        isPassing: true,
        periodId,
        enrollmentStatus: 'EFFECTIVE',
      },
    ];
    // Total SKS = 10, Total Mutu = 16 + 10.5 + 9.0 = 35.5
    // IPS = 35.5 / 10 = 3.55

    const result = calculateIps(entries, periodId);
    expect(result.ips).toBe(3.55);
    expect(result.totalSks).toBe(10);
    expect(result.passedSks).toBe(10);
    expect(result.courseCount).toBe(3);
  });

  it('harus menghitung IPK kumulatif lintas periode dengan benar', () => {
    const entries: GradeEntry[] = [
      {
        enrollmentId: 'e-1',
        courseId: 'c-1',
        courseCode: 'IF-101',
        courseName: 'Pemrograman 1',
        sks: 4,
        letterCode: 'A',
        pointValue: 4.0,
        isPassing: true,
        periodId: 'sem-1',
        enrollmentStatus: 'EFFECTIVE',
      },
      {
        enrollmentId: 'e-2',
        courseId: 'c-2',
        courseCode: 'IF-102',
        courseName: 'Pemrograman 2',
        sks: 4,
        letterCode: 'B',
        pointValue: 3.0,
        isPassing: true,
        periodId: 'sem-2',
        enrollmentStatus: 'EFFECTIVE',
      },
    ];
    // Total SKS = 8, Total Mutu = 28.0 -> IPK = 28 / 8 = 3.50

    const cumulative = calculateIpk(entries);
    expect(cumulative.ipk).toBe(3.5);
    expect(cumulative.totalSks).toBe(8);
    expect(cumulative.semesters.length).toBe(2);
  });
});

describe('SKS Quota Validation Rules (BR-R2 & BR-A2)', () => {
  const config: ProgramSksConfig = {
    sksCapLowerSemesters: 20,
    sksCapUpperSemesters: 24,
    sksCapBetweenTerm: 9,
  };

  const makeStudent = (overrides: Partial<StudentContext>): StudentContext => ({
    status: 'ACTIVE',
    currentSemester: 3,
    lastIps: 3.0,
    periodTerm: 'GANJIL',
    currentPeriodSks: 0,
    ...overrides,
  });

  it('mahasiswa semester 1 & 2 dibatasi cap bawah prodi (20 SKS)', () => {
    const sem1 = validateSksQuota(makeStudent({ currentSemester: 1, lastIps: null }), config);
    expect(sem1.maxAllowedSks).toBe(20);

    const sem2 = validateSksQuota(makeStudent({ currentSemester: 2, lastIps: 3.9 }), config);
    expect(sem2.maxAllowedSks).toBe(20);
  });

  it('semester antara (ANTAR) dibatasi mutlak maksimal 9 SKS (BR-A3)', () => {
    const antara = validateSksQuota(
      makeStudent({ currentSemester: 5, periodTerm: 'ANTAR', lastIps: 4.0 }),
      config
    );
    expect(antara.maxAllowedSks).toBe(9);
  });

  it('semester 3 ke atas mengadopsi band IPS default (BR-A2)', () => {
    // Band: >=3.00 -> 24 | >=2.50 -> 21 | >=2.00 -> 18 | <2.00 -> 15
    expect(resolveIpsThreshold(3.8, config).maxSks).toBe(24);
    expect(resolveIpsThreshold(3.0, config).maxSks).toBe(24);
    expect(resolveIpsThreshold(2.7, config).maxSks).toBe(21);
    expect(resolveIpsThreshold(2.2, config).maxSks).toBe(18);
    expect(resolveIpsThreshold(1.8, config).maxSks).toBe(15);
  });

  it('harus menolak rencana studi jika total SKS melampaui kuota izin', () => {
    // Mahasiswa sem 3 dengan IPS 2.7 -> band >=2.50 -> cap 21 SKS. Mengajukan 24 SKS -> DITOLAK.
    const validation = validateSksQuota(makeStudent({ currentSemester: 3, lastIps: 2.7 }), config, 24);
    expect(validation.isValid).toBe(false);
    expect(validation.errorCode).toBe('SKS_QUOTA_EXCEEDED');
    expect(validation.maxAllowedSks).toBe(21);
  });

  it('harus menolak mahasiswa non-ACTIVE (mis. CUTI/ON_LEAVE) mengambil KRS (BR-A4 status)', () => {
    const validation = validateSksQuota(makeStudent({ status: 'ON_LEAVE' }), config, 3);
    expect(validation.isValid).toBe(false);
    expect(validation.errorCode).toBe('STUDENT_NOT_ACTIVE');
  });

  it('validasi batch mengakumulasikan seluruh SKS mata kuliah', () => {
    // cap 24 (IPS 3.8), ajukan 3 kelas @8 SKS = 24 -> pas di batas (valid)
    const ok = validateBatchEnrollment(makeStudent({ lastIps: 3.8 }), config, [8, 8, 8]);
    expect(ok.isValid).toBe(true);
    // ajukan total 27 -> melebihi (invalid)
    const over = validateBatchEnrollment(makeStudent({ lastIps: 3.8 }), config, [9, 9, 9]);
    expect(over.isValid).toBe(false);
  });
});

describe('Schedule Collision Detection Matrix (BR-A4)', () => {
  it('harus mendeteksi tumpang tindih waktu (interval half-open)', () => {
    // 08:00-10:30 bentrok dengan 09:30-11:30
    expect(
      intervalsOverlap(
        timeToMinutes('08:00'),
        timeToMinutes('10:30'),
        timeToMinutes('09:30'),
        timeToMinutes('11:30')
      )
    ).toBe(true);

    // back-to-back 08:00-10:00 vs 10:00-12:00 TIDAK bentrok (end exclusive)
    expect(
      intervalsOverlap(
        timeToMinutes('08:00'),
        timeToMinutes('10:00'),
        timeToMinutes('10:00'),
        timeToMinutes('12:00')
      )
    ).toBe(false);

    // 08:00-10:00 vs 13:00-15:00 TIDAK bentrok
    expect(
      intervalsOverlap(
        timeToMinutes('08:00'),
        timeToMinutes('10:00'),
        timeToMinutes('13:00'),
        timeToMinutes('15:00')
      )
    ).toBe(false);
  });

  it('harus mendeteksi bentrok ruangan pada hari & waktu yang tumpang tindih', () => {
    const slots: ScheduleSlot[] = [
      {
        scheduleId: 'sch-1',
        classId: 'cls-1',
        className: 'IF-A',
        roomId: 'room-101',
        roomCode: 'R.101',
        dayOfWeek: 1, // Senin
        startTime: '08:00',
        endTime: '10:30',
        lecturerIds: ['dosen-budi'],
        periodId: 'p-1',
      },
      {
        scheduleId: 'sch-2',
        classId: 'cls-2',
        className: 'IF-B',
        roomId: 'room-101', // ruangan sama, waktu tumpang tindih
        roomCode: 'R.101',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '11:00',
        lecturerIds: ['dosen-siti'],
        periodId: 'p-1',
      },
    ];

    const result = detectAllConflicts(slots);
    expect(result.hasConflicts).toBe(true);
    expect(result.totalConflicts).toBeGreaterThan(0);
    expect(result.roomConflicts[0]?.type).toBe('ROOM');
    expect(result.roomConflicts[0]?.slotA.roomCode).toBe('R.101');
  });
});
