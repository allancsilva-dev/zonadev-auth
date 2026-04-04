import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? 'http://backend:3001';

const nextConfig: NextConfig = {
  // Gera bundle standalone para uso em Docker sem node_modules no container final.
  // O servidor em .next/standalone/server.js substitui `next start`.
  output: 'standalone',

  async rewrites() {
    return [
      {
        source: '/oauth/:path*',
        destination: `${apiUrl}/oauth/:path*`,
      },
    ];
  },
};

export default nextConfig;
