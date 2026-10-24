/**
 * Pengunci register §12 (`MENU-LOCK-1`) — membuktikan bahwa daun menu yang dijanjikan
 * pemilik produk BENAR-BENAR ada sebagai baris `menu_items`, dengan keterangannya verbatim
 * (`description ?? label`, sejak F-1/`0096`), grant yang menunjuk katalog izin, dan kunci
 * rute yang dikenal — bukan sebagai teks di dokumen.
 *
 * Lima pertanyaan yang dijawab, semuanya terukur:
 *  1. 39 daun `BLUEPRINT_ROLE_BY_ROLE §12` (14 R-1 + 25 R-2) ada di DB dengan keterangan persis?
 *  2. Setiap `permission_code` grant anggota katalog `permissions` (222+ kode)?
 *  3. Setiap `route_key` yang terisi anggota registri `route-keys.ts`
 *     (`registry.unknownRouteKeys` wajib kosong — gerbang CI §4.17.1)?
 *  4. Untuk tiap akun dev, berapa daun yang benar-benar dikirim, dan berapa yang terpotong
 *     di tiap tahap (entitlement / izin / kedalaman)?
 *  5. `role_permissions` di DB masih SAMA dengan katalog, dan tidak ada baris pohon yang
 *     menetes antar-tenant? Pertanyaan kelima ini yang membuat pencabutan grant (`0093`)
 *     terbukti sampai ke basis data, bukan hanya sampai `authz.ts`.
 *
 * Keluar `1` bila ada selisih. Jalankan: `pnpm --filter @sica/web verify:menu`
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MeMenuItem, PermissionCode } from '@sica/contracts';
import type { MenuSeedNode } from '../modules/authz/menu-tree';

async function main() {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m?.[1] && m[2] !== undefined && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }

  const dbMod = await import('@sica/database');
  const {
    db, and, eq, inArray, withTenantContext, menuItems, menuPermissions,
    permissions, rolePermissions, roles, tenants, users,
  } = dbMod;
  const { CAMPUS_MENU_TREE, PLATFORM_MENU_TREE, ALL_MENU_CODES } = await import('../modules/authz/menu-tree');
  const { ROUTE_KEYS } = await import('../modules/authz/route-keys');
  const { resolveMenuForRequest } = await import('../modules/authz/menu.service');
  const { isKnownPermission } = await import('@sica/contracts');

  const problems: string[] = [];

  /** `§12.1`/`§12.2` → daftar (nomor, label verbatim) dari tabel dokumen. */
  function readRegister(docPath: string): Map<string, string> {
    const lines = fs.readFileSync(docPath, 'utf8').split(/\r?\n/);
    const out = new Map<string, string>();
    let section: 'R-1' | 'R-2' | null = null;
    for (const line of lines) {
      const h = /^### 12\.(\d)\s/.exec(line);
      if (h) {
        section = h[1] === '1' ? 'R-1' : h[1] === '2' ? 'R-2' : null;
        continue;
      }
      if (!section || !/^\|\s*\d+\.\d+\s*\|/.test(line)) continue;
      const cells = line.split('|').map((c) => c.trim());
      const ref = cells[1];
      const label = cells[2];
      if (ref && label) out.set(`${section} ${ref}`, label);
    }
    return out;
  }

  const register = readRegister(path.resolve(process.cwd(), '../../docs/BLUEPRINT_ROLE_BY_ROLE.md'));
  const lockedLeaves: Array<{ surface: 'R-1' | 'R-2'; ref: string; code: string; spec: string; visible: boolean; routeKey: string | null }> = [];
  const collect = (nodes: readonly MenuSeedNode[], surface: 'R-1' | 'R-2'): void => {
    for (const node of nodes) {
      if (node.lock) {
        // Daun boleh ber-gate `anyOf` saja; visibilitasnya dari daftar grant, bukan dari
        // `permission` tunggal — sama seperti `menu-seed.ts` dan `audit-role-menu.ts`.
        const hasGrant = Boolean(node.permission) || (node.anyOf?.length ?? 0) > 0;
        lockedLeaves.push({
          surface,
          ref: node.lock,
          code: node.code,
          // Yang dibandingkan ke §12 adalah **keterangan**, bukan nama nav: F-1 memindahkan
          // kalimat spesifikasi ke `description` dan meninggalkan nama pendek di `label`
          // (`DATA_MODEL §21.7` butir 4, `BLUEPRINT §12.7`). `description ?? label` membuat
          // daun bernama pendek tetap terverifikasi terhadap teksnya sendiri.
          spec: node.description ?? node.label,
          visible: hasGrant,
          routeKey: node.routeKey ?? null,
        });
      }
      if (node.children) collect(node.children, surface);
    }
  };
  collect(PLATFORM_MENU_TREE, 'R-1');
  collect(CAMPUS_MENU_TREE, 'R-2');

  console.log(`🔒 Register §12 terbaca dari kode: ${lockedLeaves.length} daun (R-1 ${lockedLeaves.filter((l) => l.surface === 'R-1').length} · R-2 ${lockedLeaves.filter((l) => l.surface === 'R-2').length})`);
  if (lockedLeaves.length !== 39) problems.push(`Jumlah daun terkunci ${lockedLeaves.length}, seharusnya 39 (14 + 25).`);

  const r1Count = lockedLeaves.filter((l) => l.surface === 'R-1').length;
  const r2Count = lockedLeaves.filter((l) => l.surface === 'R-2').length;
  if (register.size > 0 && r1Count + r2Count !== register.size) {
    problems.push(`Daun terkunci ${r1Count} + ${r2Count} ≠ baris tabel §12 di dokumen (${register.size}).`);
  }
  for (const leaf of lockedLeaves) {
    const docLabel = register.get(`${leaf.surface} ${leaf.ref}`);
    if (docLabel === undefined) {
      problems.push(`${leaf.surface} ${leaf.ref} (${leaf.code}) tidak ada di tabel §12 dokumen.`);
    } else if (docLabel !== leaf.spec) {
      problems.push(`${leaf.surface} ${leaf.ref} keterangan tidak verbatim dengan §12:\n    dokumen: ${docLabel}\n    kode   : ${leaf.spec}`);
    }
  }

  // 2–3: baca DB per tenant dan bandingkan dengan definisi.
  const tenantRows = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(inArray(tenants.slug, ['demo', 'platform']));
  const bySlug = new Map(tenantRows.map((t) => [t.slug, t.id]));
  const demoId = bySlug.get('demo');
  const platformId = bySlug.get('platform');
  if (!demoId || !platformId) {
    problems.push('Tenant dev (demo/platform) belum di-seed — jalankan `pnpm --filter @sica/web seed:dev` lebih dulu.');
    finish(problems);
    return;
  }

  const catalog = await db.select({ code: permissions.code }).from(permissions);
  const catalogSet = new Set(catalog.map((c) => c.code));

  const surfaces: Array<{ slug: 'demo' | 'platform'; tenantId: string }> = [
    { slug: 'platform', tenantId: platformId },
    { slug: 'demo', tenantId: demoId },
  ];

  for (const { slug, tenantId } of surfaces) {
    const rows = await withTenantContext(tenantId, async (tx) => {
      const items = await tx
        .select({
          id: menuItems.id,
          code: menuItems.code,
          label: menuItems.label,
          description: menuItems.description,
          routeKey: menuItems.routeKey,
          isVisible: menuItems.isVisible,
          layer: menuItems.layer,
        })
        .from(menuItems)
        .where(and(eq(menuItems.tenantId, tenantId)));
      const grants = await tx
        .select({ menuId: menuPermissions.menuId, permissionCode: menuPermissions.permissionCode })
        .from(menuPermissions)
        .where(and(eq(menuPermissions.tenantId, tenantId)));
      return { items, grants };
    });

    const grantByMenu = new Map<string, string[]>();
    for (const g of rows.grants) {
      const list = grantByMenu.get(g.menuId) ?? [];
      list.push(g.permissionCode);
      grantByMenu.set(g.menuId, list);
    }
    const surface = slug === 'platform' ? 'R-1' : 'R-2';
    const expected = lockedLeaves.filter((l) => l.surface === surface);

    // Baris yang tidak dikenal definisi = yatim. Seed tidak menghapusnya (cabang yang
    // dirawat kampus punya jalan keluar resmi sendiri: `is_visible = false`, §4.17.2),
    // tetapi membiarkannya lolos berarti pohon DB dan register berhenti beriringan.
    const orphans = rows.items.filter((r) => !ALL_MENU_CODES.includes(r.code));
    if (orphans.length > 0) {
      problems.push(`${surface} (${slug}): ${orphans.length} baris menu tidak dikenal definisi: ${orphans.map((o) => o.code).join(', ')}`);
    }

    let present = 0;
    let specMatch = 0;
    for (const leaf of expected) {
      const row = rows.items.find((r) => r.code === leaf.code);
      if (!row) {
        problems.push(`${surface}: daun ${leaf.ref} (${leaf.code}) tidak ada di menu_items tenant ${slug}.`);
        continue;
      }
      present += 1;
      if ((row.description ?? row.label) === leaf.spec) specMatch += 1;
      else problems.push(`${surface} ${leaf.ref}: keterangan DB ≠ definisi kode (${slug}) — periksa \`description\` lalu \`label\`.`);

      const codes = grantByMenu.get(row.id) ?? [];
      if (leaf.visible && codes.length === 0) problems.push(`${surface} ${leaf.ref}: seharusnya terlihat tetapi tanpa grant.`);
      if (!leaf.visible && codes.length > 0) problems.push(`${surface} ${leaf.ref}: seharusnya disembunyikan padahal punya grant.`);
      if (row.isVisible !== leaf.visible) problems.push(`${surface} ${leaf.ref}: is_visible DB=${row.isVisible} ≠ definisi=${leaf.visible}.`);
      for (const code of codes) {
        if (!catalogSet.has(code)) problems.push(`${surface} ${leaf.ref}: grant ${code} tidak ada di katalog permissions.`);
        if (!isKnownPermission(code as PermissionCode)) problems.push(`${surface} ${leaf.ref}: grant ${code} tidak dikenal contracts/authz.ts.`);
      }
      if (row.routeKey && !(row.routeKey in ROUTE_KEYS)) {
        problems.push(`${surface} ${leaf.ref}: route_key "${row.routeKey}" tidak ada di registri (registry.unknownRouteKeys wajib kosong).`);
      }
    }
    console.log(`${surface} (${slug}): ${present}/${expected.length} daun §12 ada di DB, ${specMatch} keterangan verbatim (description ?? label), ${rows.items.length} baris menu, ${rows.grants.length} grant`);
  }

  // 4: pohon yang benar-benar dikirim, per akun dev.
  const accounts: Array<{ email: string; label: string; tenant: string }> = [
    { email: 'platform@demo.sica.test', label: 'R-1 operator', tenant: 'platform' },
    { email: 'admin2@demo.sica.test', label: 'R-2 admin IT', tenant: 'demo' },
    { email: 'dosen@demo.sica.test', label: 'R-5 dosen', tenant: 'demo' },
    { email: 'mhs@demo.sica.test', label: 'R-6 mahasiswa', tenant: 'demo' },
  ];
  for (const account of accounts) {
    const tenantId = account.tenant === 'platform' ? platformId : demoId;
    const found = await db.select({ id: users.id }).from(users).where(eq(users.email, account.email)).limit(1);
    if (!found[0]) {
      problems.push(`Akun ${account.email} tidak ditemukan — seed dev belum lengkap.`);
      continue;
    }
    const view = await resolveMenuForRequest({ tenantId, userId: (found[0] as { id: string }).id, layer: 'WEB' });
    const flat = (nodes: readonly MeMenuItem[]): number =>
      nodes.reduce((n, node) => n + (node.children.length === 0 ? 1 : 0) + flat(node.children), 0);
    const leaves = flat(view.tree);
    console.log(
      `${account.label.padEnd(14)} → ${view.tree.length} akar, ${leaves} daun terlihat · dipotong entitlement=${view.prunedCounts.byEntitlement} izin=${view.prunedCounts.byPermission} kedalaman=${view.prunedCounts.byDepthLimit} · versi=${view.menuVersion}`
    );
    if (view.registry.unknownRouteKeys.length > 0) {
      problems.push(`${account.label}: route_key tak dikenal muncul di respons: ${view.registry.unknownRouteKeys.join(', ')}`);
    }
    if (leaves === 0) problems.push(`${account.label}: pohon kosong — padahal akun ini punya hak (regresi filter?).`);
    if (account.tenant === 'platform' && leaves < 5) problems.push('Operator platform hanya melihat <5 daun — gerbang entitlement/peran salah.');
  }

  // 5: dua hal yang tidak bisa dibuktikan dari definisi pohon — bahwa `role_permissions`
  // di DB masih SAMA dengan katalog, dan bahwa dua pohon tidak saling menetes antar-tenant.
  // Tanpa langkah ini, pencabutan grant (`0093`) terlihat hijau di kode tetapi basis data
  // lama tetap melayani daun yang sudah dicabut: menu dibaca dari tabel, bukan dari kontrak.
  const { SYSTEM_ROLE_GRANTS } = await import('@sica/contracts');
  const campusCodes = new Set<string>(allCodes(CAMPUS_MENU_TREE));
  const platformCodes = new Set<string>(allCodes(PLATFORM_MENU_TREE));

  /** Semua `code` sebuah pohon (grup + daun), untuk menguji kebocoran antar-lapisan. */
  function allCodes(nodes: readonly MenuSeedNode[]): string[] {
    const out: string[] = [];
    const walk = (list: readonly MenuSeedNode[]): void => {
      for (const node of list) {
        out.push(node.code);
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return out;
  }

  for (const { slug, tenantId } of surfaces) {
    const rowsByRole = await withTenantContext(tenantId, async (tx) => {
      const found = await tx
        .select({
          roleCode: roles.code,
          isSystem: roles.isSystem,
          permissionCode: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(and(eq(rolePermissions.tenantId, tenantId), eq(roles.isSystem, true)));
      const items = await tx
        .select({ code: menuItems.code })
        .from(menuItems)
        .where(and(eq(menuItems.tenantId, tenantId)));
      return { found, items };
    });

    const menuCodes = new Set(rowsByRole.items.map((r) => r.code));
    // Yang diuji adalah kode yang HANYA ada di pohon sebelah. `dashboard` sengaja nama yang
    // sama di kedua pohon (akar yang sama, baris berbeda per tenant) sehingga ia bukan bocor.
    const ownCodes = slug === 'demo' ? campusCodes : platformCodes;
    const otherCodes = slug === 'demo' ? platformCodes : campusCodes;
    const foreign = [...menuCodes].filter((c) => otherCodes.has(c) && !ownCodes.has(c));
    if (foreign.length > 0) {
      problems.push(`Tenant ${slug} memuat baris pohon sebelah: ${foreign.join(', ')} — isolasi R-1/R-2 bocor lewat seed.`);
    }

    const byRole = new Map<string, Set<string>>();
    for (const r of rowsByRole.found) {
      const set = byRole.get(r.roleCode) ?? new Set<string>();
      set.add(r.permissionCode);
      byRole.set(r.roleCode, set);
    }
    let drift = 0;
    for (const [roleCode, dbCodes] of byRole) {
      const catalogCodes = SYSTEM_ROLE_GRANTS[roleCode as keyof typeof SYSTEM_ROLE_GRANTS] as readonly string[] | undefined;
      if (!catalogCodes) continue;
      const extra = [...dbCodes].filter((c) => !catalogCodes.includes(c));
      const missing = catalogCodes.filter((c) => !dbCodes.has(c));
      if (extra.length === 0 && missing.length === 0) continue;
      drift += 1;
      problems.push(
        `${slug}/${roleCode}: role_permissions DB ≠ katalog — ${extra.length} kode masih terpasang (${extra.slice(0, 6).join(', ')}${extra.length > 6 ? ' …' : ''})` +
          (missing.length > 0 ? `, ${missing.length} kode katalog belum ada di DB (${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ' …' : ''})` : '') +
          '. Jalankan `db:migrate` (0093/0094) lalu ulangi.'
      );
    }
    console.log(`${slug}: ${byRole.size} peran sistem dibandingkan grant-nya dengan katalog · ${drift === 0 ? 'semua sinkron' : `${drift} peran menyimpang`}`);
  }

  // Sanity: uuid seed tidak pernah menabrak UNIQUE (dibuat dengan randomUUID, bukan deterministik).
  if (randomUUID().length !== 36) problems.push('randomUUID tidak tersedia — penulis baris menu wajib membawa id sendiri.');

  finish(problems);
}

function finish(problems: string[]): void {
  if (problems.length === 0) {
    console.log('✅ MENU-LOCK-1 TERKUNCI — register §12 = baris DB = kontrak rute.');
    return;
  }
  console.log(`❌ ${problems.length} selisih:`);
  for (const p of problems) console.log('  · ' + p);
  process.exit(1);
}

main().catch((e) => {
  console.error('❌ VERIFIKASI MENU GAGAL:', (e as Error).message);
  process.exit(1);
});
