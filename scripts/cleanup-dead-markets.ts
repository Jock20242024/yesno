/**
 * 清理数据库中所有 0% 或 100% 赔率的 PENDING 事件
 * 运行方式: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/cleanup-dead-markets.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 开始清理死盘市场（0% 或 100% 赔率的 PENDING 事件）...\n');

  try {
    // 查找所有 PENDING 状态且概率为 0% 或 100% 的市场
    const deadMarkets = await prisma.market.findMany({
      where: {
        reviewStatus: 'PENDING',
        OR: [
          { yesProbability: 0 },
          { yesProbability: 100 },
          { noProbability: 0 },
          { noProbability: 100 },
        ],
      },
      select: {
        id: true,
        title: true,
        yesProbability: true,
        noProbability: true,
        totalVolume: true,
      },
    });

    console.log(`📊 找到 ${deadMarkets.length} 个死盘市场：\n`);
    
    if (deadMarkets.length > 0) {
      deadMarkets.forEach((market, index) => {
        console.log(`${index + 1}. ${market.title}`);
        console.log(`   YES: ${market.yesProbability}%, NO: ${market.noProbability}%, 交易量: $${(market.totalVolume / 1000000).toFixed(2)}M`);
      });

      console.log(`\n🗑️ 准备删除这 ${deadMarkets.length} 个死盘市场...`);

      // 删除这些市场
      const deleteResult = await prisma.market.deleteMany({
        where: {
          id: {
            in: deadMarkets.map(m => m.id),
          },
        },
      });

      console.log(`✅ 成功删除 ${deleteResult.count} 个死盘市场！`);
    } else {
      console.log('✅ 没有找到需要清理的死盘市场。');
    }
  } catch (error) {
    console.error('❌ 清理失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
