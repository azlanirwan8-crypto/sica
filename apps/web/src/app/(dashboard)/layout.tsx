/**
 * Kerangka rute aplikasi — struktur Velzon "horizontal layout" (UI_UX_DESIGN §2.6).
 *
 * `#layout-wrapper` > `.topnav` (menu utama di baris atas) > `main.main-content`
 * > `.page-content` (ritme jarak 24px + lebar maksimum) > `.footer`. Kelas-kelas
 * itu kerangka, bukan hiasan: `.navbar-nav`/`.nav-item`/`.nav-link`/`.dropdown-menu`
 * adalah kelas Bootstrap yang sudah diimpor, dan chrome-nya didefinisikan sekali
 * di `src/styles/_velzon-skeleton.scss`.
 */
import React from 'react';
import { getDictionary } from '@/lib/i18n';
import { TopNav } from '../../components/layout/top-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dict = getDictionary('id');

  return (
    <div id="layout-wrapper" className="layout-wrapper">
      <TopNav />

      <main className="main-content flex-1">
        <div className="page-content animate-fade-up">{children}</div>
      </main>

      <footer className="footer">
        <span>{dict.app.footerCopyright}</span>
        <span>{dict.app.footerStatus}</span>
      </footer>
    </div>
  );
}
