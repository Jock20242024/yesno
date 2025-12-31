import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 🔥 强制动态：确保每次请求都获取最新数据
export const dynamic = 'force-dynamic';

/**
 * 获取市场历史价格数据
 * GET /api/markets/[market_id]/history
 * 
 * 返回该市场的历史价格数据点，用于绘制 K 线图
 * 数据来源：Order 表中的已成交订单（FILLED 或 PARTIALLY_FILLED）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ market_id: string }> }
) {
  try {
    const { market_id } = await params;

    if (!market_id || market_id.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Market ID is required',
        },
        { status: 400 }
      );
    }

    // 1. 验证市场是否存在
    const market = await prisma.market.findUnique({
      where: { id: market_id },
      select: {
        id: true,
        totalYes: true,
        totalNo: true,
        createdAt: true,
        closingDate: true,
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

    // 2. 查询该市场的所有已成交订单（按时间排序）
    // 只查询 FILLED 或 PARTIALLY_FILLED 的订单，因为这些订单有实际的成交价格
    // 🔥 同时关联 Position 表，获取更准确的成交价格（avgPrice）
    const orders = await prisma.order.findMany({
      where: {
        marketId: market_id,
        status: {
          in: ['FILLED', 'PARTIALLY_FILLED'],
        },
      },
      select: {
        id: true,
        userId: true,
        outcomeSelection: true,
        amount: true,
        filledAmount: true,
        createdAt: true,
        limitPrice: true,
        orderType: true,
      },
      orderBy: {
        createdAt: 'asc', // 按时间升序排列
      },
    });

    // 🔥 批量查询对应的 Position 记录，获取成交价格（avgPrice）
    // 优化：使用批量查询避免 N+1 问题
    const userIds = [...new Set(orders.map(o => o.userId))];
    const positions = await prisma.position.findMany({
      where: {
        userId: { in: userIds },
        marketId: market_id,
        status: 'OPEN',
      },
      select: {
        userId: true,
        outcome: true,
        avgPrice: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // 按时间升序，便于匹配
      },
    });

    // 构建 Position 映射：userId + outcome -> 按时间排序的 avgPrice 列表
    const positionMap = new Map<string, Array<{ avgPrice: number; createdAt: Date }>>();
    for (const pos of positions) {
      const key = `${pos.userId}_${pos.outcome}`;
      if (!positionMap.has(key)) {
        positionMap.set(key, []);
      }
      positionMap.get(key)!.push({ avgPrice: pos.avgPrice, createdAt: pos.createdAt });
    }

    // 为每个订单匹配对应的 avgPrice（查找时间最接近的 Position）
    const orderPriceMap = new Map<string, number>(); // orderId -> avgPrice
    for (const order of orders) {
      const key = `${order.userId}_${order.outcomeSelection}`;
      const posList = positionMap.get(key);
      
      if (posList && posList.length > 0) {
        // 找到时间最接近订单创建时间的 Position
        const orderTime = order.createdAt.getTime();
        let closestPos = posList[0];
        let minTimeDiff = Math.abs(posList[0].createdAt.getTime() - orderTime);
        
        for (const pos of posList) {
          const timeDiff = Math.abs(pos.createdAt.getTime() - orderTime);
          if (timeDiff < minTimeDiff) {
            minTimeDiff = timeDiff;
            closestPos = pos;
          }
        }
        
        // 如果时间差在 10 秒内，认为是该订单创建的 Position
        if (minTimeDiff < 10000) {
          orderPriceMap.set(order.id, closestPos.avgPrice);
        }
      }
    }

    // 3. 如果没有订单，返回空数组或基于市场创建时间的初始数据点
    if (orders.length === 0) {
      const marketStartTime = market.createdAt.getTime();
      const now = Date.now();
      
      // 返回一个初始数据点（50% 价格）
      return NextResponse.json({
        success: true,
        data: [
          {
            time: new Date(marketStartTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            value: 0.5, // 默认 50%
            timestamp: marketStartTime,
          },
          {
            time: new Date(now).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
            value: 0.5, // 默认 50%
            timestamp: now,
          },
        ],
      });
    }

    // 4. 计算每个订单时刻的市场价格
    // 策略：按时间顺序遍历订单，累加 totalYes 和 totalNo，计算每个时刻的价格
    let cumulativeYes = 0;
    let cumulativeNo = 0;
    const priceHistory: Array<{
      time: string;
      value: number;
      timestamp: number;
    }> = [];

    // 添加市场创建时的初始点（50%）
    const marketStartTime = market.createdAt.getTime();
    priceHistory.push({
      time: new Date(marketStartTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      value: 0.5,
      timestamp: marketStartTime,
    });

    // 遍历订单，计算每个订单成交后的价格
    for (const order of orders) {
      // 🔥 优先使用 Position 的 avgPrice（最准确的成交价）
      let executionPrice = orderPriceMap.get(order.id);
      
      if (executionPrice !== undefined && executionPrice > 0 && executionPrice <= 1) {
        // 使用 Position 的 avgPrice（最准确）
        // 🔥 仍然需要更新累积流动性，以便后续订单的价格计算更准确
        const netInvest = order.filledAmount > 0 ? order.filledAmount : order.amount;
        if (order.outcomeSelection === 'YES') {
          cumulativeYes += netInvest;
        } else if (order.outcomeSelection === 'NO') {
          cumulativeNo += netInvest;
        }
      } else if (order.orderType === 'LIMIT' && order.limitPrice && order.limitPrice > 0) {
        // 限价单：使用限价作为成交价
        executionPrice = order.limitPrice;
        // 🔥 更新累积流动性
        const netInvest = order.filledAmount > 0 ? order.filledAmount : order.amount;
        if (order.outcomeSelection === 'YES') {
          cumulativeYes += netInvest;
        } else if (order.outcomeSelection === 'NO') {
          cumulativeNo += netInvest;
        }
      } else {
        // 市价单：使用 AMM 公式计算成交价（兜底方案）
        // 在订单成交前，计算当前价格
        const totalBefore = cumulativeYes + cumulativeNo;
        
        // 模拟订单成交：根据 outcomeSelection 增加对应的流动性
        const netInvest = order.filledAmount > 0 ? order.filledAmount : order.amount;
        
        if (order.outcomeSelection === 'YES') {
          cumulativeYes += netInvest;
        } else if (order.outcomeSelection === 'NO') {
          cumulativeNo += netInvest;
        }
        
        // 计算成交后的价格
        const totalAfter = cumulativeYes + cumulativeNo;
        executionPrice = totalAfter > 0 ? cumulativeYes / totalAfter : 0.5;
      }

      // 确保价格在有效范围内
      if (executionPrice === undefined || executionPrice < 0 || executionPrice > 1) {
        executionPrice = 0.5; // 默认价格
      }

      // 添加价格数据点
      const orderTime = order.createdAt.getTime();
      priceHistory.push({
        time: new Date(orderTime).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        value: executionPrice,
        timestamp: orderTime,
      });
    }

    // 5. 如果数据点太少（少于 2 个），补充一些中间点以平滑曲线
    if (priceHistory.length < 10) {
      // 在最后一个数据点和当前时间之间补充点
      const lastPoint = priceHistory[priceHistory.length - 1];
      const now = Date.now();
      const timeDiff = now - lastPoint.timestamp;
      
      if (timeDiff > 60 * 60 * 1000) { // 如果距离现在超过 1 小时
        // 补充当前时间的点（使用当前市场价格）
        const currentTotal = market.totalYes + market.totalNo;
        const currentPrice = currentTotal > 0 ? market.totalYes / currentTotal : 0.5;
        
        priceHistory.push({
          time: new Date(now).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          value: currentPrice,
          timestamp: now,
        });
      }
    }

    // 6. 限制数据点数量（最多返回 100 个点，避免前端渲染压力）
    const maxPoints = 100;
    let finalData = priceHistory;
    
    if (priceHistory.length > maxPoints) {
      // 如果数据点太多，进行采样（保留首尾和中间的关键点）
      const step = Math.floor(priceHistory.length / maxPoints);
      finalData = [];
      
      for (let i = 0; i < priceHistory.length; i += step) {
        finalData.push(priceHistory[i]);
      }
      
      // 确保最后一个点被包含
      if (finalData[finalData.length - 1].timestamp !== priceHistory[priceHistory.length - 1].timestamp) {
        finalData.push(priceHistory[priceHistory.length - 1]);
      }
    }

    return NextResponse.json({
      success: true,
      data: finalData,
    });
  } catch (error) {
    console.error('❌ [Market History API] 获取历史价格失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch market history',
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 }
    );
  }
}

