import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 ========== 热门分类逻辑问题诊断报告 ==========\n');

  // 1. 检查热门分类的定义
  console.log('=== 1. 热门分类定义 ===');
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

  console.log(`ID: ${hotCategory.id}`);
  console.log(`Name: ${hotCategory.name}`);
  console.log(`Slug: ${hotCategory.slug}\n`);

  // 2. 检查所有关联到热门分类的市场
  console.log('=== 2. 关联到热门分类的市场统计 ===');
  const marketsInHotCategory = await prisma.market_categories.findMany({
    where: {
      categoryId: hotCategory.id,
    },
    include: {
      market: {
        select: {
          id: true,
          title: true,
          isHot: true,
          isActive: true,
          status: true,
          reviewStatus: true,
          templateId: true,
          createdAt: true,
        },
      },
    },
  });

  console.log(`总共 ${marketsInHotCategory.length} 个市场关联了热门分类\n`);

  // 分类统计
  const byIsHot = marketsInHotCategory.filter(mc => mc.market.isHot === true);
  const byCategoryOnly = marketsInHotCategory.filter(mc => mc.market.isHot === false);
  const independentMarkets = marketsInHotCategory.filter(mc => {
    const m = mc.market;
    return !m.templateId || 
           (typeof m.templateId === 'string' && 
            (m.templateId.startsWith('manual-') || m.templateId.startsWith('poly-')));
  });
  const factoryMarkets = marketsInHotCategory.filter(mc => {
    const m = mc.market;
    return m.templateId && 
           typeof m.templateId === 'string' && 
           !m.templateId.startsWith('manual-') && 
           !m.templateId.startsWith('poly-');
  });

  console.log('分类统计:');
  console.log(`  - 同时 isHot=true 且关联热门分类: ${byIsHot.length} 个`);
  console.log(`  - 仅关联热门分类（isHot=false）: ${byCategoryOnly.length} 个`);
  console.log(`  - 独立市场（manual-/poly- 开头）: ${independentMarkets.length} 个`);
  console.log(`  - 工厂市场（其他 templateId）: ${factoryMarkets.length} 个\n`);

  // 3. 检查独立市场为什么在热门分类中
  console.log('=== 3. 独立市场详情（为什么在热门分类中）===');
  independentMarkets.slice(0, 10).forEach((mc, i) => {
    const m = mc.market;
    console.log(`  ${i + 1}. ${m.title}`);
    console.log(`     ID: ${m.id}`);
    console.log(`     templateId: ${m.templateId?.substring(0, 40)}...`);
    console.log(`     isHot: ${m.isHot}`);
    console.log(`     status: ${m.status}`);
    console.log(`     reviewStatus: ${m.reviewStatus}`);
    console.log(`     创建时间: ${m.createdAt}`);
    console.log('');
  });

  // 4. 检查热门市场查询逻辑
  console.log('=== 4. 热门市场查询逻辑分析 ===');
  console.log('查询条件 (buildHotMarketFilter):');
  console.log('  {');
  console.log('    isActive: true,');
  console.log('    status: "OPEN",');
  console.log('    reviewStatus: "PUBLISHED",');
  console.log('    OR: [');
  console.log('      { isHot: true },  // 条件1: 标记为热门的市场');
  console.log('      { categories: { some: { categoryId: "' + hotCategory.id + '" } } }  // 条件2: 关联了热门分类的市场');
  console.log('    ]');
  console.log('  }');
  console.log('\n⚠️  问题：条件2 意味着任何关联了热门分类的市场都会出现在热门列表！\n');

  // 5. 检查审核通过时的逻辑
  console.log('=== 5. 审核通过逻辑分析 ===');
  console.log('文件: app/api/admin/markets/[market_id]/review/route.ts');
  console.log('第 176-182 行:');
  console.log('  // 如果推断失败，使用热门分类作为默认');
  console.log('  if (!finalCategoryId) {');
  console.log('    const hotCategory = await prisma.categories.findFirst({');
  console.log('      where: { OR: [{ slug: "hot" }, { name: { contains: "热门" } }] },');
  console.log('    });');
  console.log('    finalCategoryId = hotCategory?.id;');
  console.log('    console.log(`⚠️ 自动推断失败，使用默认分类（热门）`);');
  console.log('  }');
  console.log('\n⚠️  问题：审核通过时，如果管理员未选择分类，系统会自动关联到"热门"分类！\n');

  // 6. 统计：有多少市场是因为自动推断失败而被关联到热门的
  console.log('=== 6. 统计：可能被错误关联到热门的市场 ===');
  
  // 查找最近创建的独立市场（可能是审核通过的）
  const recentIndependentMarkets = await prisma.market.findMany({
    where: {
      isActive: true,
      status: 'OPEN',
      reviewStatus: 'PUBLISHED',
      OR: [
        { templateId: null },
        { templateId: { startsWith: 'manual-' } },
        { templateId: { startsWith: 'poly-' } },
      ],
      categories: {
        some: {
          categoryId: hotCategory.id,
        },
      },
      isHot: false, // 只统计 isHot=false 但关联了热门分类的
    },
    include: {
      categories: {
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  });

  console.log(`找到 ${recentIndependentMarkets.length} 个 isHot=false 但关联了热门分类的独立市场:`);
  recentIndependentMarkets.forEach((m, i) => {
    const otherCategories = m.categories
      .filter(c => c.category.id !== hotCategory.id)
      .map(c => c.category.name)
      .join(', ');
    
    console.log(`  ${i + 1}. ${m.title}`);
    console.log(`     templateId: ${m.templateId?.substring(0, 30)}...`);
    console.log(`     其他分类: ${otherCategories || '无'}`);
    console.log(`     创建时间: ${m.createdAt}`);
    console.log('');
  });

  // 7. 问题根源总结
  console.log('=== 7. 问题根源分析 ===');
  console.log('\n【问题1】审核通过时的默认分类逻辑：');
  console.log('  位置: app/api/admin/markets/[market_id]/review/route.ts:176-182');
  console.log('  问题: 如果管理员未选择分类，系统会自动推断分类；推断失败时，默认关联到"热门"分类');
  console.log('  影响: 所有审核通过但没有明确分类的市场都会被错误地关联到"热门"分类\n');

  console.log('【问题2】热门市场查询逻辑的"全选"问题：');
  console.log('  位置: lib/marketQuery.ts:buildHotMarketFilter');
  console.log('  查询条件: OR [{ isHot: true }, { categories: { some: { categoryId: 热门分类ID } } }]');
  console.log('  问题: 条件2 会导致任何关联了"热门"分类的市场都出现在热门列表中');
  console.log('  影响: 即使市场原本应该属于"政治"或"体育"分类，只要关联了"热门"，就会出现在热门列表\n');

  console.log('【问题3】分类关联逻辑缺陷：');
  console.log('  位置: app/api/admin/markets/[market_id]/review/route.ts:217-225');
  console.log('  问题: 审核通过时，系统会删除旧分类关联并创建新关联');
  console.log('  如果管理员在审核时选择了"热门"分类，市场就会被关联到热门');
  console.log('  但如果管理员未选择分类，系统也会默认关联到"热门"（见问题1）\n');

  console.log('=== 8. 结论 ===');
  console.log('\n✅ 确认：这是"补丁后遗症"问题');
  console.log('  1. 审核通过时，如果未选择分类，系统默认关联到"热门"（第176-182行）');
  console.log('  2. 热门查询逻辑使用了 OR 条件，导致任何关联了"热门"分类的市场都会出现在热门列表');
  console.log('  3. 这导致"热门"分类变成了"未分类市场"的垃圾桶\n');
  
  console.log('📋 受影响的市场数量:');
  console.log(`  - 关联了热门分类但 isHot=false 的独立市场: ${recentIndependentMarkets.length} 个（最近20个）`);
  console.log(`  - 总关联数: ${marketsInHotCategory.length} 个`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
