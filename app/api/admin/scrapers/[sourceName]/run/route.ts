import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { PolymarketAdapter } from '@/lib/scrapers/polymarketAdapter';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";
// 🔥 增加超时时间：采集任务可能需要较长时间（抓取1000条数据并匹配工厂空壳市场）
export const maxDuration = 300; // 5分钟（Vercel Pro 计划支持）

/**
 * 手动运行采集任务
 * POST /api/admin/scrapers/[sourceName]/run
 * 
 * 🔥 全量比对模式：每次运行都处理所有数据，不做增量过滤
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceName: string }> }
) {
  // 🔥 强制日志输出：在函数最开始就输出，确保能看到
  console.log(`\n\n🚀🚀🚀 [DEBUG] ========== API 路由被调用 ==========`);
  console.log(`🚀 [DEBUG] 时间戳: ${new Date().toISOString()}`);
  console.log(`🚀 [DEBUG] 请求 URL: ${request.url}`);
  
  try {
    console.log(`🔍 [DEBUG] 开始解析参数...`);
    const { sourceName } = await params;
    console.log(`✅ [DEBUG] 参数解析完成: sourceName = ${sourceName}`);

    // 🔥 强制清理同步表：在逻辑开始前清除所有同步标记
    try {
      // 尝试清理 SyncLog 表（如果存在）
      await (prisma as any).syncLog?.deleteMany({}).catch(() => {
        // 表不存在时忽略错误
      });

    } catch (error) {
      // SyncLog 表可能不存在，忽略错误

    }

    // 清理 DataSource 表的同步标记
    try {
      await prisma.data_sources.updateMany({
        where: { sourceName },
        data: {
          lastSyncTime: null,
          itemsCount: 0,
        },
      });

    } catch (error) {
      console.warn(`⚠️ [Admin Scrapers] 清理 DataSource 同步标记失败:`, error);
    }

    // 🔥 修复：在开始执行前，先更新任务状态为"运行中"，避免前端一直显示"抓取中"
    // 🔥 容错降级：如果数据库连接失败，记录日志但不中断流程
    const taskName = `${sourceName}_Main`;
    try {
      console.log(`🔍 [DEBUG] [run] 步骤 1: 更新任务状态为"运行中"...`);
      const existingTask = await prisma.scraper_tasks.findUnique({
        where: { name: taskName }
      });
      
      const runningStatus = {
        lastRunTime: new Date(),
        status: 'NORMAL' as const, // 使用 NORMAL 表示正在运行
        message: '正在抓取中...',
      };
      
      if (existingTask) {
        await prisma.scraper_tasks.update({
          where: { name: taskName },
          data: runningStatus,
        });
        console.log(`✅ [DEBUG] [run] 任务状态已更新为"运行中"`);
      } else {
        await prisma.scraper_tasks.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            name: taskName,
            ...runningStatus,
            frequency: 10,
          },
        });
        console.log(`✅ [DEBUG] [run] 任务已创建并设置为"运行中"`);
      }
    } catch (error) {
      // 🔥 容错降级：数据库连接失败时记录日志但不中断流程
      console.error(`❌ [DEBUG] [run] 更新运行状态失败（容错降级，继续执行）:`, error);
      console.warn(`⚠️ [Admin Scrapers] 更新运行状态失败:`, error);
    }

    // 根据 sourceName 创建对应的适配器
    let adapter;
    switch (sourceName) {
      case 'Polymarket':
        // 🔥 性能优化：降低 limit 到 500，减少处理时间（之前1000条太慢）
        // 如果需要更多数据，可以分批运行或增加超时时间
        adapter = new PolymarketAdapter(500); // 🔥 优化：500 条（平衡速度和数据量）
        break;
      default:
        console.error(`❌ [Admin Scrapers] 未知的采集源: ${sourceName}`);
        return NextResponse.json(
          {
            success: false,
            error: `未知的采集源: ${sourceName}`,
          },
          { status: 400 }
        );
    }

    // 执行采集（带超时保护）
    console.log(`🔍 [DEBUG] [run] 步骤 2: 开始执行采集器...`);
    const executeStartTime = Date.now();
    let result;
    try {
      result = await adapter.execute();
      const executeTime = Date.now() - executeStartTime;
      console.log(`✅ [DEBUG] [run] 采集器执行完成 (耗时: ${executeTime}ms)`);
    } catch (error) {
      const executeTime = Date.now() - executeStartTime;
      console.error(`❌ [DEBUG] [run] 采集器执行失败 (耗时: ${executeTime}ms)`);
      // 🔥 修复：如果执行失败，更新状态为异常
      const errorMessage = error instanceof Error ? error.message : '采集执行失败';
      try {
        const existing = await prisma.scraper_tasks.findUnique({
          where: { name: taskName }
        });
        if (existing) {
          await prisma.scraper_tasks.update({
            where: { name: taskName },
            data: {
              lastRunTime: new Date(),
              status: 'ABNORMAL' as const,
              message: errorMessage,
            },
          });
        }
      } catch (updateError) {
        console.warn(`⚠️ [Admin Scrapers] 更新失败状态失败:`, updateError);
      }
      throw error;
    }

    // 🔥 更新 ScraperTask 状态（使用 findUnique + update/create 代替 upsert）
    // 🔥 容错降级：确保状态更新不会因为数据库问题而失败
    console.log(`🔍 [DEBUG] [run] 步骤 3: 更新任务状态...`);
    try {
      const existing = await prisma.scraper_tasks.findUnique({
        where: { name: taskName }
      });

      if (result.success) {
        const updateData = {
          lastRunTime: new Date(),
          status: 'NORMAL' as const,
          message: `成功采集 ${result.itemsCount} 条数据`,
        };
        
        if (existing) {
          await prisma.scraper_tasks.update({
            where: { name: taskName },
            data: updateData,
          });
          console.log(`✅ [DEBUG] [run] 任务状态已更新为"正常" (采集 ${result.itemsCount} 条)`);
        } else {
          await prisma.scraper_tasks.create({
            data: {
            id: randomUUID(),
            updatedAt: new Date(),
              name: taskName,
              ...updateData,
              frequency: 10,
            },
          });
          console.log(`✅ [DEBUG] [run] 任务已创建并设置为"正常" (采集 ${result.itemsCount} 条)`);
        }
      } else {
        const errorMessage = result.error || '采集失败';
        const updateData = {
          lastRunTime: new Date(),
          status: 'ABNORMAL' as const,
          message: errorMessage,
        };
        
        if (existing) {
          await prisma.scraper_tasks.update({
            where: { name: taskName },
            data: updateData,
          });
          console.log(`⚠️ [DEBUG] [run] 任务状态已更新为"异常": ${errorMessage}`);
        } else {
          await prisma.scraper_tasks.create({
            data: {
            id: randomUUID(),
            updatedAt: new Date(),
              name: taskName,
              ...updateData,
              frequency: 10,
            },
          });
          console.log(`⚠️ [DEBUG] [run] 任务已创建并设置为"异常": ${errorMessage}`);
        }
      }
    } catch (error) {
      // 🔥 容错降级：状态更新失败时记录详细日志，但不中断流程
      console.error(`❌ [DEBUG] [run] 更新 ScraperTask 状态失败（容错降级）:`, error);
      console.error(`❌ [DEBUG] [run] 错误详情:`, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        taskName,
        resultSuccess: result.success,
        resultItemsCount: result.itemsCount,
      });
      console.warn(`⚠️ [Admin Scrapers] 更新 ScraperTask 失败:`, error);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `采集成功，共处理 ${result.itemsCount} 条数据`,
        data: {
          itemsCount: result.itemsCount,
        },
      });
    } else {
      // 返回详细的错误信息
      const errorMessage = result.error || '采集失败';
      console.error(`❌ [Admin Scrapers] 采集失败: ${errorMessage}`);
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          data: {
            itemsCount: result.itemsCount,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // 详细的错误日志
    console.error('❌ [Admin Scrapers] 运行采集失败 (catch 块):');
    console.error(`   错误类型: ${error?.constructor?.name || 'Unknown'}`);
    console.error(`   错误消息: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`   错误堆栈: ${error instanceof Error ? error.stack : 'N/A'}`);
    console.error(`   完整错误对象:`, error);
    
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : String(error);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
