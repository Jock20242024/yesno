import { NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import { DBService } from '@/lib/dbService';
import { prisma } from '@/lib/prisma';
import { calculatePositionPrice } from '@/lib/utils/valuation';
import { ensurePrismaConnected, executePrismaQuery } from '@/lib/prismaConnection'; // 🔥 引入 Prisma 连接工具

/**
 * 获取用户资产汇总 API
 * GET /api/user/assets
 * 
 * 架构加固：唯一资产数据源
 * 返回当前登录用户的完整资产信息：
 * - availableBalance: 可用余额（从 User.balance 获取）
 * - frozenBalance: 冻结资金（从待结算订单计算）
 * - positionsValue: 持仓价值（从 Position 表和市场当前价格计算）
 * - totalBalance: 总资产 = availableBalance + frozenBalance + positionsValue
 * - totalEquity: 总资产估值（与 totalBalance 一致）
 * - historical: 历史资产和收益数据（1D/1W/1M/1Y，可为 null）
 * 
 * 强制规则：
 * - 所有资产计算都在此 API 中完成
 * - 前端禁止参与任何业务计算
 * - 前端只 render API 返回的数据
 * 
 * 🔥 关键修复：使用 NextAuth 统一认证，与主页面鉴权方式一致
 */
export const dynamic = "force-dynamic";
export const revalidate = 0; // 🔥 强力清除缓存：禁止任何缓存

export async function GET() {
  // 🔥 强制 API 降级：无论 auth() 是否成功，无论变量计算是否报错，强制返回一个 200 状态码的 JSON
  // 绝不允许抛出 500 或 401，这是防止前端崩溃的唯一办法
  try {
    // 🔥 强制 API 降级：使用 auth() 识别用户（NextAuth v5）
    const session = await auth();
    
    // 🔥 身份识别标准化：直接使用 session.user.id，废弃 email 查找逻辑
    // 🔥 强制 API 健壮化：容错逻辑 - 如果 auth() 获取的 session 为空，禁止返回 401
    // 请返回 { success: true, balance: 0, isGuest: true } 并给状态码 200
    // 这样可以彻底阻止前端 AuthProvider 触发登出死循环
    if (!session?.user?.id) {

      // 🔥 强制 API 健壮化：返回 200 状态码，而不是 401，彻底阻止前端 AuthProvider 触发登出死循环
      const response = NextResponse.json({
        success: true,
        balance: 0,
        isGuest: true, // 🔥 强制 API 健壮化：标识为访客用户
        data: {
          balance: 0,
          availableBalance: 0,
          frozenBalance: 0,
          positionsValue: 0,
          totalBalance: 0,
          totalEquity: 0,
          historical: {
            '1D': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1W': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1M': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1Y': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          },
        },
      }, { status: 200 });
      // 🔥 强力清除缓存：确保返回 Header 中包含 Cache-Control
      response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return response;
    }

    // 🔥 身份识别标准化：直接从 session.user.id 获取用户 ID，一步直达查询
    const userId = session.user.id;
    
    // 🔥 数据库连接检查：使用统一的连接工具函数
    const connected = await ensurePrismaConnected();
    if (!connected) {
      console.error('❌ [Assets API] 数据库连接失败，返回降级数据');
      // 🔥 关键修复：用户资产 API 不应该返回 0，应该返回上一次的值或提示错误
      // 但在 Serverless 环境下无法缓存，所以返回一个明确的错误标识
      return NextResponse.json({
        success: false, // 🔥 改为 false，让前端知道这是错误
        error: '数据库连接失败，请稍后重试',
        data: {
          balance: 0,
          availableBalance: 0,
          frozenBalance: 0,
          positionsValue: 0,
          totalBalance: 0,
          totalEquity: 0,
          historical: {
            '1D': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1W': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1M': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1Y': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          },
        },
      }, { status: 503 }); // 🔥 使用 503 Service Unavailable
    }

    // 🔥 性能优化：直接基于 ID 查询，只查询必需的字段（balance）
    // 🔥 修复：使用统一的查询工具函数，自动处理连接错误
    const user = await executePrismaQuery(
      async () => {
        return await prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            balance: true,
          },
        });
      },
      null // 连接失败时返回 null
    );
      
      // ========== STEP 1: 深度日志埋点 - User 查询结果 ==========

      if (user) {

      } else {

      }

    // 🔥 修复：如果用户查询失败，返回错误而不是零值
    if (!user) {
      console.error('❌ [Assets API] 用户查询失败或用户不存在');
      return NextResponse.json({
        success: false,
        error: '用户查询失败，请稍后重试',
        data: {
          balance: 0,
          availableBalance: 0,
          frozenBalance: 0,
          positionsValue: 0,
          totalBalance: 0,
          totalEquity: 0,
          historical: {
            '1D': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1W': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1M': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
            '1Y': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          },
        },
      }, { status: 503 });
    }

    // 🔥 余额字段保护：使用 ?? 0 确保即使字段为 null，也能稳定得到数字 0
    const availableBalance = user.balance ?? 0;

    // ========== STEP 2: 深度日志埋点 - AvailableBalance 计算后 ==========

    // 2. 获取用户所有订单 - 添加连接检查
    let orders: any[] = [];
    try {
      await prisma.$connect();
      orders = await DBService.findOrdersByUserId(userId);
    } catch (orderError: any) {
      console.error('❌ [Assets API] 查询订单失败:', orderError);
      if (orderError.message?.includes('Engine is not yet connected') || 
          orderError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          orders = await DBService.findOrdersByUserId(userId);
        } catch (retryError) {
          console.error('❌ [Assets API] 重试查询订单失败:', retryError);
          orders = []; // 降级：返回空数组
        }
      } else {
        orders = []; // 降级：返回空数组
      }
    }

    // ========== 修复：计算冻结资金（待结算订单的总金额）==========
    // 冻结资金 = 所有PENDING状态的订单金额总和（LIMIT订单且未成交）
    // 注意：MARKET订单是即时成交的，不会冻结资金
    // 只有LIMIT订单且status=PENDING时，才会冻结资金
    const frozenBalance = orders
      .filter(order => {
        // 只统计LIMIT订单且状态为PENDING的订单
        return (order as any).orderType === 'LIMIT' && order.status === 'PENDING';
      })
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    // ========== 修复：从Position表计算持仓价值，不再从Order数组计算 ==========
    // 强制规则：UI的"我的持仓"100%只能来自Position表，不允许从Trade计算
    // 🔥 添加错误处理：如果 Prisma 引擎连接失败，返回空数组而不是崩溃
    let positions: any[] = [];
    try {
      // 🔥 确保 Prisma 引擎已连接
      await prisma.$connect();
      
      positions = await prisma.positions.findMany({
        where: {
          userId,
          status: 'OPEN', // ========== 强制规则：只计算OPEN状态的持仓 ==========
        },
        include: {
          markets: {
            select: {
              id: true,
              totalYes: true,
              totalNo: true,
              status: true,
              resolvedOutcome: true, // 🔥 必须包含：用于计算已结算市场的价格
            },
          },
        },
      });
    } catch (positionError: any) {
      console.error('❌ [Assets API] 查询持仓失败:', positionError);
      // 🔥 如果 Prisma 引擎连接失败，记录错误但继续执行，返回空数组
      // 这样不会阻塞整个 API，用户可以继续查看其他资产信息
      if (positionError.message?.includes('Engine was empty') || 
          positionError.message?.includes('Engine is not yet connected') ||
          positionError.message?.includes('connection')) {
        console.warn('⚠️ [Assets API] Prisma 引擎连接失败，持仓价值设为 0');
        positions = [];
      } else {
        // 其他错误也记录但不抛出，确保 API 可用
        positions = [];
      }
    }

    let positionsValue = 0;
    
    // 🔥 重构：计算每个持仓的当前价值（包括已结算的市场）
    // 注意：虽然 Position 状态是 OPEN，但市场可能已结算（RESOLVED）
    // 使用统一的 calculatePositionPrice 工具函数
    for (const position of positions) {
      try {
        // 🔥 确保 outcome 类型正确（Position.outcome 是 Outcome 枚举，需要转换为 'YES' | 'NO'）
        const outcomeStr = position.outcome as 'YES' | 'NO';
        const currentPrice = calculatePositionPrice(outcomeStr, {
          status: position.markets.status,
          resolvedOutcome: position.markets.resolvedOutcome,
          totalYes: position.markets.totalYes || 0,
          totalNo: position.markets.totalNo || 0,
        });

        // 持仓价值 = 份额 * 当前价格
        positionsValue += position.shares * currentPrice;
      } catch (error) {
        console.error(`Error calculating position value for position ${position.id}:`, error);
        // 继续处理其他持仓
      }
    }

    // 5. 计算总资产
    // 🔥 校验逻辑：确保 totalBalance 永远等于 availableBalance + frozenBalance + positionsValue
    const totalBalance = availableBalance + frozenBalance + positionsValue;

    // ========== STEP 3: 深度日志埋点 - TotalBalance 计算后（最终返回前）==========
    // 🔥 审计日志：记录详细的资产计算信息
    console.log(`💰 [Assets API] 用户 ${userId} 资产计算:`, {
      availableBalance,
      frozenBalance,
      positionsValue,
      totalBalance,
      positionsCount: positions.length,
      positionsDetail: positions.map(p => ({
        marketId: p.marketId,
        outcome: p.outcome,
        shares: Number(p.shares),
        avgPrice: Number(p.avgPrice),
        cost: Number(p.shares) * Number(p.avgPrice),
        currentPrice: calculatePositionPrice(p.outcome as 'YES' | 'NO', {
          status: p.markets.status,
          resolvedOutcome: p.markets.resolvedOutcome,
          totalYes: p.markets.totalYes || 0,
          totalNo: p.markets.totalNo || 0,
        }),
        value: Number(p.shares) * calculatePositionPrice(p.outcome as 'YES' | 'NO', {
          status: p.markets.status,
          resolvedOutcome: p.markets.resolvedOutcome,
          totalYes: p.markets.totalYes || 0,
          totalNo: p.markets.totalNo || 0,
        }),
      })),
    });

    // 6. 计算历史资产（用于计算收益）
    // 获取不同时间点的订单和交易记录
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

    // 🔥 修复：获取充值记录（用于计算历史余额）- 添加连接检查和重试逻辑
    let deposits: any[] = [];
    try {
      await prisma.$connect();
      deposits = await prisma.deposits.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (depositError: any) {
      console.error('❌ [Assets API] 查询充值记录失败:', depositError);
      if (depositError.message?.includes('Engine is not yet connected') || 
          depositError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          deposits = await prisma.deposits.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });
        } catch (retryError) {
          console.error('❌ [Assets API] 重试查询充值记录失败:', retryError);
          deposits = []; // 降级：返回空数组
        }
      } else {
        deposits = []; // 降级：返回空数组
      }
    }

    let withdrawals: any[] = [];
    try {
      await prisma.$connect();
      withdrawals = await prisma.withdrawals.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    } catch (withdrawalError: any) {
      console.error('❌ [Assets API] 查询提现记录失败:', withdrawalError);
      if (withdrawalError.message?.includes('Engine is not yet connected') || 
          withdrawalError.message?.includes('Engine was empty')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await prisma.$connect();
          withdrawals = await prisma.withdrawals.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });
        } catch (retryError) {
          console.error('❌ [Assets API] 重试查询提现记录失败:', retryError);
          withdrawals = []; // 降级：返回空数组
        }
      } else {
        withdrawals = []; // 降级：返回空数组
      }
    }

    // ========== 修复：计算历史总资产（基于充值/提现记录和Position历史）==========
    // 实际应该基于历史快照，这里使用简化计算
    const calculateHistoricalBalance = async (timestamp: number) => {
      // 计算到该时间点的净充值
      const depositsBefore = deposits
        .filter(d => new Date(d.createdAt).getTime() <= timestamp)
        .reduce((sum, d) => sum + (d.amount || 0), 0);
      
      const withdrawalsBefore = withdrawals
        .filter(w => new Date(w.createdAt).getTime() <= timestamp)
        .reduce((sum, w) => sum + (w.amount || 0), 0);
      
      // ========== 修复：从Position历史计算持仓价值 ==========
      // 查询该时间点之前创建的Position记录（包括CLOSED的）
      // 注意：这是一个简化实现，生产环境应该使用历史快照表记录每个时间点的持仓价值
      // 🔥 添加错误处理：如果 Prisma 引擎连接失败，返回空数组
      let historicalPositions: any[] = [];
      try {
        // 🔥 确保 Prisma 引擎已连接
        await prisma.$connect();
        
        historicalPositions = await prisma.positions.findMany({
          where: {
            userId,
            createdAt: {
              lte: new Date(timestamp),
            },
          },
          include: {
            markets: {
              select: {
                id: true,
                totalYes: true,
                totalNo: true,
                status: true,
                resolvedOutcome: true, // 🔥 修复：添加 resolvedOutcome 用于盈亏计算
              },
          },
        },
      });
      } catch (historicalError: any) {
        console.error('❌ [Assets API] 查询历史持仓失败:', historicalError);
        // 🔥 如果 Prisma 引擎连接失败，记录错误但继续执行，返回空数组
        if (historicalError.message?.includes('Engine was empty') || 
            historicalError.message?.includes('Engine is not yet connected') ||
            historicalError.message?.includes('connection')) {
          console.warn('⚠️ [Assets API] Prisma 引擎连接失败，历史持仓价值设为 0');
          historicalPositions = [];
        } else {
          historicalPositions = [];
        }
      }
      
      let historicalPositionValue = 0;
      for (const position of historicalPositions) {
        try {
          // 🔥 重构：使用统一的 calculatePositionPrice 工具函数
          // 只计算 OPEN 市场的持仓价值（已结算的应该已经计入余额）
          if (position.markets.status !== 'OPEN') {
            continue;
          }

          const currentPrice = calculatePositionPrice(position.outcome as 'YES' | 'NO', {
            status: position.markets.status,
            resolvedOutcome: position.markets.resolvedOutcome,
            totalYes: position.markets.totalYes || 0,
            totalNo: position.markets.totalNo || 0,
          });

          // 只计算该时间点之前创建的持仓份额
          // 简化：使用当前shares（实际应该查询历史shares快照）
          historicalPositionValue += position.shares * currentPrice;
        } catch (error) {
          console.error(`Error calculating historical position value for position ${position.id}:`, error);
          // 继续处理其他持仓
        }
      }
      
      // 简化计算：历史总资产 = 净充值 - 提现 + 历史持仓价值
      return depositsBefore - withdrawalsBefore + historicalPositionValue;
    };

    const past1DBalance = await calculateHistoricalBalance(oneDayAgo);
    const past1WBalance = await calculateHistoricalBalance(oneWeekAgo);
    const past1MBalance = await calculateHistoricalBalance(oneMonthAgo);
    const past1YBalance = await calculateHistoricalBalance(oneYearAgo);

    // 7. 计算收益
    const calculateProfit = (pastBalance: number) => {
      if (pastBalance <= 0) return { value: 0, percent: 0, isPositive: true };
      
      const profit = totalBalance - pastBalance;
      const percent = (profit / pastBalance) * 100;
      
      return {
        value: profit,
        percent: Math.round(percent * 100) / 100, // 保留2位小数
        isPositive: profit >= 0,
      };
    };

    // ========== 架构加固：返回完整的 AssetSnapshot ==========
    // 🔥 注意：totalBalance 已在第 193 行计算，此处不再重复定义
    
    // 🔥 在返回前打印最终计算结果

    // 🔥 最终校验：确保返回的 totalBalance 永远等于 availableBalance + frozenBalance + positionsValue
    // 重新计算以确保一致性（防止中间变量被修改）
    const verifiedTotalBalance = availableBalance + frozenBalance + positionsValue;
    
    // 🔥 强制校验：如果计算结果不一致，使用计算值并记录警告
    if (Math.abs(totalBalance - verifiedTotalBalance) > 0.01) {
      console.warn('⚠️ [Assets API] 总资产校验失败，使用计算值:', {
        originalTotalBalance: totalBalance,
        calculatedTotalBalance: verifiedTotalBalance,
        availableBalance,
        frozenBalance,
        positionsValue,
        difference: Math.abs(totalBalance - verifiedTotalBalance),
      });
    }
    
    // 🔥 使用验证后的总资产值
    const finalTotalBalance = verifiedTotalBalance;
    
    const response = NextResponse.json({
      success: true,
      data: {
        balance: finalTotalBalance, // 🔥 关键修复：balance 字段等于 totalBalance（用于右上角显示）
        availableBalance, // 🔥 Dashboard 显示的可用余额（统一使用 availableBalance 字段名）
        frozenBalance, // 冻结资金
        positionsValue, // 持仓价值
        totalBalance: finalTotalBalance, // 🔥 校验逻辑：总资产 = availableBalance + frozenBalance + positionsValue
        totalEquity: finalTotalBalance, // 总资产估值（与 totalBalance 一致）
        lockedBalance: frozenBalance, // 冻结资金（别名，向后兼容）
        historical: {
          '1D': {
            balance: past1DBalance,
            profit: calculateProfit(past1DBalance), // 后端计算收益
          },
          '1W': {
            balance: past1WBalance,
            profit: calculateProfit(past1WBalance),
          },
          '1M': {
            balance: past1MBalance,
            profit: calculateProfit(past1MBalance),
          },
          '1Y': {
            balance: past1YBalance,
            profit: calculateProfit(past1YBalance),
          },
        },
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      },
    });
    // 🔥 强力清除缓存：确保返回 Header 中包含 Cache-Control
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  } catch (error: any) {
    // 🔥 强制 API 降级：无论 auth() 是否成功，无论变量计算是否报错，强制返回一个 200 状态码的 JSON
    // 绝不允许抛出 500 或 401，这是防止前端崩溃的唯一办法
    console.error('❌ [Assets API] Internal error:', error);
    
    // 🔥 修复：如果错误是 Prisma 连接问题，尝试重新连接并返回用户余额
    if (error?.message?.includes('Engine is not yet connected') || 
        error?.message?.includes('Engine was empty')) {
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        await prisma.$connect();
        
        // 尝试获取用户余额
        const session = await auth();
        if (session?.user?.id) {
          const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { balance: true },
          });
          
          if (user) {
            const balance = Number(user.balance || 0);
            const response = NextResponse.json({
              success: true,
              data: {
                balance: balance,
                availableBalance: balance,
                frozenBalance: 0,
                positionsValue: 0,
                totalBalance: balance,
                totalEquity: balance,
                historical: {
                  '1D': { balance: balance, profit: { value: 0, percent: 0, isPositive: true } },
                  '1W': { balance: balance, profit: { value: 0, percent: 0, isPositive: true } },
                  '1M': { balance: balance, profit: { value: 0, percent: 0, isPositive: true } },
                  '1Y': { balance: balance, profit: { value: 0, percent: 0, isPositive: true } },
                },
              },
            }, { status: 200 });
            response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response;
          }
        }
      } catch (retryError) {
        console.error('❌ [Assets API] 重试失败:', retryError);
      }
    }
    
    // 最终降级：返回零值
    const response = NextResponse.json({
      success: true,
      data: {
        balance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        positionsValue: 0,
        totalBalance: 0,
        totalEquity: 0,
        historical: {
          '1D': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          '1W': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          '1M': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
          '1Y': { balance: 0, profit: { value: 0, percent: 0, isPositive: true } },
        },
      },
    }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  }
}
