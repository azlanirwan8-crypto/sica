'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MeMenuItem, MeMenuResponse } from '@sica/contracts';
import { getDictionary } from '../../lib/i18n';
import { SicaBrand } from '@/components/brand/sica-brand';
import { Avatar } from '@/components/ui/avatar';
import { Dropdown, DropdownItem, DropdownLabel } from '@/components/ui/dropdown';
import { ThemeModeToggle } from '@/components/ui/theme-provider';
import { menuLabel } from '@/modules/authz/menu-resolver';
import { cn } from '@/lib/utils';

interface MenuEntry {
  readonly code: string;
  readonly label: string;
  readonly icon: string;
  readonly href: string | null;
  readonly disabled: boolean;
  readonly groups: readonly { readonly label: string; readonly items: readonly MeMenuItem[] }[];
  readonly items: readonly MeMenuItem[];
}

/**
 * Ikon kerangka memakai Remix Icon (UI_UX_DESIGN §2.6 — kerangka = Remix,
 * `lucide-react` tinggal di layar isi yang belum dimigrasi). Nama glif kini datang
 * dari kolom `menu_items.icon`, bukan peta lokal: `.tools/icon-check.mjs` mengikat
 * setiap nama ke `remixicon.css` supaya tidak ada kotak kosong di layar.
 */

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Administrator Kampus',
  dosen: 'Dosen',
  mahasiswa: 'Mahasiswa',
  staff: 'Tenaga Kependidikan',
};

/**
 * Kerangka atas Velzon "horizontal layout" (§2.6): satu baris `nav.navbar.navbar-header`
 * berisi brand, `ul.navbar-nav.app-menu` (menu ber-`nav-item`/`nav-link`/`dropdown-menu`),
 * lalu `.navbar-actions` (pencarian, utility, pengalih tema, profil).
 *
 * Tidak ada `style={{…}}` di berkas ini: chrome-nya satu rumah di
 * `src/styles/_velzon-skeleton.scss`. Perilaku dropdown tetap primitif React kita
 * (`components/ui/dropdown`) — Bootstrap JS sengaja tidak dipasang
 * (`TECH_CONVENTIONS §6` aturan 8).
 */
