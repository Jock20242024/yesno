import { PrismaClient } from '@prisma/client'

// 🔥 性能优化：使用 globalThis 缓存 PrismaClient 实例，防止 Next.js 热重载时创建多个连接
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// 🔥 关键修复：配置 Prisma Client 连接池和超时设置
// 注意：连接池配置通过 DATABASE_URL 中的参数控制（如 ?pgbouncer=true&connection_limit=10）
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// 🔥 性能优化：开发环境下强制缓存到 globalThis，防止每次热重载都创建新实例
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 同时支持 named export 和 default export
export { prisma }
export default prisma
