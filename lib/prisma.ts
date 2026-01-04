import { PrismaClient } from '@prisma/client'

// 🔥 Prisma 全局单例模式：防止在 Serverless 环境下创建重复连接
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 🔥 兼容性：同时支持默认导出和命名导出
export default prisma
