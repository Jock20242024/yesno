/**
 * 检查市场统计数据
 */

import { prisma } from '../lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '../lib/dayjs';

async function checkStats() {
  const now = dayjs.utc().toDate();
  const nowUtc = dayjs.utc();
  const rangeStart = nowUtc.subtract(12, 'hours').toDate();
  const rangeEnd = nowUtc.add(24, 'hours').toDate();
  
  console.log(`\n🔍 当前UTC时间: ${nowUtc.toISOString()}`);
  console.log(`📅 36小时窗口: ${rangeStart.toISOString()} ~ ${rangeEnd.toISOString()}\n`);
  
  // 查询所有工厂市场
  const allFactory = await prisma.market.findMany({
    where: {
      isFactory: true,
    },
    select: {
      id: true,
      title: true,
      status: true,
      closingDate: true,
      externalId: true,
      resolvedOutcome: true,
      templateId: true,
    },
  });
  
  console.log(`📊 总工厂市场数: ${allFactory.length}`);
  
  // 按状态分组
  const byStatus = allFactory.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('📊 按状态分组:', JSON.stringify(byStatus, null, 2));
  
  // 检查在36小时窗口内的市场
  const inWindow = allFactory.filter(m => {
    return m.closingDate >= rangeStart && m.closingDate <= rangeEnd;
  });
  console.log(`\n📊 36小时窗口内的市场: ${inWindow.length} 个`);
  
  // 按状态分组（窗口内）
  const inWindowByStatus = inWindow.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('📊 窗口内按状态分组:', JSON.stringify(inWindowByStatus, null, 2));
  
  // 检查已过期的市场（closingDate < now）
  const expired = inWindow.filter(m => m.closingDate < now);
  console.log(`\n📊 已过期的市场（closingDate < now）: ${expired.length} 个`);
  
  const expiredByStatus = expired.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('📊 已过期按状态分组:', JSON.stringify(expiredByStatus, null, 2));
  
  // 检查未来市场（closingDate >= now）
  const future = inWindow.filter(m => m.closingDate >= now);
  console.log(`\n📊 未来的市场（closingDate >= now）: ${future.length} 个`);
  
  const futureByStatus = future.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('📊 未来按状态分组:', JSON.stringify(futureByStatus, null, 2));
  
  // 按照统计逻辑：OPEN算open，其他算ended
  const shouldBeOpen = inWindow.filter(m => m.status === MarketStatus.OPEN);
  const shouldBeEnded = inWindow.filter(m => m.status !== MarketStatus.OPEN);
  
  console.log(`\n📊 按照统计逻辑:`);
  console.log(`  进行中（OPEN状态）: ${shouldBeOpen.length} 个`);
  console.log(`  已结束（非OPEN状态）: ${shouldBeEnded.length} 个`);
  console.log(`  总计: ${inWindow.length} 个`);
  
  // 检查OPEN状态的已过期市场（这些应该被标记为CLOSED）
  const expiredOpen = expired.filter(m => m.status === MarketStatus.OPEN);
  console.log(`\n⚠️  已过期但状态为OPEN的市场: ${expiredOpen.length} 个（这些应该被维护任务更新为CLOSED）`);
  if (expiredOpen.length > 0) {
    console.log('📋 前5个示例:');
    expiredOpen.slice(0, 5).forEach(m => {
      console.log(`  - ${m.id}: ${m.title} (结束: ${m.closingDate.toISOString()}, templateId: ${m.templateId?.substring(0, 8) || 'N/A'})`);
    });
  }
  
  // 按templateId分组统计
  const byTemplate = new Map<string, { open: number, ended: number, total: number }>();
  inWindow.forEach(m => {
    const templateId = m.templateId || 'unknown';
    if (!byTemplate.has(templateId)) {
      byTemplate.set(templateId, { open: 0, ended: 0, total: 0 });
    }
    const stats = byTemplate.get(templateId)!;
    stats.total++;
    if (m.status === MarketStatus.OPEN) {
      stats.open++;
    } else {
      stats.ended++;
    }
  });
  
  console.log(`\n📊 按templateId分组统计:`);
  byTemplate.forEach((stats, templateId) => {
    console.log(`  TemplateId ${templateId.substring(0, 8)}...: 进行中=${stats.open}, 已结束=${stats.ended}, 总计=${stats.total}`);
  });
  
  await prisma.$disconnect();
}

checkStats().catch(console.error);
