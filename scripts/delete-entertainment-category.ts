/**
 * 删除数据库中的 entertainment（娱乐）分类
 * 运行方式: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/delete-entertainment-category.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始删除 entertainment（娱乐）分类...\n');

  try {
    // 查找 entertainment 分类
    const entertainmentCategory = await prisma.category.findFirst({
      where: {
        slug: 'entertainment',
      },
      include: {
        markets: true, // 检查是否有关联的市场
      },
    });

    if (!entertainmentCategory) {
      console.log('✅ 数据库中不存在 entertainment 分类，无需删除。');
      return;
    }

    console.log(`📊 找到分类: ${entertainmentCategory.name} (${entertainmentCategory.slug})`);
    console.log(`   关联市场数量: ${entertainmentCategory.markets.length}`);

    if (entertainmentCategory.markets.length > 0) {
      console.log(`⚠️  警告：该分类还有 ${entertainmentCategory.markets.length} 个关联的市场。`);
      console.log(`   删除分类前，这些市场的分类关联将被移除。`);
    }

    // 删除分类（级联删除会同时删除关联的 MarketCategory 记录）
    await prisma.category.delete({
      where: {
        id: entertainmentCategory.id,
      },
    });

    console.log(`\n✅ 成功删除 entertainment（娱乐）分类！`);
  } catch (error) {
    console.error('❌ 删除失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
