import { NextResponse } from 'next/server';
import { DBService } from '@/lib/mockData';
import { MarketStatus, Outcome } from '@/types/data';
import { verifyAdminToken, createUnauthorizedResponse } from '@/lib/adminAuth';

/**
 * 管理后台 - 市场清算 API
 * POST /api/admin/markets/[market_id]/settle
 * 
 * 请求体：
 * {
 *   finalOutcome: "YES" | "NO";  // 市场的最终结果
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 权限校验：使用统一的 Admin Token 验证函数（从 Cookie 读取）
    const authResult = await verifyAdminToken(request);

    if (!authResult.success) {
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
    }

    const { market_id } = await params;

    // 解析请求体
    const body = await request.json();
    const { finalOutcome } = body;

    // 验证必需字段
    if (!finalOutcome) {
      return NextResponse.json(
        {
          success: false,
          error: 'finalOutcome is required',
        },
        { status: 400 }
      );
    }

    // 结果校验：验证 finalOutcome 必须是 YES 或 NO
    if (finalOutcome !== 'YES' && finalOutcome !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'finalOutcome must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 获取市场信息
    const market = await DBService.findMarketById(market_id);
    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 业务校验：验证市场状态必须是 CLOSED
    if (market.status !== MarketStatus.CLOSED) {
      return NextResponse.json(
        {
          success: false,
          error: `Market must be CLOSED to settle. Current status: ${market.status}`,
        },
        { status: 400 }
      );
    }

    // 获取该市场的所有订单
    const orders = await DBService.findOrdersByMarketId(market_id);

    // 使用 Prisma 事务确保清算操作的原子性
    const { prisma } = await import('@/lib/prisma');
    
    const result = await prisma.$transaction(async (tx) => {
      // 清算计算（核心事务）
      let winningOrdersCount = 0;
      let totalPayout = 0;
      const userPayouts = new Map<string, number>(); // userId -> total payout

      // 遍历所有订单并计算盈亏
      // 计算总池（扣除手续费后的净池）
      const totalFees = orders.reduce((sum, o) => sum + o.feeDeducted, 0);
      const netTotalPool = market.totalVolume - totalFees;
      
      // 计算获胜池（扣除手续费后的净池）
      const winningOrders = orders.filter(o => o.outcomeSelection === (finalOutcome as Outcome));
      const winningPoolFees = winningOrders.reduce((sum, o) => sum + o.feeDeducted, 0);
      const winningPool = finalOutcome === 'YES' ? market.totalYes : market.totalNo;
      const netWinningPool = winningPool - winningPoolFees;
      
      // 准备批量更新操作
      const orderUpdates: Array<{ id: string; payout: number }> = [];
      
      for (const order of orders) {
        if (order.outcomeSelection === (finalOutcome as Outcome)) {
          // 订单获胜，计算回报金额
          if (netWinningPool > 0) {
            // 计算每单位净投资的回报率
            const payoutRate = netTotalPool / netWinningPool;
            // 计算该订单的净投资（已扣除手续费）
            const netInvestment = order.amount - order.feeDeducted;
            // 计算回报金额（基于净投资和回报率）
            const payout = netInvestment * payoutRate;
            
            // 累计用户回报
            const currentPayout = userPayouts.get(order.userId) || 0;
            userPayouts.set(order.userId, currentPayout + payout);
            
            totalPayout += payout;
            winningOrdersCount++;
            orderUpdates.push({ id: order.id, payout });
          } else {
            // 获胜池为0，回报为0
            orderUpdates.push({ id: order.id, payout: 0 });
          }
        } else {
          // 订单失败，回报为0
          orderUpdates.push({ id: order.id, payout: 0 });
        }
      }

      // 批量更新订单 payout
      await Promise.all(
        orderUpdates.map(({ id, payout }) =>
          tx.order.update({
            where: { id },
            data: { payout },
          })
        )
      );

      // 批量更新用户余额
      await Promise.all(
        Array.from(userPayouts.entries()).map(async ([userId, payout]) => {
          const user = await tx.user.findUnique({ where: { id: userId } });
          if (user) {
            await tx.user.update({
              where: { id: userId },
              data: { balance: user.balance + payout },
            });
          }
        })
      );

      // 更新市场状态
      const updatedMarket = await tx.market.update({
        where: { id: market_id },
        data: {
          status: MarketStatus.RESOLVED,
          resolvedOutcome: finalOutcome as Outcome,
        },
      });

      return {
        updatedMarket,
        winningOrdersCount,
        totalPayout,
        affectedUsers: userPayouts.size,
      };
    });

    // 转换 Prisma 模型为业务实体类型
    const marketData = {
      id: result.updatedMarket.id,
      title: result.updatedMarket.title,
      description: result.updatedMarket.description,
      closingDate: result.updatedMarket.closingDate.toISOString(),
      resolvedOutcome: result.updatedMarket.resolvedOutcome as Outcome,
      status: result.updatedMarket.status as MarketStatus,
      totalVolume: result.updatedMarket.totalVolume,
      totalYes: result.updatedMarket.totalYes,
      totalNo: result.updatedMarket.totalNo,
      feeRate: result.updatedMarket.feeRate,
      createdAt: result.updatedMarket.createdAt.toISOString(),
      updatedAt: result.updatedMarket.updatedAt.toISOString(),
    };

    // 返回清算成功的市场信息和受影响的用户/订单统计信息
    return NextResponse.json({
      success: true,
      message: 'Market settled successfully',
      data: {
        market: marketData,
        statistics: {
          totalOrders: orders.length,
          winningOrders: result.winningOrdersCount,
          losingOrders: orders.length - result.winningOrdersCount,
          totalPayout: result.totalPayout,
          affectedUsers: result.affectedUsers,
        },
      },
    });
  } catch (error) {
    console.error('Market settle API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
