/**
 * 🔥 混合流动性撮合引擎（Orderbook + AMM Hybrid）
 * 
 * 核心功能：
 * 1. 用户限价单优先撮合（用户对用户）
 * 2. AMM虚拟订单承接剩余部分（用户对全域流动性）
 * 3. Delta中性对冲（YES+NO组合包）
 * 4. CPMM恒定乘积公式
 */

import { prisma } from '@/lib/prisma';
import { Outcome } from '@/types/data';
import { randomUUID } from 'crypto';

/**
 * CPMM（恒定乘积做市商）价格计算
 * 
 * 公式：K = totalYes * totalNo（恒定）
 * 价格：price = totalYes / (totalYes + totalNo)
 * 
 * @param totalYes YES池总量
 * @param totalNo NO池总量
 * @param outcome 要买入的选项
 * @param amount 买入金额（扣除手续费后）
 * @returns { shares: 获得的份额, newTotalYes: 新的YES总量, newTotalNo: 新的NO总量, executionPrice: 成交价格 }
 */
export function calculateCPMMPrice(
  totalYes: number,
  totalNo: number,
  outcome: Outcome,
  amount: number
): {
  shares: number;
  newTotalYes: number;
  newTotalNo: number;
  executionPrice: number;
  k: number;
} {
  // 🔥 空池处理：如果池子为空，使用默认价格 0.5
  if (totalYes <= 0 && totalNo <= 0) {
    totalYes = 1000; // 默认初始值
    totalNo = 1000;
  }

  // 计算恒定乘积 K
  const k = totalYes * totalNo;

  // 计算当前价格
  const totalLiquidity = totalYes + totalNo;
  const currentPrice = totalLiquidity > 0 ? (outcome === Outcome.YES ? totalYes / totalLiquidity : totalNo / totalLiquidity) : 0.5;

  // 🔥 Delta中性对冲：系统注入的流动性以YES+NO组合包形式存在
  // 当用户买入YES时，系统不是"卖出"YES，而是将(YES+NO)组合包拆开
  // 把YES给用户，自己持有NO，保持资产总值锁定

  let newTotalYes = totalYes;
  let newTotalNo = totalNo;
  let shares = 0;

  // 🔥 Delta中性对冲：系统注入的流动性以YES+NO组合包形式存在
  // 当用户买入时，系统拆开组合包，给用户对应选项，自己持有相反选项
  // 保持K值恒定：K = totalYes * totalNo
  
  if (outcome === Outcome.YES) {
    // 用户买入YES：系统拆开组合包，给用户YES，自己持有NO
    // 用户投入 amount，获得 shares 份 YES
    // 根据CPMM：K = totalYes * totalNo = (totalYes - shares) * (totalNo + amount)
    // 解方程：K = (totalYes - shares) * (totalNo + amount)
    // shares = totalYes - K / (totalNo + amount)
    
    const newTotalNoAfter = totalNo + amount;
    if (newTotalNoAfter > 0 && k > 0) {
      shares = totalYes - (k / newTotalNoAfter);
      
      // 确保shares为正数且不超过totalYes
      if (shares <= 0 || shares > totalYes || !isFinite(shares)) {
        // 如果计算出的shares无效，使用简化公式（基于当前价格）
        shares = amount / Math.max(0.01, currentPrice);
        newTotalYes = Math.max(0, totalYes - shares);
        newTotalNo = newTotalNoAfter;
      } else {
        newTotalYes = totalYes - shares;
        newTotalNo = newTotalNoAfter;
      }
    } else {
      // 空池或K=0，使用简化公式
      shares = amount / Math.max(0.01, currentPrice);
      newTotalYes = Math.max(0, totalYes - shares);
      newTotalNo = totalNo + amount;
    }
  } else {
    // 用户买入NO：系统拆开组合包，给用户NO，自己持有YES
    // 用户投入 amount，获得 shares 份 NO
    // 根据CPMM：K = totalYes * totalNo = (totalYes + amount) * (totalNo - shares)
    // 解方程：K = (totalYes + amount) * (totalNo - shares)
    // shares = totalNo - K / (totalYes + amount)
    
    const newTotalYesAfter = totalYes + amount;
    if (newTotalYesAfter > 0 && k > 0) {
      shares = totalNo - (k / newTotalYesAfter);
      
      // 确保shares为正数且不超过totalNo
      if (shares <= 0 || shares > totalNo || !isFinite(shares)) {
        // 如果计算出的shares无效，使用简化公式（基于当前价格）
        shares = amount / Math.max(0.01, currentPrice);
        newTotalYes = newTotalYesAfter;
        newTotalNo = Math.max(0, totalNo - shares);
      } else {
        newTotalYes = newTotalYesAfter;
        newTotalNo = totalNo - shares;
      }
    } else {
      // 空池或K=0，使用简化公式
      shares = amount / Math.max(0.01, currentPrice);
      newTotalYes = totalYes + amount;
      newTotalNo = Math.max(0, totalNo - shares);
    }
  }

  // 计算实际成交价格
  const executionPrice = shares > 0 ? amount / shares : currentPrice;

  // 验证K值保持不变（允许小的浮点误差）
  const newK = newTotalYes * newTotalNo;
  const kDiff = Math.abs(newK - k);
  if (kDiff > 0.01 && k > 0) {
    console.warn(`⚠️ [CPMM] K值变化超过0.01: 原始K=${k}, 新K=${newK}, 差值=${kDiff}`);
  }

  // 🔥 修复：限制shares精度，避免3333333等无限小数
  const roundedShares = Math.round(shares * 10000) / 10000; // 保留4位小数
  
  return {
    shares: Math.max(0, roundedShares),
    newTotalYes: Math.max(0, newTotalYes),
    newTotalNo: Math.max(0, newTotalNo),
    executionPrice: Math.max(0.01, Math.min(0.99, executionPrice)),
    k: newK,
  };
}

