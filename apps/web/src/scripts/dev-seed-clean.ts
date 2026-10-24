/**
 * Pembersih RESIDU UJI untuk lingkungan DEV (`seed:dev:clean`) — menutup RD-146.
 *
 * Kenapa alat ini ada: rangkaian e2e Fase 1 sengaja meninggalkan baris yang TIDAK BISA
 * dibersihkan lewat jalur normal — permintaan hak `PENDING` yang penyetujuinya adalah
 * target itu sendiri (ditolak oleh rancangan four-eyes), akun `r2-*` yang memang dibuat
 * untuk menguji empat-mata, dan parameter `attendance.uji_e2e_*`. Semuanya menumpuk di
 * layar admin dan membuat daftar terlihat kotor.
 *
 * Tiga pagar agar tidak bisa salah sasaran:
 *  1. Menolak jalan bila `NODE_ENV=production`, dan menolak bila tenant uji (slug `demo`)
 *     tidak ada — alat ini hanya mengenal tenant yang dihasilkan `dev-seed`.
 *  2. Hanya menghapus pola penanda uji yang keras: `UJI%` (organisasi & prodi),
 *     `attendance.uji_e2e%`, `r2-%@demo.sica.test`, permintaan hak `PENDING` milik tenant itu.
 *  3. `audit_logs` tidak pernah disentuh — barisnya bukti append-only dan rantai hashnya
 *     pecah bila ada yang dihapus (AC-AUD-1).
 *
 * Kering secara default. `--apply` untuk mengeksekusi.
 */
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    const k = m?.[1];
    const v = m?.[2];
    if (k && v !== undefined && process.env[k] === undefined) process.env[k] = v.replace(/^"|"$/g, '');
  }

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('DITOLAK: pembersih residu uji tidak berjalan di NODE_ENV=production.');
  }

  const { db, sql, sqlClient, withTenantContext, tenants } = await import('@sica/database');

  const found = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants);
  const demo = found.find((t: { slug: string }) => t.slug === 'demo');
  const tenantId = (demo as { id: string } | undefined)?.id;
  if (!tenantId || !UUID_RE.test(tenantId)) {
    throw new Error('DITOLAK: tenant uji (slug "demo") tidak ditemukan — alat ini hanya mengenal tenant dev-seed.');
  }

  const countResidue = async (run: typeof db) => {
    const one = async (query: ReturnType<typeof sql>) => {
      const rows = (await run.execute(query)) as Array<{ n: string }>;
      return Number(rows[0]?.n ?? 0);
    };
    return {
      prodi: await one(sql`SELECT count(*)::int AS n FROM study_programs WHERE tenant_id = ${tenantId} AND code LIKE 'UJI%'`),
      organisasi: await one(sql`SELECT count(*)::int AS n FROM organizations WHERE tenant_id = ${tenantId} AND code LIKE 'UJI%'`),
      parameter: await one(sql`SELECT count(*)::int AS n FROM master_system_parameters WHERE tenant_id = ${tenantId} AND parameter_key LIKE 'attendance.uji_e2e%'`),
      permintaanHak: await one(sql`SELECT count(*)::int AS n FROM access_change_requests WHERE tenant_id = ${tenantId} AND status = 'PENDING'`),
      akunUji: await one(sql`SELECT count(*)::int AS n FROM users WHERE email LIKE 'r2-%@demo.sica.test'`),
    };
  }

  // Semua baca/tulis terjadi di dalam konteks tenant: organizations, study_programs,
  // master_system_parameters dan access_change_requests ber-RLS ENABLE+FORCE — di luar
  // konteks, DELETE-nya cocok nol baris dan alat ini akan mengaku bersih.
  const before = await withTenantContext(tenantId, (tx) => countResidue(tx));
  console.log(`tenant uji = "demo" · residu terukur: ${JSON.stringify(before)}`);

  if (!APPLY) {
    console.log('DRY RUN — tidak ada yang dihapus. Tambahkan --apply untuk mengeksekusi.');
    await sqlClient.end();
    return;
  }

  const deleted = await withTenantContext(tenantId, async (tx) => {
    const out: Record<string, number> = {};
    const kill = async (label: string, statement: ReturnType<typeof sql>) => {
      const rows = (await tx.execute(statement)) as unknown[];
      out[label] = rows.length;
      console.log(`  hapus ${label}: ${rows.length} baris`);
    };
    // Urutan ditentukan oleh FK NO ACTION yang terukur di DB (bukan tebakan):
    // access_change_requests.{requester,target,approver}_id, user_role_assignments.{user,assigned_by},
    // role_permissions.granted_by, impersonation_grants.{actor,granted_by,target}, dan
    // mfa_challenges.user_id SEMUA menunjuk `users` dengan `NO ACTION` → baris penunjuk
    // harus pergi sebelum akunnya. Cascade (`sessions`, `refresh_tokens`, `mfa_factors`,
    // `password_history`, `tenant_memberships`) ikut sendiri.
    const ujiList = sql`(SELECT id FROM users WHERE email LIKE 'r2-%@demo.sica.test')`;
    await kill('prodi', sql`DELETE FROM study_programs WHERE tenant_id = ${tenantId} AND code LIKE 'UJI%' RETURNING id`);
    await kill('organisasi-leaf', sql`DELETE FROM organizations o WHERE o.tenant_id = ${tenantId} AND o.code LIKE 'UJI%'
      AND NOT EXISTS (SELECT 1 FROM organizations c WHERE c.parent_id = o.id) RETURNING o.id`);
    await kill('organisasi-induk', sql`DELETE FROM organizations WHERE tenant_id = ${tenantId} AND code LIKE 'UJI%' RETURNING id`);
    await kill('parameter', sql`DELETE FROM master_system_parameters WHERE tenant_id = ${tenantId} AND parameter_key LIKE 'attendance.uji_e2e%' RETURNING id`);
    // Permintaan hak yang MENYANGKUT akun uji (pemohon/target/penyetuju) ATAU masih PENDING.
    // Yang terminal dan tidak menyentuh akun uji tidak disentuh — ia bukti alur empat-mata.
    await kill('permintaan-hak-uji', sql`DELETE FROM access_change_requests WHERE tenant_id = ${tenantId}
      AND (status = 'PENDING' OR requester_id IN ${ujiList} OR target_user_id IN ${ujiList} OR approver_id IN ${ujiList}) RETURNING id`);
    await kill('penugasan-peran-uji', sql`DELETE FROM user_role_assignments
      WHERE user_id IN ${ujiList} OR assigned_by IN ${ujiList} RETURNING id`);
    await kill('grant-izin-oleh-akun-uji', sql`DELETE FROM role_permissions WHERE granted_by IN ${ujiList} RETURNING 1`);
    await kill('grant-impersonasi-uji', sql`DELETE FROM impersonation_grants
      WHERE actor_user_id IN ${ujiList} OR granted_by IN ${ujiList} OR target_user_id IN ${ujiList} RETURNING 1`);
    await kill('tantangan-mfa-akun-uji', sql`DELETE FROM mfa_challenges WHERE user_id IN ${ujiList} RETURNING id`);
    await kill('akun-uji', sql`DELETE FROM users WHERE email LIKE 'r2-%@demo.sica.test' RETURNING id`);
    return out;
  });

  const after = await withTenantContext(tenantId, (tx) => countResidue(tx));
  console.log('terhapus:', JSON.stringify(deleted));
  console.log('sisa   :', JSON.stringify(after));
  console.log('audit_logs tidak disentuh — jejak tetap utuh.');
  await sqlClient.end();
}

main().catch((err: unknown) => {
  console.error('DIHENTIKAN:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
