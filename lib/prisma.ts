import { PrismaClient } from '@prisma/client'

// 🔥 性能优化：使用 globalThis 缓存 PrismaClient 实例，防止 Next.js 热重载时创建多个连接
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// 🔥 关键修复：配置 Prisma Client 连接池和超时设置
// 确保使用环境变量中的 DATABASE_URL，支持 Vercel 环境
// 注意：连接池配置通过 DATABASE_URL 中的参数控制（如 ?pgbouncer=true&connection_limit=10）

// 🔥 数据库连接字符串检查和日志
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ [Prisma] DATABASE_URL 环境变量未设置！');
} else {
  // 打印前 20 个字符（保护隐私）
  const preview = databaseUrl.substring(0, 20);
  console.log(`✅ [Prisma] DATABASE_URL 已设置: ${preview}...`);
  
  // 检查 URL 编码问题：如果包含中括号但没有被转义，发出警告
  if (databaseUrl.includes('[') || databaseUrl.includes(']')) {
    if (!databaseUrl.includes('%5B') && !databaseUrl.includes('%5D')) {
      console.warn('⚠️ [Prisma] DATABASE_URL 包含中括号但可能未正确转义！');
      console.warn('   如果连接失败，请确保密码中的特殊字符已正确 URL 编码');
      console.warn('   中括号应编码为: [ -> %5B, ] -> %5D');
    }
  }
}

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // 🔥 强制使用环境变量，确保 Vercel 环境正确连接
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
