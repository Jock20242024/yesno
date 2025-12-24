/**
 * 手动触发模板生成市场
 * POST /api/admin/factory/templates/[template_id]/trigger
 * 
 * 🚀 核心原则：与 Polymarket 保持物理级同步
 * - 使用 UTC 绝对时间（禁止本地时区转换）
 * - 宽窗口滑动覆盖：向前12小时，向后24小时
 * - 严格对齐周期边界（:00, :15, :30, :45）
 * - 幂等性检查：基于 templateId + startTime
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { createMarketFromTemplate, getStartTime, getNextPeriodTime } from '@/lib/factory/engine';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const dynamic = 'force-dynamic';

/**
 * 🚀 对齐时间到周期边界（向下对齐）
 * 例如：UTC 08:03 (15分钟周期) -> UTC 08:00
 */
function alignToPeriodBoundary(time: Date, periodMinutes: number): Date {
  const aligned = new Date(time);
  aligned.setUTCSeconds(0);
  aligned.setUTCMilliseconds(0);
  
  if (periodMinutes === 15) {
    // 对齐到 :00, :15, :30, :45
    const minutes = aligned.getUTCMinutes();
    const alignedMinutes = Math.floor(minutes / 15) * 15;
    aligned.setUTCMinutes(alignedMinutes);
  } else if (periodMinutes === 60) {
    // 对齐到整点
    aligned.setUTCMinutes(0);
  } else if (periodMinutes === 240) {
    // 对齐到 00, 04, 08, 12, 16, 20
    const hours = aligned.getUTCHours();
    const alignedHours = Math.floor(hours / 4) * 4;
    aligned.setUTCHours(alignedHours);
    aligned.setUTCMinutes(0);
  } else if (periodMinutes === 1440) {
    // 对齐到 00:00
    aligned.setUTCHours(0);
    aligned.setUTCMinutes(0);
  } else {
    // 通用对齐：基于分钟数
    const totalMinutes = aligned.getUTCHours() * 60 + aligned.getUTCMinutes();
    const alignedTotalMinutes = Math.floor(totalMinutes / periodMinutes) * periodMinutes;
    aligned.setUTCHours(Math.floor(alignedTotalMinutes / 60));
    aligned.setUTCMinutes(alignedTotalMinutes % 60);
  }
  
  return aligned;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ template_id: string }> }
) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { template_id } = await params;

    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(template_id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID format' },
        { status: 400 }
      );
    }

    // 获取模板（包含所有字段）
    const template = await prisma.marketTemplate.findUnique({
      where: { id: template_id },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    // 🚀 修复：自动重置熔断状态
    // 如果模板处于PAUSED或FUSED状态，自动重置为ACTIVE并清空failureCount，强制执行一次生成
    const templateStatus = (template as any).status;
    const templateFailureCount = (template as any).failureCount || 0;
    
    if (templateStatus === 'PAUSED' || templateStatus === 'FUSED' || templateFailureCount > 0) {
      console.log(`🔄 [WideWindowOverlay] 检测到模板处于熔断状态（status=${templateStatus}, failureCount=${templateFailureCount}），自动重置为ACTIVE...`);
      await prisma.marketTemplate.update({
        where: { id: template_id },
        data: {
          status: 'ACTIVE',
          failureCount: 0,
          pauseReason: null,
        },
      });
      console.log(`✅ [WideWindowOverlay] 模板已重置为ACTIVE状态，failureCount已清零`);
      
      // 更新template对象，确保后续逻辑使用新的状态
      (template as any).status = 'ACTIVE';
      (template as any).failureCount = 0;
    }

    // 🧹 修复3：维护任务 - 将所有已过期但仍为OPEN的市场更新为CLOSED
    const nowUtcForMaintenance = dayjs.utc();
    const nowUtcDateForMaintenance = nowUtcForMaintenance.toDate();
    try {
      const updateResult = await prisma.market.updateMany({
        where: {
          templateId: template_id,
          status: 'OPEN',
          closingDate: { lt: nowUtcDateForMaintenance },
          isFactory: true,
        },
        data: {
          status: 'CLOSED',
        },
      });
      console.log(`🧹 [维护] 已将 ${updateResult.count} 个过期市场从OPEN更新为CLOSED`);
    } catch (maintenanceError: any) {
      console.error(`⚠️ [维护] 状态更新失败: ${maintenanceError.message}，继续执行生成逻辑`);
    }

    // 🚀 核心逻辑：宽窗口滑动覆盖（Wide Window Overlay）
    // 1. UTC 绝对锚定
    const nowUtc = dayjs.utc();
    const nowUtcDate = nowUtc.toDate();
    
    // 2. 时间窗口：向前12小时，向后24小时
    const windowStart = nowUtc.subtract(12, 'hours').toDate();
    const windowEnd = nowUtc.add(24, 'hours').toDate();
    
    console.log(`🚀 [WideWindowOverlay] 开始宽窗口滑动覆盖: 模板 ${template_id}`);
    console.log(`📅 [WideWindowOverlay] UTC 当前时间: ${nowUtcDate.toISOString()}`);
    console.log(`📅 [WideWindowOverlay] 原始窗口: ${windowStart.toISOString()} ~ ${windowEnd.toISOString()}`);
    console.log(`📅 [WideWindowOverlay] 窗口时长: ${dayjs.utc(windowEnd).diff(dayjs.utc(windowStart), 'hour')} 小时`);
    
    // 3. 对齐窗口边界到周期边界
    const alignedWindowStart = alignToPeriodBoundary(windowStart, template.period);
    const alignedWindowEnd = alignToPeriodBoundary(windowEnd, template.period);
    
    console.log(`📅 [WideWindowOverlay] 对齐后的窗口: ${alignedWindowStart.toISOString()} ~ ${alignedWindowEnd.toISOString()}`);
    console.log(`📅 [WideWindowOverlay] 对齐后窗口时长: ${dayjs.utc(alignedWindowEnd).diff(dayjs.utc(alignedWindowStart), 'hour')} 小时`);
    console.log(`📅 [WideWindowOverlay] 预期场次数: ${Math.ceil(dayjs.utc(alignedWindowEnd).diff(dayjs.utc(alignedWindowStart), 'minute') / template.period)} 个`);
    
    // 4. 生成所有时间槽（暴力循环，强制修正）
    // 🔧 强制循环修正：使用UTC时间戳，确保生成144个场次
    const nowTimeUtc = nowUtc.valueOf(); // UTC时间戳（毫秒）
    // 强制起点 = 现在 - 12小时
    const forceStartTime = nowTimeUtc - (12 * 60 * 60 * 1000);
    // 强制终点 = 现在 + 24小时
    const forceEndTime = nowTimeUtc + (24 * 60 * 60 * 1000);
    
    // 对齐到周期边界
    const periodMs = template.period * 60 * 1000;
    // 对齐起点：向下取整到周期边界
    const alignedStartTimeMs = Math.floor(forceStartTime / periodMs) * periodMs;
    // 对齐终点：向上取整到周期边界（确保包含最后一个周期）
    const alignedEndTimeMs = Math.ceil(forceEndTime / periodMs) * periodMs;
    
    // 🔧 关键修复：第一个场次的结束时间必须是对齐后的起点 + period
    // 这样第一个场次的开始时间就是对齐后的起点
    let loopCursor = alignedStartTimeMs + periodMs;
    
    const expectedSlotCount = Math.floor((alignedEndTimeMs - alignedStartTimeMs) / periodMs);
    
    console.log(`🚀 [Trigger] 强制循环区间（UTC）: 
      当前UTC时间: ${new Date(nowTimeUtc).toISOString()}
      原始起点（现在-12h）: ${new Date(forceStartTime).toISOString()}
      对齐起点: ${new Date(alignedStartTimeMs).toISOString()}
      第一个场次结束时间: ${new Date(loopCursor).toISOString()}
      原始终点（现在+24h）: ${new Date(forceEndTime).toISOString()}
      对齐终点: ${new Date(alignedEndTimeMs).toISOString()}
      时间窗口: ${(alignedEndTimeMs - alignedStartTimeMs) / (60 * 60 * 1000)} 小时
      预期场次数: ${expectedSlotCount} 个
    `);

    // 生成时间槽（每个slot是周期的结束时间）
    const slots: Date[] = [];
    while (loopCursor <= alignedEndTimeMs) {
      slots.push(new Date(loopCursor));
      loopCursor += periodMs;
    }
    
    console.log(`📊 [Trigger] 实际生成 ${slots.length} 个时间槽 (预期 ${expectedSlotCount} 个)`);
    if (slots.length !== expectedSlotCount) {
      console.error(`❌ [Trigger] 严重错误：场次数量不符！实际=${slots.length}, 预期=${expectedSlotCount}`);
    }
    if (slots.length > 0) {
      const firstSlotStart = new Date(slots[0].getTime() - periodMs);
      console.log(`📊 [Trigger] 第一个场次: 开始=${firstSlotStart.toISOString()}, 结束=${slots[0].toISOString()}`);
      const lastSlotStart = new Date(slots[slots.length - 1].getTime() - periodMs);
      console.log(`📊 [Trigger] 最后一个场次: 开始=${lastSlotStart.toISOString()}, 结束=${slots[slots.length - 1].toISOString()}`);
    }
    
    // 5. 查询已存在的市场（用于幂等性检查，基于 templateId + startTime）
    // 🔧 关键：在维护任务执行后重新查询，获取最新的状态
    const existingMarkets = await prisma.market.findMany({
      where: {
        templateId: template_id,
        isFactory: true,
      },
      select: {
        id: true,
        closingDate: true,
        status: true,
      },
    });
    
    console.log(`📊 [WideWindowOverlay] 查询到已存在市场: ${existingMarkets.length} 个`);
    const statusCounts = existingMarkets.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`📊 [WideWindowOverlay] 已存在市场状态分布:`, statusCounts);
    
    // 创建已存在市场的 startTime 和 closingDate 集合（用于幂等性检查）
    // 🔧 关键：创建Map映射startTimeKey和closingDateKey到market对象，用于后续状态检查和更新
    // 🔥 修复：双重去重检查（基于startTime和closingDate），确保不会重复创建
    const existingStartTimes = new Set<string>();
    const existingClosingDates = new Set<string>();
    const existingMarketsMap = new Map<string, typeof existingMarkets[0]>();
    existingMarkets.forEach(m => {
      const startTime = getStartTime(m.closingDate, template.period);
      // 使用对齐后的 startTime 作为 key
      const alignedStart = alignToPeriodBoundary(startTime, template.period);
      const startTimeKey = alignedStart.toISOString();
      // 使用对齐后的 closingDate 作为 key（去除毫秒差异）
      const alignedClosingDate = new Date(m.closingDate);
      alignedClosingDate.setMilliseconds(0);
      const closingDateKey = alignedClosingDate.toISOString();
      
      existingStartTimes.add(startTimeKey);
      existingClosingDates.add(closingDateKey);
      existingMarketsMap.set(startTimeKey, m);
      existingMarketsMap.set(closingDateKey, m); // 也以closingDate作为key
    });
    
    console.log(`📊 [WideWindowOverlay] 已存在市场: ${existingMarkets.length} 个`);
    
    let createdCount = 0;
    let skippedCount = 0;
    const createdMarketIds: string[] = [];
    
    // 6. 遍历每个时间槽，检查并创建缺失的市场
    let pastSlotCount = 0;
    let futureSlotCount = 0;
    
    for (const slotEndTime of slots) {
      // 计算 startTime（必须严格对齐）
      const slotStartTime = getStartTime(slotEndTime, template.period);
      const alignedStartTime = alignToPeriodBoundary(slotStartTime, template.period);
      
      // 🚀 修复：必须严格比较 UTC 时间戳（同时检查startTime和endTime）
      const slotEndTimeMoment = dayjs.utc(slotEndTime);
      const nowMomentForSlot = dayjs.utc();
      const isPastByEndTime = slotEndTimeMoment.isBefore(nowMomentForSlot);
      const isPastByStartTime = dayjs.utc(alignedStartTime).isBefore(nowMomentForSlot);
      const isPast = isPastByStartTime || isPastByEndTime; // 只要endTime或startTime过去，就算过去
      const initialStatus = isPast ? 'CLOSED' : 'OPEN'; // 过去就是 CLOSED，未来才是 OPEN（Prisma schema没有PENDING）
      
      if (isPast) {
        pastSlotCount++;
      } else {
        futureSlotCount++;
      }
      
      // 🚀 幂等性检查：基于 templateId + startTime
      const startTimeKey = alignedStartTime.toISOString();
      if (existingStartTimes.has(startTimeKey)) {
        // 🔧 关键修复：如果过去场次已存在但状态是OPEN，强制更新为PENDING
        if (isPast) {
          const existingMarket = existingMarketsMap.get(startTimeKey);
          if (existingMarket && existingMarket.status === 'OPEN') {
            try {
              await prisma.market.update({
                where: { id: existingMarket.id },
                data: { status: 'CLOSED' },
              });
              console.log(`🔧 [WideWindowOverlay] 强制更新过去场次状态: ID=${existingMarket.id}, StartTime=${alignedStartTime.toISOString()}, OPEN -> CLOSED`);
            } catch (updateError: any) {
              console.error(`⚠️ [WideWindowOverlay] 更新过去场次状态失败: ${updateError.message}`);
            }
          }
        }
        skippedCount++;
        continue;
      }
      
      // 🔧 关键：只记录前10个和过去场次的详细信息，避免日志过多
      if (slots.indexOf(slotEndTime) < 10 || isPast) {
        console.log(`🔍 [WideWindowOverlay] 时间判断: slotEndTime=${slotEndTime.toISOString()}, alignedStartTime=${alignedStartTime.toISOString()}, now=${nowMomentForSlot.toISOString()}, isPastByEndTime=${isPastByEndTime}, isPastByStartTime=${isPastByStartTime}, isPast=${isPast}, initialStatus=${initialStatus}`);
      }
      
      try {
        // 调用 createMarketFromTemplate（使用对齐后的 endTime 和正确的状态）
        const alignedEndTime = alignToPeriodBoundary(slotEndTime, template.period);
        const marketId = await createMarketFromTemplate(template as any, alignedEndTime, initialStatus);
        
        // 添加到已存在集合，避免重复创建（双重检查）
        existingStartTimes.add(startTimeKey);
        existingClosingDates.add(closingDateKey);
        
        createdCount++;
        createdMarketIds.push(marketId);
        console.log(`✅ [WideWindowOverlay] 创建市场: ID=${marketId}, StartTime=${alignedStartTime.toISOString()}, EndTime=${alignedEndTime.toISOString()}, Status=${initialStatus}`);
      } catch (error: any) {
        // 🚀 修复：增强异常捕获 - 单个场次创建失败不影响整体，绝对不增加failureCount
        if (error.message?.includes('已存在') || error.message?.includes('already exists')) {
          // 幂等性错误（市场已存在），跳过
          skippedCount++;
          existingStartTimes.add(startTimeKey);
          console.log(`⏭️ [WideWindowOverlay] 市场已存在，跳过: StartTime=${alignedStartTime.toISOString()}, Status=${initialStatus}`);
        } else {
          // 其他错误：仅记录日志，不抛出异常，继续创建下一个场次
          // 🚀 核心修复：绝对不增加failureCount，不触发熔断，确保其他场次能继续创建
          // 特别是对于PENDING状态的场次，失败不应影响整体流程
          console.error(`❌ [WideWindowOverlay] 创建市场失败（跳过，继续下一个）: StartTime=${alignedStartTime.toISOString()}, Status=${initialStatus}, Error=${error.message}`);
          console.error(`   Stack: ${error.stack || 'N/A'}`);
          // 不添加到existingStartTimes，下次可以重试
          // 注意：这里不抛出错误，循环会继续执行下一个场次
        }
      }
    }
    
    console.log(`📊 [WideWindowOverlay] 完成: 创建 ${createdCount} 个，跳过 ${skippedCount} 个，总计 ${slots.length} 个时间槽`);
    console.log(`📊 [WideWindowOverlay] 时间槽分布: 过去场次=${pastSlotCount} 个，未来场次=${futureSlotCount} 个`);
    if (pastSlotCount === 0) {
      console.error(`❌ [WideWindowOverlay] 严重警告：没有过去场次！这说明循环起点不对，只生成了未来24小时的场次！`);
    }

    // 🔥 更新心跳：记录最后一次工厂运行时间
    try {
      const nowUtc = dayjs.utc().toISOString();
      await prisma.systemSettings.upsert({
        where: { key: 'lastFactoryRunAt' },
        update: { value: nowUtc },
        create: { key: 'lastFactoryRunAt', value: nowUtc },
      });
      console.log(`💓 [Heartbeat] 已更新最后运行时间: ${nowUtc}`);
    } catch (heartbeatError: any) {
      // 心跳更新失败不影响主流程，只记录日志
      console.error(`⚠️ [Heartbeat] 更新心跳失败: ${heartbeatError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: `宽窗口滑动覆盖完成：创建 ${createdCount} 个市场，跳过 ${skippedCount} 个`,
      data: {
        marketId: createdMarketIds.length > 0 ? createdMarketIds[0] : null,
        templateId: template_id,
        createdCount,
        skippedCount,
        totalSlots: slots.length,
        createdMarketIds,
        windowStart: alignedWindowStart.toISOString(),
        windowEnd: alignedWindowEnd.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [Factory Trigger API] 触发失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
