/**
 * Seed pohon menu (`menu_items` × `menu_permissions`) dari definisi `menu-tree.ts`.
 *
 * Idempoten: baris yang sudah cocok tidak ditulis ulang, jadi `version` tidak naik tanpa
 * perubahan nyata. Ditulis di dalam `withTenantContext` karena kedua tabel ber-`FORCE` RLS
 * (`0050`): tanpa `app.current_tenant`, policy `tenant_isolation` menolak semuanya.
 *
 * Yang TIDAK dilakukan berkas ini, dan itu disengaja:
 *  - tidak menciptakan kode izin — `permission_code` adalah FK ke katalog `permissions`,
 *    sehingga daun tanpa izin terdaftar hanya bisa menjadi baris `is_visible = false`
 *    (`API_SPEC §4.17` norma 4; `422 MENU_PERMISSION_UNKNOWN` 116 bila ada yang memaksakan);
 *  - tidak menulis dari resolver ke `menu_items` saat runtime: pohon dilayani **seed**,
 *    bukan lewat endpoint publik (§4.17.2: "tidak ada impor menu dari file", template sistem
 *    dilayani seed migrasi).
 */
import { randomUUID } from 'node:crypto';
import { and, eq, withTenantContext, menuItems, menuPermissions, type TenantTx } from '@sica/database';
import { MENU_LAYER, type MenuSeedNode } from './menu-tree';

export interface MenuSeedResult {
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly grantsInserted: number;
  /** Grant yang tidak lagi ada di definisi — dicabut supaya `menu_permissions` tetap deklaratif. */
  readonly grantsRevoked: number;
  /** Daun tanpa grant terdaftar → barisnya ada (register utuh), tetapi tidak pernah dikirim. */
  readonly hiddenLeaves: number;
  readonly totalLeaves: number;
}

interface MenuRow {
  readonly id: string;
  readonly code: string;
  readonly parentId: string | null;
  readonly label: string;
  readonly labelEn: string | null;
  readonly routeKey: string | null;
  readonly moduleCode: string | null;
  readonly icon: string | null;
  readonly sortOrder: number;
  readonly isVisible: boolean;
  readonly requiresMfa: boolean;
  readonly version: number;
}

interface Counters {
  inserted: number;
  updated: number;
  unchanged: number;
  grantsInserted: number;
  grantsRevoked: number;
  hiddenLeaves: number;
  totalLeaves: number;
}

const PROJECTION = {
  id: menuItems.id,
  code: menuItems.code,
  parentId: menuItems.parentId,
  label: menuItems.label,
  labelEn: menuItems.labelEn,
  routeKey: menuItems.routeKey,
  moduleCode: menuItems.moduleCode,
  icon: menuItems.icon,
  sortOrder: menuItems.sortOrder,
  isVisible: menuItems.isVisible,
  requiresMfa: menuItems.requiresMfa,
  version: menuItems.version,
};

/** Izin yang menjadi allowlist satu daun: `anyOf` bila diisi, kalau tidak `permission`. */
function grantCodes(node: MenuSeedNode): readonly string[] {
  if (node.anyOf && node.anyOf.length > 0) return node.anyOf;
  return node.permission ? [node.permission] : [];
}

