import React from 'react';
import { Sidebar } from '../../components/layout/sidebar';
import { Header } from '../../components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Sidebar navigasi tetap di sisi kiri */}
      <Sidebar />

      {/* Konten utama di sebelah kanan sidebar */}
      <div
        style={{
          marginLeft: '260px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'var(--sica-surface-canvas)',
        }}
      >
        <Header />

        <main style={{ padding: '32px 24px', flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
