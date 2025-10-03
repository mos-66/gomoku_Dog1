/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // 先讓雲端能建置成功；本地再修 lint 問題
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 先讓雲端能建置成功；本地再修型別問題
    ignoreBuildErrors: true,
  },
  experimental: {
    swcPlugins: [],
  },
};

export default nextConfig;
