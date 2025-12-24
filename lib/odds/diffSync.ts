/**
 * 差分同步模块
 * 
 * 功能：比对缓存值，仅在价格变化 > 0.001 时才返回 true
 * 用于过滤无效的数据库更新请求
 */

import { getRedisClient } from '@/lib/redis';

const PRICE_CHANGE_THRESHOLD = 0.001; // 价格变化阈值
const CACHE_TTL = 3600; // 缓存过期时间（秒）- 1小时

/**
 * 计算价格的哈希键
 */
function getPriceCacheKey(marketId: string): string {
  return `odds:price:${marketId}`;
}

/**
 * 从 outcomePrices 中提取第一个价格值
 */
function extractPrice(outcomePrices: string | null): number | null {
  if (!outcomePrices) {
    return null;
  }

  try {
    const prices = JSON.parse(outcomePrices);
    if (Array.isArray(prices) && prices.length > 0) {
      const price = parseFloat(prices[0]);
      return isNaN(price) ? null : price;
    }
  } catch (error) {
    // 解析失败，返回 null
  }

  return null;
}

/**
 * 检查价格是否有显著变化
 * 
 * @param marketId 市场 ID
 * @param newOutcomePrices 新的 outcomePrices 值
 * @returns 如果价格变化 > 阈值，返回 true 和新的价格；否则返回 false
 */
export async function hasSignificantPriceChange(
  marketId: string,
  newOutcomePrices: string | null
): Promise<{ changed: boolean; newPrice: number | null; oldPrice: number | null }> {
  const redis = getRedisClient();
  const cacheKey = getPriceCacheKey(marketId);

  try {
    // 提取新价格
    const newPrice = extractPrice(newOutcomePrices);

    // 如果没有新价格，认为没有变化
    if (newPrice === null) {
      return { changed: false, newPrice: null, oldPrice: null };
    }

    // 从缓存中获取旧价格
    const cachedPriceStr = await redis.get(cacheKey);
    const oldPrice = cachedPriceStr ? parseFloat(cachedPriceStr) : null;

    // 如果没有旧价格，认为有变化（首次同步）
    if (oldPrice === null || isNaN(oldPrice)) {
      // 缓存新价格
      await redis.setex(cacheKey, CACHE_TTL, newPrice.toString());
      return { changed: true, newPrice, oldPrice: null };
    }

    // 计算价格变化
    const priceDiff = Math.abs(newPrice - oldPrice);

    // 如果价格变化超过阈值，更新缓存并返回 true
    if (priceDiff > PRICE_CHANGE_THRESHOLD) {
      await redis.setex(cacheKey, CACHE_TTL, newPrice.toString());
      return { changed: true, newPrice, oldPrice };
    }

    // 价格变化未超过阈值，返回 false
    return { changed: false, newPrice, oldPrice };
  } catch (error) {
    console.error(`❌ [DiffSync] 检查价格变化失败 (marketId: ${marketId}):`, error);
    // 发生错误时，为了安全起见，认为有变化
    return { changed: true, newPrice: extractPrice(newOutcomePrices), oldPrice: null };
  }
}

/**
 * 批量检查多个市场的价格变化
 * 
 * @param markets 市场数据数组
 * @returns 返回需要更新的市场列表
 */
export async function filterMarketsByPriceChange(
  markets: Array<{ id: string; outcomePrices: string | null }>
): Promise<Array<{ id: string; outcomePrices: string | null; newPrice: number; oldPrice: number | null }>> {
  const results = await Promise.all(
    markets.map(async (market) => {
      const changeResult = await hasSignificantPriceChange(market.id, market.outcomePrices);
      return {
        market,
        changeResult,
      };
    })
  );

  // 只返回有显著价格变化的市场
  return results
    .filter(({ changeResult }) => changeResult.changed && changeResult.newPrice !== null)
    .map(({ market, changeResult }) => ({
      id: market.id,
      outcomePrices: market.outcomePrices,
      newPrice: changeResult.newPrice!,
      oldPrice: changeResult.oldPrice,
    }));
}

/**
 * 清除某个市场的价格缓存
 */
export async function clearPriceCache(marketId: string): Promise<void> {
  const redis = getRedisClient();
  const cacheKey = getPriceCacheKey(marketId);
  await redis.del(cacheKey);
}

/**
 * 获取差分命中率统计
 * 
 * @param totalChecked 总共检查的市场数量
 * @param filteredOut 被过滤掉的市场数量（无显著变化）
 * @returns 差分命中率（百分比）
 */
export function calculateDiffHitRate(totalChecked: number, filteredOut: number): number {
  if (totalChecked === 0) {
    return 0;
  }
  return Math.round((filteredOut / totalChecked) * 100);
}
