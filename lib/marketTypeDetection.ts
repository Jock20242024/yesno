/**
 * 🚀 市场类型检测工具
 * 彻底分离工厂市场和独立市场的逻辑判断
 */

/**
 * 判断市场是否为工厂市场
 * 工厂市场：由自动化工厂生成的时间序列市场（15分钟、1小时等周期）
 */
export function isFactoryMarket(market: any): boolean {
  if (!market.templateId) return false;
  
  // templateId 以 manual- 或 poly- 开头的是独立市场，不是工厂市场
  if (typeof market.templateId === 'string') {
    if (market.templateId.startsWith('manual-')) return false;
    if (market.templateId.startsWith('poly-')) return false;
  }
  
  // 有 templateId 且不是 manual-/poly- 开头，且 period 存在 = 工厂市场
  return !!(market.period || market.isFactory);
}

/**
 * 判断市场是否为独立市场
 * 独立市场：手动创建、Polymarket 审核通过的市场，不受时间序列限制
 */
export function isIndependentMarket(market: any): boolean {
  // 没有 templateId = 独立市场
  if (!market.templateId) return true;
  
  // templateId 以 manual- 或 poly- 开头 = 独立市场
  if (typeof market.templateId === 'string') {
    if (market.templateId.startsWith('manual-')) return true;
    if (market.templateId.startsWith('poly-')) return true;
  }
  
  // 其他情况 = 工厂市场
  return false;
}

/**
 * 获取市场的聚合键（用于去重）
 * - 工厂市场：使用 templateId + period
 * - 独立市场：使用 market.id（每个都是唯一的）
 */
export function getMarketAggregationKey(market: any): string {
  if (isIndependentMarket(market)) {
    return `independent-${market.id}`;
  }
  
  // 工厂市场
  const period = market.period || '15';
  return `${market.templateId}-${period}`;
}
