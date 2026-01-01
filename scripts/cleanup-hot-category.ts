import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清理误入热门分类的市场...\n');

  // 1. 找到热门分类
  const hotCategory = await prisma.categories.findFirst({
    where: {
      OR: [
        { slug: '-1' },
        { slug: 'hot' },
        { name: { contains: '热门' } },
      ],
    },
  });

  if (!hotCategory) {
    console.log('❌ 未找到热门分类');
    return;
  }

  console.log(`📋 热门分类: ${hotCategory.name} (ID: ${hotCategory.id})\n`);

  // 2. 查找所有 isHot: false 但关联了热门分类的市场
  const marketsToClean = await prisma.market.findMany({
    where: {
      isHot: false,
      categories: {
        some: {
          categoryId: hotCategory.id,
        },
      },
    },
    include: {
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  console.log(`🔍 找到 ${marketsToClean.length} 个需要清理的市场:\n`);

  if (marketsToClean.length === 0) {
    console.log('✅ 没有需要清理的市场');
    return;
  }

  // 3. 显示需要清理的市场
  marketsToClean.forEach((market, i) => {
    const otherCategories = market.categories
      .filter(c => c.category.id !== hotCategory.id)
      .map(c => c.category.name)
      .join(', ');
    
    console.log(`  ${i + 1}. ${market.title}`);
    console.log(`     ID: ${market.id}`);
    console.log(`     isHot: ${market.isHot}`);
    console.log(`     其他分类: ${otherCategories || '无'}`);
    console.log('');
  });

  // 4. 移除这些市场的热门分类关联
  console.log('🧹 开始移除热门分类关联...\n');

  let cleanedCount = 0;

  for (const market of marketsToClean) {
    await prisma.market_categories.deleteMany({
      where: {
        marketId: market.id,
        categoryId: hotCategory.id,
      },
    });
    
    cleanedCount++;
    console.log(`✅ 已移除市场 "${market.title}" 的热门分类关联`);
  }

  console.log(`\n✅ 清理完成！共处理 ${cleanedCount} 个市场`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
