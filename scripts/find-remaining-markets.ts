/**
 * 查找剩余的工厂市场（放宽条件）
 */

import { prisma } from '../lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '../lib/dayjs';

async function findRemaining() {
  const now = dayjs.utc().toDate();
  
  console.log('🔍 [Find Remaining] 开始查询剩余的市场...');
  
  // 查询1：已过期且无 externalId 的工厂市场（不管状态）
  const expiredNoExternalId = await prisma.market.findMany({
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
      externalId: true,
    },
  });
  
  console.log(`\n📊 查询1：已过期且无 externalId 的工厂市场（不管状态）: ${expiredNoExternalId.length} 个`);
  expiredNoExternalId.forEach(m => {
    console.log(`  - ${m.id}: ${m.title} (状态: ${m.status}, 结束: ${m.closingDate.toISOString()})`);
  });
  
  // 查询2：所有无 externalId 的工厂市场（不管过期和状态）
  const allNoExternalId = await prisma.market.findMany({
    where: {
      isFactory: true,
      externalId: null,
    },
    select: {
      id: true,
      title: true,
      closingDate: true,
      status: true,
    },
  });
  
  console.log(`\n📊 查询2：所有无 externalId 的工厂市场（不管过期和状态）: ${allNoExternalId.length} 个`);
  allNoExternalId.slice(0, 10).forEach(m => {
    const isExpired = m.closingDate < now;
    console.log(`  - ${m.id}: ${m.title} (状态: ${m.status}, 结束: ${m.closingDate.toISOString()}, 已过期: ${isExpired})`);
  });
  
  // 查询3：所有已过期的工厂市场（不管 externalId 和状态）
  const allExpired = await prisma.market.findMany({
    where: {
      isFactory: true,
      closingDate: {
        lt: now,
      },
    },
    select: {
      id: true,
      title: true,
      closingDate: true,
      status: true,
      externalId: true,
    },
  });
  
  console.log(`\n📊 查询3：所有已过期的工厂市场（不管 externalId 和状态）: ${allExpired.length} 个`);
  
  // 如果有剩余，尝试删除所有已过期且无 externalId 的（不管状态）
  if (expiredNoExternalId.length > 0) {
    console.log(`\n💣 [Find Remaining] 准备删除 ${expiredNoExternalId.length} 个市场...`);
    
    const deleteResult = await prisma.market.deleteMany({
      where: {
        isFactory: true,
        closingDate: {
          lt: now,
        },
        externalId: null,
      },
    });
    
    console.log(`✅ [Find Remaining] 删除完成：删除了 ${deleteResult.count} 个市场`);
  }
  
  await prisma.$disconnect();
}

findRemaining().catch(console.error);
