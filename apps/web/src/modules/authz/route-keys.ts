/**
 * Registri kunci rute (`API_SPEC §4.17.1` — "`routeKey` adalah kunci registri statis").
 *
 * Pemilik nama path HANYA berkas ini. `menu_items.route_key` menyimpan kunci, bukan path,
 * sehingga layar tidak pernah mengarang URL dari `code`/`label` dan path yang berubah
 * cukup diedit satu kali di sini. Kunci yang tidak ada di registri = layar belum dibangun:
 * menu tetap dirender, tetapi sebagai label "Segera" yang tidak dapat diklik — sama seperti
 * perlakuan `href: null` pada navigasi lama.
 *
 * Aturan yang mencegah janji 404: satu kunci hanya boleh menunjuk halaman yang benar-benar
 * ada di `apps/web/src/app/(dashboard)/**`. Uji `menu-tree.test.ts` membandingkan isi
 * registri ini dengan daftar berkas `page.tsx`, sehingga menambah path hantu menjadi gagal
 * build, bukan gagal saat pengguna mengklik.
 */
export const ROUTE_KEYS = {
  'app.dashboard': '/dashboard',
  'academic.krs': '/academic/krs',
  'academic.khs': '/academic/khs',
  'academic.advisor': '/academic/advisor',
  'admin.users': '/admin/pengguna',
  'admin.organization': '/admin/organisasi',
  'admin.rbac': '/admin/hak-akses',
  'admin.requests': '/admin/permintaan-hak',
  'admin.parameters': '/admin/pengaturan/parameter',
  'platform.tenants': '/platform/tenants',
  'platform.audit': '/platform/audit',
  'platform.support': '/platform/support',
} as const;

export type RouteKey = keyof typeof ROUTE_KEYS;

const REGISTRY: ReadonlyMap<string, string> = new Map(Object.entries(ROUTE_KEYS));

/** Path untuk satu kunci registri; `null` bila kuncinya tidak dikenal atau kosong. */
export function routeHref(key: string | null | undefined): string | null {
  if (!key) return null;
  return REGISTRY.get(key) ?? null;
}

export function isKnownRouteKey(key: string): boolean {
  return REGISTRY.has(key);
}

/** Kunci yang terdaftar — dipakai gerbang verifikasi dan pesan diagnostik. */
export const REGISTERED_ROUTE_KEYS: readonly string[] = [...REGISTRY.keys()].sort();
