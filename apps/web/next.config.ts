import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sica/contracts', '@sica/database', '@sica/logger'],
  /**
   * Lapisan kerangka Velzon dibangun dengan `@import` di dalam `@layer`
   * (`src/styles/theme.scss`) karena `@use` tidak bisa membungkus keluarannya
   * dalam CSS cascade layer — dan layer itulah yang membuat Bootstrap kalah
   * prioritas dari aturan aplikasi (UI_UX_DESIGN §2.6). dart-sass 1.83 mencetak
   * deprecation untuk pola itu; dipendam di sini supaya log dev tetap terbaca,
   * BUKAN karena kita akan tinggal selamanya: migrasinya bersamaan dengan
   * Bootstrap 6, tercatat sebagai penahan `UI-VLN` di ROADMAP §2.36.
   */
  sassOptions: {
    silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin'],
  },
  experimental: {
    // Optimisasi paket server
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.sica.ac.id',
      },
    ],
  },
};

export default nextConfig;
