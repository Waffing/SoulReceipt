/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 产出 .next/standalone 自包含产物，供 Dockerfile 运行阶段直接 node server.js 启动
  output: "standalone",
};

export default nextConfig;
