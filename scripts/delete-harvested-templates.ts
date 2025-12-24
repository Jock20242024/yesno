/**
 * 🗑️ 删除所有由 Polymarket 抓取功能产生的 MarketTemplate 记录
 * 执行动作：删除所有有 seriesId 字段的模板（这些是由 harvester 创建的）
 */

import { prisma } from '../lib/prisma';

async function deleteHarvestedTemplates() {
  try {
    console.log('🔍 [Delete Script] 开始查找所有抓取的模板...');

    // 查找所有有 seriesId 的模板（这些是由 Polymarket 抓取产生的）
    const harvestedTemplates = await prisma.marketTemplate.findMany({
      where: {
        seriesId: {
          not: null, // 有 seriesId 的模板都是抓取的
        },
      },
      select: {
        id: true,
        name: true,
        symbol: true,
        period: true,
        seriesId: true,
      },
    });

    console.log(`📊 [Delete Script] 找到 ${harvestedTemplates.length} 个抓取的模板`);

    if (harvestedTemplates.length === 0) {
      console.log('✅ [Delete Script] 没有需要删除的模板');
      return;
    }

    // 打印要删除的模板列表
    console.log('\n📋 [Delete Script] 将要删除的模板列表:');
    harvestedTemplates.forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.name} (${t.symbol}, ${t.period}分钟, seriesId: ${t.seriesId})`);
    });

    // 删除这些模板
    const deleteResult = await prisma.marketTemplate.deleteMany({
      where: {
        seriesId: {
          not: null,
        },
      },
    });

    console.log(`\n✅ [Delete Script] 成功删除 ${deleteResult.count} 个抓取的模板`);
    console.log('✅ [Delete Script] 任务完成！');
  } catch (error: any) {
    console.error('❌ [Delete Script] 删除失败:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行删除
deleteHarvestedTemplates()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
