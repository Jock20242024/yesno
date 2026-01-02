/**
 * Polymarket 采集适配器
 * 实现 ScraperEngine 接口，专门对接 Polymarket Gamma API
 */

import { ScraperEngine, ScrapeResult } from './engine';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

import { translateText } from './translateService';

// Polymarket API 返回的是 market 对象数组
export interface PolymarketMarket {
  id: string;
  question?: string;
  title?: string;
  description?: string;
  slug?: string;
  startDate?: string;
  startDateIso?: string;
  endDate?: string;
  endDateIso?: string;
  image?: string;
  icon?: string;
  outcomePrices?: string | string[]; // JSON 字符串或数组，如 "[\"0.7\", \"0.3\"]" 或 ["0.7", "0.3"]
  volume?: string; // 交易量字符串
  volumeNum?: number; // 交易量数字
  active_volume?: string; // 活跃交易量（备用）
  liquidity?: string;
  liquidityNum?: number;
  closed?: boolean;
  tags?: string[]; // 可能不存在，但保留以兼容
  // events 字段：某些 market 可能包含 events 数组，events[0] 可能有 markets 数组
  events?: Array<{
    markets?: PolymarketMarket[];
    volume?: string;
    volumeNum?: number;
    active_volume?: string;
  }>;
}

/**
 * 从市场标题中提取周期（分钟）
 * 例如："BTC 15min" -> 15, "ETH 1h" -> 60, "BTC 1d" -> 1440
 */
function extractPeriodFromTitle(text: string): number | null {
  const lowerText = text.toLowerCase();
  
  // 匹配 15min, 30min, 60min 等
  const minMatch = lowerText.match(/(\d+)\s*min/i);
  if (minMatch) {
    return parseInt(minMatch[1]);
  }
  
  // 匹配 1h, 2h, 24h 等
  const hourMatch = lowerText.match(/(\d+)\s*h/i);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 60;
  }
  
  // 匹配 1d, 2d 等
  const dayMatch = lowerText.match(/(\d+)\s*d/i);
  if (dayMatch) {
    return parseInt(dayMatch[1]) * 1440;
  }
  
  return null;
}

/**
 * 从标题中提取资产符号（支持多种加密资产）
 * 改进：使用单词边界匹配，避免误匹配（如"Canada"不匹配"ADA"）
 */
function extractSymbolFromTitle(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // 常见加密资产映射（按优先级排序，避免误匹配）
  // 使用单词边界确保精确匹配
  const assetMappings: Array<[RegExp[], string]> = [
    [[/\bbtc\b/i, /\bbitcoin\b/i], 'BTC/USD'],
    [[/\beth\b/i, /\bethereum\b/i], 'ETH/USD'],
    [[/\bsol\b/i, /\bsolana\b/i], 'SOL/USD'],
    [[/\blink\b/i, /\bchainlink\b/i], 'LINK/USD'],
    [[/\bdoge\b/i, /\bdogecoin\b/i], 'DOGE/USD'],
    [[/\bavax\b/i, /\bavalanche\b/i], 'AVAX/USD'],
    [[/\bada\b/i, /\bcardano\b/i], 'ADA/USD'],
    [[/\bdot\b/i, /\bpolkadot\b/i], 'DOT/USD'],
    [[/\bmatic\b/i, /\bpolygon\b/i], 'MATIC/USD'],
    [[/\bxrp\b/i, /\bripple\b/i], 'XRP/USD'],
    [[/\bbnb\b/i], 'BNB/USD'], // 注意：不要匹配"binance"因为它可能在"Airbnb"中出现
    [[/\btrx\b/i, /\btron\b/i], 'TRX/USD'],
    [[/\bltc\b/i, /\blitecoin\b/i], 'LTC/USD'],
    [[/\bbch\b/i, /\bbitcoin\s+cash\b/i], 'BCH/USD'],
    [[/\bxlm\b/i, /\bstellar\b/i], 'XLM/USD'],
    [[/\balgo\b/i, /\balgorand\b/i], 'ALGO/USD'],
    [[/\batom\b/i, /\bcosmos\b/i], 'ATOM/USD'],
    [[/\bfil\b/i, /\bfilecoin\b/i], 'FIL/USD'],
    [[/\bnear\b/i], 'NEAR/USD'],
    [[/\bftm\b/i, /\bfantom\b/i], 'FTM/USD'],
  ];
  
  for (const [patterns, symbol] of assetMappings) {
    // 检查是否匹配任何模式（使用单词边界）
    const matched = patterns.some(pattern => pattern.test(lowerText));
    
    if (matched) {
      return symbol;
    }
  }
  
  return null;
}

/**
 * 将 Polymarket 分类映射到本地分类（基于标签和标题）
 */
function mapPolymarketCategory(tags: string[] = [], title: string = ''): string | null {
  const lowerTitle = title.toLowerCase();
  
  // 标签匹配
  const categoryMap: Record<string, string> = {
    'crypto': 'crypto',
    'cryptocurrency': 'crypto',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'politics': 'politics',
    'political': 'politics',
    'election': 'politics',
    'sports': 'sports',
    'sport': 'sports',
    'nba': 'sports',
    'football': 'sports',
    'technology': 'technology',
    'tech': 'technology',
    'ai': 'technology',
    'finance': 'finance',
    'financial': 'finance',
    'stock': 'finance',
    'economy': 'finance',
  };

  for (const tag of tags) {
    const lowerTag = tag.toLowerCase();
    if (categoryMap[lowerTag]) {
      return categoryMap[lowerTag];
    }
  }

  // 标题关键词匹配
  const keywordMap: Record<string, string> = {
    'btc': 'crypto',
    'bitcoin': 'crypto',
    'ethereum': 'crypto',
    'eth': 'crypto',
    'crypto': 'crypto',
    'president': 'politics',
    'election': 'politics',
    'vote': 'politics',
    'nba': 'sports',
    'nfl': 'sports',
    'football': 'sports',
    'ai': 'technology',
    'tech': 'technology',
    'apple': 'technology',
    'stock': 'finance',
    'dow': 'finance',
    'sp500': 'finance',
  };

  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (lowerTitle.includes(keyword)) {
      return category;
    }
  }

  return null;
}

