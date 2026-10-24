/**
 * Unit tests — RBAC berbasis tabel (Slice ADM-8): perakit akses efektif,
 * lingkup penugasan, dan gerbang `requireDataPrincipal`.
 *
 * Query DB tidak dijalankan di sini: `requireDataPrincipal` menerima pembaca
 * akses yang disuntik, jadi yang diuji adalah kebijakannya.
 */
import { describe, it, expect } from 'vitest';
import {
  computeEffectiveAccess,
  holdsScoped,
  isActiveWindow,
  type EffectiveAccess,
  type PermissionGrant,
  type RawAssignment,
} from '../../src/modules/authz/rbac-resolver';
import { requireDataPrincipal } from '../../src/modules/authz/rbac-repository';
import type { RequestContext } from '../../src/lib/api-response';
import { PERM, type PermissionCode, type RoleCode } from '@sica/contracts';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-19T00:00:00.000Z');

const NO_SCOPE: RawAssignment['scope'] = {
  orgId: null,
  programId: null,
  classId: null,
  periodId: null,
  studentId: null,
};

function assignment(overrides: Partial<RawAssignment> & { roleCode: string }): RawAssignment {
  return {
    id: 'a-1',
    scopeKind: 'TENANT',
    scope: NO_SCOPE,
    validFrom: new Date('2026-01-01T00:00:00.000Z'),
    validTo: null,
    origin: 'GRANT',
    ...overrides,
  };
}

function grant(code: PermissionCode, verb: PermissionGrant['verb'] = 'READ'): PermissionGrant {
  return { code, module: 'academic', resource: 'admin.pengguna', verb };
}

function ctx(role: string | null): RequestContext {
  return {
    requestId: 'req-test',
    timestamp: NOW.toISOString(),
    tenantId: role === null ? null : TENANT,
    userId: role === null ? null : USER,
    role,
    sessionId: 'sess-1',
    authenticated: role !== null,
  };
}

function emptyAccess(): EffectiveAccess {
  return { grants: [], roles: [], permissions: new Set<PermissionCode>() };
}

describe('computeEffectiveAccess — masa berlaku & katalog peran', () => {
  const grants = new Map<RoleCode, readonly PermissionGrant[]>([
    ['LECTURER', [grant(PERM.gradingValueWrite, 'UPDATE')]],
    ['ADVISER', [grant(PERM.enrollmentKrsApprove, 'VALIDATE')]],
  ]);

  it('menyertakan penugasan yang berlaku dan membuang yang kedaluwarsa', () => {
    const access = computeEffectiveAccess(
      [
        assignment({ roleCode: 'LECTURER' }),
        assignment({
          id: 'a-2',
          roleCode: 'ADVISER',
          validTo: new Date('2026-08-31T00:00:00.000Z'),
        }),
      ],
      grants,
      NOW
    );

    expect(access.roles).toEqual(['LECTURER']);
    expect(access.permissions.has(PERM.gradingValueWrite)).toBe(true);
    expect(access.permissions.has(PERM.enrollmentKrsApprove)).toBe(false);
  });

  it('membuang penugasan yang belum mulai berlaku', () => {
    const access = computeEffectiveAccess(
      [assignment({ roleCode: 'LECTURER', validFrom: new Date('2026-12-01T00:00:00.000Z') })],
      grants,
      NOW
    );
    expect(access.grants).toHaveLength(0);
    expect(access.permissions.size).toBe(0);
  });

  it('mengabaikan kode peran di luar katalog ROLE_CODES (fail-closed)', () => {
    const access = computeEffectiveAccess(
      [
        assignment({ roleCode: 'operator_magang_readonly' }),
        assignment({ id: 'a-2', roleCode: 'TENANT_ADMIN_READONLY' }),
      ],
      grants,
      NOW
    );
    expect(access.roles).toEqual([]);
    expect(access.permissions.size).toBe(0);
  });

  it('peran yang sah tetapi tidak punya grant tidak menyumbang izin', () => {
    const access = computeEffectiveAccess([assignment({ roleCode: 'TENANT_ADMIN' })], grants, NOW);
    expect(access.roles).toEqual(['TENANT_ADMIN']);
    expect(access.permissions.size).toBe(0);
  });

  it('menggabungkan izin dari beberapa penugasan tanpa duplikat', () => {
    const access = computeEffectiveAccess(
      [
        assignment({
          roleCode: 'LECTURER',
          scopeKind: 'CLASS',
          scope: { ...NO_SCOPE, classId: 'k-1' },
        }),
        assignment({
          id: 'a-2',
          roleCode: 'ADVISER',
          scopeKind: 'PERIOD',
          scope: { ...NO_SCOPE, periodId: 'p-1' },
        }),
      ],
      grants,
      NOW
    );
    expect(access.roles).toEqual(['LECTURER', 'ADVISER']);
    expect([...access.permissions]).toEqual([PERM.gradingValueWrite, PERM.enrollmentKrsApprove]);
    expect(access.grants[1]?.scope.periodId).toBe('p-1');
  });

  it('isActiveWindow menolak valid_to tepat sama dengan now', () => {
    expect(isActiveWindow(new Date('2026-01-01'), NOW, NOW)).toBe(false);
    expect(isActiveWindow(new Date('2026-01-01'), null, NOW)).toBe(true);
  });
});

