/**
 * 自动化采集任务路由
 * GET /api/cron/sync
 * 
 * 用于定时任务（Cron）触发采集
 * 可以通过外部 Cron 服务（如 Vercel Cron）定期调用
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { PolymarketAdapter } from '@/lib/scrapers/polymarketAdapter';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

/**
 * 验证 Cron 请求（可选：添加安全验证）
 */
function verifyCronRequest(request: NextRequest): boolean {
  // 🔥 可选：验证请求来源（如 Vercel Cron Secret）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  
  return true;
}

/**
 * 更新 ScraperTask 状态
 */
async function updateScraperTask(
  taskName: string,
  status: 'NORMAL' | 'ABNORMAL' | 'STOPPED',
  message?: string
) {
  try {
    await prisma.scraper_tasks.upsert({
      where: { name: taskName },
      create: {
        id: randomUUID(),
        updatedAt: new Date(),
        name: taskName,
        lastRunTime: new Date(),
        status,
        message: message || null,
        frequency: 10, // 默认 10 分钟
      },
      update: {
        lastRunTime: new Date(),
        status,
        message: message || null,
      },
    });

  } catch (error) {
    console.error(`❌ [Cron Sync] 更新 ScraperTask 失败:`, error);
  }
}

/**
 * GET /api/cron/sync
 * 执行自动化采集任务
 */
export async function GET(request: NextRequest) {
  const taskName = 'Polymarket_Main';
  
  try {
    // 🔥 可选：验证 Cron 请求（生产环境建议启用）
    // if (!verifyCronRequest(request)) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    // 创建适配器（limit=1000 全量抓取）
    const adapter = new PolymarketAdapter(1000);
    
    // 执行采集
    const result = await adapter.execute();
    
    // 根据结果更新 ScraperTask 状态
    if (result.success) {
      await updateScraperTask(taskName, 'NORMAL', `成功采集 ${result.itemsCount} 条数据`);
      
      return NextResponse.json({
        success: true,
        message: `采集成功，共处理 ${result.itemsCount} 条数据`,
        data: {
          itemsCount: result.itemsCount,
          taskName,
          lastRunTime: new Date().toISOString(),
        },
      });
    } else {
      const errorMessage = result.error || '采集失败';
      await updateScraperTask(taskName, 'ABNORMAL', errorMessage);
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          data: {
            itemsCount: result.itemsCount,
            taskName,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ [Cron Sync] 采集任务失败:`, error);
    
    // 更新状态为异常
    await updateScraperTask(taskName, 'ABNORMAL', errorMessage);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
