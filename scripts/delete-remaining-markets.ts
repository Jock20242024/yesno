/**
 * 删除剩余的无法匹配 Polymarket ID 的工厂市场
 */

import { prisma } from '../lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '../lib/dayjs';

async function deleteRemaining() {
  const now = dayjs.utc().toDate();
  
  console.log('💣 [Delete Remaining] 开始查询并删除剩余的市场...');
  
  // 先查询看看有什么
  const remaining = await prisma.market.findMany({
    where: {
      isFactory: true,
      status: {
        notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
      },
      closingDate: {
        lt: now,
      },
      externalId: null,
    },
    select: {
      id: true,
      title: true,
      closingDate: true,
      status: true,
    },
  });
  
  console.log(`📊 [Delete Remaining] 找到 ${remaining.length} 个剩余市场`);
  
  if (remaining.length > 0) {
    console.log('📋 [Delete Remaining] 市场列表:');
    remaining.forEach(m => {
      console.log(`  - ${m.id}: ${m.title} (${m.status}, ${m.closingDate.toISOString()})`);
    });
    
    // 执行删除
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isFactory: true,
        status: {
          notIn: [MarketStatus.RESOLVED, MarketStatus.CANCELED],
        },
        closingDate: {
          lt: now,
        },
        externalId: null,
      },
    });
    
    console.log(`✅ [Delete Remaining] 删除完成：删除了 ${deleteResult.count} 个市场`);
  } else {
    console.log('✅ [Delete Remaining] 没有需要删除的市场');
  }
  
  await prisma.$disconnect();
}

deleteRemaining().catch(console.error);
