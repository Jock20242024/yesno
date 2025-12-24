/**
 * 临时脚本：将所有 INTERNAL 来源且 reviewStatus 为 PENDING 的市场更新为 PUBLISHED
 * 这样之前创建的市场就能在管理页面显示了
 * 
 * 执行方式：npx tsx scripts/update-internal-markets-published.ts
 */

import { prisma } from '@/lib/prisma';

async function updateInternalMarkets() {
  try {
    console.log('\n🔄 ========== 开始更新 INTERNAL 市场的 reviewStatus ==========\n');

    // 查找所有 INTERNAL 来源且 reviewStatus 为 PENDING 的市场
    const marketsToUpdate = await prisma.market.findMany({
      where: {
        source: 'INTERNAL',
        reviewStatus: 'PENDING',
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        status: true,
        reviewStatus: true,
      },
    });

    console.log(`📊 找到 ${marketsToUpdate.length} 个需要更新的市场:`);
    marketsToUpdate.forEach(m => {
      console.log(`  - ${m.title} (ID: ${m.id}, status: ${m.status}, reviewStatus: ${m.reviewStatus})`);
    });

    if (marketsToUpdate.length === 0) {
      console.log('✅ 没有需要更新的市场');
      await prisma.$disconnect();
      return;
    }

    // 批量更新
    const updateResult = await prisma.market.updateMany({
      where: {
        source: 'INTERNAL',
        reviewStatus: 'PENDING',
        isActive: true,
      },
      data: {
        reviewStatus: 'PUBLISHED',
      },
    });

    console.log(`\n✅ 成功更新 ${updateResult.count} 个市场的 reviewStatus 为 PUBLISHED`);

    // 验证更新结果
    const updatedMarkets = await prisma.market.findMany({
      where: {
        source: 'INTERNAL',
        reviewStatus: 'PUBLISHED',
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        status: true,
        reviewStatus: true,
      },
    });

    console.log(`\n✅ 验证：现在有 ${updatedMarkets.length} 个 INTERNAL 来源且 PUBLISHED 的市场`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ 更新失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

updateInternalMarkets();
