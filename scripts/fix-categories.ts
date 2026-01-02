/**
 * 修复分类数据脚本
 * 将默认分类数据同步到云端数据库
 * 
 * 运行方式: NODE_ENV=production npx tsx scripts/fix-categories.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function main() {
  console.log('=== 开始修复分类数据 ===\n');

  try {
    // 1. 测试数据库连接
    console.log('1. 测试数据库连接...');
    await prisma.$connect();
    console.log('✅ 数据库连接成功\n');

    // 2. 检查现有分类
    console.log('2. 检查现有分类...');
    const existingCategories = await prisma.categories.findMany({
      select: { slug: true, name: true, status: true },
    });
    console.log(`现有分类 (${existingCategories.length} 个):`, existingCategories.map(c => `${c.name} (${c.slug})`));

    // 3. 定义默认分类数据（与 seed.ts 保持一致）
    const defaultCategories = [
      { name: '加密货币', slug: 'crypto', icon: 'Bitcoin', displayOrder: 0 },
      { name: '政治', slug: 'politics', icon: 'Building2', displayOrder: 1 },
      { name: '体育', slug: 'sports', icon: 'Trophy', displayOrder: 2 },
      { name: '金融', slug: 'finance', icon: 'DollarSign', displayOrder: 3 },
      { name: '科技', slug: 'technology', icon: 'Cpu', displayOrder: 4 },
    ];

    // 4. 创建或更新分类
    console.log('\n3. 创建/更新分类...');
    let createdCount = 0;
    let updatedCount = 0;

    for (const categoryData of defaultCategories) {
      try {
        const category = await prisma.categories.upsert({
          where: {
            slug: categoryData.slug,
          },
          update: {
            name: categoryData.name,
            icon: categoryData.icon,
            displayOrder: categoryData.displayOrder,
            sortOrder: categoryData.displayOrder,
            status: 'active',
            updatedAt: new Date(),
          },
          create: {
            id: randomUUID(),
            name: categoryData.name,
            slug: categoryData.slug,
            icon: categoryData.icon,
            displayOrder: categoryData.displayOrder,
            sortOrder: categoryData.displayOrder,
            status: 'active',
            level: 0,
            parentId: null,
            updatedAt: new Date(),
          },
        });
        
        const isNew = !existingCategories.some(c => c.slug === categoryData.slug);
        if (isNew) {
          console.log(`✅ 分类已创建: ${category.name} (${category.slug})`);
          createdCount++;
        } else {
          console.log(`✅ 分类已更新: ${category.name} (${category.slug})`);
          updatedCount++;
        }
      } catch (error: any) {
        console.error(`❌ 处理分类失败: ${categoryData.name} (${categoryData.slug})`, error.message);
      }
    }

    // 5. 验证结果
    console.log('\n4. 验证分类数据...');
    const allCategories = await prisma.categories.findMany({
      where: {
        status: 'active',
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    console.log(`总共 ${allCategories.length} 个激活的分类:`);
    allCategories.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.slug}) - 顺序: ${cat.displayOrder}`);
    });

    if (createdCount > 0 || updatedCount > 0) {
      console.log(`\n✅ 成功处理 ${createdCount + updatedCount} 个分类 (创建: ${createdCount}, 更新: ${updatedCount})`);
    } else {
      console.log('\n✅ 所有分类已存在，无需更新');
    }

    console.log('\n=== 修复完成 ===');
  } catch (error: any) {
    console.error('\n❌ 修复失败:', error.message);
    console.error('错误代码:', error.code);

    if (error.code === 'P1001') {
      console.error('\n⚠️ 数据库连接失败，可能的原因：');
      console.error('1. DATABASE_URL 配置错误');
      console.error('2. 数据库服务器不可达');
      console.error('3. 网络连接问题');
      console.error('\n建议：');
      console.error('- 检查 DATABASE_URL 是否正确');
      console.error('- 检查 Supabase 控制台确认数据库状态');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

