import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { DBService } from '@/lib/dbService';
import { prisma } from '@/lib/prisma';

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
      console.log('DEBUG: Session missing in Assets API');
      console.log('🔒 [Assets API] No session or user.id, returning 200 with balance: 0, isGuest: true');
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
    
    // 🔥 性能优化：直接基于 ID 查询，只查询必需的字段（balance）
    // 🔥 修复：处理数据库查询超时错误
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          balance: true,
        },
      });
      
      // ========== STEP 1: 深度日志埋点 - User 查询结果 ==========
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [STEP 1] User 查询结果（数据库原始值）:');
      console.log('  ✅ User 对象存在:', !!user);
      if (user) {
        console.log('  📋 User ID:', user.id);
        console.log('  📧 User Email:', user.email);
        console.log('  💰 User.balance (原始数据库值):', user.balance);
        console.log('  💰 User.balance 类型:', typeof user.balance);
        console.log('  💰 User.balance 是否为 null:', user.balance === null);
        console.log('  💰 User.balance 是否为 undefined:', user.balance === undefined);
      } else {
        console.log('  ⚠️ User 对象为 null 或 undefined');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (dbError: any) {
      // 🔥 修复：数据库连接超时或其他错误时，返回降级数据（零值），但不返回 isGuest: true
      console.error('❌ [Assets API] 用户查询失败（可能是超时）:', dbError?.message || dbError);
      console.log('🔒 [Assets API] 用户查询失败，返回降级数据（零值）而非 isGuest: true');
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

    if (!user) {
      console.log('🔒 [Assets API] User not found by id, returning 200 with balance: 0');
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

    // 🔥 余额字段保护：使用 ?? 0 确保即使字段为 null，也能稳定得到数字 0
    const availableBalance = user.balance ?? 0;

    // ========== STEP 2: 深度日志埋点 - AvailableBalance 计算后 ==========
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [STEP 2] AvailableBalance 计算结果:');
    console.log('  💰 user.balance (原始值):', user.balance);
    console.log('  💰 user.balance ?? 0 计算结果:', availableBalance);
    console.log('  📊 availableBalance 类型:', typeof availableBalance);
    console.log('  ✅ availableBalance 是否为数字:', typeof availableBalance === 'number');
    console.log('  ⚠️ availableBalance 是否为 NaN:', isNaN(availableBalance));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 2. 获取用户所有订单
    const orders = await DBService.findOrdersByUserId(userId);

    // ========== 修复：计算冻结资金（待结算订单的总金额）==========
    // 冻结资金 = 所有未结算订单的金额总和
    // 注意：当前系统是即时成交，没有挂单，所以lockedBalance通常为0
    // 如果未来支持挂单，需要添加Order.status字段来区分PENDING和COMPLETED
    const frozenBalance = orders
      .filter(order => !order.payout && order.payout === null) // 未结算的订单
      .reduce((sum, order) => sum + (order.amount || 0), 0);

    // ========== 修复：从Position表计算持仓价值，不再从Order数组计算 ==========
    // 强制规则：UI的"我的持仓"100%只能来自Position表，不允许从Trade计算
    const positions = await prisma.position.findMany({
      where: {
        userId,
        status: 'OPEN', // ========== 强制规则：只计算OPEN状态的持仓 ==========
      },
      include: {
        market: {
          select: {
            id: true,
            totalYes: true,
            totalNo: true,
            status: true,
          },
        },
      },
    });

    let positionsValue = 0;
    
    // 计算每个持仓的当前价值
    for (const position of positions) {
      try {
        // 只计算OPEN市场的持仓价值
        if (position.market.status !== 'OPEN') {
          continue;
        }

        // 计算当前市场价格
        const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
        if (totalVolume <= 0) {
          continue;
        }

        const currentPrice = position.outcome === 'YES'
          ? (position.market.totalYes / totalVolume)
          : (position.market.totalNo / totalVolume);

        // 持仓价值 = 份额 * 当前价格
        positionsValue += position.shares * currentPrice;
      } catch (error) {
        console.error(`Error calculating position value for position ${position.id}:`, error);
        // 继续处理其他持仓
      }
    }

    // 5. 计算总资产
    const totalBalance = availableBalance + frozenBalance + positionsValue;

    // ========== STEP 3: 深度日志埋点 - TotalBalance 计算后（最终返回前）==========
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [STEP 3] TotalBalance 最终计算结果（即将返回给前端）:');
    console.log('  💰 availableBalance:', availableBalance, `(类型: ${typeof availableBalance})`);
    console.log('  🧊 frozenBalance:', frozenBalance, `(类型: ${typeof frozenBalance})`);
    console.log('  📈 positionsValue:', positionsValue, `(类型: ${typeof positionsValue})`);
    console.log('  🧮 计算公式: totalBalance = availableBalance + frozenBalance + positionsValue');
    console.log('  🧮 计算过程:', `${availableBalance} + ${frozenBalance} + ${positionsValue}`);
    console.log('  💎 totalBalance (最终结果):', totalBalance, `(类型: ${typeof totalBalance})`);
    console.log('  ⚠️ totalBalance 是否为 NaN:', isNaN(totalBalance));
    console.log('  ⚠️ totalBalance 是否为 0:', totalBalance === 0);
    console.log('  ✅ 即将返回的 JSON.data.balance 字段值:', totalBalance);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 6. 计算历史资产（用于计算收益）
    // 获取不同时间点的订单和交易记录
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;

    // 获取充值记录（用于计算历史余额）
    const deposits = await prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

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
      const historicalPositions = await prisma.position.findMany({
        where: {
          userId,
          createdAt: {
            lte: new Date(timestamp),
          },
        },
        include: {
          market: {
            select: {
              id: true,
              totalYes: true,
              totalNo: true,
              status: true,
            },
          },
        },
      });
      
      let historicalPositionValue = 0;
      for (const position of historicalPositions) {
        // 只计算OPEN市场的持仓价值
        if (position.market.status !== 'OPEN') {
          continue;
        }

        // 使用当前市场价格（简化，实际应该查询历史价格快照）
        // 注意：这是一个近似值，生产环境应该使用历史价格快照表
        const totalVolume = (position.market.totalYes || 0) + (position.market.totalNo || 0);
        if (totalVolume > 0) {
          const currentPrice = position.outcome === 'YES'
            ? (position.market.totalYes / totalVolume)
            : (position.market.totalNo / totalVolume);
          // 只计算该时间点之前创建的持仓份额
          // 简化：使用当前shares（实际应该查询历史shares快照）
          historicalPositionValue += position.shares * currentPrice;
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
    console.log('💰 [Assets API] 最终资产计算结果:');
    console.log('  AvailableBalance (可用余额):', availableBalance);
    console.log('  FrozenBalance (冻结余额):', frozenBalance);
    console.log('  PositionsValue (持仓价值):', positionsValue);
    console.log('  TotalBalance (总资产):', totalBalance);
    console.log('═══════════════════════════════════════════════════════');
    
    const response = NextResponse.json({
      success: true,
      data: {
        balance: totalBalance, // 🔥 关键修复：balance 字段等于 totalBalance（用于右上角显示）
        availableBalance, // 🔥 Dashboard 显示的可用余额
        frozenBalance,
        positionsValue,
        totalBalance, // = availableBalance + frozenBalance + positionsValue（已在第 193 行计算）
        totalEquity: totalBalance, // 总资产估值（与 totalBalance 一致）
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
  } catch (error) {
    // 🔥 强制 API 降级：无论 auth() 是否成功，无论变量计算是否报错，强制返回一个 200 状态码的 JSON
    // 绝不允许抛出 500 或 401，这是防止前端崩溃的唯一办法
    console.error('❌ [Assets API] Internal error:', error);
    const response = NextResponse.json({
      success: true,
      balance: 0,
    }, { status: 200 });
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    return response;
  }
}
