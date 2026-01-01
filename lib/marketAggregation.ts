/**
 * 🔥 市场聚合工具函数
 * 核心原则：
 * - 工厂市场：按 templateId+period 聚合，进行时间过滤
 * - 独立市场：每个都是唯一展示项，不进行时间过滤
 */

import dayjs from '@/lib/dayjs';
import { isFactoryMarket, isIndependentMarket, getMarketAggregationKey } from './marketTypeDetection';

/**
 * 🔥 聚合工厂市场：根据 templateId + period 去重，只返回当前活跃或即将开始的第一个场次
 * 规则（仅适用于工厂市场）：
 * 1. 分组维度：templateId + period
 * 2. 优先返回当前正在进行中的场次（Active）
 * 3. 如果没有活跃的，返回即将开始的第一个场次（Upcoming，按 startTime 排序）
 * 4. 过滤掉已结束的和太遥远的场次（超过24小时未开始的）
 */
export function aggregateFactoryMarkets(markets: any[]): any[] {
  const now = dayjs.utc();
  const aggregatedMap = new Map<string, any>();
  
  markets.forEach(m => {
    // 🚀 只处理工厂市场
    if (!isFactoryMarket(m)) {
      return; // 独立市场不参与此聚合
    }
    
    const key = getMarketAggregationKey(m);
    const period = Number(m.period) || 15;
    const endTime = dayjs.utc(m.closingDate);
    const startTime = endTime.subtract(period, 'minute');
    
    // 判断场次状态
    const isActive = m.status === 'OPEN' && 
      now.isSameOrAfter(startTime) && 
      now.isBefore(endTime);
    
    const isUpcoming = m.status === 'OPEN' && 
      now.isBefore(startTime);
    
    const isEnded = m.status !== 'OPEN' || now.isAfter(endTime);
    
    // 工厂市场时间过滤：过滤掉已结束的和太遥远的场次（超过24小时未开始的）
    const hoursUntilStart = startTime.diff(now, 'hour');
    if (isEnded || hoursUntilStart > 24) {
      return; // 跳过这个场次
    }
    
    // 如果这个 key 已经存在，检查优先级
    if (aggregatedMap.has(key)) {
      const existing = aggregatedMap.get(key)!;
      const existingPeriod = Number(existing.period) || 15;
      const existingEndTime = dayjs.utc(existing.closingDate);
      const existingStartTime = existingEndTime.subtract(existingPeriod, 'minute');
      const existingIsActive = existing.status === 'OPEN' && 
        now.isSameOrAfter(existingStartTime) && 
        now.isBefore(existingEndTime);
      const existingIsUpcoming = existing.status === 'OPEN' && 
        now.isBefore(existingStartTime);
      
      // 🔥 优先级：Active > Upcoming（按 startTime 排序，选择最近的）> 其他
      if (isActive && !existingIsActive) {
        // 当前是活跃的，已存在的不是，替换
        aggregatedMap.set(key, m);
      } else if (!isActive && existingIsActive) {
        // 当前不是活跃的，已存在的是，保留已存在的
        // 不做任何操作
      } else if (isUpcoming && existingIsUpcoming) {
        // 都是即将开始的，选择 startTime 更早的（更接近现在）
        if (startTime.isBefore(existingStartTime)) {
          aggregatedMap.set(key, m);
        }
      } else if (isUpcoming && !existingIsActive && !existingIsUpcoming) {
        // 当前是即将开始的，已存在的既不是活跃也不是即将开始，替换
        aggregatedMap.set(key, m);
      }
    } else {
      // 新 key，直接添加
      aggregatedMap.set(key, m);
    }
  });
  
  return Array.from(aggregatedMap.values());
}

/**
 * 🔥 聚合市场：分离工厂市场和独立市场，分别处理
 * - 工厂市场：进行聚合和时间过滤
 * - 独立市场：直接返回，不进行任何过滤
 * 
 * 🚀 架构原则：
 * 1. 工厂市场：由自动化工厂生成，有时间序列特性，需要聚合和时间过滤
 * 2. 独立市场：手动创建或审核通过，每个都是独立的展示项，不参与聚合
 */
export function aggregateMarketsByTemplate(markets: any[]): any[] {
  // 🚀 物理防御：首先过滤掉 isActive=false 的市场
  const activeMarkets = markets.filter(m => {
    const isActive = (m as any).isActive !== false;
    if (!isActive) {
      console.warn(`🚨 [Aggregation] 发现 isActive=false 的市场，已过滤: ${m.id}`);
    }
    return isActive;
  });
  
  // 🚀 彻底分离：工厂市场和独立市场
  const factoryMarkets = activeMarkets.filter(m => isFactoryMarket(m));
  const independentMarkets = activeMarkets.filter(m => isIndependentMarket(m));

  // 工厂市场：进行聚合和时间过滤
  const aggregatedFactory = aggregateFactoryMarkets(factoryMarkets);
  
  // 独立市场：直接返回，不进行任何过滤
  // 每个独立市场都是唯一的展示项
  
  // 合并结果：工厂市场（聚合后）+ 独立市场（原始）
  const result = [...aggregatedFactory, ...independentMarkets];

  return result;
}

/**
 * 🔥 计算基于 templateId 去重的市场数量
 * 用于后台统计，确保统计数字反映的是"有效项目数"（唯一系列数），而不是记录总数
 * 
 * 🚀 架构原则：
 * - 工厂市场：使用 templateId + period 去重
 * - 独立市场：每个市场单独计算（不会合并）
 */
export function countUniqueMarketSeries(markets: any[]): number {
  const factoryKeys = new Set<string>();
  let independentCount = 0;
  
  markets.forEach(m => {
    if (isIndependentMarket(m)) {
      // 独立市场：每个市场单独计算
      independentCount++;
    } else if (isFactoryMarket(m)) {
      // 工厂市场：使用 templateId + period 作为唯一键
      const key = getMarketAggregationKey(m);
      factoryKeys.add(key);
    }
  });
  
  return factoryKeys.size + independentCount;
}
