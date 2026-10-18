'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDictionary } from '../../lib/i18n';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const dict = getDictionary('id');

  const navItems: NavItem[] = [
    { label: dict.navigation.dashboard, href: '/dashboard', icon: '📊' },
    { label: dict.navigation.krs, href: '/academic/krs', icon: '📝' },
    { label: dict.navigation.khs, href: '/academic/khs', icon: '📜' },
    { label: dict.navigation.schedule, href: '/academic/schedule', icon: '📅' },
    { label: dict.navigation.attendance, href: '/academic/attendance', icon: '📱' },
    { label: dict.navigation.finance, href: '/finance/billing', icon: '💳' },
  ];

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--sica-surface-sidebar)',
        color: 'var(--sica-text-sidebar)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
        boxShadow: 'var(--sica-shadow-card)',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: 'var(--sica-color-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px',
          }}
        >
          S
        </div>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.5px' }}>
          SICA Cloud
        </div>
      </div>

      {/* Navigation Links */}
      <div style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: 'rgba(255, 255, 255, 0.4)',
            padding: '8px 12px',
          }}
        >
          Menu Utama
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--sica-radius-md)',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#ffffff' : 'var(--sica-text-sidebar)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.4)',
        }}
      >
        SICA v1.0 Enterprise
      </div>
    </aside>
  );
}
