/**
 * 赔率机器人统计 API
 * GET /api/admin/odds-robot/stats
 * 
 * 返回 oddsRobot.ts 记录的实时数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
import { getQueueStats } from '@/lib/queue/oddsQueue';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 🔥 从数据库获取机器人运行状态（从 scraper_tasks 表或缓存中读取）
    // 查找名为 'OddsRobot' 的 scraper task
    const robotTask = await prisma.scraperTask.findUnique({
      where: { name: 'OddsRobot' },
      select: {
        id: true,
        name: true,
        status: true,
        lastRunTime: true, // 注意：schema 中是 lastRunTime，不是 lastRunAt
        message: true, // 注意：schema 中是 message，不是 errorMessage
        frequency: true,
        updatedAt: true,
      },
    });

    // 🔥 修改：活跃池逻辑改为"实时同步成功的市场"（有 externalId 的市场）
    // 只统计能够成功同步赔率的市场，而不是所有需要同步的市场
    const [activePoolSize, factoryCount, manualCount] = await Promise.all([
      prisma.market.count({
        where: {
          OR: [
            { source: 'POLYMARKET', isActive: true, status: 'OPEN', externalId: { not: null } },
            { isFactory: true, isActive: true, status: 'OPEN', externalId: { not: null } }, // 🔥 工厂市场必须有 externalId 才能同步赔率
          ],
        },
      }),
      prisma.market.count({
        where: {
          isFactory: true,
          isActive: true,
          status: 'OPEN',
          externalId: { not: null }, // 🔥 只统计有 externalId 的工厂市场（能够同步成功的）
        },
      }),
      prisma.market.count({
        where: {
          source: 'POLYMARKET',
          isFactory: false, // 🔥 手动/其他市场（source='POLYMARKET' 且不是工厂生成的）
          isActive: true,
          status: 'OPEN',
          externalId: { not: null }, // 🔥 只统计有 externalId 的手动市场（能够同步成功的）
        },
      }),
    ]);

    // 计算最近一次成功同步的时间戳
    let lastPulse: string | null = null;
    if (robotTask?.lastRunTime) {
      lastPulse = robotTask.lastRunTime.toISOString();
    }

    // 🔥 从 message 字段中解析数据（新架构：checkedCount, queuedCount, filteredCount, diffHitRate）
    let checkedCount = 0;
    let queuedCount = 0;
    let filteredCount = 0;
    let diffHitRate = 0; // 差分命中率
    let actualErrorMessage: string | null = null; // 🔥 真正的错误消息（不是 JSON 数据）
    let failedMarkets: Array<{ marketId: string; marketTitle: string; externalId: string; reason: string }> = []; // 🔥 失败的市场列表
    
    if (robotTask?.message) {
      try {
        const messageData = JSON.parse(robotTask.message);
        if (typeof messageData === 'object' && messageData !== null) {
          // 🔥 检查是否有 error 字段（真正的错误）
          if (messageData.error) {
            actualErrorMessage = messageData.error;
          }
          
          // 解析正常的数据字段
          checkedCount = messageData.checkedCount || messageData.itemsCount || 0; // 兼容旧数据
          queuedCount = messageData.queuedCount || messageData.updatedCount || 0; // 兼容旧数据
          filteredCount = messageData.filteredCount || 0;
          diffHitRate = messageData.diffHitRate || 0;
          
          // 🔥 解析失败的市场列表
          if (Array.isArray(messageData.failedMarkets)) {
            failedMarkets = messageData.failedMarkets;
          }
        }
      } catch (e) {
        // 如果解析失败，说明 message 是普通字符串（可能是错误消息）
        // 只在状态为 ABNORMAL 时认为是错误消息
        if (robotTask.status === 'ABNORMAL') {
          actualErrorMessage = robotTask.message;
        }
      }
    }

    // 🔥 获取队列统计信息（队列积压量）
    const queueStats = await getQueueStats();

    // 🔥 计算同步效能：数据库写入次数 / 机器人抓取次数
    // 同步效能 = (加入队列数量 / 检查数量) * 100%，直观展示差分过滤效果
    let syncEfficiency = 0;
    if (checkedCount > 0) {
      syncEfficiency = Math.round((queuedCount / checkedCount) * 100);
    }

    // 获取最近的同步日志（从 admin_logs 或专门的日志表）
    const recentLogs = await prisma.adminLog.findMany({
      where: {
        actionType: {
          contains: 'ODDS',
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 20,
      select: {
        id: true,
        actionType: true,
        details: true,
        timestamp: true,
      },
    });

    // 🔥 修复 nextRunAt 计算：基于实际运行间隔（30秒），确保不会显示负数
    let nextRunAt: string | null = null;
    let nextRunInMs: number | null = null;
    if (robotTask?.lastRunTime) {
      // 实际运行间隔是 30 秒（而不是 frequency 字段的 1 分钟）
      const actualIntervalMs = 30 * 1000; // 30 秒
      const calculatedNextRun = new Date(robotTask.lastRunTime.getTime() + actualIntervalMs);
      const now = new Date();
      
      // 如果计算出的下次运行时间已经过去，说明应该立即运行或已经延迟
      // 这种情况下，返回当前时间之后的第一个间隔时间
      if (calculatedNextRun <= now) {
        // 计算从 lastRunTime 到现在的间隔数，然后加 1
        const intervalsSinceLastRun = Math.floor((now.getTime() - robotTask.lastRunTime.getTime()) / actualIntervalMs) + 1;
        const nextRunTime = new Date(robotTask.lastRunTime.getTime() + intervalsSinceLastRun * actualIntervalMs);
        nextRunAt = nextRunTime.toISOString();
        nextRunInMs = nextRunTime.getTime() - now.getTime();
      } else {
        nextRunAt = calculatedNextRun.toISOString();
        nextRunInMs = calculatedNextRun.getTime() - now.getTime();
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: robotTask?.status === 'NORMAL' ? 'ACTIVE' : robotTask?.status === 'ABNORMAL' ? 'ERROR' : 'INACTIVE',
        // 🔥 监控指标
        activePoolSize, // 活跃池：当前正在被机器人高频监控的市场数量
        factoryCount, // 🔥 工厂市场数量
        manualCount, // 🔥 手动/其他市场数量
        lastPulse,
        // 🔥 核心指标
        queueBacklog: queueStats.backlog, // 队列积压量：等待 + 正在处理的任务数
        syncEfficiency, // 同步效能：数据库写入次数 / 机器人抓取次数（%）
        diffHitRate, // 差分命中率：被过滤掉的数量 / 总检查数量（%）
        // 🔥 详细统计
        checkedCount, // 检查的市场数量（机器人抓取次数）
        queuedCount, // 加入队列的数量（数据库写入次数）
        filteredCount, // 被过滤掉的数量（无显著价格变化）
        // 兼容旧字段（保留以便前端平滑过渡）
        itemsCount: checkedCount,
        updatedCount: queuedCount,
        successRate: syncEfficiency, // 同步效能作为成功率
        // 队列详细信息
        queueStats: {
          waiting: queueStats.waiting,
          active: queueStats.active,
          completed: queueStats.completed,
          failed: queueStats.failed,
        },
        errorMessage: actualErrorMessage, // 🔥 只在真正发生错误时显示错误消息
        failedMarkets, // 🔥 失败的市场列表（包含标题和错误原因）
        nextRunAt, // 🔥 修复后的下次运行时间
        nextRunInMs, // 🔥 添加毫秒数，便于前端显示
        recentLogs: recentLogs.map(log => ({
          id: log.id,
          actionType: log.actionType,
          details: log.details,
          timestamp: log.timestamp.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('❌ [Odds Robot Stats API] 获取统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
