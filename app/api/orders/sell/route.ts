import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MarketStatus, Outcome } from '@/types/data';
import { prisma } from '@/lib/prisma';
import { DBService } from '@/lib/dbService';
import { getSession } from '@/lib/auth-core/sessionStore';

/**
 * 卖出订单 API
 * POST /api/orders/sell
 * 
 * 处理用户卖出持仓请求
 * 请求体：
 * - marketId: 市场ID
 * - outcome: 选择的结果选项 (YES/NO)
 * - shares: 卖出的份额
 */
export async function POST(request: Request) {
  try {
    // 从 Cookie 读取 auth_core_session
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('auth_core_session')?.value;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 调用 sessionStore.getSession(sessionId)
    const userId = await getSession(sessionId);
    
    // 若 session 不存在，返回 401
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Session expired or invalid' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { marketId, outcome, shares } = body;

    // 3. 验证必需字段
    if (!marketId || !outcome || !shares) {
      return NextResponse.json(
        {
          success: false,
          error: 'marketId, outcome, and shares are required',
        },
        { status: 400 }
      );
    }

    // 4. 验证outcome
    if (outcome !== 'YES' && outcome !== 'NO') {
      return NextResponse.json(
        {
          success: false,
          error: 'outcome must be YES or NO',
        },
        { status: 400 }
      );
    }

    // 5. 验证shares
    const sharesNum = parseFloat(shares);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'shares must be a positive number',
        },
        { status: 400 }
      );
    }

    // 6. 查询市场
    const market = await DBService.findMarketById(marketId);
    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    if (market.status !== MarketStatus.OPEN) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is not open for trading',
        },
        { status: 400 }
      );
    }

    // 7. 使用事务执行卖出操作
    const PRECISION_MULTIPLIER = 100;
    
    const result = await prisma.$transaction(async (tx) => {
      // 7.1 锁定用户和Position记录
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // 7.2 查询OPEN Position（带锁）
      const position = await tx.position.findFirst({
        where: {
          userId,
          marketId,
          outcome: outcome as Outcome,
          status: 'OPEN',
        },
      });

      if (!position) {
        throw new Error('Position not found');
      }

      if (position.shares < sharesNum) {
        throw new Error('Insufficient shares');
      }

      // 7.3 计算当前市场价格
      const totalVolume = market.totalYes + market.totalNo;
      const currentPrice = outcome === 'YES'
        ? (market.totalYes / totalVolume)
        : (market.totalNo / totalVolume);

      // 7.4 计算卖出金额（扣除手续费）
      const grossValue = sharesNum * currentPrice;
      const feeRate = market.feeRate || 0.02;
      const feeDeducted = grossValue * feeRate;
      const netReturn = grossValue - feeDeducted;

      // 7.5 更新用户余额
      const userBalanceCents = Math.round(user.balance * PRECISION_MULTIPLIER);
      const netReturnCents = Math.round(netReturn * PRECISION_MULTIPLIER);
      const newBalanceCents = userBalanceCents + netReturnCents;
      const newBalance = newBalanceCents / PRECISION_MULTIPLIER;

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      });

      // 7.6 更新市场池（反向操作）
      const marketTotalVolumeCents = Math.round(market.totalVolume * PRECISION_MULTIPLIER);
      const marketTotalYesCents = Math.round(market.totalYes * PRECISION_MULTIPLIER);
      const marketTotalNoCents = Math.round(market.totalNo * PRECISION_MULTIPLIER);
      
      const grossValueCents = Math.round(grossValue * PRECISION_MULTIPLIER);
      const newTotalVolumeCents = marketTotalVolumeCents - grossValueCents;
      
      const newTotalYesCents = outcome === 'YES'
        ? marketTotalYesCents - Math.round(netReturn * PRECISION_MULTIPLIER)
        : marketTotalYesCents;
      const newTotalNoCents = outcome === 'NO'
        ? marketTotalNoCents - Math.round(netReturn * PRECISION_MULTIPLIER)
        : marketTotalNoCents;

      const newTotalVolume = newTotalVolumeCents / PRECISION_MULTIPLIER;
      const newTotalYes = newTotalYesCents / PRECISION_MULTIPLIER;
      const newTotalNo = newTotalNoCents / PRECISION_MULTIPLIER;

      const updatedMarket = await tx.market.update({
        where: { id: marketId },
        data: {
          totalVolume: newTotalVolume,
          totalYes: newTotalYes,
          totalNo: newTotalNo,
        },
      });

      // 7.7 创建Order记录（SELL类型）
      const orderId = `O-SELL-${Date.now()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          userId,
          marketId,
          outcomeSelection: outcome as Outcome,
          amount: netReturn,
          feeDeducted,
          type: 'SELL',
        },
      });

      // 7.8 更新Position
      const remainingShares = position.shares - sharesNum;
      const shouldClose = remainingShares <= 0.001;

      const updatedPosition = await tx.position.update({
        where: { id: position.id },
        data: {
          shares: shouldClose ? 0 : remainingShares,
          status: shouldClose ? 'CLOSED' : 'OPEN',
        },
      });

      return {
        updatedUser,
        updatedMarket,
        newOrder,
        updatedPosition,
        netReturn,
      };
    });

    console.log('✅ [Sell API] 卖出成功:', {
      userId,
      marketId,
      outcome,
      shares: sharesNum,
      netReturn: result.netReturn,
      positionStatus: result.updatedPosition.status,
    });

    return NextResponse.json({
      success: true,
      message: 'Sell order executed successfully',
      data: {
        order: {
          id: result.newOrder.id,
          type: 'SELL',
          shares: sharesNum,
          netReturn: result.netReturn,
        },
        updatedBalance: result.updatedUser.balance,
        updatedMarket: {
          totalVolume: result.updatedMarket.totalVolume,
          totalYes: result.updatedMarket.totalYes,
          totalNo: result.updatedMarket.totalNo,
        },
        position: {
          shares: result.updatedPosition.shares,
          status: result.updatedPosition.status,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [Sell API] 卖出失败:', error);
    
    if (error.message === 'Position not found' || error.message === 'Insufficient shares') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: error.message }),
      },
      { status: 500 }
    );
  }
}
