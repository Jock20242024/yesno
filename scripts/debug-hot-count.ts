import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始诊断热门市场统计差异...\n');

  // 1. 查询热门市场的原始数据（使用 HOT_MARKET_WHERE 条件）
  const hotMarkets = await prisma.market.findMany({
    where: {
      isActive: true,
      status: 'OPEN',
      reviewStatus: 'PUBLISHED',
      OR: [
        { isHot: true },
        { categories: { some: { categoryId: "-1" } } }
      ]
    },
    select: {
      id: true,
      title: true,
      templateId: true,
      isHot: true,
      period: true,
    },
    orderBy: [
      { isHot: 'desc' },
      { totalVolume: 'desc' }
    ],
  });

  console.log('📊 热门市场原始数据数量:', hotMarkets.length);
  console.log('\n📋 市场列表:');
  hotMarkets.forEach((m, i) => {
    const periodInfo = m.period ? ` period:${m.period}` : '';
    console.log(`  ${i+1}. ${m.title.substring(0, 50)}... | templateId: ${m.templateId || 'null'}${periodInfo} | isHot: ${m.isHot}`);
  });

  // 2. 模拟前端API的聚合逻辑
  const marketsWithTemplate = hotMarkets.filter(m => m.templateId);
  const independentMarkets = hotMarkets.filter(m => !m.templateId);
  
  // 按 templateId + period 分组
  const templateGroups = new Map<string, typeof hotMarkets>();
  marketsWithTemplate.forEach(m => {
    const period = m.period || '15';
    const key = `${m.templateId}-${period}`;
    if (!templateGroups.has(key)) {
      templateGroups.set(key, []);
    }
    templateGroups.get(key)!.push(m);
  });

  console.log(`\n📊 前端API聚合逻辑:`);
  console.log(`  独立市场（无 templateId）: ${independentMarkets.length} 个`);
  console.log(`  聚合系列（按 templateId+period）: ${templateGroups.size} 个`);
  console.log(`  前端显示总数: ${independentMarkets.length + templateGroups.size} 个`);

  // 3. 模拟后台统计逻辑（countUniqueMarketSeries）
  const uniqueTemplateIds = new Set<string>();
  let independentMarketCount = 0;
  
  hotMarkets.forEach(m => {
    if (m.templateId) {
      uniqueTemplateIds.add(m.templateId);
    } else {
      independentMarketCount++;
    }
  });

  console.log(`\n📊 后台统计逻辑（countUniqueMarketSeries）:`);
  console.log(`  独立市场计数: ${independentMarketCount} 个`);
  console.log(`  聚合系列计数（按 templateId）: ${uniqueTemplateIds.size} 个`);
  console.log(`  后台统计总数: ${independentMarketCount + uniqueTemplateIds.size} 个`);

  // 4. 找出差异原因
  console.log(`\n🔍 差异分析:`);
  console.log(`  前端聚合: ${independentMarkets.length + templateGroups.size} 个`);
  console.log(`  后台统计: ${independentMarketCount + uniqueTemplateIds.size} 个`);
  console.log(`  差异: ${(independentMarketCount + uniqueTemplateIds.size) - (independentMarkets.length + templateGroups.size)} 个`);
  
  if (templateGroups.size !== uniqueTemplateIds.size) {
    console.log(`\n⚠️  发现差异原因:`);
    console.log(`  前端按 templateId+period 分组: ${templateGroups.size} 个系列`);
    console.log(`  后台按 templateId 分组: ${uniqueTemplateIds.size} 个系列`);
    console.log(`  差异: ${uniqueTemplateIds.size - templateGroups.size} 个`);
    
    // 找出哪些 templateId 有多个 period
    const templatePeriodMap = new Map<string, Set<string>>();
    marketsWithTemplate.forEach(m => {
      if (!templatePeriodMap.has(m.templateId!)) {
        templatePeriodMap.set(m.templateId!, new Set());
      }
      templatePeriodMap.get(m.templateId!)!.add(m.period || '15');
    });
    
    console.log(`\n  多周期模板详情:`);
    templatePeriodMap.forEach((periods, templateId) => {
      if (periods.size > 1) {
        console.log(`    templateId: ${templateId} 有 ${periods.size} 个周期: ${Array.from(periods).join(', ')}`);
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
