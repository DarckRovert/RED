import type { NextConfig } from "next";

const isGhPages = 
  (process.env.GITHUB_PAGES && process.env.GITHUB_PAGES.trim() === 'true') ||
  process.env.NEXT_PUBLIC_BASE_PATH === '/RED';

const basePath = isGhPages ? '/RED' : (process.env.NEXT_PUBLIC_BASE_PATH || '');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: false,
  },
};

export default nextConfig;
