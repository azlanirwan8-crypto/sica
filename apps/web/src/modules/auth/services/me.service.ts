/**
 * Identity service — mengambil profil pengguna terautentikasi untuk satu tenant.
 * Dipakai endpoint GET /api/v1/auth/me agar navigasi & mobile app menampilkan
 * nama, peran, dan institusi yang benar (bukan placeholder hardcoded).
 */
import { db, withTenantContext, eq, and, tenants, users, tenantMemberships } from '@sica/database';

export interface CurrentIdentity {
  readonly userId: string;
  readonly fullName: string;
  readonly email: string;
  readonly role: string;
  readonly memberCode: string | null;
  readonly tenantId: string;
  readonly tenantSlug: string;
  readonly tenantName: string;
}

export async function getCurrentIdentity(tenantId: string, userId: string): Promise<CurrentIdentity | null> {
  // `tenants` adalah tabel registry global (tanpa kolom tenant_id) → baca di luar konteks RLS.
  const tenantRows = await db.select({ slug: tenants.slug, legalName: tenants.legalName }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const tenant = (tenantRows as Array<{ slug: string; legalName: string }>)[0];

  const rows = await withTenantContext(tenantId, async (tx) =>
    tx
      .select({
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        role: tenantMemberships.role,
        memberCode: tenantMemberships.memberCode,
        status: tenantMemberships.status,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(users.id, tenantMemberships.userId))
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
      .limit(1),
  );
  const m = (rows as Array<{ userId: string; fullName: string; email: string; role: string; memberCode: string | null; status: string }>)[0];
  if (!m) return null;

  return {
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    role: m.role,
    memberCode: m.memberCode,
    tenantId,
    tenantSlug: tenant?.slug ?? '',
    tenantName: tenant?.legalName ?? 'Institusi',
  };
}
