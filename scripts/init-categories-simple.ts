/**
 * 分类初始化脚本（简化版）
 * 将以下分类插入数据库的 Category 表：
 * - 名称：加密货币, slug: crypto
 * - 名称：政治, slug: politics
 * - 名称：体育, slug: sports
 * - 名称：金融, slug: finance
 * - 名称：科技, slug: tech
 * 
 * 运行方式: npx ts-node scripts/init-categories-simple.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: '加密货币', slug: 'crypto', displayOrder: 1 },
    { name: '政治', slug: 'politics', displayOrder: 2 },
    { name: '体育', slug: 'sports', displayOrder: 3 },
    { name: '金融', slug: 'finance', displayOrder: 4 },
    { name: '科技', slug: 'tech', displayOrder: 5 }
  ];

  for (const cat of categories) {
    // 🔥 注意：使用 Category 表，不是 MarketCategory 表
    // MarketCategory 是关联表，用于连接 Market 和 Category
    // 而 Category 才是存储分类信息（name, slug）的表
    await prisma.category.upsert({
      where: { slug: cat.slug }, // 使用 slug 作为唯一标识符
      update: {
        name: cat.name, // 如果已存在，更新名称和显示顺序
        displayOrder: cat.displayOrder,
        sortOrder: cat.displayOrder,
        status: 'active',
      },
      create: { 
        slug: cat.slug, 
        name: cat.name,
        displayOrder: cat.displayOrder,
        sortOrder: cat.displayOrder,
        status: 'active',
        level: 0, // 顶级分类
        parentId: null, // 无父分类
      }
    });
    console.log(`✅ 分类已处理: ${cat.name} (${cat.slug})`);
  }
  
  console.log('✅ 数据库分类初始化完成');
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