/**
 * 混合撮合函数
 * 
 * 优先级：
 * 1. 用户限价单（用户对用户）
 * 2. AMM虚拟订单（用户对全域流动性）
 * 
 * @param marketId 市场ID
 * @param userId 用户ID
 * @param outcome 买入选项
 * @param amount 买入金额（扣除手续费后）
 * @param limitPrice 限价（可选，如果提供则优先撮合限价单）
 * @returns 撮合结果
 */
export async function matchOrder(
  marketId: string,
  userId: string,
  outcome: Outcome,
  amount: number,
  limitPrice?: number
): Promise<{
  matchedWithUsers: number; // 与用户订单成交的金额
  matchedWithAMM: number;    // 与AMM成交的金额
  totalShares: number;       // 总获得的份额
  executionPrice: number;    // 平均成交价格
}> {
  // 🔥 第一步：尝试与用户限价单撮合
  let remainingAmount = amount;
  let matchedWithUsers = 0;
  let totalShares = 0;
  let totalCost = 0;

  if (limitPrice !== undefined) {
    // 查找匹配的限价单（价格 <= limitPrice 且方向相反）
    const oppositeOutcome = outcome === Outcome.YES ? Outcome.NO : Outcome.YES;
    const matchingOrders = await prisma.orders.findMany({
      where: {
        marketId,
        outcomeSelection: oppositeOutcome,
        orderType: 'LIMIT',
        status: 'PENDING',
        limitPrice: {
          lte: limitPrice, // 限价单价格 <= 用户限价
        },
      },
      orderBy: {
        limitPrice: 'asc', // 价格最优者先成交
      },
      take: 10, // 限制查询数量
    });

    // 撮合限价单
    for (const order of matchingOrders) {
      if (remainingAmount <= 0) break;

      const orderAmount = order.amount - (order.feeDeducted || 0);
      const matchedAmount = Math.min(remainingAmount, orderAmount);
      const matchedShares = matchedAmount / (order.limitPrice || 1);

      matchedWithUsers += matchedAmount;
      totalShares += matchedShares;
      totalCost += matchedAmount;
      remainingAmount -= matchedAmount;

      // 更新订单状态（在事务中处理）
      // 这里只计算，实际更新在调用方的事务中完成
    }
  }

  // 🔥 第二步：剩余部分与AMM撮合
  let matchedWithAMM = 0;

  if (remainingAmount > 0) {
    // 获取市场当前状态
    const market = await prisma.markets.findUnique({
      where: { id: marketId },
      select: {
        totalYes: true,
        totalNo: true,
        ammK: true,
      },
    });

    if (market) {
      const currentTotalYes = Number(market.totalYes || 0);
      const currentTotalNo = Number(market.totalNo || 0);
      
      // 使用CPMM计算价格和份额
      const cpmmResult = calculateCPMMPrice(
        currentTotalYes,
        currentTotalNo,
        outcome,
        remainingAmount
      );

      matchedWithAMM = remainingAmount;
      totalShares += cpmmResult.shares;
      totalCost += remainingAmount;
    }
  }

  // 计算平均成交价格
  const executionPrice = totalShares > 0 ? totalCost / totalShares : 0.5;

  return {
    matchedWithUsers,
    matchedWithAMM,
    totalShares,
    executionPrice,
  };
}

/**
 * 计算AMM可成交深度
 * 
 * @param totalYes YES池总量
 * @param totalNo NO池总量
 * @param priceLevels 价格档位数组（0.1, 0.2, ..., 0.9）
 * @returns 每个价格档位的可成交深度
 */
export function calculateAMMDepth(
  totalYes: number,
  totalNo: number,
  priceLevels: number[] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
): Array<{ price: number; depth: number; outcome: Outcome }> {
  const depth: Array<{ price: number; depth: number; outcome: Outcome }> = [];

  for (const price of priceLevels) {
    // 🔥 修复：计算在该价格下可以买入多少份额
    // 使用固定测试金额计算深度，但total应该基于实际可成交金额
    const testAmount = 100; // 测试金额
    const outcome = price <= 0.5 ? Outcome.NO : Outcome.YES;
    
    try {
      const result = calculateCPMMPrice(totalYes, totalNo, outcome, testAmount);
      // 计算在该价格下可以买入的份额数
      const sharesAtPrice = testAmount / price;
      // total应该是实际可成交金额，而不是固定的100
      const actualTotal = sharesAtPrice * price;
      depth.push({ 
        price, 
        depth: sharesAtPrice, // 深度是份额数
        outcome 
      });
    } catch (error) {
      depth.push({ price, depth: 0, outcome });
    }
  }

  return depth;
}

