/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Минимальный самодостаточный сервер для Docker-образа (.next/standalone)
  output: "standalone",
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${backend}/api/v1/:path*` }];
  },
};
export default nextConfig;