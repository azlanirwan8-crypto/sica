/**
 * Unit tests resolver pohon menu (`API_SPEC §4.17.1`) — tiga tahap penyaringan dan
 * empat norma yang membuatnya berbeda dari "sembunyikan tombol".
 *
 * Semua fixture sintetis: tidak ada DB, tidak ada HTTP. Kewajiban pembuktian bahwa
 * penyaringan ini BUKAN kontrol akses dijawab di `e2e-guard-order` (rute tetap 403/404
 * walau daun tidak tampil), bukan di sini.
 */
import { describe, it, expect } from 'vitest';
import { menuLabel, resolveMenu, type ResolveMenuInput } from '../../src/modules/authz/menu-resolver';
import type { MeMenuItem, MenuGrantProjection, MenuRowProjection } from '@sica/contracts';

function row(partial: Partial<MenuRowProjection> & Pick<MenuRowProjection, 'id' | 'code'>): MenuRowProjection {
  return {
    parentId: null,
    label: partial.code,
    labelEn: null,
    routeKey: null,
    moduleCode: null,
    icon: null,
    sortOrder: 100,
    isVisible: true,
    requiresMfa: false,
    version: 1,
    ...partial,
  };
}

function grant(menuId: string, permissionCode: string, effect: 'ALLOW' | 'DENY' = 'ALLOW', scopeKind = ''): MenuGrantProjection {
  return { menuId, permissionCode, effect, scopeKind };
}

const AKAR = row({ id: 'g1', code: 'admin', label: 'Area Admin', sortOrder: 30 });
const DAUN = row({ id: 'l1', code: 'admin.users', parentId: 'g1', label: 'Pengguna', routeKey: 'admin.users', moduleCode: 'identity', sortOrder: 10 });
const DAUN_HILANG = row({ id: 'l2', code: 'admin.sso', parentId: 'g1', label: 'SSO', isVisible: false, sortOrder: 20 });

function input(over: Partial<ResolveMenuInput> = {}): ResolveMenuInput {
  return {
    rows: [AKAR, DAUN, DAUN_HILANG],
    grants: [grant('l1', 'identity.user.view')],
    activeModules: new Set(['identity', 'academic']),
    permissions: new Set(['identity.user.view']),
    assignmentScopeKinds: new Set(['TENANT']),
    depth: 4,
    blockFor: () => null,
    labelKeys: { 'admin.users': 'adminUsers', admin: 'admin' },
    ...over,
  };
}

function leafCodes(nodes: readonly MeMenuItem[]): string[] {
  return nodes.flatMap((n) => (n.children.length === 0 ? [n.code] : leafCodes(n.children)));
}

describe('tahap 1 — entitlement', () => {
  it('daun ber-modul yang tidak ACTIVE/TRIAL dipotong dan dihitung', () => {
    const r = resolveMenu(input({ activeModules: new Set(['academic']) }));
    expect(leafCodes(r.tree)).not.toContain('admin.users');
    expect(r.prunedCounts.byEntitlement).toBe(1);
    // Grup tanpa anak terlihat ikut terpotong: header kosong bukan navigasi.
    expect(r.tree).toEqual([]);
  });

  it('moduleCode null = digate peran, tidak pernah dipotong entitlement', () => {
    const r = resolveMenu(
      input({
        rows: [row({ id: 'x', code: 'platform.tenants', routeKey: 'platform.tenants' })],
        grants: [grant('x', 'platform.tenant.view')],
        permissions: new Set(['platform.tenant.view']),
        activeModules: new Set<string>(),
      })
    );
    expect(leafCodes(r.tree)).toEqual(['platform.tenants']);
    expect(r.prunedCounts.byEntitlement).toBe(0);
  });
});

