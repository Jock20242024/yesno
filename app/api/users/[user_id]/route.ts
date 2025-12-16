import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DBService } from '@/lib/dbService';
import { extractUserIdFromToken } from '@/lib/authUtils'; // 强制数据隔离：使用统一的 userId 提取函数

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
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ user_id: string }> }
) {
  try {
    // 强制身份过滤：从 Auth Token 提取 current_user_id
    const authResult = await extractUserIdFromToken();
    
    if (!authResult.success || !authResult.userId) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Not authenticated',
        },
        { status: 401 }
      );
    }

    const currentUserId = authResult.userId;

    const { user_id } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'ALL';

    // 强制身份过滤：确保 current_user_id 必须与请求的 user_id 匹配
    // 防止用户访问其他用户的数据
    if (currentUserId !== user_id) {
      console.error('❌ [Users API] 安全漏洞：用户尝试访问其他用户的数据', {
        currentUserId,
        requestedUserId: user_id,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: You can only access your own data',
        },
        { status: 403 }
      );
    }

    // 查找用户（从数据库）
    // 硬编码检查：使用已验证的 currentUserId（已通过匹配检查）
    const user = await DBService.findUserById(currentUserId);
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // 获取用户的订单（从数据库，确保数据隔离）
    // 硬编码检查：使用已验证的 currentUserId（已通过匹配检查），确保数据隔离
    const orders = await DBService.findOrdersByUserId(currentUserId);
    
    // 从订单计算持仓（简化实现）
    const positions = orders.map((order) => ({
      marketId: order.marketId,
      outcome: order.outcomeSelection,
      shares: order.amount - (order.feeDeducted || 0), // 简化：使用净投资作为份额
      avgPrice: 0.5, // 简化：使用占位价格
      profitLoss: (order.payout || 0) - (order.amount - (order.feeDeducted || 0)),
    }));

    // 从订单生成交易历史（简化实现）
    const tradeHistory = orders.map((order) => ({
      id: order.id,
      timestamp: order.createdAt,
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

    // 计算总盈亏（从持仓计算）
    const totalProfitLoss = positions.reduce((sum, pos) => {
      return sum + (pos.profitLoss || 0);
    }, 0);

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

