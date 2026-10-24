/**
 * Resolver pohon menu (`API_SPEC §4.17.1`) — murni, tanpa DB dan tanpa HTTP.
 *
 * Tiga tahap penyaringan dengan urutan tetap (tidak boleh dibalik; tiap tahap memotong
 * cabang yang tersisa):
 *   1. **Entitlement modul** — `menu_items.module_code` harus ACTIVE/TRIAL bagi tenant ini.
 *      `module_code` kosong berarti modulnya digate peran, bukan dilangganan (`PRD §5.12.3`),
 *      jadi tahap ini tidak memotongnya.
 *   2. **Izin × penugasan ber-scope** — allowlist `menu_permissions`; DENY menang; `''`
 *      warisi penugasan peran, nilai lain harus terbukti ada pada penugasan subjek.
 *   3. **Keadaan** — periode terkunci menghasilkan `disabled: true` + `blockedBy[]`
 *      ("ada tapi terkunci" adalah informasi sah), bukan hilangnya cabang.
 *
 * Yang TIDAK terjadi di sini, dan itu intinya: penyaringan ini bukan kontrol akses.
 * Rute yang sama sekali tidak muncul di pohon tetap dijaga L1–L6 di server.
 */
import type { MeMenuItem, MenuBlock, MenuGrantProjection, MenuRowProjection } from '@sica/contracts';
import { isKnownRouteKey, routeHref } from './route-keys';

export interface ResolveMenuInput {
  readonly rows: readonly MenuRowProjection[];
  readonly grants: readonly MenuGrantProjection[];
  /** Kode modul dengan status `ACTIVE`/`TRIAL` untuk tenant ini (tahap 1). */
  readonly activeModules: ReadonlySet<string>;
  /** Izin efektif subjek dari `user_role_assignments` × `role_permissions` (tahap 2). */
  readonly permissions: ReadonlySet<string>;
  /** `scope_kind` penugasan aktif subjek; grant ber-scope hanya lolos bila terbukti. */
  readonly assignmentScopeKinds: ReadonlySet<string>;
  /** Kedalaman maksimum (1–4); cabang di bawahnya dipotong dan dihitung. */
  readonly depth: number;
  /** Tahap 3: sebab terkunci untuk satu modul, atau `null` bila tidak ada. */
  readonly blockFor: (moduleCode: string | null) => MenuBlock | null;
  /** Peta `code` menu → kunci i18n statis `navigation.*` (satu-satunya sumber label statis). */
  readonly labelKeys?: Readonly<Record<string, string>>;
}

export interface ResolvedMenu {
  readonly tree: readonly MeMenuItem[];
  readonly prunedCounts: {
    readonly byEntitlement: number;
    readonly byPermission: number;
    readonly byDepthLimit: number;
  };
  readonly registry: { readonly unknownRouteKeys: readonly string[] };
  /** Agregat versi baris: naik pada setiap tulis §4.17.2, dipakai sebagai ETag. */
  readonly menuVersion: number;
  /** Jumlah daun yang benar-benar dikirim ke peminta ini. */
  readonly visibleLeaves: number;
}

const SORT = (a: { readonly sortOrder: number; readonly code: string }, b: { readonly sortOrder: number; readonly code: string }): number =>
  a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);

