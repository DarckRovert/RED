import type { NextConfig } from "next";

// When GITHUB_PAGES is "true", use '/RED' basePath for GitHub Pages deployment.
// Otherwise default to empty '' for Android Capacitor local asset loading (http://localhost/...).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined 
  ? process.env.NEXT_PUBLIC_BASE_PATH 
  : (process.env.GITHUB_PAGES === 'true' ? '/RED' : '');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: false,
  },
};

export default nextConfig;
