/**
 * Regression test gerbang `/api/v1/platform/**` (AGENTS §3.8 titik "izin cukup tapi
 * data tenant lain").
 *
 * Yang dijaga: `audit.log.view` dan `identity.impersonation.grant` JUGA dipegang
 * `TENANT_ADMIN` untuk tenant-nya sendiri. Jika rute platform hanya memeriksa izin
 * itu, admin kampus dapat membaca jejak audit tetangga atau menerbitkan grant
 * dukungan lintas tenant. Marker operator (`platform.tenant.view`) harus selalu
 * diminta lebih dulu.
 */
import { describe, expect, it, vi } from 'vitest';
import { PERM, type PermissionCode } from '@sica/contracts';
import type { RequestContext } from '@/lib/api-response';

const state = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('@/modules/authz/rbac-repository', async () => {
  const { forbidden } = await import('@/lib/api-response');
  return {
    requireDataPrincipal: async (ctx: RequestContext, permission: PermissionCode) => {
      if (!state.permissions.has(permission)) {
        return { granted: false, response: forbidden(ctx, 'Aksi ini berada di luar hak akses peran Anda.') };
      }
      return {
        granted: true,
        principal: {
          userId: ctx.userId ?? 'u',
          tenantId: ctx.tenantId ?? 't',
          access: { grants: [], roles: [], permissions: state.permissions as ReadonlySet<PermissionCode> },
        },
      };
    },
  };
});

const { requirePlatformRead, requirePlatformWrite } = await import('@/lib/platform-guard');

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: 'req-test',
    timestamp: new Date().toISOString(),
    tenantId: 'tenant-1',
    userId: 'user-1',
    authenticated: true,
    amr: ['pwd', 'mfa'],
    ...overrides,
  };
}

function grant(...codes: PermissionCode[]): void {
  state.permissions = new Set<string>(codes);
}

async function statusOf(result: Awaited<ReturnType<typeof requirePlatformRead>>): Promise<number | null> {
  if (result.granted) return null;
  return result.response.status;
}

describe('requirePlatformRead — marker operator wajib', () => {
  it('admin kampus dengan audit.log.view DITOLAK membaca jejak lintas-tenant', async () => {
    grant(PERM.auditLogView, PERM.identityImpersonationGrant);
    const result = await requirePlatformRead(ctx(), PERM.auditLogView);
    expect(result.granted).toBe(false);
    expect(await statusOf(result)).toBe(403);
  });

  it('operator dengan marker + izin rute DITERIMA', async () => {
    grant(PERM.platformTenantView, PERM.auditLogView);
    const result = await requirePlatformRead(ctx(), PERM.auditLogView);
    expect(result.granted).toBe(true);
  });

  it('operator tanpa izin spesifik rute tetap DITOLAK', async () => {
    grant(PERM.platformTenantView);
    const result = await requirePlatformRead(ctx(), PERM.auditLogView);
    expect(result.granted).toBe(false);
    expect(await statusOf(result)).toBe(403);
  });
});

describe('requirePlatformWrite — marker + MFA', () => {
  it('sesi tanpa mfa → 401 MFA_REQUIRED walau operator lengkap haknya', async () => {
    grant(PERM.platformTenantView, PERM.identityImpersonationGrant);
    const result = await requirePlatformWrite(ctx({ amr: ['pwd'] }), PERM.identityImpersonationGrant);
    expect(result.granted).toBe(false);
    expect(await statusOf(result)).toBe(401);
  });

  it('admin kampus ber-MFA dengan identity.impersonation.grant DITOLAK menerbitkan grant', async () => {
    grant(PERM.identityImpersonationGrant, PERM.auditLogView);
    const result = await requirePlatformWrite(ctx(), PERM.identityImpersonationGrant);
    expect(result.granted).toBe(false);
    expect(await statusOf(result)).toBe(403);
  });

  it('operator ber-MFA dengan izin rute DITERIMA', async () => {
    grant(PERM.platformTenantView, PERM.identityImpersonationGrant);
    const result = await requirePlatformWrite(ctx(), PERM.identityImpersonationGrant);
    expect(result.granted).toBe(true);
  });
});
