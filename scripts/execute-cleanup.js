/**
 * 执行清理脚本的 Node.js 工具
 * 使用 Prisma Client 执行 SQL 脚本
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function executeCleanup() {
  try {
    console.log('🔥 开始执行清理脚本...\n');

    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, '../CLEANUP-TEST-DATA.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    // 分割 SQL 语句（按分号分割，但保留 DO $$ ... END $$ 块）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 找到 ${statements.length} 条 SQL 语句\n`);

    // 执行每条语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // 跳过注释和空语句
      if (statement.startsWith('--') || statement.length === 0) {
        continue;
      }

      try {
        console.log(`执行语句 ${i + 1}/${statements.length}...`);
        
        // 使用 Prisma 的 $executeRaw 执行 SQL
        await prisma.$executeRawUnsafe(statement);
        
        console.log(`✅ 语句 ${i + 1} 执行成功\n`);
      } catch (error) {
        console.error(`❌ 语句 ${i + 1} 执行失败:`, error.message);
        console.error(`SQL: ${statement.substring(0, 100)}...\n`);
        
        // 如果是 DO $$ 块，尝试使用 $queryRaw
        if (statement.includes('DO $$')) {
          try {
            await prisma.$queryRawUnsafe(statement);
            console.log(`✅ 语句 ${i + 1} 执行成功（使用 $queryRaw）\n`);
          } catch (error2) {
            console.error(`❌ 语句 ${i + 1} 仍然失败:`, error2.message);
          }
        }
      }
    }

    console.log('✅ 清理脚本执行完成！');
  } catch (error) {
    console.error('❌ 执行清理脚本时发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
executeCleanup();

