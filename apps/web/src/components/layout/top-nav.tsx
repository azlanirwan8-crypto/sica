'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  ChevronDown,
  Globe,
  GraduationCap,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Menu as MenuIcon,
  Moon,
  Search,
  X,
} from 'lucide-react';
import { getDictionary } from '../../lib/i18n';
import { SicaBrand } from '@/components/brand/sica-brand';

interface MenuLeaf {
  label: string;
  href: string | null;
}

interface MenuEntry {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  href?: string;
  children?: MenuLeaf[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  tenant_admin: 'Administrator Kampus',
  dosen: 'Dosen',
  mahasiswa: 'Mahasiswa',
  staff: 'Tenaga Kependidikan',
};

const iconStyle = (color: string): React.CSSProperties => ({ width: 15, height: 15, color, flexShrink: 0 });

/**
 * Header dua baris mengikuti pola Velzon "layout horizontal":
 *  baris 1 = brand, pencarian, ikon utilitas, dan kartu profil;
 *  baris 2 = menu navigasi berikon dengan dropdown.
 * Tidak ada sidebar vertikal pada mode ini.
 */
export function TopNav({ comingSoonLabel = 'Segera' }: { comingSoonLabel?: string }) {
  const pathname = usePathname();
  const dict = getDictionary('id');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ fullName: string; role: string; tenantName: string } | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success || !json.data) return;
        const d = json.data as { fullName: string; role: string; tenantName: string };
        setIdentity({ fullName: d.fullName, role: d.role, tenantName: d.tenantName });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Tutup dropdown saat pindah rute atau klik di luar area navigasi.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const menu: MenuEntry[] = [
    { id: 'dashboard', label: dict.navigation.dashboard, icon: LayoutDashboard, href: '/dashboard' },
    {
      id: 'academic',
      label: dict.navigation.academic,
      icon: GraduationCap,
      children: [
        { label: dict.navigation.krs, href: '/academic/krs' },
        { label: dict.navigation.khs, href: '/academic/khs' },
        { label: 'Approval DPA', href: '/academic/advisor' },
        { label: dict.navigation.schedule, href: null },
        { label: dict.navigation.attendance, href: null },
      ],
    },
    {
      id: 'more',
      label: 'Lainnya',
      icon: Grid2X2,
      children: [
        { label: dict.navigation.finance, href: null },
        { label: dict.navigation.settings, href: null },
      ],
    },
  ];

  const isEntryActive = (entry: MenuEntry) =>
    entry.href ? pathname === entry.href : (entry.children ?? []).some((c) => c.href && pathname?.startsWith(c.href));

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
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--sica-surface-header)',
        borderBottom: '1px solid var(--sica-border-color)',
        boxShadow: '0 1px 2px rgba(18,22,33,0.04)',
      }}
    >
      {/* ── Baris 1: brand, pencarian, utilitas, profil ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          minHeight: '68px',
          padding: '0 24px',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <SicaBrand height={30} />
        </Link>

        {/* Pencarian */}
        <label
          className="sica-search"
          style={{
            flex: 1,
            maxWidth: '420px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            height: '40px',
            padding: '0 14px',
            borderRadius: 'var(--sica-radius-md)',
            backgroundColor: 'var(--sica-surface-canvas)',
            border: '1px solid transparent',
            color: 'var(--sica-text-muted)',
            transition: 'border-color 160ms ease, background-color 160ms ease',
          }}
        >
          <Search style={{ width: 16, height: 16, flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Cari matakuliah, dosen, atau NIM…"
            aria-label="Pencarian"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '13.5px',
              color: 'var(--sica-text-body)',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <div style={{ flex: 1 }} />

        {/* Ikon utilitas */}
        <div className="sica-utils" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UtilityButton label="Ganti bahasa" title="Bahasa (ID/EN)">
            <Globe style={{ width: 17, height: 17 }} />
          </UtilityButton>
          <UtilityButton label="Modul aplikasi" title="Modul">
            <Grid2X2 style={{ width: 17, height: 17 }} />
          </UtilityButton>
          <UtilityButton label="Layar penuh" title="Layar penuh">
            <Maximize2 style={{ width: 16, height: 16 }} />
          </UtilityButton>
          <UtilityButton label="Mode gelap" title="Mode gelap">
            <Moon style={{ width: 17, height: 17 }} />
          </UtilityButton>
          <UtilityButton label="Notifikasi" title="Notifikasi" badge="3">
            <Bell style={{ width: 17, height: 17 }} />
          </UtilityButton>
        </div>

        {/* Kartu profil */}
        <div
          className="sica-profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 12px 6px 6px',
            borderRadius: 'var(--sica-radius-md)',
            backgroundColor: 'var(--sica-surface-canvas)',
            cursor: 'default',
          }}
        >
          <span
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--sica-radius-md)',
              backgroundColor: 'var(--sica-color-secondary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '15px',
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0)}
          </span>
          <span style={{ lineHeight: 1.2 }}>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--sica-text-heading)' }}>
              {displayName}
            </span>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--sica-text-muted)' }}>{displayRole}</span>
          </span>
          <ChevronDown style={{ width: 14, height: 14, color: 'var(--sica-text-muted)' }} />
        </div>

        <button
          type="button"
          className="sica-topnav-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Buka menu navigasi"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            border: '1px solid var(--sica-border-color)',
            borderRadius: 'var(--sica-radius-md)',
            backgroundColor: '#fff',
            color: 'var(--sica-text-body)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {mobileOpen ? <X style={{ width: 18, height: 18 }} /> : <MenuIcon style={{ width: 18, height: 18 }} />}
        </button>
      </div>

      {/* ── Baris 2: navigasi horizontal ── */}
      <nav
        ref={navRef}
        className="sica-topnav-menu"
        aria-label="Navigasi utama"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '4px',
          padding: '0 24px',
          maxWidth: '1440px',
          margin: '0 auto',
          width: '100%',
          borderTop: '1px solid var(--sica-border-color)',
          overflow: 'visible',
        }}
      >
        {menu.map((entry) => {
          const Icon = entry.icon;
          const active = isEntryActive(entry);
          const open = openMenu === entry.id;
          const color = active ? 'var(--sica-color-primary)' : 'var(--sica-text-body)';

          const trigger = (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13.5px',
                fontWeight: active ? 600 : 500,
                color,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon className="" style={iconStyle(color)} />
              {entry.label}
              {entry.children && (
                <ChevronDown
                  style={{
                    width: 13,
                    height: 13,
                    color,
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: 'transform 180ms ease',
                  }}
                />
              )}
            </span>
          );

          return (
            <div
              key={entry.id}
              className="sica-navitem"
              onMouseEnter={() => entry.children && setOpenMenu(entry.id)}
              onMouseLeave={() => entry.children && setOpenMenu((cur) => (cur === entry.id ? null : cur))}
              style={{ position: 'relative', display: 'flex' }}
            >
              {entry.href ? (
                <Link
                  href={entry.href}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '13px 14px',
                    position: 'relative',
                  }}
                >
                  {trigger}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenMenu((cur) => (cur === entry.id ? null : entry.id))}
                  aria-expanded={open}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '13px 14px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    position: 'relative',
                  }}
                >
                  {trigger}
                </button>
              )}

              {/* Penanda aktif ala Velzon: garis bawah penuh pada item terpilih */}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    left: '14px',
                    right: '14px',
                    bottom: 0,
                    height: '2.5px',
                    borderRadius: '2px 2px 0 0',
                    backgroundColor: 'var(--sica-color-primary)',
                  }}
                />
              )}

              {entry.children && open && (
                <div
                  className="sica-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    minWidth: '248px',
                    padding: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid var(--sica-border-color)',
                    borderRadius: 'var(--sica-radius-lg)',
                    boxShadow: '0 12px 28px rgba(18,22,33,0.12)',
                    zIndex: 60,
                  }}
                >
                  {entry.children.map((child) => {
                    const enabled = Boolean(child.href);
                    const childActive = enabled && pathname?.startsWith(child.href as string);
                    return enabled ? (
                      <Link
                        key={child.label}
                        href={child.href as string}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: 'var(--sica-radius-md)',
                          fontSize: '13.5px',
                          fontWeight: childActive ? 600 : 500,
                          color: childActive ? 'var(--sica-color-primary)' : 'var(--sica-text-body)',
                          backgroundColor: childActive ? 'var(--sica-color-primary-light)' : 'transparent',
                        }}
                      >
                        {child.label}
                      </Link>
                    ) : (
                      <span
                        key={child.label}
                        title="Halaman ini belum tersedia pada versi demo"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: 'var(--sica-radius-md)',
                          fontSize: '13.5px',
                          color: 'var(--sica-text-muted)',
                          cursor: 'not-allowed',
                        }}
                      >
                        {child.label}
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '2px 7px',
                            borderRadius: 'var(--sica-radius-pill)',
                            backgroundColor: 'var(--sica-color-warning-light)',
                            color: '#b57614',
                          }}
                        >
                          {comingSoonLabel}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Institusi aktif + keluar, ditaruh di kanan baris kedua agar tidak menabrak menu */}
        <div className="sica-topnav-tail" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            title={displayTenant}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '5px 11px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--sica-color-primary)',
              backgroundColor: 'var(--sica-color-primary-light)',
              borderRadius: 'var(--sica-radius-md)',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--sica-color-success)', flexShrink: 0 }} />
            {displayTenant}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: 'var(--sica-color-danger)',
              backgroundColor: '#fff',
              border: '1px solid var(--sica-border-color)',
              borderRadius: 'var(--sica-radius-md)',
              cursor: 'pointer',
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            {dict.dashboard.logout}
          </button>
        </div>
      </nav>

      {/* Menu seluler */}
      {mobileOpen && (
        <nav className="sica-topnav-mobile" aria-label="Navigasi seluler" style={{ borderTop: '1px solid var(--sica-border-color)', padding: '8px 16px 16px' }}>
          {menu.flatMap((entry) =>
            entry.href
              ? [{ key: entry.id, label: entry.label, href: entry.href as string | null }]
              : (entry.children ?? []).map((c) => ({ key: `${entry.id}-${c.label}`, label: `${entry.label} · ${c.label}`, href: c.href }))
          ).map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '12px 10px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: pathname === item.href ? 'var(--sica-color-primary)' : 'var(--sica-text-body)',
                  borderBottom: '1px solid var(--sica-border-color)',
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 10px',
                  fontSize: '14px',
                  color: 'var(--sica-text-muted)',
                  borderBottom: '1px solid var(--sica-border-color)',
                }}
              >
                {item.label}
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{comingSoonLabel}</span>
              </span>
            )
          )}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              marginTop: '12px',
              padding: '12px 10px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--sica-color-danger)',
              backgroundColor: 'transparent',
              border: '1px solid var(--sica-border-color)',
              borderRadius: 'var(--sica-radius-md)',
              cursor: 'pointer',
            }}
          >
            <LogOut style={{ width: 15, height: 15 }} />
            {dict.dashboard.logout}
          </button>
        </nav>
      )}
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
    <button
      type="button"
      aria-label={label}
      title={`${title} — belum aktif pada versi demo`}
      style={{
        position: 'relative',
        width: '38px',
        height: '38px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 'var(--sica-radius-md)',
        backgroundColor: 'transparent',
        color: 'var(--sica-text-muted)',
        cursor: 'pointer',
        transition: 'background-color 160ms ease, color 160ms ease',
      }}
    >
      {children}
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 3,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 999,
            backgroundColor: 'var(--sica-color-danger)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
