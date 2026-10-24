/**
 * Unit tests — lingkup empat-mata (L4) untuk mesin perubahan hak (`R-2.1`).
 *
 * Yang diuji adalah KEBIJAKANNYA, bukan SQL: `coversScope` menerjemahkan norma
 * "penyetuju tidak boleh memberi hak lebih luas dari dirinya sendiri" menjadi
 * perbandingan kolom per kolom. Kegagalan di sini berarti salah satu dari dua
 * eskalasi jadi mungkin: admin prodi memberi hak ke prodi lain, atau admin scope
 * sempit menaikkan dirinya menjadi tenant-wide.
 */
import { describe, it, expect } from 'vitest';
import {
  computeEffectiveAccess,
  type PermissionGrant,
  type RawAssignment,
} from '../../src/modules/authz/rbac-resolver';
import { coversScope, holdsWithinScope } from '../../src/modules/identity/services/access-request.service';
import { PERM, type PermissionCode, type RoleCode } from '@sica/contracts';

const NOW = new Date('2026-10-23T00:00:00.000Z');
const PROGRAM_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const PROGRAM_B = 'bbbbbbbb-0000-4000-8000-000000000002';

const NO_SCOPE: RawAssignment['scope'] = {
  orgId: null,
  programId: null,
  classId: null,
  periodId: null,
  studentId: null,
};

function assignment(overrides: Partial<RawAssignment> = {}): RawAssignment {
  return {
    id: 'asn-1',
    roleCode: 'TENANT_ADMIN',
    scopeKind: 'TENANT',
    scope: NO_SCOPE,
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validTo: null,
    origin: 'GRANT',
    ...overrides,
  };
}

function grantsFor(codes: readonly PermissionCode[]): PermissionGrant[] {
  return codes.map((code) => ({ code, module: 'identity', resource: 'admin.hak-akses', verb: 'INSERT' }));
}

function access(assignments: readonly RawAssignment[], codes: readonly PermissionCode[]) {
  const byRole = new Map<RoleCode, readonly PermissionGrant[]>([['TENANT_ADMIN', grantsFor(codes)]]);
  return computeEffectiveAccess(assignments, byRole, NOW);
}

describe('coversScope — subset lingkup satu penugasan', () => {
  it('penugasan TENANT (semua kolom kosong) mencakup lingkup konkret apa pun', () => {
    expect(coversScope(NO_SCOPE, { programId: PROGRAM_A })).toBe(true);
    expect(coversScope(NO_SCOPE, { orgId: PROGRAM_A, classId: PROGRAM_B })).toBe(true);
    expect(coversScope(NO_SCOPE, {})).toBe(true);
  });

  it('penugasan ber-prodi hanya mencakup prodi itu sendiri', () => {
    const held = { ...NO_SCOPE, programId: PROGRAM_A };
    expect(coversScope(held, { programId: PROGRAM_A })).toBe(true);
    expect(coversScope(held, { programId: PROGRAM_B })).toBe(false);
  });

  it('permintaan TANPA batas dari aktor ber-scope sempit ditolak (lebih luas dari dirinya)', () => {
    const held = { ...NO_SCOPE, programId: PROGRAM_A };
    expect(coversScope(held, {})).toBe(false);
    expect(coversScope(held, { programId: undefined })).toBe(false);
  });

  it('setiap dimensi dibandingkan — prodi benar tapi kelas asing tetap ditolak', () => {
    const held = { ...NO_SCOPE, programId: PROGRAM_A, classId: 'class-of-a' };
    expect(coversScope(held, { programId: PROGRAM_A, classId: 'class-of-a' })).toBe(true);
    expect(coversScope(held, { programId: PROGRAM_A, classId: 'class-of-b' })).toBe(false);
  });
});

describe('holdsWithinScope — gerbang L4 mesin empat-mata', () => {
  const GRANT = [PERM.identityAssignmentGrant];

  it('izin tidak dipegang sama sekali → false walau lingkupnya cocok', () => {
    const a = access([assignment()], [PERM.identityUserView]);
    expect(holdsWithinScope(a, PERM.identityAssignmentGrant, {})).toBe(false);
  });

  it('izin dipegang tapi penugasan sudah kedaluwarsa → false (pencabutan berlaku sekarang)', () => {
    const a = access(
      [assignment({ validTo: new Date('2026-06-01T00:00:00.000Z') })],
      GRANT
    );
    expect(holdsWithinScope(a, PERM.identityAssignmentGrant, {})).toBe(false);
  });

  it('dua penugasan: yang tenant-wide menyelamatkan permintaan yang lebih luas', () => {
    const a = access(
      [
        assignment({ id: 'asn-narrow', scope: { ...NO_SCOPE, programId: PROGRAM_A } }),
        assignment({ id: 'asn-wide' }),
      ],
      GRANT
    );
    expect(holdsWithinScope(a, PERM.identityAssignmentGrant, { programId: PROGRAM_B })).toBe(true);
  });

  it('hanya penugasan sempit → hak tenant-wide tidak dapat diajukan', () => {
    const a = access([assignment({ scope: { ...NO_SCOPE, programId: PROGRAM_A } })], GRANT);
    expect(holdsWithinScope(a, PERM.identityAssignmentGrant, {})).toBe(false);
    expect(holdsWithinScope(a, PERM.identityAssignmentGrant, { programId: PROGRAM_A })).toBe(true);
  });

  it('permintaan perubahan komposisi peran (lingkup kosong) hanya untuk aktor tenant-wide', () => {
    const a = access([assignment({ scope: { ...NO_SCOPE, programId: PROGRAM_A } })], [PERM.identityRoleUpdate]);
    expect(holdsWithinScope(a, PERM.identityRoleUpdate, {})).toBe(false);
    const b = access([assignment()], [PERM.identityRoleUpdate]);
    expect(holdsWithinScope(b, PERM.identityRoleUpdate, {})).toBe(true);
  });
});
