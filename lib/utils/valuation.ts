/**
 * 持仓价值计算工具
 * 
 * 统一的持仓价格计算逻辑，确保所有 API 使用相同的算法
 */

/**
 * 计算持仓的当前价格
 * 
 * @param outcome 持仓方向 ('YES' | 'NO')
 * @param market 市场对象，必须包含 status, resolvedOutcome, totalYes, totalNo
 * @returns 持仓的当前价格（0.0 到 1.0 之间）
 * 
 * 核心逻辑：
 * - 如果市场已结算（RESOLVED）：赢家 = 1.0，输家 = 0.0
 * - 如果市场交易中（OPEN）或等待结果（CLOSED）：使用 AMM 价格
 */
export function calculatePositionPrice(
  outcome: 'YES' | 'NO',
  market: {
    status: string;
    resolvedOutcome?: string | null;
    totalYes: number;
    totalNo: number;
  }
): number {
  // 1. 处理已结算市场（RESOLVED）
  if (market.status === 'RESOLVED' && market.resolvedOutcome) {
    // 赢家：持仓方向与结算结果一致，价格为 1.0（完全兑现）
    // 输家：持仓方向与结算结果不一致，价格为 0.0（完全归零）
    return outcome === market.resolvedOutcome ? 1.0 : 0.0;
  }

  // 2. 处理交易中（OPEN）或等待结果（CLOSED）的市场
  // 🔥 重要：对于 CLOSED 状态，必须维持最后成交价，绝不能归零
  // 否则用户资产会暴跌（因为 CLOSED 状态通常发生在结算之前，市场已关闭但结果尚未确定）
  const totalVolume = (market.totalYes || 0) + (market.totalNo || 0);
  
  // 如果总交易量为 0，返回默认价格 0.5
  if (totalVolume === 0) {
    return 0.5;
  }

  // 使用 AMM 公式计算价格
  return outcome === 'YES'
    ? market.totalYes / totalVolume
    : market.totalNo / totalVolume;
}

/**
 * 计算持仓的当前价值和盈亏
 * 
 * @param position 持仓对象，必须包含 shares, avgPrice, outcome
 * @param market 市场对象，必须包含 status, resolvedOutcome, totalYes, totalNo
 * @returns 包含 currentPrice, currentValue, costBasis, profitLoss, profitLossPercent 的对象
 */
export function calculatePositionValue(
  position: {
    shares: number;
    avgPrice: number;
    outcome: 'YES' | 'NO';
  },
  market: {
    status: string;
    resolvedOutcome?: string | null;
    totalYes: number;
    totalNo: number;
  }
): {
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  profitLoss: number;
  profitLossPercent: number;
} {
  // 计算当前价格
  const currentPrice = calculatePositionPrice(position.outcome, market);

  // 计算当前价值
  const currentValue = position.shares * currentPrice;

  // 计算成本基础
  const costBasis = position.shares * position.avgPrice;

  // 计算盈亏
  const profitLoss = currentValue - costBasis;

  // 计算盈亏百分比
  const profitLossPercent = costBasis > 0 ? (profitLoss / costBasis) * 100 : 0;

  return {
    currentPrice,
    currentValue,
    costBasis,
    profitLoss,
    profitLossPercent,
  };
}
