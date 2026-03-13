import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  compiler: {
    // Phase K: Forensics Hardening. Destruye la telemetría P2P
    // en los logs de Android (logcat) eliminando console.log
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
};

export default nextConfig;
