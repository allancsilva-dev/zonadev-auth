import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera bundle standalone para uso em Docker sem node_modules no container final.
  // O servidor em .next/standalone/server.js substitui `next start`.
  output: 'standalone',
};

export default nextConfig;
