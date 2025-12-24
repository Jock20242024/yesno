import { PrismaClient } from '@prisma/client'

// 🔥 性能优化：使用 globalThis 缓存 PrismaClient 实例，防止 Next.js 热重载时创建多个连接
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// 🔥 关键修复：在开发环境下必须使用 global 缓存，防止热重载导致连接泄漏
const prisma = globalForPrisma.prisma || new PrismaClient()

// 🔥 性能优化：开发环境下强制缓存到 globalThis，防止每次热重载都创建新实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 同时支持 named export 和 default export
export { prisma }
export default prisma
