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
  // 打印前 30 个字符（保护隐私，但显示更多信息用于诊断）
  const preview = databaseUrl.substring(0, 30);
  const hasPgbouncer = databaseUrl.includes('pgbouncer=true');
  const portMatch = databaseUrl.match(/:(\d+)\//);
  const port = portMatch ? portMatch[1] : 'unknown';
  
  console.log(`✅ [Prisma] DATABASE_URL 已加载:`);
  console.log(`   预览: ${preview}...`);
  console.log(`   端口: ${port}`);
  console.log(`   pgbouncer: ${hasPgbouncer ? '✅ 已配置' : '❌ 未配置'}`);
  
  // 🔥 检查 URL 编码问题：如果包含中括号但没有被转义，发出警告
  if (databaseUrl.includes('[') || databaseUrl.includes(']')) {
    if (!databaseUrl.includes('%5B') && !databaseUrl.includes('%5D')) {
      console.warn('⚠️ [Prisma] DATABASE_URL 包含中括号但可能未正确转义！');
      console.warn('   如果连接失败，请确保密码中的特殊字符已正确 URL 编码');
      console.warn('   中括号应编码为: [ -> %5B, ] -> %5D');
    } else {
      console.log('✅ [Prisma] DATABASE_URL 中的中括号已正确转义');
    }
  }
  
  // 🔥 确认已转义的字符不会被再次转义
  // PrismaClient 会直接使用 URL，不会再次转义，所以如果已经包含 %5B, %5D 等，应该没问题
  if (databaseUrl.includes('%5B') || databaseUrl.includes('%5D')) {
    console.log('✅ [Prisma] DATABASE_URL 包含已转义的字符，PrismaClient 将直接使用（不会再次转义）');
  }
  
  // 🔥 检查端口配置
  if (port === '6543' && !hasPgbouncer) {
    console.warn('⚠️ [Prisma] 使用 6543 端口但未配置 ?pgbouncer=true，可能导致连接问题');
  }
}

// 🔥 关键修复：确保 DATABASE_URL 能够被正确读取
// PrismaClient 初始化时直接使用环境变量，不会对其进行转义
const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      // 🔥 直接使用环境变量，Prisma 不会再次转义已转义的字符
      url: databaseUrl, // 使用已检查的 databaseUrl 变量
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
