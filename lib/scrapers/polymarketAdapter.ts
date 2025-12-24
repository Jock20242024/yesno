/**
 * Polymarket 采集适配器
 * 实现 ScraperEngine 接口，专门对接 Polymarket Gamma API
 */

import { ScraperEngine, ScrapeResult } from './engine';
import { prisma } from '@/lib/prisma';

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
    console.log(`📡 [PolymarketAdapter] 开始请求 API（全量拉取模式，无时间过滤）: ${apiUrl}`);

    try {
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      };

      console.log(`🔄 [PolymarketAdapter] 发送请求...`);
      const response = await fetch(apiUrl, fetchOptions);

      console.log(`📥 [PolymarketAdapter] 响应状态: ${response.status} ${response.statusText}`);
      
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
      console.log('📡 [Scraper Debug] ========== API 原始数据诊断 ==========');
      console.log('📡 [Scraper Debug] API 返回原始数据量:', dataLength);
      console.log('📡 [Scraper Debug] API 原始数据条数:', dataLength);
      
      if (Array.isArray(data) && dataLength > 0) {
        // 打印前 2 条数据的 ID
        const firstTwoIds = data.slice(0, 2).map((item: any, index: number) => ({
          index: index + 1,
          id: item.id || 'N/A',
          title: item.title || item.question || 'N/A',
        }));
        console.log('📡 [Scraper Debug] 前 2 条数据的 ID:', JSON.stringify(firstTwoIds, null, 2));
      } else {
        console.warn('⚠️ [Scraper Debug] API 返回数据为空或不是数组！');
      }
      console.log('📡 [Scraper Debug] ======================================');
      
      console.log(`✅ [PolymarketAdapter] 成功获取数据，类型: ${Array.isArray(data) ? 'Array' : typeof data}, 长度: ${dataLength}`);
      
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
        console.log(`📋 [PolymarketAdapter] ========== 原始 API 返回的前 ${sampleCount} 条数据 ==========`);
        for (let i = 0; i < sampleCount; i++) {
          console.log(`📋 [PolymarketAdapter] 第 ${i + 1} 条数据:`, JSON.stringify(data[i], null, 2));
        }
        console.log(`📋 [PolymarketAdapter] ================================================`);
        
        // 字段检查（包括 liquidity/TVL 和活跃用户相关字段）
        console.log(`📊 [PolymarketAdapter] 第一条数据字段检查:`, {
          id: data[0].id,
          title: data[0].title || data[0].question,
          volume: data[0].volume,
          volumeNum: data[0].volumeNum,
          liquidity: data[0].liquidity,
          liquidityNum: data[0].liquidityNum,
          outcomePrices: data[0].outcomePrices,
          closed: data[0].closed,
          hasEvents: !!data[0].events,
          eventsLength: data[0].events?.length || 0,
          // 🔥 检查是否有活跃用户相关字段
          activeUsers: (data[0] as any).activeUsers || (data[0] as any).users_24h || (data[0] as any).active_users || 'N/A',
        });
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
        console.log(`⏭️ [PolymarketAdapter] 跳过已关闭的市场 (ID: ${market.id})`);
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
    console.log(`💾 [PolymarketAdapter] ========== 开始保存数据到数据库 ==========`);
    console.log(`💾 [PolymarketAdapter] 标准化后的数据条数: ${normalizedData.length}`);
    
    // 🔥 强制重置：物理删除所有同步记忆（DataSource 表的 lastSyncTime 和 itemsCount）
    try {
      const result = await prisma.dataSource.updateMany({
        where: { sourceName: 'Polymarket' },
        data: {
          lastSyncTime: null, // 强制清空最后同步时间
          itemsCount: 0, // 强制重置计数
        },
      });
      console.log(`🧹 [PolymarketAdapter] 强制重置同步标记: 已更新 ${result.count} 条 DataSource 记录`);
    } catch (error) {
      console.error(`❌ [PolymarketAdapter] 强制重置同步标记失败:`, error);
      // 即使失败也继续执行，不中断流程
    }
    
    let savedCount = 0;
    let totalVolumeSum = 0; // 用于聚合计算交易量总和
    let totalLiquiditySum = 0; // 用于聚合计算TVL总和
    const updatedMarketIds = new Set<string>(); // 记录本次采集更新的市场 ID
    let skipCount = 0; // 跳过的数量
    let errorCount = 0; // 错误的数量

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
          if (firstEvent.image) {
            imageUrl = firstEvent.image;
          } else if ((firstEvent as any).iconUrl) {
            iconUrlValue = (firstEvent as any).iconUrl;
          } else if (firstEvent.icon) {
            iconUrlValue = firstEvent.icon;
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
        console.log(`📝 [PolymarketAdapter] 正在同步市场: ${(marketData.title || marketData.question || '未命名').substring(0, 50)} | 头像: ${!!(imageUrl || iconUrlValue)} | 赔率: ${outcomePricesJson || 'NULL'}`);

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
              console.log(`⏭️ [PolymarketAdapter] 跳过死盘市场 (ID: ${marketData.id}): YES=${yesProbability}%, NO=${noProbability}%`);
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
          const category = await prisma.category.findUnique({
            where: { slug: categorySlug },
          });
          if (category) {
            categoryId = category.id;
            console.log(`✅ [PolymarketAdapter] 找到分类: ${category.id} (slug: ${categorySlug})`);
          } else {
            console.warn(`⚠️ [PolymarketAdapter] 未找到分类 '${categorySlug}'，将跳过分类关联（市场将出现在"所有市场"中）`);
          }
        }

        // 检查是否已拒绝
        const rejectedMarket = await prisma.market.findFirst({
          where: {
            externalId: marketData.id,
            externalSource: 'polymarket',
            reviewStatus: 'REJECTED',
          },
        });

        if (rejectedMarket) {
          console.log(`⏭️ [PolymarketAdapter] 跳过已拒绝的市场 (ID: ${marketData.id})`);
          skipCount++;
          continue;
        }

        // 🔥 重写 Upsert 逻辑：使用 externalId + externalSource 作为唯一标识（不再依赖时间戳）
        // 先查找是否存在（使用 externalId 和 externalSource 组合作为唯一标识）
        const existingMarket = await prisma.market.findFirst({
          where: {
            externalId: marketData.id,
            externalSource: 'polymarket',
          },
        });

        // 🔥 红蓝双轨制：如果市场已由工厂生成（isFactory=true），采集源必须跳过，不许更新
        if (existingMarket && (existingMarket as any).isFactory === true) {
          console.log(`⏭️ [PolymarketAdapter] 跳过工厂生成的市场 (externalId: ${marketData.id}): 该市场已由自动化工厂生成，采集源不得更新`);
          skipCount++;
          continue;
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
        console.log(`💾 [PolymarketAdapter] 正在保存/更新市场: ${title.substring(0, 60)}`);
        console.log(`📊 [PolymarketAdapter] 市场状态锁定: existingMarket=${!!existingMarket}, 当前status=${existingMarket?.status || 'N/A'}, 新创建status=${marketStatusForCreate || '不修改（已存在）'}`);

        let market;
        if (existingMarket) {
          // 🔥 已有事件：仅更新数值字段，绝对禁止修改 status
          // 🔥 确保 totalVolume 是数字类型
          const externalVolumeValue = typeof totalVolume === 'number' 
            ? totalVolume 
            : parseFloat(String(totalVolume || 0));
          
          console.log(`🔄 [PolymarketAdapter] 更新已存在的市场 (externalId: ${marketData.id}, 数据库 ID: ${existingMarket.id}):`, {
            title: title.substring(0, 50),
            volume: externalVolumeValue,
            yesProbability,
            noProbability,
            existingStatus: existingMarket.status,
            existingIsActive: existingMarket.isActive,
            existingInternalVolume: existingMarket.internalVolume || 0,
            existingManualOffset: existingMarket.manualOffset || 0,
          });
          
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
            description: description ?? existingMarket.description,
            // 更新翻译字段
            ...(titleZh && { titleZh }),
            ...(descriptionZh && { descriptionZh }),
            closingDate: endDate,
            source: 'POLYMARKET',
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
          };
          
          market = await prisma.market.update({
            where: { id: existingMarket.id },
            data: updateData,
          });
          
          console.log(`✅ [PolymarketAdapter] 市场更新成功 (数据库 ID: ${market.id}), status 保持不变: ${market.status}`);
        } else {
          // 🔥 新事件：创建新记录，status 强制设为 PENDING_REVIEW（进入审核中心）
          // 🔥 确保 totalVolume 是数字类型
          const externalVolumeValue = typeof totalVolume === 'number' 
            ? totalVolume 
            : parseFloat(String(totalVolume || 0));
          
          // 🔥 物理锁死：Polymarket 爬虫适配器不再允许创建市场
          // 所有市场必须通过工厂预生成系统创建
          console.warn(`⚠️ [PolymarketAdapter] 创建市场请求被拒绝：系统已进入"严格列表制"，无法创建新市场: ${title.substring(0, 50)}`);
          throw new Error('Market creation is disabled. All markets must be created through the factory pre-generation system.');
          
          // 🔥 以下代码已被禁用（保留用于参考）
          /*
          market = await prisma.market.create({
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
          
          console.log(`✅ [PolymarketAdapter] 新市场创建成功 (数据库 ID: ${market.id}), status: ${market.status}`);
          */
        }

        // 更新或创建分类关联
        if (categoryId) {
          const existingLink = await prisma.marketCategory.findFirst({
            where: {
              marketId: market.id,
              categoryId: categoryId,
            },
          });

          if (!existingLink) {
            await prisma.marketCategory.create({
              data: {
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
          console.log(`💧 [PolymarketAdapter] 市场流动性 (ID: ${marketData.id}): ${liquidity.toLocaleString()}`);
        }

        savedCount++;
        // 确保 totalVolume 是数字类型用于累加
        const volumeForSum = typeof totalVolume === 'number' ? totalVolume : parseFloat(String(totalVolume || 0));
        totalVolumeSum += volumeForSum;
        totalLiquiditySum += liquidity; // 🔥 累加所有市场的流动性作为 TVL
        updatedMarketIds.add(market.id); // 记录已更新的市场 ID
        
        console.log(`✅ [PolymarketAdapter] 已保存/更新市场: ${title}${titleZh ? ` (${titleZh})` : ''} (交易量: ${volumeForSum.toLocaleString()}, 流动性: ${liquidity.toLocaleString()}, Yes: ${yesProbability}%, No: ${noProbability}%)`);

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
    
    console.log(`💾 [PolymarketAdapter] ========== 保存完成 ==========`);
    console.log(`💾 [PolymarketAdapter] 保存统计: 成功=${savedCount}, 跳过=${skipCount}, 错误=${errorCount}, 总计=${normalizedData.length}`);
    console.log(`✅ [PolymarketAdapter] 成功抓取全网 TVL: $${totalLiquiditySum.toLocaleString()}, 活跃人数: 待统计`);

    // 自动清理过期 PENDING_REVIEW 事件：删除那些在本次采集中没有被更新的 PENDING_REVIEW 事件
    try {
      console.log(`🧹 [PolymarketAdapter] 开始清理过期的 PENDING_REVIEW 事件...`);
      
      // 获取所有 PENDING_REVIEW 状态的市场（未审核的生肉）
      const allPendingMarkets = await prisma.market.findMany({
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
        console.log(`🗑️ [PolymarketAdapter] 发现 ${expiredPendingMarkets.length} 个过期的 PENDING 事件，准备删除...`);
        
        const expiredIds = expiredPendingMarkets.map(m => m.id);
        const deleteResult = await prisma.market.deleteMany({
          where: {
            id: {
              in: expiredIds,
            },
            status: 'PENDING_REVIEW', // 🔥 使用 status 字段过滤
          },
        });

        console.log(`✅ [PolymarketAdapter] 已清理 ${deleteResult.count} 个过期的 PENDING 事件`);
      } else {
        console.log(`✅ [PolymarketAdapter] 没有过期的 PENDING 事件需要清理`);
      }
    } catch (error) {
      console.error(`❌ [PolymarketAdapter] 清理过期 PENDING 事件失败:`, error);
      // 不影响主流程，只记录错误
    }

    // 🔥 剥离：全局统计数据计算已移至独立脚本 scripts/calculate-global-stats.ts
    // 市场抓取脚本只负责抓取市场数据到审核中心，不再更新 GlobalStat
    console.log(`✅ [PolymarketAdapter] 市场数据抓取完成，本次采集流动性总和: ${totalLiquiditySum.toLocaleString()}`);
    console.log(`ℹ️ [PolymarketAdapter] 提示：全局统计数据请使用独立脚本 scripts/calculate-global-stats.ts 或 API /api/admin/stats/calculate 计算`);

    return savedCount;
  }
}
