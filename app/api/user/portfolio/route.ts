import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';
import { calculatePositionValue } from '@/lib/utils/valuation';

/**
 * 获取用户持仓组合 API
 * GET /api/user/portfolio
 * 
 * 🔥 核心修复：确保只返回已成交的持仓，绝对排除未成交订单
 * 
 * 强制规则：
 * - 持仓必须仅基于 Position 表（status='OPEN'）进行聚合计算
 * - 绝对排除 Order 表中的 PENDING 订单（未成交订单不算持仓）
 * - 只有真正成交的份额（Position表中有记录）才能算作持仓
 * 
 * ⚠️ 重要说明：
 * - 当前系统使用 Position 表来存储持仓（已成交的订单）
 * - Order 表用于记录所有订单（但当前 Order 模型没有 status 字段）
 * - 由于系统是立即成交模式（AMM），订单创建时立即创建 Position
 * - 因此，查询 Position 表（status='OPEN'）已经自动排除了所有未成交订单
 * 
 * 🔥 统一认证：使用 NextAuth 进行身份验证
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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

    // 🔥 核心修复：只从 Position 表查询 OPEN 状态的持仓
    // ⚠️ 重要：持仓基于 Position 表，不是 Order 表
    // - Position 表中的记录只有在订单成交后才会创建
    // - 查询 status='OPEN' 的 Position 已经自动排除了所有未成交（PENDING）订单
    // - 也自动排除了已关闭（CLOSED）的持仓
    // - 当前 Order 模型没有 status 字段，因此无法通过 Order.status 过滤
    // - 使用 Position 表是正确的做法，因为它代表了"实际持有的仓位"
    const positions = await prisma.position.findMany({
      where: {
        userId,
        status: 'OPEN', // 🔥 只返回持仓中的仓位，排除已关闭（CLOSED）的
        // 注意：PENDING 订单不会出现在这里，因为它们还没有创建 Position 记录
      },
      include: {
        market: {
          select: {
            id: true,
            title: true,
            totalYes: true,
            totalNo: true,
            status: true,
            closingDate: true,
            resolvedOutcome: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 计算每个持仓的当前价值、盈亏等信息
    // 🔥 重构：使用统一的 calculatePositionValue 工具函数
    const portfolioPositions = positions.map((position) => {
      const valuation = calculatePositionValue(
        {
          shares: position.shares,
          avgPrice: position.avgPrice,
          outcome: position.outcome,
        },
        {
          status: position.market.status,
          resolvedOutcome: position.market.resolvedOutcome,
          totalYes: position.market.totalYes || 0,
          totalNo: position.market.totalNo || 0,
        }
      );

      return {
        id: position.id,
        marketId: position.marketId,
        marketTitle: position.market.title,
        marketStatus: position.market.status,
        marketClosingDate: position.market.closingDate.toISOString(),
        resolvedOutcome: position.market.resolvedOutcome,
        outcome: position.outcome,
        shares: position.shares,
        avgPrice: position.avgPrice,
        currentPrice: valuation.currentPrice,
        currentValue: valuation.currentValue,
        costBasis: valuation.costBasis,
        profitLoss: valuation.profitLoss,
        profitLossPercent: valuation.profitLossPercent,
        status: position.status, // 应该是 'OPEN'
        createdAt: position.createdAt.toISOString(),
        updatedAt: position.updatedAt.toISOString(),
      };
    });

    // 计算总持仓价值、总盈亏等汇总数据
    const totalValue = portfolioPositions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const totalCost = portfolioPositions.reduce((sum, pos) => sum + pos.costBasis, 0);
    const totalProfitLoss = portfolioPositions.reduce((sum, pos) => sum + pos.profitLoss, 0);
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        positions: portfolioPositions,
        summary: {
          totalPositions: portfolioPositions.length,
          totalValue,
          totalCost,
          totalProfitLoss,
          totalProfitLossPercent,
        },
      },
    });
  } catch (error) {
    console.error('Get portfolio API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