describe('holdsScoped — lingkup penugasan ditegakkan', () => {
  const grants = new Map<RoleCode, readonly PermissionGrant[]>([
    ['LECTURER', [grant(PERM.gradingValueWrite, 'UPDATE')]],
  ]);
  const access = computeEffectiveAccess(
    [
      assignment({
        roleCode: 'LECTURER',
        scopeKind: 'CLASS',
        scope: { ...NO_SCOPE, classId: 'k-1' },
      }),
    ],
    grants,
    NOW
  );

  it('hanya memberi akses pada kelas yang ditugaskan', () => {
    expect(holdsScoped(access, PERM.gradingValueWrite, { classId: 'k-1' })).toBe(true);
    expect(holdsScoped(access, PERM.gradingValueWrite, { classId: 'k-2' })).toBe(false);
  });

  it('izin yang tidak di-grant tidak lolos apapun lingkupnya', () => {
    expect(holdsScoped(access, PERM.gradingUnlock, { classId: 'k-1' })).toBe(false);
  });

  it('tanpa argumen lingkup, cukup pegang izinnya', () => {
    expect(holdsScoped(access, PERM.gradingValueWrite)).toBe(true);
  });

  it('kolom lingkup dibandingkan apa adanya — null juga sebuah nilai', () => {
    // Penugasan kelas ini tidak memakai periode, jadi `{ periodId: null }` cocok,
    // sedangkan periode tertentu tidak. Sebaliknya, penugasan tenant-wide tidak
    // pernah dapat memenuhi kelas tertentu.
    expect(holdsScoped(access, PERM.gradingValueWrite, { periodId: null })).toBe(true);
    expect(holdsScoped(access, PERM.gradingValueWrite, { periodId: 'p-9' })).toBe(false);

    const tenantWide = computeEffectiveAccess([assignment({ roleCode: 'LECTURER' })], grants, NOW);
    expect(holdsScoped(tenantWide, PERM.gradingValueWrite, { periodId: null })).toBe(true);
    expect(holdsScoped(tenantWide, PERM.gradingValueWrite, { classId: 'k-1' })).toBe(false);
    expect(holdsScoped(tenantWide, PERM.gradingValueWrite, { classId: null })).toBe(true);
  });
});

describe('requireDataPrincipal — gerbang berbasis tabel', () => {
  const grants = new Map<RoleCode, readonly PermissionGrant[]>([
    ['STUDENT', [grant(PERM.enrollmentKrsSubmit, 'INSERT')]],
  ]);

  it('401 tanpa sesi, tanpa menyentuh pembaca akses', async () => {
    let called = 0;
    const result = await requireDataPrincipal(ctx(null), PERM.enrollmentKrsSubmit, async () => {
      called += 1;
      return emptyAccess();
    });
    expect(result.granted).toBe(false);
    if (!result.granted) expect(result.response.status).toBe(401);
    expect(called).toBe(0);
  });

  it('403 untuk izin yang tidak ada di katalog', async () => {
    const result = await requireDataPrincipal(
      ctx('mahasiswa'),
      'academic.course.drop' as PermissionCode,
      async () => emptyAccess()
    );
    expect(result.granted).toBe(false);
    if (!result.granted) expect(result.response.status).toBe(403);
  });

  it('403 ketika tabel penugasan kosong — tanpa jatuh-kembali ke carrier', async () => {
    const result = await requireDataPrincipal(
      ctx('tenant_admin'),
      PERM.entitlementModuleActivate,
      async () => emptyAccess()
    );
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as { error: { code: string } };
      expect(body.error.code).toBe('FORBIDDEN');
    }
  });

  it('memberi subjek bertipe non-null beserta akses efektifnya', async () => {
    const access = computeEffectiveAccess([assignment({ roleCode: 'STUDENT' })], grants, NOW);
    const result = await requireDataPrincipal(
      ctx('mahasiswa'),
      PERM.enrollmentKrsSubmit,
      async () => access
    );

    expect(result.granted).toBe(true);
    if (result.granted) {
      expect(result.principal.userId).toBe(USER);
      expect(result.principal.tenantId).toBe(TENANT);
      expect(result.principal.access.roles).toEqual(['STUDENT']);
    }
  });

  it('memanggil pembaca dengan pasangan tenant & user dari konteks', async () => {
    const seen: string[] = [];
    await requireDataPrincipal(
      ctx('mahasiswa'),
      PERM.enrollmentKrsSubmit,
      async (tenantId, userId) => {
        seen.push(`${tenantId}|${userId}`);
        return accessOf(PERM.enrollmentKrsSubmit);
      }
    );
    expect(seen).toEqual([`${TENANT}|${USER}`]);
  });
});

function accessOf(...codes: PermissionCode[]): EffectiveAccess {
  return {
    grants: [
      {
        assignmentId: 'a-1',
        roleCode: 'STUDENT',
        scopeKind: 'SELF',
        scope: NO_SCOPE,
        validFrom: new Date('2026-01-01'),
        validTo: null,
        origin: 'SEED',
        grants: codes.map((code) => grant(code, 'INSERT')),
      },
    ],
    roles: ['STUDENT'],
    permissions: new Set(codes),
  };
}
