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
};

export default nextConfig;
