import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: {
    default: 'SICA — System Integration Central Academic',
    template: '%s · SICA',
  },
  description:
    'Platform SaaS multi-tenant manajemen akademik & operasional kampus: registrasi, KRS, presensi, penilaian, keuangan, dan pelaporan PDDikti dalam satu sistem.',
  applicationName: 'SICA',
  icons: {
    icon: '/sica-emblem.png',
    apple: '/sica-emblem.png',
  },
  openGraph: {
    title: 'SICA — System Integration Central Academic',
    description: 'Satu platform untuk seluruh siklus akademik kampus. Multi-tenant, aman, dan siap PDDikti.',
    type: 'website',
    siteName: 'SICA',
    images: [{ url: '/sica-logo.png', width: 169, height: 208, alt: 'Logo SICA' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
