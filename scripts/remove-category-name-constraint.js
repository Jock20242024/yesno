// 临时脚本：删除 Category 表中 name 字段的唯一约束
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function removeConstraint() {
  try {
    console.log('🔧 正在删除 categories_name_key 约束...');
    
    // 使用 Prisma 执行原始 SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
    `);
    
    console.log('✅ 约束删除成功！');
    
    // 验证约束是否已删除
    const result = await prisma.$queryRawUnsafe(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'categories'::regclass 
        AND conname = 'categories_name_key';
    `);
    
    if (result.length === 0) {
      console.log('✅ 验证：约束已成功删除');
    } else {
      console.log('⚠️  警告：约束可能仍然存在', result);
    }
    
  } catch (error) {
    console.error('❌ 删除约束时出错:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeConstraint();
