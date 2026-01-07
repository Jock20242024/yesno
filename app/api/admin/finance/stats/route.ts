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
    // 🔥 统一权限验证：使用统一的管理员权限验证函数
    const { verifyAdminAccess, createUnauthorizedResponse } = await import('@/lib/adminAuth');
    const authResult = await verifyAdminAccess(request);
    
    if (!authResult.success || !authResult.isAdmin) {
      console.error('❌ [Finance Stats API] 权限验证失败:', {
        success: authResult.success,
        isAdmin: authResult.isAdmin,
        userEmail: authResult.userEmail,
        error: authResult.error,
      });
      return createUnauthorizedResponse(
        authResult.error || 'Unauthorized. Admin access required.',
        authResult.statusCode || 401
      );
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
    // 🔥 临时修复：如果枚举值不存在，返回0而不是报错
    let todaySpreadProfit: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    try {
      todaySpreadProfit = await prisma.transactions.aggregate({
        where: {
          userId: ammAccount.id,
          type: 'MARKET_PROFIT_LOSS' as any, // 🔥 临时类型断言：数据库迁移后移除
          createdAt: { gte: today },
          amount: { gt: 0 }, // 只统计正数（盈利）
        },
        _sum: { amount: true },
      }) as { _sum: { amount: number | null } };
    } catch (error: any) {
      // 如果枚举值不存在，记录错误但继续执行
      if (error.message?.includes('MARKET_PROFIT_LOSS') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        todaySpreadProfit = { _sum: { amount: null } };
      } else {
        throw error; // 其他错误继续抛出
      }
    }

    // 2. 累计回收本金（LIQUIDITY_RECOVERY 汇总，流动性账户的收入）
    let totalRecovered: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    try {
      totalRecovered = await prisma.transactions.aggregate({
        where: {
          userId: liquidityAccount.id,
          type: 'LIQUIDITY_RECOVERY' as any, // 🔥 临时类型断言：数据库迁移后移除
          amount: { gt: 0 }, // 只统计正数（收入）
        },
        _sum: { amount: true },
      }) as { _sum: { amount: number | null } };
    } catch (error: any) {
      if (error.message?.includes('LIQUIDITY_RECOVERY') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        totalRecovered = { _sum: { amount: null } };
      } else {
        throw error;
      }
    }

    // 3. 坏账统计（MARKET_PROFIT_LOSS 负数汇总，表示亏损）
    let badDebt: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    try {
      badDebt = await prisma.transactions.aggregate({
        where: {
          userId: ammAccount.id,
          type: 'MARKET_PROFIT_LOSS' as any, // 🔥 临时类型断言：数据库迁移后移除
          amount: { lt: 0 }, // 只统计负数（亏损）
        },
        _sum: { amount: true },
      }) as { _sum: { amount: number | null } };
    } catch (error: any) {
      if (error.message?.includes('MARKET_PROFIT_LOSS') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        badDebt = { _sum: { amount: null } };
      } else {
        throw error;
      }
    }

    // 4. 计算累计总注入（LIQUIDITY_INJECTION 汇总，流动性账户的支出）
    let totalInjected: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    try {
      totalInjected = await prisma.transactions.aggregate({
        where: {
          userId: liquidityAccount.id,
          type: 'LIQUIDITY_INJECTION' as any, // 🔥 临时类型断言：数据库迁移后移除
          amount: { lt: 0 }, // 只统计负数（支出）
        },
        _sum: { amount: true },
      }) as { _sum: { amount: number | null } };
    } catch (error: any) {
      if (error.message?.includes('LIQUIDITY_INJECTION') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        totalInjected = { _sum: { amount: null } };
      } else {
        throw error;
      }
    }

    // 5. 计算未结算市场的初始注入（RESOLVED 状态市场的 initialLiquidity 总和）
    const unresolvedMarkets = await prisma.markets.findMany({
      where: {
        status: { in: ['OPEN', 'CLOSED'] }, // 未结算的市场
      },
      select: {
        id: true,
      },
    });

    // 🔥 临时修复：使用 raw query 获取 initialLiquidity（如果字段存在）
    let unresolvedLiquidity = 0;
    try {
      const marketsWithLiquidity = await prisma.$queryRaw<Array<{ initialLiquidity: number | null }>>`
        SELECT "initialLiquidity" FROM "markets" 
        WHERE "status" IN ('OPEN', 'CLOSED') 
        AND "initialLiquidity" IS NOT NULL
      `;
      unresolvedLiquidity = marketsWithLiquidity.reduce(
        (sum, market) => sum + Number(market.initialLiquidity || 0),
        0
      );
    } catch (error: any) {
      // 如果字段不存在，返回0
      console.warn('⚠️ [Finance Stats API] initialLiquidity字段不存在，跳过未结算流动性计算');
      unresolvedLiquidity = 0;
    }

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
    let dailyProfits: Array<{ amount: number; createdAt: Date }> = [];
    try {
      dailyProfits = await prisma.transactions.findMany({
        where: {
          userId: ammAccount.id,
          type: 'MARKET_PROFIT_LOSS' as any, // 🔥 临时类型断言：数据库迁移后移除
          createdAt: { gte: sevenDaysAgo },
          amount: { gt: 0 }, // 只统计盈利
        },
        select: {
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error: any) {
      if (error.message?.includes('MARKET_PROFIT_LOSS') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        dailyProfits = [];
      } else {
        throw error;
      }
    }

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
      },
    });
    
    // 🔥 临时修复：使用 raw query 获取 initialLiquidity
    const resolvedMarketsWithLiquidity = await prisma.$queryRaw<Array<{ id: string; initialLiquidity: number | null }>>`
      SELECT id, "initialLiquidity" FROM "markets" WHERE "status" = 'RESOLVED'
    `.catch(() => {
      // 如果字段不存在，返回空数组
      return resolvedMarkets.map(m => ({ id: m.id, initialLiquidity: null }));
    });

    // 查询这些市场的回收记录
    const resolvedMarketIds = resolvedMarketsWithLiquidity.map(m => m.id);
    let resolvedRecoveries: Array<{ amount: number; reason: string | null }> = [];
    try {
      resolvedRecoveries = await prisma.transactions.findMany({
        where: {
          userId: liquidityAccount.id,
          type: 'LIQUIDITY_RECOVERY' as any, // 🔥 临时类型断言：数据库迁移后移除
          reason: {
            contains: resolvedMarketIds.length > 0 ? resolvedMarketIds[0] : '', // 简化查询
          },
        },
        select: {
          amount: true,
          reason: true,
        },
      });
    } catch (error: any) {
      if (error.message?.includes('LIQUIDITY_RECOVERY') || error.message?.includes('enum')) {
        console.warn('⚠️ [Finance Stats API] TransactionType枚举值不存在，请运行数据库迁移');
        resolvedRecoveries = [];
      } else {
        throw error;
      }
    }

    // 计算累计盈亏：回收金额 - 初始注入
    let totalResolvedProfitLoss = 0;
    resolvedMarketsWithLiquidity.forEach((market) => {
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

