import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';
import { calculatePositionValue } from '@/lib/utils/valuation';

export const dynamic = 'force-dynamic';

/**
 * 获取用户持仓列表 API
 * GET /api/positions?type=active|history
 * 
 * 查询参数：
 * - type: 'active' (默认) 或 'history'
 *   - active: 返回活跃持仓 (Position status=OPEN 且 Market status != RESOLVED)
 *   - history: 返回已结束持仓 (Position status=CLOSED 或 Market status=RESOLVED)
 * 
 * 强制规则：UI的"我的持仓"100%只能来自Position表，不允许从Trade计算
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export async function GET(request: Request) {
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

    // 1. 解析查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'active'; // 默认为 'active'
    const marketId = searchParams.get('marketId'); // 可选：按市场ID过滤

    // 2. 根据 type 构建查询条件
    // 注意：对于 history 类型，我们需要查询所有 Position，然后在代码中进行过滤
    // 因为需要同时考虑 Position.status 和 Market.status
    let whereClause: any = { userId };

    // 🔥 新增：如果提供了 marketId，添加市场过滤条件
    if (marketId) {
      whereClause.marketId = marketId;
    }

    if (type === 'active') {
      // 活跃持仓：Position status = OPEN，且市场未结算
      whereClause.status = 'OPEN';
    } else if (type === 'history') {
      // 已结束持仓：查询所有 Position（包括 OPEN 和 CLOSED）
      // 稍后会在代码中过滤：Position status = CLOSED 或 Market status = RESOLVED
      // 不设置 status 过滤，查询所有状态，然后在代码中过滤
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid type parameter. Must be "active" or "history".' },
        { status: 400 }
      );
    }

    // 3. 从Position表查询持仓 - 添加连接检查和重试逻辑
    let positions: any[] = [];
    try {
      await prisma.$connect();
      positions = await prisma.positions.findMany({
        where: whereClause,
        include: {
          markets: {
            select: {
              id: true,
              title: true,
              totalYes: true,
              totalNo: true,
              status: true,
              resolvedOutcome: true, // 🔥 必须包含：用于计算已结算市场的价格
              closingDate: true, // 添加关闭日期，用于已结束列表的排序
            },
          },
        },
        orderBy: type === 'history' 
          ? { updatedAt: 'desc' } // 已结束的按更新时间倒序（最新的在前）
          : { updatedAt: 'desc' },
      });
    } catch (positionError: any) {
      console.error('❌ [Positions API] 查询持仓失败:', positionError);
      if (positionError.message?.includes('Engine is not yet connected') || 
          positionError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          positions = await prisma.positions.findMany({
            where: whereClause,
            include: {
              markets: {
                select: {
                  id: true,
                  title: true,
                  totalYes: true,
                  totalNo: true,
                  status: true,
                  resolvedOutcome: true,
                  closingDate: true,
                },
              },
            },
            orderBy: type === 'history' 
              ? { updatedAt: 'desc' }
              : { updatedAt: 'desc' },
          });
        } catch (retryError) {
          console.error('❌ [Positions API] 重试查询持仓失败:', retryError);
          positions = []; // 降级：返回空数组
        }
      } else {
        positions = []; // 降级：返回空数组
      }
    }

    // 4. 根据 type 进行二次过滤
    let filteredPositions = positions;
    
    if (type === 'active') {
      // 活跃持仓：只返回市场未结算的
      filteredPositions = positions.filter(
        (p) => p.markets.status !== 'RESOLVED' && p.markets.status !== 'CLOSED'
      );
    } else if (type === 'history') {
      // 已结束持仓：Position status = CLOSED 或 Market status = RESOLVED
      filteredPositions = positions.filter(
        (p) => p.status === 'CLOSED' || p.markets.status === 'RESOLVED'
      );
    }

    // 5. 计算当前市场价格和价值
    // 🔥 修复：从订单记录计算实际投入金额，而不是使用 shares * avgPrice
    // 获取所有已成交订单（用于计算实际投入金额）
    let filledOrders: any[] = [];
    try {
      await prisma.$connect();
      filledOrders = await prisma.orders.findMany({
        where: {
          userId,
          status: {
            in: ['FILLED'],
          },
        },
        select: {
          id: true,
          marketId: true,
          outcomeSelection: true,
          amount: true,
          feeDeducted: true,
        },
      });
    } catch (orderError: any) {
      console.error('❌ [Positions API] 查询订单失败:', orderError);
      if (orderError.message?.includes('Engine is not yet connected') || 
          orderError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          filledOrders = await prisma.orders.findMany({
            where: {
              userId,
              status: {
                in: ['FILLED'],
              },
            },
            select: {
              id: true,
              marketId: true,
              outcomeSelection: true,
              amount: true,
              feeDeducted: true,
            },
          });
        } catch (retryError) {
          console.error('❌ [Positions API] 重试查询订单失败:', retryError);
          filledOrders = []; // 降级：返回空数组
        }
      } else {
        filledOrders = []; // 降级：返回空数组
      }
    }

    // 🔥 重构：使用统一的 calculatePositionValue 工具函数
    const positionsWithValue = filteredPositions.map((position) => {
      // 🔥 修复：计算该持仓对应的实际投入金额（从订单记录）
      const positionOrders = filledOrders.filter(order => 
        order.marketId === position.marketId && 
        order.outcomeSelection === position.outcome
      );
      const actualInvestedAmount = positionOrders.reduce((sum, order) => {
        return sum + (Number(order.amount || 0) - Number(order.feeDeducted || 0));
      }, 0);
      
      // 使用实际投入金额作为成本基础，而不是 shares * avgPrice
      const valuation = calculatePositionValue(
        {
          shares: position.shares,
          avgPrice: position.avgPrice,
          outcome: position.outcome as 'YES' | 'NO',
        },
        {
          status: position.markets.status,
          resolvedOutcome: position.markets.resolvedOutcome,
          totalYes: position.markets.totalYes || 0,
          totalNo: position.markets.totalNo || 0,
        }
      );

      // 🔥 修复：使用实际投入金额作为 costBasis，如果无法从订单计算，则使用 shares * avgPrice 作为降级
      const costBasis = actualInvestedAmount > 0 ? actualInvestedAmount : valuation.costBasis;
      const profitLoss = valuation.currentValue - costBasis;
      const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

      // 🔥 核心修复：avgPrice必须等于净投入金额/获得的份额，而不是数据库存储的值
      // 这样可以确保无论数据库存了什么，API返回的逻辑永远是自洽的
      const correctAvgPrice = actualInvestedAmount > 0 && position.shares > 0
        ? actualInvestedAmount / position.shares
        : position.avgPrice; // 如果没有订单记录，使用数据库的值（降级方案）
      
      return {
        id: position.id,
        marketId: position.marketId,
        marketTitle: position.markets.title,
        marketStatus: position.markets.status,
        resolvedOutcome: position.markets.resolvedOutcome,
        outcome: position.outcome as 'YES' | 'NO',
        shares: position.shares,
        avgPrice: correctAvgPrice, // 🔥 修复：使用计算出的正确avgPrice
        currentPrice: valuation.currentPrice,
        currentValue: valuation.currentValue,
        costBasis: costBasis, // 🔥 修复：使用实际投入金额
        profitLoss: profitLoss, // 🔥 修复：基于实际投入金额计算盈亏
        profitLossPercent: profitLossPercent, // 🔥 修复：基于实际投入金额计算盈亏百分比
        status: position.status,
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
        // 🔥 新增：实际投入金额（用于调试和验证）
        actualInvestedAmount: actualInvestedAmount,
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
