/**
 * 分析预期的市场数量
 */

import { prisma } from '../lib/prisma';
import dayjs from '../lib/dayjs';

async function analyzeExpected() {
  const nowUtc = dayjs.utc();
  const rangeStart = nowUtc.subtract(12, 'hours');
  const rangeEnd = nowUtc.add(24, 'hours');
  
  console.log(`\n🔍 当前UTC时间: ${nowUtc.toISOString()}`);
  console.log(`📅 36小时窗口: ${rangeStart.toISOString()} ~ ${rangeEnd.toISOString()}\n`);
  
  // 计算15分钟周期应该有多少个市场
  const periodMinutes = 15;
  const totalMinutes = (12 + 24) * 60; // 36小时 = 2160分钟
  const expectedCount = totalMinutes / periodMinutes; // 2160 / 15 = 144个
  
  console.log(`📊 理论计算（15分钟周期，36小时窗口）:`);
  console.log(`  过去12小时: ${12 * 60 / periodMinutes} 个市场`);
  console.log(`  未来24小时: ${24 * 60 / periodMinutes} 个市场`);
  console.log(`  总计应该: ${expectedCount} 个市场\n`);
  
  // 查询实际数据
  const actualMarkets = await prisma.market.findMany({
    where: {
      isFactory: true,
      closingDate: {
        gte: rangeStart.toDate(),
        lte: rangeEnd.toDate(),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      closingDate: true,
      externalId: true,
      templateId: true,
    },
    orderBy: {
      closingDate: 'asc',
    },
  });
  
  console.log(`📊 实际36小时窗口内的市场: ${actualMarkets.length} 个`);
  console.log(`📊 差异: ${actualMarkets.length - expectedCount} 个（应该是144个）\n`);
  
  // 检查时间分布
  const now = nowUtc.toDate();
  const past = actualMarkets.filter(m => m.closingDate < now);
  const future = actualMarkets.filter(m => m.closingDate >= now);
  
  console.log(`📊 时间分布:`);
  console.log(`  已过期（closingDate < now）: ${past.length} 个（应该约 ${12 * 60 / periodMinutes} 个）`);
  console.log(`  未来（closingDate >= now）: ${future.length} 个（应该约 ${24 * 60 / periodMinutes} 个）\n`);
  
  // 检查externalId分布
  const withExternalId = actualMarkets.filter(m => m.externalId !== null);
  const withoutExternalId = actualMarkets.filter(m => m.externalId === null);
  
  console.log(`📊 externalId分布:`);
  console.log(`  有externalId: ${withExternalId.length} 个`);
  console.log(`  无externalId: ${withoutExternalId.length} 个\n`);
  
  // 检查已过期且有externalId的市场（这些应该还在）
  const expiredWithExternalId = past.filter(m => m.externalId !== null);
  const expiredWithoutExternalId = past.filter(m => m.externalId === null);
  
  console.log(`📊 已过期市场分析:`);
  console.log(`  已过期且有externalId: ${expiredWithExternalId.length} 个（这些应该还在，可以结算）`);
  console.log(`  已过期但无externalId: ${expiredWithoutExternalId.length} 个（这些已被清理脚本删除）\n`);
  
  // 检查是否有已过期但状态仍是OPEN的市场（应该被维护任务更新为CLOSED）
  const expiredOpen = past.filter(m => m.status === 'OPEN');
  console.log(`⚠️  已过期但状态仍为OPEN的市场: ${expiredOpen.length} 个（这些应该被维护任务更新为CLOSED）\n`);
  
  // 按templateId分组
  const byTemplate = new Map<string, number>();
  actualMarkets.forEach(m => {
    const templateId = m.templateId || 'unknown';
    byTemplate.set(templateId, (byTemplate.get(templateId) || 0) + 1);
  });
  
  console.log(`📊 按templateId分组（每个应该有 ${expectedCount} 个）:`);
  byTemplate.forEach((count, templateId) => {
    console.log(`  ${templateId.substring(0, 8)}...: ${count} 个（差异: ${count - expectedCount}）`);
  });
  
  // 检查最早和最晚的市场时间
  if (actualMarkets.length > 0) {
    const earliest = dayjs.utc(actualMarkets[0].closingDate);
    const latest = dayjs.utc(actualMarkets[actualMarkets.length - 1].closingDate);
    
    console.log(`\n📊 时间范围:`);
    console.log(`  最早市场: ${earliest.toISOString()}`);
    console.log(`  最晚市场: ${latest.toISOString()}`);
    console.log(`  窗口开始: ${rangeStart.toISOString()}`);
    console.log(`  窗口结束: ${rangeEnd.toISOString()}`);
    
    const diffStart = earliest.diff(rangeStart, 'minutes');
    const diffEnd = rangeEnd.diff(latest, 'minutes');
    console.log(`  最早市场与窗口开始的差异: ${diffStart} 分钟`);
    console.log(`  窗口结束与最晚市场的差异: ${diffEnd} 分钟`);
  }
  
  await prisma.$disconnect();
}

analyzeExpected().catch(console.error);
