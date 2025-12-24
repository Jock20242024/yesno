import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始检查"热门"分类是否存在...\n');

  // 1. 检查是否存在 ID 为 "-1" 的分类
  const categoryById = await prisma.category.findUnique({
    where: { id: "-1" },
  });

  console.log('📊 查询结果:');
  if (categoryById) {
    console.log('✅ 找到 ID 为 "-1" 的分类:');
    console.log(JSON.stringify(categoryById, null, 2));
  } else {
    console.log('❌ 未找到 ID 为 "-1" 的分类');
  }

  // 2. 检查是否存在 slug 为 "hot" 的分类
  const categoryBySlug = await prisma.category.findUnique({
    where: { slug: "hot" },
  });

  if (categoryBySlug) {
    console.log('\n✅ 找到 slug 为 "hot" 的分类:');
    console.log(JSON.stringify(categoryBySlug, null, 2));
  } else {
    console.log('\n❌ 未找到 slug 为 "hot" 的分类');
  }

  // 3. 检查是否存在 name 包含"热门"的分类
  const hotCategories = await prisma.category.findMany({
    where: {
      name: { contains: "热门" },
    },
  });

  if (hotCategories.length > 0) {
    console.log(`\n✅ 找到 ${hotCategories.length} 个名称包含"热门"的分类:`);
    hotCategories.forEach((cat, i) => {
      console.log(`  ${i + 1}. ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}`);
    });
  } else {
    console.log('\n❌ 未找到名称包含"热门"的分类');
  }

  // 4. 检查外键约束：尝试查找关联到不存在的 categoryId 的市场
  const marketCategories = await prisma.marketCategory.findMany({
    include: {
      category: true,
    },
    take: 10,
  });

  console.log('\n📊 MarketCategory 关联样本（前10条）:');
  marketCategories.forEach((mc, i) => {
    const categoryInfo = mc.category 
      ? `✅ ${mc.category.name} (${mc.category.id})` 
      : '❌ 关联的分类不存在（外键约束失效）';
    console.log(`  ${i + 1}. marketId: ${mc.marketId}, categoryId: ${mc.categoryId} -> ${categoryInfo}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
