/**
 * 清空所有 PENDING 状态的市场记录
 * 运行方式: npx tsx scripts/clear-pending-markets.ts
 */

import { prisma } from '../lib/prisma';

async function clearPendingMarkets() {
  console.log('🗑️  开始清空 PENDING 状态的市场记录...\n');

  try {
    // 查询所有 PENDING 状态的市场
    const pendingMarkets = await prisma.market.findMany({
      where: {
        reviewStatus: 'PENDING',
      },
      select: {
        id: true,
        title: true,
        totalVolume: true,
      },
    });

    console.log(`📊 找到 ${pendingMarkets.length} 条 PENDING 记录\n`);

    if (pendingMarkets.length === 0) {
      console.log('✅ 没有需要清空的 PENDING 记录');
      return;
    }

    // 显示前 10 条记录
    console.log('前 10 条记录预览:');
    pendingMarkets.slice(0, 10).forEach((market, index) => {
      console.log(`  ${index + 1}. ${market.title} (交易量: ${market.totalVolume?.toLocaleString() || 0})`);
    });
    if (pendingMarkets.length > 10) {
      console.log(`  ... 还有 ${pendingMarkets.length - 10} 条记录`);
    }

    // 删除所有 PENDING 状态的市场
    const result = await prisma.market.deleteMany({
      where: {
        reviewStatus: 'PENDING',
      },
    });

    console.log(`\n✅ 成功删除 ${result.count} 条 PENDING 记录`);
    console.log('🎉 数据库已清理，可以重新触发采集！');

  } catch (error) {
    console.error('❌ 清空失败:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearPendingMarkets();
