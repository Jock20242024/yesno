/**
 * 🔥 测试分类计数统计
 * 
 * 用途：验证修复后的分类计数是否能正确统计独立市场
 * 执行：npx tsx scripts/test-category-count.ts
 */

import { prisma } from '../lib/prisma';
import { aggregateMarketsByTemplate, countUniqueMarketSeries } from '../lib/marketAggregation';

async function testCategoryCount() {
  try {
    console.log('🧪 [Test Category Count] 开始测试分类计数统计...\n');
    
    // 获取"热门"分类（用于测试）
    const hotCategory = await prisma.categories.findFirst({
      where: {
        OR: [
          { slug: 'hot' },
          { name: { contains: '热门' } },
        ],
      },
    });
    
    if (!hotCategory) {
      console.log('⚠️  未找到"热门"分类，使用所有市场进行测试\n');
    } else {
      console.log(`📋 测试分类: ${hotCategory.name} (${hotCategory.slug})\n`);
    }
    
    // 查询热门市场（isHot: true 或 totalVolume > 100）
    // 这模拟了 category=hot 时的查询逻辑
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
      },
    });
    
    console.log(`📊 [Test Category Count] 查询到 ${hotMarkets.length} 个热门市场\n`);
    
    // 分类统计
    const marketsWithTemplate = hotMarkets.filter(m => m.templateId);
    const independentMarkets = hotMarkets.filter(m => !m.templateId);
    
    console.log(`📋 市场分类:`);
    console.log(`   有 templateId 的市场: ${marketsWithTemplate.length} 个`);
    console.log(`   独立市场（无 templateId）: ${independentMarkets.length} 个`);
    console.log('\n');
    
    // 测试修复后的计数逻辑
    console.log('🧪 测试修复后的 countUniqueMarketSeries 函数:');
    const uniqueCount = countUniqueMarketSeries(hotMarkets);
    
    // 手动计算预期值
    const uniqueTemplateIds = new Set(
      marketsWithTemplate.map(m => m.templateId).filter(id => id !== null)
    );
    const expectedCount = uniqueTemplateIds.size + independentMarkets.length;
    
    console.log(`   唯一 templateId 数量: ${uniqueTemplateIds.size}`);
    console.log(`   独立市场数量: ${independentMarkets.length}`);
    console.log(`   预期计数: ${expectedCount} (${uniqueTemplateIds.size} + ${independentMarkets.length})`);
    console.log(`   实际计数: ${uniqueCount}`);
    console.log(`   计数正确: ${uniqueCount === expectedCount ? '✅ 是' : '❌ 否'}\n`);
    
    // 测试聚合函数
    console.log('🧪 测试 aggregateMarketsByTemplate 函数:');
    const aggregated = aggregateMarketsByTemplate(hotMarkets);
    const aggregatedIndependent = aggregated.filter(m => !m.templateId);
    
    console.log(`   聚合前总数: ${hotMarkets.length}`);
    console.log(`   聚合后总数: ${aggregated.length}`);
    console.log(`   聚合后独立市场数: ${aggregatedIndependent.length}`);
    console.log(`   所有独立市场都被保留: ${aggregatedIndependent.length === independentMarkets.length ? '✅ 是' : '❌ 否'}\n`);
    
    // 验证：如果显示为"1"说明有问题，应该显示正确的数量
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 [Test Category Count] 验证结果:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (uniqueCount === expectedCount && aggregatedIndependent.length === independentMarkets.length) {
      console.log('✅ 所有测试通过！');
      console.log(`   分类应该显示的计数: ${uniqueCount}`);
      console.log(`   （${uniqueTemplateIds.size} 个聚合项 + ${independentMarkets.length} 个独立项）\n`);
    } else {
      console.log('❌ 测试失败！');
      if (uniqueCount !== expectedCount) {
        console.log(`   计数不匹配: 预期 ${expectedCount}，实际 ${uniqueCount}`);
      }
      if (aggregatedIndependent.length !== independentMarkets.length) {
        console.log(`   独立市场丢失: 预期 ${independentMarkets.length}，实际 ${aggregatedIndependent.length}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ [Test Category Count] 测试失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testCategoryCount();
