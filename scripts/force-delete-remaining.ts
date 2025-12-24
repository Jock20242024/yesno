/**
 * 强制删除剩余的无法匹配 Polymarket ID 的工厂市场（不管状态）
 */

import { prisma } from '../lib/prisma';
import dayjs from '../lib/dayjs';

async function forceDeleteRemaining() {
  const now = dayjs.utc().toDate();
  
  console.log('💣 [Force Delete] 开始强制删除所有已过期且无 externalId 的工厂市场（不管状态）...');
  
  // 先查询
  const toDelete = await prisma.market.findMany({
    where: {
      isFactory: true,
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
  
  console.log(`📊 [Force Delete] 找到 ${toDelete.length} 个市场待删除`);
  
  if (toDelete.length > 0) {
    console.log('📋 [Force Delete] 市场列表:');
    toDelete.forEach(m => {
      console.log(`  - ${m.id}: ${m.title} (状态: ${m.status}, 结束: ${m.closingDate.toISOString()})`);
    });
    
    // 执行删除（不管状态）
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isFactory: true,
        closingDate: {
          lt: now,
        },
        externalId: null,
      },
    });
    
    console.log(`✅ [Force Delete] 删除完成：删除了 ${deleteResult.count} 个市场`);
  } else {
    console.log('✅ [Force Delete] 没有需要删除的市场（所有已过期且无 externalId 的工厂市场都已清理）');
  }
  
  await prisma.$disconnect();
}

forceDeleteRemaining().catch(console.error);
