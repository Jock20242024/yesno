/**
 * 修复工厂市场状态API
 * POST /api/admin/factory/fix-status
 * 
 * 修复状态错误的市场：
 * - 未来场次但状态为 CLOSED 的 -> 更新为 OPEN
 * - 过去场次但状态为 OPEN 的 -> 更新为 CLOSED
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '@/lib/dayjs';

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
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = dayjs.utc().toDate();
    
    // 1. 修复未来场次但状态为 CLOSED 的 -> 更新为 OPEN
    const fixFutureClosed = await prisma.market.updateMany({
      where: {
        isFactory: true,
        isActive: true,
        status: MarketStatus.CLOSED,
        closingDate: { gt: now },
      },
      data: {
        status: MarketStatus.OPEN,
      },
    });
    
    // 2. 修复过去场次但状态为 OPEN 的 -> 更新为 CLOSED
    const fixPastOpen = await prisma.market.updateMany({
      where: {
        isFactory: true,
        isActive: true,
        status: MarketStatus.OPEN,
        closingDate: { lt: now },
      },
      data: {
        status: MarketStatus.CLOSED,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: '状态修复完成',
      fixed: {
        futureClosedToOpen: fixFutureClosed.count,
        pastOpenToClosed: fixPastOpen.count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [Fix Status] 修复失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