export function resolveMenu(input: ResolveMenuInput): ResolvedMenu {
  const byId = new Map<string, MenuRowProjection>();
  const childIds = new Map<string, string[]>();
  const roots: MenuRowProjection[] = [];

  for (const row of input.rows) {
    byId.set(row.id, row);
    if (row.parentId) {
      const list = childIds.get(row.parentId) ?? [];
      list.push(row.id);
      childIds.set(row.parentId, list);
    } else {
      roots.push(row);
    }
  }

  const grantsByMenu = new Map<string, MenuGrantProjection[]>();
  for (const grant of input.grants) {
    const list = grantsByMenu.get(grant.menuId) ?? [];
    list.push(grant);
    grantsByMenu.set(grant.menuId, list);
  }

  const pruned = { byEntitlement: 0, byPermission: 0, byDepthLimit: 0 };
  let visibleLeaves = 0;
  // Versi agregat dibaca dari SELURUH baris tenant (bukan hanya yang lolos): ETag tidak
  // boleh berubah hanya karena peminta yang berbeda punya penyaringan yang berbeda.
  const menuVersion = input.rows.reduce((sum, row) => sum + row.version, 0);
  // `registry.unknownRouteKeys` juga dihitung dari seluruh baris, termasuk yang terpotong:
  // sebagai gerbang CI (§4.17.1) ia harus menangkap kunci karangan meskipun tidak ada satu
  // pun peran yang hari ini melihatnya — kunci hantu hari ini adalah 404 besok.
  const unknownRouteKeys = new Set<string>(
    input.rows.filter((row) => row.routeKey && !isKnownRouteKey(row.routeKey)).map((row) => row.routeKey as string)
  );

  /**
   * `null` = cabang dipotong; kalau tidak, item tersusun siap-render.
   * Rekursi membawa kedalaman supaya `depth` kontrak (maksimum 4) tetap terbukti.
   */
  const walk = (row: MenuRowProjection, depth: number): MeMenuItem | null => {
    if (depth > input.depth) {
      pruned.byDepthLimit += 1;
      return null;
    }

    if (row.moduleCode && !input.activeModules.has(row.moduleCode)) {
      pruned.byEntitlement += 1;
      return null;
    }

    const children = (childIds.get(row.id) ?? []).map((id) => byId.get(id)).filter((r): r is MenuRowProjection => !!r);
    children.sort(SORT);
    const isGroup = children.length > 0;

    const allowed = isGroup ? true : holdsGrant(row.id, grantsByMenu);
    if (!allowed || !row.isVisible) {
      // Daun yang tidak terdaftar grant-nya (`is_visible = false`) juga dihitung di sini:
      // §4.17 norma 2 — yang disaring adalah cabang, dan alasan potongnya tetap tahap 2.
      pruned.byPermission += 1;
      return null;
    }

    const keptChildren: MeMenuItem[] = [];
    for (const child of children) {
      const item = walk(child, depth + 1);
      if (item) keptChildren.push(item);
    }

    // Grup tanpa satu pun anak terlihat ikut terpotong (sama seperti navigasi statis lama),
    // supaya header kosong tidak pernah menjanjikan ruang yang hampa.
    if (isGroup && keptChildren.length === 0) {
      pruned.byPermission += 1;
      return null;
    }

    if (!isGroup) visibleLeaves += 1;

    const block = isGroup ? null : input.blockFor(row.moduleCode);
    const labelKey = input.labelKeys?.[row.code] ?? null;

    return {
      code: row.code,
      routeKey: row.routeKey,
      href: routeHref(row.routeKey),
      labelKey,
      label: row.label,
      labelEn: row.labelEn,
      icon: row.icon,
      sortOrder: row.sortOrder,
      moduleCode: row.moduleCode,
      requiresMfa: row.requiresMfa,
      disabled: block !== null,
      blockedBy: block ? [block] : [],
      children: keptChildren,
    };
  };

  function holdsGrant(menuId: string, map: Map<string, MenuGrantProjection[]>): boolean {
    const list = map.get(menuId) ?? [];
    if (list.length === 0) return false;
    const relevant = list.filter(
      (g) => input.permissions.has(g.permissionCode) && (g.scopeKind === '' || input.assignmentScopeKinds.has(g.scopeKind))
    );
    if (relevant.some((g) => g.effect === 'DENY')) return false;
    return relevant.some((g) => g.effect === 'ALLOW');
  }

  roots.sort(SORT);
  const tree: MeMenuItem[] = [];
  for (const root of roots) {
    const item = walk(root, 1);
    if (item) tree.push(item);
  }

  return {
    tree,
    prunedCounts: pruned,
    registry: { unknownRouteKeys: [...unknownRouteKeys].sort() },
    menuVersion,
    visibleLeaves,
  };
}

/**
 * Teks yang tampil: `labelKey` statis menang, lalu `label`/`label_en` dari DB
 * (`§4.17.1` "label dua sumber, satu aturan"). Label `soon` TIDAK diambil di sini —
 * penanda "Segera" adalah hak render klien, bukan bagian dari kontrak pohon.
 */
export function menuLabel(
  item: Pick<MeMenuItem, 'label' | 'labelEn' | 'labelKey'>,
  labels: Readonly<Record<string, string>>,
  lang: 'id' | 'en' = 'id'
): string {
  const staticLabel = item.labelKey ? labels[item.labelKey] : undefined;
  if (staticLabel) return staticLabel;
  if (lang === 'en' && item.labelEn) return item.labelEn;
  return item.label;
}
