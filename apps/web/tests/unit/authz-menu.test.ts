/**
 * Unit tests sisa navigasi yang masih milik kode (`modules/authz/menu.ts`) —
 * entitlement status + pintasan Dashboard per permukaan.
 *
 * `buildNav`/`PRIMARY_NAV` dipindahkan ke data oleh `MENU-LOCK-1` (`RD-161`): penyaringan
 * pohon diuji di `menu-resolver.test.ts`, definisi pohonnya di `menu-tree.test.ts`, dan
 * kecocokan definisi ↔ baris DB dicetak `pnpm --filter @sica/web verify:menu`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { activeModuleCodes, menuHref, QUICK_ACTIONS_BY_SURFACE } from '../../src/modules/authz/menu';
import { ALL_MENU_CODES } from '../../src/modules/authz/menu-tree';
import { ROUTE_KEYS } from '../../src/modules/authz/route-keys';

describe('activeModuleCodes — gerbang entitlement', () => {
  it('TRIAL dianggap aktif, DISABLED/EXPIRED/PENDING_PAYMENT tidak', () => {
    const codes = activeModuleCodes([
      { code: 'lms', status: 'TRIAL' },
      { code: 'thesis', status: 'DISABLED' },
      { code: 'graduation', status: 'EXPIRED' },
      { code: 'pmb', status: 'PENDING_PAYMENT' },
      { code: 'cbt', status: 'ACTIVE' },
    ]);
    expect([...codes].sort()).toEqual(['cbt', 'lms']);
  });
});

/**
 * Pintasan Dashboard dipisah per permukaan (`UI_UX_DESIGN §17.2.6`).
 *
 * Sebelum dipisah, satu daftar menawarkan "Pengisian KRS" kepada Admin SICA dan
 * Admin IT Kampus — padahal grant `enrollment.krs.submit` hanya dimiliki STUDENT
 * (terbukti `403 FORBIDDEN` bagi `admin2`) dan layarnya masih mock (`RD-154`).
 */
describe('pintasan Dashboard per permukaan', () => {
  const AKSI_MHS = ['akademik.krs', 'akademik.khs', 'akademik.attendance', 'more.finance'] as const;

  it('permukaan IT dan platform tidak pernah menawarkan aksi milik mahasiswa', () => {
    for (const surface of ['it', 'platform'] as const) {
      const codes = QUICK_ACTIONS_BY_SURFACE[surface].map((a) => a.menuCode);
      for (const forbidden of AKSI_MHS) {
        expect(codes, `${surface} tidak boleh menawarkan ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('permukaan akademik tetap empat pintasan (tidak ada yang hilang diam-diam)', () => {
    expect(QUICK_ACTIONS_BY_SURFACE.akademik.map((a) => a.menuCode)).toEqual([...AKSI_MHS]);
  });

  it('setiap pintasan menunjuk `code` menu, punya label id+en, dan memakai Remix', () => {
    const readNav = (file: string): Record<string, string> =>
      JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/locales', file), 'utf8')).navigation;
    const labels: Record<'id' | 'en', Record<string, string>> = { id: readNav('id.json'), en: readNav('en.json') };

    const knownCodes = new Set<string>(ALL_MENU_CODES);
    for (const [surface, plan] of Object.entries(QUICK_ACTIONS_BY_SURFACE)) {
      expect(plan.length, `${surface} tidak punya pintasan`).toBeGreaterThan(0);
      for (const action of plan) {
        expect(knownCodes, `${surface}/${action.menuCode} bukan code menu dikenal`).toContain(action.menuCode);
        for (const lang of ['id', 'en'] as const) {
          expect(labels[lang][action.labelKey], `${lang} kehilangan label ${action.labelKey}`).toBeTruthy();
        }
        expect(action.icon.startsWith('ri-'), `${action.menuCode} harus ikon Remix`).toBe(true);
      }
    }
  });

  /**
   * `menuHref` adalah satu-satunya penentu "layar mana sudah ada": pintasan yang
   * layarnya belum dibangun menjadi `null` (label "Segera"), bukan URL yang berakhir 404.
   */
  it('menuHref: layar ada → path registri; layar belum → null', () => {
    expect(menuHref('admin.identity.accounts')).toBe(ROUTE_KEYS['admin.users']);
    expect(menuHref('akademik.schedule')).toBeNull();
    expect(menuHref('more.finance')).toBeNull();
    expect(menuHref('code-tidak-ada')).toBeNull();
  });
});
