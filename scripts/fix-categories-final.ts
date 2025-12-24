/**
 * 修复分类脚本（最终版）
 * 将数据库中的分类 ID 改为与前端完全一致的 ID（ID = Slug）
 * 
 * 运行方式: npx tsx scripts/fix-categories-final.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 开始修复分类数据...');
  
  // 🔥 注意：这里应该操作 Category 表，不是 MarketCategory 表
  // MarketCategory 是关联表（连接 Market 和 Category），不是分类本身
  
  // 1. 先删除所有旧的分类（删除关联关系）
  console.log('🗑️  正在删除旧的分类关联关系...');
  await prisma.marketCategory.deleteMany({});
  console.log('✅ 已清空所有分类关联关系');
  
  // 2. 删除所有旧的分类记录
  console.log('🗑️  正在删除旧的分类记录...');
  await prisma.category.deleteMany({});
  console.log('✅ 已清空所有分类记录');
  
  // 3. 插入 ID 必须等于 Slug 的分类（这样前端传 'tech' 就能对上 ID 'tech'）
  console.log('📝 正在创建新分类（ID = Slug）...');
  const categories = [
    { id: 'hot', name: '热门', slug: 'hot', displayOrder: 0, sortOrder: 0, status: 'active' as const, level: 0, parentId: null },
    { id: 'crypto', name: '加密货币', slug: 'crypto', displayOrder: 1, sortOrder: 1, status: 'active' as const, level: 0, parentId: null },
    { id: 'politics', name: '政治', slug: 'politics', displayOrder: 2, sortOrder: 2, status: 'active' as const, level: 0, parentId: null },
    { id: 'sports', name: '体育', slug: 'sports', displayOrder: 3, sortOrder: 3, status: 'active' as const, level: 0, parentId: null },
    { id: 'finance', name: '金融', slug: 'finance', displayOrder: 4, sortOrder: 4, status: 'active' as const, level: 0, parentId: null },
    { id: 'tech', name: '科技', slug: 'tech', displayOrder: 5, sortOrder: 5, status: 'active' as const, level: 0, parentId: null }
  ];

  for (const cat of categories) {
    try {
      await prisma.category.create({ 
        data: {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          displayOrder: cat.displayOrder,
          sortOrder: cat.sortOrder,
          status: cat.status,
          level: cat.level,
          parentId: cat.parentId,
        }
      });
      console.log(`✅ 已创建分类: ${cat.name} (ID: ${cat.id}, Slug: ${cat.slug})`);
    } catch (error) {
      console.error(`❌ 创建分类失败: ${cat.name}`, error);
    }
  }
  
  console.log('\n✅ 数据库分类已重造，ID 现在与前端完全对齐！');
  
  // 验证：显示所有分类
  console.log('\n🔍 验证数据库中的分类:');
  const allCategories = await prisma.category.findMany({
    orderBy: { displayOrder: 'asc' },
  });
  
  allCategories.forEach((cat) => {
    console.log(`   - ${cat.name} (ID: ${cat.id}, Slug: ${cat.slug})`);
  });
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
