'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  tenantName?: string;
  userName?: string;
  userRole?: string;
}

export function Header({
  tenantName = 'Universitas SICA (Demo)',
  userName = 'Budi Santoso',
  userRole = 'Mahasiswa',
}: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <header
      style={{
        height: '70px',
        backgroundColor: 'var(--sica-surface-header)',
        borderBottom: '1px solid var(--sica-border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--sica-shadow-sm)',
      }}
    >
      {/* Multi-Tenant Switcher / Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--sica-color-primary-light)',
            color: 'var(--sica-color-primary)',
            borderRadius: 'var(--sica-radius-md)',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--sica-color-success)',
            }}
          />
          {tenantName}
        </div>
      </div>

      {/* Profile Avatar & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--sica-text-heading)' }}>
            {userName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sica-text-muted)' }}>{userRole}</div>
        </div>

        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--sica-color-secondary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '16px',
          }}
        >
          {userName.charAt(0)}
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: '8px 14px',
            backgroundColor: 'transparent',
            border: '1px solid var(--sica-border-color)',
            borderRadius: 'var(--sica-radius-md)',
            color: 'var(--sica-color-danger)',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'background-color 150ms',
          }}
        >
          Keluar
        </button>
      </div>
    </header>
  );
}
