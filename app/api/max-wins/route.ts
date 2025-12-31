import { NextResponse } from 'next/server';
import { DBService } from '@/lib/dbService';
import { prisma } from '@/lib/prisma';
import { calculatePositionValue } from '@/lib/utils/valuation';

/**
 * 本月最大胜利排行榜 API
 * GET /api/max-wins
 * 
 * 返回本月最大胜利排行榜（Top 7）
 */
export async function GET() {
  try {
    // 计算本月初的时间
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 获取所有用户（排除系统账户）
    const allUsers = await DBService.getAllUsers();
    const systemAccountEmails = ['system.amm@yesno.com', 'system.fee@yesno.com'];
    const regularUsers = allUsers.filter(
      (user) => !systemAccountEmails.includes(user.email)
    );

    // 为每个用户计算本月最大胜利
    const usersWithMaxWins = await Promise.all(
      regularUsers.map(async (user) => {
        // 获取用户本月以来的所有持仓
        const positions = await prisma.position.findMany({
          where: {
            userId: user.id,
            status: 'OPEN',
            createdAt: { gte: monthStart },
          },
          include: {
            market: {
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
                status: position.market?.status || 'OPEN',
                resolvedOutcome: position.market?.resolvedOutcome || null,
                totalYes: position.market?.totalYes || 0,
                totalNo: position.market?.totalNo || 0,
              }
            );

            const profitLoss = valuation.profitLoss || 0;
            if (profitLoss > biggestWin) {
              biggestWin = profitLoss;
            }
          } catch (error) {
            console.error(`Error calculating position value for user ${user.id}:`, error);
          }
        }

        return {
          id: user.id,
          name: user.email.split('@')[0],
          profit: biggestWin,
        };
      })
    );

    // 过滤掉没有盈利的用户，按 profit 降序排序，取前 7 名
    const topWinners = usersWithMaxWins
      .filter((user) => user.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 7)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }));

    return NextResponse.json({
      success: true,
      data: topWinners,
    });
  } catch (error) {
    console.error('Max wins API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

