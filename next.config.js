/** @type {import('next').NextConfig} */
const nextConfig = {
  // React 严格模式：帮助发现潜在问题，在生产环境中提供更好的性能
  reactStrictMode: true,

  // 环境变量配置：准备加载未来的环境变量（API 密钥、部署 URL 等）
  env: {
    // 示例：可以在这里添加环境变量
    // API_BASE_URL: process.env.API_BASE_URL,
    // NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // 图片优化配置
  images: {
    // 允许从外部域名加载图片（例如 CDN、第三方服务等）
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 允许所有 HTTPS 域名（生产环境建议限制为特定域名）
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
    ],
    // 图片格式优化
    formats: ['image/avif', 'image/webp'],
    // 图片尺寸限制
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // 其他优化配置
  // 启用 SWC 压缩（Next.js 12+ 默认启用）
  swcMinify: true,

  // 生产环境优化
  // 压缩输出
  compress: true,

  // 实验性功能（可选）
  // experimental: {
  //   // 启用服务器组件优化
  //   serverComponentsExternalPackages: [],
  // },
};

module.exports = nextConfig;

