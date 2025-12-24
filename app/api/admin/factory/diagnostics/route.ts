/**
 * 工厂市场诊断API
 * GET /api/admin/factory/diagnostics
 * 
 * 用于诊断工厂市场的状态和同步情况
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { MarketStatus } from '@prisma/client';
import dayjs from '@/lib/dayjs';

export const dynamic = 'force-dynamic';

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
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = dayjs.utc();
    
    // 1. 统计所有工厂市场
    const totalFactory = await prisma.market.count({
      where: { isFactory: true, isActive: true },
    });
    
    // 2. 统计 OPEN 状态的工厂市场（当前需要同步的）
    const openFactory = await prisma.market.count({
      where: { 
        isFactory: true, 
        isActive: true, 
        status: MarketStatus.OPEN 
      },
    });
    
    // 3. 统计 CLOSED 状态的工厂市场（已结束的）
    const closedFactory = await prisma.market.count({
      where: { 
        isFactory: true, 
        isActive: true, 
        status: MarketStatus.CLOSED 
      },
    });
    
    // 4. 统计有 externalId 的 OPEN 工厂市场（可以同步赔率的未来场次）
    const openWithExternalId = await prisma.market.count({
      where: { 
        isFactory: true, 
        isActive: true, 
        status: MarketStatus.OPEN,
        externalId: { not: null }
      },
    });
    
    // 5. 统计没有 externalId 的 OPEN 工厂市场（无法同步赔率的未来场次）
    const openWithoutExternalId = await prisma.market.count({
      where: { 
        isFactory: true, 
        isActive: true, 
        status: MarketStatus.OPEN,
        externalId: null
      },
    });
  
    // 6. 统计未来场次（closingDate > now）但状态为 CLOSED 的（可能的错误）
    const futureButClosed = await prisma.market.count({
      where: {
        isFactory: true,
        isActive: true,
        status: MarketStatus.CLOSED,
        closingDate: { gt: now.toDate() },
      },
    });
    
    // 7. 统计过去场次（closingDate < now）但状态为 OPEN 的（可能的错误）
    const pastButOpen = await prisma.market.count({
      where: {
        isFactory: true,
        isActive: true,
        status: MarketStatus.OPEN,
        closingDate: { lt: now.toDate() },
      },
    });
    
    // 8. 查看最近的几个 OPEN 工厂市场
    const recentOpen = await prisma.market.findMany({
      where: { 
        isFactory: true, 
        isActive: true, 
        status: MarketStatus.OPEN 
      },
      select: {
        id: true,
        title: true,
        status: true,
        externalId: true,
        closingDate: true,
        period: true,
        templateId: true,
      },
      orderBy: { closingDate: 'asc' },
      take: 10,
    });
    
    // 9. 按模板统计
    const byTemplate = await prisma.market.groupBy({
      by: ['templateId'],
      where: { isFactory: true, isActive: true, status: MarketStatus.OPEN },
      _count: true,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalFactory,
          openFactory,
          closedFactory,
          openWithExternalId,
          openWithoutExternalId,
          futureButClosed, // 🔥 可能的错误：未来场次被标记为CLOSED
          pastButOpen, // 🔥 可能的错误：过去场次被标记为OPEN
        },
        recentOpen: recentOpen.map(m => ({
          id: m.id,
          title: m.title,
          status: m.status,
          externalId: m.externalId || null,
          closingDate: m.closingDate.toISOString(),
          period: m.period,
          templateId: m.templateId,
          isFuture: dayjs.utc(m.closingDate).isAfter(now),
        })),
        byTemplate: byTemplate.map(item => ({
          templateId: item.templateId,
          count: item._count,
        })),
        currentTime: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ [Factory Diagnostics] 诊断失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
