import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/RED',
  assetPrefix: '/RED/',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: false,
  },
};

export default nextConfig;
