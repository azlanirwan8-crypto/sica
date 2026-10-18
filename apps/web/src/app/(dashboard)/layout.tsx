/**
 * Dashboard layout — Velzon "horizontal layout": menu utama berada di baris atas
 * (TopNav), bukan sidebar vertikal. Tidak ada offset kiri; konten memenuhi lebar.
 */
import React from 'react';
import { TopNav } from '../../components/layout/top-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--sica-surface-canvas)',
      }}
    >
      <TopNav />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '28px 24px',
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
