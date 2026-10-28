/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Минимальный самодостаточный сервер для Docker-образа (.next/standalone)
  output: "standalone",
};
export default nextConfig;
