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

        // 🔥 漏洞1修复：获取或创建AMM账户
        let ammAccount = await tx.users.findFirst({
          where: { email: 'system.amm@yesno.com' },
        });

        if (!ammAccount) {
          // 如果AMM账户不存在，创建它
          ammAccount = await tx.users.create({
            data: {
              id: randomUUID(),
              updatedAt: new Date(),
              email: 'system.amm@yesno.com',
              balance: 0,
              isAdmin: false,
              isBanned: false,
            },
          });
        }

        // 4. 按当前概率分配 YES/NO 份额
        const totalLiquidity = market.totalYes + market.totalNo;
        let yesProb = 0.5; // 默认 50/50

        if (totalLiquidity > 0) {
          yesProb = market.totalYes / totalLiquidity;
        }

        // 🔥 漏洞2修复：使用余额法确保精度（Yes+No=总额）
        // 计算新增的Yes份额（保留2位小数）
        const injectedYes = Math.floor(amount * yesProb * 100) / 100;
        // No = 总额 - Yes（确保总额绝对等于注入金额）
        const injectedNo = amount - injectedYes;

        const newYes = market.totalYes + injectedYes;
        const newNo = market.totalNo + injectedNo;

        // 🔥 漏洞1修复：从流动性账户扣减
        const updatedLiquidityAccount = await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // 🔥 漏洞1修复：给AMM账户增加余额（资金从LP转移到AMM）
        const updatedAmmAccount = await tx.users.update({
          where: { id: ammAccount.id },
          data: {
            balance: {
              increment: amount, // AMM账户增加相同金额
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

        // 🔥 漏洞1修复：创建LP账户的Transaction记录（负数表示支出）
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: -amount, // 负数表示从LP账户扣减
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性注入 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        // 🔥 漏洞1修复：创建AMM账户的Transaction记录（正数表示收入）
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: amount, // 正数表示AMM账户收入
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性注入 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        return {
          market: updatedMarket,
          liquidityAccount: updatedLiquidityAccount,
          ammAccount: updatedAmmAccount,
          injectedAmount: amount,
          yesAmount: injectedYes,
          noAmount: injectedNo,
        };
      } else {
        // 撤回流动性
        const totalLiquidity = market.totalYes + market.totalNo;

        if (totalLiquidity < amount) {
          throw new Error(`市场可用流动性不足：当前流动性 $${totalLiquidity.toFixed(2)}，需要撤回 $${amount.toFixed(2)}`);
        }

        // 🔥 漏洞3修复：比例限制 - 撤回金额不得超过总流动性的80%，必须预留部分资金维持交易
        const MAX_WITHDRAW_RATIO = 0.8; // 最多撤回80%
        const maxWithdrawAmount = totalLiquidity * MAX_WITHDRAW_RATIO;

        if (amount > maxWithdrawAmount) {
          throw new Error(`撤回金额过大：最多只能撤回总流动性的80%（$${maxWithdrawAmount.toFixed(2)}），当前请求 $${amount.toFixed(2)}。必须预留至少20%的流动性维持市场交易。`);
        }

        // 🔥 漏洞3修复：净值逻辑 - 检查当前市场的用户交易量，确保撤回的是"属于系统的钱"
        // 如果市场已有用户交易（totalVolume > 0），需要确保撤回后市场仍有足够的流动性
        const marketWithVolume = await tx.markets.findUnique({
          where: { id: market_id },
          select: { totalVolume: true },
        });

        if (marketWithVolume && marketWithVolume.totalVolume > 0) {
          // 如果市场已有交易，撤回后剩余流动性必须 >= 用户总交易量的50%（安全边际）
          const remainingLiquidity = totalLiquidity - amount;
          const minRequiredLiquidity = marketWithVolume.totalVolume * 0.5;

          if (remainingLiquidity < minRequiredLiquidity) {
            throw new Error(`撤回后流动性不足：撤回 $${amount.toFixed(2)} 后，剩余流动性 $${remainingLiquidity.toFixed(2)} 低于最低要求 $${minRequiredLiquidity.toFixed(2)}（用户总交易量的50%）。无法撤回，请减少撤回金额。`);
          }
        }

        // 🔥 漏洞1修复：获取AMM账户
        const ammAccount = await tx.users.findFirst({
          where: { email: 'system.amm@yesno.com' },
        });

        if (!ammAccount) {
          throw new Error('AMM账户不存在，无法撤回流动性');
        }

        // 检查AMM账户余额是否足够
        if (ammAccount.balance < amount) {
          throw new Error(`AMM账户余额不足：当前余额 $${ammAccount.balance.toFixed(2)}，需要撤回 $${amount.toFixed(2)}。可能存在账目不平，请检查。`);
        }

        // 🔥 漏洞2修复：使用余额法确保精度
        // 按比例计算撤回的Yes份额（保留2位小数）
        const yesProb = market.totalYes / totalLiquidity;
        const withdrawYes = Math.floor(amount * yesProb * 100) / 100;
        // No = 总额 - Yes（确保总额绝对等于撤回金额）
        const withdrawNo = amount - withdrawYes;

        // 更新市场
        const updatedMarket = await tx.markets.update({
          where: { id: market_id },
          data: {
            totalYes: market.totalYes - withdrawYes,
            totalNo: market.totalNo - withdrawNo,
          },
        });

        // 🔥 漏洞1修复：从AMM账户扣减余额
        const updatedAmmAccount = await tx.users.update({
          where: { id: ammAccount.id },
          data: {
            balance: {
              decrement: amount, // 从AMM账户扣减
            },
          },
        });

        // 🔥 漏洞1修复：退回流动性账户
        const updatedLiquidityAccount = await tx.users.update({
          where: { id: liquidityAccount.id },
          data: {
            balance: {
              increment: amount, // 退回LP账户
            },
          },
        });

        // 🔥 漏洞1修复：创建AMM账户的Transaction记录（负数表示支出）
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: ammAccount.id,
            amount: -amount, // 负数表示从AMM账户扣减
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性撤回 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        // 🔥 漏洞1修复：创建LP账户的Transaction记录（正数表示收入）
        await tx.transactions.create({
          data: {
            id: randomUUID(),
            userId: liquidityAccount.id,
            amount: amount, // 正数表示LP账户收入
            type: 'ADMIN_ADJUSTMENT',
            reason: reason || `市场流动性撤回 - 市场: ${market.title} (${market_id})`,
            status: 'COMPLETED',
          },
        });

        return {
          market: updatedMarket,
          liquidityAccount: updatedLiquidityAccount,
          ammAccount: updatedAmmAccount,
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


