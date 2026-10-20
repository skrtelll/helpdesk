import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Минимальный самодостаточный сервер для Docker-образа (.next/standalone)
  output: "standalone",
};

export default nextConfig;
