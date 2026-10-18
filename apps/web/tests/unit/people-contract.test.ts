/**
 * Unit test — kontrak Zod biodata mahasiswa & dosen (parity dgn schema Drizzle §11.2–11.3).
 */
import { describe, it, expect } from 'vitest';
import { StudentBiodataSchema, LecturerSchema } from '@sica/contracts';

const V4 = '9c858901-8a57-4791-81fe-4c455b099bc9';

describe('StudentBiodataSchema', () => {
  it('menerima payload minimal & menerapkan default feeder', () => {
    const res = StudentBiodataSchema.safeParse({
      nim: '2026100001',
      fullName: 'Budi Perkasa',
      programId: V4,
      entryYear: 2026,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe('ACTIVE');
      expect(res.data.citizenship).toBe('WNI');
      expect(res.data.feederStatusCode).toBe('1');
    }
  });

  it('menolak nim terlalu pendek & email malform', () => {
    expect(
      StudentBiodataSchema.safeParse({ nim: '12', fullName: 'X', programId: V4, entryYear: 2026 })
        .success
    ).toBe(false);
    expect(
      StudentBiodataSchema.safeParse({
        nim: '2026100001',
        fullName: 'Budi Perkasa',
        programId: V4,
        entryYear: 2026,
        personalEmail: 'bukan-email',
      }).success
    ).toBe(false);
  });

  it('menolak programId non-uuid, menerima field nullish', () => {
    expect(
      StudentBiodataSchema.safeParse({
        nim: '2026100001',
        fullName: 'Budi',
        programId: 'nope',
        entryYear: 2026,
      }).success
    ).toBe(false);
    expect(
      StudentBiodataSchema.safeParse({
        nim: '2026100001',
        fullName: 'Budi Perkasa',
        programId: V4,
        entryYear: 2026,
        sex: 'M',
        birthDate: '2005-01-02',
        pddiktiIdPpd: null,
      }).success
    ).toBe(true);
  });
});

describe('LecturerSchema', () => {
  it('default rank & employment saat hanya membershipId diisi', () => {
    const res = LecturerSchema.safeParse({ membershipId: V4 });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.academicRank).toBe('NONE');
      expect(res.data.employmentType).toBe('DOSEN_TETAP_YAYASAN');
      expect(res.data.isPrimaryLecturer).toBe(true);
    }
  });
  it('menolak academicRank tak dikenal', () => {
    expect(
      LecturerSchema.safeParse({ membershipId: V4, academicRank: 'GURU_BESARR' }).success
    ).toBe(false);
  });
});
