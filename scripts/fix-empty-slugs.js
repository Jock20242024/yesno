/**
 * 修复空的 slug
 * 使用方法: node scripts/fix-empty-slugs.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixEmptySlugs() {
  try {
    console.log('🔍 正在查找空的 slug...\n');

    // 查找所有分类
    const allCategories = await prisma.category.findMany();
    
    // 筛选出 slug 为空的分类
    const categoriesWithEmptySlug = allCategories.filter(cat => !cat.slug || cat.slug.trim() === '');

    if (categoriesWithEmptySlug.length === 0) {
      console.log('✅ 没有发现空的 slug\n');
      return;
    }

    console.log(`❌ 发现 ${categoriesWithEmptySlug.length} 个空的 slug:\n`);

    for (const category of categoriesWithEmptySlug) {
      // 生成新的 slug
      let baseSlug = category.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      let finalSlug = baseSlug;
      let slugSuffix = 1;

      // 检查 slug 是否已存在
      while (true) {
        const existing = await prisma.category.findFirst({
          where: {
            slug: finalSlug,
            id: { not: category.id }, // 排除自己
          },
        });

        if (!existing) {
          break;
        }

        finalSlug = `${baseSlug}-${slugSuffix}`;
        slugSuffix++;

        if (slugSuffix > 100) {
          finalSlug = `${baseSlug}-${Date.now()}`;
          break;
        }
      }

      console.log(`  - 分类: "${category.name}" (ID: ${category.id})`);
      console.log(`    旧 slug: "${category.slug || '(空)'}"`);
      console.log(`    新 slug: "${finalSlug}"`);

      // 更新 slug
      await prisma.category.update({
        where: { id: category.id },
        data: { slug: finalSlug },
      });

      console.log(`    ✅ 已更新\n`);
    }

    console.log('✅ 所有空的 slug 已修复\n');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmptySlugs();
