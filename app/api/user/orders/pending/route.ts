import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 获取用户当前挂单列表 API
 * GET /api/user/orders/pending
 * 
 * 返回当前登录用户的所有PENDING状态的LIMIT订单（挂单）
 * 
 * 🔥 核心架构升级：支持 CLOB（限价单）模式
 * - 查询 status='PENDING' 且 orderType='LIMIT' 的订单
 * - 这些订单还未成交，资金已冻结但未创建 Position
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

    // 🔥 核心架构升级：现在数据库已支持 status 字段，可以查询 PENDING 订单
    const openOrders = await prisma.orders.findMany({
      where: {
        userId,
        status: 'PENDING', // 🔥 核心：只查询未成交的订单
        orderType: 'LIMIT', // 🔥 只查询限价单（市价单立即成交，不会有挂单）
      },
      include: {
        markets: {
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

    // 格式化订单数据
    const formattedOrders = openOrders.map((order) => ({
      id: order.id,
      marketId: order.marketId,
      marketTitle: order.markets?.title || `市场 ${order.marketId}`,
      marketImage: order.markets?.image || order.markets?.iconUrl || null,
      marketStatus: order.markets?.status,
      marketClosingDate: order.markets?.closingDate?.toISOString(),
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
    console.error('Get pending orders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
