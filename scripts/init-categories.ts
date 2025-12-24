/**
 * 分类初始化脚本
 * 将以下分类插入数据库的 Category 表：
 * - 名称：加密货币, slug: crypto
 * - 名称：政治, slug: politics
 * - 名称：体育, slug: sports
 * - 名称：金融, slug: finance
 * - 名称：科技, slug: tech
 * 
 * 运行方式: npx ts-node scripts/init-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 分类配置：名称 -> slug -> 显示顺序
const CATEGORIES_TO_INIT = [
  { name: '加密货币', slug: 'crypto', displayOrder: 1 },
  { name: '政治', slug: 'politics', displayOrder: 2 },
  { name: '体育', slug: 'sports', displayOrder: 3 },
  { name: '金融', slug: 'finance', displayOrder: 4 },
  { name: '科技', slug: 'tech', displayOrder: 5 },
];

async function main() {
  console.log('🌱 开始初始化分类数据...');
  
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const categoryData of CATEGORIES_TO_INIT) {
    try {
      // 先检查是否存在相同 name 或 slug 的分类
      const existingByName = await prisma.category.findUnique({
        where: { name: categoryData.name },
      });
      
      const existingBySlug = await prisma.category.findUnique({
        where: { slug: categoryData.slug },
      });
      
      let category;
      
      if (existingBySlug) {
        // 如果 slug 已存在，更新它（确保 name 和 displayOrder 正确）
        category = await prisma.category.update({
          where: { slug: categoryData.slug },
          data: {
            name: categoryData.name,
            displayOrder: categoryData.displayOrder,
            sortOrder: categoryData.displayOrder,
            status: 'active',
          },
        });
        console.log(`✅ 分类已更新（通过 slug）: ${category.name} (${category.slug}) - ID: ${category.id}`);
        updatedCount++;
      } else if (existingByName) {
        // 如果 name 已存在但 slug 不同，更新 slug（迁移到新的 slug）
        category = await prisma.category.update({
          where: { name: categoryData.name },
          data: {
            slug: categoryData.slug,
            displayOrder: categoryData.displayOrder,
            sortOrder: categoryData.displayOrder,
            status: 'active',
          },
        });
        console.log(`✅ 分类已更新（迁移 slug）: ${category.name} (${category.slug}) - ID: ${category.id}`);
        updatedCount++;
      } else {
        // 如果都不存在，创建新分类
        category = await prisma.category.create({
          data: {
            slug: categoryData.slug,
            name: categoryData.name,
            displayOrder: categoryData.displayOrder,
            sortOrder: categoryData.displayOrder,
            status: 'active',
            level: 0, // 顶级分类
            parentId: null, // 无父分类
          },
        });
        console.log(`✅ 分类已创建: ${category.name} (${category.slug}) - ID: ${category.id}`);
        createdCount++;
      }
    } catch (error) {
      console.error(`❌ 处理分类失败: ${categoryData.name} (${categoryData.slug})`, error);
      skippedCount++;
    }
  }

  console.log('\n📊 分类初始化完成！');
  console.log(`   创建: ${createdCount} 个`);
  console.log(`   更新: ${updatedCount} 个`);
  console.log(`   跳过: ${skippedCount} 个`);
  console.log(`   总计: ${CATEGORIES_TO_INIT.length} 个分类\n`);

  // 验证：查询所有分类
  console.log('🔍 验证数据库中的分类:');
  const allCategories = await prisma.category.findMany({
    where: {
      status: 'active',
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  if (allCategories.length === 0) {
    console.warn('⚠️  警告: 数据库中没有找到任何激活的分类');
  } else {
    allCategories.forEach((cat) => {
      console.log(`   - ${cat.name} (${cat.slug}) - 顺序: ${cat.displayOrder} - ID: ${cat.id}`);
    });
  }
}

main()
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
