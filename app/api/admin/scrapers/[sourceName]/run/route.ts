import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { PolymarketAdapter } from '@/lib/scrapers/polymarketAdapter';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

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
  try {
    const { sourceName } = await params;

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

    // 根据 sourceName 创建对应的适配器
    let adapter;
    switch (sourceName) {
      case 'Polymarket':
        // 🔥 全量抓取：将 limit 提高到 1000，确保抓取更多数据

        adapter = new PolymarketAdapter(1000); // 🔥 全量抓取：1000 条
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

    // 执行采集

    const result = await adapter.execute();

    // 🔥 更新 ScraperTask 状态（使用 findUnique + update/create 代替 upsert）
    const taskName = `${sourceName}_Main`;
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
        }
      }
    } catch (error) {
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
