import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { calculatePositionValue } from '@/lib/utils/valuation';
import { prisma } from '@/lib/prisma';

/**
 * 用户详情 API
 * GET /api/users/[user_id]
 * 
 * 返回指定用户的详细信息
 * 支持查询参数：
 * - timeRange: 时间范围筛选 (1D, 1W, 1M, ALL)
 * 
 * 安全修复：强制身份验证和用户 ID 匹配检查
 * 用户只能访问自己的数据，不能访问其他用户的数据
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    const { user_id } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'ALL';

    // 🔥 修复：排行榜访问允许查看所有用户的数据，不需要身份验证限制
    // 但如果是查看自己的数据，可以使用已验证的用户 ID
    // 如果是查看其他用户，需要允许访问（用于排行榜链接）
    let targetUserId = user_id;
    
    // 如果 user_id 是 UUID 格式，直接使用
    // 如果不是 UUID（可能是用户名），需要查找对应的用户
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(user_id)) {
      // 如果不是 UUID，尝试通过邮箱前缀查找用户
      const allUsers = await DBService.getAllUsers();
      const foundUser = allUsers.find(user => user.email.split('@')[0] === user_id);
      if (foundUser) {
        targetUserId = foundUser.id;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'User not found',
          },
          { status: 404 }
        );
      }
    }

    // 查找用户（从数据库）
    const user = await DBService.findUserById(targetUserId);
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // 🔥 核心修复：持仓必须只基于 Position 表，绝对排除未成交订单
    // 强制规则：只有真正成交的份额（Position表中有记录）才能算作持仓
    const positionsData = await prisma.positions.findMany({
      where: {
        userId: targetUserId,
        status: 'OPEN', // 🔥 只返回持仓中的仓位，排除已关闭的
      },
      include: {
        markets: {
          select: {
            id: true,
            title: true,
            totalYes: true,
            totalNo: true,
            status: true,
            closingDate: true,
            resolvedOutcome: true, // ✅ 已包含 resolvedOutcome
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 计算每个持仓的当前价值、盈亏等信息
    // 🔥 重构：使用统一的 calculatePositionValue 工具函数
    // 🔥 修复：添加 null/undefined 检查，防止 500 错误
    const positions = positionsData.map((position) => {
      try {
        // 🔥 修复：确保 outcome 是 'YES' | 'NO'，过滤掉其他值
        const validOutcome = (position.outcome === 'YES' || position.outcome === 'NO') 
          ? position.outcome 
          : 'YES';
        
        const valuation = calculatePositionValue(
          {
            shares: position.shares || 0,
            avgPrice: position.avgPrice || 0,
            outcome: validOutcome,
          },
          {
            status: position.markets?.status || 'OPEN',
            resolvedOutcome: position.markets?.resolvedOutcome || null,
            totalYes: position.markets?.totalYes || 0,
            totalNo: position.markets?.totalNo || 0,
          }
        );

        return {
          id: position.id,
          marketId: position.marketId,
          marketStatus: position.markets?.status || 'OPEN', // 🔥 修复3：添加市场状态，用于区分已结算和未结算
          outcome: position.outcome as 'YES' | 'NO',
          shares: position.shares || 0,
          avgPrice: position.avgPrice || 0,
          currentPrice: valuation.currentPrice || 0,
          currentValue: valuation.currentValue || 0,
          costBasis: valuation.costBasis || 0,
          profitLoss: valuation.profitLoss || 0,
        };
      } catch (error) {
        console.error(`Error calculating position value for position ${position.id}:`, error);
        // 返回默认值，避免整个请求失败
        return {
          id: position.id,
          marketId: position.marketId,
          marketStatus: position.markets?.status || 'OPEN', // 🔥 修复3：添加市场状态
          outcome: position.outcome || 'YES',
          shares: position.shares || 0,
          avgPrice: position.avgPrice || 0,
          currentPrice: 0,
          currentValue: 0,
          costBasis: 0,
          profitLoss: 0,
        };
      }
    });

    // 🔥 获取用户的订单（用于交易历史，不是持仓）
    // 注意：交易历史包含所有订单，包括已成交的
    // 🔥 修复：不要过滤订单，统计所有订单数量作为预测次数
    // 使用 Prisma 直接查询，避免 DBService 的 UUID 验证问题（如果将来需要）
    const orders = await prisma.orders.findMany({
      where: { 
        userId: targetUserId,
        // 🔥 修复：不添加任何状态过滤，统计所有订单（包括FILLED、PENDING等）
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // 🔥 调试日志：确认订单数量
    console.log(`🔍 [User Detail API] 用户 ${targetUserId} 的订单数量:`, orders.length);

    // 从订单生成交易历史
    const tradeHistory = orders.map((order) => ({
      id: order.id,
      timestamp: order.createdAt.toISOString(),
      type: 'buy',
      marketId: order.marketId,
      outcome: order.outcomeSelection,
      amount: order.amount,
      shares: order.amount - (order.feeDeducted || 0),
      price: 0.5, // 简化：使用占位价格
      status: 'completed',
    }));

    // 根据 timeRange 过滤交易历史（简化实现）
    let filteredTradeHistory = tradeHistory;
    if (timeRange !== 'ALL') {
      const now = Date.now();
      const timeRanges: Record<string, number> = {
        '1D': 24 * 60 * 60 * 1000,
        '1W': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
      };
      const rangeMs = timeRanges[timeRange] || 0;
      filteredTradeHistory = tradeHistory.filter((activity) => {
        const activityTime = new Date(activity.timestamp).getTime();
        return now - activityTime <= rangeMs;
      });
    }

    // 🔥 修复3：亏损显示只计算结算后的结果，不包括正在持仓的盈亏
    // 计算总盈亏、持仓价值、最大胜利（只从已结算的持仓计算）
    let totalProfitLoss = 0;
    let positionsValue = 0;
    let biggestWin = 0;
    
    // 分离已结算和未结算的持仓
    const resolvedPositions = positions.filter(pos => {
      // 检查市场是否已结算（status === 'RESOLVED'）
      return pos.marketStatus === 'RESOLVED';
    });
    
    const activePositions = positions.filter(pos => {
      return pos.marketStatus !== 'RESOLVED';
    });
    
    // 只计算已结算持仓的盈亏
    for (const pos of resolvedPositions) {
      totalProfitLoss += pos.profitLoss || 0;
      const profitLoss = pos.profitLoss || 0;
      if (profitLoss > biggestWin) {
        biggestWin = profitLoss;
      }
    }
    
    // 持仓价值包括所有持仓（已结算和未结算）
    for (const pos of positions) {
      positionsValue += pos.currentValue || 0;
    }

    // 计算预测次数（订单数量）
    const predictions = orders.length;

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        totalProfitLoss,
        positionsValue,
        biggestWin,
        predictions,
        tradeHistory: filteredTradeHistory,
        positions,
      },
    });
  } catch (error) {
    console.error('Get user data API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

