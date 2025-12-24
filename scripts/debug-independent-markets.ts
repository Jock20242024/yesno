/**
 * 🔥 调试独立市场（没有 templateId 的审核市场）
 * 
 * 执行：npx tsx scripts/debug-independent-markets.ts
 */

import { prisma } from '../lib/prisma';

async function debugIndependentMarkets() {
  try {
    console.log('🔍 [Debug Independent Markets] 开始查询独立市场（没有 templateId）...\n');
    
    // 查询没有 templateId 的审核通过市场
    const independentMarkets = await prisma.market.findMany({
      where: {
        reviewStatus: 'PUBLISHED',
        isActive: true,
        templateId: null,
      },
      include: {
        categories: {
          include: {
            category: {
              select: {
                id: true,
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
      take: 10, // 只取前10个
    });
    
    console.log(`📊 [Debug Independent Markets] 找到 ${independentMarkets.length} 个独立市场\n`);
    
    if (independentMarkets.length === 0) {
      console.log('⚠️  数据库中暂无独立市场（没有 templateId 的审核通过市场）\n');
    } else {
      independentMarkets.forEach((market, idx) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📋 独立市场 #${idx + 1}:`);
        console.log(`   ID: ${market.id}`);
        console.log(`   标题: ${market.title}`);
        console.log(`   状态: ${market.status}`);
        console.log(`   isHot: ${(market as any).isHot ?? false}`);
        console.log(`   总交易量: ${Number(market.totalVolume)}`);
        if (market.categories && market.categories.length > 0) {
          console.log(`   关联分类: ${market.categories.map(mc => mc.category.name).join(', ')}`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      });
    }
    
  } catch (error) {
    console.error('❌ [Debug Independent Markets] 执行失败:', error);
    if (error instanceof Error) {
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

debugIndependentMarkets();