async function upsertNode(
  tx: TenantTx,
  tenantId: string,
  node: MenuSeedNode,
  byCode: Map<string, MenuRow>,
  parentCode: string | null,
  createdBy: string | null,
  counters: Counters
): Promise<void> {
  const children = node.children ?? [];
  const isGroup = children.length > 0;
  const codes = grantCodes(node);

  const values = {
    parentId: parentCode ? (byCode.get(parentCode)?.id ?? null) : null,
    label: node.label,
    labelEn: node.labelEn,
    routeKey: node.routeKey ?? null,
    // Grup tidak pernah dilangganan modul: visibilitasnya diturunkan dari anak.
    moduleCode: isGroup ? null : (node.module ?? null),
    icon: node.icon ?? null,
    sortOrder: node.sortOrder ?? 100,
    isVisible: isGroup ? true : codes.length > 0,
    requiresMfa: node.requiresMfa ?? false,
  };

  const found = byCode.get(node.code);
  const menuId = found?.id ?? randomUUID();
  const version = found ? found.version : 1;

  if (!found) {
    await tx.insert(menuItems).values({ id: menuId, tenantId, code: node.code, layer: MENU_LAYER, version, ...values });
    counters.inserted += 1;
  } else {
    const drifted =
      found.parentId !== values.parentId ||
      found.label !== values.label ||
      found.labelEn !== values.labelEn ||
      found.routeKey !== values.routeKey ||
      found.moduleCode !== values.moduleCode ||
      found.icon !== values.icon ||
      found.sortOrder !== values.sortOrder ||
      found.isVisible !== values.isVisible ||
      found.requiresMfa !== values.requiresMfa;
    if (drifted) {
      await tx
        .update(menuItems)
        .set({ ...values, updatedAt: new Date(), version: found.version + 1 })
        .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, menuId)));
      counters.updated += 1;
    } else {
      counters.unchanged += 1;
    }
  }

  // Peta harus langsung memuat baris yang baru ditulis: DFS pre-order menjamin induk
  // sudah terlihat sebelum anaknya jalan, tanpa query penyegar per node.
  byCode.set(node.code, { id: menuId, code: node.code, version, ...values });

  if (isGroup) {
    for (const child of children) {
      await upsertNode(tx, tenantId, child, byCode, node.code, createdBy, counters);
    }
    return;
  }

  counters.totalLeaves += 1;
  if (codes.length === 0) counters.hiddenLeaves += 1;

  // Grant lama yang tidak lagi ada di definisi ikut dicabut. Tanpa langkah ini, menurunkan
  // gerbang sebuah daun (mis. `platform.master.lookup` yang kembali menjadi BELUM sampai
  // izin penerbit nasional didaftar) hanya mengubah `is_visible`, sementara baris
  // `menu_permissions`-nya tetap membuat daun itu terbaca bagi peran kampus yang memegang
  // izin kamus — dan §4.17 norma 4 mengizinkan izin itu di-scope per tenant.
  const stale = await tx
    .select({ permissionCode: menuPermissions.permissionCode })
    .from(menuPermissions)
    .where(
      and(
        eq(menuPermissions.tenantId, tenantId),
        eq(menuPermissions.menuId, menuId)
      )
    );
  for (const row of stale) {
    if (codes.includes(row.permissionCode)) continue;
    await tx
      .delete(menuPermissions)
      .where(
        and(
          eq(menuPermissions.tenantId, tenantId),
          eq(menuPermissions.menuId, menuId),
          eq(menuPermissions.permissionCode, row.permissionCode)
        )
      );
    counters.grantsRevoked += 1;
  }

  for (const code of codes) {
    // `.returning()` wajib: tanpa itu `onConflictDoNothing()` mengirim array kosong untuk
    // BOTH kasus "baris baru dibuat" dan "sudah ada", sehingga penghitung grant selalu 0
    // dan laporan seed menjadi angka yang tidak membuktikan apa pun.
    const res = await tx
      .insert(menuPermissions)
      .values({
        id: randomUUID(),
        tenantId,
        menuId,
        permissionCode: code,
        effect: 'ALLOW',
        scopeKind: '',
        createdBy,
        note: 'Seed MENU-LOCK-1 (register BLUEPRINT_ROLE_BY_ROLE §12)',
      })
      .onConflictDoNothing({ target: [menuPermissions.menuId, menuPermissions.permissionCode, menuPermissions.scopeKind] })
      .returning({ id: menuPermissions.id });
    if (res.length > 0) counters.grantsInserted += 1;
  }
}

/**
 * Tulis satu pohon untuk satu tenant. seluruh baris dibaca sekali di awal lalu peta-nya
 * dimutasi selama DFS — pohon berisi < 100 baris, dan satu query per node akan membuat
 * `seed:dev` menjadi ratusan round-trip ke pooler.
 */
export async function seedMenuTree(
  tenantId: string,
  tree: readonly MenuSeedNode[],
  createdBy: string | null = null
): Promise<MenuSeedResult> {
  const counters: Counters = {
    inserted: 0, updated: 0, unchanged: 0,
    grantsInserted: 0, grantsRevoked: 0, hiddenLeaves: 0, totalLeaves: 0,
  };

  await withTenantContext(tenantId, async (tx) => {
    const rows = await tx.select(PROJECTION).from(menuItems).where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.layer, MENU_LAYER)));
    const byCode = new Map<string, MenuRow>(rows.map((r) => [r.code, r as MenuRow]));
    for (const node of tree) {
      await upsertNode(tx, tenantId, node, byCode, null, createdBy, counters);
    }
  });

  return counters;
}
