import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Not: experimental.turbo / experimental.appDir kaldırıldı.
  // Not: webpack override kaldırıldı; böylece Turbopack dev+build'te devreye girer.
  // (İsterseniz aşağıdaki satırı eklemek opsiyonel)
  turbopack: {},
};

export default nextConfig;
