import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';

/**
 * 获取用户交易历史 API
 * GET /api/user/trades
 * 
 * 返回当前登录用户的所有已成交订单（交易记录）
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 🔥 使用统一的 NextAuth 认证
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error,
        },
        { status: authResult.statusCode }
      );
    }

    const userId = authResult.userId;

    // 查询所有已成交的订单（FILLED 或 PARTIALLY_FILLED）
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: {
          in: ['FILLED', 'PARTIALLY_FILLED'], // 只返回已成交的订单
        },
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            status: true,
            resolvedOutcome: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // 最新的在前
      },
    });

    // 批量查询相关的 Position 以获取真实的成交价格
    const positions = await prisma.position.findMany({
      where: {
        userId,
        marketId: {
          in: orders.map(o => o.marketId),
        },
      },
      select: {
        id: true,
        marketId: true,
        outcome: true,
        avgPrice: true,
        shares: true,
        createdAt: true,
      },
    });

    // 格式化数据为前端需要的格式
    const trades = orders.map((order) => {
      // 查找对应的 Position 以获取真实的成交价格
      // 匹配条件：相同的 marketId 和 outcome，且创建时间接近订单时间
      const matchingPosition = positions.find(p => 
        p.marketId === order.marketId && 
        p.outcome === order.outcomeSelection &&
        Math.abs(p.createdAt.getTime() - order.createdAt.getTime()) < 60000 // 60秒内
      );

      let price: number;
      let shares: number;
      
      if (order.orderType === 'LIMIT' && order.limitPrice && order.filledAmount > 0) {
        // 限价单：使用限价和已成交量
        price = order.limitPrice;
        shares = order.filledAmount;
      } else if (matchingPosition) {
        // 市价单：从 Position 表获取真实的成交价格
        price = matchingPosition.avgPrice;
        shares = matchingPosition.shares;
      } else {
        // 兜底逻辑：如果找不到 Position，使用估算值
        shares = order.filledAmount || 0;
        price = shares > 0 ? order.amount / shares : 0;
      }
      
      // 判断操作类型
      const action = order.type === 'BUY' || !order.type ? '买入' : '卖出';
      
      // 判断状态
      const status = order.status === 'FILLED' ? '已成交' : '部分成交';

      return {
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        marketId: order.marketId,
        marketTitle: order.market.title,
        action: action,
        outcome: order.outcomeSelection,
        price: price,
        shares: shares,
        amount: order.amount,
        status: status,
      };
    });

    return NextResponse.json({
      success: true,
      data: trades,
    });
  } catch (error) {
    console.error('Get trades API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
