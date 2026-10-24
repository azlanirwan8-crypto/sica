import type { Metadata, Viewport } from 'next';
// Urutan impor = urutan lapisan: kerangka Bootstrap/Velzon lebih dulu, lalu
// token + utilitas aplikasi (yang tidak ber-layer dan karenanya menang).
import 'remixicon/fonts/remixicon.css';
import '@/styles/theme.scss';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { DesignPanel } from '@/components/layout/design-panel';
import { ThemeProvider, themeInitScript } from '@/components/ui/theme-provider';

export const metadata: Metadata = {
  title: {
    default: 'SICA — Layanan Kampus dalam Pengembangan',
    template: '%s · SICA',
  },
  description:
    'SICA sedang dikembangkan untuk membantu perguruan tinggi mengelola kegiatan akademik dan layanan kampus. Daftar ini menunjukkan rencana, bukan layanan yang sudah siap digunakan.',
  applicationName: 'SICA',
  icons: {
    icon: '/sica-emblem.png',
    apple: '/sica-emblem.png',
  },
  openGraph: {
    title: 'SICA — Layanan Kampus dalam Pengembangan',
    description: 'SICA sedang dikembangkan untuk membantu perguruan tinggi mengelola kegiatan akademik dan layanan kampus.',
    type: 'website',
    siteName: 'SICA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ab39c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      data-bs-theme="light"
      data-topbar="light"
      data-layout-style="default"
      data-layout-width="fluid"
      suppressHydrationWarning
    >
      <head>
        {/* Tema diterapkan sebelum paint pertama supaya tidak ada kedip terang→gelap. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 400/500/600/700 saja — kontrak tipografi melarang 800/900 (UI_UX §2.1). */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          {/* Panel kustomiser Velzon ada di semua halaman template. Ia WAJIB di
              dalam ThemeProvider: di luar, `useTheme()` jatuh ke konteks default
              dan knobnya tampak hidup padahal tidak menulis apa pun. */}
          <DesignPanel />
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