export function TopNav({ comingSoonLabel = 'Segera' }: { comingSoonLabel?: string }) {
  const pathname = usePathname();
  const dict = getDictionary('id');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ fullName: string; role: string; tenantName: string } | null>(null);
  const [tree, setTree] = useState<readonly MeMenuItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Profil untuk chip kanan, pohon menu dari server. `menu` TIDAK dihitung lagi di
    // klien: entitlement × izin × keadaan sudah dipotong di `GET /me/menu`, sehingga
    // tidak ada dua penyaringan yang bisa berbeda (RD-161).
    void Promise.all([
      fetch('/api/v1/auth/me').then((res) => (res.ok ? res.json() : null)),
      fetch('/api/v1/me/menu?layer=WEB').then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([me, menu]) => {
        if (cancelled) return;
        if (me?.success && me.data) {
          const d = me.data as { fullName: string; role: string; tenantName: string };
          setIdentity({ fullName: d.fullName, role: d.role, tenantName: d.tenantName });
        }
        if (menu?.success && menu.data) {
          setTree((menu.data as MeMenuResponse).tree);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Tutup dropdown saat pindah rute; menu seluler ikut tertutup agar tidak menggantung.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  /**
   * Aturan kerataan Velzon horizontal (§2.6 + §17.3): satu item pada baris menu = SATU
   * kelompok kerja, dan dropdown-nya hanya berisi daun kelompok itu. Karena pohon data
   * punya tiga kedalaman (`admin` → `admin.identity` → daun), akar yang merupakan wadah
   * murni — semua anaknya grup bertingkat dua, dan akar itu sendiri tidak punya rute
   * (`platform`, `admin`) — **dipromosikan**: tiap anaknya menjadi entri nav tingkat
   * pertama. Akar yang anaknya daun langsung (`akademik`, `more`, dan seluruh layar peran
   * operasional) tetap satu dropdown seperti sebelumnya.
   *
   * Ini bukan hiasan. Sebelum aturan ini ada, enam kelompok Admin IT dirender sebagai
   * `DropdownLabel` di dalam SATU dropdown "Area Admin" — mega menu yang ditolak pemilik
   * pada 2026-10-24 ("kita kan sudah urutkan menu berdasarkan sub menu, kenapa ini
   * digabung semua"), dan juga bukan bentuk Velzon maupun daftar `BLUEPRINT §12`.
   *
   * **Urutan adalah bagian dari kontrak (ralat siklus 11).** Hasil promosi pertama tetap
   * salah baca: urutan akar DB (`dashboard`, `akademik`, `admin`, `more`) membuat kelompok
   * 1…6 terpecah — `Akademik` menyela di antara `Dashboard` dan "Dashboard IT Kampus",
   * sehingga penomoran register tidak lagi terbaca pada layar. Karena itu keluarannya
   * dipecah tiga ember dan dirakit ulang: tautan pendaratan (akar ber-`href` tanpa anak)
   * paling dulu, lalu **seluruh kelompok hasil promosi berdampingan menurut `sortOrder`**
   * (= penomoran §12.1/§12.2), lalu akar lain. Peran operasional yang tidak punya grup
   * terpromosikan (dosen, mahasiswa) tidak berubah urutan sama sekali.
   */
  const menu: MenuEntry[] = useMemo(() => {
    const leavesOf = (node: MeMenuItem) => node.children.filter((c) => c.children.length === 0);
    const groupsOf = (node: MeMenuItem) => node.children.filter((c) => c.children.length > 0);
    const entryFor = (node: MeMenuItem, groups: MenuEntry['groups'], items: readonly MeMenuItem[]): MenuEntry => ({
      code: node.code,
      label: menuLabel(node, dict.navigation),
      icon: node.icon ?? 'ri-apps-2-line',
      href: node.href,
      disabled: node.disabled,
      groups,
      items,
    });

    const landing: MenuEntry[] = [];
    const promoted: MenuEntry[] = [];
    const others: MenuEntry[] = [];

    for (const root of tree) {
      const rootGroups = groupsOf(root);
      const rootLeaves = leavesOf(root);

      if (root.href !== null && rootGroups.length === 0 && rootLeaves.length === 0) {
        landing.push(entryFor(root, [], []));
        continue;
      }

      const promotable =
        root.href === null &&
        rootGroups.length > 0 &&
        rootLeaves.length === 0 &&
        rootGroups.every((g) => leavesOf(g).length === g.children.length);
      if (promotable) {
        for (const group of [...rootGroups].sort((a, b) => a.sortOrder - b.sortOrder)) {
          promoted.push(entryFor(group, [], leavesOf(group)));
        }
        continue;
      }

      others.push(entryFor(root, rootGroups.map((g) => ({ label: menuLabel(g, dict.navigation), items: leavesOf(g) })), rootLeaves));
    }

    return [...landing, ...promoted, ...others];
  }, [tree, dict]);

  const hasTargets = (entry: MenuEntry): boolean =>
    entry.href !== null ||
    entry.items.some((i) => i.href !== null) ||
    entry.groups.some((g) => g.items.some((i) => i.href !== null));

  /**
   * `aria-disabled` hanya untuk pemicu yang benar-benar kosong. Grup yang daunnya sudah ada
   * tetapi layarnya belum tetap boleh dibuka — isinya daftar "Segera" yang sah, dan
   * menandai pemicunya disabled mengumumkan "tidak ada apa pun di sini" kepada pembaca
   * layar. Status per-daun yang menyampaikan itu, bukan status pemicunya.
   */
  const isEmptyTrigger = (entry: MenuEntry): boolean =>
    !hasTargets(entry) && entry.items.length === 0 && entry.groups.length === 0;

  const isEntryActive = (entry: MenuEntry) => {
    if (entry.href) return pathname === entry.href;
    const leaves = [...entry.items, ...entry.groups.flatMap((g) => g.items)];
    return leaves.some((leaf) => leaf.href !== null && pathname?.startsWith(leaf.href));
  };

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  const displayName = identity?.fullName ?? 'Memuat profil…';
  const displayRole = identity ? (ROLE_LABELS[identity.role] ?? identity.role) : 'Pengguna';
  const displayTenant = identity?.tenantName ?? 'SICA';

  return (
    <header className="topnav">
      <nav className="navbar navbar-header navbar-expand-lg" aria-label={dict.app.topbarAria}>
        <div className="container-fluid">
          <Link href="/dashboard" className="navbar-brand" aria-label={dict.app.brandHome}>
            <SicaBrand height={30} />
          </Link>

          <button
            type="button"
            className="navbar-toggler"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={dict.app.toggleMenu}
          >
            <i className={mobileOpen ? 'ri-close-line text-lg' : 'ri-menu-line text-lg'} aria-hidden />
          </button>

          <div className="navbar-actions">
            <label className="navbar-search">
              <i className="ri-search-line" aria-hidden />
              <input type="search" placeholder={dict.app.searchPlaceholder} aria-label={dict.app.searchLabel} />
            </label>

            <UtilityButton label={dict.app.langLabel} title="Bahasa (ID/EN)">
              <i className="ri-global-line text-lg" aria-hidden />
            </UtilityButton>
            <UtilityButton label={dict.app.modulesLabel} title="Modul">
              <i className="ri-apps-2-line text-lg" aria-hidden />
            </UtilityButton>
            <UtilityButton label={dict.app.fullscreenLabel} title="Layar penuh">
              <i className="ri-fullscreen-line" aria-hidden />
            </UtilityButton>
            {/* Alih gelap/terang di baris atas; knob tata letak lainnya ada di
                panel kustomiser — satu permukaan untuk satu status. */}
            <ThemeModeToggle />
            <UtilityButton label={dict.app.notificationsLabel} title="Notifikasi" badge="3">
              <i className="ri-notification-3-line text-lg" aria-hidden />
            </UtilityButton>

            <Dropdown
              align="end"
              width="w-64"
              className="navbar-profile"
              label={dict.app.profileLabel}
              trigger={() => (
                <span className="navbar-profile-text">
                  <Avatar name={displayName} size="sm" rounded="full" status="online" />
                  <span className="text-start">
                    <span className="navbar-profile-name">{displayName}</span>
                    <span className="navbar-profile-role">{displayRole}</span>
                  </span>
                  <i className="ri-arrow-down-s-line navbar-profile-caret" aria-hidden />
                </span>
              )}
            >
              {(close) => (
                <div className="flex flex-col gap-1">
                  <DropdownLabel>{displayTenant}</DropdownLabel>
                  <DropdownItem
                    as="link"
                    onSelect={() => {
                      close();
                      void handleLogout();
                    }}
                    icon={<i className="ri-logout-box-r-line" aria-hidden />}
                  >
                    {dict.dashboard.logout}
                  </DropdownItem>
                </div>
              )}
            </Dropdown>
          </div>
        </div>
      </nav>

      {/* Baris kedua `.navbar-nav-main` — padanan Velzon horizontal: identitas & akun di
          atas, menu kerja pada barisnya sendiri (§2.6, ralat pemilik 2026-10-24). */}
      <nav className="navbar navbar-nav-main navbar-expand-lg" aria-label={dict.app.menuAria}>
        <div className="container-fluid">
          <div className={cn('navbar-collapse', mobileOpen && 'show')}>
            <ul className="navbar-nav app-menu">
              {menu.map((entry) => {
                const active = isEntryActive(entry);
                const open = openMenu === entry.code;
                const isDropdown = entry.groups.length > 0 || entry.items.length > 0;

                const label = (
                  <>
                    <i className={entry.icon} aria-hidden />
                    {entry.label}
                  </>
                );

                const renderItem = (leaf: MeMenuItem) => {
                  const text = menuLabel(leaf, dict.navigation);
                  const lock = leaf.requiresMfa ? <i className="ri-lock-2-line menu-item-lock" aria-hidden title="Aksi tulis pada layar ini menuntut MFA" /> : null;
                  if (leaf.disabled) {
                    return (
                      <span key={leaf.code} className="dropdown-item" aria-disabled="true" data-locked={leaf.blockedBy[0]?.reason ?? ''} title={leaf.blockedBy[0]?.reason ?? ''}>
                        {text}
                        {lock}
                      </span>
                    );
                  }
                  if (leaf.href) {
                    return (
                      <Link
                        key={leaf.code}
                        href={leaf.href}
                        className={cn('dropdown-item', pathname?.startsWith(leaf.href) && 'bg-primary-soft text-primary-hover')}
                      >
                        {text}
                        {lock}
                      </Link>
                    );
                  }
                  return (
                    <span key={leaf.code} className="dropdown-item" aria-disabled="true" data-soon={comingSoonLabel} title={comingSoonLabel}>
                      {text}
                      {lock}
                    </span>
                  );
                };

                return (
                  <li
                    key={entry.code}
                    className={cn('nav-item', isDropdown && 'dropdown')}
                    onMouseEnter={() => isDropdown && setOpenMenu(entry.code)}
                    onMouseLeave={() => isDropdown && setOpenMenu((cur) => (cur === entry.code ? null : cur))}
                  >
                    {entry.href && !isDropdown ? (
                      <Link href={entry.href} className={cn('nav-link', active && 'active')} aria-current={active ? 'page' : undefined}>
                        {label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cn('nav-link', active && 'active')}
                        onClick={() => setOpenMenu((cur) => (cur === entry.code ? null : entry.code))}
                        aria-expanded={isDropdown ? open : undefined}
                        aria-haspopup={isDropdown ? 'true' : undefined}
                        aria-disabled={isEmptyTrigger(entry) ? 'true' : undefined}
                      >
                        {label}
                      </button>
                    )}

                    {isDropdown && open && (
                      <div className="dropdown-menu show" role="menu">
                        {entry.groups.map((group) => (
                          <React.Fragment key={group.label}>
                            <DropdownLabel>{group.label}</DropdownLabel>
                            {group.items.map(renderItem)}
                          </React.Fragment>
                        ))}
                        {entry.items.map(renderItem)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
}

function UtilityButton({
  children,
  label,
  title,
  badge,
}: {
  children: React.ReactNode;
  label: string;
  title: string;
  badge?: string;
}) {
  return (
    <button type="button" className="navbar-btn" aria-label={label} title={`${title} — belum aktif pada versi demo`}>
      {children}
      {badge && <span className="navbar-btn-badge">{badge}</span>}
    </button>
  );
}
