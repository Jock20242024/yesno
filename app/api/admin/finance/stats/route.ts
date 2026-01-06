import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/authExport';

export const dynamic = 'force-dynamic';

/**
 * 做市收益统计 API
 * GET /api/admin/finance/stats
 * 
 * 返回：
 * - 今日点差收入（MARKET_PROFIT_LOSS 24小时汇总）
 * - 累计回收本金（LIQUIDITY_RECOVERY 汇总）
 * - 坏账统计（MARKET_PROFIT_LOSS 负数汇总）
 * - AMM 资金利用率
 * - 净值走势
 * - 近7天收益走势
 */
export async function GET(request: NextRequest) {
  try {
    // 权限验证：使用 NextAuth
    const session = await auth();
    if (!session || !session.user || !(session.user as any).isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 获取或创建系统账户
    const { randomUUID } = await import('crypto');
    
    let ammAccount = await prisma.users.findFirst({
      where: { email: 'system.amm@yesno.com' },
      select: { id: true, balance: true },
    });

    let liquidityAccount = await prisma.users.findFirst({
      where: { email: 'system.liquidity@yesno.com' },
      select: { id: true, balance: true },
    });

    // 如果账户不存在，自动创建
    if (!ammAccount) {
      ammAccount = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: 'system.amm@yesno.com',
          balance: 0,
          isAdmin: false,
          isBanned: false,
          provider: 'system',
          updatedAt: new Date(),
        },
        select: { id: true, balance: true },
      });
    }

    if (!liquidityAccount) {
      liquidityAccount = await prisma.users.create({
        data: {
          id: randomUUID(),
          email: 'system.liquidity@yesno.com',
          balance: 0,
          isAdmin: false,
          isBanned: false,
          provider: 'system',
          updatedAt: new Date(),
        },
        select: { id: true, balance: true },
      });
    }

    // 1. 今日点差收入（MARKET_PROFIT_LOSS 24小时汇总）
    const todaySpreadProfit = await prisma.transactions.aggregate({
      where: {
        userId: ammAccount.id,
        type: 'MARKET_PROFIT_LOSS',
        createdAt: { gte: today },
        amount: { gt: 0 }, // 只统计正数（盈利）
      },
      _sum: { amount: true },
    });

    // 2. 累计回收本金（LIQUIDITY_RECOVERY 汇总，流动性账户的收入）
    const totalRecovered = await prisma.transactions.aggregate({
      where: {
        userId: liquidityAccount.id,
        type: 'LIQUIDITY_RECOVERY',
        amount: { gt: 0 }, // 只统计正数（收入）
      },
      _sum: { amount: true },
    });

    // 3. 坏账统计（MARKET_PROFIT_LOSS 负数汇总，表示亏损）
    const badDebt = await prisma.transactions.aggregate({
      where: {
        userId: ammAccount.id,
        type: 'MARKET_PROFIT_LOSS',
        amount: { lt: 0 }, // 只统计负数（亏损）
      },
      _sum: { amount: true },
    });

    // 4. 计算累计总注入（LIQUIDITY_INJECTION 汇总，流动性账户的支出）
    const totalInjected = await prisma.transactions.aggregate({
      where: {
        userId: liquidityAccount.id,
        type: 'LIQUIDITY_INJECTION',
        amount: { lt: 0 }, // 只统计负数（支出）
      },
      _sum: { amount: true },
    });

    // 5. 计算未结算市场的初始注入（RESOLVED 状态市场的 initialLiquidity 总和）
    const unresolvedMarkets = await prisma.markets.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] }, // 未结算的市场
        initialLiquidity: { not: null },
      },
      select: {
        initialLiquidity: true,
      },
    });

    const unresolvedLiquidity = unresolvedMarkets.reduce(
      (sum, market) => sum + Number(market.initialLiquidity || 0),
      0
    );

    // 6. 计算净值走势：(AMM余额 + 流动性账户余额 + 未结算市场初始注入) - 累计总注入
    const ammBalance = Number(ammAccount.balance);
    const liquidityBalance = Number(liquidityAccount.balance);
    const totalInjectedAmount = Math.abs(Number(totalInjected._sum.amount || 0));
    const netEquity = (ammBalance + liquidityBalance + unresolvedLiquidity) - totalInjectedAmount;

    // 7. 计算AMM资金利用率（当日AMM总成交额 / AMM账户总余额）
    // 当日AMM总成交额 = 当日所有MARKET订单的成交金额
    const todayMarketOrders = await prisma.orders.aggregate({
      where: {
        orderType: 'MARKET',
        status: 'FILLED',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    const todayAmmVolume = Number(todayMarketOrders._sum.amount || 0);
    const capitalEfficiency = ammBalance > 0 ? (todayAmmVolume / ammBalance) : 0;

    // 8. 近7天收益走势（每日点差收入）
    const dailyProfits = await prisma.transactions.findMany({
      where: {
        userId: ammAccount.id,
        type: 'MARKET_PROFIT_LOSS',
        createdAt: { gte: sevenDaysAgo },
        amount: { gt: 0 }, // 只统计盈利
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 按日期分组汇总
    const dailyProfitMap = new Map<string, number>();
    dailyProfits.forEach((tx) => {
      const date = new Date(tx.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
      const current = dailyProfitMap.get(date) || 0;
      dailyProfitMap.set(date, current + Number(tx.amount));
    });

    // 生成近7天的完整日期序列
    const sevenDaysData: Array<{ date: string; profit: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      sevenDaysData.push({
        date: dateStr,
        profit: dailyProfitMap.get(dateStr) || 0,
      });
    }

    // 9. 计算当前所有RESOLVED状态市场的累计盈亏
    const resolvedMarkets = await prisma.markets.findMany({
      where: {
        status: 'RESOLVED',
      },
      select: {
        id: true,
        initialLiquidity: true,
      },
    });

    // 查询这些市场的回收记录
    const resolvedMarketIds = resolvedMarkets.map(m => m.id);
    const resolvedRecoveries = await prisma.transactions.findMany({
      where: {
        userId: liquidityAccount.id,
        type: 'LIQUIDITY_RECOVERY',
        reason: {
          contains: resolvedMarketIds.length > 0 ? resolvedMarketIds[0] : '', // 简化查询
        },
      },
      select: {
        amount: true,
        reason: true,
      },
    });

    // 计算累计盈亏：回收金额 - 初始注入
    let totalResolvedProfitLoss = 0;
    resolvedMarkets.forEach((market) => {
      const initialLiquidity = Number(market.initialLiquidity || 0);
      const recovery = resolvedRecoveries
        .filter(tx => tx.reason?.includes(market.id))
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      totalResolvedProfitLoss += (recovery - initialLiquidity);
    });

    return NextResponse.json({
      success: true,
      data: {
        // 核心指标
        todaySpreadProfit: Number(todaySpreadProfit._sum.amount || 0),
        totalRecovered: Number(totalRecovered._sum.amount || 0),
        badDebt: Math.abs(Number(badDebt._sum.amount || 0)), // 坏账取绝对值
        totalInjected: totalInjectedAmount,
        
        // 账户余额
        ammBalance,
        liquidityBalance,
        unresolvedLiquidity,
        
        // 计算指标
        netEquity, // 净值走势
        capitalEfficiency, // AMM资金利用率
        
        // 已结算市场累计盈亏
        totalResolvedProfitLoss,
        
        // 近7天收益走势
        sevenDaysTrend: sevenDaysData,
      },
    });
  } catch (error: any) {
    console.error('❌ [Finance Stats API] 统计失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

