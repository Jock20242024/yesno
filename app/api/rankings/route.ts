import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { prisma } from '@/lib/prisma';
import { calculatePositionValue } from '@/lib/utils/valuation';

/**
 * 排行榜 API
 * GET /api/rankings
 * 
 * 返回用户排行榜数据（真实业务数据）
 * 支持查询参数：
 * - timeRange: 时间范围 (today, weekly, monthly, all)
 * - search: 搜索用户名
 * - page: 页码
 * - pageSize: 每页数量
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'all';
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 获取所有用户（排除系统账户）
    const allUsers = await DBService.getAllUsers();
    const systemAccountEmails = ['system.amm@yesno.com', 'system.fee@yesno.com'];
    const regularUsers = allUsers.filter(
      (user) => !systemAccountEmails.includes(user.email)
    );

    // 🔥 计算时间范围过滤条件
    const now = new Date();
    let timeFilter: Date | null = null;
    if (timeRange === 'today') {
      timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (timeRange === 'weekly') {
      timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === 'monthly') {
      timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // 🔥 为每个用户计算真实的排行榜数据
    const usersWithStats = await Promise.all(
      regularUsers.map(async (user) => {
        // 1. 获取用户的所有持仓（用于计算盈亏和持仓价值）
        const positions = await prisma.positions.findMany({
          where: {
            userId: user.id,
            status: 'OPEN',
          },
          include: {
            markets: {
              select: {
                id: true,
                status: true,
                resolvedOutcome: true,
                totalYes: true,
                totalNo: true,
              },
            },
          },
        });

        // 2. 获取用户的所有订单（用于计算交易量和预测次数）
        const ordersWhere: any = { userId: user.id };
        if (timeFilter) {
          ordersWhere.createdAt = { gte: timeFilter };
        }
        const orders = await prisma.orders.findMany({
          where: ordersWhere,
        });

        // 3. 计算持仓价值、总盈亏
        let positionsValue = 0;
        let totalProfitLoss = 0;
        let biggestWin = 0;
        
        for (const position of positions) {
          try {
            const valuation = calculatePositionValue(
              {
                shares: position.shares || 0,
                avgPrice: position.avgPrice || 0,
                outcome: (position.outcome === 'YES' || position.outcome === 'NO') 
                  ? position.outcome 
                  : 'YES',
              },
              {
                status: position.markets?.status || 'OPEN',
                resolvedOutcome: position.markets?.resolvedOutcome || null,
                totalYes: position.markets?.totalYes || 0,
                totalNo: position.markets?.totalNo || 0,
              }
            );

            positionsValue += valuation.currentValue || 0;
            const profitLoss = valuation.profitLoss || 0;
            totalProfitLoss += profitLoss;
            
            // 追踪单笔最大盈利
            if (profitLoss > biggestWin) {
              biggestWin = profitLoss;
            }
          } catch (error) {
            console.error(`Error calculating position value for user ${user.id}:`, error);
          }
        }

        // 4. 计算交易量（所有订单的金额总和）
        const volumeTraded = orders.reduce((sum, order) => sum + (order.amount || 0), 0);

        // 5. 计算预测次数（订单数量）
        const predictions = orders.length;

        return {
          id: user.id,
          username: user.email.split('@')[0],
          avatarUrl: undefined,
          rank: 0, // 稍后会根据 profitLoss 排序并赋值
          profitLoss: totalProfitLoss,
          volumeTraded,
          positionsValue,
          biggestWin,
          predictions,
          joinDate: new Date(user.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }),
          createdAt: user.createdAt,
          updatedAt: user.createdAt,
        };
      })
    );

    // 6. 按 profitLoss 排序并分配排名
    usersWithStats.sort((a, b) => b.profitLoss - a.profitLoss);
    let filteredUsers = usersWithStats.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

    // 搜索过滤
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (user) => user.username.toLowerCase().includes(searchLower)
      );
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        total: filteredUsers.length,
        page,
        pageSize,
        totalPages: Math.ceil(filteredUsers.length / pageSize),
      },
    });
  } catch (error) {
    console.error('Rankings API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

