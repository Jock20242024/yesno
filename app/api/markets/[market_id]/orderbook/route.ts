import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Outcome } from '@/types/data';

export const dynamic = 'force-dynamic';

/**
 * 获取市场订单簿数据 API
 * GET /api/markets/[market_id]/orderbook
 * 
 * 🔥 核心架构升级：基于真实的 PENDING 限价单构建订单簿（CLOB 模式）
 * - 查询 status='PENDING' 且 orderType='LIMIT' 的订单
 * - 按 limitPrice 聚合（GroupBy Price）
 * - 买单（Bids）：outcomeSelection='YES'，按价格从高到低排序
 * - 卖单（Asks）：outcomeSelection='NO'，按价格从低到高排序
 * - 确保不返回 quantity 为 0 的空行
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    const { market_id } = await params;

    // 1. 验证市场是否存在
    const market = await prisma.markets.findUnique({
      where: { id: market_id },
      select: {
        id: true,
        title: true,
        status: true,
        totalYes: true,
        totalNo: true,
        outcomePrices: true,
        resolvedOutcome: true,
      },
    });

    if (!market) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market not found',
        },
        { status: 404 }
      );
    }

    // 2. 🔥 查询所有 PENDING 状态的 LIMIT 订单
    const pendingOrders = await prisma.orders.findMany({
      where: {
        marketId: market_id,
        status: 'PENDING',
        orderType: 'LIMIT',
        limitPrice: { not: null }, // 确保限价不为空
      },
      select: {
        id: true,
        outcomeSelection: true,
        limitPrice: true,
        amount: true,
        filledAmount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // 按创建时间排序，先入先出
      },
    });

    // 3. 🔥 按价格聚合订单（GroupBy Price）
    // 买单（Bids）：YES 订单，按价格从高到低
    // 卖单（Asks）：NO 订单，按价格从低到高
    
    interface OrderBookEntry {
      price: number;
      quantity: number; // 订单数量（shares）
      total: number; // 总金额（USD）
      orderCount: number; // 该价格档位的订单数量
    }

    const bidMap = new Map<number, OrderBookEntry>(); // key: limitPrice
    const askMap = new Map<number, OrderBookEntry>(); // key: limitPrice

    for (const order of pendingOrders) {
      const limitPrice = order.limitPrice;
      if (!limitPrice || limitPrice <= 0 || limitPrice >= 1) {
        continue; // 跳过无效的限价
      }

      // 🔥 修复：计算剩余数量（shares）和剩余金额
      // 对于LIMIT订单，filledAmount是已成交的份额数，不是金额
      const filledShares = order.filledAmount || 0;
      const orderShares = order.amount / limitPrice; // 订单总份额 = 订单金额 / 限价
      const remainingShares = orderShares - filledShares; // 剩余份额
      const remainingAmount = remainingShares * limitPrice; // 剩余金额 = 剩余份额 * 限价

      if (remainingShares <= 0 || remainingAmount <= 0) {
        continue; // 跳过已完全成交的订单
      }

      // 根据 outcomeSelection 分类到买单或卖单
      if (order.outcomeSelection === 'YES') {
        // 买单（Bids）：购买 YES（绿色显示）
        const existing = bidMap.get(limitPrice);
        if (existing) {
          existing.quantity += remainingShares;
          existing.total += remainingAmount;
          existing.orderCount += 1;
        } else {
          bidMap.set(limitPrice, {
            price: limitPrice,
            quantity: remainingShares,
            total: remainingAmount,
            orderCount: 1,
          });
        }
      } else if (order.outcomeSelection === 'NO') {
        // 卖单（Asks）：卖出 NO（红色显示）
        // 对于 NO 订单，我们需要将其转换为 YES 卖出价格
        // NO 价格 + YES 价格 = 1，所以 YES 卖出价格 = 1 - NO 价格
        const yesSellPrice = 1 - limitPrice;
        
        const existing = askMap.get(yesSellPrice);
        if (existing) {
          existing.quantity += remainingShares;
          existing.total += remainingAmount;
          existing.orderCount += 1;
        } else {
          askMap.set(yesSellPrice, {
            price: yesSellPrice,
            quantity: remainingShares,
            total: remainingAmount,
            orderCount: 1,
          });
        }
      }
    }

    // 4. 转换为数组并排序
    // 买单（Bids）：按价格从高到低排序
    const bids: OrderBookEntry[] = Array.from(bidMap.values())
      .sort((a, b) => b.price - a.price)
      .filter(entry => entry.quantity > 0); // 🔥 过滤掉 quantity 为 0 的空行

    // 卖单（Asks）：按价格从低到高排序
    const asks: OrderBookEntry[] = Array.from(askMap.values())
      .sort((a, b) => a.price - b.price)
      .filter(entry => entry.quantity > 0); // 🔥 过滤掉 quantity 为 0 的空行

    // 5. 如果没有订单，返回空数组（而不是 AMM 模拟数据）
    // 这样前端可以显示"暂无挂单"的提示

    // 6. 计算价差（Spread）
    const spread = asks.length > 0 && bids.length > 0 
      ? Math.max(0, asks[0].price - bids[0].price)
      : 0;

    // 7. 计算当前市场价格（用于显示参考）
    const totalAmount = Number(market.totalYes || 0) + Number(market.totalNo || 0);
    let currentPrice = 0.5;
    if (totalAmount > 0) {
      currentPrice = Number(market.totalYes || 0) / totalAmount;
    }

    // 🔥 8. 添加AMM虚拟订单（自动补全盘口）
    // 如果真实挂单不足，自动显示由AMM生成的虚拟挂单
    // 🔥 关键修复：只有在该市场有流动性时才生成AMM虚拟订单
    const totalLiquidity = Number(market.totalYes || 0) + Number(market.totalNo || 0);
    let ammDepth: Array<{ price: number; depth: number; outcome: Outcome }> = [];
    
    // 🔥 修复：只有当市场有流动性（totalYes + totalNo > 0）时才生成AMM虚拟订单
    if (totalLiquidity > 0) {
      const { calculateAMMDepth } = await import('@/lib/engine/match');
      ammDepth = calculateAMMDepth(
        Number(market.totalYes || 0),
        Number(market.totalNo || 0),
        [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
      );
    }

    // 将AMM深度转换为虚拟订单
    const ammAsks: OrderBookEntry[] = [];
    const ammBids: OrderBookEntry[] = [];

    for (const depthPoint of ammDepth) {
      if (depthPoint.depth > 0) {
        const entry: OrderBookEntry = {
          price: depthPoint.price,
          quantity: depthPoint.depth,
          total: depthPoint.depth * depthPoint.price,
          orderCount: 0, // AMM虚拟订单，订单数为0
        };

        if (depthPoint.outcome === Outcome.YES) {
          // YES订单：买单（Bids）
          ammBids.push(entry);
        } else {
          // NO订单：卖单（Asks），需要转换为YES卖出价格
          const yesSellPrice = 1 - depthPoint.price;
          ammAsks.push({
            ...entry,
            price: yesSellPrice,
            total: depthPoint.depth * yesSellPrice, // 🔥 修复：使用转换后的价格计算total
          });
        }
      }
    }

    // 合并真实订单和AMM虚拟订单
    // 对于每个价格档位，如果真实订单存在，优先显示真实订单；否则显示AMM虚拟订单
    const mergedBids = new Map<number, OrderBookEntry>();
    const mergedAsks = new Map<number, OrderBookEntry>();

    // 先添加真实订单
    for (const bid of bids) {
      mergedBids.set(bid.price, bid);
    }
    for (const ask of asks) {
      mergedAsks.set(ask.price, ask);
    }

    // 再添加AMM虚拟订单（如果该价格档位没有真实订单）
    for (const ammBid of ammBids) {
      if (!mergedBids.has(ammBid.price)) {
        mergedBids.set(ammBid.price, { ...ammBid, orderCount: -1 }); // -1 表示AMM虚拟订单
      }
    }
    for (const ammAsk of ammAsks) {
      if (!mergedAsks.has(ammAsk.price)) {
        mergedAsks.set(ammAsk.price, { ...ammAsk, orderCount: -1 }); // -1 表示AMM虚拟订单
      }
    }

    // 排序并转换为数组
    const finalBids = Array.from(mergedBids.values())
      .sort((a, b) => b.price - a.price)
      .slice(0, 5); // 🔥 修复：只显示5档

    // 🔥 修复：asks按价格从高到低排序（与前端显示一致）
    const finalAsks = Array.from(mergedAsks.values())
      .sort((a, b) => b.price - a.price) // 从高到低
      .slice(0, 5); // 🔥 修复：只显示5档

    // 重新计算价差（基于合并后的订单）
    const finalSpread = finalAsks.length > 0 && finalBids.length > 0 
      ? Math.max(0, finalAsks[0].price - finalBids[0].price)
      : spread;

    return NextResponse.json({
      success: true,
      data: {
        asks: finalAsks, // 卖单列表（包含AMM虚拟订单）
        bids: finalBids, // 买单列表（包含AMM虚拟订单）
        spread: finalSpread,
        currentPrice,
        marketId: market_id,
        totalBids: finalBids.reduce((sum, bid) => sum + bid.quantity, 0),
        totalAsks: finalAsks.reduce((sum, ask) => sum + ask.quantity, 0),
        ammLiquidity: { // 🔥 新增：AMM流动性数据
          totalYes: Number(market.totalYes || 0),
          totalNo: Number(market.totalNo || 0),
          k: Number(market.totalYes || 0) * Number(market.totalNo || 0),
        },
      },
    });
  } catch (error) {
    console.error('Order book API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
