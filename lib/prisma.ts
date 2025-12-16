import { PrismaClient } from '@prisma/client';

/**
 * Prisma 客户端单例实例
 * 
 * 在开发环境中，Next.js 的 Hot Module Replacement (HMR) 可能会导致
 * 创建多个 PrismaClient 实例，这会导致连接池耗尽。
 * 
 * 解决方案：将 PrismaClient 实例存储在 global 对象上，确保在开发环境中
 * 只创建一个实例。
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

