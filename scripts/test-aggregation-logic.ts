/**
 * 🔥 测试聚合统计逻辑
 * 
 * 用途：验证修复后的聚合逻辑是否能正确统计独立市场
 * 执行：npx tsx scripts/test-aggregation-logic.ts
 */

import { prisma } from '../lib/prisma';
import { aggregateMarketsByTemplate, countUniqueMarketSeries } from '../lib/marketAggregation';

async function testAggregationLogic() {
  try {
    console.log('🧪 [Test Aggregation Logic] 开始测试聚合统计逻辑...\n');
    
    // 查询热门市场（isHot: true 或 totalVolume > 100）
    const hotMarkets = await prisma.market.findMany({
      where: {
        reviewStatus: 'PUBLISHED',
        isActive: true,
        OR: [
          { isHot: true },
          { totalVolume: { gt: 100 } }
        ]
      },
      select: {
        id: true,
        title: true,
        templateId: true,
        isFactory: true,
        period: true,
        closingDate: true,
        status: true,
        isHot: true,
        totalVolume: true,
      },
    });
    
    console.log(`📊 [Test Aggregation Logic] 查询到 ${hotMarkets.length} 个热门市场\n`);
    
    // 分类统计
    const marketsWithTemplate = hotMarkets.filter(m => m.templateId);
    const independentMarkets = hotMarkets.filter(m => !m.templateId);
    
    console.log(`📋 市场分类:`);
    console.log(`   有 templateId 的市场: ${marketsWithTemplate.length} 个`);
    console.log(`   独立市场（无 templateId）: ${independentMarkets.length} 个`);
    console.log('\n');
    
    // 测试聚合函数
    console.log('🧪 测试 aggregateMarketsByTemplate 函数:');
    const aggregated = aggregateMarketsByTemplate(hotMarkets);
    console.log(`   聚合后数量: ${aggregated.length} 个`);
    console.log(`   聚合前数量: ${hotMarkets.length} 个`);
    console.log(`   聚合率: ${((1 - aggregated.length / hotMarkets.length) * 100).toFixed(2)}%\n`);
    
    // 检查独立市场是否都被保留
    const aggregatedIndependentIds = new Set(
      aggregated.filter(m => !m.templateId).map(m => m.id)
    );
    const originalIndependentIds = new Set(independentMarkets.map(m => m.id));
    
    const allIndependentPreserved = Array.from(originalIndependentIds).every(id => 
      aggregatedIndependentIds.has(id)
    );
    
    console.log(`✅ 独立市场保留检查:`);
    console.log(`   原始独立市场数量: ${originalIndependentIds.size}`);
    console.log(`   聚合后独立市场数量: ${aggregatedIndependentIds.size}`);
    console.log(`   所有独立市场都被保留: ${allIndependentPreserved ? '✅ 是' : '❌ 否'}\n`);
    
    // 测试计数函数
    console.log('🧪 测试 countUniqueMarketSeries 函数:');
    const uniqueCount = countUniqueMarketSeries(hotMarkets);
    console.log(`   唯一系列数: ${uniqueCount}`);
    console.log(`   原始数量: ${hotMarkets.length}`);
    
    // 验证计数逻辑
    const uniqueTemplateIds = new Set(
      marketsWithTemplate.map(m => m.templateId).filter(id => id !== null)
    );
    const expectedCount = uniqueTemplateIds.size + independentMarkets.length;
    
    console.log(`   预期计数: ${expectedCount} (${uniqueTemplateIds.size} 个聚合项 + ${independentMarkets.length} 个独立项)`);
    console.log(`   计数正确: ${uniqueCount === expectedCount ? '✅ 是' : '❌ 否'}\n`);
    
    // 打印独立市场详情
    if (independentMarkets.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 独立市场详情:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      independentMarkets.slice(0, 5).forEach((market, idx) => {
        console.log(`   ${idx + 1}. ${market.title}`);
        console.log(`      ID: ${market.id}`);
        console.log(`      isHot: ${market.isHot ?? false}`);
        console.log(`      totalVolume: ${Number(market.totalVolume)}`);
        console.log(`      在聚合结果中: ${aggregatedIndependentIds.has(market.id) ? '✅ 是' : '❌ 否'}`);
        console.log('');
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [Test Aggregation Logic] 测试总结:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   原始市场数: ${hotMarkets.length}`);
    console.log(`   聚合项数: ${uniqueTemplateIds.size}`);
    console.log(`   独立项数: ${independentMarkets.length}`);
    console.log(`   聚合后总数: ${aggregated.length}`);
    console.log(`   唯一系列数: ${uniqueCount}`);
    console.log(`   独立市场保留: ${allIndependentPreserved ? '✅' : '❌'}`);
    console.log(`   计数正确: ${uniqueCount === expectedCount ? '✅' : '❌'}\n`);
    
  } catch (error) {
    console.error('❌ [Test Aggregation Logic] 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAggregationLogic();