describe('tahap 2 — izin × penugasan ber-scope', () => {
  it('daun tanpa grant tidak dikirim (allowlist), bukan dikirim dengan tanda tersembunyi', () => {
    const r = resolveMenu(input({ grants: [] }));
    expect(r.tree).toEqual([]);
    // 2 daun terpotong + 1 grup yang kehilangan seluruh anaknya.
    expect(r.prunedCounts.byPermission).toBe(3);
    expect(JSON.stringify(r)).not.toContain('"visible":false');
  });

  it('is_visible=false tetap dipotong meski grant-nya ada', () => {
    const r = resolveMenu(input({ grants: [grant('l1', 'identity.user.view'), grant('l2', 'identity.user.view')] }));
    expect(leafCodes(r.tree)).toEqual(['admin.users']);
  });

  it('DENY menang atas ALLOW', () => {
    const r = resolveMenu(input({ grants: [grant('l1', 'identity.user.view'), grant('l1', 'identity.user.view', 'DENY')] }));
    expect(r.tree).toEqual([]);
  });

  it('grant ber-scope butuh penugasan dengan scope_kind yang terbukti', () => {
    const scoped = input({ grants: [grant('l1', 'identity.user.view', 'ALLOW', 'ORG')] });
    expect(resolveMenu(scoped).tree).toEqual([]);
    expect(resolveMenu({ ...scoped, assignmentScopeKinds: new Set(['ORG']) }).tree.length).toBe(1);
  });

  it('izin yang dipegang bukan anggota grant tidak membuka daun', () => {
    const r = resolveMenu(input({ permissions: new Set(['identity.role.view']) }));
    expect(r.tree).toEqual([]);
  });
});

describe('tahap 3 — keadaan & kedalaman', () => {
  it('periode terkunci membuat cabang disabled + blockedBy, bukan hilang', () => {
    const block = { code: 'PERIOD_CLOSED', reason: 'Periode LOCKED', remedyHref: null };
    const r = resolveMenu(input({ blockFor: (m) => (m === 'identity' ? block : null) }));
    const leaf = r.tree[0]?.children[0];
    expect(leaf?.disabled).toBe(true);
    expect(leaf?.blockedBy).toEqual([block]);
  });

  it('depth menolak cabang di bawah batas dan menghitungnya', () => {
    // Fixture: akar (kedalaman 1) → dua daun (kedalaman 2). `depth: 1` hanya boleh
    // menyisakan akar, dan akar tanpa anak tersisa ikut terpotong.
    const r = resolveMenu(input({ depth: 1 }));
    expect(r.tree).toEqual([]);
    expect(r.prunedCounts.byDepthLimit).toBe(2);
  });

  it('route_key di luar registri muncul di registry.unknownRouteKeys (gerbang CI)', () => {
    const r = resolveMenu(
      input({
        rows: [row({ id: 'z', code: 'hantu', routeKey: 'admin.hantu' })],
        grants: [grant('z', 'identity.user.view')],
      })
    );
    expect(r.registry.unknownRouteKeys).toEqual(['admin.hantu']);
    expect(r.tree[0]?.href).toBeNull();
  });

  it('href dihitung dari registri, bukan dirakit dari code', () => {
    const r = resolveMenu(input());
    expect(r.tree[0]?.children[0]?.href).toBe('/admin/pengguna');
  });
});

describe('urutan, versi, dan label', () => {
  it('ORDER BY sort_order, code — bukan uuid', () => {
    const a = row({ id: 'a', code: 'k.zeta', sortOrder: 10 });
    const b = row({ id: 'b', code: 'k.alpha', sortOrder: 10 });
    const c = row({ id: 'c', code: 'k.mid', sortOrder: 5 });
    const r = resolveMenu(
      input({
        rows: [row({ id: 'g', code: 'k' }), a, b, c],
        grants: [grant('a', 'identity.user.view'), grant('b', 'identity.user.view'), grant('c', 'identity.user.view')],
      })
    );
    expect(leafCodes(r.tree)).toEqual(['k.mid', 'k.alpha', 'k.zeta']);
  });

  it('menuVersion = jumlah versi seluruh baris (stabil terhadap siapa yang bertanya)', () => {
    const r = resolveMenu(input({ rows: [row({ id: 'g1', code: 'admin', version: 2 }), row({ id: 'l1', code: 'admin.users', parentId: 'g1', version: 3, routeKey: 'admin.users', moduleCode: 'identity' })] }));
    expect(r.menuVersion).toBe(5);
  });

  it('labelKey statis menang, lalu label DB, dan label_en hanya untuk bahasa en', () => {
    expect(menuLabel({ labelKey: 'adminUsers', label: 'Pengguna', labelEn: 'Users' }, { adminUsers: 'Pengguna (statik)' }, 'id')).toBe('Pengguna (statik)');
    expect(menuLabel({ labelKey: null, label: 'Pengguna', labelEn: 'Users' }, {}, 'id')).toBe('Pengguna');
    expect(menuLabel({ labelKey: null, label: 'Pengguna', labelEn: 'Users' }, {}, 'en')).toBe('Users');
    expect(menuLabel({ labelKey: 'hilang', label: 'Pengguna', labelEn: 'Users' }, {}, 'en')).toBe('Users');
  });
});
