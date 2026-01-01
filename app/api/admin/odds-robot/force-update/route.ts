/**
 * 立即强制更新赔率 API
 * POST /api/admin/odds-robot/force-update
 * 
 * 立即触发一次赔率同步，不等待定时任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/authExport';
import { prisma } from '@/lib/prisma';
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

    // 🔥 立即触发赔率同步

    const syncResult = await syncOdds();

    // 🔥 核心修复：只有在获取到有效的 adminId 时才记录日志
    if (adminUserId) {
      try {
        await prisma.admin_logs.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            adminId: adminUserId, // 使用已验证的 adminId
            actionType: 'ODDS_ROBOT_FORCE_UPDATE',
            details: `立即强制更新赔率: 检查 ${syncResult.itemsCount} 个，加入队列 ${syncResult.queuedCount} 个，过滤 ${syncResult.filteredCount} 个（命中率: ${syncResult.diffHitRate}%）`,
            timestamp: new Date(),
          },
        });
      } catch (logError: any) {
        // 日志记录失败不影响主流程，只记录错误
        console.error('❌ [Odds Robot Force Update API] 日志记录失败:', logError);
      }
    } else {
      console.warn('⚠️ [Odds Robot Force Update API] 未能获取有效的管理员用户 ID，跳过数据库日志记录以防止 P2003 错误');
    }

    return NextResponse.json({
      success: true,
      message: '赔率强制更新已触发并完成同步',
      data: {
        itemsCount: syncResult.itemsCount,
        queuedCount: syncResult.queuedCount,
        filteredCount: syncResult.filteredCount,
        diffHitRate: syncResult.diffHitRate,
        lastPulse: syncResult.lastPulse?.toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [Odds Robot Force Update API] 强制更新失败:', error);
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
