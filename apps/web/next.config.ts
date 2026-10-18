import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@sica/contracts', '@sica/database', '@sica/logger'],
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
