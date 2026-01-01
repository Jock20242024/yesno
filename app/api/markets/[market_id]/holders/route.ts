import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 获取市场持有者列表 API
 * GET /api/markets/[market_id]/holders
 * 
 * 返回该市场的所有持仓者（按持仓量排序）
 * 参照 Polymarket 的持有者列表逻辑
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    const { market_id } = await params;

    // 1. 验证市场是否存在
    const market = await prisma.markets.findUnique({
      where: { id: market_id },
      select: {
        id: true,
        title: true,
        status: true,
        resolvedOutcome: true,
      },
    });

    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 2. 获取所有持仓（按持仓量降序排序）
    const positions = await prisma.positions.findMany({
      where: {
        marketId: market_id,
        status: 'OPEN', // 只统计活跃持仓
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        shares: 'desc', // 按持仓量降序
      },
    });

    // 3. 计算每个持仓者的盈亏（如果市场已结算）
    const holders = positions.map((position, index) => {
      let profit = 0;
      
      // 如果市场已结算，计算盈亏
      if (market.status === 'RESOLVED' && market.resolvedOutcome) {
        const shares = Number(position.shares || 0);
        const avgPrice = Number(position.avgPrice || 0.5);
        
        if (position.outcome === market.resolvedOutcome) {
          // 如果持仓方向与结算结果一致，盈利 = 持仓量 * (1 - 平均价格)
          profit = shares * (1 - avgPrice);
        } else {
          // 如果持仓方向与结算结果不一致，亏损 = 持仓量 * 平均价格
          profit = -shares * avgPrice;
        }
      }

      return {
        rank: index + 1,
        userId: position.userId,
        username: position.users.email.split('@')[0], // 使用邮箱前缀作为用户名
        email: position.users.email,
        shares: Number(position.shares || 0),
        profit,
        outcome: position.outcome as 'YES' | 'NO',
        avgPrice: Number(position.avgPrice || 0.5),
      };
    });

    // 4. 统计信息
    const totalHolders = holders.length;
    const yesHolders = holders.filter(h => h.outcome === 'YES').length;
    const noHolders = holders.filter(h => h.outcome === 'NO').length;

    return NextResponse.json({
      success: true,
      data: {
        holders,
        stats: {
          totalHolders,
          yesHolders,
          noHolders,
          yesPercentage: totalHolders > 0 ? Math.round((yesHolders / totalHolders) * 100) : 0,
          noPercentage: totalHolders > 0 ? Math.round((noHolders / totalHolders) * 100) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Holders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
