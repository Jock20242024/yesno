/**
 * 手动重启赔率机器人 API
 * POST /api/admin/odds-robot/restart
 * 
 * 重构后：只负责重置队列状态，不直接操作数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
import { clearQueue } from '@/lib/queue/oddsQueue';
import { syncOdds } from '@/lib/scrapers/oddsRobot';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // 🔥 核心修复：严格校验 adminId
    let adminUserId: string | null = null;
    if (userEmail) {
      const adminUser = await prisma.users.findUnique({
        where: { email: userEmail },
        select: { id: true },
      });
      if (adminUser?.id) {
        adminUserId = adminUser.id;
      }
    }

    // 🔥 重置队列状态（清空队列）

    await clearQueue();

    // 🔥 直接调用 syncOdds() 执行一次同步（重启逻辑）

    const syncResult = await syncOdds();

    // 🔥 核心修复：只有在获取到有效的 adminId 时才记录日志
    if (adminUserId) {
      try {
        await prisma.admin_logs.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            adminId: adminUserId, // 使用已验证的 adminId
            actionType: 'ODDS_ROBOT_RESTART',
            details: `手动重启赔率机器人: 检查 ${syncResult.itemsCount} 个市场，加入队列 ${syncResult.queuedCount} 个，过滤 ${syncResult.filteredCount} 个（命中率: ${syncResult.diffHitRate}%）`,
            timestamp: new Date(),
          },
        });
      } catch (logError: any) {
        // 日志记录失败不影响主流程，只记录错误
        console.error('❌ [Odds Robot Restart API] 日志记录失败:', logError);
      }
    } else {
      console.warn('⚠️ [Odds Robot Restart API] 未能获取有效的管理员用户 ID，跳过数据库日志记录以防止 P2003 错误');
    }

    return NextResponse.json({
      success: true,
      message: '赔率机器人已重启并执行同步',
      data: {
        itemsCount: syncResult.itemsCount,
        queuedCount: syncResult.queuedCount,
        filteredCount: syncResult.filteredCount,
        diffHitRate: syncResult.diffHitRate,
        lastPulse: syncResult.lastPulse?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [Odds Robot Restart API] 重启崩溃:', error);
    console.error('错误堆栈:', error.stack);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
