import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // build sırasında eslint hataları derlemeyi BLOKLAMASIN
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
