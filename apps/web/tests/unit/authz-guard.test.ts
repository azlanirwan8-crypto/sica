/**
 * Unit tests — Guard hak akses (`src/modules/authz/guard.ts`).
 *
 * Fokus pada regresi celah G-01: peran tidak lagi dinilai dari substring nama,
 * dan setiap penolakan menghasilkan kode HTTP yang benar.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  requirePermission,
  requirePrincipal,
  canSee,
  rolesOf,
  permissionsOf,
  holdsPermission,
} from '../../src/modules/authz/guard';
import type { RequestContext } from '../../src/lib/api-response';
import { PERM } from '@sica/contracts';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

function ctx(role: string | null): RequestContext {
  return {
    requestId: 'req-test',
    timestamp: '2026-10-19T00:00:00.000Z',
    tenantId: role === null ? null : TENANT,
    userId: role === null ? null : USER,
    role,
    sessionId: 'sess-1',
    authenticated: role !== null,
  };
}

interface ErrorEnvelope {
  success: boolean;
  error: { code: string; message: string };
}

async function bodyOf(response: Response): Promise<ErrorEnvelope> {
  return (await response.json()) as ErrorEnvelope;
}

describe('evaluateAccess — fail-closed', () => {
  it('menolak tanpa sesi', () => {
    const decision = evaluateAccess(ctx(null), PERM.enrollmentKrsSubmit);
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toBe('UNAUTHENTICATED');
  });

  it('menolak peran yang tidak dikenal meski namanya mengandung "admin"', () => {
    const decision = evaluateAccess(ctx('admin_keuangan_baca'), PERM.entitlementModuleActivate);
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toBe('UNKNOWN_ROLE');
  });

  it('menolak izin yang tidak ada di katalog', () => {
    const decision = evaluateAccess(ctx('tenant_admin'), 'academic.course.drop' as never);
    expect(decision.granted).toBe(false);
  });

  it('memberi akses sesuai peran carrier', () => {
    expect(evaluateAccess(ctx('mahasiswa'), PERM.enrollmentKrsSubmit).granted).toBe(true);
    expect(evaluateAccess(ctx('mahasiswa'), PERM.enrollmentKrsApprove).granted).toBe(false);
    expect(evaluateAccess(ctx('dosen'), PERM.enrollmentKrsApprove).granted).toBe(true);
    expect(evaluateAccess(ctx('dosen'), PERM.gradingValueWrite).granted).toBe(true);
    expect(evaluateAccess(ctx('dosen'), PERM.gradingUnlock).granted).toBe(false);
    expect(evaluateAccess(ctx('tenant_admin'), PERM.entitlementModuleActivate).granted).toBe(true);
    expect(evaluateAccess(ctx('mahasiswa'), PERM.entitlementModuleActivate).granted).toBe(false);
  });
});

describe('requirePermission / requirePrincipal — pemetaan HTTP', () => {
  it('menghasilkan 401 untuk sesi hilang dan 403 untuk hak kurang', async () => {
    const unauth = requirePermission(ctx(null), PERM.enrollmentKrsSubmit);
    expect(unauth?.status).toBe(401);

    const forbiddenResponse = requirePermission(ctx('mahasiswa'), PERM.gradingValueWrite);
    expect(forbiddenResponse?.status).toBe(403);
    if (forbiddenResponse) expect((await bodyOf(forbiddenResponse)).error.code).toBe('FORBIDDEN');

    expect(requirePermission(ctx('dosen'), PERM.gradingValueWrite)).toBeNull();
  });

  it('requirePrincipal menurunkan id non-null hanya saat diizinkan', () => {
    const allowed = requirePrincipal(ctx('mahasiswa'), PERM.enrollmentKrsSubmit);
    expect(allowed.granted).toBe(true);
    if (allowed.granted) {
      expect(allowed.principal.tenantId).toBe(TENANT);
      expect(allowed.principal.userId).toBe(USER);
      expect(allowed.principal.roles).toEqual(['STUDENT']);
    }

    const denied = requirePrincipal(ctx('staff'), PERM.enrollmentKrsSubmit);
    expect(denied.granted).toBe(false);
  });
});

describe('Bekalan untuk filter menu & diagnostik', () => {
  it('rolesOf kosong untuk peran asing', () => {
    expect(rolesOf({ role: 'dosen_tamuan' })).toEqual([]);
    expect(rolesOf({ role: 'mahasiswa' })).toEqual(['STUDENT']);
  });

  it('permissionsOf menggabungkan grant tanpa duplikat', () => {
    const codes = permissionsOf(['LECTURER', 'ADVISER']);
    expect(codes).toContain(PERM.gradingValueWrite);
    expect(codes).toContain(PERM.enrollmentKrsApprove);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('canSee hanya berbasis peran, tidak butuh sesi', () => {
    expect(canSee({ role: 'mahasiswa' }, PERM.financeInvoiceView)).toBe(true);
    expect(canSee({ role: 'mahasiswa' }, PERM.financeInvoiceGenerate)).toBe(false);
    expect(canSee({ role: 'staff' }, PERM.financeTariffUpdate)).toBe(false);
  });

  it('holdsPermission menolak peran tanpa grant', () => {
    expect(holdsPermission([], PERM.enrollmentKrsSubmit)).toBe(false);
  });
});
