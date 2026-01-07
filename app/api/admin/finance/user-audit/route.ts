import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAccess } from '@/lib/adminAuth';
import { auth } from '@/lib/authExport';

/**
 * 用户资金流向审计 API
 * GET /api/admin/finance/user-audit?userId=xxx
 * 
 * 用于追踪单个用户的完整资金流向，包括：
 * - 用户当前余额
 * - 所有交易记录（充值、提现、下注、结算）
 * - 所有持仓记录
 * - 持仓价值计算
 * - 总资产计算
 * - 资金流向验证
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 管理员权限验证
    const authResult = await verifyAdminAccess(request);
    if (!authResult.success || !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const userEmail = searchParams.get('email');

    if (!userId && !userEmail) {
      return NextResponse.json(
        { success: false, error: 'userId or email is required' },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await prisma.users.findUnique({
      where: userId ? { id: userId } : { email: userEmail! },
      select: {
        id: true,
        email: true,
        balance: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 1. 获取所有交易记录
    const transactions = await prisma.transactions.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        type: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    // 2. 计算交易总额
    const transactionSum = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // 3. 获取所有订单
    const orders = await prisma.orders.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        marketId: true,
        outcomeSelection: true,
        amount: true,
        feeDeducted: true,
        filledAmount: true,
        limitPrice: true,
        orderType: true,
        status: true,
        createdAt: true,
      },
    });

    // 4. 计算订单总投入
    const totalOrderAmount = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const totalFeeDeducted = orders.reduce((sum, order) => sum + Number(order.feeDeducted || 0), 0);
    const totalNetAmount = totalOrderAmount - totalFeeDeducted;

    // 5. 获取所有持仓
    const positions = await prisma.positions.findMany({
      where: {
        userId: user.id,
        status: 'OPEN',
      },
      include: {
        markets: {
          select: {
            id: true,
            title: true,
            totalYes: true,
            totalNo: true,
            status: true,
            resolvedOutcome: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 6. 计算持仓总投入和价值
    let totalPositionCost = 0; // 总投入成本
    let totalPositionValue = 0; // 当前持仓价值

    const positionDetails = positions.map((position) => {
      const cost = Number(position.shares) * Number(position.avgPrice);
      totalPositionCost += cost;

      // 计算当前价格
      let currentPrice = 0;
      if (position.markets.status === 'RESOLVED') {
        // 已结算市场
        if (position.markets.resolvedOutcome === position.outcome) {
          currentPrice = 1.0; // 获胜
        } else {
          currentPrice = 0.0; // 失败
        }
      } else {
        // 未结算市场
        const totalVolume = Number(position.markets.totalYes || 0) + Number(position.markets.totalNo || 0);
        if (totalVolume > 0) {
          if (position.outcome === 'YES') {
            currentPrice = Number(position.markets.totalYes || 0) / totalVolume;
          } else {
            currentPrice = Number(position.markets.totalNo || 0) / totalVolume;
          }
        }
      }

      const value = Number(position.shares) * currentPrice;
      totalPositionValue += value;

      return {
        id: position.id,
        marketId: position.marketId,
        marketTitle: position.markets.title,
        outcome: position.outcome,
        shares: Number(position.shares),
        avgPrice: Number(position.avgPrice),
        cost: cost,
        currentPrice: currentPrice,
        currentValue: value,
        pnl: value - cost,
        marketStatus: position.markets.status,
        resolvedOutcome: position.markets.resolvedOutcome,
      };
    });

    // 7. 获取充值和提现记录
    const deposits = await prisma.deposits.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    const withdrawals = await prisma.withdrawals.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
      },
    });

    const totalDeposits = deposits
      .filter(d => d.status === 'COMPLETED')
      .reduce((sum, d) => sum + Number(d.amount || 0), 0);
    
    const totalWithdrawals = withdrawals
      .filter(w => w.status === 'COMPLETED')
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    // 8. 计算理论余额
    // 理论余额 = 充值总额 - 提现总额 - 交易总额（负数表示扣除）
    const theoreticalBalance = totalDeposits - totalWithdrawals + transactionSum;

    // 9. 计算总资产
    const currentBalance = Number(user.balance || 0);
    const totalAssets = currentBalance + totalPositionValue;

    // 10. 验证资金流向
    const balanceDifference = Math.abs(currentBalance - theoreticalBalance);
    const isBalanceCorrect = balanceDifference <= 0.01;

    // 11. 资金流向分析
    const fundFlow = {
      deposits: totalDeposits,
      withdrawals: totalWithdrawals,
      netDeposits: totalDeposits - totalWithdrawals,
      transactionSum: transactionSum,
      theoreticalBalance: theoreticalBalance,
      actualBalance: currentBalance,
      balanceDifference: balanceDifference,
      isBalanceCorrect: isBalanceCorrect,
      totalOrderAmount: totalOrderAmount,
      totalFeeDeducted: totalFeeDeducted,
      totalNetAmount: totalNetAmount,
      totalPositionCost: totalPositionCost,
      totalPositionValue: totalPositionValue,
      totalAssets: totalAssets,
    };

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          balance: currentBalance,
          createdAt: user.createdAt,
        },
        fundFlow,
        transactions: transactions.map(tx => ({
          id: tx.id,
          amount: Number(tx.amount),
          type: tx.type,
          reason: tx.reason,
          status: tx.status,
          createdAt: tx.createdAt,
        })),
        orders: orders.map(order => ({
          id: order.id,
          marketId: order.marketId,
          outcomeSelection: order.outcomeSelection,
          amount: Number(order.amount || 0),
          feeDeducted: Number(order.feeDeducted || 0),
          netAmount: Number(order.amount || 0) - Number(order.feeDeducted || 0),
          filledAmount: Number(order.filledAmount || 0),
          limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
          orderType: order.orderType,
          status: order.status,
          createdAt: order.createdAt,
        })),
        positions: positionDetails,
        deposits: deposits.map(d => ({
          id: d.id,
          amount: Number(d.amount || 0),
          status: d.status,
          createdAt: d.createdAt,
        })),
        withdrawals: withdrawals.map(w => ({
          id: w.id,
          amount: Number(w.amount || 0),
          status: w.status,
          createdAt: w.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ [User Audit API] 审计失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to audit user' },
      { status: 500 }
    );
  }
}

