import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.miomente.de',
        pathname: '/skin/frontend/ultimo/default/images/**',
      },
    ],
  },
  // Disable all fetch caching
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  // Add no-cache headers to API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
