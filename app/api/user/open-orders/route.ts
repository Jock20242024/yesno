import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 获取用户当前挂单列表 API (向后兼容路由)
 * GET /api/user/open-orders
 * 
 * 🔥 核心修复：现在数据库已支持 status 字段，可以查询真实的 PENDING 订单
 * 
 * 返回当前登录用户的所有PENDING状态的LIMIT订单（挂单）
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // 🔥 使用统一的 NextAuth 认证
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;

    // 🔥 核心修复：查询 PENDING 状态的 LIMIT 订单，必须关联 Market 表
    const openOrders = await prisma.order.findMany({
      where: {
        userId,
        status: 'PENDING', // 🔥 核心：只查询未成交的订单
        orderType: 'LIMIT', // 🔥 只查询限价单（市价单立即成交，不会有挂单）
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            image: true,
            iconUrl: true,
            status: true,
            closingDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('🔍 [Open Orders API] 查询结果:', {
      userId,
      orderCount: openOrders.length,
      orders: openOrders.map(o => ({
        id: o.id,
        marketId: o.marketId,
        marketTitle: o.market?.title,
        status: o.status,
        orderType: o.orderType,
        limitPrice: o.limitPrice,
      })),
    });

    // 格式化订单数据
    const formattedOrders = openOrders.map((order) => ({
      id: order.id,
      marketId: order.marketId,
      marketTitle: order.market?.title || `市场 ${order.marketId}`,
      marketImage: order.market?.image || order.market?.iconUrl || null,
      marketStatus: order.market?.status,
      marketClosingDate: order.market?.closingDate?.toISOString(),
      outcome: order.outcomeSelection,
      type: order.type || 'BUY',
      orderType: order.orderType || 'LIMIT',
      limitPrice: order.limitPrice ?? null,
      amount: order.amount,
      filledAmount: order.filledAmount || 0,
      remainingQuantity: order.limitPrice 
        ? (order.amount - (order.filledAmount || 0)) / order.limitPrice 
        : null,
      status: order.status || 'PENDING',
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    console.error('Get open orders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
