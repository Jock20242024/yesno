/**
 * 获取采集器任务状态
 * GET /api/admin/scrapers/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 获取所有采集器任务状态
    const tasks = await prisma.scraperTask.findMany({
      orderBy: {
        lastRunTime: 'desc',
      },
    });

    // 🔥 如果没有"全网数据计算"任务，创建一个默认记录（首次使用时）
    const globalStatsTaskExists = tasks.some(task => 
      task.name === 'GlobalStats_Calc' || task.name.includes('GlobalStats')
    );
    
    if (!globalStatsTaskExists) {
      // 创建默认任务记录
      await prisma.scraperTask.create({
        data: {
          name: 'GlobalStats_Calc',
          lastRunTime: new Date(),
          status: 'NORMAL',
          message: '任务已创建，等待首次运行',
          frequency: 10,
        },
      });
      console.log(`✅ [Scraper Status API] 已创建默认 GlobalStats_Calc 任务记录`);
    }

    // 重新获取所有任务（包含刚创建的）
    const allTasks = await prisma.scraperTask.findMany({
      orderBy: {
        lastRunTime: 'desc',
      },
    });

    // 计算每个任务的状态（正常/异常）
    const tasksWithStatus = allTasks.map(task => {
      const now = new Date();
      const lastRun = new Date(task.lastRunTime);
      const minutesSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60));
      const isOverdue = minutesSinceLastRun > task.frequency * 2; // 超过 2 倍频率未运行视为异常
      
      let healthStatus: 'NORMAL' | 'ABNORMAL' = 'NORMAL';
      if (task.status === 'ABNORMAL' || task.status === 'STOPPED' || isOverdue) {
        healthStatus = 'ABNORMAL';
      }

      return {
        id: task.id,
        name: task.name,
        lastRunTime: task.lastRunTime.toISOString(),
        status: task.status,
        healthStatus, // 计算出的健康状态
        message: task.message,
        frequency: task.frequency,
        minutesSinceLastRun,
        isOverdue,
      };
    });

    return NextResponse.json({
      success: true,
      data: tasksWithStatus,
    });
  } catch (error) {
    console.error('❌ [Scraper Status API] 获取状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取状态失败',
      },
      { status: 500 }
    );
  }
}
