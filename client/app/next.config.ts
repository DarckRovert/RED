import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Usamos trailingSlash: true para que cada seccion sea una carpeta con su index.html
  // Esto es lo mas estable para el sistema de archivos de Android
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  assetPrefix: '',
  compiler: {
    removeConsole: false,
  },
};

export default nextConfig;
