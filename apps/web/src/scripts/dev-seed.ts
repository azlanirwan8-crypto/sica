/**
 * Seed DEV (local/Supabase dev) — tenant 'demo' + 3 akun login + aktivasi modul core.
 * Idempoten (aman dijalankan berulang). Tidak berisi rahasia produksi; kata sandi
 * hanyalah kredensial dev untuk pengujian manual. Hash sandi memakai Pepper Scrypt
 * yang SAMA dengan app (createPasswordHasher) → login langsung cocok.
 *
 * Jalankan: pnpm --filter @sica/web seed:dev
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

type MemberRole = 'super_admin' | 'tenant_admin' | 'dosen' | 'mahasiswa' | 'staff';

async function main() {
  // Muat .env SEBELUM import @sica/database (client baca DATABASE_URL saat import).
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    const k = m?.[1];
    const v = m?.[2];
    if (k && v !== undefined && process.env[k] === undefined) process.env[k] = v.replace(/^"|"$/g, '');
  }

  const dbMod = await import('@sica/database');
  const { db, withTenantContext, and, eq, tenants, users, tenantMemberships, modules, tenantModules } = dbMod;
  const { createPasswordHasher } = await import('../modules/auth/services/password.service');

  const pepper = process.env['PASSWORD_HASH_PEPPER'] ?? '';
  const hasher = createPasswordHasher(pepper);

  async function ensureTenant(slug: string, legalName: string): Promise<string> {
    const found = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (found[0]) return (found[0] as { id: string }).id;
    const id = randomUUID();
    await db.insert(tenants).values({ id, slug, legalName, status: 'ACTIVE' });
    return id;
  }

  async function ensureUser(email: string, fullName: string, password: string): Promise<string> {
    const found = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (found[0]) return (found[0] as { id: string }).id;
    const id = randomUUID();
    await db.insert(users).values({ id, email, fullName, passwordHash: await hasher.hash(password), status: 'ACTIVE' });
    return id;
  }

  async function ensureMembership(tenantId: string, userId: string, role: MemberRole, memberCode: string): Promise<void> {
    await withTenantContext(tenantId, async (tx) => {
      const exists = await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.userId, userId)))
        .limit(1);
      if (exists[0]) return;
      await tx.insert(tenantMemberships).values({ id: randomUUID(), tenantId, userId, role, memberCode, status: 'ACTIVE' });
    });
  }

  async function activateCoreModules(tenantId: string, codes: readonly string[]): Promise<void> {
    const mods = await db.select({ id: modules.id, code: modules.code }).from(modules).where(eq(modules.isActive, true));
    const byCode = new Map((mods as Array<{ id: string; code: string }>).map((m) => [m.code, m.id]));
    for (const code of codes) {
      const moduleId = byCode.get(code);
      if (!moduleId) { console.log(`  (skip modul tak dikenal: ${code})`); continue; }
      await withTenantContext(tenantId, async (tx) => {
        await tx.insert(tenantModules)
          .values({ id: randomUUID(), tenantId, moduleId, status: 'ACTIVE' })
          .onConflictDoNothing();
      });
    }
  }

  const CORE = ['identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment', 'finance', 'feeder_pddikti', 'audit'];

  console.log('🌱 Seed DEV SICA…');
  const tenantId = await ensureTenant('demo', 'Universitas Demo SICA');
  console.log(`tenant demo id=${tenantId}`);

  const accounts: Array<{ email: string; name: string; pass: string; role: MemberRole; code: string }> = [
    { email: 'admin@demo.sica.test', name: 'Admin Demo', pass: 'AdminPass!23', role: 'tenant_admin', code: 'ADMIN01' },
    { email: 'dosen@demo.sica.test', name: 'Dosen Demo', pass: 'LecturerPass!23', role: 'dosen', code: 'NIDN9001' },
    { email: 'mhs@demo.sica.test', name: 'Mahasiswa Demo', pass: 'StudentPass!23', role: 'mahasiswa', code: '2201010045' },
  ];
  for (const a of accounts) {
    const userId = await ensureUser(a.email, a.name, a.pass);
    await ensureMembership(tenantId, userId, a.role, a.code);
    console.log(`akun ${a.role}: ${a.email} / ${a.pass} (NIM/NIDN: ${a.code})`);
  }

  await activateCoreModules(tenantId, CORE);
  console.log('modul core diaktifkan untuk demo');
  console.log('✅ SEED SELESAI');
}

main().catch((e) => { console.error('❌ SEED GAGAL:', (e as Error).message); process.exit(1); });
