/**
 * Layanan pohon menu untuk satu peminta (`GET /api/v1/me/menu`, `API_SPEC §4.17.1`).
 *
 * Tiga input, satu urutan tetap (entitlement → izin × penugasan → keadaan). Perakitannya
 * murni dan teruji di `menu-resolver.ts`; berkas ini hanya berbicara dengan PostgreSQL.
 *
 * Dua hal yang menjaga honesti rute ini:
 *  - hak dibaca dari `user_role_assignments` × `role_permissions` (`loadEffectiveAccess`),
 *    BUKAN dari perluasan carrier `member_role`. Akun tanpa penugasan aktif mendapat pohon
 *    kosong, bukan "menu admin-ish" (`SEC-10`).
 *  - baris dibaca di dalam konteks tenant: `menu_items` dan `menu_permissions` ber-`FORCE`
 *    RLS, sehingga tenant lain tidak mungkin terbaca walau filter lupa ditulis (`§21.9`).
 */
import {
  and,
  eq,
  inArray,
  lte,
  or,
  isNull,
  gt,
  withTenantContext,
  academicPeriods,
  menuItems,
  menuPermissions,
} from '@sica/database';
import type { MenuBlock, MenuGrantProjection, MenuRowProjection, MeMenuResponse } from '@sica/contracts';
import { activeModuleCodes } from './menu';
import { MENU_LABEL_KEYS } from './menu-tree';
import { resolveMenu } from './menu-resolver';
import { createDrizzleEntitlementRepository } from '@/modules/entitlement/entitlement.repository';
import { loadEffectiveAccess, type AccessReader } from './rbac-repository';

const entitlementRepo = createDrizzleEntitlementRepository();

/** Modul yang aksinya berjalan di atas periode akademik — tahap 3 menyasar ini. */
const PERIOD_GOVERNED_MODULES = new Set(['enrollment', 'assessment', 'attendance', 'teaching']);

export type MenuLayerFilter = 'WEB' | 'MOBILE';

type MenuTx = Parameters<Parameters<typeof withTenantContext>[1]>[0];

const MENU_PROJECTION = {
  id: menuItems.id,
  code: menuItems.code,
  parentId: menuItems.parentId,
  label: menuItems.label,
  labelEn: menuItems.labelEn,
  description: menuItems.description,
  descriptionEn: menuItems.descriptionEn,
  routeKey: menuItems.routeKey,
  moduleCode: menuItems.moduleCode,
  icon: menuItems.icon,
  sortOrder: menuItems.sortOrder,
  isVisible: menuItems.isVisible,
  requiresMfa: menuItems.requiresMfa,
  version: menuItems.version,
};

/** Baris yang berlaku pada hari `at`: lapisan yang diminta + jendela `effective_from/to`. */
async function loadMenuRows(tx: MenuTx, tenantId: string, layer: MenuLayerFilter, at: Date): Promise<MenuRowProjection[]> {
  const layers = layer === 'WEB' ? ['WEB', 'BOTH'] : ['MOBILE', 'BOTH'];
  const isoDay = at.toISOString().slice(0, 10);
  const rows = await tx
    .select(MENU_PROJECTION)
    .from(menuItems)
    .where(
      and(
        eq(menuItems.tenantId, tenantId),
        inArray(menuItems.layer, layers),
        lte(menuItems.effectiveFrom, isoDay),
        or(isNull(menuItems.effectiveTo), gt(menuItems.effectiveTo, isoDay))
      )
    );
  return rows as MenuRowProjection[];
}

/** Keadaan periode untuk tahap 3, atau `null` bila tidak ada yang memblokir. */
async function periodBlock(tx: MenuTx, tenantId: string): Promise<MenuBlock | null> {
  const rows = await tx
    .select({ status: academicPeriods.status })
    .from(academicPeriods)
    .where(eq(academicPeriods.tenantId, tenantId))
    .limit(8);

  // Tanpa satu pun periode tidak ada keadaan yang bisa dinyatakan; memblokir semuanya akan
  // menjadi karangan. rute tulis yang menolak, bukan pohon menunya (`§4.17` norma 1).
  if (rows.length === 0) return null;
  if (rows.some((r) => r.status === 'OPEN')) return null;

  const statuses = [...new Set(rows.map((r) => r.status))].join('/');
  return {
    code: 'PERIOD_CLOSED',
    reason: `Periode akademik sedang ${statuses}; aksi transaksional dibuka hanya saat periode OPEN.`,
    remedyHref: null,
  };
}

export interface ResolveMenuForRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly layer: MenuLayerFilter;
  readonly depth?: number;
  readonly resolvedAt?: Date;
  readonly accessReader?: AccessReader;
}

export async function resolveMenuForRequest(input: ResolveMenuForRequest): Promise<MeMenuResponse> {
  const now = input.resolvedAt ?? new Date();
  const readAccess = input.accessReader ?? loadEffectiveAccess;

  const [modules, access, loaded] = await Promise.all([
    entitlementRepo.listTenantModules(input.tenantId),
    readAccess(input.tenantId, input.userId),
    withTenantContext(input.tenantId, async (tx) => {
      const rows = await loadMenuRows(tx, input.tenantId, input.layer, now);
      const ids = rows.map((r) => r.id);
      const grants: MenuGrantProjection[] =
        ids.length === 0
          ? []
          : (await tx
              .select({
                menuId: menuPermissions.menuId,
                permissionCode: menuPermissions.permissionCode,
                effect: menuPermissions.effect,
                scopeKind: menuPermissions.scopeKind,
              })
              .from(menuPermissions)
              .where(and(eq(menuPermissions.tenantId, input.tenantId), inArray(menuPermissions.menuId, ids)))).map(
              (r) => ({ ...r, effect: r.effect as 'ALLOW' | 'DENY' })
            );
      const block = await periodBlock(tx, input.tenantId);
      return { rows, grants, block };
    }),
  ]);

  const resolved = resolveMenu({
    rows: loaded.rows,
    grants: loaded.grants,
    activeModules: activeModuleCodes(modules),
    permissions: access.permissions,
    assignmentScopeKinds: new Set(access.grants.map((g) => g.scopeKind)),
    depth: input.depth ?? 4,
    blockFor: (moduleCode) => (moduleCode && loaded.block && PERIOD_GOVERNED_MODULES.has(moduleCode) ? loaded.block : null),
    labelKeys: MENU_LABEL_KEYS,
  });

  return {
    layer: input.layer,
    menuVersion: resolved.menuVersion,
    resolvedAt: now.toISOString(),
    tree: resolved.tree,
    prunedCounts: resolved.prunedCounts,
    registry: resolved.registry,
  };
}
