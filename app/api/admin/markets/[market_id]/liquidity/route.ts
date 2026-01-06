import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/utils';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * 市场流动性管理 API
 * POST /api/admin/markets/[market_id]/liquidity
 * 
 * Body:
 * - action: 'inject' | 'withdraw'
 * - amount: number
 * - reason?: string
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    // 权限检查
    const authResult = await requireAuth();
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.statusCode }
      );
    }

    // 检查是否为管理员
    const user = await prisma.users.findUnique({
      where: { id: authResult.userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const { market_id } = await params;
    const body = await request.json();
    const { action, amount, reason } = body;

    // 验证参数
    if (!action || !['inject', 'withdraw'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "inject" or "withdraw"' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount. Must be a positive number' },
        { status: 400 }
      );
    }

    // 使用事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 验证市场存在且状态为 OPEN
      const market = await tx.markets.findUnique({
        where: { id: market_id },
        select: {
          id: true,
          title: true,
          status: true,
          totalYes: true,
          totalNo: true,
        },
      });

      if (!market) {
        throw new Error('Market not found');
      }

      if (market.status !== 'OPEN') {
        throw new Error('只能为 OPEN 状态的市场注入/撤回流动性');
      }

      // 2. 获取流动性账户
      const liquidityAccount = await tx.users.findFirst({
        where: { email: 'system.liquidity@yesno.com' },
      });

      if (!liquidityAccount) {
        throw new Error('流动性账户不存在，请先创建系统账户');
      }

      if (action === 'inject') {
        // 3. 注入流动性：检查余额
        if (liquidityAccount.balance < amount) {
          throw new Error(`流动性账户余额不足：当前余额 $${liquidityAccount.balance.toFixed(2)}，需要 $${amount.toFixed(2)}`);
        }

        // 4. 按当前概率分配 YES/NO 份额
        const totalLiquidity = market.totalYes + market.totalNo;
        let yesProb = 0.5; // 默认 50/50

        if (totalLiquidity > 0) {
          yesProb = market.totalYes / totalLiquidity;
        }

        const newYes = market.totalYes + (amount * yesProb);
        const newNo = market.totalNo + (amount * (1 - yesProb));

        // 5. 从流动性账户扣减
        const updatedAccount = await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // 6. 更新市场流动性
        const updatedMarket = await tx.markets.update({
          where: { id: market_id },
          data: {
            totalYes: newYes,
            totalNo: newNo,
          },
        });

        // 7. 创建 Transaction 记录
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: -amount, // 负数表示支出
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性注入 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        return {
          market: updatedMarket,
          liquidityAccount: updatedAccount,
          injectedAmount: amount,
          yesAmount: amount * yesProb,
          noAmount: amount * (1 - yesProb),
        };
      } else {
        // 撤回流动性
        const totalLiquidity = market.totalYes + market.totalNo;

        if (totalLiquidity < amount) {
          throw new Error(`市场可用流动性不足：当前流动性 $${totalLiquidity.toFixed(2)}，需要撤回 $${amount.toFixed(2)}`);
        }

        // 按比例撤回
        const yesProb = market.totalYes / totalLiquidity;
        const withdrawYes = amount * yesProb;
        const withdrawNo = amount * (1 - yesProb);

        // 更新市场
        const updatedMarket = await tx.markets.update({
          where: { id: market_id },
          data: {
            totalYes: market.totalYes - withdrawYes,
            totalNo: market.totalNo - withdrawNo,
          },
        });

        // 退回流动性账户
        const updatedAccount = await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: {
              increment: amount,
            },
          },
        });

        // 创建 Transaction 记录
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: amount, // 正数表示收入
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性撤回 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        return {
          market: updatedMarket,
          liquidityAccount: updatedAccount,
          withdrawnAmount: amount,
          yesAmount: withdrawYes,
          noAmount: withdrawNo,
        };
      }
    });

    return NextResponse.json({
      success: true,
      message: action === 'inject' ? '流动性注入成功' : '流动性撤回成功',
      data: result,
    });
  } catch (error) {
    console.error('❌ [Market Liquidity API] 操作失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update market liquidity',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.stack }
          : {}),
      },
      { status: 500 }
    );
  }
}

