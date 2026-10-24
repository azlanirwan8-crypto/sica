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
  const { db, withTenantContext, and, eq, tenants, users, tenantMemberships, modules, tenantModules, roles, userRoleAssignments, rolePermissions, permissions, mfaFactors } = dbMod;
  const { SYSTEM_ROLE_GRANTS } = await import('@sica/contracts');
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

  // Penugasan ber-scope (SEC-10): hak efektif rute domain dibaca dari tabel ini.
  const CARRIER_TO_SYSTEM_ROLE: Record<string, string> = {
    tenant_admin: 'TENANT_ADMIN',
    dosen: 'LECTURER',
    mahasiswa: 'STUDENT',
  };

  async function ensureAssignment(tenantId: string, userId: string, systemRoleCode: string): Promise<void> {
    await withTenantContext(tenantId, async (tx) => {
      const role = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, tenantId), eq(roles.code, systemRoleCode)))
        .limit(1);
      if (!role[0]) { console.log(`  (skip penugasan — peran ${systemRoleCode} belum di-seed, jalankan migrasi 0011)`); return; }
      const roleId = (role[0] as { id: string }).id;
      const exists = await tx
        .select({ id: userRoleAssignments.id })
        .from(userRoleAssignments)
        .where(and(
          eq(userRoleAssignments.tenantId, tenantId),
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.roleId, roleId),
        ))
        .limit(1);
      if (exists[0]) return;
      await tx.insert(userRoleAssignments).values({
        id: randomUUID(),
        tenantId,
        userId,
        roleId,
        validFrom: new Date(),
        validTo: null,
        origin: 'SEED',
      });
    });
  }

  const CORE = ['identity', 'academic', 'teaching', 'enrollment', 'attendance', 'assessment', 'finance', 'feeder_pddikti', 'audit'];

  // Secret TOTP DEV yang dibakukan (vektor RFC 6238) — HANYA untuk login lokal demo `R-1`.
  // Bukan kredensial produksi: seed mencetak QR-URI supaya authenticator pemilik bisa dipasang.
  const DEV_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  /**
   * Tenant platform + akun Operator Platform ber-MFA (Fase 1A `R-1`).
   * Peran `PLATFORM_OPERATOR` sengaja TIDAK di-seed `0011` (bukan peran tenant kampus),
   * jadi dibuat di sini beserta grant-nya dari katalog `SYSTEM_ROLE_GRANTS`.
   */
  async function seedPlatformOperator(): Promise<{ tenantId: string; userId: string }> {
    const platformTenantId = await ensureTenant('platform', 'SICA Platform Operations');
    const operatorEmail = 'platform@demo.sica.test';
    const operatorId = await ensureUser(operatorEmail, 'Operator Platform', 'PlatformPass!23');
    await ensureMembership(platformTenantId, operatorId, 'super_admin', 'PLT01');

    await withTenantContext(platformTenantId, async (tx) => {
      let roleId: string | null = null;
      const found = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.tenantId, platformTenantId), eq(roles.code, 'PLATFORM_OPERATOR')))
        .limit(1);
      roleId = found[0]?.id ?? null;

      if (!roleId) {
        roleId = randomUUID();
        await tx.insert(roles).values({
          id: roleId,
          tenantId: platformTenantId,
          code: 'PLATFORM_OPERATOR',
          displayName: 'Operator Platform',
          scopeKind: 'TENANT',
          isSystem: true,
        });
        const grants = SYSTEM_ROLE_GRANTS.PLATFORM_OPERATOR;
        const perms = await tx.select({ id: permissions.id, code: permissions.code }).from(permissions);
        const byCode = new Map(perms.map((p) => [p.code, p.id]));
        for (const code of grants) {
          const pid = byCode.get(code);
          if (!pid) continue;
          await tx
            .insert(rolePermissions)
            .values({ tenantId: platformTenantId, roleId, permissionId: pid })
            .onConflictDoNothing();
        }
        console.log(`  grant PLATFORM_OPERATOR dipasang (${grants.length} kode katalog)`);
      }

      const assigned = await tx
        .select({ id: userRoleAssignments.id })
        .from(userRoleAssignments)
        .where(and(
          eq(userRoleAssignments.tenantId, platformTenantId),
          eq(userRoleAssignments.userId, operatorId),
          eq(userRoleAssignments.roleId, roleId as string),
        ))
        .limit(1);
      if (!assigned[0]) {
        await tx.insert(userRoleAssignments).values({
          id: randomUUID(),
          tenantId: platformTenantId,
          userId: operatorId,
          roleId: roleId as string,
          validFrom: new Date(),
          validTo: null,
          origin: 'SEED',
        });
      }

      // Faktor TOTP terbukti + `mfa_required=true` → login operator MENCETAK tantangan,
      // dan hanya sesi `amr=['pwd','mfa']` yang boleh menulis di /platform/**.
      const factor = await tx
        .select({ id: mfaFactors.id })
        .from(mfaFactors)
        .where(and(eq(mfaFactors.userId, operatorId), eq(mfaFactors.kind, 'totp')))
        .limit(1);
      if (!factor[0]) {
        await tx.insert(mfaFactors).values({
          id: randomUUID(),
          tenantId: platformTenantId,
          userId: operatorId,
          kind: 'totp',
          label: 'Authenticator DEV',
          credentialEncrypted: Buffer.from(DEV_TOTP_SECRET, 'utf8'),
          verifiedAt: new Date(),
        });
      }
      await tx.update(users).set({ mfaRequired: true }).where(eq(users.id, operatorId));
    });

    // Navigasi operator disaring dari entitlement × izin: tanpa baris `tenant_modules`
    // ini, menu /platform/** tidak pernah muncul (G-05) meski izin sudah di-grant.
    await activateCoreModules(platformTenantId, ['identity', 'audit']);

    console.log(`akun platform: ${operatorEmail} / PlatformPass!23 (tenant slug: platform, MFA wajib)`);
    console.log(`  otpauth dev (secret DEMO, jangan pakai di produksi): otpauth://totp/SICA%3A${operatorEmail}?secret=${DEV_TOTP_SECRET}&issuer=SICA&algorithm=SHA1&digits=6&period=30`);
    return { tenantId: platformTenantId, userId: operatorId };
  }

  /**
   * Faktor TOTP dev + `mfa_required=true`. Dua akun admin butuh ini karena rute
   * `/api/v1/admin/**` menutup aksi tulis tanpa sesi `amr=['pwd','mfa']` dan mesin
   * empat-mata menuntut PEMOHON ≠ PENYETUJU: satu orang tidak bisa membuktikan
   * transisi `PENDING → APPROVED` sendirian.
   */
  async function ensureAdminMfa(tenantId: string, userId: string, email: string): Promise<void> {
    await withTenantContext(tenantId, async (tx) => {
      const factor = await tx
        .select({ id: mfaFactors.id })
        .from(mfaFactors)
        .where(and(eq(mfaFactors.userId, userId), eq(mfaFactors.kind, 'totp')))
        .limit(1);
      if (!factor[0]) {
        await tx.insert(mfaFactors).values({
          id: randomUUID(),
          tenantId,
          userId,
          kind: 'totp',
          label: 'Authenticator DEV',
          credentialEncrypted: Buffer.from(DEV_TOTP_SECRET, 'utf8'),
          verifiedAt: new Date(),
        });
      }
      await tx.update(users).set({ mfaRequired: true }).where(eq(users.id, userId));
    });
    console.log(`  MFA admin aktif: ${email} · otpauth dev secret=${DEV_TOTP_SECRET} (HANYA dev)`);
  }

  console.log('🌱 Seed DEV SICA…');
  const tenantId = await ensureTenant('demo', 'Universitas Demo SICA');
  console.log(`tenant demo id=${tenantId}`);

  const accounts: Array<{
    email: string;
    name: string;
    pass: string;
    role: MemberRole;
    code: string;
    /** Dua admin ber-MFA = pasangan empat-mata untuk `/admin/**`; `admin@` sengaja TANPA MFA
     *  agar gerbang 401 `MFA_REQUIRED` tetap dapat diuji dari akun yang sama. */
    mfa?: boolean;
  }> = [
    { email: 'admin@demo.sica.test', name: 'Admin Demo', pass: 'AdminPass!23', role: 'tenant_admin', code: 'ADMIN01' },
    { email: 'admin2@demo.sica.test', name: 'Admin Demo Dua', pass: 'Admin2Pass!23', role: 'tenant_admin', code: 'ADMIN02', mfa: true },
    { email: 'admin3@demo.sica.test', name: 'Admin Demo Tiga', pass: 'Admin3Pass!23', role: 'tenant_admin', code: 'ADMIN03', mfa: true },
    { email: 'dosen@demo.sica.test', name: 'Dosen Demo', pass: 'LecturerPass!23', role: 'dosen', code: 'NIDN9001' },
    { email: 'mhs@demo.sica.test', name: 'Mahasiswa Demo', pass: 'StudentPass!23', role: 'mahasiswa', code: '2201010045' },
  ];
  const userIds = new Map<string, string>();
  for (const a of accounts) {
    const userId = await ensureUser(a.email, a.name, a.pass);
    userIds.set(a.email, userId);
    await ensureMembership(tenantId, userId, a.role, a.code);
    await ensureAssignment(tenantId, userId, CARRIER_TO_SYSTEM_ROLE[a.role] ?? '');
    if (a.mfa) await ensureAdminMfa(tenantId, userId, a.email);
    console.log(`akun ${a.role}: ${a.email} / ${a.pass} (NIM/NIDN: ${a.code})${a.mfa ? ' [MFA]' : ''}`);
  }

  await activateCoreModules(tenantId, CORE);
  const platform = await seedPlatformOperator();
  console.log('modul core diaktifkan untuk demo');

  // Katalog parameter (§21.3) dipasang dengan DUA prinsipal nyata: `ck_param_regulatory_approver`
  // (0049) menuntut penyetuju berbeda dari pengajuan bahkan untuk baris seed, dan
  // memalsukan uuid di sini berarti membuang maksud empat-mata itu sendiri.
  const seedAdmin = userIds.get('admin2@demo.sica.test');
  const seedApprover = userIds.get('admin3@demo.sica.test');
  if (seedAdmin && seedApprover) {
    const { seedSystemParameters } = await import('../modules/settings/services/parameter-seed');
    const params = await seedSystemParameters(tenantId, { requestedBy: seedAdmin, approvedBy: seedApprover });
    console.log(
      `parameter sistem: +${params.inserted} baru, ${params.alreadyPresent} sudah ada, ` +
        `kamus enum ${params.enumKinds} kind / ${params.enumItems} item`
    );
  }

  // Pohon menu sebagai data (`MENU-LOCK-1`, BLUEPRINT_ROLE_BY_ROLE §12). Definisinya ada di
  // `modules/authz/menu-tree.ts`; yang dirender aplikasi dibaca dari `menu_items` lewat
  // `GET /me/menu`, sehingga "menu dikunci" berarti baris DB + grant terdaftar, bukan daftar
  // literal di komponen. `createdBy` diisi akun dev nyata supaya jejak `created_by` jujur.
  const { seedMenuTree } = await import('../modules/authz/menu-seed');
  const { CAMPUS_MENU_TREE, PLATFORM_MENU_TREE } = await import('../modules/authz/menu-tree');
  const campusMenu = await seedMenuTree(tenantId, CAMPUS_MENU_TREE, userIds.get('admin2@demo.sica.test') ?? null);
  const platformMenu = await seedMenuTree(platform.tenantId, PLATFORM_MENU_TREE, platform.userId);
  for (const [nama, r] of [
    ['kampus (R-2)', campusMenu],
    ['platform (R-1)', platformMenu],
  ] as const) {
    console.log(
      `menu ${nama}: +${r.inserted} baru, ${r.updated} diperbarui, ${r.unchanged} sudah cocok · ` +
        `grant +${r.grantsInserted}/-${r.grantsRevoked} · daun ${r.totalLeaves} (${r.hiddenLeaves} tanpa izin terdaftar → is_visible=false)`
    );
  }

  console.log('✅ SEED SELESAI');
}

main().catch((e) => { console.error('❌ SEED GAGAL:', (e as Error).message); process.exit(1); });
