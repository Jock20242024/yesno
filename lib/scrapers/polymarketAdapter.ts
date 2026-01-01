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
    const url = new URL('https://gamma-api.polymarket.com/markets');
    
    // 🔥 强制全量拉取：只设置基本参数，绝对不包含任何时间过滤参数
    // ❌ 已删除：min_updated_at, after, since 等时间过滤参数
    url.searchParams.set('closed', 'false'); // 只获取活跃市场（未关闭的）
    url.searchParams.set('limit', this.limit.toString()); // 数量限制
    url.searchParams.set('offset', '0'); // 从第一条开始
    url.searchParams.set('order', 'volume'); // 按交易量排序
    url.searchParams.set('ascending', 'false'); // 降序，最火的在前

    const apiUrl = url.toString();

    try {
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };

      const response = await fetch(apiUrl, fetchOptions);

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

      const data = await response.json();
      const dataLength = Array.isArray(data) ? data.length : 0;
      
      // 🔥 原始打印：立即使用 console.log 打印出 API 返回的原始数组长度和前 2 条数据的 ID

      if (Array.isArray(data) && dataLength > 0) {
        // 打印前 2 条数据的 ID
        const firstTwoIds = data.slice(0, 2).map((item: any, index: number) => ({
          index: index + 1,
          id: item.id || 'N/A',
          title: item.title || item.question || 'N/A',
        }));

      } else {
        console.warn('⚠️ [Scraper Debug] API 返回数据为空或不是数组！');
      }

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
      console.error(`❌ [PolymarketAdapter] fetch 失败详情:`, {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        url: apiUrl,
        timestamp: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  /**
   * 标准化 Polymarket 数据
   * 过滤掉无效数据（没有 outcomePrices 的）和已关闭的市场
   */
  protected normalize(rawData: PolymarketMarket[]): PolymarketMarket[] {
    return rawData.filter(market => {
      // 必须有 id
      if (!market.id) return false;
      
      // 必须有标题
      if (!market.title && !market.question) return false;
      
      // 状态检查：只采集 active 且未关闭的市场
      // 检查 closed 字段：如果 closed 为 true，跳过该市场
      if (market.closed === true) {

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
        return false; // 跳过没有 outcomePrices 的事件
      }
      
      return true;
    });
  }

  /**
   * 保存标准化后的数据到数据库
   * 🔥 强制全量更新：每次运行都处理所有数据，不做增量过滤
   */
  protected async save(normalizedData: PolymarketMarket[]): Promise<number> {

    // 🔥 强制重置：物理删除所有同步记忆（DataSource 表的 lastSyncTime 和 itemsCount）
    try {
      const result = await prisma.data_sources.updateMany({
        where: { sourceName: 'Polymarket' },
        data: {
          lastSyncTime: null, // 强制清空最后同步时间
          itemsCount: 0, // 强制重置计数
        },
      });

    } catch (error) {
      console.error(`❌ [PolymarketAdapter] 强制重置同步标记失败:`, error);
      // 即使失败也继续执行，不中断流程
    }
    
    // 🚀 性能优化：批量预加载所有未同步的空壳市场（用于快速匹配）
    // 🔥 关键优化：只加载未来市场（过去24小时的市场不需要同步）

    const now = Date.now();
    const unsyncedShells = await prisma.markets.findMany({
      where: {
        isFactory: true,
        externalId: null,
        isActive: true,
        closingDate: {
          // 🔥 只加载未来市场到未来60天（过去24小时的市场不需要同步）
          gte: new Date(now),
          lte: new Date(now + 60 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        symbol: true,
        period: true,
        closingDate: true,
        templateId: true,
      },
      orderBy: {
        closingDate: 'asc',
      },
    });

    // 创建快速查找索引：按 symbol + period + 时间范围索引
    const shellIndex = new Map<string, any[]>();
    unsyncedShells.forEach(shell => {
      // 🔥 为每个空壳市场创建多个索引键，支持多种查询方式
      const symbol = shell.symbol || 'ANY';
      const period = shell.period || 'ANY';
      
      // 主键：symbol-period
      const mainKey = `${symbol}-${period}`;
      if (!shellIndex.has(mainKey)) {
        shellIndex.set(mainKey, []);
      }
      shellIndex.get(mainKey)!.push(shell);
      
      // 辅助键：symbol-ANY（用于只匹配symbol的情况）
      if (symbol !== 'ANY') {
        const symbolKey = `${symbol}-ANY`;
        if (!shellIndex.has(symbolKey)) {
          shellIndex.set(symbolKey, []);
        }
        shellIndex.get(symbolKey)!.push(shell);
      }
      
      // 辅助键：ANY-period（用于只匹配period的情况）
      if (period !== 'ANY') {
        const periodKey = `ANY-${period}`;
        if (!shellIndex.has(periodKey)) {
          shellIndex.set(periodKey, []);
        }
        shellIndex.get(periodKey)!.push(shell);
      }
      
      // 通用键：ANY-ANY（用于完全不匹配的情况）
      const anyKey = 'ANY-ANY';
      if (!shellIndex.has(anyKey)) {
        shellIndex.set(anyKey, []);
      }
      shellIndex.get(anyKey)!.push(shell);
    });
    
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
        
        // 翻译服务：将英文标题和描述翻译成中文
        // TODO: 在实际使用时，配置翻译 API Key，并取消注释以下代码
        let titleZh: string | null = null;
        let descriptionZh: string | null = null;
        
        try {
          // 调用翻译服务（目前返回空字符串，表示待翻译）
          const [translatedTitle, translatedDescription] = await Promise.all([
            translateText(title, 'zh'),
            description ? translateText(description, 'zh') : Promise.resolve(''),
          ]);
          
          // 如果翻译结果不为空，则使用翻译结果
          if (translatedTitle && translatedTitle.trim()) {
            titleZh = translatedTitle.trim();
          }
          if (translatedDescription && translatedDescription.trim()) {
            descriptionZh = translatedDescription.trim();
          }
        } catch (error) {
          console.error(`❌ [PolymarketAdapter] 翻译失败 (ID: ${marketData.id}):`, error);
          // 翻译失败不影响主流程，继续使用英文
        }

        // 🔥 只读匹配：仅使用 findUnique 查找现有分类，禁止创建
        let categoryId: string | null = null;
        const categorySlug = mapPolymarketCategory(
          marketData.tags || [],
          title
        );

        if (categorySlug) {
          // 🔥 物理切断：只使用 findUnique 查找，不创建
          const category = await prisma.categories.findUnique({
            where: { slug: categorySlug },
          });
          if (category) {
            categoryId = category.id;

          } else {
            console.warn(`⚠️ [PolymarketAdapter] 未找到分类 '${categorySlug}'，将跳过分类关联（市场将出现在"所有市场"中）`);
          }
        }

        // 检查是否已拒绝
        const rejectedMarket = await prisma.markets.findFirst({
          where: {
            externalId: marketData.id,
            externalSource: 'polymarket',
            reviewStatus: 'REJECTED',
          },
        });

        if (rejectedMarket) {

          skipCount++;
          continue;
        }

        // 🔥 重写 Upsert 逻辑：使用 externalId 作为唯一标识（支持手动市场和工厂市场）
        // 先查找是否存在（优先使用 externalId + externalSource，如果没有则只使用 externalId）
        let existingMarket = await prisma.markets.findFirst({
          where: {
            externalId: marketData.id,
            externalSource: 'polymarket',
          },
        });

        // 🔥 修复：如果没找到，尝试只使用 externalId 查找（支持手动创建的市场）
        // 手动市场可能有 externalId 但 externalSource 可能为 null 或其他值
        if (!existingMarket) {
          existingMarket = await prisma.markets.findFirst({
            where: {
              externalId: marketData.id,
            },
          });
          
          // 🔥 添加日志：记录找到的手动市场
          if (existingMarket) {

          }
        }

        // 🚀 核心修复：如果通过 externalId 没找到，尝试通过多策略匹配工厂空壳市场
        if (!existingMarket) {
          // 统一时间标准化：抹除毫秒差异，统一使用 UTC 时间
          const normalizeTime = (date: Date): Date => {
            const normalized = new Date(date);
            // 抹除毫秒差异，只保留到秒级精度
            normalized.setMilliseconds(0);
            return normalized;
          };

          const normalizedEndDate = normalizeTime(endDate);
          const normalizedEndTimeMs = normalizedEndDate.getTime();
          const marketTitle = title || marketData.question || '';
          
          // 🔥 从 Polymarket 市场标题中提取 symbol 和 period
          const extractedSymbol = extractSymbolFromTitle(marketTitle);
          const extractedPeriod = extractPeriodFromTitle(marketTitle);

          // 🚀 多策略匹配：使用预加载的索引进行快速匹配（优先使用数据库中的symbol和period，而不是从标题提取）
          let existingShell = null;
          let matchStrategy = '';

          // 🔥 改进策略1：直接在所有空壳市场中查找最接近的匹配（不依赖标题提取）
          // 这样可以匹配更多市场，因为不依赖于从Polymarket标题中提取symbol和period
          let bestCandidate = null;
          let minTimeDiff = Infinity;
          let bestMatchType = '';

          // 🔥 策略0：未来市场优先匹配 - 直接匹配最接近的空壳市场（不依赖标题提取）
          // 🔥 关键优化：对于未来市场，使用更宽松的时间窗口
          
          // 0.1 优先匹配相同period和symbol的市场（严格时间窗口：±period分钟）
          const commonPeriods = [15, 60, 1440]; // 15分钟、1小时、1天
          if (extractedSymbol) {
            for (const period of commonPeriods) {
              for (const candidate of unsyncedShells) {
                if (candidate.period === period && candidate.symbol === extractedSymbol) {
                  const candidateTime = candidate.closingDate.getTime();
                  const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                  // 🔥 修复：对于15分钟市场，使用严格的时间窗口（±15分钟），避免匹配到错误的市场
                  const allowedDiff = period * 60 * 1000; // period 分钟（例如15分钟周期只允许±15分钟）
                  if (timeDiff <= allowedDiff && timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                    bestMatchType = `精准周期性匹配-${period}分钟（时间差${Math.round(timeDiff / 60000)}分钟）`;
                  }
                }
              }
            }
          }
          
          // 0.2 匹配相同period的市场（严格时间窗口：±period分钟）
          if (!bestCandidate) {
            for (const period of commonPeriods) {
              for (const candidate of unsyncedShells) {
                if (candidate.period === period) {
                  const candidateTime = candidate.closingDate.getTime();
                  const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                  // 🔥 修复：使用严格的时间窗口（±period分钟），避免匹配到错误的市场
                  const allowedDiff = period * 60 * 1000; // period 分钟
                  if (timeDiff <= allowedDiff && timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                    bestMatchType = `周期性匹配-${period}分钟（时间差${Math.round(timeDiff / 60000)}分钟）`;
                  }
                }
              }
            }
          }
          
          // 0.3 匹配相同symbol的市场（±2小时的时间窗口）
          if (!bestCandidate && extractedSymbol) {
            for (const candidate of unsyncedShells) {
              if (candidate.symbol === extractedSymbol) {
                const candidateTime = candidate.closingDate.getTime();
                const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                // 相同symbol，允许±2小时的时间误差
                if (timeDiff <= 120 * 60000 && timeDiff < minTimeDiff) {
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                  bestMatchType = `symbol匹配（时间差${Math.round(timeDiff / 60000)}分钟）`;
                }
              }
            }
          }

          // 1.1 如果有提取到symbol，优先匹配相同symbol（±1分钟）
          if (!bestCandidate && extractedSymbol) {
            for (const candidate of unsyncedShells) {
              if (candidate.symbol === extractedSymbol) {
                const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                if (timeDiff <= 60000 && timeDiff < minTimeDiff) { // ±1分钟
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                  bestMatchType = extractedPeriod && candidate.period === extractedPeriod 
                    ? '精准匹配（symbol+period+time ±1分钟）'
                    : 'symbol+时间匹配（±1分钟）';
                }
              }
            }
          }

          // 1.2 如果有提取到period，在没有symbol匹配时，尝试匹配相同period（±1分钟）
          if (!bestCandidate && extractedPeriod) {
            for (const candidate of unsyncedShells) {
              if (candidate.period === extractedPeriod) {
                const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                if (timeDiff <= 60000 && timeDiff < minTimeDiff) { // ±1分钟
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                  bestMatchType = 'period+时间匹配（±1分钟）';
                }
              }
            }
          }

          // 策略2：放宽时间窗口到±5分钟（优先匹配相同symbol）
          if (!bestCandidate && extractedSymbol) {
            for (const candidate of unsyncedShells) {
              if (candidate.symbol === extractedSymbol) {
                const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                if (timeDiff <= 5 * 60000 && timeDiff < minTimeDiff) { // ±5分钟
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                  bestMatchType = 'symbol+时间匹配（±5分钟）';
                }
              }
            }
          }

          // 策略3：仅时间匹配（±15分钟）- 适用于15分钟周期市场，优先匹配相同symbol
          if (!bestCandidate) {
            for (const candidate of unsyncedShells) {
              const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
              // 相同symbol的候选，时间差权重减半（更优先）
              const weightedDiff = extractedSymbol && candidate.symbol === extractedSymbol ? timeDiff * 0.5 : timeDiff;
              if (timeDiff <= 15 * 60000 && weightedDiff < minTimeDiff) { // ±15分钟
                minTimeDiff = weightedDiff;
                bestCandidate = candidate;
                bestMatchType = candidate.symbol === extractedSymbol 
                  ? 'symbol+时间匹配（±15分钟）'
                  : '时间匹配（±15分钟）';
              }
            }
          }
          
          if (bestCandidate) {
            existingShell = await prisma.markets.findUnique({ where: { id: bestCandidate.id } });
          if (existingShell) {
              matchStrategy = bestMatchType;
            }
          }

          // 策略4：智能时间匹配 - 查找最接近的空壳市场（±30分钟，选择时间差最小的）
          if (!existingShell) {
            minTimeDiff = Infinity; // 重置
            bestCandidate = null;
            
            for (const candidate of unsyncedShells) {
              const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
              // 相同symbol的候选，时间差权重减半（更优先）
              const weightedDiff = extractedSymbol && candidate.symbol === extractedSymbol ? timeDiff * 0.5 : timeDiff;
              if (timeDiff <= 30 * 60000 && weightedDiff < minTimeDiff) { // ±30分钟
                minTimeDiff = weightedDiff;
                bestCandidate = candidate;
                bestMatchType = candidate.symbol === extractedSymbol 
                  ? '智能匹配-symbol（±30分钟）'
                  : '智能匹配（±30分钟）';
              }
            }
            
            if (bestCandidate && minTimeDiff <= 30 * 60000) {
              existingShell = await prisma.markets.findUnique({ where: { id: bestCandidate.id } });
              if (existingShell) {
                matchStrategy = bestMatchType.replace('±30分钟', `${Math.round(minTimeDiff / 60000)}分钟`);
              }
            }
          }
          
          // 策略5：扩大时间窗口到±2小时（120分钟）- 适用于周期性市场
          if (!existingShell) {
            minTimeDiff = Infinity; // 重置
            bestCandidate = null;
            
            // 优先匹配相同symbol
            if (extractedSymbol) {
              for (const candidate of unsyncedShells) {
                if (candidate.symbol === extractedSymbol) {
                  const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                  // 相同period的候选，时间差权重减半（更优先）
                  const weightedDiff = extractedPeriod && candidate.period === extractedPeriod ? timeDiff * 0.3 : timeDiff;
                  if (timeDiff <= 120 * 60000 && weightedDiff < minTimeDiff) { // ±2小时
                    minTimeDiff = weightedDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 如果没有找到相同symbol的，尝试所有候选
            if (!bestCandidate) {
              for (const candidate of unsyncedShells) {
                const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                // 相同period的候选，时间差权重减半（更优先）
                const weightedDiff = extractedPeriod && candidate.period === extractedPeriod ? timeDiff * 0.3 : timeDiff;
                if (timeDiff <= 120 * 60000 && weightedDiff < minTimeDiff) { // ±2小时
                  minTimeDiff = weightedDiff;
                  bestCandidate = candidate;
                }
              }
            }
            
            if (bestCandidate && minTimeDiff <= 120 * 60000) {
              existingShell = await prisma.markets.findUnique({ where: { id: bestCandidate.id } });
              if (existingShell) {
                matchStrategy = `扩大窗口匹配（时间差${Math.round(minTimeDiff / 60000)}分钟）`;
              }
            }
          }
          
          // 策略6：最后尝试 - 完全基于时间匹配，优先匹配相同symbol和period，时间窗口扩大到±24小时
          // 🔥 关键优化：对于15分钟周期市场，Polymarket的时间可能不完全对齐，需要更大的时间窗口
          if (!existingShell) {
            minTimeDiff = Infinity; // 重置
            bestCandidate = null;
            
            // 优先匹配相同symbol和period（±24小时）
            if (extractedSymbol && extractedPeriod) {
              for (const candidate of unsyncedShells) {
                if (candidate.symbol === extractedSymbol && candidate.period === extractedPeriod) {
                  const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                  if (timeDiff <= 1440 * 60000 && timeDiff < minTimeDiff) { // ±24小时
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 其次匹配相同symbol（±24小时）
            if (!bestCandidate && extractedSymbol) {
              for (const candidate of unsyncedShells) {
                if (candidate.symbol === extractedSymbol) {
                  const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                  if (timeDiff <= 1440 * 60000 && timeDiff < minTimeDiff) { // ±24小时
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 🔥 关键优化：如果没有提取到symbol，直接基于period匹配（适用于BTC 15分钟周期市场）
            if (!bestCandidate && extractedPeriod) {
              for (const candidate of unsyncedShells) {
                if (candidate.period === extractedPeriod) {
                  const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                  if (timeDiff <= 1440 * 60000 && timeDiff < minTimeDiff) { // ±24小时
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 最后尝试所有候选（±24小时）
            if (!bestCandidate) {
              for (const candidate of unsyncedShells) {
                const timeDiff = Math.abs(candidate.closingDate.getTime() - normalizedEndTimeMs);
                if (timeDiff <= 1440 * 60000 && timeDiff < minTimeDiff) { // ±24小时
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                }
              }
            }
            
            if (bestCandidate && minTimeDiff <= 1440 * 60000) {
              existingShell = await prisma.markets.findUnique({ where: { id: bestCandidate.id } });
              if (existingShell) {
                matchStrategy = `最后尝试匹配（时间差${Math.round(minTimeDiff / 60000)}分钟）`;
              }
            }
          }
          
          // 策略7：终极匹配 - 对于未来市场，直接匹配最接近的空壳市场（±7天，仅未来市场）
          // 🔥 这是最后的保险措施，确保未来市场能够匹配
          // 🔥 关键优化：只匹配未来的市场，过去24小时的市场不需要同步
          // 🔥 进一步扩大时间窗口到±7天，确保能匹配更多市场
          if (!existingShell) {
            minTimeDiff = Infinity; // 重置
            bestCandidate = null;
            
            // 优先匹配相同period的市场（±7天）
            if (extractedPeriod) {
              for (const candidate of unsyncedShells) {
                if (candidate.period === extractedPeriod) {
                  const candidateTime = candidate.closingDate.getTime();
                  const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                  // 🔥 对于未来市场，允许±7天的时间窗口
                  if (timeDiff <= 7 * 24 * 60 * 60000 && timeDiff < minTimeDiff) { // ±7天
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 如果没有匹配到相同period的，优先匹配相同symbol（±7天）
            if (!bestCandidate && extractedSymbol) {
              for (const candidate of unsyncedShells) {
                if (candidate.symbol === extractedSymbol) {
                  const candidateTime = candidate.closingDate.getTime();
                  const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                  if (timeDiff <= 7 * 24 * 60 * 60000 && timeDiff < minTimeDiff) { // ±7天
                    minTimeDiff = timeDiff;
                    bestCandidate = candidate;
                  }
                }
              }
            }
            
            // 最后尝试所有未来市场（±7天）
            if (!bestCandidate) {
              for (const candidate of unsyncedShells) {
                const candidateTime = candidate.closingDate.getTime();
                const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                // 🔥 对于未来市场，允许±7天的时间窗口
                if (timeDiff <= 7 * 24 * 60 * 60000 && timeDiff < minTimeDiff) { // ±7天
                  minTimeDiff = timeDiff;
                  bestCandidate = candidate;
                }
              }
            }
            
            if (bestCandidate && minTimeDiff <= 7 * 24 * 60 * 60000) {
              existingShell = await prisma.markets.findUnique({ where: { id: bestCandidate.id } });
              if (existingShell) {
                matchStrategy = `终极匹配-未来市场（时间差${Math.round(minTimeDiff / 60000)}分钟）`;
              }
            }
          }

          if (existingShell) {
            const matchInfo = [
              extractedSymbol ? `symbol=${extractedSymbol}` : 'symbol=未提取',
              extractedPeriod ? `period=${extractedPeriod}分钟` : 'period=未提取',
              `endTime=${normalizedEndDate.toISOString()}`,
              `策略=${matchStrategy}`,
            ].join(', ');

            existingMarket = existingShell;
            matchedCount++; // 🔥 更新匹配计数
            
            // 🔥 一对多匹配优化：如果匹配成功，尝试匹配更多相同symbol的空壳市场
            // ⚠️ 修复：对于15分钟市场，一对多匹配必须使用严格的时间窗口，避免将已结算市场的赔率更新到未结束的市场
            if (extractedSymbol && existingShell.symbol === extractedSymbol && extractedPeriod) {
              // 查找更多未匹配的空壳市场（相同symbol和period，严格时间窗口）
              const additionalShells = unsyncedShells.filter(candidate => {
                if (candidate.id === existingShell.id) return false; // 排除已匹配的
                if (candidate.symbol !== extractedSymbol) return false; // 必须相同symbol
                if (candidate.period !== extractedPeriod) return false; // 🔥 修复：必须相同period
                // 🔥 修复：使用严格的时间窗口（±period分钟），避免匹配到错误的时间段
                const candidateTime = candidate.closingDate.getTime();
                const timeDiff = Math.abs(candidateTime - normalizedEndTimeMs);
                const allowedDiff = extractedPeriod * 60 * 1000; // period 分钟（例如15分钟周期只允许±15分钟）
                return timeDiff <= allowedDiff;
              });
              
              // 最多匹配10个额外的空壳市场（避免过度匹配）
              const maxAdditionalMatches = 10;
              let additionalMatched = 0;
              
              for (const additionalShell of additionalShells.slice(0, maxAdditionalMatches)) {
                try {
                  // 检查是否已经被其他Polymarket市场匹配
                  const checkShell = await prisma.markets.findUnique({
                    where: { id: additionalShell.id },
                    select: { externalId: true },
                  });
                  
                  // 如果仍然是空壳市场（externalId为null），则匹配
                  if (checkShell && !checkShell.externalId) {
                    // 🔥 关键修复：一对多匹配时也需要更新outcomePrices和其他赔率相关字段
                    // 这样前端才能实时显示赔率
                    const updateData: any = {
                      externalId: marketData.id,
                      externalSource: 'polymarket',
                      // 🔥 更新赔率相关字段
                      outcomePrices: outcomePricesJson || null,
                      yesProbability: yesProbability || null,
                      noProbability: noProbability || null,
                      initialPrice: initialPriceValue || null,
                      // 更新外部交易量（如果有）
                      ...(totalVolume && { 
                        externalVolume: typeof totalVolume === 'number' 
                          ? totalVolume 
                          : parseFloat(String(totalVolume || 0))
                      }),
                      updatedAt: new Date(),
                    };
                    
                    await prisma.markets.update({
                      where: { id: additionalShell.id },
                      data: updateData,
                    });
                    
                    matchedCount++;
                    additionalMatched++;

                  }
                } catch (error: any) {
                  console.error(`❌ [PolymarketAdapter] 一对多匹配失败 (数据库ID: ${additionalShell.id}):`, error.message);
                }
              }
              
              if (additionalMatched > 0) {

              }
            }
          } else {
            // 🔥 如果所有策略都失败，记录详细信息用于调试
            const debugInfo = {
              extractedSymbol: extractedSymbol || '未提取',
              extractedPeriod: extractedPeriod || '未提取',
              normalizedEndDate: normalizedEndDate.toISOString(),
              marketTitle: marketTitle.substring(0, 80),
            };
            // 🔥 减少日志频率，避免刷屏（只记录10%的失败案例）
            if (Math.random() < 0.1) {
              // 🔥 减少日志频率，避免刷屏（只记录10%的失败案例）
              if (Math.random() < 0.1) {

              }
            }
          }
        }

        // 🔥 红蓝双轨制：如果市场已由工厂生成（isFactory=true）且已有 externalId，采集源必须跳过
        // 🔥 例外：如果工厂市场有externalId但没有outcomePrices，允许更新赔率数据（修复一对多匹配的遗留问题）
        if (existingMarket && (existingMarket as any).isFactory === true && existingMarket.externalId) {
          // 检查是否有outcomePrices
          const hasOutcomePrices = !!(existingMarket.outcomePrices || (existingMarket as any).outcomePrices);
          if (hasOutcomePrices) {
            // 如果已有赔率数据，跳过更新（避免覆盖）

          skipCount++;
          continue;
          } else {
            // 🔥 关键修复：如果工厂市场有externalId但没有outcomePrices，允许更新赔率数据

            // 继续执行，不跳过
          }
        }

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

          const { calculateDisplayVolume } = await import('@/lib/marketUtils');
          const newDisplayVolume = calculateDisplayVolume({
            source: existingMarket.source || 'POLYMARKET',
            externalVolume: externalVolumeValue, // 🔥 只更新外部交易量
            internalVolume: existingMarket.internalVolume || 0, // 🔥 保留内部交易量（不覆盖）
            manualOffset: existingMarket.manualOffset || 0, // 🔥 保留手动偏移量（不覆盖）
          });
          
          // 🔥 使用之前已声明的 isManualMarket 变量（第659行）
          
          // 🚀 核心修复：如果是工厂空壳市场（externalId=null），需要填充 externalId 和 externalSource
          const isFactoryShell = (existingMarket as any).isFactory === true && !existingMarket.externalId;
          
          // 🔥 构建更新数据：仅更新数值字段，绝对禁止修改 status
          // 🔥 核心修复：确保每个字段都是独立赋值的，没有任何条件包装
          const updateData: any = {
            // 更新基本信息
            title: title,
            description: description ?? existingMarket.description,
            // 更新翻译字段
            ...(titleZh && { titleZh }),
            ...(descriptionZh && { descriptionZh }),
            closingDate: endDate,
            // 🔥 修复：手动市场保持 source='INTERNAL'，工厂空壳市场保持 'INTERNAL'，只有 POLYMARKET 市场才设置为 'POLYMARKET'
            source: (isManualMarket || isFactoryShell) ? existingMarket.source || 'INTERNAL' : 'POLYMARKET',
            // 🚀 核心修复：如果是工厂空壳市场，填充 externalId 和 externalSource
            ...(isFactoryShell && {
              externalId: marketData.id, // 填充 externalId
              externalSource: 'polymarket', // 设置 externalSource
            }),
            // 🔥 修复：手动市场也要设置 externalSource，确保下次采集时能快速匹配
            ...(!isFactoryShell && { externalSource: 'polymarket' }),
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
          
          // 🚀 核心修复：记录更新类型（手动市场、工厂空壳市场、或 POLYMARKET 市场）
          const marketType = isFactoryShell ? '工厂空壳市场（已填充 externalId）' : (isManualMarket ? '手动市场' : 'POLYMARKET市场');

          if (isFactoryShell) {

          }
          // 🔥 注意：savedCount++ 在后面的代码中统一增加（避免重复计数）
        } else {
          // 🔥 新事件：创建新记录，status 强制设为 PENDING_REVIEW（进入审核中心）
          // 🔥 确保 totalVolume 是数字类型
          const externalVolumeValue = typeof totalVolume === 'number' 
            ? totalVolume 
            : parseFloat(String(totalVolume || 0));
          
          // 🔥 物理锁死：Polymarket 爬虫适配器不再允许创建市场
          // 所有市场必须通过工厂预生成系统创建
          // 但如果手动市场已有 externalId，说明管理员已经手动创建并设置了外部链接，应该允许更新
          console.warn(`⚠️ [PolymarketAdapter] 创建市场请求被拒绝：系统已进入"严格列表制"，无法创建新市场: ${title.substring(0, 50)}`);
          console.warn(`⚠️ [PolymarketAdapter] 提示：如果这是手动创建的市场，请先在后台编辑页面设置 externalId，然后采集源会自动更新该市场的数据`);
          // 🔥 修复：不抛出错误，而是跳过（避免中断整个采集流程）
          skipCount++;
          continue;
          
          // 🔥 以下代码已被禁用（保留用于参考）
          /*
          market = await prisma.markets.create({
            data: {
              title: title,
              titleZh: titleZh || null,
              description: description || '',
              descriptionZh: descriptionZh || null,
              closingDate: endDate,
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
              category: categorySlug || null,
              categorySlug: categorySlug || null,
              // 🔥 保存原始数据字段 - 每个字段独立赋值，互不依赖
              outcomePrices: outcomePricesJson || null, // 原始赔率 JSON 字符串，即使为空也保存 null
              image: imageUrl || null, // 头像 URL，即使为空也保存 null（不影响后续字段）
              iconUrl: iconUrlValue || null, // 备份头像字段，即使为空也保存 null
              initialPrice: initialPriceValue || null, // 初始价格（YES 价格，0-1 之间），即使为空也保存 null
              volume24h: volume24hValue || null, // 24小时交易量，即使为空也保存 null
            },
          });

          */
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

      } catch (error) {
        errorCount++;
        console.error(`❌ [PolymarketAdapter] 保存市场失败 (ID: ${marketData.id}):`, error);
        console.error(`❌ [PolymarketAdapter] 错误详情:`, {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : 'N/A',
        });
        // 继续处理下一个
      }
    }

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

    // 🔥 额外处理：手动市场的单独更新
    // 查询所有有 externalId 但 source 为 INTERNAL 且 isFactory 为 false 的市场（手动市场）
    try {

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
        },
      });

      let manualMarketUpdatedCount = 0;
      
      for (const manualMarket of manualMarketsWithExternalId) {
        try {
          const externalId = (manualMarket as any).externalId;
          if (!externalId) continue;

          // 🔥 检查该市场是否已经在本次采集中被更新过
          if (updatedMarketIds.has(manualMarket.id)) {

            continue;
          }

          // 🔥 单独从 Polymarket API 获取该市场的数据

          const singleMarketUrl = `https://gamma-api.polymarket.com/markets/${externalId}`;
          const response = await fetch(singleMarketUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (!response.ok) {
            console.warn(`⚠️ [PolymarketAdapter] 手动市场 ${externalId} 的 API 请求失败: ${response.status}`);
            continue;
          }

          const singleMarketData: PolymarketMarket = await response.json();
          
          if (!singleMarketData || !singleMarketData.id) {
            console.warn(`⚠️ [PolymarketAdapter] 手动市场 ${externalId} 的 API 返回数据无效`);
            continue;
          }

          // 🔥 使用相同的保存逻辑更新手动市场
          // 这里需要调用 save 方法中的更新逻辑，但为了避免重复代码，我们直接在这里实现更新逻辑
          // 由于代码较长，我们简化处理：只更新关键字段
          const existingMarket = await prisma.markets.findUnique({
            where: { id: manualMarket.id },
          });

          if (!existingMarket) continue;

          // 提取数据（复用 save 方法中的逻辑）
          const title = singleMarketData.title || singleMarketData.question || '';
          const description = singleMarketData.description || '';
          const endDateStr = singleMarketData.endDateIso || singleMarketData.endDate;
          const endDate = endDateStr ? new Date(endDateStr) : existingMarket.closingDate;
          
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
            source: existingMarket.source || 'INTERNAL',
            externalVolume: externalVolumeValue,
            internalVolume: existingMarket.internalVolume || 0,
            manualOffset: existingMarket.manualOffset || 0,
          });

          // 更新市场
          await prisma.markets.update({
            where: { id: manualMarket.id },
            data: {
              title: title || existingMarket.title,
              description: description || existingMarket.description,
              closingDate: endDate,
              externalVolume: externalVolumeValue,
              totalVolume: newDisplayVolume,
              yesProbability,
              noProbability,
              outcomePrices: outcomePricesJson || null,
              image: singleMarketData.image || existingMarket.image || null,
              iconUrl: singleMarketData.icon || existingMarket.iconUrl || null,
              initialPrice: initialPriceValue,
              externalSource: 'polymarket', // 确保设置 externalSource
              updatedAt: new Date(),
            },
          });

          updatedMarketIds.add(manualMarket.id);
          manualMarketUpdatedCount++;
          savedCount++;

        } catch (error) {
          console.error(`❌ [PolymarketAdapter] 更新手动市场失败 (ID: ${manualMarket.id}):`, error);
          errorCount++;
        }
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
