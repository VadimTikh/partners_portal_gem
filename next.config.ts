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
  // Add no-cache headers to prevent stale HTML/chunks issues after deployments
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'X-Accel-Expires', value: '0' },  // Nginx-specific: disable proxy caching
          { key: 'Surrogate-Control', value: 'no-store' },  // CDN/proxy directive
        ],
      },
      {
        // Disable caching for HTML pages to prevent stale chunk references after deployments
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'X-Accel-Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
