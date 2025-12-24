import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from '@/lib/prisma';
import dayjs from '@/lib/dayjs';
import { MarketStatus } from '@/types/data';

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
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const now = dayjs.utc();
    const twentyFourHoursAgo = now.subtract(24, 'hour');

    // 1. 查询已结束但尚未结算的市场（需要处理）
    const pendingSettlement = await prisma.market.findMany({
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
      include: {
        marketTemplate: true,
      },
      orderBy: {
        closingDate: 'asc', // 按结束时间升序（最早结束的优先显示）
      },
    });

    // 2. 查询最近 24 小时已结算的市场（监控）
    const recentlySettled = await prisma.market.findMany({
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
      include: {
        marketTemplate: true,
      },
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
          settlementPrice: market.resolvedOutcome ? convertToNumber(market.strikePrice) : null, // TODO: 添加 settlementPrice 字段存储实际结算价
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
        // 结算错误信息（如果有的话，可以从结算日志中获取）
        settlementError: null, // TODO: 从结算日志表获取
        settlementAttempts: 0, // TODO: 从结算日志表获取
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
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error',
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
    // 权限校验
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }
    
    const userRole = (session.user as any).role;
    const userEmail = session.user.email;
    const adminEmail = 'yesno@yesno.com';
    
    if (userRole !== 'ADMIN' && userEmail !== adminEmail) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 401 }
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
    const { settleMarket } = await import('@/lib/factory/settlement');
    const market = await prisma.market.findUnique({
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
      // 直接调用结算逻辑（不通过 HTTP）
      const { DBService } = await import('@/lib/mockData');
      const { MarketStatus, Outcome } = await import('@/types/data');
      
      const orders = await prisma.order.findMany({
        where: { marketId },
      });

      const result = await prisma.$transaction(async (tx) => {
        // 计算结算逻辑
        const totalFees = orders.reduce((sum, o) => sum + (o.feeDeducted || 0), 0);
        const netTotalPool = (market.totalVolume || 0) - totalFees;
        const winningOrders = orders.filter(o => o.outcomeSelection === (forceOutcome as Outcome));
        const winningPoolFees = winningOrders.reduce((sum, o) => sum + (o.feeDeducted || 0), 0);
        const winningPool = forceOutcome === 'YES' ? (market.totalYes || 0) : (market.totalNo || 0);
        const netWinningPool = winningPool - winningPoolFees;
        const userPayouts = new Map<string, number>();

        for (const order of orders) {
          if (order.outcomeSelection === (forceOutcome as Outcome)) {
            if (netWinningPool > 0) {
              const payoutRate = netTotalPool / netWinningPool;
              const netInvestment = order.amount - (order.feeDeducted || 0);
              const payout = netInvestment * payoutRate;
              const currentPayout = userPayouts.get(order.userId) || 0;
              userPayouts.set(order.userId, currentPayout + payout);
              await tx.order.update({
                where: { id: order.id },
                data: { payout },
              });
            } else {
              await tx.order.update({
                where: { id: order.id },
                data: { payout: 0 },
              });
            }
          } else {
            await tx.order.update({
              where: { id: order.id },
              data: { payout: 0 },
            });
          }
        }

        for (const [userId, payout] of userPayouts.entries()) {
          if (payout > 0) {
            await tx.user.update({
              where: { id: userId },
              data: { balance: { increment: payout } },
            });
          }
        }

        const updatedMarket = await tx.market.update({
          where: { id: marketId },
          data: {
            status: MarketStatus.RESOLVED,
            resolvedOutcome: forceOutcome as Outcome,
          },
        });

        return updatedMarket;
      });

      return NextResponse.json({
        success: true,
        message: '强制结算成功',
        data: result,
      });
      } else {
        // 自动重试结算：直接调用工厂结算逻辑
        if (market.isFactory && market.symbol) {
          try {
            const { getPrice } = await import('@/lib/oracle');
            const { MarketStatus, Outcome } = await import('@/types/data');
            
            // 获取 Oracle 价格
            const priceResult = await getPrice(market.symbol);
            const settlementPrice = priceResult.price;
            
            if (!market.strikePrice || market.strikePrice <= 0) {
              throw new Error('市场缺少有效的 strikePrice');
            }
            
            const strikePrice = Number(market.strikePrice);
            const autoOutcome = settlementPrice > strikePrice ? Outcome.YES : Outcome.NO;
            
            // 执行结算逻辑
            const orders = await prisma.order.findMany({ where: { marketId } });
            const result = await prisma.$transaction(async (tx) => {
              const totalFees = orders.reduce((sum, o) => sum + (o.feeDeducted || 0), 0);
              const netTotalPool = (market.totalVolume || 0) - totalFees;
              const winningOrders = orders.filter(o => o.outcomeSelection === autoOutcome);
              const winningPoolFees = winningOrders.reduce((sum, o) => sum + (o.feeDeducted || 0), 0);
              const winningPool = autoOutcome === Outcome.YES ? (market.totalYes || 0) : (market.totalNo || 0);
              const netWinningPool = winningPool - winningPoolFees;
              const userPayouts = new Map<string, number>();

              for (const order of orders) {
                if (order.outcomeSelection === autoOutcome) {
                  if (netWinningPool > 0) {
                    const payoutRate = netTotalPool / netWinningPool;
                    const netInvestment = order.amount - (order.feeDeducted || 0);
                    const payout = netInvestment * payoutRate;
                    const currentPayout = userPayouts.get(order.userId) || 0;
                    userPayouts.set(order.userId, currentPayout + payout);
                    await tx.order.update({
                      where: { id: order.id },
                      data: { payout },
                    });
                  } else {
                    await tx.order.update({
                      where: { id: order.id },
                      data: { payout: 0 },
                    });
                  }
                } else {
                  await tx.order.update({
                    where: { id: order.id },
                    data: { payout: 0 },
                  });
                }
              }

              for (const [userId, payout] of userPayouts.entries()) {
                if (payout > 0) {
                  await tx.user.update({
                    where: { id: userId },
                    data: { balance: { increment: payout } },
                  });
                }
              }

              return await tx.market.update({
                where: { id: marketId },
                data: {
                  status: MarketStatus.RESOLVED,
                  resolvedOutcome: autoOutcome,
                },
              });
            });

            return NextResponse.json({
              success: true,
              outcome: autoOutcome,
              settlementPrice,
              message: `结算成功：结算价 $${settlementPrice.toFixed(2)} > 行权价 $${strikePrice.toFixed(2)} -> 结果 ${autoOutcome}`,
              data: result,
            });
          } catch (err: any) {
            return NextResponse.json({
              success: false,
              error: `重试结算失败: ${err.message}`,
            }, { status: 500 });
          }
        } else {
          return NextResponse.json({
            success: false,
            error: '非工厂市场请使用强制结算功能指定结果',
          }, { status: 400 });
        }
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
