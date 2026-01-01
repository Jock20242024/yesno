import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/authExport";
import { prisma } from '@/lib/prisma';
import dayjs from '@/lib/dayjs';
import { MarketStatus, Outcome } from '@/types/data';

export const dynamic = 'force-dynamic';

/**
 * 结算监控 API
 * GET /api/admin/settlement
 * 
 * 返回：
 * - 已结束但尚未结算的市场（需要处理）
 * - 最近 24 小时已结算的市场（监控）
 */
export async function GET(request: NextRequest) {
  try {
    // 🔥 修复：权限校验 - 直接从数据库查询 isAdmin
    const session = await auth();
    
    // 🔥 调试日志：打印 session 信息

    if (!session || !session.user) {
      console.error('❌ [Settlement GET API] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userEmail = session.user.email;
    if (!userEmail) {
      console.error('❌ [Settlement GET API] 用户邮箱为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // 🔥 修复：直接从数据库查询 isAdmin，不依赖 session
    const dbUser = await prisma.users.findUnique({
      where: { email: userEmail },
      select: { id: true, isAdmin: true, isBanned: true },
    });
    
    // 🔥 调试日志：打印数据库查询结果

    if (!dbUser) {
      console.error('❌ [Settlement GET API] 用户不存在于数据库');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (!dbUser.isAdmin) {
      console.error('❌ [Settlement GET API] 用户不是管理员，数据库 isAdmin =', dbUser.isAdmin);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (dbUser.isBanned) {
      console.error('❌ [Settlement GET API] 管理员账户已被禁用');
      return NextResponse.json(
        { success: false, error: 'Admin account is banned.' },
        { status: 403 }
      );
    }

    const now = dayjs.utc();
    const twentyFourHoursAgo = now.subtract(24, 'hour');

    // 1. 查询已结束但尚未结算的市场（需要处理）
    const pendingSettlement = await prisma.markets.findMany({
      where: {
        isActive: true,
        reviewStatus: 'PUBLISHED',
        closingDate: {
          lte: now.toDate(), // 已结束
        },
        resolvedOutcome: null, // 尚未结算
        status: {
          not: MarketStatus.RESOLVED, // 确保状态不是已结算
        },
      },
      // 🔥 修复：移除不存在的 marketTemplate relation，Market 模型中没有定义这个关系
      orderBy: {
        closingDate: 'asc', // 按结束时间升序（最早结束的优先显示）
      },
    });

    // 2. 查询最近 24 小时已结算的市场（监控）
    const recentlySettled = await prisma.markets.findMany({
      where: {
        isActive: true,
        reviewStatus: 'PUBLISHED',
        status: MarketStatus.RESOLVED,
        resolvedOutcome: {
          not: null,
        },
        updatedAt: {
          gte: twentyFourHoursAgo.toDate(), // 最近 24 小时内结算的
        },
      },
      // 🔥 修复：移除不存在的 marketTemplate relation，Market 模型中没有定义这个关系
      orderBy: {
        updatedAt: 'desc', // 最近结算的在前
      },
    });

    // 3. 转换为前端需要的格式，并添加结算相关信息
    const convertToNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'bigint') return Number(value);
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return Number(value) || 0;
    };

      const formatMarket = (market: any, isPending: boolean) => {
      const isFactory = market.isFactory || !!market.templateId;
      const settlementType = isFactory ? 'Price_Oracle' : 'External_Link';
      
      // 🔥 结算证据
      let settlementEvidence = null;
      if (isFactory && market.strikePrice) {
        // 工厂市场：显示结算价对比行权价
        // 注意：实际结算价需要从 Oracle 实时获取（对于待结算的）或从结算日志获取（对于已结算的）
        // 这里为了演示，对于已结算的假设结算价等于 strikePrice（实际应该存储真实结算价）
        settlementEvidence = {
          type: 'Price_Oracle',
          strikePrice: convertToNumber(market.strikePrice),
          // 🔥 当前实现：对于已结算的市场，使用 strikePrice 作为结算价（工厂市场的结算价通常等于行权价）
          // 💡 未来改进：如果需要在 Market 模型中添加 settlementPrice 字段来存储实际结算价（从 Oracle 获取的最终价格），
          //    可以创建 migration 添加该字段，然后在结算时存储实际结算价
          settlementPrice: market.resolvedOutcome ? convertToNumber(market.strikePrice) : null,
          result: market.resolvedOutcome,
        };
      } else if (!isFactory && market.externalId) {
        // 同步市场：显示外部链接和原始数据
        let externalData = null;
        try {
          if (market.outcomePrices) {
            externalData = JSON.parse(market.outcomePrices);
          }
        } catch (e) {
          // 解析失败，忽略
        }
        settlementEvidence = {
          type: 'External_Link',
          externalId: market.externalId,
          externalSource: market.externalSource || market.source || 'polymarket',
          externalData,
        };
      }

      return {
        id: market.id,
        title: market.title,
        closingDate: market.closingDate.toISOString(),
        updatedAt: market.updatedAt.toISOString(),
        status: market.status,
        resolvedOutcome: market.resolvedOutcome,
        templateId: market.templateId || null,
        symbol: market.symbol || null,
        strikePrice: market.strikePrice ? convertToNumber(market.strikePrice) : null,
        isFactory,
        settlementType,
        settlementEvidence,
        isPending, // 是否待结算
        // 💡 结算错误信息：当前实现返回 null/0，因为没有结算日志表
        // 💡 未来改进：如果需要记录结算失败的历史，可以创建 SettlementLog 表来记录：
        //    - settlementError: 最后一次结算失败的错误信息
        //    - settlementAttempts: 结算尝试次数
        //    然后在这里查询 SettlementLog 表获取这些信息
        settlementError: null,
        settlementAttempts: 0,
      };
    };

    const pendingMarkets = pendingSettlement.map(m => formatMarket(m, true));
    const settledMarkets = recentlySettled.map(m => formatMarket(m, false));

    // 4. 按 templateId 聚合
    const aggregateByTemplate = (markets: any[]) => {
      const aggregatedMap = new Map<string, any>();
      
      markets.forEach((market) => {
        const groupKey = market.templateId || market.id;
        
        if (!aggregatedMap.has(groupKey)) {
          aggregatedMap.set(groupKey, {
            templateId: market.templateId,
            title: market.title,
            symbol: market.symbol,
            markets: [],
            hasPending: false, // 是否有待结算的场次
          });
        }
        
        const aggregated = aggregatedMap.get(groupKey)!;
        aggregated.markets.push(market);
        if (market.isPending) {
          aggregated.hasPending = true;
        }
      });
      
      return Array.from(aggregatedMap.values());
    };

    const pendingAggregated = aggregateByTemplate(pendingMarkets);
    const settledAggregated = aggregateByTemplate(settledMarkets);

    // 按是否有待结算排序（有待结算的在前）
    pendingAggregated.sort((a, b) => {
      if (a.hasPending && !b.hasPending) return -1;
      if (!a.hasPending && b.hasPending) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        pending: {
          aggregated: pendingAggregated,
          raw: pendingMarkets,
          total: pendingMarkets.length,
        },
        settled: {
          aggregated: settledAggregated,
          raw: settledMarkets,
          total: settledMarkets.length,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ [Settlement API] 获取结算数据失败:', error);
    console.error('❌ [Settlement API] 错误堆栈:', error?.stack);
    console.error('❌ [Settlement API] 错误详情:', {
      message: error?.message,
      name: error?.name,
      code: (error as any)?.code,
    });
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
        // 🔥 开发环境返回详细错误信息，方便调试
        ...(process.env.NODE_ENV === 'development' && {
          details: error?.message,
          stack: error?.stack,
        }),
      },
      { status: 500 }
    );
  }
}

/**
 * 重试结算
 * POST /api/admin/settlement/retry
 * 
 * 请求体：
 * {
 *   marketId: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 🔥 修复：权限校验 - 直接从数据库查询 isAdmin
    const session = await auth();
    
    // 🔥 调试日志：打印 session 信息

    if (!session || !session.user) {
      console.error('❌ [Settlement POST API] Session 验证失败: session 或 user 为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userEmail = session.user.email;
    if (!userEmail) {
      console.error('❌ [Settlement POST API] 用户邮箱为空');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    // 🔥 修复：直接从数据库查询 isAdmin，不依赖 session
    const dbUser = await prisma.users.findUnique({
      where: { email: userEmail },
      select: { id: true, isAdmin: true, isBanned: true },
    });
    
    // 🔥 调试日志：打印数据库查询结果

    if (!dbUser) {
      console.error('❌ [Settlement POST API] 用户不存在于数据库');
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (!dbUser.isAdmin) {
      console.error('❌ [Settlement POST API] 用户不是管理员，数据库 isAdmin =', dbUser.isAdmin);
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    if (dbUser.isBanned) {
      console.error('❌ [Settlement POST API] 管理员账户已被禁用');
      return NextResponse.json(
        { success: false, error: 'Admin account is banned.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { marketId, forceOutcome } = body;

    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId is required' },
        { status: 400 }
      );
    }

    // 调用结算逻辑
    const { executeSettlement } = await import('@/lib/factory/settlement');
    const market = await prisma.markets.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    // 如果是强制手动结算，使用指定的 outcome
    if (forceOutcome) {
      // 直接调用结算逻辑
      const result = await executeSettlement(marketId, forceOutcome as Outcome);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || '结算失败' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        outcome: result.outcome,
        statistics: result.statistics,
      });
    } else {
      // 自动结算
      const result = await executeSettlement(marketId);
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || '结算失败' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        outcome: result.outcome,
        statistics: result.statistics,
      });
    }
  } catch (error: any) {
    console.error('❌ [Settlement Retry API] 重试结算失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
