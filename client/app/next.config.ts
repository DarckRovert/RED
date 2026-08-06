import type { NextConfig } from "next";

// When CAPACITOR_BUILD is "true", use empty basePath for Android local asset loading.
// Otherwise default to '/RED' for GitHub Pages deployment (https://darckrovert.github.io/RED/).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined 
  ? process.env.NEXT_PUBLIC_BASE_PATH 
  : (process.env.CAPACITOR_BUILD === 'true' ? '' : '/RED');

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
