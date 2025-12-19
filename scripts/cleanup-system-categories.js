/**
 * 清理系统固定分类（数据、热门、所有市场）
 * 这些应该转为系统固定功能，不应存在于数据库中
 * 使用方法: node scripts/cleanup-system-categories.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const SYSTEM_CATEGORIES = ['数据', '热门', '所有市场'];

async function cleanupSystemCategories() {
  try {
    console.log('🔍 正在查找系统固定分类...\n');

    // 查找需要清理的分类
    const categoriesToDelete = await prisma.category.findMany({
      where: {
        name: {
          in: SYSTEM_CATEGORIES,
        },
      },
    });

    if (categoriesToDelete.length === 0) {
      console.log('✅ 没有发现需要清理的系统分类\n');
      return;
    }

    console.log(`❌ 发现 ${categoriesToDelete.length} 个系统分类需要清理:\n`);

    for (const category of categoriesToDelete) {
      console.log(`  - ID: ${category.id}`);
      console.log(`    名称: ${category.name}`);
      console.log(`    Slug: ${category.slug}`);
      console.log(`    状态: ${category.status}`);
      
      // 检查是否有子分类
      const childrenCount = await prisma.category.count({
        where: {
          parentId: category.id,
        },
      });
      
      if (childrenCount > 0) {
        console.log(`    ⚠️  警告：该分类有 ${childrenCount} 个子分类，将一并删除`);
      }

      // 检查是否有关联的市场
      const marketsCount = await prisma.marketCategory.count({
        where: {
          categoryId: category.id,
        },
      });

      if (marketsCount > 0) {
        console.log(`    ⚠️  警告：该分类关联了 ${marketsCount} 个市场`);
        console.log(`    建议：在删除前，请先将这些市场的分类关联迁移到其他分类`);
        console.log(`    是否继续删除？(y/n)`);
        // 这里只是打印警告，实际删除需要手动确认
        continue;
      }

      console.log(`    ✅ 可以安全删除\n`);
    }

    console.log('💡 如果要执行删除，请手动运行以下 SQL 命令:');
    console.log('   (建议先备份数据库)\n');
    
    categoriesToDelete.forEach(category => {
      // 先删除子分类
      console.log(`-- 删除 "${category.name}" 的子分类`);
      console.log(`DELETE FROM categories WHERE parent_id = '${category.id}';`);
      // 删除市场关联
      console.log(`-- 删除 "${category.name}" 的市场关联`);
      console.log(`DELETE FROM market_categories WHERE category_id = '${category.id}';`);
      // 删除分类本身
      console.log(`-- 删除 "${category.name}" 分类`);
      console.log(`DELETE FROM categories WHERE id = '${category.id}';`);
      console.log();
    });

    console.log('⚠️  或者使用 Prisma Studio 手动删除: npx prisma studio\n');

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupSystemCategories();
