import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth-core/sessionStore';

/**
 * 获取用户持仓列表 API
 * GET /api/positions
 * 
 * 返回当前登录用户的所有OPEN状态的持仓
 * 强制规则：UI的"我的持仓"100%只能来自Position表，不允许从Trade计算
 */
export async function GET() {
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

    // 2. 从Position表查询OPEN状态的持仓
    const positions = await prisma.position.findMany({
      where: {
        userId,
        status: 'OPEN', // ========== 强制规则：只返回OPEN状态的持仓 ==========
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            totalYes: true,
            totalNo: true,
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 3. 计算当前市场价格和价值
    const positionsWithValue = positions.map((position) => {
      const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
      const currentPrice = position.outcome === 'YES'
        ? (position.market.totalYes / totalVolume || 0.5)
        : (position.market.totalNo / totalVolume || 0.5);
      
      const currentValue = position.shares * currentPrice;
      const costBasis = position.shares * position.avgPrice;
      const profitLoss = currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      return {
        id: position.id,
        marketId: position.marketId,
        marketTitle: position.market.title,
        marketStatus: position.market.status,
        outcome: position.outcome,
        shares: position.shares,
        avgPrice: position.avgPrice,
        currentPrice,
        currentValue,
        costBasis,
        profitLoss,
        profitLossPercent,
        status: position.status, // ========== 强制规则：必须返回status字段 ==========
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: positionsWithValue,
    });
  } catch (error) {
    console.error('Get positions API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
