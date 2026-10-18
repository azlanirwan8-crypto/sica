/**
 * Unit test — kontrak Zod presensi & SKS matakuliah (parity dgn schema Drizzle).
 */
import { describe, it, expect } from 'vitest';
import {
  AttendanceStatusSchema,
  AttendanceSourceSchema,
  MarkAttendanceSchema,
  CourseSksSchema,
} from '@sica/contracts';

const V4 = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('enum presensi', () => {
  it('menerima nilai valid & menolak nilai tak dikenal', () => {
    expect(AttendanceStatusSchema.parse('PRESENT')).toBe('PRESENT');
    expect(AttendanceSourceSchema.parse('GEOFENCE')).toBe('GEOFENCE');
    expect(AttendanceStatusSchema.safeParse('HALF_PRESENT').success).toBe(false);
  });
});

describe('MarkAttendanceSchema', () => {
  it('menerima payload lengkap dengan uuid & status', () => {
    const res = MarkAttendanceSchema.safeParse({
      sessionId: V4,
      studentId: V4,
      status: 'SICK',
      notes: 'Surat dokter terlampir',
    });
    expect(res.success).toBe(true);
  });
  it('menolak sessionId bukan uuid', () => {
    const res = MarkAttendanceSchema.safeParse({
      sessionId: 'bukan-uuid',
      studentId: V4,
      status: 'PRESENT',
    });
    expect(res.success).toBe(false);
  });
});

describe('CourseSksSchema (pemecahan SKS)', () => {
  const base = { code: 'IF101', name: 'Algoritma', sks: 3 };
  it('lolos saat teori+praktik == total', () => {
    expect(CourseSksSchema.safeParse({ ...base, sksTeori: 2, sksPraktik: 1 }).success).toBe(true);
  });
  it('lolos saat breakdown kosong (hanya total)', () => {
    expect(CourseSksSchema.safeParse(base).success).toBe(true);
  });
  it('tolak saat teori+praktik != total', () => {
    const res = CourseSksSchema.safeParse({ ...base, sksTeori: 2, sksPraktik: 2 });
    expect(res.success).toBe(false);
  });
});
