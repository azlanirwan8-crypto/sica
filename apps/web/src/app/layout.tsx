import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'SICA — Sistem Informasi Kampus All-in-One',
  description: 'Platform SaaS Multi-Tenant Manajemen Akademik & Operasional Kampus',
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