/**
 * Polymarket 采集适配器
 */
export class PolymarketAdapter extends ScraperEngine {
  private limit: number;

  constructor(limit: number = 1000) {
    // 🔥 强制全量抓取：将默认 limit 提高到 1000，确保抓取更多数据
    super('Polymarket');
    this.limit = limit;
  }

  /**
   * 从 Polymarket Gamma API 获取原始数据
   * 🔥 全量拉取模式：强制拉取所有活跃市场，不做时间过滤
   * 使用 order=volume 和 ascending=false 确保抓回来的是全网最火的
   */
  protected async fetch(): Promise<PolymarketMarket[]> {
    console.log(`🚀 [DEBUG] [fetch] 开始连接 Polymarket API...`);
    const fetchStartTime = Date.now();
    
    const url = new URL('https://gamma-api.polymarket.com/markets');
    
    // 🔥 强制全量拉取：只设置基本参数，绝对不包含任何时间过滤参数
    // ❌ 已删除：min_updated_at, after, since 等时间过滤参数
    url.searchParams.set('closed', 'false'); // 只获取活跃市场（未关闭的）
    url.searchParams.set('limit', this.limit.toString()); // 数量限制
    url.searchParams.set('offset', '0'); // 从第一条开始
    url.searchParams.set('order', 'volume'); // 按交易量排序
    url.searchParams.set('ascending', 'false'); // 降序，最火的在前

    const apiUrl = url.toString();
    console.log(`🔗 [DEBUG] [fetch] API URL: ${apiUrl}`);
    console.log(`🔗 [DEBUG] [fetch] 请求参数: limit=${this.limit}, closed=false`);

    try {
      // 🔥 容错降级：增加超时时间到 30 秒（适应国际网络延迟）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ [DEBUG] [fetch] API 请求超时（30秒），正在取消...`);
        controller.abort();
      }, 30000); // 30秒超时
      
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      };

      console.log(`📡 [DEBUG] [fetch] 发送 HTTP 请求...`);
      const requestStartTime = Date.now();
      const response = await fetch(apiUrl, fetchOptions);
      clearTimeout(timeoutId);
      const requestTime = Date.now() - requestStartTime;
      console.log(`✅ [DEBUG] [fetch] HTTP 响应收到 (耗时: ${requestTime}ms, 状态码: ${response.status})`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '无法读取错误响应');
        console.error(`❌ [PolymarketAdapter] API 错误响应:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText.substring(0, 500),
        });
        throw new Error(`Polymarket API error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
      }

      console.log(`📥 [DEBUG] [fetch] 开始解析 JSON 响应...`);
      const parseStartTime = Date.now();
      const data = await response.json();
      const parseTime = Date.now() - parseStartTime;
      console.log(`✅ [DEBUG] [fetch] JSON 解析完成 (耗时: ${parseTime}ms)`);
      
      const dataLength = Array.isArray(data) ? data.length : 0;
      console.log(`📊 [DEBUG] [fetch] 数据长度: ${dataLength} 条`);
      
      // 🔥 原始打印：立即使用 console.log 打印出 API 返回的原始数组长度和前 2 条数据的 ID
      if (Array.isArray(data) && dataLength > 0) {
        // 打印前 2 条数据的 ID
        const firstTwoIds = data.slice(0, 2).map((item: any, index: number) => ({
          index: index + 1,
          id: item.id || 'N/A',
          title: item.title || item.question || 'N/A',
        }));
        console.log(`📋 [DEBUG] [fetch] 前 2 条数据样本:`, JSON.stringify(firstTwoIds, null, 2));
      } else {
        console.warn('⚠️ [DEBUG] [fetch] API 返回数据为空或不是数组！');
      }
      
      const totalFetchTime = Date.now() - fetchStartTime;
      console.log(`✅ [DEBUG] [fetch] fetch() 方法完成 (总耗时: ${totalFetchTime}ms)`);

      if (dataLength === 0) {
        console.warn(`⚠️ [PolymarketAdapter] ⚠️ 警告：API 返回长度为 0！`);
        console.warn(`⚠️ [PolymarketAdapter] 请检查：`);
        console.warn(`  1. API URL 是否失效: ${apiUrl}`);
        console.warn(`  2. IP 是否被 Polymarket 封禁`);
        console.warn(`  3. API 参数是否正确（closed=false, limit=${this.limit}, offset=0）`);
      }
      
      // 🔍 输出原始JSON数据样本（用于调试）- 打印前 3 条数据
      if (Array.isArray(data) && data.length > 0) {
        const sampleCount = Math.min(3, data.length);

        for (let i = 0; i < sampleCount; i++) {

        }

        // 字段检查（包括 liquidity/TVL 和活跃用户相关字段）

      } else {
        console.warn(`⚠️ [PolymarketAdapter] API 返回的数据为空或不是数组`);
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      const totalFetchTime = Date.now() - fetchStartTime;
      console.error(`❌ [DEBUG] [fetch] fetch() 方法失败 (总耗时: ${totalFetchTime}ms)`);
      console.error(`❌ [PolymarketAdapter] fetch 失败详情:`, {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        url: apiUrl,
        timestamp: new Date().toISOString(),
        isTimeout: error instanceof Error && error.name === 'AbortError',
      });
      
      // 🔥 容错降级：如果是超时错误，返回空数组而不是抛出异常
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`⚠️ [DEBUG] [fetch] API 请求超时，返回空数组（容错降级）`);
        return [];
      }
      
      throw error;
    }
  }

  /**
   * 标准化 Polymarket 数据
   * 过滤掉无效数据（没有 outcomePrices 的）和已关闭的市场
   */
  protected normalize(rawData: PolymarketMarket[]): PolymarketMarket[] {
    console.log(`🔍 [DEBUG] [normalize] 开始标准化数据，原始数据量: ${rawData.length} 条`);
    const normalizeStartTime = Date.now();
    
    let filteredCount = 0;
    let noIdCount = 0;
    let noTitleCount = 0;
    let closedCount = 0;
    let noOutcomePricesCount = 0;
    
    const normalized = rawData.filter(market => {
      // 必须有 id
      if (!market.id) {
        noIdCount++;
        return false;
      }
      
      // 必须有标题
      if (!market.title && !market.question) {
        noTitleCount++;
        return false;
      }
      
      // 状态检查：只采集 active 且未关闭的市场
      // 检查 closed 字段：如果 closed 为 true，跳过该市场
      if (market.closed === true) {
        closedCount++;
        return false;
      }
      
      // 必须有 outcomePrices（必须处理空值）
      // outcomePrices 可能在 market 上，或者在 events[0].markets[0] 上
      let hasOutcomePrices = false;
      
      // 情况1：直接在 market 对象上
      if (market.outcomePrices) {
        hasOutcomePrices = true;
      }
      // 情况2：在 events[0].markets[0] 上（用户提到的结构）
      else if (market.events && Array.isArray(market.events) && market.events.length > 0) {
        const firstEvent = market.events[0];
        if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
          const firstSubMarket = firstEvent.markets[0];
          if (firstSubMarket.outcomePrices) {
            hasOutcomePrices = true;
          }
        }
      }
      
      if (!hasOutcomePrices) {
        noOutcomePricesCount++;
        return false; // 跳过没有 outcomePrices 的事件
      }
      
      return true;
    });
    
    filteredCount = rawData.length - normalized.length;
    const normalizeTime = Date.now() - normalizeStartTime;
    console.log(`✅ [DEBUG] [normalize] 标准化完成 (耗时: ${normalizeTime}ms)`);
    console.log(`📊 [DEBUG] [normalize] 过滤统计:`);
    console.log(`   - 原始数据: ${rawData.length} 条`);
    console.log(`   - 标准化后: ${normalized.length} 条`);
    console.log(`   - 被过滤: ${filteredCount} 条`);
    console.log(`   - 无 ID: ${noIdCount} 条`);
    console.log(`   - 无标题: ${noTitleCount} 条`);
    console.log(`   - 已关闭: ${closedCount} 条`);
    console.log(`   - 无 outcomePrices: ${noOutcomePricesCount} 条`);
    
    return normalized;
  }

  /**
   * 保存标准化后的数据到数据库
   * 🔥 强制全量更新：每次运行都处理所有数据，不做增量过滤
   */
  protected async save(normalizedData: PolymarketMarket[]): Promise<number> {
    console.log(`🚀 [DEBUG] [save] ========== 开始批量处理数据 ==========`);
    console.log(`🚀 [DEBUG] [save] 数据量: ${normalizedData.length} 条`);
    const saveStartTime = Date.now();

    // 🔥 强制重置：物理删除所有同步记忆（DataSource 表的 lastSyncTime 和 itemsCount）
    console.log(`🔍 [DEBUG] [save] 步骤 1: 重置同步标记...`);
    try {
      const resetStartTime = Date.now();
      const result = await prisma.data_sources.updateMany({
        where: { sourceName: 'Polymarket' },
        data: {
          lastSyncTime: null, // 强制清空最后同步时间
          itemsCount: 0, // 强制重置计数
        },
      });
      console.log(`✅ [DEBUG] [save] 同步标记已重置 (耗时: ${Date.now() - resetStartTime}ms, 影响行数: ${result.count})`);
    } catch (error) {
      console.error(`❌ [DEBUG] [save] 强制重置同步标记失败（容错降级，继续执行）:`, error);
      // 即使失败也继续执行，不中断流程
    }
    
    // 🔥 性能优化：批量查询所有现有市场和已拒绝的市场
    console.log(`🔍 [DEBUG] [save] 步骤 2: 批量查询数据库...`);
    const queryStartTime = Date.now();
    
    const externalIds = normalizedData.map(m => m.id).filter(Boolean);
    console.log(`📊 [DEBUG] [save] 需要查询的 externalId 数量: ${externalIds.length}`);
    
    // 批量查询现有市场（按 externalId）
    const existingMarketsQueryStart = Date.now();
    const existingMarkets = await prisma.markets.findMany({
      where: {
        externalId: { in: externalIds },
        externalSource: 'polymarket',
      },
      select: {
        id: true,
        externalId: true,
        source: true,
        isFactory: true,
        internalVolume: true,
        manualOffset: true,
        status: true,
        description: true, // 🔥 添加 description 字段
      },
    });
    console.log(`✅ [DEBUG] [save] 现有市场查询完成 (耗时: ${Date.now() - existingMarketsQueryStart}ms, 找到: ${existingMarkets.length} 个)`);
    
    // 建立 Map 映射：externalId -> market
    const existingMarketsMap = new Map<string, typeof existingMarkets[0]>();
    existingMarkets.forEach(m => {
      if (m.externalId) {
        existingMarketsMap.set(m.externalId, m);
      }
    });
    
    // 批量查询已拒绝的市场
    const rejectedMarketsQueryStart = Date.now();
    const rejectedMarkets = await prisma.markets.findMany({
      where: {
        externalId: { in: externalIds },
        externalSource: 'polymarket',
        reviewStatus: 'REJECTED',
      },
      select: {
        externalId: true,
      },
    });
    console.log(`✅ [DEBUG] [save] 已拒绝市场查询完成 (耗时: ${Date.now() - rejectedMarketsQueryStart}ms, 找到: ${rejectedMarkets.length} 个)`);
    
    const rejectedExternalIds = new Set(rejectedMarkets.map(m => m.externalId).filter(Boolean));
    
    // 批量查询所有分类（用于后续匹配）
    const categoriesQueryStart = Date.now();
    const allCategories = await prisma.categories.findMany({
      where: { status: 'active' },
      select: { id: true, slug: true },
    });
    console.log(`✅ [DEBUG] [save] 分类查询完成 (耗时: ${Date.now() - categoriesQueryStart}ms, 找到: ${allCategories.length} 个)`);
    
    const categoryMap = new Map<string, string>();
    allCategories.forEach(cat => {
      categoryMap.set(cat.slug, cat.id);
    });
    
    const totalQueryTime = Date.now() - queryStartTime;
    console.log(`✅ [DEBUG] [save] 批量查询完成 (总耗时: ${totalQueryTime}ms)`);
    console.log(`📊 [DEBUG] [save] 查询结果：现有市场 ${existingMarketsMap.size} 个，已拒绝市场 ${rejectedExternalIds.size} 个，分类 ${categoryMap.size} 个`);
    
    let savedCount = 0;
    let totalVolumeSum = 0; // 用于聚合计算交易量总和
    let totalLiquiditySum = 0; // 用于聚合计算TVL总和
    const updatedMarketIds = new Set<string>(); // 记录本次采集更新的市场 ID
    let skipCount = 0; // 跳过的数量
    let errorCount = 0; // 错误的数量
    let matchedCount = 0; // 匹配成功的数量

    for (const marketData of normalizedData) {
      try {
        if (!marketData.id) continue;

        // 精确提取交易量：遍历 event.markets 数组累加所有 market 的 volume
        // 或使用 event.active_volume，或直接使用 market.volume
        let totalVolume = 0;
        
        // 情况1：如果 market 有 events 数组，遍历 events[0].markets
        if (marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
          const firstEvent = marketData.events[0];
          if (firstEvent.markets && Array.isArray(firstEvent.markets)) {
            // 累加所有 market 的 volume
            for (const market of firstEvent.markets) {
              if (market.volumeNum !== undefined && market.volumeNum > 0) {
                totalVolume += market.volumeNum;
              } else if (market.volume) {
                const volumeNum = parseFloat(market.volume);
                if (!isNaN(volumeNum) && volumeNum > 0) {
                  totalVolume += volumeNum;
                }
              }
            }
          }
          // 如果累加为 0，尝试使用 event.active_volume 或 event.volume
          if (totalVolume === 0) {
            if (firstEvent.active_volume) {
              const activeVol = parseFloat(firstEvent.active_volume);
              if (!isNaN(activeVol) && activeVol > 0) {
                totalVolume = activeVol;
              }
            } else if (firstEvent.volume) {
              const vol = parseFloat(firstEvent.volume);
              if (!isNaN(vol) && vol > 0) {
                totalVolume = vol;
              }
            }
          }
        }
        
        // 情况2：直接在 market 对象上
        if (totalVolume === 0) {
          if (marketData.volumeNum !== undefined && marketData.volumeNum > 0) {
            totalVolume = marketData.volumeNum;
          } else if (marketData.volume) {
            const volumeNum = parseFloat(marketData.volume);
            if (!isNaN(volumeNum) && volumeNum > 0) {
              totalVolume = volumeNum;
            }
          } else if (marketData.active_volume) {
            const activeVol = parseFloat(marketData.active_volume);
            if (!isNaN(activeVol) && activeVol > 0) {
              totalVolume = activeVol;
            }
          }
        }

        // 🔥 解耦字段提取：独立提取每个字段，互不依赖
        
        // 1. 独立提取 outcomePrices（赔率数据）
        let outcomePrices: string | string[] | undefined;
        
        // 情况1：在 events[0].markets[0].outcomePrices
        if (marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
          const firstEvent = marketData.events[0];
          if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
            const firstSubMarket = firstEvent.markets[0];
            outcomePrices = firstSubMarket.outcomePrices;
          }
        }
        
        // 情况2：直接在 market.outcomePrices
        if (!outcomePrices) {
          outcomePrices = marketData.outcomePrices;
        }
        
        // 🔥 保存 outcomePrices 原始数据（JSON 字符串格式）- 即使为空也保存
        let outcomePricesJson: string | null = null;
        if (outcomePrices) {
          if (typeof outcomePrices === 'string') {
            outcomePricesJson = outcomePrices;
          } else if (Array.isArray(outcomePrices)) {
            outcomePricesJson = JSON.stringify(outcomePrices);
          }
        }
        
        // 如果没有 outcomePrices，跳过该事件（根据要求）
        if (!outcomePrices) {
          console.warn(`⚠️ [PolymarketAdapter] 跳过事件 (ID: ${marketData.id}): outcomePrices 不存在`);
          skipCount++;
          continue;
        }

        // 2. 独立提取 image（头像数据）- 即使为空也继续处理
        let imageUrl: string | null = null;
        let iconUrlValue: string | null = null;
        
        // 情况1：直接在 marketData 上
        if (marketData.image) {
          imageUrl = marketData.image;
        } else if ((marketData as any).iconUrl) {
          iconUrlValue = (marketData as any).iconUrl;
        } else if (marketData.icon) {
          iconUrlValue = marketData.icon;
        }
        
        // 情况2：在 events[0] 上
        if (!imageUrl && !iconUrlValue && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
          const firstEvent = marketData.events[0];
          if ((firstEvent as any).image) {
            imageUrl = (firstEvent as any).image;
          } else if ((firstEvent as any).iconUrl) {
            iconUrlValue = (firstEvent as any).iconUrl;
          } else if ((firstEvent as any).icon) {
            iconUrlValue = (firstEvent as any).icon;
          }
        }
        
        // 情况3：在 events[0].markets[0] 上
        if (!imageUrl && !iconUrlValue && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
          const firstEvent = marketData.events[0];
          if (firstEvent.markets && Array.isArray(firstEvent.markets) && firstEvent.markets.length > 0) {
            const firstSubMarket = firstEvent.markets[0];
            if (firstSubMarket.image) {
              imageUrl = firstSubMarket.image;
            } else if ((firstSubMarket as any).iconUrl) {
              iconUrlValue = (firstSubMarket as any).iconUrl;
            } else if (firstSubMarket.icon) {
              iconUrlValue = firstSubMarket.icon;
            }
          }
        }
        
        // 🔥 日志监控：记录每个字段的提取状态

        // 3. 独立解析 outcomePrices（必须是数组格式，如 ["0.7", "0.3"]）
        // 🔥 修复'50/50'的根源：直接使用 API 给出的 outcomePrices，不做带默认值的二次加工
        let prices: number[] = [];
        let initialPriceValue: number | null = null;
        let yesProbability = 50; // 默认值，但只在无法解析时使用
        let noProbability = 50;
        
        try {
          // 处理 outcomePrices 可能是 JSON 字符串或数组的情况
          if (typeof outcomePrices === 'string') {
            // 尝试解析 JSON 字符串（如 "[\"0.7\", \"0.3\"]"）
            try {
              const parsed = JSON.parse(outcomePrices);
              if (Array.isArray(parsed)) {
                prices = parsed.map((p: any) => {
                  const num = parseFloat(String(p));
                  return isNaN(num) ? 0 : num;
                }).filter((p: number) => p >= 0);
              }
            } catch {
              // JSON 解析失败，跳过该事件
              console.warn(`⚠️ [PolymarketAdapter] 跳过事件 (ID: ${marketData.id}): outcomePrices JSON 解析失败`);
              continue;
            }
          } else if (Array.isArray(outcomePrices)) {
            // 直接是数组
            prices = outcomePrices.map((p: any) => {
              const num = typeof p === 'string' ? parseFloat(p) : (typeof p === 'number' ? p : 0);
              return isNaN(num) ? 0 : num;
            }).filter((p: number) => p >= 0);
          }
          
          // 必须至少有 2 个价格值（Yes 和 No）
          if (prices.length >= 2 && prices[0] >= 0 && prices[1] >= 0) {
            // 第一个值是 Yes 的概率，第二个值是 No 的概率
            // 例如 ["0.7", "0.3"] -> yesProbability 为 70，noProbability 为 30
            const yesPrice = prices[0];
            const noPrice = prices[1];
            
            // 🔥 计算 initialPrice（YES 的初始价格，0-1 之间）- 直接使用原始值，不加工
            initialPriceValue = yesPrice;
            
            // 🔥 修复'50/50'的根源：直接使用 API 给出的价格计算，不使用默认值
            const total = yesPrice + noPrice;
            if (total > 0) {
              // 直接计算，不使用默认值
              yesProbability = Math.round((yesPrice / total) * 100);
              noProbability = 100 - yesProbability;
            } else {
              // 只有在价格都为 0 时才使用默认值（这种情况应该很少见）
              console.warn(`⚠️ [PolymarketAdapter] 价格总和为 0 (ID: ${marketData.id}), 使用默认 50/50`);
              yesProbability = 50;
              noProbability = 50;
            }

            // 过滤逻辑：如果 yesProbability 等于 100%（死盘），跳过该市场
            if (yesProbability === 100 || noProbability === 100) {

              skipCount++;
              continue;
            }
          } else {
            // 如果价格数组长度不足 2，跳过该事件（根据要求）
            console.warn(`⚠️ [PolymarketAdapter] 跳过事件 (ID: ${marketData.id}): outcomePrices 格式不正确（需要至少 2 个值）`);
            skipCount++;
            continue;
          }
        } catch (error) {
          console.warn(`⚠️ [PolymarketAdapter] 解析 outcomePrices 失败 (ID: ${marketData.id}):`, error);
          // 如果解析失败，跳过该事件（根据要求）
          skipCount++;
          continue;
        }

        // 🔥 计算 volume24h（24小时交易量，使用 totalVolume）
        const volume24hValue = totalVolume > 0 ? totalVolume : null;

        // 解析截止日期：优先使用 endDate
        let endDate: Date;
        if (marketData.endDate) {
          endDate = new Date(marketData.endDate);
        } else if (marketData.endDateIso) {
          endDate = new Date(marketData.endDateIso);
        } else if (marketData.startDate) {
          // 如果没有 endDate，使用 startDate + 30 天
          endDate = new Date(new Date(marketData.startDate).getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
        
        // 验证日期有效性
        if (isNaN(endDate.getTime())) {
          console.warn(`⚠️ [PolymarketAdapter] 无效的日期，使用默认值 (ID: ${marketData.id})`);
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        // 提取标题和描述（英文）
        const title = marketData.title || marketData.question || '未命名市场';
        const description = marketData.description || '';
        
        // 🔥 性能优化：暂时禁用翻译功能，减少API调用和处理时间
        // 翻译服务会为每条数据调用外部API，导致采集变慢
        // 如果需要翻译，可以在后台手动编辑或使用批量翻译功能
        let titleZh: string | null = null;
        let descriptionZh: string | null = null;
        
        // 🔥 暂时禁用翻译以提升性能
        // TODO: 如果需要翻译，可以：
        // 1. 配置翻译 API Key
        // 2. 使用批量翻译（在后台管理界面）
        // 3. 或使用异步翻译（采集完成后后台翻译）
        /*
        try {
          const [translatedTitle, translatedDescription] = await Promise.all([
            translateText(title, 'zh'),
            description ? translateText(description, 'zh') : Promise.resolve(''),
          ]);
          
          if (translatedTitle && translatedTitle.trim()) {
            titleZh = translatedTitle.trim();
          }
          if (translatedDescription && translatedDescription.trim()) {
            descriptionZh = translatedDescription.trim();
          }
        } catch (error) {
          console.error(`❌ [PolymarketAdapter] 翻译失败 (ID: ${marketData.id}):`, error);
        }
        */

        // 🔥 性能优化：从批量查询的分类 Map 中获取
        let categoryId: string | null = null;
        const categorySlug = mapPolymarketCategory(
          marketData.tags || [],
          title
        );

        if (categorySlug) {
          // 🔥 从 Map 中获取分类 ID
          categoryId = categoryMap.get(categorySlug) || null;
          if (!categoryId) {
            console.warn(`⚠️ [PolymarketAdapter] 未找到分类 '${categorySlug}'，将跳过分类关联（市场将出现在"所有市场"中）`);
          }
        }

        // 🔥 性能优化：使用批量查询的结果
        // 检查是否已拒绝
        if (rejectedExternalIds.has(marketData.id)) {
          skipCount++;
          continue;
        }

        // 🔥 性能优化：从 Map 中获取现有市场
        const existingMarket = existingMarketsMap.get(marketData.id);

        // 🔥 移除工厂空壳市场匹配逻辑
        // 原因：Polymarket 市场（外部市场）和工厂空壳市场（内部周期性市场）是两个完全不同的逻辑
        // - Polymarket 市场：来自外部平台，有 externalId，用于展示外部市场的真实赔率
        // - 工厂空壳市场：由内部系统自动生成，isFactory=true，用于内部交易
        // 两个系统应该完全独立运行，互不干扰
        // 如果通过 externalId 没找到，说明这是一个新的 Polymarket 市场，将创建新市场并进入审核中心（status = PENDING_REVIEW）
        

        // 🔥 禁止更新工厂市场：工厂市场由内部系统管理，不应该被 Polymarket 采集源更新
        // 这个检查已经在上面（第1217行）执行，这里保留注释作为说明

        // 🔥 状态锁定逻辑：更新数据时绝对禁止修改 status 字段
        // 只有新创建的市场才设置 status，已存在的市场保持原有 status
        let marketStatusForCreate: 'OPEN' | 'CLOSED' | 'PENDING_REVIEW' | undefined = undefined;
        if (!existingMarket) {
          // 🔥 新创建：强制设为 PENDING_REVIEW（除非已关闭）
          marketStatusForCreate = marketData.closed ? 'CLOSED' : 'PENDING_REVIEW';
        }
        // 如果已存在，不设置 marketStatusForCreate，确保更新时不修改 status

        // 🔥 在执行数据库写入之前，增加调试日志

        let market;
        if (existingMarket) {
          // 🔥 已有事件：仅更新数值字段，绝对禁止修改 status
          // 🔥 确保 totalVolume 是数字类型
          const externalVolumeValue = typeof totalVolume === 'number' 
            ? totalVolume 
            : parseFloat(String(totalVolume || 0));
          
          const isManualMarket = (existingMarket.source === 'INTERNAL' || !existingMarket.source) && 
                                 !(existingMarket as any).isFactory;
          
          // 🔥 禁止更新工厂市场：工厂市场由内部系统管理，不应该被 Polymarket 采集源更新
          if ((existingMarket as any).isFactory === true) {
            console.warn(`⚠️ [PolymarketAdapter] 跳过工厂市场更新：工厂市场应该由内部系统管理，不应该被外部采集源更新 (ID: ${existingMarket.id})`);
            skipCount++;
            continue;
          }
          
          const { calculateDisplayVolume } = await import('@/lib/marketUtils');
          const newDisplayVolume = calculateDisplayVolume({
            source: existingMarket.source || 'POLYMARKET',
            externalVolume: externalVolumeValue, // 🔥 只更新外部交易量
            internalVolume: existingMarket.internalVolume || 0, // 🔥 保留内部交易量（不覆盖）
            manualOffset: existingMarket.manualOffset || 0, // 🔥 保留手动偏移量（不覆盖）
          });
          
          // 🔥 构建更新数据：仅更新数值字段，绝对禁止修改 status
          // 🔥 核心修复：确保每个字段都是独立赋值的，没有任何条件包装
          const updateData: any = {
            // 更新基本信息
            title: title,
            description: description || existingMarket.description || '',
            // 更新翻译字段（如果存在）
            ...(titleZh ? { titleZh } : {}),
            ...(descriptionZh ? { descriptionZh } : {}),
            closingDate: endDate,
            // 🔥 修复：手动市场保持 source='INTERNAL'，只有 POLYMARKET 市场才设置为 'POLYMARKET'
            source: isManualMarket ? existingMarket.source || 'INTERNAL' : 'POLYMARKET',
            // 🔥 修复：手动市场也要设置 externalSource，确保下次采集时能快速匹配
            externalSource: 'polymarket',
            // 🔥 仅更新数值字段：volume、价格等
            externalVolume: externalVolumeValue, // 外部交易量
            totalVolume: newDisplayVolume, // 展示交易量
            yesProbability, // Yes 概率（直接从 outcomePrices 计算，不使用默认值）
            noProbability, // No 概率（直接从 outcomePrices 计算，不使用默认值）
            isHot: newDisplayVolume > 10000,
            isActive: true, // 确保激活状态
            updatedAt: new Date(),
            // 🔥 保存原始数据字段 - 每个字段独立赋值，互不依赖
            outcomePrices: outcomePricesJson || null, // 原始赔率 JSON 字符串，即使为空也保存 null
            image: imageUrl || null, // 头像 URL，即使为空也保存 null（不影响后续字段）
            iconUrl: iconUrlValue || null, // 备份头像字段，即使为空也保存 null
            initialPrice: initialPriceValue || null, // 初始价格（YES 价格，0-1 之间），即使为空也保存 null
            volume24h: volume24hValue || null, // 24小时交易量，即使为空也保存 null
            // 🔥 绝对禁止修改 status 字段（已存在的市场保持原有 status）
            // 🔥 不更新 internalVolume 和 manualOffset（保留平台内部数据）
            // 🔥 不更新 reviewStatus（保持原有审核状态）
            // 🔥 不更新 isFactory（保持原有类型）
          };
          
          market = await prisma.markets.update({
            where: { id: existingMarket.id },
            data: updateData,
          });
          
          // 🚀 核心修复：记录更新类型（手动市场或 POLYMARKET 市场）
          const marketType = isManualMarket ? '手动市场' : 'POLYMARKET市场';
          // 🔥 注意：savedCount++ 在后面的代码中统一增加（避免重复计数）
        } else {
          // 🔥 新事件：创建新记录，status 强制设为 PENDING_REVIEW（进入审核中心）
          // 🔥 确保 totalVolume 是数字类型
          const externalVolumeValue = typeof totalVolume === 'number' 
            ? totalVolume 
            : parseFloat(String(totalVolume || 0));
          
          // 🔥 恢复创建市场功能：允许创建新市场，状态设为 PENDING_REVIEW（进入审核中心）
          market = await prisma.markets.create({
            data: {
              id: randomUUID(), // 🔥 必需：生成唯一 ID
              title: title,
              titleZh: titleZh || null,
              description: description || '',
              descriptionZh: descriptionZh || null,
              closingDate: endDate,
              updatedAt: new Date(), // 🔥 必需：updatedAt 字段
              source: 'POLYMARKET',
              externalVolume: externalVolumeValue,
              internalVolume: 0,
              manualOffset: 0,
              totalVolume: externalVolumeValue,
              yesProbability,
              noProbability,
              isHot: externalVolumeValue > 10000,
              isActive: true,
              externalId: marketData.id, // 🔥 使用 externalId 作为唯一标识
              externalSource: 'polymarket', // 🔥 使用 externalSource 配合 externalId 作为唯一标识
              status: marketStatusForCreate!, // 🔥 新创建的市场强制设置为 PENDING_REVIEW（除非已关闭）
              reviewStatus: 'PENDING', // 新创建的默认为 PENDING
              // 🔥 保存原始数据字段 - 每个字段独立赋值，互不依赖
              outcomePrices: outcomePricesJson || null, // 原始赔率 JSON 字符串，即使为空也保存 null
              image: imageUrl || null, // 头像 URL，即使为空也保存 null（不影响后续字段）
              iconUrl: iconUrlValue || null, // 备份头像字段，即使为空也保存 null
              initialPrice: initialPriceValue || null, // 初始价格（YES 价格，0-1 之间），即使为空也保存 null
              volume24h: volume24hValue || null, // 24小时交易量，即使为空也保存 null
            },
          });
        }

        // 更新或创建分类关联
        if (categoryId) {
          const existingLink = await prisma.market_categories.findFirst({
            where: {
              marketId: market.id,
              categoryId: categoryId,
            },
          });

          if (!existingLink) {
            await prisma.market_categories.create({
              data: {
                id: randomUUID(),
                marketId: market.id,
                categoryId: categoryId,
              },
            });
          }
        }

        // 🔥 提取流动性（TVL）：从 marketData.liquidity 或 liquidityNum
        let liquidity = 0;
        if (marketData.liquidityNum !== undefined && marketData.liquidityNum > 0) {
          liquidity = marketData.liquidityNum;
        } else if (marketData.liquidity) {
          const liquidityNum = parseFloat(marketData.liquidity);
          if (!isNaN(liquidityNum) && liquidityNum > 0) {
            liquidity = liquidityNum;
          }
        }
        
        // 如果 events[0].markets 中有 liquidity，也尝试提取
        if (liquidity === 0 && marketData.events && Array.isArray(marketData.events) && marketData.events.length > 0) {
          const firstEvent = marketData.events[0];
          if (firstEvent.markets && Array.isArray(firstEvent.markets)) {
            for (const subMarket of firstEvent.markets) {
              if (subMarket.liquidityNum !== undefined && subMarket.liquidityNum > 0) {
                liquidity += subMarket.liquidityNum;
              } else if (subMarket.liquidity) {
                const liqNum = parseFloat(subMarket.liquidity);
                if (!isNaN(liqNum) && liqNum > 0) {
                  liquidity += liqNum;
                }
              }
            }
          }
        }

        // 🔥 调试输出：打印每条市场的流动性数据
        if (liquidity > 0) {

        }

        // 🔥 统一增加保存计数（无论是更新还是创建，只要成功处理就计数）
        savedCount++;
        // 确保 totalVolume 是数字类型用于累加
        const volumeForSum = typeof totalVolume === 'number' ? totalVolume : parseFloat(String(totalVolume || 0));
        totalVolumeSum += volumeForSum;
        totalLiquiditySum += liquidity; // 🔥 累加所有市场的流动性作为 TVL
        updatedMarketIds.add(market.id); // 记录已更新的市场 ID
        
        // 🔥 进度日志：每处理 50 条数据输出一次进度
        if (savedCount % 50 === 0) {
          console.log(`📊 [PolymarketAdapter] 处理进度: ${savedCount}/${normalizedData.length} (跳过: ${skipCount}, 错误: ${errorCount})`);
        }

      } catch (error) {
        errorCount++;
        // 🔥 性能优化：减少错误日志输出，避免日志过多
        if (errorCount <= 10) {
          console.error(`❌ [PolymarketAdapter] 保存市场失败 (ID: ${marketData.id}):`, error);
          console.error(`❌ [PolymarketAdapter] 错误详情:`, {
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        }
        // 继续处理下一个
      }
    }
    
    const totalSaveTime = Date.now() - saveStartTime;
    console.log(`✅ [DEBUG] [save] ========== 批量处理完成 ==========`);
    console.log(`📊 [DEBUG] [save] 统计：保存 ${savedCount} 条，跳过 ${skipCount} 条，错误 ${errorCount} 条`);
    console.log(`⏱️ [DEBUG] [save] 总耗时: ${totalSaveTime}ms (${(totalSaveTime / 1000).toFixed(2)}秒)`);
    console.log(`📊 [DEBUG] [save] 平均每条耗时: ${savedCount > 0 ? (totalSaveTime / savedCount).toFixed(2) : 0}ms`);

    // 自动清理过期 PENDING_REVIEW 事件：删除那些在本次采集中没有被更新的 PENDING_REVIEW 事件
    try {

      // 获取所有 PENDING_REVIEW 状态的市场（未审核的生肉）
      const allPendingMarkets = await prisma.markets.findMany({
        where: {
          status: 'PENDING_REVIEW', // 🔥 使用 status 字段过滤，而不是 reviewStatus
          isActive: true, // 🔥 只返回未删除的市场
        },
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      });

      // 找出在本次采集中没有被更新的 PENDING 事件
      const expiredPendingMarkets = allPendingMarkets.filter(
        market => !updatedMarketIds.has(market.id)
      );

      if (expiredPendingMarkets.length > 0) {

        const expiredIds = expiredPendingMarkets.map(m => m.id);
        const deleteResult = await prisma.markets.deleteMany({
          where: {
            id: {
              in: expiredIds,
            },
            status: 'PENDING_REVIEW', // 🔥 使用 status 字段过滤
          },
        });

      } else {

      }
    } catch (error) {
      console.error(`❌ [PolymarketAdapter] 清理过期 PENDING 事件失败:`, error);
      // 不影响主流程，只记录错误
    }

    // 🔥 性能优化：手动市场的单独更新（简化处理，减少 API 调用）
    // 查询所有有 externalId 但 source 为 INTERNAL 且 isFactory 为 false 的市场（手动市场）
    try {
      console.log(`🔍 [PolymarketAdapter] 开始处理手动市场更新`);
      
      const manualMarketsWithExternalId = await prisma.markets.findMany({
        where: {
          externalId: { not: null },
          source: 'INTERNAL',
          isFactory: false,
          isActive: true,
        },
        select: {
          id: true,
          externalId: true,
          title: true,
          source: true,
          internalVolume: true,
          manualOffset: true,
        },
      });

      // 🔥 性能优化：过滤掉已经在本次采集中更新过的市场
      const manualMarketsToUpdate = manualMarketsWithExternalId.filter(
        m => !updatedMarketIds.has(m.id)
      );

      console.log(`📊 [PolymarketAdapter] 找到 ${manualMarketsToUpdate.length} 个需要更新的手动市场`);

      // 🔥 性能优化：限制手动市场的处理数量，避免超时
      // 只处理前 50 个手动市场，其余的可以在下次采集时处理
      const manualMarketsToProcess = manualMarketsToUpdate.slice(0, 50);
      
      if (manualMarketsToUpdate.length > 50) {
        console.warn(`⚠️ [PolymarketAdapter] 手动市场数量过多 (${manualMarketsToUpdate.length})，本次只处理前 50 个`);
      }

      let manualMarketUpdatedCount = 0;
      
      // 🔥 性能优化：并行处理手动市场（限制并发数为 5）
      const BATCH_SIZE = 5;
      for (let i = 0; i < manualMarketsToProcess.length; i += BATCH_SIZE) {
        const batch = manualMarketsToProcess.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (manualMarket) => {
          try {
            const externalId = (manualMarket as any).externalId;
            if (!externalId) return;

            // 🔥 单独从 Polymarket API 获取该市场的数据（添加超时）
            const singleMarketUrl = `https://gamma-api.polymarket.com/markets/${externalId}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 🔥 容错降级：30秒超时（适应国际网络延迟）
            
            try {
              const response = await fetch(singleMarketUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                console.warn(`⚠️ [PolymarketAdapter] 手动市场 ${externalId} 的 API 请求失败: ${response.status}`);
                return;
              }

              const singleMarketData: PolymarketMarket = await response.json();
              
              if (!singleMarketData || !singleMarketData.id) {
                console.warn(`⚠️ [PolymarketAdapter] 手动市场 ${externalId} 的 API 返回数据无效`);
                return;
              }

              // 🔥 简化处理：只更新关键字段，减少数据库操作
              // 提取数据（复用 save 方法中的逻辑）
              const title = singleMarketData.title || singleMarketData.question || '';
              const description = singleMarketData.description || '';
              const endDateStr = singleMarketData.endDateIso || singleMarketData.endDate;
              const endDate = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          
              // 提取 outcomePrices
              let outcomePricesJson: string | null = null;
              let yesProbability = 0.5;
              let noProbability = 0.5;
              let initialPriceValue: number | null = null;

              if (singleMarketData.outcomePrices) {
                try {
                  const parsed = Array.isArray(singleMarketData.outcomePrices)
                    ? singleMarketData.outcomePrices
                    : JSON.parse(singleMarketData.outcomePrices);
                  
                  if (Array.isArray(parsed) && parsed.length >= 2) {
                    yesProbability = parseFloat(String(parsed[0])) || 0.5;
                    noProbability = parseFloat(String(parsed[1])) || 0.5;
                    initialPriceValue = yesProbability;
                    outcomePricesJson = JSON.stringify([yesProbability, noProbability]);
                  }
                } catch (e) {
                  console.warn(`⚠️ [PolymarketAdapter] 解析手动市场 ${externalId} 的 outcomePrices 失败:`, e);
                }
              }

              // 提取交易量
              let totalVolume = 0;
              if (singleMarketData.volumeNum !== undefined && singleMarketData.volumeNum > 0) {
                totalVolume = singleMarketData.volumeNum;
              } else if (singleMarketData.volume) {
                totalVolume = parseFloat(singleMarketData.volume) || 0;
              }

              const externalVolumeValue = totalVolume;
              const { calculateDisplayVolume } = await import('@/lib/marketUtils');
              const newDisplayVolume = calculateDisplayVolume({
                source: manualMarket.source || 'INTERNAL',
                externalVolume: externalVolumeValue,
                internalVolume: manualMarket.internalVolume || 0,
                manualOffset: manualMarket.manualOffset || 0,
              });

              // 更新市场
              await prisma.markets.update({
                where: { id: manualMarket.id },
                data: {
                  title: title || manualMarket.title,
                  description: description || '',
                  closingDate: endDate,
                  externalVolume: externalVolumeValue,
                  totalVolume: newDisplayVolume,
                  yesProbability,
                  noProbability,
                  outcomePrices: outcomePricesJson || null,
                  image: singleMarketData.image || null,
                  iconUrl: singleMarketData.icon || null,
                  initialPrice: initialPriceValue,
                  externalSource: 'polymarket', // 确保设置 externalSource
                  updatedAt: new Date(),
                },
              });

              updatedMarketIds.add(manualMarket.id);
              manualMarketUpdatedCount++;
              savedCount++;

            } catch (fetchError) {
              if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.warn(`⏱️ [PolymarketAdapter] 手动市场 ${externalId} 的 API 请求超时`);
              } else {
                console.error(`❌ [PolymarketAdapter] 更新手动市场失败 (ID: ${manualMarket.id}):`, fetchError);
                errorCount++;
              }
            }
          } catch (error) {
            console.error(`❌ [PolymarketAdapter] 处理手动市场失败 (ID: ${manualMarket.id}):`, error);
            errorCount++;
          }
        }));
          
          console.log(`✅ [PolymarketAdapter] 已处理 ${Math.min(i + BATCH_SIZE, manualMarketsToProcess.length)}/${manualMarketsToProcess.length} 个手动市场`);
        }

    } catch (error) {
      console.error(`❌ [PolymarketAdapter] 处理手动市场更新失败:`, error);
      // 不影响主流程
    }

    // 🔥 剥离：全局统计数据计算已移至独立脚本 scripts/calculate-global-stats.ts
    // 市场抓取脚本只负责抓取市场数据到审核中心，不再更新 GlobalStat

    return savedCount;
  }
}
