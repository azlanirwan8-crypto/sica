/**
 * Sisa navigasi yang memang milik kode (`RBAC_MATRIX §6.5`, celah G-05).
 *
 * `PRIMARY_NAV` + `buildNav()` dahulu hidup di berkas ini dan **telah dihapus** oleh
 * `MENU-LOCK-1` (`RD-161`): pohon menu sekarang adalah baris `menu_items` ×
 * `menu_permissions` yang disaring server di `menu-resolver.ts` dan dikirim lewat
 * `GET /api/v1/me/menu`. Mempertahankan daftar navigasi kedua di sini akan menghidupkan
 * kembali pola `RD-32` — satu konsep dengan dua sumber kebenaran, yang salah satunya
 * selalu lebih busuk dari yang lain.
 *
 * Yang tersisa hanya dua hal yang bukan menu:
 *  - `activeModuleCodes` — pemetaan status entitlement → kode modul yang boleh muncul;
 *  - `QUICK_ACTIONS_BY_SURFACE` — kartu **pintasan** Dashboard per permukaan
 *    (`UI_UX §17.2.6`), yang menunjuk `code` menu, bukan menyalin pohonnya.
 */
import type { ModuleCode } from '@sica/contracts';
import { MENU_ROUTE_KEYS } from './menu-tree';
import { routeHref } from './route-keys';

/** Status modul tenant yang boleh memunculkan menu. */
const VISIBLE_MODULE_STATUS = new Set(['ACTIVE', 'TRIAL']);

/** Saring dari daftar modul mentah `GET /tenant/modules`. */
export function activeModuleCodes(modules: readonly { readonly code: string; readonly status: string }[]): ReadonlySet<string> {
  return new Set<ModuleCode>(modules.filter((m) => VISIBLE_MODULE_STATUS.has(m.status)).map((m) => m.code as ModuleCode));
}

/**
 * Permukaan layar setelah login — menentukan grid kartu dan pintasan Dashboard
 * (`UI_UX_DESIGN §17.2.6`: Super Admin dan Admin IT punya delapan kartunya sendiri,
 * bukan agregat akademik yang dipakai BAAK/BAUK).
 */
export type DashboardSurface = 'akademik' | 'platform' | 'it';

/**
 * Pintasan Dashboard per permukaan.
 *
 * Daftar ini sebelumnya tunggal, sehingga Admin SICA dan Admin IT Kampus ditawari
 * "Pengisian KRS" — aksi yang grant-nya hanya dimiliki STUDENT
 * (`enrollment.krs.submit`, terbukti `403 FORBIDDEN` bagi `admin2`) di atas layar
 * yang masih mock (`RD-154`). Menawarkan aksi yang pasti ditolak server adalah
 * affordance palsu, bukan kenyamanan.
 *
 * `menuCode` menunjuk `code` di `menu-tree.ts`; path dihitung dari `route_key` baris itu
 * lewat registri rute, jadi pintasan tidak pernah menjanjikan halaman yang berakhir 404.
 * Judul dibaca dari `navigation.*` (`labelKey`), sehingga tidak ada daftar label kedua.
 * `descKey` hanya ada untuk pintasan akademik yang memang punya keterangan di `dashboard.*`.
 */
export const QUICK_ACTIONS_BY_SURFACE: Readonly<
  Record<
    DashboardSurface,
    readonly {
      readonly menuCode: string;
      readonly labelKey: string;
      readonly icon: string;
      readonly descKey?: string;
    }[]
  >
> = {
  akademik: [
    { menuCode: 'akademik.krs', labelKey: 'krs', icon: 'ri-file-text-line', descKey: 'descKrs' },
    { menuCode: 'akademik.khs', labelKey: 'khs', icon: 'ri-book-2-line', descKey: 'descKhs' },
    { menuCode: 'akademik.attendance', labelKey: 'attendance', icon: 'ri-qr-scan-2-line', descKey: 'descAttendance' },
    { menuCode: 'more.finance', labelKey: 'finance', icon: 'ri-bank-card-line', descKey: 'descBilling' },
  ],
  platform: [
    { menuCode: 'platform.licensing.directory', labelKey: 'platformTenants', icon: 'ri-building-4-line' },
    { menuCode: 'platform.monitoring.security_log', labelKey: 'platformAudit', icon: 'ri-shield-check-line' },
    { menuCode: 'platform.governance.support', labelKey: 'platformSupport', icon: 'ri-lifebuoy-line' },
  ],
  it: [
    { menuCode: 'admin.identity.accounts', labelKey: 'adminUsers', icon: 'ri-team-line' },
    { menuCode: 'admin.identity.rbac', labelKey: 'adminRbac', icon: 'ri-key-2-line' },
    { menuCode: 'admin.identity.requests', labelKey: 'adminRequests', icon: 'ri-checkbox-circle-line' },
    { menuCode: 'admin.parameters.system', labelKey: 'adminParameters', icon: 'ri-tools-line' },
  ],
};

/** Path untuk satu `code` menu, atau `null` bila layarnya belum dibangun ("Segera"). */
export function menuHref(menuCode: string): string | null {
  return routeHref(MENU_ROUTE_KEYS[menuCode] ?? null);
}
