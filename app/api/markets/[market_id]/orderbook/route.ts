import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const market = await prisma.market.findUnique({
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
    const pendingOrders = await prisma.order.findMany({
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

      // 计算剩余数量（shares）
      const remainingAmount = order.amount - (order.filledAmount || 0);
      const remainingQuantity = remainingAmount / limitPrice; // shares = amount / price

      if (remainingQuantity <= 0) {
        continue; // 跳过已完全成交的订单
      }

      // 根据 outcomeSelection 分类到买单或卖单
      if (order.outcomeSelection === 'YES') {
        // 买单（Bids）：购买 YES
        const existing = bidMap.get(limitPrice);
        if (existing) {
          existing.quantity += remainingQuantity;
          existing.total += remainingAmount;
          existing.orderCount += 1;
        } else {
          bidMap.set(limitPrice, {
            price: limitPrice,
            quantity: remainingQuantity,
            total: remainingAmount,
            orderCount: 1,
          });
        }
      } else if (order.outcomeSelection === 'NO') {
        // 卖单（Asks）：卖出 NO（相当于买入 YES 的反向操作）
        // 对于 NO 订单，我们需要将其转换为 YES 卖出价格
        // NO 价格 + YES 价格 = 1，所以 YES 卖出价格 = 1 - NO 价格
        const yesSellPrice = 1 - limitPrice;
        
        const existing = askMap.get(yesSellPrice);
        if (existing) {
          existing.quantity += remainingQuantity;
          existing.total += remainingAmount;
          existing.orderCount += 1;
        } else {
          askMap.set(yesSellPrice, {
            price: yesSellPrice,
            quantity: remainingQuantity,
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

    return NextResponse.json({
      success: true,
      data: {
        asks, // 卖单列表（按价格从低到高）
        bids, // 买单列表（按价格从高到低）
        spread,
        currentPrice,
        marketId: market_id,
        totalBids: bids.reduce((sum, bid) => sum + bid.quantity, 0),
        totalAsks: asks.reduce((sum, ask) => sum + ask.quantity, 0),
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
