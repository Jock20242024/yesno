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
    // 🔥 修复：区分已成交和未成交订单
    // 订单总额 = 所有订单的金额（包括未成交的LIMIT订单）
    const totalOrderAmount = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const totalFeeDeducted = orders.reduce((sum, order) => sum + Number(order.feeDeducted || 0), 0);
    const totalNetAmount = totalOrderAmount - totalFeeDeducted;
    
    // 🔥 新增：计算已成交订单的金额（只有MARKET订单和已成交的LIMIT订单）
    const filledOrders = orders.filter(order => 
      order.status === 'FILLED' || 
      (order.orderType === 'MARKET' && order.status !== 'CANCELLED')
    );
    const totalFilledOrderAmount = filledOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const totalFilledFeeDeducted = filledOrders.reduce((sum, order) => sum + Number(order.feeDeducted || 0), 0);
    const totalFilledNetAmount = totalFilledOrderAmount - totalFilledFeeDeducted;
    
    // 🔥 新增：计算未成交订单的金额（PENDING状态的LIMIT订单）
    const pendingOrders = orders.filter(order => order.status === 'PENDING');
    const totalPendingOrderAmount = pendingOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
    const totalPendingFeeDeducted = pendingOrders.reduce((sum, order) => sum + Number(order.feeDeducted || 0), 0);
    const totalPendingNetAmount = totalPendingOrderAmount - totalPendingFeeDeducted;

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
      // 🔥 修复：持仓总投入应该基于实际投入金额，而不是 shares * avgPrice
      // avgPrice 是加权平均价格，用于计算盈亏，但不代表实际投入成本
      // 实际投入成本 = 所有已成交订单的净投资额（amount - feeDeducted）
      
      // 🔥 新增：计算该持仓对应的实际投入金额（从订单记录）
      // 查找该市场、该方向的已成交订单
      const positionOrders = filledOrders.filter(order => 
        order.marketId === position.marketId && 
        order.outcomeSelection === position.outcome
      );
      const actualInvestedAmount = positionOrders.reduce((sum, order) => {
        return sum + (Number(order.amount || 0) - Number(order.feeDeducted || 0));
      }, 0);
      
      // 🔥 保留 shares * avgPrice 作为对比值（用于验证）
      const costByAvgPrice = Number(position.shares) * Number(position.avgPrice);
      
      // 🔥 使用实际投入金额作为总投入成本
      totalPositionCost += actualInvestedAmount;

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
        cost: actualInvestedAmount, // 🔥 修复：使用实际投入金额
        costByAvgPrice: costByAvgPrice, // 保留 shares * avgPrice 用于对比
        currentPrice: currentPrice,
        currentValue: value,
        pnl: value - actualInvestedAmount, // 🔥 修复：盈亏基于实际投入金额
        marketStatus: position.markets.status,
        resolvedOutcome: position.markets.resolvedOutcome,
        // 🔥 新增：实际投入金额（从订单记录计算）
        actualInvestedAmount: actualInvestedAmount,
        costVsInvestedDifference: Math.abs(costByAvgPrice - actualInvestedAmount),
        isCostCorrect: Math.abs(costByAvgPrice - actualInvestedAmount) <= 0.01,
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
      // 🔥 新增：已成交订单统计
      totalFilledOrderAmount: totalFilledOrderAmount,
      totalFilledFeeDeducted: totalFilledFeeDeducted,
      totalFilledNetAmount: totalFilledNetAmount,
      // 🔥 新增：未成交订单统计
      totalPendingOrderAmount: totalPendingOrderAmount,
      totalPendingFeeDeducted: totalPendingFeeDeducted,
      totalPendingNetAmount: totalPendingNetAmount,
      totalPositionCost: totalPositionCost,
      totalPositionValue: totalPositionValue,
      totalAssets: totalAssets,
      // 🔥 新增：验证逻辑
      positionCostVsFilledNetAmount: {
        filledNetAmount: totalFilledNetAmount,
        positionCost: totalPositionCost,
        difference: totalFilledNetAmount - totalPositionCost,
        isConsistent: Math.abs(totalFilledNetAmount - totalPositionCost) <= 0.01,
      },
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

