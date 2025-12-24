import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createMarketFromTemplate } from '@/lib/factory/engine';
import dayjs from '@/lib/dayjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 🔥 T+1 预产制：每天 0 点运行，一次性为所有激活模板生成未来 24-48 小时内的所有固定场次
 * GET /api/cron/factory-pregen
 * 
 * 安全：建议添加 API Key 验证
 */
export async function GET(request: NextRequest) {
  try {
    // 可选：验证 API Key 或 secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.CRON_API_KEY || process.env.CRON_SECRET;
    
    if (expectedKey && secret !== expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('⏰ [PreGen Cron] T+1 预产制任务启动...');

    const now = dayjs.utc();
    const pregenHours = 48; // 预生成 48 小时的市场
    const targetEndTime = now.add(pregenHours, 'hour').toDate();

    // 查询所有活跃模板
    const activeTemplates = await prisma.marketTemplate.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
    });

    console.log(`📊 [PreGen Cron] 找到 ${activeTemplates.length} 个活跃模板`);

    const stats = {
      templatesProcessed: 0,
      marketsCreated: 0,
      errors: 0,
    };

    for (const template of activeTemplates) {
      try {
        const periodMinutes = template.period;
        
        // 计算需要预生成的市场数量
        const marketsPerHour = 60 / periodMinutes;
        const expectedMarketCount = Math.ceil(pregenHours * marketsPerHour);
        
        // 查找未来 48 小时内已存在的市场
        const existingMarkets = await prisma.market.findMany({
          where: {
            templateId: template.id,
            isFactory: true,
            closingDate: {
              gt: now.toDate(),
              lte: targetEndTime,
            },
          },
          orderBy: {
            closingDate: 'asc',
          },
        });

        console.log(`📊 [PreGen Cron] 模板 ${template.name}: 已存在 ${existingMarkets.length} 个未来市场，期望 ${expectedMarketCount} 个`);

        // 如果数量不足，需要批量创建
        if (existingMarkets.length < expectedMarketCount) {
          const { getNextPeriodTime } = await import('@/lib/factory/engine');
          
          // 确定起始时间：使用最后一个已存在市场的结束时间，或从当前时间开始
          let lastEndTime: Date;
          if (existingMarkets.length > 0) {
            lastEndTime = existingMarkets[existingMarkets.length - 1].closingDate;
          } else {
            // 如果没有未来市场，使用对齐后的当前时间作为起点
            lastEndTime = getNextPeriodTime(periodMinutes);
            lastEndTime.setTime(lastEndTime.getTime() - periodMinutes * 60 * 1000); // 减去一个周期作为起点
          }

          // 批量创建市场
          let currentEndTime = new Date(lastEndTime);
          let createdCount = 0;
          const maxBatchSize = 200; // 每次最多创建200个
          
          while (existingMarkets.length + createdCount < expectedMarketCount && createdCount < maxBatchSize) {
            // 计算下一个周期的结束时间（确保对齐到整点）
            currentEndTime = getNextPeriodTime(periodMinutes, currentEndTime);
            
            // 检查是否超过目标时间
            if (currentEndTime > targetEndTime) {
              break;
            }

            // 🔥 getNextPeriodTime 已经确保时间对齐，这里只需要简单验证（可选）
            // 由于 getNextPeriodTime 已经处理了对齐，这里直接使用计算结果
            
            // 🔥 修复：检查是否已存在该时间点的市场（使用精确匹配，与 createMarketFromTemplate 一致）
            const existingMarket = await prisma.market.findFirst({
              where: {
                templateId: template.id,
                isFactory: true,
                // 🔥 精确匹配：去除毫秒差异，对齐到秒级别（±100ms 容差，处理数据库精度问题）
                closingDate: {
                  gte: new Date(currentEndTime.getTime() - 100),
                  lte: new Date(currentEndTime.getTime() + 100),
                },
              },
              orderBy: {
                createdAt: 'desc', // 如果有多个，取最新的
              },
            });

            if (existingMarket) {
              // 已存在，移动到下一个周期
              currentEndTime = existingMarket.closingDate;
              continue;
            }

            // 🔥 创建新市场（状态设为 OPEN，但实际在 StartTime 才真正开启交易）
            try {
              await createMarketFromTemplate({
                id: template.id,
                name: template.name,
                titleTemplate: (template as any).titleTemplate || null,
                displayTemplate: (template as any).displayTemplate || null,
                symbol: template.symbol,
                period: template.period,
                categorySlug: (template as any).categorySlug || null,
                advanceTime: template.advanceTime,
                oracleUrl: template.oracleUrl || null,
                seriesId: (template as any).seriesId || null,
                isActive: template.isActive,
                status: (template as any).status || 'ACTIVE',
                failureCount: (template as any).failureCount || 0,
              }, currentEndTime);
              
              createdCount++;
              stats.marketsCreated++;
              
              if (createdCount % 10 === 0) {
                console.log(`📊 [PreGen Cron] 模板 ${template.name}: 已创建 ${createdCount} 个市场...`);
              }
            } catch (createError: any) {
              console.error(`❌ [PreGen Cron] 模板 ${template.name} 创建市场失败:`, createError.message);
              stats.errors++;
              // 遇到错误时，暂停该模板的批量创建
              break;
            }
          }

          if (createdCount > 0) {
            console.log(`✅ [PreGen Cron] 模板 ${template.name} 预生成完成，共创建 ${createdCount} 个市场`);
          }
        } else {
          console.log(`✅ [PreGen Cron] 模板 ${template.name} 已有足够的未来市场，跳过`);
        }

        stats.templatesProcessed++;
      } catch (error: any) {
        console.error(`❌ [PreGen Cron] 处理模板 ${template.name} 失败:`, error.message);
        stats.errors++;
      }
    }

    console.log(`✅ [PreGen Cron] T+1 预产制任务完成: 处理 ${stats.templatesProcessed} 个模板，创建 ${stats.marketsCreated} 个市场，错误 ${stats.errors}`);

    return NextResponse.json({
      success: true,
      message: 'T+1 预产制任务完成',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [PreGen Cron] T+1 预产制任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
