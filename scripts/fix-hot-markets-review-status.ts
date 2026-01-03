/**
 * 修复热门市场的审核状态
 * 将所有 isHot = true 但 reviewStatus = PENDING 的市场恢复为 PUBLISHED
 * 这样它们就会重新出现在后台市场列表中
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixHotMarketsReviewStatus() {
  try {
    // 查找所有 isHot = true 但 reviewStatus = PENDING 的市场
    const pendingHotMarkets = await prisma.markets.findMany({
      where: {
        isHot: true,
        reviewStatus: 'PENDING',
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        reviewStatus: true,
        status: true,
      },
    });

    console.log(`📊 找到 ${pendingHotMarkets.length} 个热门市场需要修复`);

    if (pendingHotMarkets.length === 0) {
      console.log('✅ 没有需要修复的市场');
      return;
    }

    // 批量更新为 PUBLISHED
    const updateResult = await prisma.markets.updateMany({
      where: {
        isHot: true,
        reviewStatus: 'PENDING',
        isActive: true,
      },
      data: {
        reviewStatus: 'PUBLISHED',
        status: 'OPEN', // 同时设置为 OPEN 状态
      },
    });

    console.log(`✅ 成功修复 ${updateResult.count} 个热门市场的审核状态`);
    console.log('修复详情：');
    pendingHotMarkets.slice(0, 10).forEach((m, index) => {
      console.log(`${index + 1}. ${m.title} (ID: ${m.id})`);
    });
    if (pendingHotMarkets.length > 10) {
      console.log(`... 还有 ${pendingHotMarkets.length - 10} 个市场`);
    }
  } catch (error) {
    console.error('❌ 修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixHotMarketsReviewStatus()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });

